import { Router, type Request, type Response } from "express";
import { Task } from "../models/Task.js";
import { TaskReminderState } from "../models/TaskReminderState.js";
import { Reminder } from "../models/Reminder.js";
import { syncCallReminders, deleteCallReminders } from "../services/reminders.js";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { DocumentModel } from "../models/Document.js";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { AppSettings } from "../models/AppSettings.js";
import { NotificationService } from "../services/notifications.js";
import { Types } from "mongoose";
import { ApprovalRequest } from "../models/ApprovalRequest.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCase, canAccessClient, canAccessTask, canAccessDocument, requireResourceAccess, getAccessibleCaseIds } from "../middleware/authorization.js";
import { resolveTaskClientName, resolveTaskAssigneeName } from "../utils/taskHelpers.js";
import { validateSnoozePayload } from "../utils/snoozeValidation.js";
import { dispatchRejectionNotifications } from "../services/rejectionNotifications.js";
import { recordTaskAuditAndAdminNotification } from "../utils/auditNotificationHelper.js";

function relationId(value: any): string | null {
  if (!value) return null;
  const candidate = value._id ?? value;
  if (candidate === null || candidate === undefined) return null;
  const id = typeof candidate.toString === "function" ? candidate.toString() : String(candidate);
  return id && id !== "[object Object]" ? id : null;
}

/**
 * Realtime events are broadcast to connected sockets. Send only opaque IDs so
 * the event can invalidate authorized queries without disclosing task content,
 * notes, descriptions, assignees, or assignment history to unrelated clients.
 */
function taskRealtimePayload(task: any): { taskId: string | null; caseId: string | null; clientId: string | null } {
  return {
    taskId: relationId(task?._id),
    caseId: relationId(task?.caseId),
    clientId: relationId(task?.clientId),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseChecklistRecursive(items: unknown[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: any) => {
    if (!item || typeof item !== "object") return null;
    const sanitized: any = {
      ...(item._id ? { _id: item._id } : {}),
      id: item.id || (item._id ? String(item._id) : undefined),
      text: sanitizeInputText(item.text ?? "", 500),
      done: Boolean(item.done),
    };
    if (item.remarks && typeof item.remarks === "string") {
      sanitized.remarks = sanitizeInputText(item.remarks, 1000);
    }
    if (Array.isArray(item.subItems) && item.subItems.length > 0) {
      sanitized.subItems = parseChecklistRecursive(item.subItems);
    } else {
      sanitized.subItems = [];
    }
    return sanitized;
  }).filter(Boolean);
}

async function resolveCaseId(identifier: unknown): Promise<{ id: string | null; error?: string; code?: string; field?: string }> {
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
      { countCaseNumber: clean },
      { title: { $regex: `^${escaped}$`, $options: "i" } },
    ],
  }).select("_id").lean();

  if (byOther) return { id: (byOther as any)._id.toString() };

  // Compound label support e.g. "SW-2026-0166 — RAJU SHET"
  const caseNumberMatch = clean.match(/SW-\d{4}-\d{4}/i);
  if (caseNumberMatch) {
    const byNum = await Case.findOne({ number: caseNumberMatch[0].toUpperCase() }).select("_id").lean();
    if (byNum) return { id: (byNum as any)._id.toString() };
  }

  return {
    id: null,
    error: `Case "${clean}" was not found. Please select a valid case.`,
    code: "CASE_NOT_FOUND",
    field: "caseId",
  };
}

async function resolveClientId(
  identifier: unknown,
  options?: { creatorUserId?: string; autoCreate?: boolean }
): Promise<{ id: string | null; error?: string; code?: string; field?: string }> {
  if (identifier === null || identifier === undefined) return { id: null };
  const clean = String(identifier).trim();
  if (!clean || clean.toLowerCase() === "none") return { id: null };

  // 1. Direct MongoDB ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(clean)) {
    const byId = await Client.findById(clean).select("_id").lean();
    if (byId) return { id: (byId as any)._id.toString() };
  }

  // 2. Exact match on phone, email, or exact name
  const escaped = escapeRegex(clean);
  const byOther = await Client.findOne({
    $or: [
      { name: { $regex: `^${escaped}$`, $options: "i" } },
      { email: { $regex: `^${escaped}$`, $options: "i" } },
      { phone: clean },
    ],
  }).select("_id").lean();

  if (byOther) return { id: (byOther as any)._id.toString() };

  // 3. Compound string handling (e.g. "JATINDER SINGH - 9869717581" or "JATINDER SINGH (9869717581)")
  const compoundMatch = clean.match(/^(.+?)\s*(?:-|–|—|\()\s*([0-9+\s()-]+)\)?$/);
  if (compoundMatch) {
    const candidateName = compoundMatch[1]?.trim() || "";
    const rawPhone = compoundMatch[2]?.replace(/[^\d+]/g, "") || "";

    if (rawPhone && rawPhone.length >= 7) {
      const byPhone = await Client.findOne({ phone: { $regex: rawPhone } }).select("_id").lean();
      if (byPhone) return { id: (byPhone as any)._id.toString() };
    }

    if (candidateName && candidateName.length >= 2) {
      const escapedCandName = escapeRegex(candidateName);
      const byCandName = await Client.findOne({
        name: { $regex: `^${escapedCandName}$`, $options: "i" },
      }).select("_id").lean();
      if (byCandName) return { id: (byCandName as any)._id.toString() };
    }
  }

  // 4. Check if a 10-digit phone number is embedded in the string
  const phoneOnlyMatch = clean.match(/\b\d{10}\b/);
  if (phoneOnlyMatch) {
    const byEmbeddedPhone = await Client.findOne({ phone: phoneOnlyMatch[0] }).select("_id").lean();
    if (byEmbeddedPhone) return { id: (byEmbeddedPhone as any)._id.toString() };
  }

  // 5. Automatic client creation if permitted
  if (options?.autoCreate && options.creatorUserId) {
    const candidateName = compoundMatch ? compoundMatch[1]?.trim() : clean;
    const candidatePhone = compoundMatch ? compoundMatch[2]?.replace(/[^\d+]/g, "") : (phoneOnlyMatch ? phoneOnlyMatch[0] : "");
    if (candidateName && candidateName.length >= 2) {
      const newClient = await Client.create({
        name: candidateName,
        phone: candidatePhone || "",
        createdBy: new Types.ObjectId(options.creatorUserId),
        updatedBy: new Types.ObjectId(options.creatorUserId),
      });
      return { id: newClient._id.toString() };
    }
  }

  return {
    id: null,
    error: `Client "${clean}" was not found. Please select a valid client.`,
    code: "CLIENT_NOT_FOUND",
    field: "clientId",
  };
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
      completedFrom,
      completedTo,
      open,
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {
      isDeleted: { $ne: true },
    };

    if (open === "true") {
      filter["status"] = { $in: ["pending", "in_progress", "pending_approval"] };
    } else if (status && status !== "all") {
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
    if (agent && agent !== "all") {
      filter["agent"] = agent;
    }

    if (isCall === "true" || hasCallReminder === "true") {
      filter["$or"] = [{ isCall: true }, { "callReminder.scheduledAt": { $exists: true, $ne: null } }];
    }

    const andConditions: Record<string, unknown>[] = [];

    if (clientId) {
      if (Types.ObjectId.isValid(clientId)) {
        const clientObjId = new Types.ObjectId(clientId);
        const clientCases = await Case.find({
          $or: [
            { clientId: clientObjId },
            { "parties.clientId": clientObjId },
          ],
        }).select("_id").lean();
        const clientCaseIds = clientCases.map((c) => c._id);
        andConditions.push({
          $or: [
            { clientId: clientObjId },
            { clientId: clientId },
            ...(clientCaseIds.length > 0 ? [{ caseId: { $in: clientCaseIds } }] : []),
          ],
        });
      } else {
        filter["clientId"] = clientId;
      }
    }

    if (assignedTo && assignedTo !== "all") {
      if (assignedTo.includes(",")) {
        const rawIds = assignedTo.split(",").map((id) => id.trim()).filter(Boolean);
        const objIds = rawIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
        const allIds = Array.from(new Set([...rawIds, ...objIds]));
        andConditions.push({
          $or: [
            { assignedTo: { $in: allIds } },
            { assignedUsers: { $in: allIds } },
          ],
        });
      } else {
        const trimmed = assignedTo.trim();
        const objId = Types.ObjectId.isValid(trimmed) ? new Types.ObjectId(trimmed) : null;
        andConditions.push({
          $or: [
            { assignedTo: trimmed },
            ...(objId ? [{ assignedTo: objId }] : []),
            { assignedUsers: trimmed },
            ...(objId ? [{ assignedUsers: objId }] : []),
          ],
        });
      }
    }

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

    // Filter by actual completedAt timestamp (for Done Today / Done This Week)
    if (completedFrom || completedTo) {
      const completedCond: Record<string, unknown> = {};
      if (completedFrom) completedCond["$gte"] = new Date(completedFrom);
      if (completedTo) completedCond["$lte"] = new Date(completedTo);
      andConditions.push({
        $or: [
          { completedAt: completedCond },
          { completedAt: { $in: [null, undefined] }, updatedAt: completedCond },
        ],
      });
    }

    // Non-admins only see tasks assigned to them, or unassigned tasks created by them
    if (req.user!.role !== "admin") {
      const uid = req.userId;
      const uObjectId = Types.ObjectId.isValid(uid!) ? new Types.ObjectId(uid) : uid;
      andConditions.push({
        $or: [
          { assignedTo: uid },
          { assignedTo: uObjectId },
          { assignedUsers: uid },
          { assignedUsers: uObjectId },
          {
            $and: [
              { $or: [{ createdBy: uid }, { createdBy: uObjectId }] },
              {
                $or: [
                  { assignedTo: { $exists: false } },
                  { assignedTo: null },
                  { assignedTo: uid },
                  { assignedTo: uObjectId },
                  { assignedUsers: uid },
                  { assignedUsers: uObjectId },
                ],
              },
            ],
          },
        ],
      });
    }

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      const regex = new RegExp(escaped, "i");
      andConditions.push({
        $or: [
          { title: regex },
          { description: regex },
          { agent: regex },
          { category: regex },
          { mainCategory: regex },
          { subCategory: regex },
          { customCategory: regex },
          { "checklist.text": regex },
          { "checklist.subItems.text": regex },
          { "checklist.remarks": regex },
          { "remarks.text": regex },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter["$and"] = andConditions;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const baseAccessibleTaskFilter: Record<string, unknown> = {
      isDeleted: { $ne: true },
    };
    if (req.user!.role !== "admin") {
      baseAccessibleTaskFilter["$or"] = [
        { assignedTo: req.userId },
        { assignedUsers: req.userId },
        { createdBy: req.userId },
      ];
    }

    const [tasks, total, allAccessible] = await Promise.all([
      Task.find(filter)
        .sort({ deadline: 1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("assignedTo", "name email title role avatar avatarUrl")
        .populate("assignedUsers", "name email title role avatar avatarUrl")
        .populate("assignedBy", "name email")
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .populate("caseId", "title number")
        .populate("clientId", "name")
        .populate("assignmentHistory.fromUser", "name email")
        .populate("assignmentHistory.toUser", "name email")
        .populate("assignmentHistory.assignedBy", "name email")
        .lean(),
      Task.countDocuments(filter),
      Task.find(baseAccessibleTaskFilter, { status: 1, deadline: 1, isCall: 1, callReminder: 1 }).lean(),
    ]);

    const mappedTasks = tasks.map((t: any) => {
      const assignedUsers = Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
        ? t.assignedUsers
        : (t.assignedTo ? [t.assignedTo] : []);
      return {
        ...t,
        assignedUsers,
        assignedTo: t.assignedTo || (assignedUsers.length > 0 ? assignedUsers[0] : null),
      };
    });

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
      tasks: mappedTasks,
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
// GET /api/tasks/pending-reminders — list tasks pending for 2+ hours
// Registered before /:id so "pending-reminders" isn't treated as a task id.
// ---------------------------------------------------------------------------

router.get("/pending-reminders", async (req: Request, res: Response) => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const filter: Record<string, unknown> = {
      status: { $in: ["pending", "in_progress"] },
      isDeleted: { $ne: true },
      $or: [
        { createdAt: { $lte: twoHoursAgo } },
        { startedAt: { $lte: twoHoursAgo } },
      ],
    };

    // User-wise isolation: Each user (including Admin) receives pending task reminders
    // strictly for tasks assigned to them, preventing admins and other users from receiving others' reminders.
    filter["$and"] = [
      {
        $or: [
          { assignedTo: new Types.ObjectId(req.userId!) },
          { assignedTo: null, createdBy: new Types.ObjectId(req.userId!) },
        ],
      },
    ];

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email title")
      .populate("clientId", "name phone")
      .populate("caseId", "title number parties")
      .sort({ deadline: 1, createdAt: 1 })
      .lean();

    const taskIds = (tasks || []).map((t: any) => t._id);
    const reminderStates = await TaskReminderState.find({
      userId: new Types.ObjectId(req.userId!),
      taskId: { $in: taskIds },
    }).lean();

    const stateMap = new Map<string, any>();
    for (const rs of reminderStates) {
      stateMap.set(rs.taskId.toString(), rs);
    }

    const now = Date.now();
    const pendingReminders = (tasks || [])
      .map((t: any) => {
        const taskIdStr = t._id.toString();
        const startTime = new Date(t.startedAt || t.createdAt || Date.now()).getTime();
        const pendingHours = Math.max(2, Math.floor((now - startTime) / (60 * 60 * 1000)));
        const slot = Math.floor(pendingHours / 2);

        // Check if snoozed or dismissed for current user
        const state = stateMap.get(taskIdStr);
        if (state) {
          if (state.snoozedUntil && new Date(state.snoozedUntil).getTime() > now) {
            return null; // Suppressed by active snooze
          }
          if (state.dismissed) {
            if (state.dismissedSlot == null || state.dismissedSlot === slot) {
              return null; // Suppressed by dismissal
            }
          }
        }

        return {
          taskId: taskIdStr,
          taskTitle: t.title,
          clientName: resolveTaskClientName(t),
          assignedStaff: resolveTaskAssigneeName(t),
          assignedToId: t.assignedTo?._id?.toString() || (t.assignedTo ? t.assignedTo.toString() : null),
          deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
          priority: t.priority || "Medium",
          status: t.status,
          pendingHours,
          slot,
        };
      })
      .filter(Boolean);

    res.json({ pendingReminders, count: pendingReminders.length });
  } catch (err: any) {
    console.error("[tasks] Get pending reminders error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id (with authorization)
// ---------------------------------------------------------------------------

router.get("/:id", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params["id"])
      .populate("assignedTo", "name email title role avatar")
      .populate("assignedUsers", "name email title role avatar")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("updatedBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }
    const taskObj: any = task.toObject();
    const assignedUsers = Array.isArray(taskObj.assignedUsers) && taskObj.assignedUsers.length > 0
      ? taskObj.assignedUsers
      : (taskObj.assignedTo ? [taskObj.assignedTo] : []);
    taskObj.assignedUsers = assignedUsers;
    if (!taskObj.assignedTo && assignedUsers.length > 0) {
      taskObj.assignedTo = assignedUsers[0];
    }
    const documents = await DocumentModel.find({ taskId: task._id })
      .select("name originalName size sizeFormatted mimeType state createdAt uploadedBy version")
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();
    taskObj.documents = documents;
    res.json({ task: taskObj });
  } catch (err) {
    console.error("[tasks] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/audit-logs (with authorization)
// ---------------------------------------------------------------------------

router.get("/:id/audit-logs", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find({
      resource: "task",
      resourceId: req.params["id"],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ logs });
  } catch (err: any) {
    console.error("[tasks] Get task audit logs error:", err);
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
    let cleanClientId = clientResolution.id;
    if (cleanCaseId) {
      const parentCase = await Case.findById(cleanCaseId).select("parties").lean();
      if (!parentCase) {
        res.status(404).json({ message: "Linked case not found" });
        return;
      }

      const caseClientIds = new Set<string>(
        (parentCase.parties ?? [])
          .filter((party: any) => (party.type === "client" || party.type === "sub_client") && party.clientId)
          .map((party: any) => String(party.clientId?._id ?? party.clientId)),
      );
      const primaryClientParty = parentCase.parties?.find(
        (party: any) => (party.type === "client" || party.type === "sub_client") && party.clientId,
      );
      const primaryClientId = primaryClientParty?.clientId
        ? String(primaryClientParty.clientId?._id ?? primaryClientParty.clientId)
        : null;

      if (!cleanClientId && primaryClientId) {
        cleanClientId = primaryClientId;
      } else if (cleanClientId && caseClientIds.size > 0 && !caseClientIds.has(cleanClientId)) {
        res.status(400).json({ message: "The selected client is not linked to the selected case" });
        return;
      }
    }

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

    // Multiple assignees support: accept array or single ID
    let finalAssignedUsers: Types.ObjectId[] = [];
    if (Array.isArray(assignedTo)) {
      finalAssignedUsers = assignedTo
        .filter((id) => id && Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
    } else if (Array.isArray(req.body.assignedUsers)) {
      finalAssignedUsers = req.body.assignedUsers
        .filter((id: any) => id && Types.ObjectId.isValid(id))
        .map((id: any) => new Types.ObjectId(id));
    } else if (typeof assignedTo === "string" && assignedTo.includes(",")) {
      finalAssignedUsers = assignedTo
        .split(",")
        .map((id) => id.trim())
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
    } else if (assignedTo && Types.ObjectId.isValid(assignedTo)) {
      finalAssignedUsers = [new Types.ObjectId(assignedTo)];
    } else if (assignedTo === null) {
      finalAssignedUsers = [];
    } else {
      finalAssignedUsers = [new Types.ObjectId(req.userId!)];
    }

    const finalAssignedTo: Types.ObjectId | null = finalAssignedUsers.length > 0 ? finalAssignedUsers[0] : null;
    const cleanAgent = sanitizeInputText(agent, 100);

    // Initial note / remark / important message
    const initialNoteText = typeof req.body.remark === "string" ? req.body.remark.trim() : (typeof req.body.note === "string" ? req.body.note.trim() : "");
    const initialRemarks: any[] = [];
    if (initialNoteText) {
      initialRemarks.push({
        _id: new Types.ObjectId(),
        text: sanitizeInputText(initialNoteText, 5000),
        author: req.user?.name || "Staff Member",
        authorName: req.user?.name || "Staff Member",
        authorId: new Types.ObjectId(req.userId!),
        createdAt: new Date(),
      });
    } else if (Array.isArray(req.body.remarks)) {
      for (const r of req.body.remarks) {
        if (r && typeof r.text === "string" && r.text.trim()) {
          initialRemarks.push({
            _id: new Types.ObjectId(),
            text: sanitizeInputText(r.text.trim(), 5000),
            author: r.author || r.authorName || req.user?.name || "Staff Member",
            authorName: r.authorName || r.author || req.user?.name || "Staff Member",
            authorId: new Types.ObjectId(req.userId!),
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          });
        }
      }
    }

    const initialAssignmentHistory: any[] = [];
    for (const assigneeId of finalAssignedUsers) {
      initialAssignmentHistory.push({
        fromUser: null,
        toUser: assigneeId,
        assignedBy: new Types.ObjectId(req.userId!),
        action: "assigned",
        note: `Initial task assignment by ${req.user?.name || "Staff"}`,
        timestamp: new Date(),
      });
    }

    // Validate optional document associations before creating the task. Never
    // let documentIds re-link a document that is unauthorized, rejected, or
    // already attached to another task/case/client.
    const taskDocumentsToAttach: Array<{
      _id: Types.ObjectId;
      caseId: Types.ObjectId | null;
      clientId: Types.ObjectId | null;
    }> = [];
    if (req.body.documentIds !== undefined) {
      if (!Array.isArray(req.body.documentIds)) {
        res.status(400).json({ message: "documentIds must be an array" });
        return;
      }
      const rawDocumentIds = [...new Set(req.body.documentIds.map((id: unknown) => String(id)))];
      if (rawDocumentIds.some((id: string) => !Types.ObjectId.isValid(id))) {
        res.status(400).json({ message: "One or more document IDs are invalid" });
        return;
      }
      if (rawDocumentIds.length > 0) {
        const objectIds = rawDocumentIds.map((id: string) => new Types.ObjectId(id));
        const existingDocuments = await DocumentModel.find({ _id: { $in: objectIds } })
          .select("_id uploadedBy state taskId caseId clientId")
          .lean();
        if (existingDocuments.length !== objectIds.length) {
          res.status(400).json({ message: "One or more documents no longer exist" });
          return;
        }

        for (const document of existingDocuments) {
          const docCaseId = document.caseId ? document.caseId.toString() : null;
          const docClientId = document.clientId ? document.clientId.toString() : null;
          if (document.taskId) {
            res.status(409).json({ message: "A selected document is already attached to another task" });
            return;
          }
          if (document.state === "Rejected") {
            res.status(409).json({ message: "Rejected documents cannot be attached to a task" });
            return;
          }
          if (docCaseId && (!cleanCaseId || docCaseId !== cleanCaseId)) {
            res.status(409).json({ message: "A selected document belongs to a different case" });
            return;
          }
          if (docClientId && (!cleanClientId || docClientId !== cleanClientId)) {
            res.status(409).json({ message: "A selected document belongs to a different client" });
            return;
          }
          const canAttachDocument = await canAccessDocument(
            req.userId!,
            req.user!.role,
            document._id.toString(),
            req.user?.permissions,
          );
          if (!canAttachDocument) {
            res.status(403).json({ message: "You do not have permission to attach one of the selected documents" });
            return;
          }
          taskDocumentsToAttach.push({
            _id: document._id as Types.ObjectId,
            caseId: (document.caseId as Types.ObjectId | null) ?? null,
            clientId: (document.clientId as Types.ObjectId | null) ?? null,
          });
        }
      }
    }

    const task = await Task.create({
      title: title.trim(),
      description: description ?? "",
      notes: typeof req.body.notes === "string" ? req.body.notes.trim() : (typeof req.body.internalNotes === "string" ? req.body.internalNotes.trim() : ""),
      category: category ?? "Other Work",
      mainCategory: typeof req.body.mainCategory === "string" ? req.body.mainCategory.trim() : undefined,
      subCategory: typeof req.body.subCategory === "string" ? req.body.subCategory.trim() : undefined,
      categoryPath: Array.isArray(req.body.categoryPath) ? req.body.categoryPath.map((p: any) => String(p).trim()).filter(Boolean) : [],
      customCategory: typeof req.body.customCategory === "string" ? req.body.customCategory.trim() : undefined,
      parentTaskId: req.body.parentTaskId && Types.ObjectId.isValid(req.body.parentTaskId) ? new Types.ObjectId(req.body.parentTaskId) : null,
      priority: priority ?? "Medium",
      status: "pending",
      deadline: parsedDeadline,
      assignedTo: finalAssignedTo,
      assignedUsers: finalAssignedUsers,
      caseId: cleanCaseId,
      clientId: cleanClientId,
      checklist: parseChecklistRecursive(checklist),
      remarks: initialRemarks,
      localPath: typeof req.body.localPath === "string" ? req.body.localPath.trim() : "",
      assignedBy: finalAssignedTo ? req.userId : null,
      assignedAt: finalAssignedTo ? new Date() : null,
      assignmentHistory: initialAssignmentHistory,
      callReminder: parsedCallReminder,
      agent: cleanAgent,
      isCall: Boolean(isCall),
      createdBy: req.userId,
      updatedBy: req.userId,
    });

    // Attach only the prevalidated documents using a compare-and-set filter so
    // a concurrent reassignment cannot silently move an unrelated file.
    try {
      for (const snapshot of taskDocumentsToAttach) {
        const attachFilter: any = {
          _id: snapshot._id,
          taskId: null,
          caseId: snapshot.caseId,
          clientId: snapshot.clientId,
          state: { $ne: "Rejected" },
        };
        const attached = await DocumentModel.findOneAndUpdate(
          attachFilter,
          {
            $set: {
              taskId: task._id,
              caseId: cleanCaseId ? new Types.ObjectId(cleanCaseId) : null,
              clientId: cleanClientId ? new Types.ObjectId(cleanClientId) : null,
            },
          },
          { new: true, runValidators: true },
        ).select("_id").lean();
        if (!attached) {
          throw new Error("A selected document changed while the task was being created");
        }
      }
    } catch (associationError) {
      // Roll back only associations made by this request. Do not overwrite a
      // document that another request has moved after our update.
      for (const snapshot of taskDocumentsToAttach) {
        await DocumentModel.updateOne(
          { _id: snapshot._id, taskId: task._id },
          {
            $unset: { taskId: 1 },
            $set: { caseId: snapshot.caseId, clientId: snapshot.clientId },
          },
        ).catch(() => undefined);
      }
      await Task.findByIdAndDelete(task._id).catch(() => undefined);
      console.warn("[tasks] Document association failed; rolled back task creation:", associationError);
      res.status(409).json({
        message: "A selected document changed during task creation. No task was created; refresh the documents and retry.",
      });
      return;
    }

    // Notify all assigned staff if assigned to someone else
    for (const assigneeId of finalAssignedUsers) {
      if (assigneeId.toString() !== req.userId) {
        const isUrgent = task.priority === "High";
        await NotificationService.createNotification({
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          title: isUrgent ? "🚨 Urgent Task Assigned" : "New Task Assigned",
          message: `${req.user?.name ?? "Admin"} assigned you ${isUrgent ? "an urgent" : "a"} task: "${task.title}"`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId),
          metadata: {
            taskTitle: task.title,
            taskId: task._id.toString(),
            caseId: cleanCaseId ? cleanCaseId.toString() : undefined,
            priority: task.priority,
            clientName: resolveTaskClientName(task),
            deadline: task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline",
            assignedBy: req.user?.name ?? "Staff",
          },
        }, req.app.get("io"));
      }
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
    // Reminders are strictly for the assigned user(s). Fallback to creator only if unassigned.
    if (task.callReminder && task.callReminder.clientName) {
      const explicitAssignees = finalAssignedUsers.length > 0 ? finalAssignedUsers : (finalAssignedTo ? [finalAssignedTo] : []);
      const taskUserIds = explicitAssignees.length > 0 ? explicitAssignees : [task.createdBy || req.userId].filter(Boolean);
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

    await task.populate([
      { path: "assignedTo", select: "name email title role avatar avatarUrl" },
      { path: "assignedUsers", select: "name email title role avatar avatarUrl" },
    ]);

    const taskObj: any = task.toObject();
    taskObj.assignedUsers = Array.isArray(taskObj.assignedUsers) && taskObj.assignedUsers.length > 0
      ? taskObj.assignedUsers
      : (taskObj.assignedTo ? [taskObj.assignedTo] : []);
    if (!taskObj.assignedTo && taskObj.assignedUsers.length > 0) {
      taskObj.assignedTo = taskObj.assignedUsers[0];
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("task:created", taskRealtimePayload(task));
    }

    res.status(201).json({ task: taskObj });
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

    const allowed = [
      "title",
      "description",
      "category",
      "mainCategory",
      "subCategory",
      "categoryPath",
      "customCategory",
      "parentTaskId",
      "priority",
      "status",
      "deadline",
      "assignedTo",
      "assignedUsers",
      "caseId",
      "clientId",
      "agent",
      "isCall",
      "checklist",
      "localPath",
      "notes",
      "internalNotes",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    let newAssignedUsers: Types.ObjectId[] | undefined = undefined;
    const rawAssignVal = updates["assignedUsers"] !== undefined ? updates["assignedUsers"] : updates["assignedTo"];
    if (rawAssignVal !== undefined) {
      if (Array.isArray(rawAssignVal)) {
        newAssignedUsers = rawAssignVal
          .map((id: any) => String(id?._id || id).trim())
          .filter((id: string) => Types.ObjectId.isValid(id))
          .map((id: string) => new Types.ObjectId(id));
      } else if (typeof rawAssignVal === "string" && rawAssignVal.includes(",")) {
        newAssignedUsers = rawAssignVal
          .split(",")
          .map((id: string) => id.trim())
          .filter((id: string) => Types.ObjectId.isValid(id))
          .map((id: string) => new Types.ObjectId(id));
      } else if (rawAssignVal && Types.ObjectId.isValid(String(rawAssignVal))) {
        newAssignedUsers = [new Types.ObjectId(String(rawAssignVal))];
      } else if (rawAssignVal === null || rawAssignVal === "") {
        newAssignedUsers = [];
      }

      if (newAssignedUsers !== undefined) {
        updates["assignedUsers"] = newAssignedUsers;
        updates["assignedTo"] = newAssignedUsers.length > 0 ? newAssignedUsers[0] : null;
      }
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
    if (updates["mainCategory"] !== undefined) {
      updates["mainCategory"] = typeof updates["mainCategory"] === "string" ? updates["mainCategory"].trim() : "";
    }
    if (updates["subCategory"] !== undefined) {
      updates["subCategory"] = typeof updates["subCategory"] === "string" ? updates["subCategory"].trim() : "";
    }
    if (updates["customCategory"] !== undefined) {
      updates["customCategory"] = typeof updates["customCategory"] === "string" ? updates["customCategory"].trim() : "";
    }
    if (updates["parentTaskId"] !== undefined) {
      updates["parentTaskId"] = updates["parentTaskId"] && Types.ObjectId.isValid(updates["parentTaskId"] as string) ? new Types.ObjectId(updates["parentTaskId"] as string) : null;
    }
    if (updates["checklist"] !== undefined) {
      if (Array.isArray(updates["checklist"])) {
        updates["checklist"] = parseChecklistRecursive(updates["checklist"]);
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

    // Load the persisted task before resolving linked relationships so partial
    // updates can preserve or derive the correct case/client pair.
    const originalTask = await Task.findById(req.params["id"]);
    if (!originalTask) {
      res.status(404).json({ message: "Task not found" });
      return;
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

    const originalCaseId = originalTask.caseId ? originalTask.caseId.toString() : null;
    const originalClientId = originalTask.clientId ? originalTask.clientId.toString() : null;
    const targetCaseId = updates["caseId"] !== undefined
      ? (updates["caseId"] ? String(updates["caseId"]) : null)
      : originalCaseId;
    let targetClientId = updates["clientId"] !== undefined
      ? (updates["clientId"] ? String(updates["clientId"]) : null)
      : originalClientId;

    if (targetCaseId) {
      const targetCase = await Case.findById(targetCaseId).select("parties").lean();
      if (!targetCase) {
        res.status(404).json({ message: "Linked case not found" });
        return;
      }
      const targetCaseClientIds = new Set<string>(
        (targetCase.parties ?? [])
          .filter((party: any) => (party.type === "client" || party.type === "sub_client") && party.clientId)
          .map((party: any) => String(party.clientId?._id ?? party.clientId)),
      );
      const primaryParty = targetCase.parties?.find(
        (party: any) => (party.type === "client" || party.type === "sub_client") && party.clientId,
      );
      const primaryClientId = primaryParty?.clientId
        ? String(primaryParty.clientId?._id ?? primaryParty.clientId)
        : null;

      const caseChanged = targetCaseId !== originalCaseId;
      const explicitClientChange = updates["clientId"] !== undefined;
      if (caseChanged && !explicitClientChange) {
        targetClientId = primaryClientId;
        updates["clientId"] = targetClientId;
      } else if ((caseChanged || explicitClientChange) && targetCaseClientIds.size > 0 && targetClientId && !targetCaseClientIds.has(targetClientId)) {
        res.status(400).json({ message: "The selected client is not linked to the selected case" });
        return;
      } else if ((caseChanged || explicitClientChange) && targetCaseClientIds.size > 0 && !targetClientId) {
        res.status(400).json({ message: "Tasks linked to this case must retain a client linked to the case" });
        return;
      }
    }

    updates["updatedBy"] = req.userId;

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

    // Build human-readable audit diffs of modified fields
    const diffs: string[] = [];
    if (updates["title"] !== undefined && String(updates["title"]).trim() !== originalTask.title) {
      diffs.push(`Title changed from "${originalTask.title}" to "${updates["title"]}"`);
    }
    if (updates["description"] !== undefined && String(updates["description"]).trim() !== String(originalTask.description ?? "")) {
      diffs.push(`Description updated`);
    }
    if (updates["priority"] !== undefined && updates["priority"] !== originalTask.priority) {
      diffs.push(`Priority changed from "${originalTask.priority}" to "${updates["priority"]}"`);
    }
    if (updates["status"] !== undefined && updates["status"] !== originalTask.status) {
      diffs.push(`Status changed from "${originalTask.status}" to "${updates["status"]}"`);
    }
    if (updates["deadline"] !== undefined) {
      const oldD = originalTask.deadline ? new Date(originalTask.deadline).toLocaleDateString() : "None";
      const newD = updates["deadline"] ? new Date(updates["deadline"] as any).toLocaleDateString() : "None";
      if (oldD !== newD) {
        diffs.push(`Deadline changed from ${oldD} to ${newD}`);
      }
    }
    if (updates["assignedTo"] !== undefined && String(updates["assignedTo"] ?? "") !== String(originalTask.assignedTo ?? "")) {
      diffs.push(`Task reassigned`);
    }
    if (updates["callReminder"] !== undefined) {
      const cr = updates["callReminder"] as any;
      if (cr && cr.scheduledAt) {
        const newTimeStr = new Date(cr.scheduledAt).toLocaleString();
        const oldTimeStr = originalTask.callReminder?.scheduledAt ? new Date(originalTask.callReminder.scheduledAt).toLocaleString() : "None";
        if (newTimeStr !== oldTimeStr) {
          diffs.push(`Call reminder rescheduled to ${newTimeStr}`);
        }
        if (cr.completed !== Boolean(originalTask.callReminder?.completed)) {
          diffs.push(`Call marked as ${cr.completed ? "completed" : "pending"}`);
        }
      }
    }
    if (updates["checklist"] !== undefined) {
      diffs.push(`Checklist modified (${Array.isArray(updates["checklist"]) ? updates["checklist"].length : 0} items)`);
    }
    if (updates["category"] !== undefined && updates["category"] !== originalTask.category) {
      diffs.push(`Category changed to "${updates["category"]}"`);
    }
    if (updates["mainCategory"] !== undefined && updates["mainCategory"] !== originalTask.mainCategory) {
      diffs.push(`Main category changed to "${updates["mainCategory"]}"`);
    }
    if (updates["caseId"] !== undefined && String(updates["caseId"] ?? "") !== String(originalTask.caseId ?? "")) {
      diffs.push(`Linked case updated`);
    }
    if (updates["clientId"] !== undefined && String(updates["clientId"] ?? "") !== String(originalTask.clientId ?? "")) {
      diffs.push(`Linked client updated`);
    }

    // Auto-record remark if call was rescheduled due to no pickup
    if (req.body.didNotPickUp || req.body.isCallReschedule) {
      const rescheduleReason = req.body.rescheduleReason || "Client did not pick up call.";
      const newTimeStr = updates["callReminder"] && (updates["callReminder"] as any).scheduledAt
        ? new Date((updates["callReminder"] as any).scheduledAt).toLocaleString()
        : "a later time";
      const remarkText = `[Call Rescheduled] ${rescheduleReason} Rescheduled to ${newTimeStr}.`;
      
      const newRemark = {
        _id: new Types.ObjectId(),
        text: sanitizeInputText(remarkText, 2000),
        author: req.user?.name || "Staff Member",
        authorName: req.user?.name || "Staff Member",
        authorId: new Types.ObjectId(req.userId!),
        createdAt: new Date(),
      };
      if (!updates["$push"]) updates["$push"] = {};
      (updates["$push"] as any)["remarks"] = newRemark;
      diffs.push(`Call rescheduled: ${rescheduleReason}`);
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
          toUser: new Types.ObjectId(String(updates["assignedTo"])),
          assignedBy: new Types.ObjectId(req.userId!),
          action: originalTask.assignedTo ? "reassigned" : "assigned",
          note: `Reassigned by ${req.user?.name || "Staff"}`,
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

    // Handle changes requested / rejection when transitioning from pending_approval
    const isRejectionOrChangesRequested =
      originalTask?.status === "pending_approval" &&
      updates["status"] !== undefined &&
      updates["status"] !== "completed" &&
      updates["status"] !== "pending_approval";

    const rejectionReasonRaw =
      updates["rejectionReason"] ||
      updates["reason"] ||
      updates["decisionRemark"] ||
      updates["adminRemark"] ||
      updates["feedback"] ||
      req.body["rejectionReason"] ||
      req.body["reason"] ||
      req.body["decisionRemark"] ||
      req.body["adminRemark"] ||
      req.body["remark"] ||
      "";
    const cleanRejectionReason = typeof rejectionReasonRaw === "string" ? rejectionReasonRaw.trim() : "";

    if (isRejectionOrChangesRequested) {
      updates["rejectedAt"] = now;
      updates["rejectedBy"] = new Types.ObjectId(req.userId!);
      updates["rejectedByName"] = req.user?.name || "Administrator";
      updates["rejectionReason"] = cleanRejectionReason;
      updates["submittedForApprovalAt"] = null;

      if (cleanRejectionReason) {
        if (!updates["$push"]) updates["$push"] = {};
        (updates["$push"] as any)["remarks"] = {
          id: new Types.ObjectId().toString(),
          text: `⚠️ Changes Requested: "${cleanRejectionReason}"`,
          author: req.user?.name || "Administrator",
          authorName: req.user?.name || "Administrator",
          authorId: new Types.ObjectId(req.userId!),
          createdAt: now,
        };
      }
    }

    const pushOps = updates["$push"];
    delete updates["$push"];

    const updateDoc: any = { $set: updates };
    if (pushOps && Object.keys(pushOps).length > 0) {
      updateDoc.$push = pushOps;
    }

    let task;
    if (
      req.user!.role === "admin" &&
      originalTask?.status === "pending_approval" &&
      (updates["status"] === "completed" || updates["status"] === "in_progress")
    ) {
      task = await Task.findOneAndUpdate(
        { _id: req.params["id"], status: "pending_approval" },
        updateDoc,
        { new: true, runValidators: true }
      )
        .populate("assignedTo", "name email title")
        .populate("assignedBy", "name email title")
        .populate("createdBy", "name email title")
        .populate("updatedBy", "name email title")
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
          .populate("updatedBy", "name email title")
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
      task = await Task.findByIdAndUpdate(req.params["id"], updateDoc, {
        new: true,
        runValidators: true,
      })
        .populate("assignedTo", "name email title role avatar avatarUrl")
        .populate("assignedUsers", "name email title role avatar avatarUrl")
        .populate("assignedBy", "name email title")
        .populate("createdBy", "name email title")
        .populate("updatedBy", "name email title")
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

    // Synchronize reminders when task fields change. Task completion and
    // document approval are separate review decisions: never approve pending
    // documents as a side effect of changing a task's status or other fields.
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
          const rawAssignee = (task.assignedTo as any)?._id || task.assignedTo;
          const assignedList = (Array.isArray(rawAssignee) ? rawAssignee : (rawAssignee ? [rawAssignee] : [task.createdBy || req.userId])).filter(Boolean);
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
      const isReassignment = Boolean(oldAssignedTo);
      const clientName = resolveTaskClientName(task);
      const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";
      const assignerName = req.user?.name ?? "A colleague";

      await NotificationService.createNotification({
        userId: new Types.ObjectId(newAssignedTo),
        type: isReassignment ? "TASK_REASSIGNED" : "TASK_ASSIGNED",
        title: isUrgent
          ? (isReassignment ? "🚨 Urgent Task Reassigned to You" : "🚨 Urgent Task Assigned")
          : (isReassignment ? "Task Reassigned to You" : "Task Assigned"),
        message: `${assignerName} ${isReassignment ? "reassigned" : "assigned"} you task: "${task.title}" (Client: ${clientName}, Deadline: ${deadlineStr})`,
        relatedId: task._id,
        relatedModel: "Task",
        actorId: new Types.ObjectId(req.userId),
        metadata: {
          taskTitle: task.title,
          taskId: task._id.toString(),
          caseId: task.caseId ? String((task.caseId as any)?._id || task.caseId) : undefined,
          clientName,
          deadline: deadlineStr,
          priority: task.priority,
          action: isReassignment ? "reassigned" : "assigned",
          assignedBy: assignerName,
        },
      }, req.app.get("io"));

      if (oldAssignedTo && oldAssignedTo !== req.userId && oldAssignedTo !== newAssignedTo) {
        await NotificationService.createNotification({
          userId: new Types.ObjectId(oldAssignedTo),
          type: "TASK_REASSIGNED",
          title: "Task Reassigned to Colleague",
          message: `${assignerName} reassigned task "${task.title}" to ${(task.assignedTo as any)?.name || "a colleague"}.`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId),
          metadata: {
            taskTitle: task.title,
            taskId: task._id.toString(),
            action: "reassigned_away",
          },
        }, req.app.get("io"));
      }
    }

    // When task is marked completed or submitted for completion approval (pending_approval)
    if (
      updates["status"] !== undefined &&
      originalTask &&
      originalTask.status !== updates["status"] &&
      (updates["status"] === "completed" || updates["status"] === "pending_approval")
    ) {
      const clientName = resolveTaskClientName(task);
      const assigneeName = resolveTaskAssigneeName(task);
      const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";
      const completedBy = req.user?.name || "Staff Member";
      const isPendingApproval = updates["status"] === "pending_approval";

      // 1. Notify all Admins with full task details
      const admins = await User.find({ role: "admin" }).select("_id");
      for (const admin of admins) {
        await NotificationService.createNotification({
          userId: admin._id as Types.ObjectId,
          type: isPendingApproval ? "APPROVAL_REQUEST" : "TASK_ASSIGNED",
          title: isPendingApproval ? "Task Completion Approval" : "Task Completed",
          message: isPendingApproval
            ? `Staff ${completedBy} submitted task "${task.title}" for client "${clientName}" for verification. (Assigned to: ${assigneeName}, Deadline: ${deadlineStr})`
            : `Task "${task.title}" for client "${clientName}" has been completed by ${completedBy}. (Assigned to: ${assigneeName}, Deadline: ${deadlineStr})`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId),
          metadata: {
            taskTitle: task.title,
            taskId: task._id.toString(),
            clientName,
            assignedStaff: assigneeName,
            completedBy,
            deadline: deadlineStr,
            completedAt: new Date().toISOString(),
            action: isPendingApproval ? "pending_approval" : "completed",
          },
        }, req.app.get("io"));
      }

      // 2. Notify Assigned Person confirming completion with full task details
      const assignedTargetId = (task.assignedTo as any)?._id?.toString?.() ?? task.assignedTo?.toString();
      if (assignedTargetId && assignedTargetId !== "[object Object]") {
        await NotificationService.createNotification({
          userId: new Types.ObjectId(assignedTargetId),
          type: "TASK_ASSIGNED",
          title: isPendingApproval ? "Task Submitted for Completion Approval" : "Task Completed Confirmation",
          message: isPendingApproval
            ? `Task "${task.title}" for client "${clientName}" was marked done by ${completedBy} and submitted for admin verification. (Deadline: ${deadlineStr})`
            : `Task "${task.title}" for client "${clientName}" has been confirmed as completed by ${completedBy}. (Deadline: ${deadlineStr})`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId),
          metadata: {
            taskTitle: task.title,
            taskId: task._id.toString(),
            clientName,
            assignedStaff: assigneeName,
            completedBy,
            deadline: deadlineStr,
            completedAt: new Date().toISOString(),
            action: isPendingApproval ? "pending_approval" : "completed",
          },
        }, req.app.get("io"));
      }
    }

    // Notify assignee and creator if admin requested changes (moved from pending_approval back to in_progress/pending)
    if (isRejectionOrChangesRequested) {
      const assigneeTargetId = (task.assignedTo as any)?._id?.toString?.() ?? task.assignedTo?.toString();
      const creatorTargetId = (task.createdBy as any)?._id?.toString?.() ?? task.createdBy?.toString();
      const coAssigneeIds: string[] = ((task as any).assignedUsers || []).map(
        (u: any) => u?._id?.toString?.() ?? u?.toString?.() ?? ""
      ).filter(Boolean);
      const clientName = resolveTaskClientName(task);
      const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";
      const reviewerName = req.user?.name ?? "Administrator";
      const reasonText = cleanRejectionReason || (task as any).rejectionReason || "Please review and revise";

      await dispatchRejectionNotifications({
        taskId: task._id,
        taskTitle: task.title,
        clientName,
        deadlineStr,
        reviewerName,
        reviewerId: req.userId,
        reasonText,
        recipientIds: [assigneeTargetId, creatorTargetId, ...coAssigneeIds],
        io: req.app.get("io"),
      });
    }


    if (diffs.length > 0 || (updates["status"] !== undefined && updates["status"] !== originalTask.status)) {
      const auditDetails = diffs.length > 0 ? diffs.join("; ") : `Status updated to ${updates["status"]}`;
      const humanMessage = `${req.user?.name || "An employee"} updated task "${task.title}": ${auditDetails}`;
      await recordTaskAuditAndAdminNotification(req, {
        task,
        action: updates["status"] === "completed" ? "approve" : "update",
        mutationType: updates["status"] !== undefined ? "status_change" : "details_update",
        details: auditDetails,
        humanMessage,
        diffs,
        previousValues: {
          title: originalTask.title,
          status: originalTask.status,
          priority: originalTask.priority,
          deadline: originalTask.deadline,
          assignedTo: originalTask.assignedTo,
        },
        newValues: {
          title: task.title,
          status: task.status,
          priority: task.priority,
          deadline: task.deadline,
          assignedTo: task.assignedTo,
        },
        io: req.app.get("io"),
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", taskRealtimePayload(task));
    }

    const taskObj: any = task.toObject ? task.toObject() : task;
    const assignedUsers = Array.isArray(taskObj.assignedUsers) && taskObj.assignedUsers.length > 0
      ? taskObj.assignedUsers
      : (taskObj.assignedTo ? [taskObj.assignedTo] : []);
    taskObj.assignedUsers = assignedUsers;
    if (!taskObj.assignedTo && taskObj.assignedUsers.length > 0) {
      taskObj.assignedTo = taskObj.assignedUsers[0];
    }

    res.json({ task: taskObj });
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

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: `Added checklist item: "${text.trim().slice(0, 100)}"`,
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
      io.emit("task:updated", taskRealtimePayload(populated));
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

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: "Deleted checklist item",
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
      io.emit("task:updated", taskRealtimePayload(populated));
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
    const { done, text, subItems, subItemId, subDone, subText, itemText } = req.body;
    const taskId = String(req.params["taskId"] || "");
    const itemId = String(req.params["itemId"] || "");
    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    let item = task.checklist.find(
      (c) => (c as any)._id?.toString() === itemId || c.id === itemId,
    );
    if (!item && /^\d+$/.test(itemId)) {
      const idx = parseInt(itemId, 10);
      if (idx >= 0 && idx < task.checklist.length) {
        item = task.checklist[idx];
      }
    }
    if (!item && itemText) {
      item = task.checklist.find((c) => c.text === itemText);
    }
    if (!item && text) {
      item = task.checklist.find((c) => c.text === text);
    }
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
        ...(s._id ? { _id: s._id } : {}),
        id: s.id || (s._id ? String(s._id) : undefined),
        text: sanitizeInputText(s.text, 500),
        done: Boolean(s.done),
      }));
    }

    // Direct sub-item update inside item payload if provided
    if (subItemId && Array.isArray(item.subItems)) {
      let sub = item.subItems.find((s) => (s as any)._id?.toString() === subItemId || s.id === subItemId);
      if (!sub && /^\d+$/.test(subItemId)) {
        const sIdx = parseInt(subItemId, 10);
        if (sIdx >= 0 && sIdx < item.subItems.length) {
          sub = item.subItems[sIdx];
        }
      }
      if (!sub && subText) {
        sub = item.subItems.find((s) => s.text === subText);
      }
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
      }

      const clientName = resolveTaskClientName(task);
      const assigneeName = resolveTaskAssigneeName(task);
      const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";
      const completedBy = req.user?.name ?? "Staff Member";
      const isPendingApproval = task.status === "pending_approval";

      // 1. Notify all Admins with full task details
      const admins = await User.find({ role: "admin" }).select("_id");
      for (const admin of admins) {
        await NotificationService.createNotification(
          {
            userId: admin._id as Types.ObjectId,
            type: isPendingApproval ? "TASK_APPROVAL_REQUIRED" : "TASK_ASSIGNED",
            title: isPendingApproval ? "Task Checklist Completed (Approval Required)" : "Task Completed",
            message: isPendingApproval
              ? `Staff ${completedBy} completed all checklist items for "${task.title}" (Client: "${clientName}"). Verification required. (Assigned to: ${assigneeName}, Deadline: ${deadlineStr})`
              : `Task "${task.title}" (Client: "${clientName}") has been completed by ${completedBy}. (Assigned to: ${assigneeName}, Deadline: ${deadlineStr})`,
            relatedId: task._id as any,
            relatedModel: "Task",
            actorId: new Types.ObjectId(req.userId),
            metadata: {
              taskTitle: task.title,
              taskId: task._id.toString(),
              clientName,
              assignedStaff: assigneeName,
              completedBy,
              deadline: deadlineStr,
              completedAt: now.toISOString(),
              action: isPendingApproval ? "pending_approval" : "completed",
            },
          },
          req.app.get("io")
        );
      }

      // 2. Notify Assigned Person confirming completion
      const assignedTargetId = (task.assignedTo as any)?._id?.toString?.() ?? task.assignedTo?.toString();
      if (assignedTargetId && assignedTargetId !== "[object Object]") {
        await NotificationService.createNotification(
          {
            userId: new Types.ObjectId(assignedTargetId),
            type: "TASK_ASSIGNED",
            title: isPendingApproval ? "Checklist Completed (Submitted for Approval)" : "Task Completed Confirmation",
            message: isPendingApproval
              ? `All checklist items for "${task.title}" (Client: "${clientName}") were completed by ${completedBy} and submitted for admin approval.`
              : `Task "${task.title}" (Client: "${clientName}") has been confirmed as completed by ${completedBy}.`,
            relatedId: task._id as any,
            relatedModel: "Task",
            actorId: new Types.ObjectId(req.userId),
            metadata: {
              taskTitle: task.title,
              taskId: task._id.toString(),
              clientName,
              assignedStaff: assigneeName,
              completedBy,
              deadline: deadlineStr,
              completedAt: now.toISOString(),
              action: isPendingApproval ? "pending_approval" : "completed",
            },
          },
          req.app.get("io")
        );
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
      io.emit("task:updated", taskRealtimePayload(populated));
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

    const taskId = String(req.params["taskId"] || "");
    const itemId = String(req.params["itemId"] || "");
    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    let item = task.checklist.find(
      (c) => (c as any)._id?.toString() === itemId || c.id === itemId
    );
    if (!item && /^\d+$/.test(itemId)) {
      const idx = parseInt(itemId, 10);
      if (idx >= 0 && idx < task.checklist.length) {
        item = task.checklist[idx];
      }
    }
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
      io.emit("task:updated", taskRealtimePayload(populated));
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
    const taskId = String(req.params["taskId"] || "");
    const itemId = String(req.params["itemId"] || "");
    const subId = String(req.params["subId"] || "");
    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    let item = task.checklist.find(
      (c) => (c as any)._id?.toString() === itemId || c.id === itemId
    );
    if (!item && /^\d+$/.test(itemId)) {
      const idx = parseInt(itemId, 10);
      if (idx >= 0 && idx < task.checklist.length) {
        item = task.checklist[idx];
      }
    }
    if (!item) {
      res.status(404).json({ message: "Checklist item not found" });
      return;
    }

    if (Array.isArray(item.subItems)) {
      item.subItems = item.subItems.filter(
        (s) => (s as any)._id?.toString() !== subId && s.id !== subId
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
      io.emit("task:updated", taskRealtimePayload(populated));
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
      io.emit("task:updated", taskRealtimePayload(populated));
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
    if (req.user?.role !== "admin") {
      res.status(403).json({ message: "Only administrators can reject tasks" });
      return;
    }

    const { reason, decisionRemark } = req.body;
    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const rawReason = reason || decisionRemark;
    const reasonClean = typeof rawReason === "string" ? rawReason.trim() : "";
    if (!reasonClean) {
      res.status(400).json({ message: "A reason or remark is required when rejecting a task", field: "reason" });
      return;
    }

    const now = new Date();
    task.status = "in_progress";
    task.completedAt = null;
    task.submittedForApprovalAt = null;
    task.approvedAt = null;
    task.rejectedAt = now;
    task.rejectedBy = new Types.ObjectId(req.userId!);
    task.rejectedByName = req.user?.name || "Administrator";
    task.rejectionReason = reasonClean;
    if (reasonClean) {
      task.remarks.push({
        id: new Types.ObjectId().toString(),
        text: `⚠️ Changes Requested: "${reasonClean}"`,
        author: req.user?.name || "Administrator",
        authorName: req.user?.name || "Administrator",
        authorId: new Types.ObjectId(req.userId!),
        createdAt: now,
      });
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
      io.emit("task:updated", taskRealtimePayload(populated));
    }

    // Notify assignee
    const assigneeId = (task.assignedTo as any)?._id?.toString() ?? task.assignedTo?.toString();
    const creatorId = (task.createdBy as any)?._id?.toString() ?? task.createdBy?.toString();
    const clientName = resolveTaskClientName(task);
    const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";
    const reviewerName = req.user?.name ?? "Administrator";
    const reasonText = reasonClean || "Please review and revise";

    await dispatchRejectionNotifications({
      taskId: task._id,
      taskTitle: task.title,
      clientName,
      deadlineStr,
      reviewerName,
      reviewerId: req.userId,
      reasonText,
      recipientIds: [assigneeId, creatorId],
      io,
    });

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

    const effectiveTask = populated || task;

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", taskRealtimePayload(effectiveTask));
    }

    if (String(toUserId) !== String(req.userId)) {
      const isUrgent = effectiveTask.priority === "High";
      const clientName = resolveTaskClientName(effectiveTask);
      const deadlineStr = effectiveTask.deadline ? new Date(effectiveTask.deadline).toLocaleDateString() : "No deadline";
      const senderName = req.user?.name ?? "A colleague";
      const detailsMsg = `${senderName} forwarded task "${effectiveTask.title}" to you (Client: ${clientName}, Deadline: ${deadlineStr})${note ? `. Note: "${note}"` : ""}`;

      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(toUserId),
          type: "TASK_FORWARDED",
          title: isUrgent ? "🚨 Urgent Task Forwarded to You" : "Task Forwarded to You",
          message: detailsMsg,
          relatedId: effectiveTask._id as any,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: effectiveTask._id.toString(),
            taskTitle: effectiveTask.title,
            caseId: effectiveTask.caseId ? String((effectiveTask.caseId as any)?._id || effectiveTask.caseId) : undefined,
            clientName,
            deadline: deadlineStr,
            priority: effectiveTask.priority,
            note: note || "",
            action: "forwarded",
            senderName,
          },
        },
        io
      );
    }

    await recordTaskAuditAndAdminNotification(req, {
      task: effectiveTask,
      action: "update",
      mutationType: "forwarded",
      details: `Task forwarded to ${targetUser.name}`,
      humanMessage: `${req.user?.name || "An employee"} forwarded task "${effectiveTask.title}" to ${targetUser.name}${note ? ` (Note: ${note})` : ""}`,
      newValues: { assignedTo: toUserId },
      io,
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
    task.updatedBy = new Types.ObjectId(req.userId!);

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
      .populate("updatedBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .populate("assignmentHistory.fromUser", "name email")
      .populate("assignmentHistory.toUser", "name email")
      .populate("assignmentHistory.assignedBy", "name email");

    const effectiveTask = populated || task;

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", taskRealtimePayload(effectiveTask));
    }

    if (String(toUserId) !== String(req.userId)) {
      const isUrgent = effectiveTask.priority === "High";
      const clientName = resolveTaskClientName(effectiveTask);
      const deadlineStr = effectiveTask.deadline ? new Date(effectiveTask.deadline).toLocaleDateString() : "No deadline";
      const assignerName = req.user?.name ?? "A colleague";
      const detailsMsg = `${assignerName} reassigned task "${effectiveTask.title}" to you (Client: ${clientName}, Deadline: ${deadlineStr})${note ? `. Note: "${note}"` : ""}`;

      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(toUserId),
          type: "TASK_REASSIGNED",
          title: isUrgent ? "🚨 Urgent Task Reassigned to You" : "Task Reassigned to You",
          message: detailsMsg,
          relatedId: effectiveTask._id as any,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: effectiveTask._id.toString(),
            taskTitle: effectiveTask.title,
            caseId: effectiveTask.caseId ? String((effectiveTask.caseId as any)?._id || effectiveTask.caseId) : undefined,
            clientName,
            deadline: deadlineStr,
            priority: effectiveTask.priority,
            note: note || "",
            action: "reassigned",
            assignedBy: assignerName,
          },
        },
        io
      );
    }

    if (fromUser && String(fromUser) !== String(req.userId) && String(fromUser) !== String(toUserId)) {
      const assignerName = req.user?.name ?? "A colleague";
      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(fromUser.toString()),
          type: "TASK_REASSIGNED",
          title: "Task Reassigned to Colleague",
          message: `${assignerName} reassigned task "${effectiveTask.title}" to ${targetUser.name}.`,
          relatedId: effectiveTask._id as any,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: effectiveTask._id.toString(),
            taskTitle: effectiveTask.title,
            caseId: effectiveTask.caseId ? String((effectiveTask.caseId as any)?._id || effectiveTask.caseId) : undefined,
            action: "reassigned_away",
            newAssignee: targetUser.name,
          },
        },
        io
      );
    }

    await recordTaskAuditAndAdminNotification(req, {
      task: effectiveTask,
      action: "update",
      mutationType: "reassigned",
      details: `Task reassigned from ${fromUser ? "previous assignee" : "unassigned"} to ${targetUser.name}`,
      humanMessage: `${req.user?.name || "An employee"} reassigned task "${effectiveTask.title}" from ${fromUser ? "previous assignee" : "unassigned"} to ${targetUser.name}${note ? ` (Note: ${note})` : ""}`,
      previousValues: { assignedTo: fromUser },
      newValues: { assignedTo: toUserId },
      io,
    });

    res.json({ message: "Task reassigned successfully", task: populated });
  } catch (err: any) {
    console.error("[tasks] Reassign error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/request-assignment — request assignment/reassignment approval
// ---------------------------------------------------------------------------

router.post("/:id/request-assignment", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const { targetUserId, reason } = req.body;
    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ message: "Valid target user ID (targetUserId) is required", field: "targetUserId" });
      return;
    }
    const cleanReason = typeof reason === "string" ? reason.trim() : "";
    if (!cleanReason) {
      res.status(400).json({ message: "Reason for reassignment request is required", field: "reason" });
      return;
    }

    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const targetUser = await User.findById(targetUserId).select("name email isActive").lean();
    if (!targetUser) {
      res.status(404).json({ message: "Target employee not found" });
      return;
    }

    const approvalRequest = await ApprovalRequest.create({
      type: "task_reassign",
      entityType: "Task",
      entityId: task._id,
      requesterId: new Types.ObjectId(req.userId!),
      targetUserId: new Types.ObjectId(targetUserId),
      reason: cleanReason,
      status: "pending",
    });

    task.pendingReassignment = true;
    task.updatedBy = new Types.ObjectId(req.userId!);
    await task.save();

    // Notify admins
    const admins = await User.find({ role: "admin" }).select("_id");
    const io = req.app.get("io");
    for (const admin of admins) {
      await NotificationService.createNotification(
        {
          userId: admin._id,
          type: "APPROVAL_REQUESTED",
          title: "Task Reassignment Request",
          message: `${req.user?.name ?? "An employee"} requested reassignment of "${task.title}" to ${targetUser.name}: ${cleanReason}`,
          relatedId: approvalRequest._id as any,
          relatedModel: "ApprovalRequest",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: task._id.toString(),
            targetUserId: targetUserId.toString(),
            approvalRequestId: approvalRequest._id.toString(),
          },
        },
        io
      );
    }

    if (io) {
      io.emit("task:updated", taskRealtimePayload(task));
    }

    res.status(201).json({
      message: "Reassignment request submitted for administrator approval",
      approvalRequest,
      task,
    });
  } catch (err: any) {
    console.error("[tasks] Request assignment error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/request-deletion — request deletion approval
// ---------------------------------------------------------------------------

router.post("/:id/request-deletion", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const cleanReason = typeof reason === "string" ? reason.trim() : "";
    if (!cleanReason) {
      res.status(400).json({ message: "Reason for deletion request is required", field: "reason" });
      return;
    }

    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (task.isDeleted) {
      res.status(400).json({ message: "This task has already been deleted." });
      return;
    }

    if (task.pendingDeletion) {
      const existing = await ApprovalRequest.findOne({
        entityId: task._id,
        type: "task_delete",
        status: "pending",
      });
      if (existing) {
        res.status(409).json({
          message: "A deletion request is already pending administrator approval for this task.",
          code: "DELETION_ALREADY_PENDING",
          approvalRequest: existing,
        });
        return;
      }
    }

    const approvalRequest = await ApprovalRequest.create({
      type: "task_delete",
      entityType: "Task",
      entityId: task._id,
      requesterId: new Types.ObjectId(req.userId!),
      reason: cleanReason,
      status: "pending",
    });

    task.pendingDeletion = true;
    task.deletionReason = cleanReason;
    task.updatedBy = new Types.ObjectId(req.userId!);
    await task.save();

    // Notify admins
    const admins = await User.find({ role: "admin" }).select("_id");
    const io = req.app.get("io");
    for (const admin of admins) {
      await NotificationService.createNotification(
        {
          userId: admin._id,
          type: "APPROVAL_REQUESTED",
          title: "Task Deletion Request",
          message: `${req.user?.name ?? "An employee"} requested deletion of task "${task.title}": ${cleanReason}`,
          relatedId: approvalRequest._id as any,
          relatedModel: "ApprovalRequest",
          actorId: new Types.ObjectId(req.userId!),
          metadata: {
            taskId: task._id.toString(),
            approvalRequestId: approvalRequest._id.toString(),
          },
        },
        io
      );
    }

    if (io) {
      io.emit("task:updated", taskRealtimePayload(task));
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: `Requested deletion approval: "${cleanReason.slice(0, 100)}"`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({
      message: "Deletion request submitted for administrator approval",
      approvalRequest,
      task,
    });
  } catch (err: any) {
    console.error("[tasks] Request deletion error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/remarks — add remark to task
// ---------------------------------------------------------------------------

router.post("/:id/remarks", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const cleanText = typeof text === "string" ? text.trim() : "";
    if (!cleanText) {
      res.status(400).json({ message: "Remark text is required", field: "text" });
      return;
    }

    const task = await Task.findById(req.params["id"]);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const remark = {
      _id: new Types.ObjectId(),
      text: cleanText,
      author: req.user?.name || "Team Member",
      authorName: req.user?.name || "Team Member",
      authorId: new Types.ObjectId(req.userId!),
      createdAt: new Date(),
    };

    if (!Array.isArray(task.remarks)) {
      task.remarks = [];
    }
    task.remarks.push(remark as any);
    task.updatedBy = new Types.ObjectId(req.userId!);
    await task.save();

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: `Added note: "${cleanText.slice(0, 100)}${cleanText.length > 100 ? "…" : ""}"`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email title")
      .populate("assignedBy", "name email title")
      .populate("createdBy", "name email title")
      .populate("updatedBy", "name email title")
      .populate("caseId", "title number")
      .populate("clientId", "name phone");

    const io = req.app.get("io");
    if (io) {
      io.emit("task:updated", taskRealtimePayload(populated));
    }

    // Notify assignee if someone else added a remark/note
    const assigneeId = (task.assignedTo as any)?._id?.toString() || task.assignedTo?.toString();
    if (assigneeId && assigneeId !== req.userId && io) {
      try {
        await NotificationService.createNotification(
          {
            userId: new Types.ObjectId(assigneeId),
            type: "COMMENT_MENTION",
            title: "New Note on Task",
            message: `${req.user?.name ?? "Staff"} added a note on "${task.title}": "${cleanText.slice(0, 100)}${cleanText.length > 100 ? "…" : ""}"`,
            relatedId: task._id as any,
            relatedModel: "Task",
            actorId: new Types.ObjectId(req.userId!),
            metadata: {
              taskId: task._id.toString(),
              taskTitle: task.title,
              action: "note_added",
            },
          },
          io
        );
      } catch (notifErr) {
        console.error("[tasks] Failed to send notification for task remark:", notifErr);
      }
    }

    res.status(201).json({ message: "Remark added successfully", remark, task: populated });
  } catch (err: any) {
    console.error("[tasks] Add remark error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("task"), async (req: Request, res: Response) => {
  try {
    const taskId = String(req.params["id"] || "");
    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (req.user?.role !== "admin") {
      res.status(403).json({
        message: "Non-admin users cannot delete tasks directly. Please submit a deletion request for administrator approval.",
        code: "DELETION_APPROVAL_REQUIRED",
      });
      return;
    }

    task.isDeleted = true;
    task.deletedAt = new Date();
    task.deletedBy = new Types.ObjectId(req.userId!);
    task.pendingDeletion = false;
    task.updatedBy = new Types.ObjectId(req.userId!);
    await task.save();

    // Clean up associated reminders atomically
    try {
      await deleteCallReminders("task", task._id);
    } catch (remErr) {
      console.error("[tasks] Failed to delete synchronized reminders on task delete:", remErr);
    }

    // Clean up any associated notifications
    try {
      const io = req.app.get("io");
      await NotificationService.deleteByRelatedId(task._id, io);
    } catch (notifErr) {
      console.error("[tasks] Failed to delete notifications on task delete:", notifErr);
    }

    // Emit real-time task:deleted event to all connected users
    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("task:deleted", {
          taskId: task._id.toString(),
          assignedTo: task.assignedTo ? task.assignedTo.toString() : null,
          createdBy: task.createdBy ? task.createdBy.toString() : null,
        });
      }
    } catch (ioErr) {
      console.error("[tasks] Failed to emit task:deleted event:", ioErr);
    }

    try {
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
    } catch (auditErr) {
      console.error("[tasks] Failed to create audit log on task delete:", auditErr);
    }

    res.json({ message: "Task deleted successfully", taskId: task._id });
  } catch (err: any) {
    console.error("[tasks] Delete error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/reminders/dismiss and /:id/dismiss-reminder
// ---------------------------------------------------------------------------

async function handleDismissReminder(req: Request, res: Response) {
  try {
    const taskId = String(req.params["id"] || req.params["taskId"] || "");
    if (!taskId || !Types.ObjectId.isValid(taskId)) {
      res.status(400).json({ message: "Invalid task ID" });
      return;
    }

    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const slot = typeof req.body.slot === "number" ? req.body.slot : null;

    const state = await TaskReminderState.findOneAndUpdate(
      { taskId: task._id, userId: new Types.ObjectId(req.userId!) },
      {
        $set: {
          dismissed: true,
          dismissedAt: new Date(),
          dismissedSlot: slot,
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Reminder dismissed",
      dismissedAt: state.dismissedAt,
      slot: state.dismissedSlot,
    });
  } catch (err: any) {
    console.error("[tasks] Dismiss reminder error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
}

router.post("/:id/reminders/dismiss", requireResourceAccess("task"), handleDismissReminder);
router.post("/:id/dismiss-reminder", requireResourceAccess("task"), handleDismissReminder);

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/reminders/snooze and /:id/snooze-reminder
// ---------------------------------------------------------------------------

async function handleSnoozeReminder(req: Request, res: Response) {
  try {
    const taskId = String(req.params["id"] || req.params["taskId"] || "");
    if (!taskId || !Types.ObjectId.isValid(taskId)) {
      res.status(400).json({ message: "Invalid task ID" });
      return;
    }

    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const validation = validateSnoozePayload(req.body);
    if (!validation.valid) {
      res.status(400).json({
        message: validation.error,
        field: validation.field,
      });
      return;
    }

    const { targetUntil, durationHours } = validation;

    const state = await TaskReminderState.findOneAndUpdate(
      { taskId: task._id, userId: new Types.ObjectId(req.userId!) },
      {
        $set: {
          snoozedUntil: targetUntil,
          snoozeDurationHours: durationHours,
          dismissed: false,
          dismissedSlot: null,
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Reminder snoozed until ${targetUntil!.toISOString()}`,
      snoozedUntil: targetUntil!.toISOString(),
      durationHours,
    });
  } catch (err: any) {
    console.error("[tasks] Snooze reminder error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
}

router.post("/:id/reminders/snooze", requireResourceAccess("task"), handleSnoozeReminder);
router.post("/:id/snooze-reminder", requireResourceAccess("task"), handleSnoozeReminder);

export default router;