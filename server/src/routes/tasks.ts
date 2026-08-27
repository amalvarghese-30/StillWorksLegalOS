import { Router, type Request, type Response } from "express";
import { Task } from "../models/Task.js";
import { Case } from "../models/Case.js";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { AppSettings } from "../models/AppSettings.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCase, canAccessTask, requireResourceAccess, getAccessibleCaseIds } from "../middleware/authorization.js";

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
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    if (status && status !== "all") filter["status"] = status;
    if (priority && priority !== "all") filter["priority"] = priority;
    if (category && category !== "all") filter["category"] = category;
    if (assignedTo) filter["assignedTo"] = assignedTo;
    if (caseId) filter["caseId"] = caseId;

    // Non-admins only see their tasks
    if (req.user!.role !== "admin") {
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);

      // Build filter for tasks user can access:
      // - assigned to them
      // - created by them
      // - in their accessible cases
      const taskFilter: Record<string, unknown> = {
        $or: [
          { assignedTo: req.userId },
          { createdBy: req.userId },
          { caseId: { $in: accessibleCaseIds } },
        ],
      };

      // Merge with existing filter
      Object.assign(filter, taskFilter);
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter["$or"] = [{ title: regex }, { description: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ deadline: 1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("assignedTo", "name email")
        .populate("caseId", "title number")
        .populate("clientId", "name")
        .lean(),
      Task.countDocuments(filter),
    ]);

    res.json({
      tasks,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
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

    const cleanCaseId = caseId && String(caseId).trim() ? String(caseId).trim() : null;
    const cleanClientId = clientId && String(clientId).trim() ? String(clientId).trim() : null;

    // Validate MongoDB ObjectId hex formats
    if (cleanCaseId && !/^[0-9a-fA-F]{24}$/.test(cleanCaseId)) {
      res.status(400).json({ message: "Invalid Case ID format. Must be a 24-character hexadecimal string." });
      return;
    }
    if (cleanClientId && !/^[0-9a-fA-F]{24}$/.test(cleanClientId)) {
      res.status(400).json({ message: "Invalid Client ID format. Must be a 24-character hexadecimal string." });
      return;
    }

    // Validate case access if caseId provided
    if (cleanCaseId && req.user!.role !== "admin") {
      const hasAccess = await canAccessCase(req.userId!, req.user!.role, cleanCaseId);
      if (!hasAccess) {
        res.status(403).json({ message: "Cannot create task for a case you don't have access to" });
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
      callReminder: callReminder?.clientName ? callReminder : undefined,
      agent: agent ?? "",
      isCall: Boolean(isCall),
      createdBy: req.userId,
    });

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
    if (req.body["callReminder"]) updates["callReminder"] = req.body["callReminder"];

    if (updates["caseId"] !== undefined) {
      const cid = String(updates["caseId"]).trim();
      updates["caseId"] = cid ? cid : null;
      if (updates["caseId"] && !/^[0-9a-fA-F]{24}$/.test(updates["caseId"] as string)) {
        res.status(400).json({ message: "Invalid Case ID format" });
        return;
      }
    }
    if (updates["clientId"] !== undefined) {
      const clid = String(updates["clientId"]).trim();
      updates["clientId"] = clid ? clid : null;
      if (updates["clientId"] && !/^[0-9a-fA-F]{24}$/.test(updates["clientId"] as string)) {
        res.status(400).json({ message: "Invalid Client ID format" });
        return;
      }
    }

    // Non-admins cannot reassign to others
    if (req.user!.role !== "admin" && updates["assignedTo"] && updates["assignedTo"] !== req.userId) {
      res.status(403).json({ message: "Cannot assign task to another user" });
      return;
    }

    // Validate case access if caseId changed
    if (updates["caseId"] && req.user!.role !== "admin") {
      const hasAccess = await canAccessCase(req.userId!, req.user!.role, updates["caseId"] as string);
      if (!hasAccess) {
        res.status(403).json({ message: "Cannot move task to a case you don't have access to" });
        return;
      }
    }

    const task = await Task.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
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
    const task = await Task.findByIdAndDelete(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
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

    res.json({ message: "Task deleted" });
  } catch (err) {
    console.error("[tasks] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;