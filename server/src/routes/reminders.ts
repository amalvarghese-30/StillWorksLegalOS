import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { Reminder } from "../models/Reminder.js";
import { Task } from "../models/Task.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
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

export default router;
