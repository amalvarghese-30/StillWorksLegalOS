import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  "HEARING_REMINDER",
  "APPROVAL_REQUEST",
  "DOCUMENT_SHARED",
  "TASK_ASSIGNED",
  "TASK_DUE",
  "OVERDUE_TASK",
  "CASE_UPDATE",
  "COMMENT_MENTION",
  "SYSTEM_ALERT",
  "CUSTOM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId; // The user to notify
  type: NotificationType;
  title: string; // Short title
  message: string; // Detailed message
  read: boolean; // Whether the user has read it
  createdAt: Date;
  relatedId?: mongoose.Types.ObjectId; // Optional: ID of related entity (document, case, etc.)
  relatedModel?: string; // Optional: Model name of related entity (e.g., "Document", "Case")
  actorId?: mongoose.Types.ObjectId; // Optional: User who triggered the notification
  metadata?: Record<string, unknown>; // Additional data
  dedupeKey?: string; // Optional: Key for deduplication (e.g., hash of content to avoid duplicates)
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    relatedId: { type: Schema.Types.ObjectId, refPath: "relatedModel" },
    relatedModel: { type: String, enum: ["Document", "Case", "Task", "User", "CalendarEvent"] },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, sparse: true, index: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

// Compound indexes for common queries
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 }); // For fetching latest notifications

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);