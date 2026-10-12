import mongoose, { Document, Schema } from "mongoose";

export type OutboxChannel = "in_app" | "email" | "whatsapp" | "telegram";
export type OutboxStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed";

export interface INotificationOutbox extends Document {
  recipientId: mongoose.Types.ObjectId;
  channel: OutboxChannel;
  eventType: string; // e.g. "TASK_ASSIGNED", "DUE_SOON", "HEARING_REMINDER", "DAILY_DIGEST"
  title: string;
  message: string;
  recipientContact: string; // phone number (E.164), email, or telegram chat ID
  relatedId?: mongoose.Types.ObjectId;
  relatedModel?: string;
  status: OutboxStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  providerMessageId?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationOutboxSchema = new Schema<INotificationOutbox>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    channel: {
      type: String,
      enum: ["in_app", "email", "whatsapp", "telegram"],
      required: true,
      index: true,
    },
    eventType: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    recipientContact: { type: String, required: true, trim: true },
    relatedId: { type: Schema.Types.ObjectId, refPath: "relatedModel" },
    relatedModel: { type: String, enum: ["Task", "Case", "Document", "Reminder", "User"] },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "delivered", "read", "failed"],
      default: "queued",
      index: true,
    },
    attemptCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextRetryAt: { type: Date, default: Date.now, index: true },
    providerMessageId: { type: String, default: "", index: true },
    lastErrorCode: { type: String, default: "" },
    lastErrorMessage: { type: String, default: "" },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

NotificationOutboxSchema.index({ status: 1, nextRetryAt: 1, channel: 1 });
NotificationOutboxSchema.index({ recipientId: 1, createdAt: -1 });

export const NotificationOutbox = mongoose.model<INotificationOutbox>(
  "NotificationOutbox",
  NotificationOutboxSchema
);
