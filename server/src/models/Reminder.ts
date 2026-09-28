import mongoose, { Document, Schema, Types } from "mongoose";

export type ReminderStatus =
  | "scheduled"
  | "triggered"
  | "acknowledged"
  | "completed"
  | "dismissed"
  | "snoozed"
  | "cancelled";

export type ReminderSourceType = "task" | "case" | "custom";

export interface IReminder extends Document {
  userId: Types.ObjectId;
  sourceType: ReminderSourceType;
  sourceId?: Types.ObjectId;
  clientName: string;
  phone: string;
  notes: string;
  scheduledAt: Date;
  timezone: string;
  status: ReminderStatus;
  triggeredAt?: Date;
  acknowledgedAt?: Date;
  completedAt?: Date;
  snoozedUntil?: Date;
  deliveryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceType: {
      type: String,
      enum: ["task", "case", "custom"],
      default: "task",
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, index: true },
    clientName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    scheduledAt: { type: Date, required: true, index: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    status: {
      type: String,
      enum: [
        "scheduled",
        "triggered",
        "acknowledged",
        "completed",
        "dismissed",
        "snoozed",
        "cancelled",
      ],
      default: "scheduled",
      index: true,
    },
    triggeredAt: { type: Date },
    acknowledgedAt: { type: Date },
    completedAt: { type: Date },
    snoozedUntil: { type: Date, index: true },
    deliveryId: { type: String },
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

// Compound indexes for high-throughput scheduler polling and user retrieval
ReminderSchema.index({ status: 1, scheduledAt: 1, snoozedUntil: 1 });
ReminderSchema.index({ userId: 1, status: 1, scheduledAt: 1 });

export const Reminder = mongoose.model<IReminder>("Reminder", ReminderSchema);
