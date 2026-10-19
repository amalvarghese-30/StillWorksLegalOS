import fs from "node:fs";
import fsp from "node:fs/promises";
import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
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
import { ApprovalRequest } from "../models/ApprovalRequest.js";
import { testConnection, getLocalPath, STORAGE_ROOT } from "../services/storage.js";
import { requireAuth, requireAdmin, requireAdminOrPermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ===========================================================================
// ADMIN ROUTES
// ===========================================================================

// ---------------------------------------------------------------------------
// Helpers: Audit log filtering & CSV export
// ---------------------------------------------------------------------------

function buildAuditLogFilter(query: Record<string, string | undefined>): Record<string, unknown> {
  const {
    userId,
    action,
    resource,
    search,
    startDate,
    endDate,
    todayOnly,
    ip,
  } = query;

  const filter: Record<string, unknown> = {};
  const andConditions: Record<string, unknown>[] = [];

  if (userId && Types.ObjectId.isValid(userId)) {
    filter["userId"] = new Types.ObjectId(userId);
  }

  if (action && action !== "all") {
    if (action === "security") {
      andConditions.push({
        $or: [
          { action: { $in: ["login", "logout", "delete", "access_request", "settings_change"] } },
          { resource: { $in: ["auth", "settings"] } },
        ],
      });
    } else {
      filter["action"] = action;
    }
  }

  if (resource && resource !== "all") {
    filter["resource"] = resource;
  }

  if (ip && ip.trim()) {
    const cleanIp = ip.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter["ip"] = { $regex: cleanIp, $options: "i" };
  }

  // Time handling in Asia/Kolkata (UTC +5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;

  if (todayOnly === "true") {
    const now = new Date();
    const istNow = new Date(now.getTime() + istOffsetMs);
    const istMidnight = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0, 0));
    const startOfTodayUtc = new Date(istMidnight.getTime() - istOffsetMs);
    andConditions.push({ createdAt: { $gte: startOfTodayUtc } });
  } else if (startDate || endDate) {
    const dateCond: Record<string, unknown> = {};
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        dateCond["$gte"] = d;
      }
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) {
        if (endDate.length === 10) {
          d.setUTCHours(23, 59, 59, 999);
        }
        dateCond["$lte"] = d;
      }
    }
    if (Object.keys(dateCond).length > 0) {
      andConditions.push({ createdAt: dateCond });
    }
  }

  if (search && search.trim()) {
    const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(cleanSearch, "i");
    andConditions.push({
      $or: [
        { userName: regex },
        { action: regex },
        { resource: regex },
        { resourceName: regex },
        { details: regex },
        { ip: regex },
      ],
    });
  }

  if (andConditions.length > 0) {
    filter["$and"] = andConditions;
  }

  return filter;
}

function parseUserAgentSummary(ua?: string): string {
  if (!ua || typeof ua !== "string") return "Unknown Client";
  let browser = "Browser";
  let os = "Device";

  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";
  else if (/postman/i.test(ua)) browser = "Postman";
  else if (/node/i.test(ua)) browser = "Node.js";

  return `${browser} · ${os}`;
}

function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Neutralize CSV formula injection: if first character is =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function formatToIST(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs/metrics — summary counts for audit log cards
// ---------------------------------------------------------------------------

router.get("/audit-logs/metrics", requireAdminOrPermission("auditLogs"), async (_req: Request, res: Response) => {
  try {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + istOffsetMs);
    const istMidnight = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0, 0));
    const startOfTodayUtc = new Date(istMidnight.getTime() - istOffsetMs);

    const [totalEvents, eventsToday, activeUserIds, securityEvents] = await Promise.all([
      AuditLog.countDocuments({}),
      AuditLog.countDocuments({ createdAt: { $gte: startOfTodayUtc } }),
      AuditLog.distinct("userId"),
      AuditLog.countDocuments({
        $or: [
          { action: { $in: ["login", "logout", "delete", "access_request", "settings_change"] } },
          { resource: { $in: ["auth", "settings"] } },
        ],
      }),
    ]);

    res.json({
      totalEvents,
      eventsToday,
      activeUsers: activeUserIds.length,
      securityEvents,
    });
  } catch (err) {
    console.error("[admin] Audit logs metrics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs/export — export filtered logs as CSV
// ---------------------------------------------------------------------------

router.get("/audit-logs/export", requireAdminOrPermission("auditLogs"), async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string>;
    const filter = buildAuditLogFilter(query);

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      action: { action: 1, createdAt: -1 },
      user: { userName: 1, createdAt: -1 },
    };
    const sortOption = (query.sortBy && sortMap[query.sortBy]) || { createdAt: -1 };

    // Limit export to 5000 records for memory safety
    const logs = await AuditLog.find(filter)
      .sort(sortOption)
      .limit(5000)
      .lean();

    const headers = [
      "Timestamp (IST)",
      "User",
      "Action",
      "Resource",
      "Resource Name",
      "Details",
      "IP Address",
      "Client Device",
      "Full User-Agent",
      "Sequence",
      "Tamper-Proof Hash",
    ];

    const rows = logs.map((l) => [
      sanitizeCsvValue(formatToIST(l.createdAt)),
      sanitizeCsvValue(l.userName),
      sanitizeCsvValue(l.action),
      sanitizeCsvValue(l.resource),
      sanitizeCsvValue(l.resourceName || ""),
      sanitizeCsvValue(l.details || ""),
      sanitizeCsvValue(l.ip || ""),
      sanitizeCsvValue(parseUserAgentSummary(l.userAgent)),
      sanitizeCsvValue(l.userAgent || ""),
      sanitizeCsvValue(l.sequence != null ? String(l.sequence) : ""),
      sanitizeCsvValue(l.hash || ""),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error("[admin] Audit logs export error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs — paginated audit trail (admin or auditLogs perm)
// ---------------------------------------------------------------------------

router.get("/audit-logs", requireAdminOrPermission("auditLogs"), async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string>;
    const {
      page = "1",
      limit = "50",
      sortBy = "newest",
    } = query;

    const filter = buildAuditLogFilter(query);

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      action: { action: 1, createdAt: -1 },
      user: { userName: 1, createdAt: -1 },
    };
    const sortOption = sortMap[sortBy] || { createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort(sortOption).skip(skip).limit(limitNum).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page: pageNum, totalPages: Math.ceil(total / limitNum), limit: limitNum });
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
// GET /api/admin/employees/:id — get employee profile, workload metrics, activity
// ---------------------------------------------------------------------------

router.get("/employees/:id", async (req: Request, res: Response) => {
  try {
    const targetId = String(req.params["id"] || "");
    if (!targetId || !Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ message: "Invalid employee ID format" });
      return;
    }

    const isActualAdmin = req.user?.role === "admin";
    const hasEmployeePerm = Boolean(req.user?.permissions?.employees);
    const isSelf = req.userId === targetId;

    if (!isActualAdmin && !hasEmployeePerm && !isSelf) {
      res.status(403).json({ message: "You do not have permission to view this employee profile" });
      return;
    }

    const employee = await User.findById(targetId)
      .select("-passwordHash -resetOtpHash -resetOtpExpires -resetOtpAttempts")
      .lean();

    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const now = new Date();
    // Use configured timezone (Asia/Kolkata) for accurate daily and weekly metrics
    let timezone = "Asia/Kolkata";
    try {
      const workingHours = await (AppSettings as any).getWorkingHoursConfig();
      if (workingHours?.timezone) {
        timezone = workingHours.timezone;
      }
    } catch {}

    const todayDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const startOfToday = new Date(`${todayDateStr}T00:00:00.000+05:30`);
    const endOfToday = new Date(`${todayDateStr}T23:59:59.999+05:30`);

    // Sunday as start of week in reporting timezone
    const dayOfWeek = new Date(startOfToday.getTime() + 12 * 3600 * 1000).getDay();
    const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const empObjId = new Types.ObjectId(targetId);
    const empCaseMatch = { $or: [{ assignedTo: empObjId }, { assignedUsers: empObjId }] };
    const empTaskMatch = { $or: [{ assignedTo: targetId }, { assignedTo: empObjId }, { assignedUsers: targetId }, { assignedUsers: empObjId }] };

    const [
      activeCases,
      totalCases,
      openTasks,
      completedTasks,
      overdueTasks,
      pendingApprovals,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      upcomingDeadlines,
      recentActivity,
    ] = await Promise.all([
      Case.countDocuments({
        isDeleted: { $ne: true },
        status: { $nin: ["Closed", "Archived"] },
        ...empCaseMatch,
      }),
      Case.countDocuments({
        isDeleted: { $ne: true },
        ...empCaseMatch,
      }),
      Task.countDocuments({
        isDeleted: { $ne: true },
        ...empTaskMatch,
        status: { $in: ["pending", "in_progress", "pending_approval"] },
      }),
      Task.countDocuments({
        isDeleted: { $ne: true },
        ...empTaskMatch,
        status: "completed",
      }),
      Task.countDocuments({
        isDeleted: { $ne: true },
        ...empTaskMatch,
        status: { $ne: "completed" },
        deadline: { $lt: now },
      }),
      Promise.all([
        Task.countDocuments({
          isDeleted: { $ne: true },
          ...empTaskMatch,
          status: "pending_approval",
        }),
        ApprovalRequest.countDocuments({
          status: "pending",
          $or: [
            { requesterId: empObjId },
            { targetUserId: empObjId },
            { originalAssigneeId: empObjId },
          ],
        }),
      ]).then(([taskApprovals, reqApprovals]) => taskApprovals + reqApprovals),
      Task.countDocuments({
        $and: [
          { isDeleted: { $ne: true }, status: "completed" },
          empTaskMatch,
          {
            $or: [
              { completedAt: { $gte: startOfToday, $lte: endOfToday } },
              { completedAt: { $in: [null, undefined] }, updatedAt: { $gte: startOfToday, $lte: endOfToday } },
            ],
          },
        ],
      }),
      Task.countDocuments({
        $and: [
          { isDeleted: { $ne: true }, status: "completed" },
          empTaskMatch,
          {
            $or: [
              { completedAt: { $gte: startOfWeek, $lte: endOfToday } },
              { completedAt: { $in: [null, undefined] }, updatedAt: { $gte: startOfWeek, $lte: endOfToday } },
            ],
          },
        ],
      }),
      Task.countDocuments({
        isDeleted: { $ne: true },
        ...empTaskMatch,
        status: "completed",
        updatedAt: { $gte: startOfMonth },
      }),
      Task.countDocuments({
        isDeleted: { $ne: true },
        ...empTaskMatch,
        status: { $ne: "completed" },
        deadline: { $gte: now, $lte: inSevenDays },
      }),
      AuditLog.find({ userId: empObjId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({
      employee,
      metrics: {
        activeCases,
        totalCases,
        openTasks,
        completedTasks,
        overdueTasks,
        pendingApprovals,
        completedToday,
        completedThisWeek,
        completedThisMonth,
        upcomingDeadlines,
      },
      recentActivity,
    });
  } catch (err) {
    console.error("[admin] Employee detail error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/employees/:id/approvals — employee-specific approvals
// ---------------------------------------------------------------------------

router.get("/employees/:id/approvals", async (req: Request, res: Response) => {
  try {
    const targetId = String(req.params["id"] || "");
    if (!targetId || !Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ message: "Invalid employee ID format" });
      return;
    }

    const isActualAdmin = req.user?.role === "admin";
    const hasEmployeePerm = Boolean(req.user?.permissions?.employees);
    const hasApprovalsPerm = Boolean(req.user?.permissions?.approvals);
    const isSelf = req.userId === targetId;

    if (!isActualAdmin && !hasEmployeePerm && !hasApprovalsPerm && !isSelf) {
      res.status(403).json({ message: "You do not have permission to view approvals for this employee" });
      return;
    }

    const empObjId = new Types.ObjectId(targetId);

    const [pendingTasks, pendingRequests] = await Promise.all([
      Task.find({
        isDeleted: { $ne: true },
        $or: [
          { assignedTo: targetId },
          { assignedTo: empObjId },
          { assignedUsers: targetId },
          { assignedUsers: empObjId },
        ],
        status: "pending_approval",
      })
        .populate("assignedTo", "name email role")
        .populate("caseId", "title number courtCaseId countCaseNumber")
        .populate("clientId", "name phone email")
        .sort({ updatedAt: -1 })
        .lean(),
      ApprovalRequest.find({
        status: "pending",
        $or: [
          { requesterId: empObjId },
          { targetUserId: empObjId },
          { originalAssigneeId: empObjId },
        ],
      })
        .populate("requesterId", "name email role")
        .populate("targetUserId", "name email role")
        .populate("originalAssigneeId", "name email role")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const approvals = [
      ...pendingTasks.map((t: any) => {
        const assignedUser = t.assignedTo as any;
        const totalItems = t.checklist?.length ?? 0;
        const doneItems = t.checklist?.filter((c: any) => c.done).length ?? 0;
        const checklistSummary = totalItems > 0 ? ` · ${doneItems}/${totalItems} subtasks completed` : "";
        return {
          _id: `task_${t._id.toString()}`,
          kind: "Task Completion",
          title: t.title,
          context: `Submitted by ${assignedUser?.name ?? "Assignee"}${checklistSummary}`,
          when: t.submittedForApprovalAt || t.updatedAt || t.createdAt,
          taskDetails: {
            _id: t._id.toString(),
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            category: t.category,
            mainCategory: t.mainCategory,
            subCategory: t.subCategory,
            deadline: t.deadline,
            completedAt: t.completedAt || t.updatedAt,
            submittedForApprovalAt: t.submittedForApprovalAt,
            assignedTo: t.assignedTo,
            case: t.caseId ? {
              _id: t.caseId._id,
              title: t.caseId.title,
              number: t.caseId.number,
              courtCaseId: t.caseId.courtCaseId,
              countCaseNumber: t.caseId.countCaseNumber,
            } : null,
            client: t.clientId ? {
              _id: t.clientId._id,
              name: t.clientId.name,
              phone: t.clientId.phone,
              email: t.clientId.email,
            } : null,
            checklist: t.checklist || [],
            remarks: t.remarks || [],
            assignmentHistory: t.assignmentHistory || [],
          },
        };
      }),
      ...pendingRequests.map((r: any) => {
        let kind = "General Approval";
        if (r.type === "task_reassign") kind = "Task Reassignment";
        else if (r.type === "task_delete") kind = "Task Deletion";
        else if (r.type === "case_delete") kind = "Case Deletion";
        else if (r.type === "case_reassign") kind = "Case Reassignment";
        else if (r.type === "attachment_retention_purge") kind = "Attachment Purge";

        const requesterName = r.requesterId?.name || "Employee";
        const targetName = r.targetUserId?.name ? ` to ${r.targetUserId.name}` : "";
        return {
          _id: `approval_req_${r._id.toString()}`,
          rawApprovalId: r._id.toString(),
          kind,
          title: `${kind}${targetName}`,
          context: `Requested by ${requesterName}: "${r.reason || "No remark"}"`,
          when: r.createdAt,
          requestDetails: {
            _id: r._id.toString(),
            type: r.type,
            entityType: r.entityType,
            entityId: r.entityId?.toString(),
            requester: r.requesterId,
            targetUser: r.targetUserId,
            originalAssignee: r.originalAssigneeId,
            reason: r.reason,
            createdAt: r.createdAt,
            metadata: r.metadata,
          },
        };
      }),
    ];

    res.json({ approvals, total: approvals.length });
  } catch (err) {
    console.error("[admin] Employee approvals error:", err);
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
    const allowedForAll = [
      "name", "title", "status", "phone", "secondaryPhone",
      "soundPreferences", "whatsappNotifications", "telegramNotifications", "telegramChatId"
    ];
    const allowedForAdmin = [...allowedForAll, "email", "role", "permissions"];
    const allowedFields = isActualAdmin ? allowedForAdmin : allowedForAll;

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    let passwordUpdated = false;
    if (req.body["password"] !== undefined && req.body["password"] !== "") {
      if (!isActualAdmin) {
        res.status(403).json({ message: "Only administrators can update employee passwords" });
        return;
      }
      const rawPassword = typeof req.body["password"] === "string" ? req.body["password"].trim() : "";
      if (rawPassword.length < 8) {
        res.status(400).json({ field: "password", message: "Password must be at least 8 characters long" });
        return;
      }
      updates["passwordHash"] = await bcrypt.hash(rawPassword, 12);
      passwordUpdated = true;
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

    if (passwordUpdated && targetId !== req.userId) {
      // Invalidate active sessions for this user
      await Session.updateMany(
        { userId: targetId, isRevoked: false },
        { $set: { isRevoked: true } }
      );
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${targetId}`).emit("force:logout", {
          reason: "password_updated",
        });
        const sockets = await io.in(`user:${targetId}`).fetchSockets();
        for (const socket of sockets) {
          socket.disconnect(true);
        }
      }
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
// POST /api/admin/employees/:id/reset-password — admin reset password (admin or employees perm)
// ---------------------------------------------------------------------------

router.post("/employees/:id/reset-password", requireAdminOrPermission("employees"), async (req: Request, res: Response) => {
  try {
    const targetId = req.params["id"];
    const isActualAdmin = req.user?.role === "admin";

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    // Guard: Prevent admin self-reset via employee administration endpoint
    if (targetId === req.userId) {
      res.status(400).json({ message: "Cannot reset your own password via employee administration. Use profile settings." });
      return;
    }

    // Guard: Non-admin managers cannot reset admin passwords
    if (!isActualAdmin && targetUser.role === "admin") {
      res.status(403).json({ message: "Only admins can reset administrator passwords" });
      return;
    }

    const { mode = "generate", newPassword } = req.body ?? {};
    let finalPassword = "";

    if (mode === "manual") {
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        res.status(400).json({ message: "Password must be at least 8 characters long" });
        return;
      }
      finalPassword = newPassword;
    } else {
      finalPassword = randomBytes(16).toString("hex");
    }

    targetUser.passwordHash = await bcrypt.hash(finalPassword, 12);
    await targetUser.save();

    // Invalidate active sessions for this user (if not the admin self-updating)
    if (targetId !== req.userId) {
      await Session.updateMany(
        { userId: targetUser._id, isRevoked: false },
        { $set: { isRevoked: true } }
      );

      // Disconnect active socket connections
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${targetId}`).emit("force:logout", {
          reason: "password_reset",
        });
        const sockets = await io.in(`user:${targetId}`).fetchSockets();
        for (const socket of sockets) {
          socket.disconnect(true);
        }
      }
    }

    // Audit log
    try {
      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: "update",
        resource: "user",
        resourceId: targetUser._id.toString(),
        resourceName: targetUser.name,
        details: "Password reset by administrator",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (logErr) {
      console.error("[admin] Reset password audit log error:", logErr);
    }

    res.json({
      message: "Password reset successfully",
      temporaryPassword: finalPassword,
      mustChangePassword: true,
    });
  } catch (err: any) {
    console.error("[admin] Reset password error:", err);
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
// GET /api/admin/approvals/metrics — summary metrics for Approval Centre
// ---------------------------------------------------------------------------

router.get("/approvals/metrics", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    let timezone = "Asia/Kolkata";
    try {
      const workingHours = await (AppSettings as any).getWorkingHoursConfig();
      if (workingHours?.timezone) {
        timezone = workingHours.timezone;
      }
    } catch {}

    const todayDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const [yearStr, monthStr] = todayDateStr.split("-");
    const startOfToday = new Date(`${todayDateStr}T00:00:00.000+05:30`);
    const endOfToday = new Date(`${todayDateStr}T23:59:59.999+05:30`);
    const startOfMonth = new Date(`${yearStr}-${monthStr}-01T00:00:00.000+05:30`);

    // 1. Awaiting Review (pending across all supported models)
    const [
      pendingTasks,
      pendingRequests,
      pendingDocs,
      pendingDocAccessDocs,
      pendingCaseAccessCases,
    ] = await Promise.all([
      Task.countDocuments({ status: "pending_approval", isDeleted: { $ne: true } }),
      ApprovalRequest.countDocuments({ status: "pending" }),
      DocumentModel.countDocuments({ state: "Pending" }),
      DocumentModel.find({ "accessRequests.status": "pending" }).select("accessRequests").lean(),
      Case.find({ "accessRequests.status": "pending" }).select("accessRequests").lean(),
    ]);

    const pendingDocAccessCount = pendingDocAccessDocs.reduce(
      (sum, d) => sum + (d.accessRequests?.filter((ar: any) => ar.status === "pending").length || 0),
      0
    );
    const pendingCaseAccessCount = pendingCaseAccessCases.reduce(
      (sum, c) => sum + (c.accessRequests?.filter((ar: any) => ar.status === "pending").length || 0),
      0
    );

    const awaitingReview = pendingTasks + pendingRequests + pendingDocs + pendingDocAccessCount + pendingCaseAccessCount;

    // 2. Submitted Today (in Asia/Kolkata timezone)
    const [
      todayTasks,
      todayRequests,
      todayDocs,
      todayDocAccessDocs,
      todayCaseAccessCases,
    ] = await Promise.all([
      Task.countDocuments({
        isDeleted: { $ne: true },
        $or: [
          { submittedForApprovalAt: { $gte: startOfToday, $lte: endOfToday } },
          { status: "pending_approval", createdAt: { $gte: startOfToday, $lte: endOfToday } },
        ],
      }),
      ApprovalRequest.countDocuments({
        createdAt: { $gte: startOfToday, $lte: endOfToday },
      }),
      DocumentModel.countDocuments({
        createdAt: { $gte: startOfToday, $lte: endOfToday },
      }),
      DocumentModel.find({
        "accessRequests.createdAt": { $gte: startOfToday, $lte: endOfToday },
      }).select("accessRequests").lean(),
      Case.find({
        "accessRequests.createdAt": { $gte: startOfToday, $lte: endOfToday },
      }).select("accessRequests").lean(),
    ]);

    const todayDocAccessCount = todayDocAccessDocs.reduce(
      (sum, d) => sum + (d.accessRequests?.filter((ar: any) => ar.createdAt >= startOfToday && ar.createdAt <= endOfToday).length || 0),
      0
    );
    const todayCaseAccessCount = todayCaseAccessCases.reduce(
      (sum, c) => sum + (c.accessRequests?.filter((ar: any) => ar.createdAt >= startOfToday && ar.createdAt <= endOfToday).length || 0),
      0
    );

    const submittedToday = todayTasks + todayRequests + todayDocs + todayDocAccessCount + todayCaseAccessCount;

    // 3. Approved This Month (in Asia/Kolkata timezone)
    const [
      monthTasksApproved,
      monthRequestsApproved,
      monthDocsApproved,
    ] = await Promise.all([
      Task.countDocuments({
        status: "completed",
        isDeleted: { $ne: true },
        $or: [
          { approvedAt: { $gte: startOfMonth } },
          { completedAt: { $gte: startOfMonth } },
        ],
      }),
      ApprovalRequest.countDocuments({
        status: "approved",
        reviewedAt: { $gte: startOfMonth },
      }),
      DocumentModel.countDocuments({
        state: "Approved",
        $or: [
          { approvedAt: { $gte: startOfMonth } },
          { updatedAt: { $gte: startOfMonth } },
        ],
      }),
    ]);

    const approvedThisMonth = monthTasksApproved + monthRequestsApproved + monthDocsApproved;

    // 4. Rejected This Month (in Asia/Kolkata timezone)
    const [
      monthTasksRejected,
      monthRequestsRejected,
      monthDocsRejected,
    ] = await Promise.all([
      Task.countDocuments({
        isDeleted: { $ne: true },
        $or: [
          { rejectedAt: { $gte: startOfMonth } },
          { status: "in_progress", rejectionReason: { $exists: true, $ne: "" }, updatedAt: { $gte: startOfMonth } },
        ],
      }),
      ApprovalRequest.countDocuments({
        status: "rejected",
        reviewedAt: { $gte: startOfMonth },
      }),
      DocumentModel.countDocuments({
        state: "Rejected",
        $or: [
          { rejectedAt: { $gte: startOfMonth } },
          { updatedAt: { $gte: startOfMonth } },
        ],
      }),
    ]);

    const rejectedThisMonth = monthTasksRejected + monthRequestsRejected + monthDocsRejected;

    res.json({
      awaitingReview,
      submittedToday,
      approvedThisMonth,
      rejectedThisMonth,
    });
  } catch (err) {
    console.error("[admin] Approvals metrics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/approvals — items needing or having approval decision
// ---------------------------------------------------------------------------

router.get("/approvals", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const statusParam = ((req.query.status as string) || "pending").toLowerCase();
    const categoryParam = ((req.query.category as string) || "all").toLowerCase();
    const searchParam = ((req.query.search as string) || "").trim().toLowerCase();
    const submittedToday = req.query.submittedToday === "true";
    const thisMonth = req.query.thisMonth === "true";
    const sortBy = ((req.query.sortBy as string) || "newest").toLowerCase();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));

    const now = new Date();
    let timezone = "Asia/Kolkata";
    try {
      const workingHours = await (AppSettings as any).getWorkingHoursConfig();
      if (workingHours?.timezone) {
        timezone = workingHours.timezone;
      }
    } catch {}

    const todayDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const [yearStr, monthStr] = todayDateStr.split("-");
    const startOfToday = new Date(`${todayDateStr}T00:00:00.000+05:30`);
    const endOfToday = new Date(`${todayDateStr}T23:59:59.999+05:30`);
    const startOfMonth = new Date(`${yearStr}-${monthStr}-01T00:00:00.000+05:30`);

    // Helper for computing aging
    const computeAging = (whenDate: Date | string | null | undefined, isPending: boolean) => {
      if (!whenDate) return { agingDays: 0, agingLabel: isPending ? "Today" : "Recent" };
      const d = new Date(whenDate);
      const diffMs = Math.max(0, now.getTime() - d.getTime());
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const whenStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);

      if (whenStr === todayDateStr) {
        return { agingDays: 0, agingLabel: "Today" };
      }
      if (diffDays <= 1) {
        return { agingDays: diffDays, agingLabel: isPending ? "1d waiting" : "1d ago" };
      }
      if (diffDays < 7) {
        return { agingDays: diffDays, agingLabel: isPending ? `${diffDays}d waiting` : `${diffDays}d ago` };
      }
      return { agingDays: diffDays, agingLabel: isPending ? "7d+ overdue review" : `${diffDays}d ago` };
    };

    // Queries based on statusParam
    let docFilter: Record<string, any> = {};
    let taskFilter: Record<string, any> = { isDeleted: { $ne: true } };
    let reqFilter: Record<string, any> = {};

    if (statusParam === "pending") {
      docFilter = { state: "Pending" };
      taskFilter = { ...taskFilter, status: "pending_approval" };
      reqFilter = { status: "pending" };
    } else if (statusParam === "approved") {
      docFilter = { state: "Approved" };
      taskFilter = { ...taskFilter, status: "completed", approvedAt: { $ne: null } };
      reqFilter = { status: "approved" };
      if (thisMonth) {
        taskFilter.$or = [{ approvedAt: { $gte: startOfMonth } }, { completedAt: { $gte: startOfMonth } }];
        reqFilter.reviewedAt = { $gte: startOfMonth };
        docFilter.$or = [{ approvedAt: { $gte: startOfMonth } }, { updatedAt: { $gte: startOfMonth } }];
      }
    } else if (statusParam === "rejected") {
      docFilter = { state: "Rejected" };
      taskFilter = {
        ...taskFilter,
        $or: [
          { rejectedAt: { $ne: null } },
          { status: "in_progress", rejectionReason: { $exists: true, $ne: "" } },
        ],
      };
      reqFilter = { status: "rejected" };
      if (thisMonth) {
        taskFilter.$or = [
          { rejectedAt: { $gte: startOfMonth } },
          { status: "in_progress", rejectionReason: { $exists: true, $ne: "" }, updatedAt: { $gte: startOfMonth } },
        ];
        reqFilter.reviewedAt = { $gte: startOfMonth };
        docFilter.$or = [{ rejectedAt: { $gte: startOfMonth } }, { updatedAt: { $gte: startOfMonth } }];
      }
    } else {
      // "all"
    }

    if (submittedToday) {
      taskFilter.$or = [
        { submittedForApprovalAt: { $gte: startOfToday, $lte: endOfToday } },
        { createdAt: { $gte: startOfToday, $lte: endOfToday } },
      ];
      reqFilter.createdAt = { $gte: startOfToday, $lte: endOfToday };
      docFilter.createdAt = { $gte: startOfToday, $lte: endOfToday };
    }

    const [docs, docAccessDocs, caseAccessCases, tasks, requests] = await Promise.all([
      DocumentModel.find(docFilter)
        .populate("uploadedBy", "name email role")
        .populate("caseId", "title number")
        .populate("clientId", "name")
        .sort({ createdAt: -1 })
        .lean(),
      DocumentModel.find({ "accessRequests.0": { $exists: true } })
        .populate("accessRequests.userId", "name email role")
        .populate("caseId", "title number")
        .select("name accessRequests caseId")
        .lean(),
      Case.find({ "accessRequests.0": { $exists: true } })
        .populate("accessRequests.userId", "name email role")
        .select("title number courtCaseId accessRequests")
        .lean(),
      Task.find(taskFilter)
        .populate("assignedTo", "name email role")
        .populate("assignedBy", "name email role")
        .populate("caseId", "title number courtCaseId countCaseNumber")
        .populate("clientId", "name phone email")
        .sort({ updatedAt: -1 })
        .lean(),
      ApprovalRequest.find(reqFilter)
        .populate("requesterId", "name email role")
        .populate("targetUserId", "name email role")
        .populate("originalAssigneeId", "name email role")
        .populate("reviewedBy", "name email role")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Map into normalized approval items
    const allItems: any[] = [];

    // 1. Documents
    docs.forEach((d: any) => {
      const isPending = d.state === "Pending";
      const itemStatus = isPending ? "pending" : d.state === "Approved" ? "approved" : "rejected";
      if (statusParam !== "all" && itemStatus !== statusParam) return;
      const when = d.createdAt;
      const aging = computeAging(when, isPending);
      allItems.push({
        _id: d._id.toString(),
        kind: "Document Upload",
        category: "documents",
        title: d.name,
        context: `Uploaded for review (${d.sizeFormatted || "document"})`,
        when,
        status: itemStatus,
        priority: "medium",
        agingDays: aging.agingDays,
        agingLabel: aging.agingLabel,
        submittedBy: d.uploadedBy ? {
          _id: d.uploadedBy._id?.toString(),
          name: d.uploadedBy.name,
          email: d.uploadedBy.email,
          role: d.uploadedBy.role,
        } : { name: "Employee" },
        reviewedAt: d.approvedAt || d.updatedAt,
        documentDetails: {
          _id: d._id.toString(),
          name: d.name,
          kind: d.kind,
          size: d.size,
          sizeFormatted: d.sizeFormatted,
          mimeType: d.mimeType,
          state: d.state,
          case: d.caseId ? { _id: d.caseId._id, title: d.caseId.title, number: d.caseId.number } : null,
          client: d.clientId ? { _id: d.clientId._id, name: d.clientId.name } : null,
          uploadedBy: d.uploadedBy,
          createdAt: d.createdAt,
        },
      });
    });

    // 2. Document Access Requests
    docAccessDocs.forEach((d: any) => {
      (d.accessRequests || []).forEach((ar: any) => {
        const arStatus = ar.status || "pending";
        if (statusParam !== "all" && arStatus !== statusParam) return;
        const when = ar.createdAt || new Date();
        if (submittedToday && (when < startOfToday || when > endOfToday)) return;
        const isPending = arStatus === "pending";
        const aging = computeAging(when, isPending);
        const user = ar.userId as any;
        allItems.push({
          _id: `${d._id}_access_${new Date(ar.createdAt).getTime()}`,
          kind: "Access Request",
          category: "access",
          title: d.name,
          context: ar.reason || "Document access request",
          when,
          status: arStatus,
          priority: "medium",
          agingDays: aging.agingDays,
          agingLabel: aging.agingLabel,
          submittedBy: user ? {
            _id: user._id?.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          } : { name: "Employee" },
          documentDetails: {
            _id: d._id.toString(),
            name: d.name,
            case: d.caseId,
          },
        });
      });
    });

    // 3. Case Access Requests
    caseAccessCases.forEach((c: any) => {
      (c.accessRequests || []).forEach((ar: any) => {
        const arStatus = ar.status || "pending";
        if (statusParam !== "all" && arStatus !== statusParam) return;
        const when = ar.createdAt || new Date();
        if (submittedToday && (when < startOfToday || when > endOfToday)) return;
        const isPending = arStatus === "pending";
        const aging = computeAging(when, isPending);
        const user = ar.userId as any;
        allItems.push({
          _id: `case_${c._id}_access_${new Date(ar.createdAt).getTime()}`,
          kind: "Case Request",
          category: "access",
          title: `${c.number} — ${c.title}`,
          context: ar.reason || "Case access request",
          when,
          status: arStatus,
          priority: "medium",
          agingDays: aging.agingDays,
          agingLabel: aging.agingLabel,
          submittedBy: user ? {
            _id: user._id?.toString(),
            name: user.name || ar.userName || "Employee",
            email: user.email,
            role: user.role,
          } : { name: ar.userName || "Employee" },
          caseDetails: {
            _id: c._id.toString(),
            title: c.title,
            number: c.number,
            courtCaseId: c.courtCaseId,
          },
        });
      });
    });

    // 4. Tasks
    tasks.forEach((t: any) => {
      const assignedUser = t.assignedTo as any;
      const totalItems = t.checklist?.length ?? 0;
      const doneItems = t.checklist?.filter((c: any) => c.done).length ?? 0;
      const checklistSummary = totalItems > 0 ? ` · ${doneItems}/${totalItems} subtasks completed` : "";
      const isPending = t.status === "pending_approval";
      const itemStatus = isPending ? "pending" : t.status === "completed" ? "approved" : "rejected";
      const when = t.submittedForApprovalAt || t.updatedAt || t.createdAt;
      const aging = computeAging(when, isPending);

      allItems.push({
        _id: `task_${t._id.toString()}`,
        kind: "Task Completion",
        category: "tasks",
        title: t.title,
        context: `Submitted by ${assignedUser?.name ?? "Assignee"}${checklistSummary}`,
        when,
        status: itemStatus,
        priority: t.priority || "medium",
        agingDays: aging.agingDays,
        agingLabel: aging.agingLabel,
        submittedBy: assignedUser ? {
          _id: assignedUser._id?.toString(),
          name: assignedUser.name,
          email: assignedUser.email,
          role: assignedUser.role,
        } : { name: "Assignee" },
        rejectionReason: t.rejectionReason,
        reviewedAt: t.approvedAt || t.rejectedAt || (itemStatus === "approved" ? t.completedAt : undefined),
        reviewedBy: t.rejectedBy ? { _id: t.rejectedBy.toString(), name: t.rejectedByName } : undefined,
        taskDetails: {
          _id: t._id.toString(),
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          category: t.category,
          mainCategory: t.mainCategory,
          subCategory: t.subCategory,
          deadline: t.deadline,
          completedAt: t.completedAt || t.updatedAt,
          submittedForApprovalAt: t.submittedForApprovalAt,
          approvedAt: t.approvedAt,
          rejectedAt: t.rejectedAt,
          rejectionReason: t.rejectionReason,
          rejectedByName: t.rejectedByName,
          assignedTo: t.assignedTo,
          assignedBy: t.assignedBy,
          case: t.caseId ? {
            _id: t.caseId._id,
            title: t.caseId.title,
            number: t.caseId.number,
            courtCaseId: t.caseId.courtCaseId,
            countCaseNumber: t.caseId.countCaseNumber,
          } : null,
          client: t.clientId ? {
            _id: t.clientId._id,
            name: t.clientId.name,
            phone: t.clientId.phone,
            email: t.clientId.email,
          } : null,
          checklist: t.checklist || [],
          remarks: t.remarks || [],
          assignmentHistory: t.assignmentHistory || [],
        },
      });
    });

    // 5. Approval Requests
    requests.forEach((r: any) => {
      let kind = "General Approval";
      let category = "tasks";
      if (r.type === "task_reassign") { kind = "Task Reassignment"; category = "tasks"; }
      else if (r.type === "task_delete") { kind = "Task Deletion"; category = "tasks"; }
      else if (r.type === "case_delete") { kind = "Case Deletion"; category = "cases"; }
      else if (r.type === "case_reassign") { kind = "Case Reassignment"; category = "cases"; }
      else if (r.type === "attachment_retention_purge") { kind = "Attachment Purge"; category = "documents"; }
      else if (r.type === "attachment_delete") { kind = "Attachment Deletion"; category = "documents"; }

      const requesterName = r.requesterId?.name || "Employee";
      const targetName = r.targetUserId?.name ? ` to ${r.targetUserId.name}` : "";
      const isPending = r.status === "pending";
      const when = r.createdAt;
      const aging = computeAging(when, isPending);

      allItems.push({
        _id: `approval_req_${r._id.toString()}`,
        rawApprovalId: r._id.toString(),
        kind,
        category,
        title: `${kind}${targetName}`,
        context: `Requested by ${requesterName}: "${r.reason || "No remark"}"`,
        when,
        status: r.status,
        priority: (r.metadata?.priority as string) || (r.type.includes("delete") ? "high" : "medium"),
        agingDays: aging.agingDays,
        agingLabel: aging.agingLabel,
        submittedBy: r.requesterId ? {
          _id: r.requesterId._id?.toString(),
          name: r.requesterId.name,
          email: r.requesterId.email,
          role: r.requesterId.role,
        } : { name: requesterName },
        rejectionReason: r.status === "rejected" ? r.decisionRemark : undefined,
        decisionRemark: r.decisionRemark,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy ? { _id: r.reviewedBy._id?.toString(), name: r.reviewedBy.name } : undefined,
        requestDetails: {
          _id: r._id.toString(),
          type: r.type,
          entityType: r.entityType,
          entityId: r.entityId?.toString(),
          requester: r.requesterId,
          targetUser: r.targetUserId,
          originalAssignee: r.originalAssigneeId,
          reason: r.reason,
          decisionRemark: r.decisionRemark,
          createdAt: r.createdAt,
          reviewedAt: r.reviewedAt,
          metadata: r.metadata,
        },
      });
    });

    // Compute live category counts under the active status filter
    const categoryCounts = {
      all: allItems.length,
      tasks: allItems.filter((i) => i.category === "tasks").length,
      documents: allItems.filter((i) => i.category === "documents").length,
      access: allItems.filter((i) => i.category === "access").length,
      cases: allItems.filter((i) => i.category === "cases").length,
      clients: allItems.filter((i) => i.category === "clients").length,
    };

    // Filter by Category
    let filtered = allItems;
    if (categoryParam !== "all") {
      filtered = filtered.filter((item) => item.category === categoryParam);
    }

    // Filter by Search Query
    if (searchParam) {
      filtered = filtered.filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(searchParam);
        const contextMatch = item.context?.toLowerCase().includes(searchParam);
        const submitterMatch = item.submittedBy?.name?.toLowerCase().includes(searchParam);
        const caseMatch = item.taskDetails?.case?.number?.toLowerCase().includes(searchParam) ||
          item.taskDetails?.case?.title?.toLowerCase().includes(searchParam) ||
          item.caseDetails?.number?.toLowerCase().includes(searchParam) ||
          item.caseDetails?.title?.toLowerCase().includes(searchParam);
        const clientMatch = item.taskDetails?.client?.name?.toLowerCase().includes(searchParam);
        return titleMatch || contextMatch || submitterMatch || caseMatch || clientMatch;
      });
    }

    // Sort items
    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, normal: 2, low: 1 };
    filtered.sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.when).getTime() - new Date(b.when).getTime();
      }
      if (sortBy === "waiting") {
        return (b.agingDays || 0) - (a.agingDays || 0);
      }
      if (sortBy === "priority") {
        const pA = priorityWeight[a.priority?.toLowerCase() || "medium"] || 2;
        const pB = priorityWeight[b.priority?.toLowerCase() || "medium"] || 2;
        if (pA !== pB) return pB - pA;
        return new Date(b.when).getTime() - new Date(a.when).getTime();
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      // default: newest
      return new Date(b.when).getTime() - new Date(a.when).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    res.json({
      approvals: paginated,
      total,
      page,
      limit,
      totalPages,
      categoryCounts,
    });
  } catch (err) {
    console.error("[admin] Approvals error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===========================================================================
// STORAGE ROUTES (Application Filesystem Storage)
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/storage — current application filesystem storage status
// ---------------------------------------------------------------------------

router.get("/storage", requireAdminOrPermission("settings"), async (_req: Request, res: Response) => {
  try {
    const test = await testConnection();
    res.json({
      configured: true,
      provider: "filesystem",
      storagePath: STORAGE_ROOT,
      url: STORAGE_ROOT,
      username: "",
      rootPath: STORAGE_ROOT,
      passwordSet: false,
      writable: test.ok,
      status: test.ok ? "active" : "error",
      error: test.error,
    });
  } catch (err) {
    console.error("[admin] Storage config error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/storage — acknowledge application storage config
// ---------------------------------------------------------------------------

router.patch("/storage", requireAdminOrPermission("settings"), async (_req: Request, res: Response) => {
  try {
    res.json({ message: "Application storage configuration is managed by the server environment." });
  } catch (err) {
    console.error("[admin] Save storage config error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/storage/test-connection — verify application filesystem storage
// ---------------------------------------------------------------------------

router.post("/storage/test-connection", requireAdminOrPermission("settings"), async (_req: Request, res: Response) => {
  try {
    const result = await testConnection();
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
// GET /api/reports/case-status-breakdown — case count by status
// ---------------------------------------------------------------------------

router.get("/reports/case-status-breakdown", requireAdminOrPermission("reports"), async (_req: Request, res: Response) => {
  try {
    const [activeCount, urgentCount, onHoldCount, closedCount] = await Promise.all([
      Case.countDocuments({ status: "Active" }),
      Case.countDocuments({ status: "Urgent" }),
      Case.countDocuments({ status: "On Hold" }),
      Case.countDocuments({ status: "Closed" }),
    ]);

    res.json({
      breakdown: {
        Active: activeCount,
        Urgent: urgentCount,
        "On Hold": onHoldCount,
        Closed: closedCount,
      },
      total: activeCount + urgentCount + onHoldCount + closedCount,
    });
  } catch (err) {
    console.error("[reports] Case status breakdown error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/task-status-breakdown — task count by operational status
// ---------------------------------------------------------------------------

router.get("/reports/task-status-breakdown", requireAdminOrPermission("reports"), async (_req: Request, res: Response) => {
  try {
    const [pending, in_progress, pending_approval, overdue, completed] = await Promise.all([
      Task.countDocuments({ status: "pending", isDeleted: { $ne: true } }),
      Task.countDocuments({ status: "in_progress", isDeleted: { $ne: true } }),
      Task.countDocuments({ status: "pending_approval", isDeleted: { $ne: true } }),
      Task.countDocuments({ status: "overdue", isDeleted: { $ne: true } }),
      Task.countDocuments({ status: "completed", isDeleted: { $ne: true } }),
    ]);

    res.json({
      breakdown: {
        pending,
        in_progress,
        pending_approval,
        overdue,
        completed,
      },
      total: pending + in_progress + pending_approval + overdue + completed,
    });
  } catch (err) {
    console.error("[reports] Task status breakdown error:", err);
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
          Case.countDocuments({ $or: [{ assignedTo: emp._id }, { assignedUsers: emp._id }], status: { $ne: "Closed" } }),
          Task.countDocuments({ $or: [{ assignedTo: emp._id }, { assignedUsers: emp._id }], status: { $ne: "completed" } }),
          Task.find({ $or: [{ assignedTo: emp._id }, { assignedUsers: emp._id }], status: { $ne: "completed" } })
            .sort({ priority: -1, deadline: 1 })
            .limit(1)
            .select("_id title priority deadline")
            .lean(),
          Task.countDocuments({ $or: [{ assignedTo: emp._id }, { assignedUsers: emp._id }], status: "completed" }),
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
// GET /api/admin/reports/daily-employee — employee daily progress report with task drilldown
// ---------------------------------------------------------------------------

router.get("/reports/daily-employee", requireAdminOrPermission("reports"), async (req: Request, res: Response) => {
  try {
    const { date, employeeId } = req.query as { date?: string; employeeId?: string };

    // Validate employeeId if provided (strict 24-character hexadecimal ObjectId)
    const userFilter: Record<string, unknown> = {};
    if (employeeId !== undefined && employeeId !== "") {
      if (!/^[0-9a-fA-F]{24}$/.test(employeeId)) {
        res.status(400).json({ message: "Invalid employee ID format", field: "employeeId" });
        return;
      }
      userFilter["_id"] = new Types.ObjectId(employeeId);
    }

    // Determine reporting timezone from AppSettings
    let timezone = "Asia/Kolkata";
    try {
      const workingHours = await (AppSettings as any).getWorkingHoursConfig();
      if (workingHours?.timezone) {
        timezone = workingHours.timezone;
      }
    } catch {}

    // Parse and validate date parameter (expected valid calendar date in YYYY-MM-DD format)
    let dateStr: string;
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD", field: "date" });
        return;
      }
      const [yStr, mStr, dStr] = date.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      if (m < 1 || m > 12 || d < 1 || d > 31) {
        res.status(400).json({ message: "Invalid calendar date", field: "date" });
        return;
      }
      const utcDate = new Date(Date.UTC(y, m - 1, d));
      if (utcDate.getUTCFullYear() !== y || utcDate.getUTCMonth() !== m - 1 || utcDate.getUTCDate() !== d) {
        res.status(400).json({ message: "Invalid calendar date (e.g. impossible day for month/year)", field: "date" });
        return;
      }
      dateStr = date;
    } else {
      // Current date in configured timezone
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      dateStr = parts; // YYYY-MM-DD
    }

    // Construct startOfDay and endOfDay in configured timezone
    // e.g., "2026-10-14T00:00:00+05:30"
    let tzOffsetString = "+05:30";
    try {
      const testDate = new Date(`${dateStr}T12:00:00Z`);
      const tzFormatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" });
      const tzPart = tzFormatter.formatToParts(testDate).find((p) => p.type === "timeZoneName")?.value;
      if (tzPart && tzPart.startsWith("GMT")) {
        const offsetRaw = tzPart.replace("GMT", "");
        tzOffsetString = offsetRaw || "+00:00";
      }
    } catch {}

    const tzStart = new Date(`${dateStr}T00:00:00.000${tzOffsetString}`);
    const tzEnd = new Date(`${dateStr}T23:59:59.999${tzOffsetString}`);
    const utcStart = new Date(`${dateStr}T00:00:00.000Z`);
    const utcEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const startOfDay = new Date(Math.min(tzStart.getTime(), utcStart.getTime()));
    const endOfDay = new Date(Math.max(tzEnd.getTime(), utcEnd.getTime()));

    if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
      res.status(400).json({ message: "Invalid date value", field: "date" });
      return;
    }

    // Overdue cutoff:
    // If reporting for today, anything whose deadline < now is overdue.
    // If reporting for a historical date, anything not completed whose deadline was before endOfDay.
    const now = new Date();
    const isToday = now >= startOfDay && now <= endOfDay;
    const overdueCutoff = isToday ? now : endOfDay;

    const employees = await User.find(userFilter).select("name email role title status").lean();

    const employeeReports = await Promise.all(
      employees.map(async (emp) => {
        const empId = emp._id;
        const empObjId = new Types.ObjectId(empId);
        const empCaseMatch = { $or: [{ assignedTo: empObjId }, { assignedUsers: empObjId }] };

        const [
          assignedTasks,
          completedTasks,
          pendingTasks,
          overdueTasks,
          auditLogsToday,
          casesCompletedToday,
          totalTasksCompleted,
          totalTasksAssigned,
          totalCasesAssigned,
          totalCasesActive,
          totalCasesClosed,
          totalAuditLogsCount,
          recentAllTimeAuditLogs,
          activeCasesList,
        ] = await Promise.all([
          // Tasks assigned to this employee today or created today
          Task.find({
            assignedTo: empId,
            $or: [
              { createdAt: { $gte: startOfDay, $lte: endOfDay } },
              { assignedAt: { $gte: startOfDay, $lte: endOfDay } },
            ],
            isDeleted: { $ne: true },
          })
            .populate("caseId", "title number")
            .populate("clientId", "name phone")
            .lean(),

          // Tasks completed today
          Task.find({
            assignedTo: empId,
            status: "completed",
            completedAt: { $gte: startOfDay, $lte: endOfDay },
            isDeleted: { $ne: true },
          })
            .populate("caseId", "title number")
            .populate("clientId", "name phone")
            .lean(),

          // Active pending tasks
          Task.find({
            assignedTo: empId,
            status: { $in: ["pending", "in_progress", "pending_approval"] },
            isDeleted: { $ne: true },
          })
            .populate("caseId", "title number")
            .populate("clientId", "name phone")
            .lean(),

          // Overdue tasks
          Task.find({
            assignedTo: empId,
            status: { $ne: "completed" },
            deadline: { $lt: overdueCutoff },
            isDeleted: { $ne: true },
          })
            .populate("caseId", "title number")
            .populate("clientId", "name phone")
            .lean(),

          // Audit logs generated by this specific employee today
          AuditLog.find({
            userId: empObjId,
            createdAt: { $gte: startOfDay, $lte: endOfDay },
          })
            .sort({ createdAt: -1 })
            .limit(100)
            .select("action resource resourceId resourceName details createdAt ip")
            .lean(),

          // Cases completed/closed today where this employee was assigned or updated
          Case.find({
            isDeleted: { $ne: true },
            status: "Closed",
            $and: [
              { $or: [{ assignedTo: empObjId }, { assignedUsers: empObjId }, { updatedBy: empObjId }] },
              {
                $or: [
                  { completedAt: { $gte: startOfDay, $lte: endOfDay } },
                  { updatedAt: { $gte: startOfDay, $lte: endOfDay } },
                ],
              },
            ],
          })
            .select("number title court practice status priority nextHearing completedAt updatedAt parties")
            .lean(),

          // All-time metrics: lifetime tasks completed
          Task.countDocuments({ assignedTo: empId, status: "completed", isDeleted: { $ne: true } }),
          // All-time metrics: lifetime tasks assigned
          Task.countDocuments({ assignedTo: empId, isDeleted: { $ne: true } }),
          // All-time metrics: total cases assigned
          Case.countDocuments({ ...empCaseMatch, isDeleted: { $ne: true } }),
          // All-time metrics: active cases count
          Case.countDocuments({ ...empCaseMatch, status: { $nin: ["Closed", "Archived"] }, isDeleted: { $ne: true } }),
          // All-time metrics: closed cases count
          Case.countDocuments({ ...empCaseMatch, status: "Closed", isDeleted: { $ne: true } }),
          // All-time metrics: total audit logs count
          AuditLog.countDocuments({ userId: empObjId }),
          // All-time metrics: recent 25 audit logs across lifetime
          AuditLog.find({ userId: empObjId })
            .sort({ createdAt: -1 })
            .limit(25)
            .select("action resource resourceId resourceName details createdAt ip")
            .lean(),
          // All-time metrics: top 10 active cases list
          Case.find({ ...empCaseMatch, status: { $nin: ["Closed", "Archived"] }, isDeleted: { $ne: true } })
            .sort({ updatedAt: -1 })
            .limit(10)
            .select("number title court practice status priority nextHearing updatedAt parties")
            .lean(),
        ]);

        // Aggregate cases worked on today from tasks & case audit logs & completed cases
        const caseIdSet = new Set<string>();
        for (const t of completedTasks) {
          const taskObj = t as any;
          const cId = taskObj.caseId && typeof taskObj.caseId === "object" ? taskObj.caseId._id?.toString() : taskObj.caseId?.toString();
          if (cId && Types.ObjectId.isValid(cId)) caseIdSet.add(cId);
        }
        for (const t of assignedTasks) {
          const taskObj = t as any;
          const cId = taskObj.caseId && typeof taskObj.caseId === "object" ? taskObj.caseId._id?.toString() : taskObj.caseId?.toString();
          if (cId && Types.ObjectId.isValid(cId)) caseIdSet.add(cId);
        }
        for (const log of auditLogsToday) {
          if (log.resource === "case" && log.resourceId && Types.ObjectId.isValid(log.resourceId)) {
            caseIdSet.add(log.resourceId);
          }
        }
        for (const c of casesCompletedToday) {
          caseIdSet.add(c._id.toString());
        }

        let casesWorkedOnToday: any[] = [];
        if (caseIdSet.size > 0) {
          const caseObjIds = Array.from(caseIdSet).map((id) => new Types.ObjectId(id));
          casesWorkedOnToday = await Case.find({
            _id: { $in: caseObjIds },
            isDeleted: { $ne: true },
          })
            .select("number title court practice status priority nextHearing completedAt updatedAt parties")
            .lean();
        }

        const completionRate = totalTasksAssigned > 0
          ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100)
          : 0;

        return {
          employee: {
            _id: emp._id.toString(),
            name: emp.name,
            email: emp.email,
            role: emp.role,
            title: emp.title,
            status: emp.status,
          },
          metrics: {
            assignedTodayCount: assignedTasks.length,
            completedTodayCount: completedTasks.length,
            pendingCount: pendingTasks.length,
            overdueCount: overdueTasks.length,
            auditLogsTodayCount: auditLogsToday.length,
            casesWorkedTodayCount: casesWorkedOnToday.length,
            casesCompletedTodayCount: casesCompletedToday.length,
          },
          tasks: {
            assignedToday: assignedTasks,
            completedToday: completedTasks,
            pending: pendingTasks,
            overdue: overdueTasks,
          },
          cases: {
            completedToday: casesCompletedToday,
            workedOnToday: casesWorkedOnToday,
          },
          auditLogs: auditLogsToday,
          allTime: {
            tasksCompleted: totalTasksCompleted,
            tasksAssigned: totalTasksAssigned,
            tasksPending: pendingTasks.length,
            tasksOverdue: overdueTasks.length,
            completionRate,
            activeCasesCount: totalCasesActive,
            totalCasesCount: totalCasesAssigned,
            closedCasesCount: totalCasesClosed,
            totalAuditLogsCount,
            recentAuditLogs: recentAllTimeAuditLogs,
            activeCases: activeCasesList,
          },
        };
      })
    );

    res.json({
      date: dateStr,
      reports: employeeReports,
    });
  } catch (err) {
    console.error("[reports] Daily employee report error:", err);
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

// ---------------------------------------------------------------------------
// GET /api/admin/reports/client-reports — all clients overview for reports
// ---------------------------------------------------------------------------

router.get("/reports/client-reports", requireAdminOrPermission("reports"), async (req: Request, res: Response) => {
  try {
    const { search, tag, type } = req.query as { search?: string; tag?: string; type?: string };
    const filter: Record<string, unknown> = {};

    if (tag && tag !== "All") filter["tag"] = tag;
    if (type && type !== "All") filter["type"] = type;

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter["$or"] = [{ name: rx }, { phone: rx }, { email: rx }, { aadhar: rx }, { pan: rx }];
    }

    const clients = await Client.find(filter)
      .select("name email phone type tag kyc promisedCompletionDate visits createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const clientReports = await Promise.all(
      clients.map(async (c) => {
        const cId = c._id;
        const [activeCases, totalCases, pendingTasks, completedTasks, docCount] = await Promise.all([
          Case.countDocuments({
            $or: [{ "parties.clientId": cId }, { "parties.name": c.name, "parties.type": "client" }],
            status: { $nin: ["Closed", "Archived"] },
            isDeleted: { $ne: true },
          }),
          Case.countDocuments({
            $or: [{ "parties.clientId": cId }, { "parties.name": c.name, "parties.type": "client" }],
            isDeleted: { $ne: true },
          }),
          Task.countDocuments({
            clientId: cId,
            status: { $in: ["pending", "in_progress", "pending_approval"] },
            isDeleted: { $ne: true },
          }),
          Task.countDocuments({
            clientId: cId,
            status: "completed",
            isDeleted: { $ne: true },
          }),
          DocumentModel.countDocuments({
            clientId: cId,
          }),
        ]);

        return {
          _id: c._id.toString(),
          name: c.name,
          email: c.email || "",
          phone: c.phone || "",
          type: c.type,
          tag: c.tag,
          kyc: c.kyc,
          promisedCompletionDate: c.promisedCompletionDate || null,
          visitCount: Array.isArray((c as any).visits) ? (c as any).visits.length : 0,
          lastVisitAt: Array.isArray((c as any).visits) && (c as any).visits.length > 0
            ? (c as any).visits[(c as any).visits.length - 1].visitedAt
            : null,
          metrics: {
            activeCases,
            totalCases,
            pendingTasks,
            completedTasks,
            documentCount: docCount,
          },
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      })
    );

    res.json({ clients: clientReports });
  } catch (err) {
    console.error("[reports] Client reports list error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/reports/client-detail/:id — full client report drill-down
// ---------------------------------------------------------------------------

router.get("/reports/client-detail/:id", requireAdminOrPermission("reports"), async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid client ID format" });
      return;
    }

    const clientObjId = new Types.ObjectId(id);
    const client = await Client.findById(clientObjId)
      .populate("assignedTo", "name email role")
      .populate("visits.handledBy", "name email role")
      .populate("visits.recordedBy", "name email role")
      .lean();

    if (!client) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    const [cases, tasks, documents, auditLogs] = await Promise.all([
      Case.find({
        $or: [{ "parties.clientId": clientObjId }, { "parties.name": client.name, "parties.type": "client" }],
        isDeleted: { $ne: true },
      })
        .populate("assignedTo", "name email role")
        .sort({ updatedAt: -1 })
        .lean(),

      Task.find({
        clientId: clientObjId,
        isDeleted: { $ne: true },
      })
        .populate("assignedTo", "name email role")
        .populate("caseId", "title number courtCaseId")
        .sort({ createdAt: -1 })
        .lean(),

      DocumentModel.find({ clientId: clientObjId })
        .populate("uploadedBy", "name email")
        .populate("caseId", "title number")
        .sort({ createdAt: -1 })
        .lean(),

      AuditLog.find({
        $or: [
          { resource: "client", resourceId: id },
          { resource: "case", resourceName: new RegExp(client.name, "i") },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const activeCasesCount = cases.filter((c) => !["Closed", "Archived"].includes(c.status)).length;
    const completedTasksCount = tasks.filter((t) => t.status === "completed").length;
    const pendingTasksCount = tasks.filter((t) => ["pending", "in_progress", "pending_approval"].includes(t.status)).length;
    const overdueTasksCount = tasks.filter((t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date()).length;

    res.json({
      client,
      metrics: {
        totalCases: cases.length,
        activeCases: activeCasesCount,
        closedCases: cases.length - activeCasesCount,
        totalTasks: tasks.length,
        completedTasks: completedTasksCount,
        pendingTasks: pendingTasksCount,
        overdueTasks: overdueTasksCount,
        totalDocuments: documents.length,
        totalVisits: (client as any).visits?.length || 0,
      },
      cases,
      tasks,
      documents,
      auditLogs,
    });
  } catch (err) {
    console.error("[reports] Client detail report error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/reports/employee-detail/:id — full employee report drill-down
// ---------------------------------------------------------------------------

router.get("/reports/employee-detail/:id", requireAdminOrPermission("reports"), async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid employee ID format" });
      return;
    }

    const empObjId = new Types.ObjectId(id);
    const employee = await User.findById(empObjId).select("name email role title status createdAt").lean();
    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const dateFilter: Record<string, unknown> = {};
    if (startDate || endDate) {
      const range: Record<string, Date> = {};
      if (startDate) range["$gte"] = new Date(startDate);
      if (endDate) range["$lte"] = new Date(endDate);
      dateFilter["createdAt"] = range;
    }

    const [allTasks, cases, auditLogs] = await Promise.all([
      Task.find({
        $or: [{ assignedTo: empObjId }, { assignedUsers: empObjId }],
        isDeleted: { $ne: true },
        ...dateFilter,
      })
        .populate("caseId", "title number courtCaseId")
        .populate("clientId", "name phone")
        .sort({ updatedAt: -1 })
        .lean(),

      Case.find({
        $or: [{ assignedTo: empObjId }, { assignedUsers: empObjId }],
        isDeleted: { $ne: true },
      })
        .select("number title court practice status priority nextHearing completedAt updatedAt parties")
        .sort({ updatedAt: -1 })
        .lean(),

      AuditLog.find({
        userId: empObjId,
        ...dateFilter,
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const completedTasks = allTasks.filter((t) => t.status === "completed");
    const pendingTasks = allTasks.filter((t) => ["pending", "in_progress", "pending_approval"].includes(t.status));
    const overdueTasks = allTasks.filter((t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date());
    const activeCases = cases.filter((c) => !["Closed", "Archived"].includes(c.status));

    const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    res.json({
      employee,
      metrics: {
        totalTasks: allTasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        overdueTasks: overdueTasks.length,
        completionRate,
        totalCases: cases.length,
        activeCases: activeCases.length,
        closedCases: cases.length - activeCases.length,
        totalAuditLogs: auditLogs.length,
      },
      tasks: allTasks,
      cases,
      auditLogs,
    });
  } catch (err) {
    console.error("[reports] Employee detail report error:", err);
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