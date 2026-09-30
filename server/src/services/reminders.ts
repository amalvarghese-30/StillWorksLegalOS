import { Types } from "mongoose";
import { Reminder, type ReminderSourceType, type ReminderStatus, type IReminder } from "../models/Reminder.js";

export interface SyncCallRemindersOptions {
  sourceType: ReminderSourceType;
  sourceId: Types.ObjectId | string;
  userIds: (Types.ObjectId | string)[];
  clientName: string;
  phone?: string;
  notes?: string;
  scheduledAt: Date;
  status?: ReminderStatus;
}

/**
 * Synchronizes multi-user call reminders for a given source entity (task, event, case, etc.).
 * - Retains existing reminder documents for assigned users.
 * - Removes reminders for unassigned users (userId: { $nin: userIds }).
 * - Creates new reminders for newly assigned users without generating duplicates.
 */
export async function syncCallReminders(options: SyncCallRemindersOptions): Promise<IReminder[]> {
  const { sourceType, sourceId, clientName, phone = "", notes = "", scheduledAt, status } = options;
  const sourceObjId = typeof sourceId === "string" ? new Types.ObjectId(sourceId) : sourceId;

  // Deduplicate and normalize userIds
  const normalizedUserIds: Types.ObjectId[] = [];
  const seenUserIds = new Set<string>();

  for (const uid of options.userIds) {
    if (!uid) continue;
    const strId = uid.toString().trim();
    if (!strId || !Types.ObjectId.isValid(strId)) continue;
    if (!seenUserIds.has(strId)) {
      seenUserIds.add(strId);
      normalizedUserIds.push(new Types.ObjectId(strId));
    }
  }

  // 1. Remove reminders for unassigned users
  await Reminder.deleteMany({
    sourceType,
    sourceId: sourceObjId,
    userId: { $nin: normalizedUserIds },
  });

  if (normalizedUserIds.length === 0) {
    return [];
  }

  // 2. Synchronize / create reminders for assigned users
  const results: IReminder[] = [];

  for (const userId of normalizedUserIds) {
    const existing = await Reminder.findOne({
      sourceType,
      sourceId: sourceObjId,
      userId,
    });

    if (existing) {
      // Retain existing reminder document, updating details
      existing.clientName = clientName;
      existing.phone = phone;
      existing.notes = notes;

      const scheduleChanged = existing.scheduledAt.getTime() !== scheduledAt.getTime();
      existing.scheduledAt = scheduledAt;

      if (status) {
        existing.status = status;
        if (status === "completed" && !existing.completedAt) {
          existing.completedAt = new Date();
        }
      } else if (scheduleChanged && (existing.status === "triggered" || existing.status === "snoozed")) {
        // If scheduled date changed and alert had triggered/snoozed, reset to scheduled
        existing.status = "scheduled";
        existing.snoozedUntil = undefined;
      }

      await existing.save();
      results.push(existing);
    } else {
      // Create new reminder for newly assigned user
      try {
        const created = await Reminder.create({
          userId,
          sourceType,
          sourceId: sourceObjId,
          clientName,
          phone,
          notes,
          scheduledAt,
          status: status || "scheduled",
        });
        results.push(created);
      } catch (err: any) {
        // If race condition hit unique index, fetch and update
        if (err.code === 11000) {
          const raceDoc = await Reminder.findOne({
            sourceType,
            sourceId: sourceObjId,
            userId,
          });
          if (raceDoc) {
            raceDoc.clientName = clientName;
            raceDoc.phone = phone;
            raceDoc.notes = notes;
            raceDoc.scheduledAt = scheduledAt;
            if (status) raceDoc.status = status;
            await raceDoc.save();
            results.push(raceDoc);
          }
        } else {
          throw err;
        }
      }
    }
  }

  return results;
}

/**
 * Cascade-delete all reminders linked to a given source entity (task, event, etc.).
 */
export async function deleteCallReminders(
  sourceType: ReminderSourceType,
  sourceId: Types.ObjectId | string
): Promise<number> {
  const sourceObjId = typeof sourceId === "string" ? new Types.ObjectId(sourceId) : sourceId;
  const res = await Reminder.deleteMany({ sourceType, sourceId: sourceObjId });
  return res.deletedCount ?? 0;
}
