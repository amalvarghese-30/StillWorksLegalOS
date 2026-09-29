import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { Reminder } from "../models/Reminder.js";
import { Task } from "../models/Task.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

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
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params["id"], userId: req.userId },
      { $set: { status: "acknowledged", acknowledgedAt: new Date() } },
      { new: true }
    );
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }
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
    const minutes = Number(req.body?.minutes) || 10;
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);

    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params["id"], userId: req.userId },
      { $set: { status: "snoozed", snoozedUntil } },
      { new: true }
    );
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }
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
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params["id"], userId: req.userId },
      { $set: { status: "completed", completedAt: new Date() } },
      { new: true }
    );
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    // Synchronize linked Task if this reminder was created from a Task
    if (reminder.sourceType === "task" && reminder.sourceId) {
      await Task.findByIdAndUpdate(reminder.sourceId, {
        $set: { "callReminder.completed": true },
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
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params["id"], userId: req.userId },
      { $set: { status: "dismissed" } },
      { new: true }
    );
    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }
    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Dismiss error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/reminders/:id — update reminder details
// ---------------------------------------------------------------------------

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { clientName, phone, scheduledAt, notes } = req.body;
    const updates: Record<string, unknown> = {};

    if (clientName !== undefined) {
      const trimmed = String(clientName).trim();
      if (!trimmed) {
        res.status(400).json({ message: "Client name cannot be empty" });
        return;
      }
      updates["clientName"] = trimmed;
    }
    if (phone !== undefined) {
      updates["phone"] = String(phone).trim();
    }
    if (notes !== undefined) {
      updates["notes"] = String(notes).trim();
    }
    if (scheduledAt !== undefined) {
      if (!scheduledAt || isNaN(new Date(scheduledAt).getTime())) {
        res.status(400).json({ message: "Invalid scheduled date/time for reminder" });
        return;
      }
      updates["scheduledAt"] = new Date(scheduledAt);
      updates["status"] = "scheduled";
    }

    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params["id"], userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!reminder) {
      res.status(404).json({ message: "Reminder not found" });
      return;
    }

    // Synchronize linked task if applicable
    if (reminder.sourceType === "task" && reminder.sourceId) {
      const taskUpdate: Record<string, unknown> = {};
      if (updates["clientName"]) {
        taskUpdate["callReminder.clientName"] = updates["clientName"];
        taskUpdate["title"] = `📞 CALL: ${updates["clientName"]}`;
      }
      if (updates["phone"] !== undefined) taskUpdate["callReminder.phone"] = updates["phone"];
      if (updates["notes"] !== undefined) taskUpdate["callReminder.notes"] = updates["notes"];
      if (updates["scheduledAt"]) {
        taskUpdate["callReminder.scheduledAt"] = updates["scheduledAt"];
        taskUpdate["deadline"] = updates["scheduledAt"];
        taskUpdate["callReminder.completed"] = false;
      }
      if (Object.keys(taskUpdate).length > 0) {
        await Task.findByIdAndUpdate(reminder.sourceId, { $set: taskUpdate });
      }
    }

    res.json({ reminder });
  } catch (err) {
    console.error("[reminders] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
