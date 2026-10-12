import { Types } from "mongoose";
import { DocumentModel } from "../models/Document.js";
import { ApprovalRequest } from "../models/ApprovalRequest.js";
import { NotificationService } from "./notifications.js";
import { AppSettings } from "../models/AppSettings.js";
import { User } from "../models/User.js";

export async function processAttachmentRetention(io?: any): Promise<{
  warningsSent: number;
  requestsCreated: number;
}> {
  const policy = await (AppSettings as any).getRetentionPolicy();
  if (!policy.enabled) {
    return { warningsSent: 0, requestsCreated: 0 };
  }

  const now = new Date();
  const retentionDays = Math.max(15, policy.retentionDays || 30);
  const warningDays = Math.max(1, policy.warningDays || 3);

  const expireThreshold = new Date(now.getTime() - retentionDays * 24 * 3600 * 1000);
  const warningThreshold = new Date(now.getTime() - (retentionDays - warningDays) * 24 * 3600 * 1000);

  let warningsSent = 0;
  let requestsCreated = 0;

  // 1. Send warnings for files approaching retention deadline (uploaded between expireThreshold and warningThreshold)
  const warningCandidates = await DocumentModel.find({
    createdAt: { $gte: expireThreshold, $lte: warningThreshold },
    // Exclude if already warned or exempt
    $or: [
      { "metadata.retentionWarningSent": { $ne: true } },
      { "metadata.retentionWarningSent": { $exists: false } },
    ],
  }).limit(50);

  for (const doc of warningCandidates) {
    const daysLeft = Math.max(
      1,
      Math.ceil((doc.createdAt.getTime() + retentionDays * 24 * 3600 * 1000 - now.getTime()) / (24 * 3600 * 1000))
    );

    await NotificationService.createNotification(
      {
        userId: doc.uploadedBy,
        type: "SYSTEM_ALERT",
        title: "Attachment Retention Notice",
        message: `Document "${doc.name}" will reach the ${retentionDays}-day retention limit in ${daysLeft} day(s). Review or request an exemption if required.`,
        relatedId: doc._id,
        relatedModel: "Document",
        metadata: {
          subType: "retention_warning",
          documentId: doc._id.toString(),
          daysLeft,
        },
        dedupeKey: `retention-warn:${doc._id.toString()}`,
      },
      io
    );

    warningsSent++;
  }

  // 2. Identify expired files and create ApprovalRequests for administrator authorization
  const expiredCandidates = await DocumentModel.find({
    createdAt: { $lt: expireThreshold },
  }).limit(50);

  for (const doc of expiredCandidates) {
    const existingReq = await ApprovalRequest.findOne({
      entityId: doc._id,
      type: "attachment_delete",
      status: { $in: ["pending", "rejected"] },
    });

    if (!existingReq) {
      await ApprovalRequest.create({
        type: "attachment_delete",
        entityType: "Document",
        entityId: doc._id,
        requesterId: doc.uploadedBy,
        reason: `Automated retention policy: document has reached the ${retentionDays}-day retention threshold.`,
        status: "pending",
        metadata: {
          documentName: doc.name,
          sizeFormatted: doc.sizeFormatted,
          uploadedAt: doc.createdAt,
        },
      });

      // Notify administrators of pending retention cleanup approval
      const admins = await User.find({ role: "admin" }).select("_id");
      for (const admin of admins) {
        await NotificationService.createNotification(
          {
            userId: admin._id,
            type: "APPROVAL_REQUEST",
            title: "Attachment Deletion Approval Required",
            message: `Document "${doc.name}" is scheduled for retention cleanup. Administrator approval required.`,
            relatedId: doc._id,
            relatedModel: "Document",
            metadata: {
              subType: "retention_approval",
              documentId: doc._id.toString(),
            },
            dedupeKey: `retention-req:${doc._id.toString()}`,
          },
          io
        );
      }

      requestsCreated++;
    }
  }

  return { warningsSent, requestsCreated };
}
