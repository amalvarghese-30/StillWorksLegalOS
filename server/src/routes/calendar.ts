import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { Reminder } from "../models/Reminder.js";
import { syncCallReminders, deleteCallReminders } from "../services/reminders.js";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth, requireAdminOrPermission } from "../middleware/auth.js";
import { canAccessCalendarEvent, requireResourceAccess, getAccessibleCaseIds } from "../middleware/authorization.js";

const router = Router();
router.use(requireAuth);
// All calendar operations require the calendar module permission.
// Admins bypass this check via requireAdminOrPermission.
router.use(requireAdminOrPermission("calendar"));

// ---------------------------------------------------------------------------
// GET /api/calendar/events — list by date range, employee filter
// Filters to user's accessible events
// ---------------------------------------------------------------------------

router.get("/events", async (req: Request, res: Response) => {
  try {
    const { start, end, employeeId, type, caseId } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    // Date range filter
    if (start) {
      filter["start"] = { $gte: new Date(start) };
    }
    if (end) {
      filter["start"] = { ...(filter["start"] as Record<string, unknown>), $lte: new Date(end) };
    }

    // If no range given, default to current month
    if (!start && !end) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      filter["start"] = { $gte: firstDay, $lte: lastDay };
    }

    // Employee filter - only admins can filter by other employees
    if (employeeId && employeeId !== "all") {
      if (req.user!.role === "admin") {
        filter["assignedTo"] = employeeId;
      } else {
        // Non-admins can only see their own events
        filter["assignedTo"] = req.userId;
      }
    } else if (req.user!.role !== "admin") {
      const { getAccessibleCaseIds } = await import("../middleware/authorization.js");
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);

      filter["$or"] = [
        { assignedTo: { $in: [req.userId] } },
        { createdBy: req.userId },
        { type: "hearing" },
        { type: "firm_event" },
        ...(accessibleCaseIds.length > 0 ? [{ caseId: { $in: accessibleCaseIds } }] : []),
      ];
    }

    if (caseId) {
      filter["caseId"] = caseId;
    }

    if (type && type !== "all") {
      filter["type"] = type;
    }

    // If caseId provided and user is non-admin without cases permission, verify case access
    if (caseId && req.user!.role !== "admin" && !req.user?.permissions?.cases) {
      const hasAccess = await getAccessibleCaseIds(req.userId!, req.user!.role);
      if (!hasAccess.includes(caseId)) {
        res.json({ events: [] });
        return;
      }
    }

    const events = await CalendarEvent.find(filter)
      .sort({ start: 1 })
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .populate("caseId", "title number")
      .lean();

    res.json({ events });
  } catch (err) {
    console.error("[calendar] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/calendar/events/:id (with authorization)
// ---------------------------------------------------------------------------

router.get("/events/:id", requireResourceAccess("calendarEvent"), async (req: Request, res: Response) => {
  try {
    const event = await CalendarEvent.findById(req.params["id"])
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .populate("caseId", "title number");
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.json({ event });
  } catch (err) {
    console.error("[calendar] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/calendar/events — create
// ---------------------------------------------------------------------------

router.post("/events", async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      type,
      start: startStr,
      end: endStr,
      allDay,
      caseId,
      clientId,
      assignedTo,
      color,
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ message: "Event title is required" });
      return;
    }
    if (!startStr) {
      res.status(400).json({ message: "Start date is required" });
      return;
    }
    const parsedStart = new Date(startStr);
    if (isNaN(parsedStart.getTime())) {
      res.status(400).json({ message: "Invalid start date format" });
      return;
    }
    let parsedEnd: Date | undefined = undefined;
    if (endStr) {
      parsedEnd = new Date(endStr);
      if (isNaN(parsedEnd.getTime())) {
        res.status(400).json({ message: "Invalid end date format" });
        return;
      }
    }

    // Validate case access if caseId provided
    if (caseId && req.user!.role !== "admin") {
      const { getAccessibleCaseIds } = await import("../middleware/authorization.js");
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
      if (!accessibleCaseIds.includes(caseId)) {
        res.status(403).json({ message: "Cannot create event for a case you don't have access to" });
        return;
      }
    }

    // Non-admins can only assign to themselves
    const finalAssignedTo = req.user!.role === "admin"
      ? (Array.isArray(assignedTo) ? assignedTo : [assignedTo].filter(Boolean))
      : [req.userId];

    const event = await CalendarEvent.create({
      title: title.trim(),
      description: description ?? "",
      type: type ?? "personal",
      start: parsedStart,
      end: parsedEnd,
      allDay: allDay ?? false,
      caseId: caseId ?? null,
      clientId: clientId ?? null,
      createdBy: req.userId,
      assignedTo: finalAssignedTo,
      color: color ?? "",
    });

    // Synchronize multi-user Reminder documents if event is a call_reminder
    if (event.type === "call_reminder") {
      const targetUserIds = event.assignedTo && event.assignedTo.length > 0 ? event.assignedTo : [event.createdBy || req.userId];
      try {
        await syncCallReminders({
          sourceType: "event",
          sourceId: event._id,
          userIds: targetUserIds,
          clientName: event.title.replace(/^📞\s*(CALL:\s*)?/i, "").trim() || event.title,
          phone: "",
          notes: event.description || "",
          scheduledAt: event.start,
          status: "scheduled",
        });
      } catch (remErr) {
        console.error("[calendar] Failed to create synchronized reminders:", remErr);
      }
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "calendar",
      resourceId: event._id.toString(),
      resourceName: event.title,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Notify assigned staff
    const io = req.app.get("io");
    if (finalAssignedTo && finalAssignedTo.length > 0) {
      const { NotificationService } = await import("../services/notifications.js");
      for (const staffId of finalAssignedTo) {
        if (staffId && staffId.toString() !== req.userId) {
          await NotificationService.createNotification({
            userId: staffId,
            type: "HEARING_REMINDER",
            title: event.type === "hearing" ? "⚖️ Hearing Scheduled" : "Event Scheduled",
            message: `${req.user?.name ?? "Admin"} scheduled ${event.title} on ${new Date(event.start).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
            relatedId: event._id,
            relatedModel: "CalendarEvent",
            actorId: new Types.ObjectId(req.userId),
          }, io);
        }
      }
    }

    res.status(201).json({ event });
  } catch (err: any) {
    console.error("[calendar] Create error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/calendar/events/:id — update (with authorization)
// ---------------------------------------------------------------------------

router.patch("/events/:id", requireResourceAccess("calendarEvent"), async (req: Request, res: Response) => {
  try {
    const updates: Record<string, unknown> = {};

    const allowed = ["title", "description", "type", "allDay", "caseId", "clientId", "assignedTo", "color"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body["start"]) {
      const parsedStart = new Date(req.body["start"]);
      if (isNaN(parsedStart.getTime())) {
        res.status(400).json({ message: "Invalid start date format" });
        return;
      }
      updates["start"] = parsedStart;
    }
    if (req.body["end"]) {
      const parsedEnd = new Date(req.body["end"]);
      if (isNaN(parsedEnd.getTime())) {
        res.status(400).json({ message: "Invalid end date format" });
        return;
      }
      updates["end"] = parsedEnd;
    }

    // Non-admins cannot reassign to others
    if (req.user!.role !== "admin" && updates["assignedTo"]) {
      const assigned = Array.isArray(updates["assignedTo"]) ? updates["assignedTo"] : [updates["assignedTo"]];
      if (!assigned.includes(req.userId)) {
        res.status(403).json({ message: "Cannot remove yourself from event assignments" });
        return;
      }
    }

    // Validate case access if caseId changed
    if (updates["caseId"] && req.user!.role !== "admin") {
      const { getAccessibleCaseIds } = await import("../middleware/authorization.js");
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
      if (!accessibleCaseIds.includes(updates["caseId"] as string)) {
        res.status(403).json({ message: "Cannot move event to a case you don't have access to" });
        return;
      }
    }

    const event = await CalendarEvent.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    });

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    // Synchronize multi-user Reminder documents if event is or was a call_reminder
    if (event.type === "call_reminder") {
      const targetUserIds = event.assignedTo && event.assignedTo.length > 0 ? event.assignedTo : [event.createdBy || req.userId];
      try {
        await syncCallReminders({
          sourceType: "event",
          sourceId: event._id,
          userIds: targetUserIds,
          clientName: event.title.replace(/^📞\s*(CALL:\s*)?/i, "").trim() || event.title,
          phone: "",
          notes: event.description || "",
          scheduledAt: event.start,
          status: "scheduled",
        });
      } catch (remErr) {
        console.error("[calendar] Failed to update synchronized reminders:", remErr);
      }
    } else if (updates["type"] !== undefined) {
      try {
        await deleteCallReminders("event", event._id);
      } catch (remErr) {
        console.error("[calendar] Failed to delete reminders when event type changed:", remErr);
      }
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "calendar",
      resourceId: event._id.toString(),
      resourceName: event.title,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ event });
  } catch (err) {
    console.error("[calendar] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/calendar/events/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/events/:id", requireResourceAccess("calendarEvent"), async (req: Request, res: Response) => {
  try {
    const event = await CalendarEvent.findByIdAndDelete(req.params["id"]);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    // Clean up associated reminders atomically
    try {
      await deleteCallReminders("event", event._id);
    } catch (remErr) {
      console.error("[calendar] Failed to delete synchronized reminders on event delete:", remErr);
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "delete",
      resource: "calendar",
      resourceId: event._id.toString(),
      resourceName: event.title,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("[calendar] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;