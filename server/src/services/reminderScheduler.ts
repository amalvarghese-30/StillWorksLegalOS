import { randomUUID } from "node:crypto";
import { Reminder } from "../models/Reminder.js";
import { NotificationService } from "./notifications.js";

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Starts the server-side reminder scheduler.
 * Polls the database periodically for due or snoozed reminders, marks them as triggered,
 * and emits real-time events to user-specific Socket.IO rooms.
 */
export function startReminderScheduler(io?: any): void {
  if (schedulerInterval) return;

  const checkDueReminders = async () => {
    try {
      const now = new Date();

      const dueReminders = await Reminder.find({
        status: { $in: ["scheduled", "snoozed"] },
        $or: [
          { status: "scheduled", scheduledAt: { $lte: now } },
          { status: "snoozed", snoozedUntil: { $lte: now } },
        ],
      });

      for (const candidate of dueReminders) {
        const deliveryId = randomUUID();
        // Atomic claim: guarantees that only one worker instance triggers and delivers this reminder
        const claimed = await Reminder.findOneAndUpdate(
          {
            _id: candidate._id,
            status: candidate.status,
            $or: [
              { status: "scheduled", scheduledAt: { $lte: now } },
              { status: "snoozed", snoozedUntil: { $lte: now } },
            ],
          },
          {
            $set: {
              status: "triggered",
              triggeredAt: now,
              deliveryId,
            },
          },
          { new: true }
        );

        if (!claimed) {
          // Concurrently claimed by another worker instance
          continue;
        }

        const payload = {
          _id: claimed._id.toString(),
          id: claimed._id.toString(),
          userId: claimed.userId.toString(),
          sourceType: claimed.sourceType,
          sourceId: claimed.sourceId ? claimed.sourceId.toString() : undefined,
          clientName: claimed.clientName,
          phone: claimed.phone,
          notes: claimed.notes,
          scheduledAt: claimed.scheduledAt.toISOString(),
          status: claimed.status,
          deliveryId,
        };

        if (io) {
          io.to(`user:${claimed.userId.toString()}`).emit("reminder:due", payload);
        }

        // Also create an in-app notification honoring preferences
        await NotificationService.createNotification(
          {
            userId: claimed.userId,
            type: "CUSTOM",
            title: `Call Reminder: ${claimed.clientName}`,
            message: `Scheduled call with ${claimed.clientName} (${claimed.phone || "No phone"}) is due now.`,
            relatedId: claimed._id,
            relatedModel: "Reminder",
            metadata: {
              subType: "call_reminder",
              reminderId: claimed._id.toString(),
              phone: claimed.phone,
              clientName: claimed.clientName,
              deliveryId,
            },
          },
          io
        );
      }
    } catch (err) {
      console.error("[reminderScheduler] Error polling due reminders:", err);
    }
  };

  // Run initial check after 3 seconds, then every 15 seconds
  setTimeout(checkDueReminders, 3000);
  schedulerInterval = setInterval(checkDueReminders, 15_000);
}

export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
