import { Types } from "mongoose";
import { ApprovalRequest } from "../models/ApprovalRequest.js";
import { Task } from "../models/Task.js";
import { Case } from "../models/Case.js";
import { User } from "../models/User.js";
import { DocumentModel } from "../models/Document.js";
import { AuditLog } from "../models/AuditLog.js";
import { AppSettings } from "../models/AppSettings.js";
import { NotificationService } from "../services/notifications.js";
import { deleteFile } from "../services/storage.js";
import { resolveTaskClientName } from "./taskHelpers.js";
import { dispatchRejectionNotifications } from "../services/rejectionNotifications.js";

export function validateRemark(remark: unknown): { valid: boolean; error?: string; clean?: string } {
  if (remark === undefined || remark === null || (typeof remark === "string" && !remark.trim())) {
    return { valid: true, clean: "" };
  }
  const clean = typeof remark === "string" ? remark.trim() : "";
  if (clean && clean.length > 1000) {
    return { valid: false, error: "Decision remark cannot exceed 1000 characters." };
  }
  return { valid: true, clean };
}

export function computeApprovalAging(
  whenDate: Date | string | null | undefined,
  isPending: boolean,
  now = new Date(),
  timezone = "Asia/Kolkata"
) {
  if (!whenDate) return { agingDays: 0, agingLabel: isPending ? "Today" : "Recent" };
  const d = new Date(whenDate);
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const todayDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

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
}

export function resolveTaskSubmitter(t: any) {
  const subUser = t.submittedForApprovalBy || t.submittedBy;
  if (subUser && subUser.name) {
    return {
      _id: subUser._id?.toString(),
      name: subUser.name,
      email: subUser.email,
      role: subUser.role,
      avatarUrl: subUser.avatarUrl,
    };
  }
  if (t.updatedBy && t.updatedBy.name && t.updatedBy.role !== "admin") {
    return {
      _id: t.updatedBy._id?.toString(),
      name: t.updatedBy.name,
      email: t.updatedBy.email,
      role: t.updatedBy.role,
      avatarUrl: t.updatedBy.avatarUrl,
    };
  }
  if (Array.isArray(t.remarks) && t.remarks.length > 0) {
    const lastRemark = t.remarks[t.remarks.length - 1];
    if (lastRemark.authorName || lastRemark.author) {
      return {
        _id: lastRemark.authorId?.toString(),
        name: lastRemark.authorName || lastRemark.author,
        role: "Staff",
      };
    }
  }
  if (t.assignedTo && t.assignedTo.name) {
    return {
      _id: t.assignedTo._id?.toString(),
      name: t.assignedTo.name,
      email: t.assignedTo.email,
      role: t.assignedTo.role,
      avatarUrl: t.assignedTo.avatarUrl,
    };
  }
  if (Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0 && t.assignedUsers[0]?.name) {
    return {
      _id: t.assignedUsers[0]._id?.toString(),
      name: t.assignedUsers[0].name,
      email: t.assignedUsers[0].email,
      role: t.assignedUsers[0].role,
      avatarUrl: t.assignedUsers[0].avatarUrl,
    };
  }
  return {
    name: "Historical Submitter Unavailable",
    role: "Staff",
  };
}

export function resolveTaskAssignee(t: any) {
  if (t.assignedTo && t.assignedTo.name) {
    return {
      _id: t.assignedTo._id?.toString(),
      name: t.assignedTo.name,
      email: t.assignedTo.email,
      role: t.assignedTo.role,
      avatarUrl: t.assignedTo.avatarUrl,
    };
  }
  if (Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0 && t.assignedUsers[0]?.name) {
    return {
      _id: t.assignedUsers[0]._id?.toString(),
      name: t.assignedUsers.map((u: any) => u.name).filter(Boolean).join(", "),
      email: t.assignedUsers[0].email,
      role: t.assignedUsers[0].role,
      avatarUrl: t.assignedUsers[0].avatarUrl,
    };
  }
  return {
    name: "Unassigned",
    role: "Unassigned",
  };
}

export function resolveTaskAssigner(t: any) {
  if (t.assignedBy && t.assignedBy.name) {
    return {
      _id: t.assignedBy._id?.toString(),
      name: t.assignedBy.name,
      email: t.assignedBy.email,
      role: t.assignedBy.role,
      avatarUrl: t.assignedBy.avatarUrl,
    };
  }
  if (Array.isArray(t.assignmentHistory) && t.assignmentHistory.length > 0) {
    for (let i = t.assignmentHistory.length - 1; i >= 0; i--) {
      const h = t.assignmentHistory[i];
      if (h?.assignedBy && h.assignedBy.name) {
        return {
          _id: h.assignedBy._id?.toString(),
          name: h.assignedBy.name,
          email: h.assignedBy.email,
          role: h.assignedBy.role,
        };
      }
    }
  }
  if (t.createdBy && t.createdBy.name) {
    return {
      _id: t.createdBy._id?.toString(),
      name: t.createdBy.name,
      email: t.createdBy.email,
      role: t.createdBy.role,
      avatarUrl: t.createdBy.avatarUrl,
    };
  }
  return {
    name: "Historical information unavailable",
    role: "Administrator",
  };
}

export function resolveTaskAssignedAt(t: any) {
  if (t.assignedAt) return t.assignedAt;
  if (Array.isArray(t.assignmentHistory) && t.assignmentHistory.length > 0) {
    for (let i = t.assignmentHistory.length - 1; i >= 0; i--) {
      if (t.assignmentHistory[i]?.timestamp) return t.assignmentHistory[i].timestamp;
    }
  }
  return t.createdAt || null;
}

export function resolveTaskSubmittedAt(t: any) {
  return t.submittedForApprovalAt || t.completedAt || t.updatedAt || t.createdAt;
}

export function formatTaskApprovalItem(
  t: any,
  computeAging: (d: any, p: boolean) => any,
  taskDocsMap: Record<string, any[]> = {}
) {
  const subUser = resolveTaskSubmitter(t);
  const assignUser = resolveTaskAssignee(t);
  const byUser = resolveTaskAssigner(t);
  const assignAt = resolveTaskAssignedAt(t);
  const submitAt = resolveTaskSubmittedAt(t);

  const totalItems = t.checklist?.length ?? 0;
  const doneItems = t.checklist?.filter((c: any) => c.done).length ?? 0;
  const checklistSummary = totalItems > 0 ? ` · ${doneItems}/${totalItems} subtasks completed` : "";
  const attachedDocs = taskDocsMap[t._id.toString()] || [];
  const docCountSummary = attachedDocs.length > 0 ? ` · ${attachedDocs.length} attached document${attachedDocs.length > 1 ? "s" : ""}` : "";
  const isPending = t.status === "pending_approval";
  const itemStatus = isPending ? "pending" : t.status === "completed" ? "approved" : "rejected";
  const when = submitAt;
  const aging = computeAging(when, isPending);

  return {
    _id: `task_${t._id.toString()}`,
    id: `task_${t._id.toString()}`,
    rawTaskId: t._id.toString(),
    kind: "Task Completion",
    type: "Task Completion",
    category: "tasks",
    title: t.title,
    context: `Submitted by ${subUser.name}${checklistSummary}${docCountSummary}`,
    when,
    submittedAt: submitAt,
    assignedAt: assignAt,
    status: itemStatus,
    priority: t.priority || "medium",
    agingDays: aging.agingDays,
    agingLabel: aging.agingLabel,
    submittedBy: subUser,
    assignedTo: assignUser,
    assignedBy: byUser,
    rejectionReason: t.rejectionReason,
    reviewedAt: t.approvedAt || t.rejectedAt || (itemStatus === "approved" ? t.completedAt : undefined),
    reviewedBy: t.rejectedBy ? { _id: t.rejectedBy._id?.toString() || t.rejectedBy.toString(), name: t.rejectedByName || t.rejectedBy.name } : undefined,
    documents: attachedDocs,
    documentDetails: attachedDocs.length === 1 ? attachedDocs[0] : undefined,
    task: {
      id: t._id.toString(),
      title: t.title,
      description: t.description,
      status: t.status,
    },
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
      assignedTo: assignUser,
      assignedUsers: t.assignedUsers,
      assignedBy: byUser,
      assignedAt: assignAt,
      submittedBy: subUser,
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
      assignmentHistory: (t.assignmentHistory || []).map((h: any) => ({
        action: h.action,
        note: h.note,
        timestamp: h.timestamp,
        toUser: h.toUser?.name ? { _id: h.toUser._id?.toString(), name: h.toUser.name, role: h.toUser.role } : h.toUser,
        fromUser: h.fromUser?.name ? { _id: h.fromUser._id?.toString(), name: h.fromUser.name, role: h.fromUser.role } : h.fromUser,
        assignedBy: h.assignedBy?.name ? { _id: h.assignedBy._id?.toString(), name: h.assignedBy.name, role: h.assignedBy.role } : h.assignedBy,
      })),
      documents: attachedDocs,
    },
  };
}

export function formatRequestApprovalItem(r: any, computeAging: (d: any, p: boolean) => any) {
  let kind = "General Approval";
  let category = "tasks";
  if (r.type === "task_reassign") { kind = "Task Reassignment"; category = "tasks"; }
  else if (r.type === "task_forward") { kind = "Task Forward"; category = "tasks"; }
  else if (r.type === "task_delete") { kind = "Task Deletion"; category = "tasks"; }
  else if (r.type === "task_completion") { kind = "Task Completion"; category = "tasks"; }
  else if (r.type === "case_delete") { kind = "Case Deletion"; category = "cases"; }
  else if (r.type === "case_reassign") { kind = "Case Reassignment"; category = "cases"; }
  else if (r.type === "case_completion") { kind = "Case Completion"; category = "cases"; }
  else if (r.type === "attachment_retention_purge") { kind = "Attachment Purge"; category = "documents"; }
  else if (r.type === "attachment_delete") { kind = "Attachment Deletion"; category = "documents"; }

  const requesterName = r.requesterId?.name || "Employee";
  const targetName = r.targetUserId?.name ? ` to ${r.targetUserId.name}` : "";
  const isPending = r.status === "pending";
  const when = r.createdAt;
  const aging = computeAging(when, isPending);

  const subUser = r.requesterId ? {
    _id: r.requesterId._id?.toString(),
    name: r.requesterId.name,
    email: r.requesterId.email,
    role: r.requesterId.role,
    avatarUrl: r.requesterId.avatarUrl,
  } : { name: requesterName, role: "Staff" };

  const targetUser = r.targetUserId ? {
    _id: r.targetUserId._id?.toString(),
    name: r.targetUserId.name,
    email: r.targetUserId.email,
    role: r.targetUserId.role,
    avatarUrl: r.targetUserId.avatarUrl,
  } : r.originalAssigneeId ? {
    _id: r.originalAssigneeId._id?.toString(),
    name: r.originalAssigneeId.name,
    email: r.originalAssigneeId.email,
    role: r.originalAssigneeId.role,
    avatarUrl: r.originalAssigneeId.avatarUrl,
  } : null;

  let title = `${kind}${targetName}`;
  if (r.type === "task_completion") {
    title = r.metadata?.taskTitle || (r.entityId && typeof r.entityId === "object" && (r.entityId as any).title) || "Task Completion";
  }

  const result: any = {
    _id: `approval_req_${r._id.toString()}`,
    id: `approval_req_${r._id.toString()}`,
    rawApprovalId: r._id.toString(),
    kind,
    type: kind,
    category,
    title,
    context: `Requested by ${requesterName}: "${r.reason || "No remark"}"`,
    when,
    submittedAt: r.createdAt,
    assignedAt: r.createdAt,
    status: r.status,
    priority: (r.metadata?.priority as string) || (r.type.includes("delete") ? "high" : "medium"),
    agingDays: aging.agingDays,
    agingLabel: aging.agingLabel,
    submittedBy: subUser,
    assignedTo: targetUser || subUser,
    assignedBy: subUser,
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
  };

  if (r.entityId && typeof r.entityId === "object") {
    const e = r.entityId as any;
    if (r.entityType === "Task" || r.type.startsWith("task_")) {
      result.task = {
        id: e._id?.toString(),
        title: e.title,
        description: e.description,
        status: e.status,
      };
      result.taskDetails = {
        _id: e._id?.toString(),
        title: e.title,
        description: e.description,
        priority: e.priority,
        status: e.status,
        deadline: e.deadline,
        checklist: e.checklist || [],
        remarks: e.remarks || [],
        case: e.caseId,
        client: e.clientId,
      };
    } else if (r.entityType === "Case" || r.type.startsWith("case_")) {
      result.caseDetails = {
        _id: e._id?.toString(),
        title: e.title,
        number: e.number,
        courtCaseId: e.courtCaseId,
      };
    }
  }

  return result;
}

export async function fetchApprovalDetail(rawId: string) {
  const trimmed = String(rawId || "").trim();
  if (!trimmed) return null;

  const now = new Date();
  let timezone = "Asia/Kolkata";
  try {
    const workingHours = await (AppSettings as any).getWorkingHoursConfig();
    if (workingHours?.timezone) {
      timezone = workingHours.timezone;
    }
  } catch {}

  const computeAging = (d: any, p: boolean) => computeApprovalAging(d, p, now, timezone);

  let taskId = trimmed.startsWith("task_") ? trimmed.replace(/^task_/, "") : null;
  let approvalReqId = trimmed.startsWith("approval_req_") ? trimmed.replace(/^approval_req_/, "") : null;

  if (!taskId && !approvalReqId && Types.ObjectId.isValid(trimmed)) {
    const maybeTask = await Task.findById(trimmed).select("_id").lean();
    if (maybeTask) {
      taskId = trimmed;
    } else {
      const maybeReq = await ApprovalRequest.findById(trimmed).select("_id").lean();
      if (maybeReq) {
        approvalReqId = trimmed;
      }
    }
  }

  // 1. Task Approval
  if (taskId && Types.ObjectId.isValid(taskId)) {
    const t = await Task.findById(taskId)
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
      .lean();

    if (t) {
      const taskDocs = await DocumentModel.find({ taskId: t._id })
        .select("_id name originalName size sizeFormatted mimeType state createdAt uploadedBy version taskId")
        .populate("uploadedBy", "name email role")
        .sort({ createdAt: -1 })
        .lean();

      return formatTaskApprovalItem(t, computeAging, { [t._id.toString()]: taskDocs });
    }
  }

  // 2. Approval Request
  if (approvalReqId && Types.ObjectId.isValid(approvalReqId)) {
    const r = await ApprovalRequest.findById(approvalReqId)
      .populate("requesterId", "name email role avatarUrl")
      .populate("targetUserId", "name email role avatarUrl")
      .populate("originalAssigneeId", "name email role avatarUrl")
      .populate("reviewedBy", "name email role")
      .populate("entityId")
      .lean();

    if (r) {
      return formatRequestApprovalItem(r, computeAging);
    }
  }

  // 3. Document Access Request
  if (trimmed.includes("_access_") && !trimmed.startsWith("case_")) {
    const [docId, timestampStr] = trimmed.split("_access_");
    if (Types.ObjectId.isValid(docId)) {
      const doc = await DocumentModel.findById(docId)
        .populate("accessRequests.userId", "name email role avatarUrl")
        .populate("caseId", "title number")
        .lean();

      if (doc && Array.isArray(doc.accessRequests)) {
        const ar = doc.accessRequests.find((a: any) =>
          new Date(a.createdAt).getTime().toString() === timestampStr ||
          String(a._id) === timestampStr
        ) || doc.accessRequests[0];

        if (ar) {
          const arStatus = ar.status || "pending";
          const when = ar.createdAt || new Date();
          const isPending = arStatus === "pending";
          const aging = computeAging(when, isPending);
          const user = ar.userId as any;
          const subUser = user ? {
            _id: user._id?.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
          } : { name: "Employee", role: "Staff" };

          return {
            _id: trimmed,
            id: trimmed,
            kind: "Access Request",
            type: "Access Request",
            category: "access",
            title: doc.name,
            context: ar.reason || "Document access request",
            when,
            submittedAt: when,
            assignedAt: when,
            status: arStatus,
            priority: "medium",
            agingDays: aging.agingDays,
            agingLabel: aging.agingLabel,
            submittedBy: subUser,
            assignedTo: subUser,
            assignedBy: { name: "System", role: "System" },
            documentDetails: {
              _id: doc._id.toString(),
              name: doc.name,
              case: doc.caseId ? { _id: (doc.caseId as any)._id, title: (doc.caseId as any).title, number: (doc.caseId as any).number } : null,
            },
          };
        }
      }
    }
  }

  // 4. Case Access Request
  if (trimmed.startsWith("case_") && trimmed.includes("_access_")) {
    const parts = trimmed.replace(/^case_/, "").split("_access_");
    const [caseId, timestampStr] = parts;
    if (Types.ObjectId.isValid(caseId)) {
      const c = await Case.findById(caseId)
        .populate("accessRequests.userId", "name email role avatarUrl")
        .select("title number courtCaseId accessRequests")
        .lean();

      if (c && Array.isArray(c.accessRequests)) {
        const ar = c.accessRequests.find((a: any) =>
          new Date(a.createdAt).getTime().toString() === timestampStr ||
          String(a._id) === timestampStr
        ) || c.accessRequests[0];

        if (ar) {
          const arStatus = ar.status || "pending";
          const when = ar.createdAt || new Date();
          const isPending = arStatus === "pending";
          const aging = computeAging(when, isPending);
          const user = ar.userId as any;
          const subUser = user ? {
            _id: user._id?.toString(),
            name: user.name || ar.userName || "Employee",
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
          } : { name: ar.userName || "Employee", role: "Staff" };

          return {
            _id: trimmed,
            id: trimmed,
            kind: "Case Request",
            type: "Case Request",
            category: "access",
            title: `${c.number} — ${c.title}`,
            context: ar.reason || "Case access request",
            when,
            submittedAt: when,
            assignedAt: when,
            status: arStatus,
            priority: "medium",
            agingDays: aging.agingDays,
            agingLabel: aging.agingLabel,
            submittedBy: subUser,
            assignedTo: subUser,
            assignedBy: { name: "System", role: "System" },
            caseDetails: {
              _id: c._id.toString(),
              title: c.title,
              number: c.number,
              courtCaseId: c.courtCaseId,
            },
          };
        }
      }
    }
  }

  // 5. Direct Document Upload
  if (Types.ObjectId.isValid(trimmed)) {
    const d = await DocumentModel.findById(trimmed)
      .populate("uploadedBy", "name email role avatarUrl")
      .populate("caseId", "title number")
      .populate("taskId", "title status number caseId")
      .populate("clientId", "name")
      .lean();

    if (d) {
      const isPending = d.state === "Pending";
      const itemStatus = isPending ? "pending" : d.state === "Approved" ? "approved" : "rejected";
      const when = d.createdAt;
      const aging = computeAging(when, isPending);
      const taskContext = (d.taskId as any)?.title ? ` for task "${(d.taskId as any).title}"` : "";
      const subUser = d.uploadedBy ? {
        _id: (d.uploadedBy as any)._id?.toString(),
        name: (d.uploadedBy as any).name,
        email: (d.uploadedBy as any).email,
        role: (d.uploadedBy as any).role,
        avatarUrl: (d.uploadedBy as any).avatarUrl,
      } : { name: "Employee", role: "Staff" };

      return {
        _id: d._id.toString(),
        id: d._id.toString(),
        kind: "Document Upload",
        type: "Document Upload",
        category: "documents",
        title: d.name,
        context: `Uploaded for review (${d.sizeFormatted || "document"})${taskContext}`,
        when,
        submittedAt: when,
        assignedAt: when,
        status: itemStatus,
        priority: "medium",
        agingDays: aging.agingDays,
        agingLabel: aging.agingLabel,
        submittedBy: subUser,
        assignedTo: subUser,
        assignedBy: { name: "System", role: "System" },
        reviewedAt: d.approvedAt || d.updatedAt,
        documentDetails: {
          _id: d._id.toString(),
          name: d.name,
          kind: d.kind,
          size: d.size,
          sizeFormatted: d.sizeFormatted,
          mimeType: d.mimeType,
          state: d.state,
          case: d.caseId ? { _id: (d.caseId as any)._id, title: (d.caseId as any).title, number: (d.caseId as any).number } : null,
          task: d.taskId ? { _id: (d.taskId as any)._id, title: (d.taskId as any).title, status: (d.taskId as any).status } : null,
          client: d.clientId ? { _id: (d.clientId as any)._id, name: (d.clientId as any).name } : null,
          uploadedBy: d.uploadedBy,
          createdAt: d.createdAt,
        },
      };
    }
  }

  return null;
}

export interface ApprovalActionParams {
  rawId: string;
  user: any;
  userId: string;
  cleanRemark: string;
  ip?: string;
  userAgent?: string;
  io?: any;
}

export async function executeApproveAction(params: ApprovalActionParams): Promise<{ status: number; body: any }> {
  const { rawId, user, userId, cleanRemark, ip, userAgent, io } = params;
  const now = new Date();
  const trimmed = String(rawId || "").trim();

  let taskId = trimmed.startsWith("task_") ? trimmed.replace(/^task_/, "") : null;
  let approvalReqId = trimmed.startsWith("approval_req_") ? trimmed.replace(/^approval_req_/, "") : null;

  if (!taskId && !approvalReqId && Types.ObjectId.isValid(trimmed)) {
    const maybeTask = await Task.findById(trimmed).select("_id").lean();
    if (maybeTask) {
      taskId = trimmed;
    } else {
      const maybeReq = await ApprovalRequest.findById(trimmed).select("_id").lean();
      if (maybeReq) {
        approvalReqId = trimmed;
      }
    }
  }

  // 1. Task Approval
  if (taskId && Types.ObjectId.isValid(taskId)) {
    const task = await Task.findById(taskId);
    if (!task) {
      return { status: 404, body: { message: "Task not found" } };
    }

    // Self-approval restriction for non-admins
    const submitterId = task.submittedForApprovalBy?.toString() || task.submittedBy?.toString();
    const assigneeId = task.assignedTo?.toString();
    if (user.role !== "admin" && (userId === submitterId || userId === assigneeId)) {
      return { status: 403, body: { message: "Self-approval is not permitted. An administrator must approve your completion." } };
    }

    task.status = "completed";
    if (!task.completedAt) task.completedAt = now;
    task.approvedAt = now;
    task.approvedBy = new Types.ObjectId(userId);
    task.rejectedAt = null;
    await task.save();

    // Synchronize pending ApprovalRequest if one exists
    await ApprovalRequest.updateMany(
      { entityId: task._id, type: "task_completion", status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedBy: new Types.ObjectId(userId),
          reviewedAt: now,
          decisionRemark: cleanRemark || "Approved",
        },
      }
    );

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email role avatarUrl")
      .populate("assignedBy", "name email role")
      .populate("caseId", "title number")
      .populate("clientId", "name phone")
      .lean();

    if (io) {
      io.emit("task:updated", {
        taskId: task._id.toString(),
        caseId: task.caseId ? task.caseId.toString() : null,
        clientId: task.clientId ? task.clientId.toString() : null,
      });
    }

    if (task.assignedTo && task.assignedTo.toString() !== userId) {
      await NotificationService.createNotification(
        {
          userId: task.assignedTo,
          type: "TASK_APPROVED",
          title: "Task Approved & Verified",
          message: `${user?.name || "Administrator"} approved completion of task "${task.title}".${cleanRemark ? ` Remark: ${cleanRemark}` : ""}`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(userId),
          metadata: {
            taskId: task._id.toString(),
            decisionRemark: cleanRemark || undefined,
          },
        },
        io
      );
    }

    await AuditLog.create({
      userId,
      userName: user?.name || "Admin",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: cleanRemark ? `Task completion approved. Remark: "${cleanRemark}"` : "Task completion approved",
      ip,
      userAgent,
    });

    return {
      status: 200,
      body: {
        message: "Task approved successfully",
        approval: { _id: `task_${task._id}`, status: "approved", task: populated },
      },
    };
  }

  // 2. Approval Request Approval
  if (approvalReqId && Types.ObjectId.isValid(approvalReqId)) {
    const approval = await ApprovalRequest.findById(approvalReqId);
    if (!approval) {
      return { status: 404, body: { message: "Approval request not found" } };
    }
    if (approval.status !== "pending") {
      return { status: 400, body: { message: `Request is already ${approval.status}` } };
    }

    // Self-approval restriction for non-admins
    if (user.role !== "admin" && approval.requesterId.toString() === userId) {
      return { status: 403, body: { message: "Self-approval is not permitted. An administrator must review your request." } };
    }

    let details = "";

    if (approval.type === "task_reassign" || approval.type === "task_forward") {
      const task = await Task.findById(approval.entityId);
      if (!task) return { status: 404, body: { message: "Linked task no longer exists" } };
      const targetUser = await User.findById(approval.targetUserId);
      if (!targetUser) return { status: 404, body: { message: "Target assignee no longer exists" } };

      const prevAssignee = task.assignedTo;
      task.assignedTo = approval.targetUserId!;
      task.assignedBy = new Types.ObjectId(userId);
      task.assignedAt = now;
      task.pendingReassignment = false;

      task.assignmentHistory.push({
        fromUser: prevAssignee,
        toUser: approval.targetUserId!,
        assignedBy: new Types.ObjectId(userId),
        action: approval.type === "task_reassign" ? "reassigned" : "forwarded",
        note: cleanRemark ? `Approved by ${user.name}: ${cleanRemark}` : `Approved by ${user.name}`,
        timestamp: now,
      });

      await task.save();

      const isUrgent = task.priority === "High";
      const clientName = resolveTaskClientName(task);
      const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";

      await NotificationService.createNotification(
        {
          userId: approval.targetUserId!,
          type: "TASK_REASSIGNED",
          title: isUrgent ? "🚨 Urgent Task Reassigned to You" : "Task Reassigned to You (Approved)",
          message: `${user.name} approved task reassignment to you: "${task.title}" (Client: ${clientName}, Deadline: ${deadlineStr}).${cleanRemark ? ` Note: ${cleanRemark}` : ""}`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(userId),
          metadata: {
            taskId: task._id.toString(),
            decisionRemark: cleanRemark || undefined,
            clientName,
            priority: task.priority,
            deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
          },
        },
        io
      );

      if (prevAssignee && prevAssignee.toString() !== approval.targetUserId?.toString() && prevAssignee.toString() !== userId) {
        await NotificationService.createNotification(
          {
            userId: prevAssignee,
            type: "TASK_REASSIGNED",
            title: "Task Reassigned to Colleague",
            message: `Task "${task.title}" (Client: ${clientName}) has been reassigned to ${targetUser.name} by ${user.name}.`,
            relatedId: task._id,
            relatedModel: "Task",
            actorId: new Types.ObjectId(userId),
          },
          io
        );
      }

      if (approval.requesterId.toString() !== userId) {
        await NotificationService.createNotification(
          {
            userId: approval.requesterId,
            type: "TASK_APPROVED",
            title: "Reassignment Request Approved",
            message: `Your reassignment request for "${task.title}" to ${targetUser.name} was approved. Remark: ${cleanRemark}`,
            relatedId: task._id,
            relatedModel: "Task",
            actorId: new Types.ObjectId(userId),
          },
          io
        );
      }

      details = `Reassigned task to ${targetUser.name}`;
      if (io) io.emit("task:updated", { taskId: task._id.toString() });

    } else if (approval.type === "task_completion") {
      const task = await Task.findById(approval.entityId);
      if (task) {
        task.status = "completed";
        task.completedAt = now;
        task.approvedAt = now;
        task.approvedBy = new Types.ObjectId(userId);
        task.rejectedAt = null;
        await task.save();

        if (task.assignedTo && task.assignedTo.toString() !== userId) {
          await NotificationService.createNotification(
            {
              userId: task.assignedTo,
              type: "TASK_APPROVED",
              title: "Task Completion Approved",
              message: `${user.name} verified and approved task "${task.title}". Remark: ${cleanRemark}`,
              relatedId: task._id,
              relatedModel: "Task",
              actorId: new Types.ObjectId(userId),
            },
            io
          );
        }
        if (io) io.emit("task:updated", { taskId: task._id.toString() });
      }
      details = "Approved task completion";

    } else if (approval.type === "task_delete") {
      const task = await Task.findById(approval.entityId);
      if (task) {
        task.isDeleted = true;
        task.deletedAt = now;
        task.deletedBy = new Types.ObjectId(userId);
        task.deletionReason = cleanRemark;
        task.pendingDeletion = false;
        await task.save();

        if (approval.requesterId.toString() !== userId) {
          await NotificationService.createNotification(
            {
              userId: approval.requesterId,
              type: "TASK_APPROVED",
              title: "Task Deletion Approved",
              message: `Your deletion request for task "${task.title}" was approved by ${user.name}.`,
              relatedId: task._id,
              relatedModel: "Task",
              actorId: new Types.ObjectId(userId),
            },
            io
          );
        }
        if (io) io.emit("task:deleted", { taskId: task._id.toString() });
      }
      details = "Approved task deletion (soft delete)";

    } else if (approval.type === "case_delete") {
      const c = await Case.findById(approval.entityId);
      if (c) {
        c.isDeleted = true;
        c.deletedAt = now;
        c.deletedBy = new Types.ObjectId(userId);
        c.deletionReason = cleanRemark;
        c.pendingDeletion = false;
        await c.save();

        if (approval.requesterId.toString() !== userId) {
          await NotificationService.createNotification(
            {
              userId: approval.requesterId,
              type: "CASE_APPROVED",
              title: "Case Deletion Approved",
              message: `Your deletion request for case "${c.number} — ${c.title}" was approved by ${user.name}.`,
              relatedId: c._id,
              relatedModel: "Case",
              actorId: new Types.ObjectId(userId),
            },
            io
          );
        }
        if (io) io.emit("case:deleted", { caseId: c._id.toString() });
      }
      details = "Approved case deletion (soft delete)";

    } else if (approval.type === "case_completion") {
      const c = await Case.findById(approval.entityId);
      if (c) {
        c.status = "Closed";
        c.completedAt = now;
        c.approvedAt = now;
        c.rejectedAt = null;
        c.submittedForApprovalAt = null;
        c.timeline.push({
          event: `Case completion approved by ${user.name}`,
          by: user.name,
          when: now,
        });
        await c.save();

        await Task.updateMany(
          { caseId: c._id, isDeleted: { $ne: true }, status: { $ne: "completed" } },
          {
            $set: {
              status: "completed",
              completedAt: now,
              approvedAt: now,
              approvedBy: new Types.ObjectId(userId),
            },
          }
        );

        if (io) {
          io.emit("case:updated", { caseId: c._id.toString() });
          io.emit("task:updated", { caseId: c._id.toString() });
        }
      }
      details = "Approved case completion";

    } else if (approval.type === "attachment_delete") {
      const doc = await DocumentModel.findById(approval.entityId);
      if (doc) {
        if (doc.storagePath) {
          try {
            await deleteFile(doc.storagePath);
          } catch (delErr) {
            console.warn("[approvals] Storage file delete failed, marking record deleted:", delErr);
          }
        }
        await DocumentModel.findByIdAndDelete(doc._id);
      }
      details = "Approved attachment permanent cleanup";
    }

    approval.status = "approved";
    approval.reviewedBy = new Types.ObjectId(userId);
    approval.reviewedAt = now;
    approval.decisionRemark = cleanRemark;
    await approval.save();

    await AuditLog.create({
      userId,
      userName: user?.name ?? "Admin",
      action: "update",
      resource: "approval" as any,
      resourceId: approval._id.toString(),
      resourceName: `${approval.type} (${approval.entityType})`,
      details: cleanRemark ? `${details}. Remark: "${cleanRemark}"` : details,
      ip,
      userAgent,
    });

    return {
      status: 200,
      body: { message: "Request approved successfully", approval },
    };
  }

  // 3. Document Direct Approval
  if (Types.ObjectId.isValid(trimmed)) {
    const doc = await DocumentModel.findById(trimmed);
    if (doc) {
      doc.state = "Approved";
      doc.approvedAt = now;
      doc.approvedBy = new Types.ObjectId(userId);
      await doc.save();

      await AuditLog.create({
        userId,
        userName: user?.name ?? "Admin",
        action: "update",
        resource: "document",
        resourceId: doc._id.toString(),
        resourceName: doc.name,
        details: cleanRemark ? `Document approved. Remark: "${cleanRemark}"` : "Document approved",
        ip,
        userAgent,
      });

      return {
        status: 200,
        body: { message: "Document approved successfully", approval: { _id: doc._id, state: "Approved" } },
      };
    }
  }

  return { status: 404, body: { message: "Approval request not found" } };
}

export async function executeRejectAction(
  params: ApprovalActionParams & { isRequestChanges?: boolean }
): Promise<{ status: number; body: any }> {
  const { rawId, user, userId, cleanRemark, isRequestChanges, ip, userAgent, io } = params;
  const now = new Date();
  const trimmed = String(rawId || "").trim();

  if (!cleanRemark) {
    return {
      status: 400,
      body: { message: "A reason or remark is required when rejecting or requesting changes", field: "remark" },
    };
  }

  let taskId = trimmed.startsWith("task_") ? trimmed.replace(/^task_/, "") : null;
  let approvalReqId = trimmed.startsWith("approval_req_") ? trimmed.replace(/^approval_req_/, "") : null;

  if (!taskId && !approvalReqId && Types.ObjectId.isValid(trimmed)) {
    const maybeTask = await Task.findById(trimmed).select("_id").lean();
    if (maybeTask) {
      taskId = trimmed;
    } else {
      const maybeReq = await ApprovalRequest.findById(trimmed).select("_id").lean();
      if (maybeReq) {
        approvalReqId = trimmed;
      }
    }
  }

  // 1. Task Rejection
  if (taskId && Types.ObjectId.isValid(taskId)) {
    const task = await Task.findById(taskId).populate("clientId caseId");
    if (!task) {
      return { status: 404, body: { message: "Task not found" } };
    }

    task.status = "in_progress";
    task.completedAt = null;
    task.submittedForApprovalAt = null;
    task.approvedAt = null;
    task.rejectedAt = now;
    task.rejectedBy = new Types.ObjectId(userId);
    task.rejectedByName = user?.name || "Administrator";
    task.rejectionReason = cleanRemark;

    task.remarks.push({
      id: new Types.ObjectId().toString(),
      text: isRequestChanges
        ? `⚠️ Changes Requested: "${cleanRemark}"`
        : `⚠️ Approval Rejected: "${cleanRemark}"`,
      author: user?.name || "Administrator",
      authorName: user?.name || "Administrator",
      authorId: new Types.ObjectId(userId),
      createdAt: now,
    });

    await task.save();

    // Synchronize pending ApprovalRequest if one exists
    await ApprovalRequest.updateMany(
      { entityId: task._id, type: "task_completion", status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewedBy: new Types.ObjectId(userId),
          reviewedAt: now,
          decisionRemark: cleanRemark,
        },
      }
    );

    const clientName = resolveTaskClientName(task);
    const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";
    const assigneeId = (task.assignedTo as any)?._id?.toString() ?? task.assignedTo?.toString();
    const creatorId = (task.createdBy as any)?._id?.toString() ?? task.createdBy?.toString();

    await dispatchRejectionNotifications({
      taskId: task._id,
      taskTitle: task.title,
      clientName,
      deadlineStr,
      reviewerName: user?.name || "Administrator",
      reviewerId: userId,
      reasonText: cleanRemark,
      recipientIds: [assigneeId, creatorId],
      io,
    });

    if (io) {
      io.emit("task:updated", {
        taskId: task._id.toString(),
        caseId: task.caseId ? task.caseId.toString() : null,
        clientId: task.clientId ? task.clientId.toString() : null,
      });
    }

    await AuditLog.create({
      userId,
      userName: user?.name ?? "Admin",
      action: "update",
      resource: "task",
      resourceId: task._id.toString(),
      resourceName: task.title,
      details: isRequestChanges
        ? `Changes requested: "${cleanRemark}"`
        : `Task completion rejected. Reason: "${cleanRemark}"`,
      ip,
      userAgent,
    });

    return {
      status: 200,
      body: {
        message: isRequestChanges ? "Changes requested successfully" : "Task rejected successfully",
        approval: { _id: `task_${task._id}`, status: "rejected" },
      },
    };
  }

  // 2. Approval Request Rejection
  if (approvalReqId && Types.ObjectId.isValid(approvalReqId)) {
    const approval = await ApprovalRequest.findById(approvalReqId);
    if (!approval) {
      return { status: 404, body: { message: "Approval request not found" } };
    }
    if (approval.status !== "pending") {
      return { status: 400, body: { message: `Request is already ${approval.status}` } };
    }

    // Revert pending flags on target entity
    if (approval.type === "task_reassign" || approval.type === "task_forward") {
      await Task.findByIdAndUpdate(approval.entityId, { pendingReassignment: false });
    } else if (approval.type === "task_delete") {
      await Task.findByIdAndUpdate(approval.entityId, { pendingDeletion: false });
    } else if (approval.type === "case_delete") {
      await Case.findByIdAndUpdate(approval.entityId, { pendingDeletion: false });
    }

    if (approval.type === "task_completion") {
      const task = await Task.findById(approval.entityId).populate("clientId caseId");
      if (task) {
        task.status = "in_progress";
        task.completedAt = null;
        task.submittedForApprovalAt = null;
        task.approvedAt = null;
        task.rejectedAt = now;
        task.rejectedBy = new Types.ObjectId(userId);
        task.rejectedByName = user?.name || "Administrator";
        task.rejectionReason = cleanRemark;

        task.remarks.push({
          id: new Types.ObjectId().toString(),
          text: isRequestChanges
            ? `⚠️ Changes Requested: "${cleanRemark}"`
            : `⚠️ Approval Rejected: "${cleanRemark}"`,
          author: user?.name || "Administrator",
          authorName: user?.name || "Administrator",
          authorId: new Types.ObjectId(userId),
          createdAt: now,
        });
        await task.save();

        const clientName = resolveTaskClientName(task);
        const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline";
        const recipientList: (Types.ObjectId | string)[] = [];
        if (approval.requesterId) recipientList.push(approval.requesterId);
        if (task.assignedTo) recipientList.push(task.assignedTo);
        if (task.createdBy) recipientList.push(task.createdBy);

        await dispatchRejectionNotifications({
          taskId: approval.entityId,
          taskTitle: task.title,
          clientName,
          deadlineStr,
          reviewerName: user.name || "Administrator",
          reviewerId: userId,
          reasonText: cleanRemark,
          recipientIds: recipientList,
          approvalId: approval._id,
          io,
        });

        if (io) io.emit("task:updated", { taskId: task._id.toString() });
      }
    } else if (approval.type === "case_completion") {
      const c = await Case.findById(approval.entityId);
      if (c) {
        c.submittedForApprovalAt = null;
        c.rejectedAt = now;
        c.timeline.push({
          event: `Case completion rejected by ${user.name}: "${cleanRemark}"`,
          by: user.name,
          when: now,
        });
        await c.save();
        if (io) io.emit("case:updated", { caseId: c._id.toString() });
      }
    }

    approval.status = "rejected";
    approval.reviewedBy = new Types.ObjectId(userId);
    approval.reviewedAt = now;
    approval.decisionRemark = cleanRemark;
    await approval.save();

    await AuditLog.create({
      userId,
      userName: user?.name ?? "Admin",
      action: "update",
      resource: "approval" as any,
      resourceId: approval._id.toString(),
      resourceName: `${approval.type} (${approval.entityType})`,
      details: isRequestChanges
        ? `Changes requested by ${user.name}: "${cleanRemark}"`
        : `Request rejected by ${user.name}. Reason: "${cleanRemark}"`,
      ip,
      userAgent,
    });

    return {
      status: 200,
      body: {
        message: isRequestChanges ? "Changes requested successfully" : "Request rejected successfully",
        approval,
      },
    };
  }

  // 3. Document Rejection
  if (Types.ObjectId.isValid(trimmed)) {
    const doc = await DocumentModel.findById(trimmed);
    if (doc) {
      doc.state = "Rejected";
      doc.rejectedAt = now;
      doc.rejectedBy = new Types.ObjectId(userId);
      doc.rejectionReason = cleanRemark;
      await doc.save();

      await AuditLog.create({
        userId,
        userName: user?.name ?? "Admin",
        action: "update",
        resource: "document",
        resourceId: doc._id.toString(),
        resourceName: doc.name,
        details: `Document rejected. Reason: "${cleanRemark}"`,
        ip,
        userAgent,
      });

      return {
        status: 200,
        body: { message: "Document rejected successfully", approval: { _id: doc._id, state: "Rejected" } },
      };
    }
  }

  return { status: 404, body: { message: "Approval request not found" } };
}
