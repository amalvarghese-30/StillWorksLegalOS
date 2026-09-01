import { Router, type Request, type Response } from "express";
import { NotificationService } from "../services/notifications.js";
import { requireAuth } from "../middleware/auth.js";
import { Types } from "mongoose";

const router = Router();

// ---------------------------------------------------------------------------
// All notification routes below require authentication.
// ---------------------------------------------------------------------------

router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/notifications — get notifications for the current user
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = new Types.ObjectId(req.userId!);
    const {
      page = "1",
      limit = "20",
      unreadOnly = "false",
      types,
      startDate,
      endDate,
    } = req.query;

    const notifications = await NotificationService.getNotifications(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      unreadOnly: unreadOnly === "true",
      types: types ? (types as string).split(",") : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(notifications);
  } catch (err) {
    console.error("[notifications] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count — get unread notification count
// ---------------------------------------------------------------------------

router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const userId = new Types.ObjectId(req.userId!);
    const { notifications, total } = await NotificationService.getNotifications(
      userId,
      { unreadOnly: true, limit: 0 } // We only need the count
    );
    res.json({ unreadCount: total });
  } catch (err) {
    console.error("[notifications] Unread count error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/notifications/:id/read — mark a notification as read
// ---------------------------------------------------------------------------

router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const notificationId = new Types.ObjectId(req.params.id);
    const userId = new Types.ObjectId(req.userId!);

    const notification = await NotificationService.markAsRead(
      notificationId,
      userId
    );

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    res.json({ notification });
  } catch (err) {
    console.error("[notifications] Mark read error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/notifications/read-all — mark all notifications as read
// ---------------------------------------------------------------------------

router.patch("/read-all", async (req: Request, res: Response) => {
  try {
    const userId = new Types.ObjectId(req.userId!);
    const count = await NotificationService.markAllAsRead(userId);
    res.json({ message: `Marked ${count} notifications as read`, count });
  } catch (err) {
    console.error("[notifications] Mark all read error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/notifications/:id — delete a notification
// ---------------------------------------------------------------------------

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const notificationId = new Types.ObjectId(req.params.id);
    const userId = new Types.ObjectId(req.userId!);

    const deleted = await NotificationService.deleteNotification(
      notificationId,
      userId
    );

    if (!deleted) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error("[notifications] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;