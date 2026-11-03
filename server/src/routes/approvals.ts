import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { ApprovalRequest } from "../models/ApprovalRequest.js";
import { Task } from "../models/Task.js";
import { Case } from "../models/Case.js";
import { DocumentModel } from "../models/Document.js";
import { AppSettings } from "../models/AppSettings.js";
import { requireAuth, requireAdminOrPermission } from "../middleware/auth.js";
import {
  validateRemark,
  computeApprovalAging,
  formatTaskApprovalItem,
  formatRequestApprovalItem,
  fetchApprovalDetail,
  executeApproveAction,
  executeRejectAction,
} from "../utils/approvalHelpers.js";

const router = Router();
router.use(requireAuth);

/**
 * Helper to compute approvals list with filtering, searching, sorting & pagination
 */
async function getAggregatedApprovals(query: Record<string, any>) {
  const statusParam = ((query.status as string) || "pending").toLowerCase();
  const categoryParam = ((query.category as string) || "all").toLowerCase();
  const searchParam = ((query.search as string) || "").trim().toLowerCase();
  const submittedToday = query.submittedToday === "true";
  const thisMonth = query.thisMonth === "true";
  const sortBy = ((query.sortBy as string) || "newest").toLowerCase();
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string, 10) || 25));
  const typeFilter = query.type as string | undefined;

  const now = new Date();
  let timezone = "Asia/Kolkata";
  try {
    const workingHours = await (AppSettings as any).getWorkingHoursConfig();
    if (workingHours?.timezone) {
      timezone = workingHours.timezone;
    }
  } catch {}

  const computeAging = (d: any, p: boolean) => computeApprovalAging(d, p, now, timezone);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 1. Task query
  const taskQuery: any = { isDeleted: { $ne: true } };
  if (statusParam === "pending") {
    taskQuery.status = "pending_approval";
  } else if (statusParam === "approved") {
    taskQuery.status = "completed";
    taskQuery.approvedAt = { $exists: true, $ne: null };
  } else if (statusParam === "rejected") {
    taskQuery.rejectedAt = { $exists: true, $ne: null };
  } else if (statusParam === "all") {
    taskQuery.$or = [
      { status: "pending_approval" },
      { approvedAt: { $exists: true, $ne: null } },
      { rejectedAt: { $exists: true, $ne: null } },
    ];
  }

  if (submittedToday) {
    taskQuery.submittedForApprovalAt = { $gte: startOfToday, $lte: endOfToday };
  }
  if (thisMonth) {
    taskQuery.submittedForApprovalAt = { $gte: startOfMonth, $lte: endOfMonth };
  }

  // 2. ApprovalRequest query
  const reqQuery: any = {};
  if (statusParam !== "all") {
    reqQuery.status = statusParam;
  }
  if (typeFilter) {
    reqQuery.type = typeFilter;
  }
  if (submittedToday) {
    reqQuery.createdAt = { $gte: startOfToday, $lte: endOfToday };
  }
  if (thisMonth) {
    reqQuery.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
  }

  // 3. Document query
  const docQuery: any = { isDeleted: { $ne: true } };
  if (statusParam === "pending") {
    docQuery.state = "Pending";
  } else if (statusParam === "approved") {
    docQuery.state = "Approved";
  } else if (statusParam === "rejected") {
    docQuery.state = "Rejected";
  }
  if (submittedToday) {
    docQuery.createdAt = { $gte: startOfToday, $lte: endOfToday };
  }
  if (thisMonth) {
    docQuery.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
  }

  // 4. Access requests query
  const docAccessQuery: any = { "accessRequests.0": { $exists: true } };
  const caseAccessQuery: any = { "accessRequests.0": { $exists: true } };

  const [tasks, requests, docs, docAccessDocs, caseAccessCases] = await Promise.all([
    Task.find(taskQuery)
      .populate("assignedTo", "name email role avatarUrl")
      .populate("assignedUsers", "name email role avatarUrl")
      .populate("assignedBy", "name email role avatarUrl")
      .populate("submittedForApprovalBy", "name email role avatarUrl")
      .populate("submittedBy", "name email role avatarUrl")
      .populate("createdBy", "name email role avatarUrl")
      .populate("updatedBy", "name email role avatarUrl")
      .populate("rejectedBy", "name email role")
      .populate("assignmentHistory.toUser", "name email role")
      .populate("assignmentHistory.fromUser", "name email role")
      .populate("assignmentHistory.assignedBy", "name email role")
      .populate("caseId", "title number courtCaseId countCaseNumber")
      .populate("clientId", "name phone email")
      .lean(),
    ApprovalRequest.find(reqQuery)
      .populate("requesterId", "name email role avatarUrl")
      .populate("targetUserId", "name email role avatarUrl")
      .populate("originalAssigneeId", "name email role avatarUrl")
      .populate("reviewedBy", "name email role")
      .populate("entityId")
      .lean(),
    DocumentModel.find(docQuery)
      .populate("uploadedBy", "name email role")
      .populate("caseId", "title number")
      .populate("taskId", "title status number caseId")
      .populate("clientId", "name")
      .lean(),
    DocumentModel.find(docAccessQuery)
      .populate("accessRequests.userId", "name email role")
      .populate("caseId", "title number")
      .lean(),
    Case.find(caseAccessQuery)
      .populate("accessRequests.userId", "name email role")
      .select("title number courtCaseId accessRequests")
      .lean(),
  ]);

  // Fetch documents attached to retrieved tasks
  const taskIds = tasks.map((t) => t._id);
  const taskDocs = taskIds.length > 0
    ? await DocumentModel.find({ taskId: { $in: taskIds } })
        .select("_id name originalName size sizeFormatted mimeType state createdAt uploadedBy version taskId")
        .populate("uploadedBy", "name email role")
        .sort({ createdAt: -1 })
        .lean()
    : [];

  const taskDocsMap: Record<string, any[]> = {};
  taskDocs.forEach((d) => {
    const tid = d.taskId?.toString();
    if (tid) {
      if (!taskDocsMap[tid]) taskDocsMap[tid] = [];
      taskDocsMap[tid].push(d);
    }
  });

  const allItems: any[] = [];

  // Track existing entity IDs to avoid duplicates if an entity appears in both tasks and ApprovalRequests
  const handledTaskIds = new Set<string>();

  // Format and include Approval Requests first
  requests.forEach((r: any) => {
    if (r.entityId && (r.entityType === "Task" || r.type === "task_completion")) {
      const eid = typeof r.entityId === "object" ? r.entityId._id?.toString() : r.entityId.toString();
      if (eid) handledTaskIds.add(eid);
    }
    allItems.push(formatRequestApprovalItem(r, computeAging));
  });

  // Format and include Tasks (excluding any already represented by an ApprovalRequest if redundant)
  tasks.forEach((t: any) => {
    const tid = t._id.toString();
    if (!handledTaskIds.has(tid)) {
      allItems.push(formatTaskApprovalItem(t, computeAging, taskDocsMap));
    }
  });

  // Document Uploads
  docs.forEach((d: any) => {
    const isPending = d.state === "Pending";
    const itemStatus = isPending ? "pending" : d.state === "Approved" ? "approved" : "rejected";
    const when = d.createdAt;
    const aging = computeAging(when, isPending);
    const taskContext = d.taskId?.title ? ` for task "${d.taskId.title}"` : "";
    const docCase = d.caseId
      ? { _id: d.caseId._id, title: d.caseId.title, number: d.caseId.number }
      : d.taskId?.caseId
      ? { _id: d.taskId.caseId._id || d.taskId.caseId, title: d.taskId.caseId.title, number: d.taskId.caseId.number }
      : null;

    allItems.push({
      _id: d._id.toString(),
      id: d._id.toString(),
      kind: "Document Upload",
      type: "Document Upload",
      category: "documents",
      title: d.name,
      context: `Uploaded for review (${d.sizeFormatted || "document"})${taskContext}`,
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
        case: docCase,
        task: d.taskId ? { _id: d.taskId._id, title: d.taskId.title, status: d.taskId.status } : null,
        client: d.clientId ? { _id: d.clientId._id, name: d.clientId.name } : null,
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt,
      },
    });
  });

  // Document Access Requests
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
        id: `${d._id}_access_${new Date(ar.createdAt).getTime()}`,
        kind: "Access Request",
        type: "Access Request",
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

  // Case Access Requests
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
        id: `case_${c._id}_access_${new Date(ar.createdAt).getTime()}`,
        kind: "Case Request",
        type: "Case Request",
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

  // Compute live category counts
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
      return (a.title || "").localeCompare(b.title || "");
    }
    // default: newest
    return new Date(b.when).getTime() - new Date(a.when).getTime();
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  return {
    approvals: paginated,
    total,
    page,
    limit,
    totalPages,
    categoryCounts,
  };
}

/**
 * GET /api/approvals
 * Lists pending or historical approval requests across tasks, documents, and access requests
 */
router.get("/", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const result = await getAggregatedApprovals(req.query);
    res.json(result);
  } catch (err) {
    console.error("[approvals] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/approvals/metrics & GET /api/approvals/stats
 * Statistics and summary metrics for approvals
 */
async function getApprovalMetricsHandler(_req: Request, res: Response) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      pendingTasks,
      pendingRequests,
      pendingDocs,
      pendingDocAccess,
      pendingCaseAccess,
      todayTasks,
      todayRequests,
      monthApprovedTasks,
      monthApprovedRequests,
      monthRejectedTasks,
      monthRejectedRequests,
      totalRequests,
      totalTaskCompletion,
    ] = await Promise.all([
      Task.countDocuments({ status: "pending_approval", isDeleted: { $ne: true } }),
      ApprovalRequest.countDocuments({ status: "pending" }),
      DocumentModel.countDocuments({ state: "Pending", isDeleted: { $ne: true } }),
      DocumentModel.countDocuments({ "accessRequests.status": "pending" }),
      Case.countDocuments({ "accessRequests.status": "pending" }),
      Task.countDocuments({
        status: "pending_approval",
        submittedForApprovalAt: { $gte: startOfToday, $lte: endOfToday },
        isDeleted: { $ne: true },
      }),
      ApprovalRequest.countDocuments({
        createdAt: { $gte: startOfToday, $lte: endOfToday },
      }),
      Task.countDocuments({
        status: "completed",
        approvedAt: { $gte: startOfMonth, $lte: endOfMonth },
        isDeleted: { $ne: true },
      }),
      ApprovalRequest.countDocuments({
        status: "approved",
        reviewedAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
      Task.countDocuments({
        rejectedAt: { $gte: startOfMonth, $lte: endOfMonth },
        isDeleted: { $ne: true },
      }),
      ApprovalRequest.countDocuments({
        status: "rejected",
        reviewedAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
      ApprovalRequest.countDocuments({}),
      ApprovalRequest.countDocuments({ type: "task_completion" }),
    ]);

    const awaitingReview = pendingTasks + pendingRequests + pendingDocs + pendingDocAccess + pendingCaseAccess;
    const submittedToday = todayTasks + todayRequests;
    const approvedThisMonth = monthApprovedTasks + monthApprovedRequests;
    const rejectedThisMonth = monthRejectedTasks + monthRejectedRequests;

    res.json({
      awaitingReview,
      submittedToday,
      approvedThisMonth,
      rejectedThisMonth,
      total: awaitingReview + approvedThisMonth + rejectedThisMonth,
      pending: awaitingReview,
      approved: approvedThisMonth,
      rejected: rejectedThisMonth,
      taskCompletion: pendingTasks + totalTaskCompletion,
      categoryCounts: {
        all: awaitingReview,
        tasks: pendingTasks + totalTaskCompletion,
        documents: pendingDocs,
        access: pendingDocAccess + pendingCaseAccess,
        cases: 0,
        clients: 0,
      },
    });
  } catch (err) {
    console.error("[approvals] Metrics error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

router.get("/metrics", requireAdminOrPermission("approvals"), getApprovalMetricsHandler);
router.get("/stats", requireAdminOrPermission("approvals"), getApprovalMetricsHandler);

/**
 * GET /api/approvals/task/:taskId
 * Lists approval requests associated with a specific task
 */
router.get("/task/:taskId", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const taskId = String(req.params["taskId"] || "");
    if (!taskId || !Types.ObjectId.isValid(taskId)) {
      res.status(400).json({ message: "Invalid task ID format" });
      return;
    }

    const requests = await ApprovalRequest.find({ entityId: taskId })
      .populate("requesterId", "name email role avatarUrl")
      .populate("targetUserId", "name email role avatarUrl")
      .populate("originalAssigneeId", "name email role avatarUrl")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const task = await Task.findById(taskId).lean();
    const taskApprovals: any[] = [];
    if (task && (task.status === "pending_approval" || task.approvedAt || task.rejectedAt)) {
      const now = new Date();
      taskApprovals.push(formatTaskApprovalItem(task, (d, p) => computeApprovalAging(d, p, now)));
    }

    res.json({
      approvals: requests,
      taskApprovals,
      total: requests.length + taskApprovals.length,
    });
  } catch (err) {
    console.error("[approvals] Task approvals error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/approvals/:id
 * Retrieve details for a single approval request
 */
router.get("/:id", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const rawId = String(req.params["id"] || "");
    const item = await fetchApprovalDetail(rawId);
    if (!item) {
      res.status(404).json({ message: "Approval request not found" });
      return;
    }
    res.json({ approval: item });
  } catch (err: any) {
    console.error("[approvals] Get approval detail error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * Handle Approve action (POST /:id/approve and PATCH /:id/approve)
 */
async function handleApprove(req: Request, res: Response) {
  try {
    const remarkCheck = validateRemark(req.body.remark || req.body.decisionRemark);
    if (!remarkCheck.valid) {
      res.status(400).json({ message: remarkCheck.error, field: "remark" });
      return;
    }

    const rawId = String(req.params["id"] || "");
    const result = await executeApproveAction({
      rawId,
      user: req.user,
      userId: req.userId!,
      cleanRemark: remarkCheck.clean!,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      io: req.app.get("io"),
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("[approvals] Approve error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
}

router.post("/:id/approve", requireAdminOrPermission("approvals"), handleApprove);
router.patch("/:id/approve", requireAdminOrPermission("approvals"), handleApprove);

/**
 * Handle Reject action (POST /:id/reject and PATCH /:id/reject)
 */
async function handleReject(req: Request, res: Response) {
  try {
    const rawRemark = req.body.remark || req.body.reason || req.body.decisionRemark;
    const remarkCheck = validateRemark(rawRemark);
    if (!remarkCheck.valid) {
      res.status(400).json({ message: remarkCheck.error, field: "remark" });
      return;
    }
    if (!remarkCheck.clean) {
      res.status(400).json({ message: "A reason or remark is required when rejecting a request", field: "remark" });
      return;
    }

    const rawId = String(req.params["id"] || "");
    const result = await executeRejectAction({
      rawId,
      user: req.user,
      userId: req.userId!,
      cleanRemark: remarkCheck.clean,
      isRequestChanges: false,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      io: req.app.get("io"),
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("[approvals] Reject error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
}

router.post("/:id/reject", requireAdminOrPermission("approvals"), handleReject);
router.patch("/:id/reject", requireAdminOrPermission("approvals"), handleReject);

/**
 * Handle Request Changes action (POST /:id/request-changes and PATCH /:id/request-changes)
 */
async function handleRequestChanges(req: Request, res: Response) {
  try {
    const rawRemark = req.body.remark || req.body.reason || req.body.decisionRemark;
    const remarkCheck = validateRemark(rawRemark);
    if (!remarkCheck.valid) {
      res.status(400).json({ message: remarkCheck.error, field: "remark" });
      return;
    }
    if (!remarkCheck.clean) {
      res.status(400).json({ message: "A reason or remark is required when requesting changes", field: "remark" });
      return;
    }

    const rawId = String(req.params["id"] || "");
    const result = await executeRejectAction({
      rawId,
      user: req.user,
      userId: req.userId!,
      cleanRemark: remarkCheck.clean,
      isRequestChanges: true,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      io: req.app.get("io"),
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("[approvals] Request changes error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
}

router.post("/:id/request-changes", requireAdminOrPermission("approvals"), handleRequestChanges);
router.patch("/:id/request-changes", requireAdminOrPermission("approvals"), handleRequestChanges);

export const approvalsRouter = router;
export default router;
