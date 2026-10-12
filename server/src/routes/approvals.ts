import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { ApprovalRequest, type ApprovalType } from "../models/ApprovalRequest.js";
import { Task } from "../models/Task.js";
import { Case } from "../models/Case.js";
import { User } from "../models/User.js";
import { DocumentModel } from "../models/Document.js";
import { AuditLog } from "../models/AuditLog.js";
import { NotificationService } from "../services/notifications.js";
import { requireAuth, requireAdminOrPermission } from "../middleware/auth.js";
import { deleteFile } from "../services/storage.js";

const router = Router();
router.use(requireAuth);

/**
 * Helper to validate mandatory remark
 */
function validateRemark(remark: unknown): { valid: boolean; error?: string; clean?: string } {
  if (typeof remark !== "string" || !remark.trim()) {
    return { valid: false, error: "A non-empty, trimmed remark is strictly mandatory for all approval decisions." };
  }
  const clean = remark.trim();
  if (clean.length < 3) {
    return { valid: false, error: "Decision remark must be at least 3 characters long." };
  }
  if (clean.length > 1000) {
    return { valid: false, error: "Decision remark cannot exceed 1000 characters." };
  }
  return { valid: true, clean };
}

/**
 * GET /api/approvals
 * Lists pending or historical approval requests
 */
router.get("/", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const { status = "pending", type } = req.query;
    const filter: Record<string, any> = {};

    if (status && status !== "all") {
      filter["status"] = status;
    }
    if (type) {
      filter["type"] = type;
    }

    const requests = await ApprovalRequest.find(filter)
      .populate("requesterId", "name email role avatarUrl")
      .populate("originalAssigneeId", "name email role")
      .populate("targetUserId", "name email role")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ approvals: requests, total: requests.length });
  } catch (err) {
    console.error("[approvals] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/approvals/:id/approve
 * Admin approves request with mandatory non-empty remark
 */
router.post("/:id/approve", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const remarkCheck = validateRemark(req.body.remark || req.body.decisionRemark);
    if (!remarkCheck.valid) {
      res.status(400).json({ message: remarkCheck.error, field: "remark" });
      return;
    }
    const cleanRemark = remarkCheck.clean!;

    const approvalId = String(req.params["id"] || "");
    if (!Types.ObjectId.isValid(approvalId)) {
      res.status(400).json({ message: "Invalid approval request ID format" });
      return;
    }

    const approval = await ApprovalRequest.findById(approvalId);
    if (!approval) {
      res.status(404).json({ message: "Approval request not found" });
      return;
    }
    if (approval.status !== "pending") {
      res.status(400).json({ message: `Request is already ${approval.status}` });
      return;
    }

    const io = req.app.get("io");
    const now = new Date();
    const adminUser = req.user!;

    let details = "";

    if (approval.type === "task_reassign" || approval.type === "task_forward") {
      const task = await Task.findById(approval.entityId);
      if (!task) {
        res.status(404).json({ message: "Linked task no longer exists" });
        return;
      }

      const targetUser = await User.findById(approval.targetUserId);
      if (!targetUser) {
        res.status(404).json({ message: "Target assignee no longer exists" });
        return;
      }

      const prevAssignee = task.assignedTo;
      task.assignedTo = approval.targetUserId!;
      task.assignedBy = new Types.ObjectId(req.userId!);
      task.assignedAt = now;
      task.pendingReassignment = false;

      task.assignmentHistory.push({
        fromUser: prevAssignee,
        toUser: approval.targetUserId!,
        assignedBy: new Types.ObjectId(req.userId!),
        action: approval.type === "task_reassign" ? "reassigned" : "forwarded",
        note: `Approved by ${adminUser.name}: ${cleanRemark}`,
        timestamp: now,
      });

      await task.save();

      // Notify target user
      await NotificationService.createNotification(
        {
          userId: approval.targetUserId!,
          type: "TASK_ASSIGNED",
          title: "Task Assigned (Approved)",
          message: `${adminUser.name} approved task reassignment: "${task.title}". Remark: ${cleanRemark}`,
          relatedId: task._id,
          relatedModel: "Task",
          actorId: new Types.ObjectId(req.userId!),
          metadata: { taskId: task._id.toString(), decisionRemark: cleanRemark },
        },
        io
      );

      // Notify requester
      if (approval.requesterId.toString() !== req.userId) {
        await NotificationService.createNotification(
          {
            userId: approval.requesterId,
            type: "TASK_APPROVED",
            title: "Reassignment Request Approved",
            message: `Your reassignment request for "${task.title}" to ${targetUser.name} was approved. Remark: ${cleanRemark}`,
            relatedId: task._id,
            relatedModel: "Task",
            actorId: new Types.ObjectId(req.userId!),
          },
          io
        );
      }

      details = `Reassigned task to ${targetUser.name}`;
      if (io) io.emit("task:updated", { task });

    } else if (approval.type === "task_delete") {
      const task = await Task.findById(approval.entityId);
      if (task) {
        task.isDeleted = true;
        task.deletedAt = now;
        task.deletedBy = new Types.ObjectId(req.userId!);
        task.deletionReason = cleanRemark;
        task.pendingDeletion = false;
        await task.save();

        if (approval.requesterId.toString() !== req.userId) {
          await NotificationService.createNotification(
            {
              userId: approval.requesterId,
              type: "TASK_APPROVED",
              title: "Task Deletion Approved",
              message: `Your deletion request for task "${task.title}" was approved by ${adminUser.name}.`,
              relatedId: task._id,
              relatedModel: "Task",
              actorId: new Types.ObjectId(req.userId!),
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
        c.deletedBy = new Types.ObjectId(req.userId!);
        c.deletionReason = cleanRemark;
        c.pendingDeletion = false;
        await c.save();

        if (approval.requesterId.toString() !== req.userId) {
          await NotificationService.createNotification(
            {
              userId: approval.requesterId,
              type: "CASE_APPROVED",
              title: "Case Deletion Approved",
              message: `Your deletion request for case "${c.number} — ${c.title}" was approved by ${adminUser.name}.`,
              relatedId: c._id,
              relatedModel: "Case",
              actorId: new Types.ObjectId(req.userId!),
            },
            io
          );
        }

        if (io) io.emit("case:deleted", { caseId: c._id.toString() });
      }
      details = "Approved case deletion (soft delete)";

    } else if (approval.type === "task_completion") {
      const task = await Task.findById(approval.entityId);
      if (task) {
        task.status = "completed";
        task.completedAt = now;
        task.approvedAt = now;
        task.rejectedAt = null;
        await task.save();

        if (task.assignedTo && task.assignedTo.toString() !== req.userId) {
          await NotificationService.createNotification(
            {
              userId: task.assignedTo,
              type: "TASK_APPROVED",
              title: "Task Completion Approved",
              message: `${adminUser.name} verified and approved task "${task.title}". Remark: ${cleanRemark}`,
              relatedId: task._id,
              relatedModel: "Task",
              actorId: new Types.ObjectId(req.userId!),
            },
            io
          );
        }
        if (io) io.emit("task:updated", { task });
      }
      details = "Approved task completion";

    } else if (approval.type === "attachment_delete") {
      const doc = await DocumentModel.findById(approval.entityId);
      if (doc) {
        // Physical file deletion via storage service
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
    approval.reviewedBy = new Types.ObjectId(req.userId!);
    approval.reviewedAt = now;
    approval.decisionRemark = cleanRemark;
    await approval.save();

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Admin",
      action: "update",
      resource: "approval" as any,
      resourceId: approval._id.toString(),
      resourceName: `${approval.type} (${approval.entityType})`,
      details: `${details}. Mandatory remark: "${cleanRemark}"`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Request approved successfully", approval });
  } catch (err: any) {
    console.error("[approvals] Approve error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/approvals/:id/reject
 * Admin rejects request with mandatory non-empty remark
 */
router.post("/:id/reject", requireAdminOrPermission("approvals"), async (req: Request, res: Response) => {
  try {
    const remarkCheck = validateRemark(req.body.remark || req.body.decisionRemark);
    if (!remarkCheck.valid) {
      res.status(400).json({ message: remarkCheck.error, field: "remark" });
      return;
    }
    const cleanRemark = remarkCheck.clean!;

    const approvalId = String(req.params["id"] || "");
    if (!Types.ObjectId.isValid(approvalId)) {
      res.status(400).json({ message: "Invalid approval request ID format" });
      return;
    }

    const approval = await ApprovalRequest.findById(approvalId);
    if (!approval) {
      res.status(404).json({ message: "Approval request not found" });
      return;
    }
    if (approval.status !== "pending") {
      res.status(400).json({ message: `Request is already ${approval.status}` });
      return;
    }

    const io = req.app.get("io");
    const now = new Date();
    const adminUser = req.user!;

    // Revert pending flags on target entity
    if (approval.type === "task_reassign" || approval.type === "task_forward") {
      await Task.findByIdAndUpdate(approval.entityId, { pendingReassignment: false });
    } else if (approval.type === "task_delete") {
      await Task.findByIdAndUpdate(approval.entityId, { pendingDeletion: false });
    } else if (approval.type === "case_delete") {
      await Case.findByIdAndUpdate(approval.entityId, { pendingDeletion: false });
    } else if (approval.type === "task_completion") {
      await Task.findByIdAndUpdate(approval.entityId, {
        status: "in_progress",
        rejectedAt: now,
        submittedForApprovalAt: null,
      });
    }

    approval.status = "rejected";
    approval.reviewedBy = new Types.ObjectId(req.userId!);
    approval.reviewedAt = now;
    approval.decisionRemark = cleanRemark;
    await approval.save();

    // Notify requester of rejection with mandatory remark
    if (approval.requesterId.toString() !== req.userId) {
      await NotificationService.createNotification(
        {
          userId: approval.requesterId,
          type: "TASK_REJECTED",
          title: "Request Rejected",
          message: `Your ${approval.type.replace(/_/g, " ")} request was rejected by ${adminUser.name}. Reason: ${cleanRemark}`,
          relatedId: approval.entityId,
          relatedModel: approval.entityType,
          actorId: new Types.ObjectId(req.userId!),
          metadata: { approvalId: approval._id.toString(), reason: cleanRemark },
        },
        io
      );
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Admin",
      action: "update",
      resource: "approval" as any,
      resourceId: approval._id.toString(),
      resourceName: `${approval.type} (${approval.entityType})`,
      details: `Request rejected by ${adminUser.name}. Reason: "${cleanRemark}"`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Request rejected successfully", approval });
  } catch (err: any) {
    console.error("[approvals] Reject error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

export const approvalsRouter = router;
export default router;
