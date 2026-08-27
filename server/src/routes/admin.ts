import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { Client } from "../models/Client.js";
import { Case } from "../models/Case.js";
import { Task } from "../models/Task.js";
import { DocumentModel } from "../models/Document.js";
import { FileIntegrity } from "../models/FileIntegrity.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { AppSettings } from "../models/AppSettings.js";
import { testConnection } from "../services/webdav.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ===========================================================================
// ADMIN ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs — paginated audit trail (admin only)
// ---------------------------------------------------------------------------

router.get("/audit-logs", requireAdmin, async (req: Request, res: Response) => {
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
// GET /api/admin/employees — list all employees (admin only)
// ---------------------------------------------------------------------------

router.get("/employees", requireAdmin, async (req: Request, res: Response) => {
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
// POST /api/admin/employees — create employee (admin only)
// ---------------------------------------------------------------------------

router.post("/employees", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      role = "junior_advocate",
      title = "",
      phone = "",
      password = "password123",
    } = req.body;

    if (!name || !email) {
      res.status(400).json({ message: "Name and email are required" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ message: "An employee with this email already exists" });
      return;
    }

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

    res.status(201).json({ user: user.toJSON() });
  } catch (err) {
    console.error("[admin] Create employee error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/employees/:id — update employee (admin only)
// ---------------------------------------------------------------------------

router.patch("/employees/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const allowed = ["role", "title", "status", "phone", "permissions"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!user) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error("[admin] Update employee error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/approvals — pending items needing approval
// ---------------------------------------------------------------------------

router.get("/approvals", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [pendingDocs, pendingAccess] = await Promise.all([
      DocumentModel.find({ state: "Pending" }).sort({ createdAt: -1 }).lean(),
      DocumentModel.find({ "accessRequests.status": "pending" })
        .select("name accessRequests")
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
// GET /api/admin/storage — current Synology config (admin only; password masked)
// ---------------------------------------------------------------------------

router.get("/storage", requireAdmin, async (_req: Request, res: Response) => {
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
// PATCH /api/admin/storage — save Synology config (admin only)
// ---------------------------------------------------------------------------

router.patch("/storage", requireAdmin, async (req: Request, res: Response) => {
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
// POST /api/admin/storage/test-connection — verify WebDAV connectivity (admin only)
// ---------------------------------------------------------------------------

router.post("/storage/test-connection", requireAdmin, async (req: Request, res: Response) => {
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
// GET /api/admin/task-options — current task workflow options (admin only)
// ---------------------------------------------------------------------------

router.get("/task-options", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const options = await AppSettings.getTaskOptions();
    res.json(options);
  } catch (err) {
    console.error("[admin] Task options error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/task-options — save task workflow options (admin only)
// ---------------------------------------------------------------------------

router.put("/task-options", requireAdmin, async (req: Request, res: Response) => {
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

router.get("/reports/summary", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalClients, activeCases, tasksCompleted, docsApproved] = await Promise.all([
      Client.countDocuments(),
      Case.countDocuments({ status: "Active" }),
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

router.get("/reports/case-growth", async (_req: Request, res: Response) => {
  try {
    const months = 7;
    const results = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = start.toLocaleDateString("en-US", { month: "short" });

      const [cases, closed] = await Promise.all([
        Case.countDocuments({ createdAt: { $gte: start, $lte: end } }),
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

router.get("/reports/practice-areas", async (_req: Request, res: Response) => {
  try {
    const distribution = await Case.aggregate([
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

router.get("/reports/employee-workload", async (_req: Request, res: Response) => {
  try {
    const employees = await User.find({}).select("name role status").lean();

    const workloads = await Promise.all(
      employees.map(async (emp) => {
        const [cases, topTasks, completedTasks] = await Promise.all([
          Case.countDocuments({ assignedTo: emp._id, status: { $ne: "Closed" } }),
          Task.find({ assignedTo: emp._id, status: { $ne: "completed" } })
            .sort({ priority: -1, deadline: 1 })
            .limit(1)
            .select("_id title priority deadline")
            .lean(),
          Task.countDocuments({ assignedTo: emp._id, status: "completed" }),
        ]);
        const currentTask = topTasks[0] ?? null;

        const workloadScore = Math.min(100,
          (cases * 15) +
          (topTasks.length * 10) +
          (topTasks.reduce((sum, task) => {
            const priorityWeight = task.priority === "High" ? 3 : task.priority === "Medium" ? 2 : 1;
            return sum + priorityWeight;
          }, 0))
        );

        return {
          _id: emp._id,
          name: emp.name,
          role: emp.role,
          status: emp.status,
          activeCases: cases,
          pendingTasks: topTasks.length,
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

router.get("/reports/top-clients", async (_req: Request, res: Response) => {
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

router.get("/integrity/audit-chain", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await AuditLog.verifyChain();
    res.json(result);
  } catch (err) {
    console.error("[admin] Audit chain verification error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/integrity/files — list file integrity records with status
// ---------------------------------------------------------------------------

router.get("/integrity/files", requireAdmin, async (req: Request, res: Response) => {
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

router.post("/integrity/verify-all", requireAdmin, async (req: Request, res: Response) => {
  try {
    res.json({
      message: "Full file integrity verification requires NAS (WebDAV) streaming implementation",
      note: "Implement getFileBuffer function in FileIntegrity model to enable server-side verification",
    });
  } catch (err) {
    console.error("[admin] Full file verification error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/integrity/verify-file/:id — verify single file (admin only)
// ---------------------------------------------------------------------------

router.post("/integrity/verify-file/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const record = await FileIntegrity.findById(req.params["id"]);
    if (!record) {
      res.status(404).json({ message: "File integrity record not found" });
      return;
    }

    res.json({
      fileId: record._id.toString(),
      documentId: record.documentId.toString(),
      originalName: record.originalName,
      expectedHash: record.sha256,
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