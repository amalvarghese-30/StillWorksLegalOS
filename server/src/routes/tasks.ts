import { Router, type Request, type Response } from "express";
import { Task } from "../models/Task.js";
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
        $or: [{ title: regex }, { description: regex }],
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
      .populate("caseId", "title number")
      .populate("clientId", "name phone");
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

    if (!title || !title.trim()) {
      res.status(400).json({ message: "Task title is required" });
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

    // Non-admins can only assign to themselves
    const finalAssignedTo = req.user!.role === "admin" ? (assignedTo ?? null) : req.userId;

    const task = await Task.create({
      title: title.trim(),
      description: description ?? "",
      category: category ?? "Other Work",
      priority: priority ?? "Medium",
      status: "pending",
      deadline: deadline ? new Date(deadline) : null,
      assignedTo: finalAssignedTo,
      caseId: cleanCaseId,
      clientId: cleanClientId,
      checklist: checklist ?? [],
      callReminder: callReminder?.clientName
        ? {
            clientName: String(callReminder.clientName).trim(),
            phone: String(callReminder.phone ?? "").trim(),
            scheduledAt: callReminder.scheduledAt ? new Date(callReminder.scheduledAt) : new Date(),
            notes: String(callReminder.notes ?? "").trim(),
            completed: Boolean(callReminder.completed ?? false),
          }
        : undefined,
      agent: agent ?? "",
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

    // Create synchronized Reminder document if callReminder is present
    if (task.callReminder && task.callReminder.clientName) {
      import("../models/Reminder.js").then(({ Reminder }) => {
        Reminder.create({
          userId: task.assignedTo || task.createdBy,
          sourceType: "task",
          sourceId: task._id,
          clientName: task.callReminder!.clientName,
          phone: task.callReminder!.phone || "",
          notes: task.callReminder!.notes || "",
          scheduledAt: task.callReminder!.scheduledAt || new Date(),
          status: task.callReminder!.completed ? "completed" : "scheduled",
        }).catch(() => {});
      });
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
    const updates: Record<string, unknown> = {};

    const allowed = ["title", "description", "category", "priority", "status", "deadline", "assignedTo", "caseId", "clientId", "agent", "isCall"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body["deadline"]) updates["deadline"] = new Date(req.body["deadline"]);
    if (req.body["callReminder"] !== undefined) {
      if (req.body["callReminder"] === null) {
        updates["callReminder"] = undefined;
      } else if (typeof req.body["callReminder"] === "object") {
        const cr = req.body["callReminder"] as Record<string, unknown>;
        updates["callReminder"] = {
          clientName: String(cr["clientName"] ?? "").trim(),
          phone: String(cr["phone"] ?? "").trim(),
          scheduledAt: cr["scheduledAt"] ? new Date(cr["scheduledAt"] as string) : new Date(),
          notes: String(cr["notes"] ?? "").trim(),
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

    // Non-admins attempting to mark task completed submit it for admin approval
    if (updates["status"] !== undefined) {
      if (req.user!.role !== "admin" && updates["status"] === "completed") {
        updates["status"] = "pending_approval";
      }
    }

    // Fetch the original task to detect changes
    const originalTask = await Task.findById(req.params["id"]);

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
        .populate("assignedTo", "name email")
        .populate("caseId", "title number")
        .populate("clientId", "name");

      if (!task) {
        const existing = await Task.findById(req.params["id"])
          .populate("assignedTo", "name email")
          .populate("caseId", "title number")
          .populate("clientId", "name");
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
        .populate("assignedTo", "name email")
        .populate("caseId", "title number")
        .populate("clientId", "name");

      if (!task) {
        res.status(404).json({ message: "Task not found" });
        return;
      }
    }

    // Synchronize Reminder document if task has callReminder or status changed
    if (task && (updates["callReminder"] !== undefined || updates["status"] !== undefined)) {
      import("../models/Reminder.js").then(({ Reminder }) => {
        const isDone = task.status === "completed" || Boolean(task.callReminder?.completed);
        const updateDoc: Record<string, unknown> = {};
        if (isDone) {
          updateDoc["status"] = "completed";
          updateDoc["completedAt"] = new Date();
        } else if (task.callReminder?.scheduledAt) {
          updateDoc["status"] = "scheduled";
        }
        if (task.callReminder) {
          updateDoc["clientName"] = task.callReminder.clientName;
          updateDoc["phone"] = task.callReminder.phone || "";
          updateDoc["notes"] = task.callReminder.notes || "";
          updateDoc["scheduledAt"] = task.callReminder.scheduledAt || new Date();
        }
        if (task.assignedTo) {
          updateDoc["userId"] = (task.assignedTo as any)._id || task.assignedTo;
        }
        if (Object.keys(updateDoc).length > 0) {
          Reminder.findOneAndUpdate(
            { sourceType: "task", sourceId: task._id },
            { $set: updateDoc },
            { upsert: Boolean(task.callReminder?.clientName) }
          ).catch(() => {});
        }
      });
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
// PATCH /api/tasks/:taskId/checklist/:itemId — toggle checklist item (with authorization)
// ---------------------------------------------------------------------------

router.patch("/:taskId/checklist/:itemId", requireResourceAccess("task", "taskId"), async (req: Request, res: Response) => {
  try {
    const { done } = req.body;
    const task = await Task.findById(req.params["taskId"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    // ChecklistItem does not extend Mongoose Document, so use find on
    // the subdocument array directly (cast _id to string for comparison).
    const item = task.checklist.find(
      (c) => (c as any)._id?.toString() === req.params["itemId"],
    );
    if (!item) {
      res.status(404).json({ message: "Checklist item not found" });
      return;
    }

    item.done = Boolean(done);
    await task.save();

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: `Checklist item ${done ? "completed" : "uncompleted"}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", {
        task,
        assignedTo: task.assignedTo ? task.assignedTo.toString() : null,
        createdBy: task.createdBy ? task.createdBy.toString() : null,
      });
    }

    res.json({ task });
  } catch (err) {
    console.error("[tasks] Checklist toggle error:", err);
    res.status(500).json({ message: "Internal server error" });
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