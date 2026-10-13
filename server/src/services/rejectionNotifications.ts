import { Types } from "mongoose";
import { NotificationService } from "./notifications.js";
import { NotificationOutbox } from "../models/NotificationOutbox.js";

export interface RejectionNotificationParams {
  taskId: Types.ObjectId | string;
  taskTitle: string;
  clientName: string;
  deadlineStr: string;
  reviewerName: string;
  reviewerId?: Types.ObjectId | string;
  reasonText: string;
  recipientIds: (Types.ObjectId | string)[];
  approvalId?: Types.ObjectId | string;
  io?: any;
}

/**
 * Dispatches rejection and change-request notifications reliably to all designated recipients (assignee, creator, requester),
 * deduplicating recipients, omitting the acting reviewer, and providing durable fallback outbox intents upon transient failures.
 */
export async function dispatchRejectionNotifications(
  params: RejectionNotificationParams
): Promise<{ dispatched: string[]; queuedForRetry: string[] }> {
  const {
    taskId,
    taskTitle,
    clientName,
    deadlineStr,
    reviewerName,
    reviewerId,
    reasonText,
    recipientIds,
    approvalId,
    io,
  } = params;

  const taskIdStr = taskId.toString();
  const reviewerIdStr = reviewerId ? reviewerId.toString() : null;

  // Deduplicate recipients and exclude acting reviewer
  const uniqueRecipients = new Set<string>();
  for (const rawId of recipientIds) {
    if (!rawId) continue;
    const idStr = (rawId as any)._id?.toString() || rawId.toString();
    if (idStr && idStr !== reviewerIdStr && idStr !== "[object Object]" && Types.ObjectId.isValid(idStr)) {
      uniqueRecipients.add(idStr);
    }
  }

  const dispatched: string[] = [];
  const queuedForRetry: string[] = [];

  for (const recipientId of uniqueRecipients) {
    // Deterministic dedupeKey ensuring idempotency across retries
    const dedupeKey = `task-reject:${taskIdStr}:${recipientId}:${Buffer.from(reasonText).toString("base64").slice(0, 32)}`;

    const notifPayload = {
      userId: new Types.ObjectId(recipientId),
      type: "TASK_REJECTED" as const,
      title: "⚠️ Task Changes Requested / Rejected",
      message: `${reviewerName} requested revisions on task "${taskTitle}" (Client: ${clientName}, Deadline: ${deadlineStr}). Feedback: "${reasonText}"`,
      relatedId: new Types.ObjectId(taskIdStr),
      relatedModel: "Task",
      actorId: reviewerId ? new Types.ObjectId(reviewerIdStr!) : undefined,
      metadata: {
        taskId: taskIdStr,
        taskTitle,
        clientName,
        deadline: deadlineStr,
        reviewerName,
        reason: reasonText,
        decisionRemark: reasonText,
        action: "changes_requested",
        approvalId: approvalId ? approvalId.toString() : undefined,
        dedupeKey,
      },
      dedupeKey,
    };

    let delivered = false;
    try {
      const created = await NotificationService.createNotification(notifPayload, io);
      if (created) {
        dispatched.push(recipientId);
        delivered = true;
      }
    } catch (notifErr) {
      console.error(`[dispatchRejectionNotifications] Direct notification delivery failed for user ${recipientId}:`, notifErr);
    }

    // Fallback: If direct creation failed or threw, persist intent to NotificationOutbox for background retry worker
    if (!delivered) {
      try {
        await NotificationOutbox.findOneAndUpdate(
          {
            recipientId: new Types.ObjectId(recipientId),
            eventType: "TASK_REJECTED",
            relatedId: new Types.ObjectId(taskIdStr),
            "metadata.dedupeKey": dedupeKey,
          },
          {
            $setOnInsert: {
              recipientId: new Types.ObjectId(recipientId),
              channel: "in_app",
              eventType: "TASK_REJECTED",
              title: notifPayload.title,
              message: notifPayload.message,
              recipientContact: recipientId,
              relatedId: new Types.ObjectId(taskIdStr),
              relatedModel: "Task",
              status: "queued",
              attemptCount: 0,
              maxAttempts: 3,
              nextRetryAt: new Date(),
              metadata: notifPayload.metadata,
            },
          },
          { upsert: true, new: true }
        );
        queuedForRetry.push(recipientId);
      } catch (outboxErr) {
        console.error(`[dispatchRejectionNotifications] Failed to enqueue outbox intent for user ${recipientId}:`, outboxErr);
      }
    }
  }

  return { dispatched, queuedForRetry };
}
