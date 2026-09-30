import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { Reminder, type ReminderStatus } from "../models/Reminder.js";
import { Task } from "../models/Task.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// State Machine Transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<ReminderStatus, ReminderStatus[]> = {
  scheduled: ["triggered", "snoozed", "acknowledged", "completed", "dismissed", "cancelled"],
  triggered: ["snoozed", "acknowledged", "completed", "dismissed", "cancelled"],
  snoozed: ["triggered", "snoozed", "acknowledged", "completed", "dismissed", "cancelled"],
  acknowledged: ["snoozed", "completed", "dismissed", "cancelled"],
  completed: [],
  dismissed: [],
  cancelled: [],
};

function canTransition(current: ReminderStatus, target: ReminderStatus): boolean {
  if (current === target) return true;
  return VALID_TRANSITIONS[current]?.includes(target) ?? false;
}

// ---------------------------------------------------------------------------
// GET /api/reminders/health — public service health check (no auth required)
// ---------------------------------------------------------------------------
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "reminders",
  });
});

// All subsequent reminder routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/reminders/due — fetch due / missed reminders for the logged in user
// ---------------------------------------------------------------------------

router.get("/due", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    // Due includes:
    // 1. Reminders that were marked 'triggered' or 'acknowledged' but not yet completed/dismissed
    // 2. Reminders 'scheduled' whose scheduledAt has arrived (missed while offline)
    // 3. Reminders 'snoozed' whose snoozedUntil has arrived
    const reminders = await Reminder.find({
      userId: req.userId,
      $or: [
        { status: { $in: ["triggered", "acknowledged"] } },
        { status: "scheduled", scheduledAt: { $lte: now } },
        { status: "snoozed", snoozedUntil: { $lte: now } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({ reminders });
  } catch (err) {
    console.error("[reminders] Get due error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reminders — list reminders with optional status filter
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, limit = "50" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { userId: req.userId };
    if (status && status !== "all") {
      filter["status"] = status;
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const reminders = await Reminder.find(filter)
      .sort({ scheduledAt: -1 })
      .limit(limitNum)
      .lean();

    res.json({ reminders });
  } catch (err) {
    console.error("[reminders] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/reminders/:id/acknowledge
// ---------------------------------------------------------------------------

router.post("/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params["id"], userId: req.userId });
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    if (!canTransition(reminder.status, "acknowledged")) {
      res.status(409).json({
        message: `Cannot transition reminder from state '${reminder.status}' to 'acknowledged'`,
        currentStatus: reminder.status,
      });
      return;
    }

    reminder.status = "acknowledged";
    reminder.acknowledgedAt = new Date();
    await reminder.save();

    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Acknowledge error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/reminders/:id/snooze
// ---------------------------------------------------------------------------

router.post("/:id/snooze", async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params["id"], userId: req.userId });
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    if (!canTransition(reminder.status, "snoozed")) {
      res.status(409).json({
        message: `Cannot transition reminder from state '${reminder.status}' to 'snoozed'`,
        currentStatus: reminder.status,
      });
      return;
    }

    const minutes = Number(req.body?.minutes) || 10;
    reminder.status = "snoozed";
    reminder.snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
    await reminder.save();

    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Snooze error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/reminders/:id/complete
// ---------------------------------------------------------------------------

router.post("/:id/complete", async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params["id"], userId: req.userId });
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    if (!canTransition(reminder.status, "completed")) {
      res.status(409).json({
        message: `Cannot transition reminder from state '${reminder.status}' to 'completed'`,
        currentStatus: reminder.status,
      });
      return;
    }

    reminder.status = "completed";
    reminder.completedAt = new Date();
    await reminder.save();

    // Synchronize linked Task if this reminder was created from a Task
    if (reminder.sourceType === "task" && reminder.sourceId) {
      await Task.findByIdAndUpdate(reminder.sourceId, {
        $set: { "callReminder.completed": true },
      });
    }

    // Synchronize linked CalendarEvent if applicable
    if (reminder.sourceType === "event" && reminder.sourceId) {
      await CalendarEvent.findByIdAndUpdate(reminder.sourceId, {
        $set: { color: "#10b981" },
      });
    }

    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Complete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/reminders/:id/dismiss
// ---------------------------------------------------------------------------

router.post("/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params["id"], userId: req.userId });
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    if (!canTransition(reminder.status, "dismissed")) {
      res.status(409).json({
        message: `Cannot transition reminder from state '${reminder.status}' to 'dismissed'`,
        currentStatus: reminder.status,
      });
      return;
    }

    reminder.status = "dismissed";
    await reminder.save();

    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Dismiss error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/reminders/:id/cancel
// ---------------------------------------------------------------------------

router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params["id"], userId: req.userId });
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    if (!canTransition(reminder.status, "cancelled")) {
      res.status(409).json({
        message: `Cannot transition reminder from state '${reminder.status}' to 'cancelled'`,
        currentStatus: reminder.status,
      });
      return;
    }

    reminder.status = "cancelled";
    await reminder.save();

    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Cancel error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/reminders/:id — update reminder details
// ---------------------------------------------------------------------------

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params["id"], userId: req.userId });
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    const { clientName, phone, scheduledAt, notes } = req.body;

    if (scheduledAt !== undefined) {
      if (!scheduledAt || isNaN(new Date(scheduledAt).getTime())) {
        res.status(400).json({ message: "Invalid scheduled date/time for reminder" });
        return;
      }
      // Cannot reschedule a completed, dismissed, or cancelled reminder
      if (["completed", "dismissed", "cancelled"].includes(reminder.status)) {
        res.status(409).json({
          message: `Cannot reschedule a ${reminder.status} reminder`,
          currentStatus: reminder.status,
        });
        return;
      }
      reminder.scheduledAt = new Date(scheduledAt);
      reminder.status = "scheduled";
      reminder.snoozedUntil = undefined;
    }

    if (clientName !== undefined) {
      const trimmed = String(clientName).trim();
      if (!trimmed) {
        res.status(400).json({ message: "Client name cannot be empty" });
        return;
      }
      reminder.clientName = trimmed;
    }
    if (phone !== undefined) {
      reminder.phone = String(phone).trim();
    }
    if (notes !== undefined) {
      reminder.notes = String(notes).trim();
    }

    await reminder.save();

    // Synchronize linked task if applicable
    if (reminder.sourceType === "task" && reminder.sourceId) {
      const taskUpdate: Record<string, unknown> = {};
      if (clientName !== undefined) {
        taskUpdate["callReminder.clientName"] = reminder.clientName;
        taskUpdate["title"] = `📞 CALL: ${reminder.clientName}`;
      }
      if (phone !== undefined) taskUpdate["callReminder.phone"] = reminder.phone;
      if (notes !== undefined) taskUpdate["callReminder.notes"] = reminder.notes;
      if (scheduledAt !== undefined) {
        taskUpdate["callReminder.scheduledAt"] = reminder.scheduledAt;
        taskUpdate["deadline"] = reminder.scheduledAt;
        taskUpdate["callReminder.completed"] = false;
      }
      if (Object.keys(taskUpdate).length > 0) {
        await Task.findByIdAndUpdate(reminder.sourceId, { $set: taskUpdate });
      }
    }

    // Synchronize linked calendar event if applicable
    if (reminder.sourceType === "event" && reminder.sourceId) {
      const eventUpdate: Record<string, unknown> = {};
      if (clientName !== undefined) {
        eventUpdate["title"] = `📞 Call with ${reminder.clientName}`;
      }
      if (notes !== undefined) {
        eventUpdate["description"] = reminder.notes;
      }
      if (scheduledAt !== undefined) {
        eventUpdate["start"] = reminder.scheduledAt;
      }
      if (Object.keys(eventUpdate).length > 0) {
        await CalendarEvent.findByIdAndUpdate(reminder.sourceId, { $set: eventUpdate });
      }
    }

    // Synchronize sibling reminders for other assigned colleagues
    if (reminder.sourceId && (reminder.sourceType === "task" || reminder.sourceType === "event")) {
      const siblingUpdate: Record<string, unknown> = {};
      if (clientName !== undefined) siblingUpdate["clientName"] = reminder.clientName;
      if (phone !== undefined) siblingUpdate["phone"] = reminder.phone;
      if (notes !== undefined) siblingUpdate["notes"] = reminder.notes;
      if (scheduledAt !== undefined) {
        siblingUpdate["scheduledAt"] = reminder.scheduledAt;
        siblingUpdate["status"] = "scheduled";
        siblingUpdate["snoozedUntil"] = null;
      }
      if (Object.keys(siblingUpdate).length > 0) {
        await Reminder.updateMany(
          { sourceType: reminder.sourceType, sourceId: reminder.sourceId, _id: { $ne: reminder._id } },
          { $set: siblingUpdate }
        );
      }
    }

    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
