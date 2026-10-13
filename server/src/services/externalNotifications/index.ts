import { NotificationOutbox, type OutboxChannel, type OutboxStatus } from "../../models/NotificationOutbox.js";
import { WhatsAppProvider } from "./whatsapp.js";
import { TelegramProvider } from "./telegram.js";
import { EmailProvider } from "./email.js";
import { User } from "../../models/User.js";
import { NotificationService } from "../notifications.js";
import { Types } from "mongoose";

export { WhatsAppProvider } from "./whatsapp.js";
export { TelegramProvider } from "./telegram.js";
export { EmailProvider } from "./email.js";

export interface QueueNotificationParams {
  recipientId: Types.ObjectId | string;
  channel: OutboxChannel;
  eventType: string;
  title: string;
  message: string;
  recipientContact?: string;
  relatedId?: Types.ObjectId | string;
  relatedModel?: string;
  metadata?: Record<string, unknown>;
}

export async function queueNotification(params: QueueNotificationParams): Promise<any> {
  let contact = params.recipientContact;
  if (!contact) {
    const user = await User.findById(params.recipientId).select("email phone secondaryPhone telegramChatId").lean();
    if (user) {
      if (params.channel === "whatsapp") contact = user.phone || user.secondaryPhone;
      else if (params.channel === "telegram") contact = user.telegramChatId;
      else if (params.channel === "email") contact = user.email;
    }
  }

  if (!contact) {
    console.warn(`[externalNotifications] Cannot queue ${params.channel} notification: missing contact info for recipient ${params.recipientId}`);
    return null;
  }

  return NotificationOutbox.create({
    recipientId: new Types.ObjectId(String(params.recipientId)),
    channel: params.channel,
    eventType: params.eventType,
    title: params.title.trim(),
    message: params.message.trim(),
    recipientContact: contact.trim(),
    relatedId: params.relatedId ? new Types.ObjectId(String(params.relatedId)) : undefined,
    relatedModel: params.relatedModel,
    status: "queued",
    attemptCount: 0,
    maxAttempts: 3,
    nextRetryAt: new Date(),
    metadata: params.metadata || {},
  });
}

export async function processOutboxQueue(io?: any): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();
  const candidates = await NotificationOutbox.find({
    $or: [
      { status: "queued" },
      { status: "failed", attemptCount: { $lt: 3 }, nextRetryAt: { $lte: now } },
    ],
  }).limit(20);

  let sent = 0;
  let failed = 0;

  for (const item of candidates) {
    item.status = "sending";
    item.attemptCount += 1;
    await item.save();

    let result: {
      success: boolean;
      messageId?: string;
      errorCode?: string;
      errorMessage?: string;
    } = { success: false, errorCode: "", errorMessage: "" };

    if (item.channel === "whatsapp") {
      result = await WhatsAppProvider.sendMessage(item.recipientContact, `${item.title}\n\n${item.message}`);
    } else if (item.channel === "telegram") {
      result = await TelegramProvider.sendMessage(item.recipientContact, `<b>${item.title}</b>\n\n${item.message}`);
    } else if (item.channel === "email") {
      result = await EmailProvider.sendEmail(
        item.recipientContact,
        item.title,
        `<p>${item.message.replace(/\n/g, "<br/>")}</p>`
      );
    } else if (item.channel === "in_app") {
      const created = await NotificationService.createNotification(
        {
          userId: item.recipientId,
          type: (item.eventType as any) || "CUSTOM",
          title: item.title,
          message: item.message,
          relatedId: item.relatedId,
          relatedModel: item.relatedModel,
          metadata: item.metadata,
          dedupeKey: (item.metadata as any)?.dedupeKey,
        },
        io
      );
      result = {
        success: Boolean(created),
        messageId: created ? created._id.toString() : "",
        errorMessage: created ? "" : "Failed to create in-app notification",
      };
    }

    if (result.success) {
      item.status = "sent";
      item.providerMessageId = result.messageId || "";
      item.sentAt = new Date();
      item.lastErrorCode = "";
      item.lastErrorMessage = "";
      sent++;
    } else {
      item.status = "failed";
      item.lastErrorCode = result.errorCode || "UNKNOWN_ERROR";
      item.lastErrorMessage = result.errorMessage || "Delivery failed";
      // Exponential retry backoff: 5m, 15m, 45m
      const backoffMin = Math.pow(3, item.attemptCount) * 5;
      item.nextRetryAt = new Date(Date.now() + backoffMin * 60 * 1000);
      failed++;
    }

    await item.save();

    if (io) {
      io.emit("outbox:status", {
        outboxId: item._id.toString(),
        channel: item.channel,
        status: item.status,
      });
    }
  }

  return { processed: candidates.length, sent, failed };
}
