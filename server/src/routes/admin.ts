import fs from "node:fs";
import fsp from "node:fs/promises";
import { Router, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";
import { Client } from "../models/Client.js";
import { Case } from "../models/Case.js";
import { Task } from "../models/Task.js";
import { DocumentModel } from "../models/Document.js";
import { FileIntegrity, computeFileHash, type FileIntegrityStatus } from "../models/FileIntegrity.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { AppSettings } from "../models/AppSettings.js";
import { testConnection, getLocalPath } from "../services/webdav.js";
import { requireAuth, requireAdmin, requireAdminOrPermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ===========================================================================
// ADMIN ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs — paginated audit trail (admin or auditLogs perm)
// ---------------------------------------------------------------------------

router.get("/audit-logs", requireAdminOrPermission("auditLogs"), async (req: Request, res: Response) => {
  try {
    const {
      userId,
      action,
      resource,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (userId) filter["userId"] = userId;
    if (action) filter["action"] = action;
    if (resource) filter["resource"] = resource;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error("[admin] Audit logs error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/employees — list all employees (all authenticated staff)
// ---------------------------------------------------------------------------

router.get("/employees", async (req: Request, res: Response) => {
  try {
    const { status, role } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};

    if (status) filter["status"] = status;
    if (role) filter["role"] = role;

    const employees = await User.find(filter)
      .select("-passwordHash")
      .sort({ name: 1 })
      .lean();

    res.json({ employees, total: employees.length });
  } catch (err) {
    console.error("[admin] Employees list error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/employees — create employee (admin or employees perm)
// ---------------------------------------------------------------------------

router.post("/employees", requireAdminOrPermission("employees"), async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      title = "",
      phone = "",
    } = req.body;

    // ---------------------------------------------------------------------------
    // PRIVILEGE ESCALATION GUARD
    // Only actual admins (role === "admin") may create admin accounts or grant
    // sensitive permissions. An employee-manager (permissions.employees = true)
    // can only create normal employees with standard permissions.
    // ---------------------------------------------------------------------------
    const isActualAdmin = req.user?.role === "admin";

    // Determine role — non-admins may never create admin accounts
    let role: string = req.body.role ?? "junior_advocate";
    if (role === "admin" && !isActualAdmin) {
      res.status(403).json({ message: "Only admins can create admin accounts" });
      return;
    }

    // Generate a cryptographically secure temporary password.
    const tempPassword = randomBytes(16).toString("hex");
    const password: string = typeof req.body.password === "string" && req.body.password.length > 0
      ? req.body.password
      : tempPassword;

    if (!name || !email) {
      res.status(400).json({ message: "Name and email are required" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      res.status(400).json({ field: "email", message: "Invalid email address format" });
      return;
    }

    if (phone && typeof phone === "string" && phone.trim()) {
      const cleanPhone = phone.trim().replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        res.status(400).json({ field: "phone", message: "Phone number must be a valid 10-digit number" });
        return;
      }
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ message: "An employee with this email already exists" });
      return;
    }

    // Permissions: admins get the full set for admin role, standard set for others.
    // Non-admin managers always get the standard (non-privileged) permission set.
    const isAdminRole = role === "admin";
    const permissions = isAdminRole
      ? {
        dashboard: true, clients: true, cases: true, tasks: true, documents: true,
        calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      }
      : {
        dashboard: true, clients: true, cases: true, tasks: true, documents: true,
        calendar: true, chat: true, reports: true,
        employees: false, approvals: false, auditLogs: false, settings: false,
      };

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      role,
      title,
      phone,
      permissions,
    });

    try {
      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: "create",
        resource: "user",
        resourceId: user._id.toString(),
        resourceName: user.name,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (logErr) {
      console.error("[admin] Create employee audit log error:", logErr);
    }

    // If the admin didn't supply a password, return the generated temp password
    // so they can communicate it to the new employee out-of-band.
    const wasAutoGenerated = typeof req.body.password !== "string" || req.body.password.length === 0;
    res.status(201).json({
      user: user.toJSON(),
      ...(wasAutoGenerated ? { tempPassword, mustChangePassword: true } : {}),
    });
  } catch (err) {
    console.error("[admin] Create employee error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/employees/:id — update employee (admin or employees perm)
// ---------------------------------------------------------------------------

router.patch("/employees/:id", requireAdminOrPermission("employees"), async (req: Request, res: Response) => {
  try {
    const targetId = req.params["id"];
    const isActualAdmin = req.user?.role === "admin";

    // ---------------------------------------------------------------------------
    // PRIVILEGE ESCALATION GUARDS
    // ---------------------------------------------------------------------------

    // Guard 1: Nobody can modify their own role or permissions through this endpoint.
    if (targetId === req.userId && (req.body["role"] !== undefined || req.body["permissions"] !== undefined)) {
      res.status(403).json({ message: "You cannot change your own role or permissions" });
      return;
    }

    // Guard 2: Non-admin managers cannot modify existing admin accounts.
    if (!isActualAdmin) {
      const target = await User.findById(targetId).select("role").lean();
      if (target?.role === "admin") {
        res.status(403).json({ message: "Only admins can modify admin accounts" });
        return;
      }
    }

    // Guard 3: Only actual admins can change role or permissions.
    // Non-admin employee managers are restricted to safe profile fields.
    const adminOnlyFields = ["role", "permissions"];
    if (!isActualAdmin) {
      for (const field of adminOnlyFields) {
        if (req.body[field] !== undefined) {
          res.status(403).json({ message: `Only admins can change ${field}` });
          return;
        }
      }
    }

    // Guard 4: Admins cannot demote or modify other admins' sensitive fields
    // without additional checks (prevent lateral admin takeover).
    // If promoting someone to admin, verify the requester is admin.
    if (req.body["role"] === "admin" && !isActualAdmin) {
      res.status(403).json({ message: "Only admins can grant admin role" });
      return;
    }

    // Build safe update — admins get the full allowed set, non-admins get restricted set.
    const allowedForAll = ["name", "title", "status", "phone"];
    const allowedForAdmin = [...allowedForAll, "email", "role", "permissions"];
    const allowedFields = isActualAdmin ? allowedForAdmin : allowedForAll;

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates["email"]) {
      updates["email"] = String(updates["email"]).toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates["email"] as string)) {
        res.status(400).json({ field: "email", message: "Invalid email address format" });
        return;
      }
    }
    if (updates["phone"] && typeof updates["phone"] === "string" && (updates["phone"] as string).trim()) {
      const cleanPhone = (updates["phone"] as string).trim().replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        res.status(400).json({ field: "phone", message: "Phone number must be a valid 10-digit number" });
        return;
      }
    }
    if (updates["name"]) {
      updates["name"] = String(updates["name"]).trim();
    }

    const user = await User.findByIdAndUpdate(targetId, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!user) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    try {
      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: "update",
        resource: "user",
        resourceId: user._id.toString(),
        resourceName: user.name,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (logErr) {
      console.error("[admin] Update employee audit log error:", logErr);
    }

    res.json({ user });
  } catch (err: any) {
    console.error("[admin] Update employee error:", err);
    if (err.code === 11000) {
      res.status(409).json({ message: "An account with this email already exists" });
      return;
    }
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/employees/:id — remove employee (admin or employees perm)
// ---------------------------------------------------------------------------

router.delete("/employees/:id", requireAdminOrPermission("employees"), async (req: Request, res: Response) => {
  try {
    const targetId = req.params["id"];
    const isActualAdmin = req.user?.role === "admin";

    if (targetId === req.userId) {
      res.status(400).json({ message: "You cannot delete your own account" });
      return;
    }

    // Non-admin managers cannot delete admin accounts
    if (!isActualAdmin) {
      const target = await User.findById(targetId).select("role").lean();
      if (target?.role === "admin") {
        res.status(403).json({ message: "Only admins can delete admin accounts" });
        return;
      }
    }

    // Step 1: Revoke all active sessions for this user BEFORE deletion
    // This prevents the user from using any existing tokens.
    await Session.updateMany(
      { userId: targetId, isRevoked: false },
      { $set: { isRevoked: true } },
    );

    // Step 2: Disconnect all active sockets for this user
    const io = req.app.get("io");
    if (io) {
      // Emit force-logout to all sockets in this user's room
      io.to(`user:${targetId}`).emit("force:logout", {
        reason: "account_deleted",
      });
      // Disconnect the sockets in their room
      const sockets = await io.in(`user:${targetId}`).fetchSockets();
      for (const socket of sockets) {
        socket.disconnect(true);
      }
    }

    // Step 3: Physical deletion (for legal systems, prefer deactivation instead,
    // but this endpoint performs a hard delete as currently designed)
    const user = await User.findByIdAndDelete(targetId);
    if (!user) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    try {
      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: "delete",
        resource: "user",
        resourceId: user._id.toString(),
        resourceName: user.name,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (logErr) {
      console.error("[admin] Delete employee audit log error:", logErr);
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (err: any) {
    console.error("[admin] Delete employee error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});


// ---------------------------------------------------------------------------
// GET /api/admin/approvals — pending items needing approval (admin or approvals perm)
// ---------------------------------------------------------------------------

router.get("/approvals", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const [pendingDocs, pendingAccess, pendingTasks] = await Promise.all([
      DocumentModel.find({ state: "Pending" }).sort({ createdAt: -1 }).lean(),
      DocumentModel.find({ "accessRequests.status": "pending" })
        .select("name accessRequests")
        .lean(),
      Task.find({ status: "pending_approval" })
        .populate("assignedTo", "name email")
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const approvals = [
      ...pendingDocs.map((d) => ({
        _id: d._id,
        kind: "Document Upload",
        title: d.name,
        context: `Uploaded for review`,
        when: d.createdAt,
      })),
      ...pendingAccess.flatMap((d) =>
        d.accessRequests
          .filter((ar) => ar.status === "pending")
          .map((ar) => ({
            _id: `${d._id}_access_${ar.createdAt.getTime()}`,
            kind: "Access Request",
            title: d.name,
            context: ar.reason,
            when: ar.createdAt,
          })),
      ),
      ...pendingTasks.map((t) => {
        const assignedUser = t.assignedTo as any;
        const totalItems = t.checklist?.length ?? 0;
        const doneItems = t.checklist?.filter((c: any) => c.done).length ?? 0;
        const checklistSummary = totalItems > 0 ? ` · ${doneItems}/${totalItems} subtasks completed` : "";
        return {
          _id: `task_${t._id.toString()}`,
          kind: "Task Completion",
          title: t.title,
          context: `Submitted by ${assignedUser?.name ?? "Assignee"}${checklistSummary}`,
          when: (t as any).updatedAt ?? (t as any).createdAt,
        };
      }),
    ];

    res.json({ approvals, total: approvals.length });
  } catch (err) {
    console.error("[admin] Approvals error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===========================================================================
// STORAGE ROUTES (Synology NAS WebDAV configuration)
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/storage — current Synology config (admin or settings perm; password masked)
// ---------------------------------------------------------------------------

router.get("/storage", requireAdminOrPermission("settings"), async (_req: Request, res: Response) => {
  try {
    const config = await AppSettings.getSynologyConfig();
    res.json({
      configured: Boolean(config?.url),
      url: config?.url ?? "",
      username: config?.username ?? "",
      rootPath: config?.rootPath ?? "/LegalOS",
      passwordSet: Boolean(config?.passwordEncrypted),
    });
  } catch (err) {
    console.error("[admin] Storage config error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/storage — save Synology config (admin or settings perm)
// ---------------------------------------------------------------------------

router.patch("/storage", requireAdminOrPermission("settings"), async (req: Request, res: Response) => {
  try {
    const { url, username, password, rootPath } = req.body ?? {};

    if (!url || typeof url !== "string" || !url.trim()) {
      res.status(400).json({ message: "WebDAV URL is required" });
      return;
    }

    await AppSettings.setSynologyConfig(
      {
        url: url.trim(),
        username: typeof username === "string" ? username.trim() : "",
        password: typeof password === "string" ? password : "",
        rootPath: typeof rootPath === "string" && rootPath.trim() ? rootPath.trim() : "/LegalOS",
      },
      req.userId!,
    );

    res.json({ message: "Storage configuration saved" });
  } catch (err) {
    console.error("[admin] Save storage config error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/storage/test-connection — verify WebDAV connectivity (admin or settings perm)
// ---------------------------------------------------------------------------

router.post("/storage/test-connection", requireAdminOrPermission("settings"), async (req: Request, res: Response) => {
  try {
    const { url, username, password, rootPath } = req.body ?? {};
    const result = await testConnection({
      url: typeof url === "string" ? url.trim() : "",
      username: typeof username === "string" ? username.trim() : "",
      password: typeof password === "string" ? password : "",
      rootPath: typeof rootPath === "string" ? rootPath : "/LegalOS",
    });
    res.json(result);
  } catch (err) {
    console.error("[admin] Test storage connection error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===========================================================================
// TASK OPTIONS ROUTES (admin-managed workflow configuration)
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/task-options — current task workflow options (admin or settings perm)
// ---------------------------------------------------------------------------

router.get("/task-options", requireAdminOrPermission("settings"), async (_req: Request, res: Response) => {
  try {
    const options = await AppSettings.getTaskOptions();
    res.json(options);
  } catch (err) {
    console.error("[admin] Task options error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/task-options — save task workflow options (admin or settings perm)
// ---------------------------------------------------------------------------

router.put("/task-options", requireAdminOrPermission("settings"), async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const toStrArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter((s) => s.length > 0) : [];

    const templates = (Array.isArray(body.checklistTemplates) ? body.checklistTemplates : [])
      .map((raw) => {
        const t = raw as Record<string, unknown>;
        return {
          name: String(t.name ?? "").trim(),
          items: Array.isArray(t.items)
            ? t.items.map((x) => String(x).trim()).filter((s) => s.length > 0)
            : [],
        };
      })
      .filter((t) => t.name.length > 0 && t.items.length > 0);

    await AppSettings.setTaskOptions(
      {
        categories: toStrArray(body.categories),
        checklistTemplates: templates,
        agents: toStrArray(body.agents),
      },
      req.userId!,
    );

    res.json({ message: "Task options saved" });
  } catch (err) {
    console.error("[admin] Save task options error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===========================================================================
// REPORTS ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/reports/summary — key metrics
// ---------------------------------------------------------------------------

router.get("/reports/summary", requireAdminOrPermission("reports"), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalClients, activeCases, tasksCompleted, docsApproved] = await Promise.all([
      Client.countDocuments({ tag: { $ne: "Archived" } }),
      Case.countDocuments({ status: { $nin: ["Closed", "Archived"] } }),
      Task.countDocuments({ status: "completed", updatedAt: { $gte: thirtyDaysAgo } }),
      DocumentModel.countDocuments({ state: "Approved", updatedAt: { $gte: thirtyDaysAgo } }),
    ]);

    res.json({
      totalClients,
      activeCases,
      tasksCompleted,
      docsApproved,
      period: "30 days",
    });
  } catch (err) {
    console.error("[reports] Summary error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/case-growth — monthly case growth
// ---------------------------------------------------------------------------

router.get("/reports/case-growth", requireAdminOrPermission("reports"), async (_req: Request, res: Response) => {
  try {
    const months = 7;
    const results = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = start.toLocaleDateString("en-US", { month: "short" });

      const [cases, closed] = await Promise.all([
        Case.countDocuments({ createdAt: { $gte: start, $lte: end }, status: { $ne: "Archived" } }),
        Case.countDocuments({ status: "Closed", updatedAt: { $gte: start, $lte: end } }),
      ]);

      results.push({ month: monthLabel, cases, closed });
    }

    res.json({ growth: results });
  } catch (err) {
    console.error("[reports] Case growth error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/practice-areas — case distribution by practice
// ---------------------------------------------------------------------------

router.get("/reports/practice-areas", requireAdminOrPermission("reports"), async (_req: Request, res: Response) => {
  try {
    const distribution = await Case.aggregate([
      { $match: { status: { $ne: "Archived" } } },
      { $group: { _id: "$practice", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $project: { name: "$_id", value: 1, _id: 0 } },
    ]);

    res.json({ distribution });
  } catch (err) {
    console.error("[reports] Practice areas error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/employee-workload — workload stats with current task
// ---------------------------------------------------------------------------

router.get("/reports/employee-workload", requireAdminOrPermission("reports"), async (_req: Request, res: Response) => {
  try {
    const employees = await User.find({}).select("name role status").lean();

    const workloads = await Promise.all(
      employees.map(async (emp) => {
        const [cases, pendingTasksCount, topTasks, completedTasks] = await Promise.all([
          Case.countDocuments({ assignedTo: emp._id, status: { $ne: "Closed" } }),
          Task.countDocuments({ assignedTo: emp._id, status: { $ne: "completed" } }),
          Task.find({ assignedTo: emp._id, status: { $ne: "completed" } })
            .sort({ priority: -1, deadline: 1 })
            .limit(1)
            .select("_id title priority deadline")
            .lean(),
          Task.countDocuments({ assignedTo: emp._id, status: "completed" }),
        ]);
        const currentTask = topTasks[0] ?? null;

        const workloadScore = Math.min(100, (cases * 12) + (pendingTasksCount * 8));

        return {
          _id: emp._id,
          name: emp.name,
          role: emp.role,
          status: emp.status,
          activeCases: cases,
          pendingTasks: pendingTasksCount,
          completedTasks: completedTasks,
          currentTask: currentTask ? {
            _id: currentTask._id,
            title: currentTask.title,
            priority: currentTask.priority,
            deadline: currentTask.deadline
          } : null,
          workload: workloadScore
        };
      }),
    );

    res.json({ workloads });
  } catch (err) {
    console.error("[reports] Workload error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/top-clients — most active clients
// ---------------------------------------------------------------------------

router.get("/reports/top-clients", requireAdminOrPermission("reports"), async (_req: Request, res: Response) => {
  try {
    const topClients = await Case.aggregate([
      { $unwind: "$parties" },
      { $match: { "parties.type": "client" } },
      { $group: { _id: "$parties.name", cases: { $sum: 1 } } },
      { $sort: { cases: -1 } },
      { $limit: 5 },
      { $project: { name: "$_id", cases: 1, _id: 0 } },
    ]);

    res.json({ topClients });
  } catch (err) {
    console.error("[reports] Top clients error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/reports/my-performance — per-user contribution metrics
// ---------------------------------------------------------------------------

router.get("/reports/my-performance", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const now = new Date();

    const [
      hearingsDone,
      hearingsTotal,
      tasksDone,
      tasksTotal,
      docsDone,
      docsTotal,
      casesActive,
      casesTotal,
    ] = await Promise.all([
      CalendarEvent.countDocuments({ type: "hearing", assignedTo: userId, start: { $lt: now } }),
      CalendarEvent.countDocuments({ type: "hearing", assignedTo: userId }),
      Task.countDocuments({ assignedTo: userId, status: "completed" }),
      Task.countDocuments({ assignedTo: userId }),
      DocumentModel.countDocuments({ uploadedBy: userId, state: "Approved" }),
      DocumentModel.countDocuments({ uploadedBy: userId }),
      Case.countDocuments({ assignedTo: userId, status: { $in: ["Active", "Urgent"] } }),
      Case.countDocuments({ assignedTo: userId }),
    ]);

    res.json({
      performance: [
        { label: "Hearings attended", done: hearingsDone, total: hearingsTotal },
        { label: "Tasks completed", done: tasksDone, total: tasksTotal },
        { label: "Documents uploaded", done: docsDone, total: docsTotal },
        { label: "Cases active", done: casesActive, total: casesTotal },
      ],
    });
  } catch (err) {
    console.error("[reports] My performance error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===========================================================================
// DATA INTEGRITY ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/integrity/audit-chain — verify audit log chain integrity (admin only)
// ---------------------------------------------------------------------------

router.get("/integrity/audit-chain", requireAdminOrPermission("auditLogs"), async (_req: Request, res: Response) => {
  try {
    const result = await AuditLog.verifyChain();
    res.json(result);
  } catch (err) {
    console.error("[admin] Audit chain verification error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/integrity/files — list file integrity records with status (admin or auditLogs perm)
// ---------------------------------------------------------------------------

router.get("/integrity/files", requireAdminOrPermission("auditLogs"), async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status) filter["status"] = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      FileIntegrity.find(filter)
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("uploadedBy", "name")
        .populate("caseId", "title number")
        .lean(),
      FileIntegrity.countDocuments(filter),
    ]);

    res.json({ records, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error("[admin] File integrity list error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/integrity/verify-all — trigger full file integrity scan (admin only)
// ---------------------------------------------------------------------------

router.post("/integrity/verify-all", requireAdminOrPermission("auditLogs"), async (req: Request, res: Response) => {
  try {
    const results = await FileIntegrity.verifyAllPending(req.user!._id, async (storedPath: string) => {
      try {
        const fullPath = getLocalPath(storedPath);
        if (!fs.existsSync(fullPath)) return null;
        return await fsp.readFile(fullPath);
      } catch {
        return null;
      }
    });

    res.json({
      message: "File integrity verification completed",
      ...results,
    });
  } catch (err) {
    console.error("[admin] Full file verification error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/integrity/verify-file/:id — verify single file (admin or auditLogs perm)
// ---------------------------------------------------------------------------

router.post("/integrity/verify-file/:id", requireAdminOrPermission("auditLogs"), async (req: Request, res: Response) => {
  try {
    const record = await FileIntegrity.findById(req.params["id"]);
    if (!record) {
      res.status(404).json({ message: "File integrity record not found" });
      return;
    }

    let actualHash = "";
    let status: FileIntegrityStatus = "missing";

    try {
      const fullPath = getLocalPath(record.storedPath);
      if (fs.existsSync(fullPath)) {
        actualHash = await computeFileHash(fullPath);
        status = actualHash === record.sha256 ? "verified" : "tampered";
      } else {
        status = "missing";
      }
    } catch {
      status = "missing";
    }

    record.status = status;
    record.lastVerifiedAt = new Date();
    record.verifications.push({
      verifiedAt: new Date(),
      verifiedBy: req.user!._id,
      status,
      computedHash: actualHash,
    });
    await record.save();

    res.json({
      fileId: record._id.toString(),
      documentId: record.documentId.toString(),
      originalName: record.originalName,
      expectedHash: record.sha256,
      actualHash,
      algorithm: "SHA-256",
      lastVerifiedAt: record.lastVerifiedAt,
      currentStatus: record.status,
    });
  } catch (err) {
    console.error("[admin] File verification error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;