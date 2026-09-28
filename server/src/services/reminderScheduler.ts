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

      for (const reminder of dueReminders) {
        const deliveryId = randomUUID();
        reminder.status = "triggered";
        reminder.triggeredAt = now;
        reminder.deliveryId = deliveryId;
        await reminder.save();

        const payload = {
          _id: reminder._id.toString(),
          id: reminder._id.toString(),
          userId: reminder.userId.toString(),
          sourceType: reminder.sourceType,
          sourceId: reminder.sourceId ? reminder.sourceId.toString() : undefined,
          clientName: reminder.clientName,
          phone: reminder.phone,
          notes: reminder.notes,
          scheduledAt: reminder.scheduledAt.toISOString(),
          status: reminder.status,
          deliveryId,
        };

        if (io) {
          io.to(`user:${reminder.userId.toString()}`).emit("reminder:due", payload);
        }

        // Also create an in-app notification honoring preferences
        await NotificationService.createNotification(
          {
            userId: reminder.userId,
            type: "CUSTOM",
            title: `Call Reminder: ${reminder.clientName}`,
            message: `Scheduled call with ${reminder.clientName} (${reminder.phone || "No phone"}) is due now.`,
            relatedId: reminder._id,
            relatedModel: "Reminder",
            metadata: {
              subType: "call_reminder",
              reminderId: reminder._id.toString(),
              phone: reminder.phone,
              clientName: reminder.clientName,
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
