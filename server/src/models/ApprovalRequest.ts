import mongoose, { Document, Schema } from "mongoose";

export type ApprovalType =
  | "task_reassign"
  | "task_forward"
  | "task_delete"
  | "case_delete"
  | "task_completion"
  | "attachment_delete";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface IApprovalRequest extends Document {
  type: ApprovalType;
  entityType: "Task" | "Case" | "Document";
  entityId: mongoose.Types.ObjectId;
  requesterId: mongoose.Types.ObjectId;
  originalAssigneeId?: mongoose.Types.ObjectId | null;
  targetUserId?: mongoose.Types.ObjectId | null;
  reason: string;
  status: ApprovalStatus;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  decisionRemark?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalRequestSchema = new Schema<IApprovalRequest>(
  {
    type: {
      type: String,
      enum: [
        "task_reassign",
        "task_forward",
        "task_delete",
        "case_delete",
        "task_completion",
        "attachment_delete",
      ],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["Task", "Case", "Document", "task", "case", "document"],
      set: (val: string) => {
        if (!val) return val;
        const lower = val.toLowerCase();
        if (lower === "task") return "Task";
        if (lower === "case") return "Case";
        if (lower === "document") return "Document";
        return val;
      },
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "entityType",
      index: true,
    },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalAssigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    decisionRemark: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
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

ApprovalRequestSchema.index({ entityId: 1, status: 1 });
ApprovalRequestSchema.index({ requesterId: 1, createdAt: -1 });
ApprovalRequestSchema.index({ type: 1, status: 1, createdAt: -1 });

export const ApprovalRequest = mongoose.model<IApprovalRequest>(
  "ApprovalRequest",
  ApprovalRequestSchema
);
