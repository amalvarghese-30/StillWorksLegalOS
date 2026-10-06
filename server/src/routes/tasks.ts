import { Router, type Request, type Response } from "express";
import { Task } from "../models/Task.js";
import { Reminder } from "../models/Reminder.js";
import { syncCallReminders, deleteCallReminders } from "../services/reminders.js";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { AppSettings } from "../models/AppSettings.js";
import { NotificationService } from "../services/notifications.js";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCase, canAccessClient, canAccessTask, requireResourceAccess, getAccessibleCaseIds } from "../middleware/authorization.js";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveCaseId(identifier: unknown): Promise<{ id: string | null; error?: string }> {
  if (identifier === null || identifier === undefined) return { id: null };
  const clean = String(identifier).trim();
  if (!clean || clean.toLowerCase() === "none") return { id: null };

  if (/^[0-9a-fA-F]{24}$/.test(clean)) {
    const byId = await Case.findById(clean).select("_id").lean();
    if (byId) return { id: (byId as any)._id.toString() };
  }

  const escaped = escapeRegex(clean);
  const byOther = await Case.findOne({
    $or: [
      { number: clean },
      { courtCaseId: clean },
      { title: { $regex: `^${escaped}$`, $options: "i" } },
    ],
  }).select("_id").lean();

  if (byOther) return { id: (byOther as any)._id.toString() };

  return { id: null, error: `Case "${clean}" was not found. Please select a valid case.` };
}

async function resolveClientId(identifier: unknown): Promise<{ id: string | null; error?: string }> {
  if (identifier === null || identifier === undefined) return { id: null };
  const clean = String(identifier).trim();
  if (!clean || clean.toLowerCase() === "none") return { id: null };

  if (/^[0-9a-fA-F]{24}$/.test(clean)) {
    const byId = await Client.findById(clean).select("_id").lean();
    if (byId) return { id: (byId as any)._id.toString() };
  }

  const escaped = escapeRegex(clean);
  const byOther = await Client.findOne({
    $or: [
      { name: { $regex: `^${escaped}$`, $options: "i" } },
      { email: { $regex: `^${escaped}$`, $options: "i" } },
      { phone: clean },
    ],
  }).select("_id").lean();

  if (byOther) return { id: (byOther as any)._id.toString() };

  return { id: null, error: `Client "${clean}" was not found. Please select a valid client.` };
}

function sanitizeInputText(str: unknown, maxLen: number): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>?/gm, "")
    .trim()
    .slice(0, maxLen);
}

function validateTaskInput(data: {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
  agent?: unknown;
  checklist?: unknown;
  callReminder?: unknown;
}, isCreate = false): { valid: boolean; error?: string } {
  if (isCreate || data.title !== undefined) {
    if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
      return { valid: false, error: "Task title is required" };
    }
    if (data.title.trim().length > 200) {
      return { valid: false, error: "Task title cannot exceed 200 characters" };
    }
  }

  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== "string") {
      return { valid: false, error: "Task description must be a string" };
    }
    if (data.description.length > 5000) {
      return { valid: false, error: "Task description cannot exceed 5000 characters" };
    }
  }

  if (data.priority !== undefined && data.priority !== null) {
    if (!["High", "Medium", "Low"].includes(String(data.priority))) {
      return { valid: false, error: "Invalid priority level (must be High, Medium, or Low)" };
    }
  }

  if (data.status !== undefined && data.status !== null) {
    if (!["pending", "in_progress", "pending_approval", "completed", "overdue"].includes(String(data.status))) {
      return { valid: false, error: "Invalid status value" };
    }
  }

  if (data.agent !== undefined && data.agent !== null) {
    if (typeof data.agent !== "string") {
      return { valid: false, error: "Broker / Agent name must be a string" };
    }
    if (data.agent.trim().length > 100) {
      return { valid: false, error: "Broker / Agent name cannot exceed 100 characters" };
    }
  }

  if (data.checklist !== undefined && data.checklist !== null) {
    if (!Array.isArray(data.checklist)) {
      return { valid: false, error: "Checklist must be an array" };
    }
    if (data.checklist.length > 100) {
      return { valid: false, error: "Checklist cannot exceed 100 items" };
    }
    for (let i = 0; i < data.checklist.length; i++) {
      const item = data.checklist[i];
      if (!item || typeof item !== "object" || !item.text || typeof item.text !== "string" || !item.text.trim()) {
        return { valid: false, error: `Checklist item ${i + 1} description is required` };
      }
      if (item.text.trim().length > 500) {
        return { valid: false, error: `Checklist item ${i + 1} cannot exceed 500 characters` };
      }
    }
  }

  if (data.callReminder !== undefined && data.callReminder !== null && typeof data.callReminder === "object") {
    const cr = data.callReminder as Record<string, unknown>;
    const clientName = String(cr["clientName"] ?? "").trim();
    if (!clientName) {
      return { valid: false, error: "Client name is required for call reminder" };
    }
    if (clientName.length > 200) {
      return { valid: false, error: "Client name cannot exceed 200 characters" };
    }
    if (cr["phone"] && String(cr["phone"]).trim().length > 50) {
      return { valid: false, error: "Phone number cannot exceed 50 characters" };
    }
    if (cr["notes"] && String(cr["notes"]).trim().length > 2000) {
      return { valid: false, error: "Notes cannot exceed 2000 characters" };
    }
    if (!cr["scheduledAt"] || isNaN(new Date(cr["scheduledAt"] as string).getTime())) {
      return { valid: false, error: "Please select a date and time for the reminder." };
    }
  }

  return { valid: true };
}

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/tasks — list with filter, search, pagination
// Filters to user's accessible tasks
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      priority,
      category,
      assignedTo,
      caseId,
      clientId,
      agent,
      dueFrom,
      dueTo,
      overdue,
      dueToday,
      isCall,
      hasCallReminder,
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    if (status && status !== "all") {
      if (status.includes(",")) {
        filter["status"] = { $in: status.split(",").map((s) => s.trim()) };
      } else {
        filter["status"] = status;
      }
    }
    if (priority && priority !== "all") {
      if (priority.includes(",")) {
        filter["priority"] = { $in: priority.split(",").map((p) => p.trim()) };
      } else {
        filter["priority"] = priority;
      }
    }
    if (category && category !== "all") filter["category"] = category;
    if (caseId) filter["caseId"] = caseId;
    if (clientId) filter["clientId"] = clientId;
    if (agent && agent !== "all") {
      filter["agent"] = agent;
    }

    if (assignedTo && assignedTo !== "all") {
      if (assignedTo.includes(",")) {
        filter["assignedTo"] = { $in: assignedTo.split(",").map((id) => id.trim()) };
      } else {
        filter["assignedTo"] = assignedTo;
      }
    }

    if (isCall === "true" || hasCallReminder === "true") {
      filter["$or"] = [{ isCall: true }, { "callReminder.scheduledAt": { $exists: true, $ne: null } }];
    }

    const andConditions: Record<string, unknown>[] = [];

    // Date range filters on deadline
    if (dueFrom || dueTo) {
      const deadlineCond: Record<string, unknown> = {};
      if (dueFrom) deadlineCond["$gte"] = new Date(dueFrom);
      if (dueTo) deadlineCond["$lte"] = new Date(dueTo);
      andConditions.push({ deadline: deadlineCond });
    }

    if (overdue === "true") {
      andConditions.push({
        deadline: { $lt: new Date() },
        status: { $ne: "completed" },
      });
    }

    if (dueToday === "true") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      andConditions.push({
        deadline: { $gte: startOfDay, $lte: endOfDay },
      });
    }

    // Non-admins only see their tasks
    if (req.user!.role !== "admin") {
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
      andConditions.push({
        $or: [
          { assignedTo: req.userId },
          { createdBy: req.userId },
          ...(accessibleCaseIds.length > 0 ? [{ caseId: { $in: accessibleCaseIds } }] : []),
        ],
      });
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andConditions.push({
        $or: [{ title: regex }, { description: regex }, { agent: regex }],
      });
    }

    if (andConditions.length > 0) {
      filter["$and"] = andConditions;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const baseAccessibleTaskFilter: Record<string, unknown> = {};
    if (req.user!.role !== "admin") {
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
      baseAccessibleTaskFilter["$or"] = [
        { assignedTo: req.userId },
        { createdBy: req.userId },
        ...(accessibleCaseIds.length > 0 ? [{ caseId: { $in: accessibleCaseIds } }] : []),
      ];
    }

    const [tasks, total, allAccessible] = await Promise.all([
      Task.find(filter)
        .sort({ deadline: 1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("assignedTo", "name email")
        .populate("caseId", "title number")
        .populate("clientId", "name")
        .lean(),
      Task.countDocuments(filter),
      Task.find(baseAccessibleTaskFilter, { status: 1, deadline: 1, isCall: 1, callReminder: 1 }).lean(),
    ]);

    const stats = {
      total: allAccessible.length,
      overdue: 0,
      dueToday: 0,
      inProgress: 0,
      inReview: 0,
      completed: 0,
      calls: 0,
    };

    for (const t of allAccessible) {
      if (t.status === "completed") {
        stats.completed++;
      } else {
        if (t.status === "pending_approval") stats.inReview++;
        else stats.inProgress++;

        if (t.deadline) {
          const d = new Date(t.deadline);
          if (d < now) stats.overdue++;
          else if (d >= startOfToday && d <= endOfToday) stats.dueToday++;
        }
      }
      if (t.isCall || (t as any).callReminder?.scheduledAt) {
        stats.calls++;
      }
    }

    res.json({
      tasks,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      stats,
    });
  } catch (err) {
    console.error("[tasks] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tasks/options — workflow options (categories, checklist templates,
// agents) plus assignable staff. Options are admin-managed via
// Admin → Settings → Task options; staff is drawn from the User collection.
// Registered before /:id so "options" isn't treated as a task id.
// ---------------------------------------------------------------------------

router.get("/options", async (_req: Request, res: Response) => {
  try {
    const [options, staff] = await Promise.all([
      AppSettings.getTaskOptions(),
      User.find({}).select("name").sort({ name: 1 }).lean(),
    ]);

    res.json({
      categories: options.categories,
      checklistTemplates: options.checklistTemplates,
      agents: options.agents,
      staff: staff.map((u) => ({ _id: (u as any)._id.toString(), name: u.name })),
    });
  } catch (err) {
    console.error("[tasks] Options error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id (with authorization)
// ---------------------------------------------------------------------------

router.get("/:id", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params["id"])
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }
    res.json({ task });
  } catch (err) {
    console.error("[tasks] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks — create
// ---------------------------------------------------------------------------

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      deadline,
      assignedTo,
      caseId,
      clientId,
      checklist,
      callReminder,
      agent,
      isCall,
    } = req.body;

    const taskValidation = validateTaskInput(req.body, true);
    if (!taskValidation.valid) {
      res.status(400).json({ message: taskValidation.error });
      return;
    }

    const caseResolution = await resolveCaseId(caseId);
    if (caseResolution.error) {
      res.status(400).json({ message: caseResolution.error });
      return;
    }
    const cleanCaseId = caseResolution.id;

    const clientResolution = await resolveClientId(clientId);
    if (clientResolution.error) {
      res.status(400).json({ message: clientResolution.error });
      return;
    }
    const cleanClientId = clientResolution.id;

    // Validate case access if caseId provided
    if (cleanCaseId && req.user!.role !== "admin") {
      const hasAccess = await canAccessCase(req.userId!, req.user!.role, cleanCaseId, req.user?.permissions);
      if (!hasAccess) {
        res.status(403).json({ message: "Cannot create task for a case you don't have access to" });
        return;
      }
    }

    // Validate client access if clientId provided
    if (cleanClientId && req.user!.role !== "admin") {
      const hasClientAccess = await canAccessClient(req.userId!, req.user!.role, cleanClientId, req.user?.permissions);
      if (!hasClientAccess) {
        res.status(403).json({ message: "Cannot create task for a client you don't have access to" });
        return;
      }
    }

    // Validate deadline format if provided
    let parsedDeadline: Date | null = null;
    if (deadline) {
      parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        res.status(400).json({ message: "Invalid deadline date format" });
        return;
      }
    }

    // Validate callReminder fields if provided
    let parsedCallReminder: { clientName: string; phone: string; scheduledAt: Date; notes: string; completed: boolean } | undefined = undefined;
    if (callReminder && typeof callReminder === "object") {
      const clientName = String(callReminder.clientName ?? "").trim();
      if (clientName) {
        if (!callReminder.scheduledAt || isNaN(new Date(callReminder.scheduledAt).getTime())) {
          res.status(400).json({ message: "Please select a date and time for the reminder." });
          return;
        }
        parsedCallReminder = {
          clientName: sanitizeInputText(clientName, 200),
          phone: sanitizeInputText(callReminder.phone, 50),
          scheduledAt: new Date(callReminder.scheduledAt),
          notes: sanitizeInputText(callReminder.notes, 2000),
          completed: Boolean(callReminder.completed ?? false),
        };
      }
    }

    // Non-admins can only assign to themselves
    const finalAssignedTo = req.user!.role === "admin" ? (assignedTo ?? null) : req.userId;
    const cleanAgent = sanitizeInputText(agent, 100);

    const task = await Task.create({
      title: title.trim(),
      description: description ?? "",
      category: category ?? "Other Work",
      priority: priority ?? "Medium",
      status: "pending",
      deadline: parsedDeadline,
      assignedTo: finalAssignedTo,
      caseId: cleanCaseId,
      clientId: cleanClientId,
      checklist: Array.isArray(checklist)
        ? checklist.map((item) => ({
            id: item.id || (item._id ? String(item._id) : undefined),
            text: sanitizeInputText(item.text, 500),
            done: Boolean(item.done),
            subItems: Array.isArray(item.subItems)
              ? item.subItems.map((sub: any) => ({
                  id: sub.id || (sub._id ? String(sub._id) : undefined),
                  text: sanitizeInputText(sub.text, 500),
                  done: Boolean(sub.done),
                }))
              : [],
          }))
        : [],
      localPath: typeof req.body.localPath === "string" ? req.body.localPath.trim() : "",
      assignedBy: finalAssignedTo ? req.userId : null,
      assignedAt: finalAssignedTo ? new Date() : null,
      callReminder: parsedCallReminder,
      agent: cleanAgent,
      isCall: Boolean(isCall),
      createdBy: req.userId,
    });

    // Notify assignee if task is assigned to someone else
    if (finalAssignedTo && finalAssignedTo.toString() !== req.userId) {
      const isUrgent = task.priority === "High";
      await NotificationService.createNotification({
        userId: finalAssignedTo,
        type: "TASK_ASSIGNED",
        title: isUrgent ? "🚨 Urgent Task Assigned" : "New Task Assigned",
        message: `${req.user?.name ?? "Admin"} assigned you ${isUrgent ? "an urgent" : "a"} task: "${task.title}"`,
        relatedId: task._id,
        relatedModel: "Task",
        actorId: new Types.ObjectId(req.userId),
        metadata: {
          taskTitle: task.title,
          taskId: task._id.toString(),
          priority: task.priority,
        },
      }, req.app.get("io")); // Pass the Socket.IO instance for real-time emission
    }

    // Audit log
    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Create synchronized Reminder documents if callReminder is present
    if (task.callReminder && task.callReminder.clientName) {
      const taskUserIds = (Array.isArray(assignedTo) ? assignedTo : [finalAssignedTo || task.createdBy || req.userId]).filter(Boolean);
      try {
        await syncCallReminders({
          sourceType: "task",
          sourceId: task._id,
          userIds: taskUserIds,
          clientName: task.callReminder.clientName,
          phone: task.callReminder.phone || "",
          notes: task.callReminder.notes || "",
          scheduledAt: task.callReminder.scheduledAt,
          status: task.callReminder.completed ? "completed" : "scheduled",
        });
      } catch (remErr) {
        console.error("[tasks] Failed to create synchronized reminders:", remErr);
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("task:created", {
        task,
        assignedTo: task.assignedTo ? task.assignedTo.toString() : null,
        createdBy: task.createdBy ? task.createdBy.toString() : null,
      });
    }

    res.status(201).json({ task });
  } catch (err: any) {
    console.error("[tasks] Create error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id — partial update (with authorization)
// ---------------------------------------------------------------------------

router.patch("/:id", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const taskValidation = validateTaskInput(req.body, false);
    if (!taskValidation.valid) {
      res.status(400).json({ message: taskValidation.error });
      return;
    }

    const updates: Record<string, unknown> = {};

    const allowed = ["title", "description", "category", "priority", "status", "deadline", "assignedTo", "caseId", "clientId", "agent", "isCall", "checklist", "localPath"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates["title"] !== undefined) {
      updates["title"] = String(updates["title"]).trim();
    }
    if (updates["agent"] !== undefined) {
      updates["agent"] = sanitizeInputText(updates["agent"], 100);
    }
    if (updates["localPath"] !== undefined) {
      updates["localPath"] = typeof updates["localPath"] === "string" ? updates["localPath"].trim() : "";
    }
    if (updates["checklist"] !== undefined) {
      if (Array.isArray(updates["checklist"])) {
        updates["checklist"] = (updates["checklist"] as any[]).map((item) => ({
          id: item.id || (item._id ? String(item._id) : undefined),
          text: sanitizeInputText(item.text, 500),
          done: Boolean(item.done),
          subItems: Array.isArray(item.subItems)
            ? item.subItems.map((sub: any) => ({
                id: sub.id || (sub._id ? String(sub._id) : undefined),
                text: sanitizeInputText(sub.text, 500),
                done: Boolean(sub.done),
              }))
            : [],
        }));
      }
    }

    if (req.body["deadline"] !== undefined) {
      if (req.body["deadline"] === null || req.body["deadline"] === "") {
        updates["deadline"] = null;
      } else {
        const d = new Date(req.body["deadline"]);
        if (isNaN(d.getTime())) {
          res.status(400).json({ message: "Invalid deadline date format" });
          return;
        }
        updates["deadline"] = d;
      }
    }

    if (req.body["callReminder"] !== undefined) {
      if (req.body["callReminder"] === null || req.body["callReminder"] === false) {
        updates["callReminder"] = undefined;
      } else if (typeof req.body["callReminder"] === "object") {
        const cr = req.body["callReminder"] as Record<string, unknown>;
        const clientName = String(cr["clientName"] ?? "").trim();
        if (!clientName) {
          res.status(400).json({ message: "Client name is required for call reminder" });
          return;
        }
        if (cr["scheduledAt"] === undefined || cr["scheduledAt"] === null || cr["scheduledAt"] === "") {
          res.status(400).json({ message: "Please select a date and time for the reminder." });
          return;
        }
        const schedDate = new Date(cr["scheduledAt"] as string);
        if (isNaN(schedDate.getTime())) {
          res.status(400).json({ message: "Invalid scheduled date/time for call reminder" });
          return;
        }
        updates["callReminder"] = {
          clientName: sanitizeInputText(clientName, 200),
          phone: sanitizeInputText(cr["phone"], 50),
          scheduledAt: schedDate,
          notes: sanitizeInputText(cr["notes"], 2000),
          completed: Boolean(cr["completed"]),
        };
      }
    }

    if (updates["caseId"] !== undefined) {
      const resolved = await resolveCaseId(updates["caseId"]);
      if (resolved.error) {
        res.status(400).json({ message: resolved.error });
        return;
      }
      updates["caseId"] = resolved.id;
    }
    if (updates["clientId"] !== undefined) {
      const resolved = await resolveClientId(updates["clientId"]);
      if (resolved.error) {
        res.status(400).json({ message: resolved.error });
        return;
      }
      updates["clientId"] = resolved.id;
    }

    // Non-admins cannot reassign to others
    if (req.user!.role !== "admin" && updates["assignedTo"] && updates["assignedTo"] !== req.userId) {
      res.status(403).json({ message: "Cannot assign task to another user" });
      return;
    }

    // Validate case access if caseId changed
    if (updates["caseId"] && req.user!.role !== "admin") {
      const hasAccess = await canAccessCase(req.userId!, req.user!.role, updates["caseId"] as string, req.user?.permissions);
      if (!hasAccess) {
        res.status(403).json({ message: "Cannot move task to a case you don't have access to" });
        return;
      }
    }

    // Validate client access if clientId changed
    if (updates["clientId"] && req.user!.role !== "admin") {
      const hasClientAccess = await canAccessClient(req.userId!, req.user!.role, updates["clientId"] as string, req.user?.permissions);
      if (!hasClientAccess) {
        res.status(403).json({ message: "Cannot link task to a client you don't have access to" });
        return;
      }
    }

    // Fetch the original task to detect changes
    const originalTask = await Task.findById(req.params["id"]);
    if (!originalTask) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    // Check if checklist auto-completion should trigger
    if (updates["checklist"] !== undefined && updates["status"] === undefined) {
      const chk = updates["checklist"] as any[];
      if (chk.length > 0) {
        const allDone = chk.every((ci) => {
          if (!ci.done) return false;
          if (Array.isArray(ci.subItems) && ci.subItems.length > 0) {
            return ci.subItems.every((sub: any) => sub.done);
          }
          return true;
        });
        if (allDone && originalTask.status !== "completed" && originalTask.status !== "pending_approval") {
          updates["status"] = req.user!.role === "admin" ? "completed" : "pending_approval";
        }
      }
    }

    // Non-admins attempting to mark task completed submit it for admin approval
    if (updates["status"] !== undefined) {
      if (req.user!.role !== "admin" && updates["status"] === "completed") {
        updates["status"] = "pending_approval";
      }
    }

    // Manage explicit workflow timestamps
    const now = new Date();
    if (updates["status"] !== undefined && updates["status"] !== originalTask.status) {
      if (updates["status"] === "in_progress") {
        updates["startedAt"] = now;
      } else if (updates["status"] === "pending_approval") {
        updates["completedAt"] = now;
        updates["submittedForApprovalAt"] = now;
      } else if (updates["status"] === "completed") {
        updates["completedAt"] = now;
        if (req.user!.role === "admin") {
          updates["approvedAt"] = now;
        }
      }
    }

    // Track assignment change in history
    if (updates["assignedTo"] !== undefined && String(updates["assignedTo"] ?? "") !== String(originalTask.assignedTo ?? "")) {
      updates["assignedBy"] = req.userId;
      updates["assignedAt"] = updates["assignedTo"] ? now : null;
      if (updates["assignedTo"]) {
        const histEntry = {
          fromUser: originalTask.assignedTo || null,
          toUser: updates["assignedTo"],
          assignedBy: req.userId,
          action: "assigned",
          note: "Task assignment updated",
          timestamp: now,
        };
        if (!updates["$push"]) updates["$push"] = {};
        (updates["$push"] as any)["assignmentHistory"] = histEntry;
      }
    }

    // Synchronize callReminder completed state with task status if relevant
    if (updates["callReminder"]) {
      const cr = updates["callReminder"] as { completed?: boolean };
      if (cr.completed && updates["status"] === undefined) {
        updates["status"] = req.user!.role === "admin" ? "completed" : "pending_approval";
      }
    } else if (updates["status"] === "completed" && originalTask?.callReminder) {
      updates["callReminder"] = {
        clientName: originalTask.callReminder.clientName,
        phone: originalTask.callReminder.phone,
        scheduledAt: originalTask.callReminder.scheduledAt,
        notes: originalTask.callReminder.notes,
        completed: true,
      };
    }

    let task;
    if (
      req.user!.role === "admin" &&
      originalTask?.status === "pending_approval" &&
      (updates["status"] === "completed" || updates["status"] === "in_progress")
    ) {
      task = await Task.findOneAndUpdate(
        { _id: req.params["id"], status: "pending_approval" },
        { $set: updates },
        { new: true, runValidators: true }
      )
        .populate("assignedTo", "name email title")
        .populate("assignedBy", "name email title")
        .populate("createdBy", "name email title")
        .populate("caseId", "title number")
        .populate("clientId", "name phone")
        .populate("assignmentHistory.fromUser", "name email")
        .populate("assignmentHistory.toUser", "name email")
        .populate("assignmentHistory.assignedBy", "name email");

      if (!task) {
        const existing = await Task.findById(req.params["id"])
          .populate("assignedTo", "name email title")
          .populate("assignedBy", "name email title")
          .populate("createdBy", "name email title")
          .populate("caseId", "title number")
          .populate("clientId", "name phone")
          .populate("assignmentHistory.fromUser", "name email")
          .populate("assignmentHistory.toUser", "name email")
          .populate("assignmentHistory.assignedBy", "name email");
        if (existing) {
          res.json({ task: existing, code: "ALREADY_PROCESSED", message: "This task has already been reviewed." });
          return;
        }
        res.status(404).json({ message: "Task not found" });
        return;
      }
    } else {
      task = await Task.findByIdAndUpdate(req.params["id"], updates, {
        new: true,
        runValidators: true,
      })
        .populate("assignedTo", "name email title")
        .populate("assignedBy", "name email title")
        .populate("createdBy", "name email title")
        .populate("caseId", "title number")
        .populate("clientId", "name phone")
        .populate("assignmentHistory.fromUser", "name email")
        .populate("assignmentHistory.toUser", "name email")
        .populate("assignmentHistory.assignedBy", "name email");

      if (!task) {
        res.status(404).json({ message: "Task not found" });
        return;
      }
    }

    // Synchronize Reminder documents if task has callReminder or status/assignee changed
    if (task) {
      if (req.body["callReminder"] === null || req.body["callReminder"] === false) {
        try {
          await deleteCallReminders("task", task._id);
        } catch (remErr) {
          console.error("[tasks] Failed to remove synchronized reminder:", remErr);
        }
      } else if (
        updates["callReminder"] !== undefined ||
        updates["status"] !== undefined ||
        updates["assignedTo"] !== undefined ||
        task.callReminder?.clientName
      ) {
        if (task.callReminder?.clientName) {
          const isDone = task.status === "completed" || Boolean(task.callReminder?.completed);
          const rawAssignee = (task.assignedTo as any)?._id || task.assignedTo || task.createdBy || req.userId;
          const assignedList = (Array.isArray(rawAssignee) ? rawAssignee : [rawAssignee]).filter(Boolean);
          try {
            await syncCallReminders({
              sourceType: "task",
              sourceId: task._id,
              userIds: assignedList,
              clientName: task.callReminder.clientName,
              phone: task.callReminder.phone || "",
              notes: task.callReminder.notes || "",
              scheduledAt: task.callReminder.scheduledAt,
              status: isDone ? "completed" : "scheduled",
            });
          } catch (remErr) {
            console.error("[tasks] Failed to synchronize reminder on update:", remErr);
          }
        }
      }
    }

    // Notify assignee if task was assigned or reassigned to another user
    const newAssignedTo = updates["assignedTo"] ? String(updates["assignedTo"]) : null;
    const oldAssignedTo = originalTask?.assignedTo ? originalTask.assignedTo.toString() : null;
    if (
      updates["assignedTo"] !== undefined &&
      newAssignedTo &&
      newAssignedTo !== oldAssignedTo &&
      newAssignedTo !== req.userId
    ) {
      const isUrgent = task.priority === "High";
      await NotificationService.createNotification({
        userId: new Types.ObjectId(newAssignedTo),
        type: "TASK_ASSIGNED",
        title: isUrgent ? "🚨 Urgent Task Assigned" : "Task Assigned",
        message: `${req.user?.name ?? "Admin"} assigned you task: "${task.title}"`,
        relatedId: task._id,
        relatedModel: "Task",
        actorId: new Types.ObjectId(req.userId),
        metadata: {
          taskTitle: task.title,
          taskId: task._id.toString(),
          priority: task.priority,
          action: "assigned",
        },
      }, req.app.get("io"));
    }

    // Notify admins if task status changed to pending_approval
    if (
      updates["status"] === "pending_approval" &&
      originalTask &&
      originalTask.status !== "pending_approval"
    ) {
      const admins = await User.find({ role: "admin" }).select("_id");
      for (const admin of admins) {
        if (admin._id.toString() !== req.userId) {
          await NotificationService.createNotification({
            userId: admin._id as Types.ObjectId,
            type: "APPROVAL_REQUEST",
            title: "Task Completion Approval",
            message: `${req.user?.name ?? "Employee"} submitted task "${task.title}" for verification.`,
            relatedId: task._id,
            relatedModel: "Task",
            actorId: new Types.ObjectId(req.userId),
            metadata: {
              taskTitle: task.title,
              taskId: task._id.toString(),
              action: "pending_approval",
            },
          }, req.app.get("io"));
        }
      }
    }

    // Notify assignee if task status changed to completed
    if (
      updates["status"] !== undefined &&
      originalTask &&
      originalTask.status !== updates["status"] &&
      updates["status"] === "completed"
    ) {
      const isApproval = originalTask.status === "pending_approval";
      // Notify the assignee (if any) and the creator
      const notifyUserIds = new Set<string>();
      const assignedId = (task.assignedTo as any)?._id?.toString?.() ?? task.assignedTo?.toString();
      if (assignedId && assignedId !== "[object Object]") notifyUserIds.add(assignedId);

      const createdId = (task.createdBy as any)?._id?.toString?.() ?? task.createdBy?.toString();
      if (createdId && createdId !== "[object Object]") notifyUserIds.add(createdId);

      for (const userId of notifyUserIds) {
        if (userId && userId !== req.userId) { // Don't notify the user who made the change
          await NotificationService.createNotification({
            userId: new Types.ObjectId(userId),
            type: "TASK_ASSIGNED",
            title: isApproval ? "Task Completion Approved" : "Task Completed",
            message: isApproval
              ? `${req.user?.name ?? "Admin"} approved and verified completion of task: "${task.title}".`
              : `The task "${task.title}" has been marked as completed.`,
            relatedId: task._id,
            relatedModel: "Task",
            actorId: new Types.ObjectId(req.userId),
            metadata: {
              taskTitle: task.title,
              taskId: task._id.toString(),
              action: "completed",
            },
          }, req.app.get("io"));
        }
      }
    }

    // Notify assignee if admin requested changes (moved from pending_approval back to in_progress/pending)
    if (
      originalTask &&
      originalTask.status === "pending_approval" &&
      updates["status"] !== undefined &&
      updates["status"] !== "completed" &&
      updates["status"] !== "pending_approval"
    ) {
      const assigneeTargetId = (task.assignedTo as any)?._id?.toString?.() ?? task.assignedTo?.toString();
      if (assigneeTargetId && assigneeTargetId !== req.userId && assigneeTargetId !== "[object Object]") {
        await NotificationService.createNotification({
          userId: new Types.ObjectId(assigneeTargetId),
          type: "TASK_ASSIGNED",
          title: "Task Changes Requested",
          message: `${req.user?.name ?? "Admin"} reviewed task "${task.title}" and requested changes.`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId),
          metadata: {
            taskTitle: task.title,
            taskId: task._id.toString(),
            action: "changes_requested",
          },
        }, req.app.get("io"));
      }
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", {
        task,
        assignedTo: (task.assignedTo as any)?._id?.toString?.() ?? (task.assignedTo ? task.assignedTo.toString() : null),
        createdBy: (task.createdBy as any)?._id?.toString?.() ?? (task.createdBy ? task.createdBy.toString() : null),
      });
    }

    res.json({ task });
  } catch (err) {
    console.error("[tasks] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:taskId/checklist — add checklist item
// ---------------------------------------------------------------------------

router.post("/:taskId/checklist", requireResourceAccess("task", "taskId"), async (req: Request, res: Response) => {
  try {
    const { text, subItems } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ message: "Checklist item text is required" });
      return;
    }

    const task = await Task.findById(req.params["taskId"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const parsedSubItems = Array.isArray(subItems)
      ? subItems.map((s: any) => ({
          text: sanitizeInputText(s.text, 500),
          done: Boolean(s.done),
        }))
      : [];

    task.checklist.push({
      text: sanitizeInputText(text, 500),
      done: false,
      subItems: parsedSubItems,
    });

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    res.status(201).json({ task: populated });
  } catch (err: any) {
    console.error("[tasks] Add checklist item error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:taskId/checklist/:itemId — delete checklist item
// ---------------------------------------------------------------------------

router.delete("/:taskId/checklist/:itemId", requireResourceAccess("task", "taskId"), async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params["taskId"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    task.checklist = task.checklist.filter(
      (c) => (c as any)._id?.toString() !== req.params["itemId"] && c.id !== req.params["itemId"]
    );

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    res.json({ task: populated });
  } catch (err: any) {
    console.error("[tasks] Delete checklist item error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:taskId/checklist/:itemId — toggle/edit checklist item & subitems
// ---------------------------------------------------------------------------

router.patch("/:taskId/checklist/:itemId", requireResourceAccess("task", "taskId"), async (req: Request, res: Response) => {
  try {
    const { done, text, subItems, subItemId, subDone, subText } = req.body;
    const task = await Task.findById(req.params["taskId"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const item = task.checklist.find(
      (c) => (c as any)._id?.toString() === req.params["itemId"] || c.id === req.params["itemId"],
    );
    if (!item) {
      res.status(404).json({ message: "Checklist item not found" });
      return;
    }

    if (done !== undefined) {
      item.done = Boolean(done);
      // If item marked done, optionally mark all sub-items done too
      if (item.done && Array.isArray(item.subItems)) {
        for (const sub of item.subItems) {
          sub.done = true;
        }
      }
    }
    if (text !== undefined && typeof text === "string" && text.trim()) {
      item.text = sanitizeInputText(text, 500);
    }
    if (Array.isArray(subItems)) {
      item.subItems = subItems.map((s: any) => ({
        id: s.id || (s._id ? String(s._id) : undefined),
        text: sanitizeInputText(s.text, 500),
        done: Boolean(s.done),
      }));
    }

    // Direct sub-item update inside item payload if provided
    if (subItemId && Array.isArray(item.subItems)) {
      const sub = item.subItems.find((s) => (s as any)._id?.toString() === subItemId || s.id === subItemId);
      if (sub) {
        if (subDone !== undefined) sub.done = Boolean(subDone);
        if (subText !== undefined && typeof subText === "string" && subText.trim()) {
          sub.text = sanitizeInputText(subText, 500);
        }
      }
    }

    // Auto-update parent item done if all subitems are done
    if (Array.isArray(item.subItems) && item.subItems.length > 0) {
      const allSubsDone = item.subItems.every((s) => s.done);
      if (allSubsDone && !item.done) {
        item.done = true;
      }
    }

    // Automatic task completion evaluation
    const isAllDone = task.checklist.length > 0 && task.checklist.every((ci) => {
      if (!ci.done) return false;
      if (Array.isArray(ci.subItems) && ci.subItems.length > 0) {
        return ci.subItems.every((sub) => sub.done);
      }
      return true;
    });

    const now = new Date();
    if (isAllDone && task.status !== "completed" && task.status !== "pending_approval") {
      if (req.user?.role === "admin") {
        task.status = "completed";
        task.completedAt = now;
        task.approvedAt = now;
      } else {
        task.status = "pending_approval";
        task.completedAt = now;
        task.submittedForApprovalAt = now;

        const admins = await User.find({ role: "admin" }).select("_id");
        for (const admin of admins) {
          if (admin._id.toString() !== req.userId) {
            await NotificationService.createNotification(
              {
                userId: admin._id as Types.ObjectId,
                type: "TASK_APPROVAL_REQUIRED",
                title: "Task Completion Approval Required",
                message: `${req.user?.name ?? "Employee"} completed all checklist items for "${task.title}". Approval required.`,
                relatedId: task._id as any,
                relatedModel: "Task",
                actorId: new Types.ObjectId(req.userId),
                metadata: {
                  taskTitle: task.title,
                  taskId: task._id.toString(),
                  action: "pending_approval",
                },
              },
              req.app.get("io")
            );
          }
        }
      }
    } else if (!isAllDone && (task.status === "completed" || task.status === "pending_approval")) {
      task.status = "in_progress";
      task.completedAt = null;
      task.submittedForApprovalAt = null;
      task.approvedAt = null;
    }

    await task.save();

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: text !== undefined ? `Checklist item edited: "${item.text}"` : `Checklist item ${done ? "completed" : "uncompleted"}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", {
        task: populated,
        assignedTo: task.assignedTo ? task.assignedTo.toString() : null,
        createdBy: task.createdBy ? task.createdBy.toString() : null,
      });
    }

    res.json({ task: populated });
  } catch (err) {
    console.error("[tasks] Checklist toggle error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:taskId/checklist/:itemId/subitems — add sub-item
// ---------------------------------------------------------------------------

router.post("/:taskId/checklist/:itemId/subitems", requireResourceAccess("task", "taskId"), async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ message: "Sub-item text is required" });
      return;
    }

    const task = await Task.findById(req.params["taskId"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const item = task.checklist.find(
      (c) => (c as any)._id?.toString() === req.params["itemId"] || c.id === req.params["itemId"]
    );
    if (!item) {
      res.status(404).json({ message: "Checklist item not found" });
      return;
    }

    if (!Array.isArray(item.subItems)) {
      item.subItems = [];
    }

    item.subItems.push({
      text: sanitizeInputText(text, 500),
      done: false,
    });

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    res.status(201).json({ task: populated });
  } catch (err: any) {
    console.error("[tasks] Add sub-item error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:taskId/checklist/:itemId/subitems/:subId — delete sub-item
// ---------------------------------------------------------------------------

router.delete("/:taskId/checklist/:itemId/subitems/:subId", requireResourceAccess("task", "taskId"), async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params["taskId"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const item = task.checklist.find(
      (c) => (c as any)._id?.toString() === req.params["itemId"] || c.id === req.params["itemId"]
    );
    if (!item) {
      res.status(404).json({ message: "Checklist item not found" });
      return;
    }

    if (Array.isArray(item.subItems)) {
      item.subItems = item.subItems.filter(
        (s) => (s as any)._id?.toString() !== req.params["subId"] && s.id !== req.params["subId"]
      );
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    res.json({ task: populated });
  } catch (err: any) {
    console.error("[tasks] Delete sub-item error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/approve — admin approves task completion
// ---------------------------------------------------------------------------

router.post("/:id/approve", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== "admin" && !req.user?.permissions?.tasks) {
      res.status(403).json({ message: "Only administrators can approve tasks" });
      return;
    }

    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const now = new Date();
    task.status = "completed";
    if (!task.completedAt) task.completedAt = now;
    task.approvedAt = now;
    task.rejectedAt = null;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    // Notify assignee
    const assigneeId = (task.assignedTo as any)?._id?.toString() ?? task.assignedTo?.toString();
    if (assigneeId && assigneeId !== req.userId) {
      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(assigneeId),
          type: "TASK_APPROVED",
          title: "Task Approved & Verified",
          message: `${req.user?.name ?? "Administrator"} approved completion of task "${task.title}".`,
          relatedId: task._id as any,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            action: "approved",
          },
        },
        io
      );
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: "Task completion approved by admin",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Task approved successfully", task: populated });
  } catch (err: any) {
    console.error("[tasks] Approve error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/reject — admin rejects task completion
// ---------------------------------------------------------------------------

router.post("/:id/reject", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== "admin" && !req.user?.permissions?.tasks) {
      res.status(403).json({ message: "Only administrators can reject tasks" });
      return;
    }

    const { reason } = req.body;
    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const now = new Date();
    task.status = "in_progress";
    task.completedAt = null;
    task.submittedForApprovalAt = null;
    task.approvedAt = null;
    task.rejectedAt = now;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    // Notify assignee
    const assigneeId = (task.assignedTo as any)?._id?.toString() ?? task.assignedTo?.toString();
    if (assigneeId && assigneeId !== req.userId) {
      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(assigneeId),
          type: "TASK_REJECTED",
          title: "Task Changes Requested / Rejected",
          message: `${req.user?.name ?? "Administrator"} requested revisions on task "${task.title}"${reason ? `: ${reason}` : ""}.`,
          relatedId: task._id as any,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            reason: reason || "",
            action: "rejected",
          },
        },
        io
      );
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: `Task rejected by admin: ${reason || "Revisions needed"}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Task rejected and returned to in_progress", task: populated });
  } catch (err: any) {
    console.error("[tasks] Reject error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/forward — forward task to another user
// ---------------------------------------------------------------------------

router.post("/:id/forward", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const { toUserId, note } = req.body;
    if (!toUserId || !Types.ObjectId.isValid(toUserId)) {
      res.status(400).json({ message: "Valid target user ID (toUserId) is required" });
      return;
    }

    const targetUser = await User.findById(toUserId).select("name email").lean();
    if (!targetUser) {
      res.status(404).json({ message: "Target user not found" });
      return;
    }

    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const fromUser = task.assignedTo || task.createdBy;
    const now = new Date();

    task.assignedTo = new Types.ObjectId(toUserId);
    task.assignedBy = new Types.ObjectId(req.userId!);
    task.assignedAt = now;

    task.assignmentHistory.push({
      fromUser: fromUser ? new Types.ObjectId(fromUser.toString()) : null,
      toUser: new Types.ObjectId(toUserId),
      assignedBy: new Types.ObjectId(req.userId!),
      action: "forwarded",
      note: typeof note === "string" ? note.trim() : "Task forwarded",
      timestamp: now,
    });

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    if (String(toUserId) !== String(req.userId)) {
      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(toUserId),
          type: "TASK_FORWARDED",
          title: "Task Forwarded to You",
          message: `${req.user?.name ?? "A colleague"} forwarded task "${task.title}" to you${note ? `: ${note}` : ""}`,
          relatedId: task._id as any,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            note: note || "",
          },
        },
        io
      );
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: `Task forwarded to ${targetUser.name}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Task forwarded successfully", task: populated });
  } catch (err: any) {
    console.error("[tasks] Forward error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/reassign — reassign task (admin or authorized)
// ---------------------------------------------------------------------------

router.post("/:id/reassign", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== "admin" && !req.user?.permissions?.tasks) {
      res.status(403).json({ message: "Only administrators can reassign tasks" });
      return;
    }

    const { toUserId, note } = req.body;
    if (!toUserId || !Types.ObjectId.isValid(toUserId)) {
      res.status(400).json({ message: "Valid target user ID (toUserId) is required" });
      return;
    }

    const targetUser = await User.findById(toUserId).select("name email").lean();
    if (!targetUser) {
      res.status(404).json({ message: "Target user not found" });
      return;
    }

    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const fromUser = task.assignedTo;
    const now = new Date();

    task.assignedTo = new Types.ObjectId(toUserId);
    task.assignedBy = new Types.ObjectId(req.userId!);
    task.assignedAt = now;

    task.assignmentHistory.push({
      fromUser: fromUser ? new Types.ObjectId(fromUser.toString()) : null,
      toUser: new Types.ObjectId(toUserId),
      assignedBy: new Types.ObjectId(req.userId!),
      action: "reassigned",
      note: typeof note === "string" ? note.trim() : "Task reassigned",
      timestamp: now,
    });

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", { task: populated });
    }

    if (String(toUserId) !== String(req.userId)) {
      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(toUserId),
          type: "TASK_REASSIGNED",
          title: "Task Reassigned to You",
          message: `${req.user?.name ?? "Administrator"} reassigned task "${task.title}" to you${note ? `: ${note}` : ""}`,
          relatedId: task._id as any,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: task._id.toString(),
            taskTitle: task.title,
            note: note || "",
          },
        },
        io
      );
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: `Task reassigned to ${targetUser.name}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Task reassigned successfully", task: populated });
  } catch (err: any) {
    console.error("[tasks] Reassign error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    await Task.findByIdAndDelete(task._id);

    // Clean up associated reminders atomically
    try {
      await deleteCallReminders("task", task._id);
    } catch (remErr) {
      console.error("[tasks] Failed to delete synchronized reminders on task delete:", remErr);
    }

    // Clean up any associated notifications and emit realtime notification:deleted
    const io = req.app.get("io");
    await NotificationService.deleteByRelatedId(task._id, io);

    // Emit real-time task:deleted event to all connected users
    if (io) {
      io.emit("task:deleted", {
        taskId: task._id.toString(),
        assignedTo: task.assignedTo ? task.assignedTo.toString() : null,
        createdBy: task.createdBy ? task.createdBy.toString() : null,
      });
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "delete",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Task deleted", taskId: task._id });
  } catch (err) {
    console.error("[tasks] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;