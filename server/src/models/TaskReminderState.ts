import mongoose, { Document, Schema, Types } from "mongoose";

export interface ITaskReminderState extends Document {
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  dismissed: boolean;
  dismissedAt?: Date | null;
  dismissedSlot?: number | null;
  snoozedUntil?: Date | null;
  snoozeDurationHours?: number | null;
  postponedUntil?: Date | null;
  postponedAt?: Date | null;
  postponeReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TaskReminderStateSchema = new Schema<ITaskReminderState>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dismissed: { type: Boolean, default: false },
    dismissedAt: { type: Date, default: null },
    dismissedSlot: { type: Number, default: null },
    snoozedUntil: { type: Date, default: null, index: true },
    snoozeDurationHours: { type: Number, default: null },
    postponedUntil: { type: Date, default: null, index: true },
    postponedAt: { type: Date, default: null },
    postponeReason: { type: String, default: null, trim: true },
  },
  {
    timestamps: true,
  }
);

TaskReminderStateSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskReminderStateSchema.index({ userId: 1, dismissed: 1, snoozedUntil: 1 });
TaskReminderStateSchema.index({ userId: 1, dismissed: 1, postponedUntil: 1 });

export const TaskReminderState = mongoose.model<ITaskReminderState>(
  "TaskReminderState",
  TaskReminderStateSchema
);
