import mongoose, { Document, Schema } from "mongoose";
import { type AssignmentHistoryEntry } from "./Case.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskCategory = string;
export type TaskPriority = "High" | "Medium" | "Low";
export type TaskStatus = "pending" | "in_progress" | "pending_approval" | "completed" | "overdue";

/** A nested sub-checklist item */
export interface ChecklistSubItem {
  _id?: string;
  id?: string;
  text: string;
  done: boolean;
}

/** A checklist item within a task (supports recursive/nested subItems) */
export interface ChecklistItem {
  _id?: string;
  id?: string;
  text: string;
  done: boolean;
  subItems?: ChecklistSubItem[];
}

/** An embedded call reminder */
export interface CallReminder {
  clientName: string;
  phone: string;
  scheduledAt: Date;
  notes: string;
  completed: boolean;
}

export interface ITask extends Document {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: Date | null;
  assignedTo: mongoose.Types.ObjectId | null;
  assignedBy?: mongoose.Types.ObjectId | null;
  assignedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  submittedForApprovalAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  localPath?: string;
  assignmentHistory: AssignmentHistoryEntry[];
  caseId: mongoose.Types.ObjectId | null;
  clientId: mongoose.Types.ObjectId | null;
  checklist: ChecklistItem[];
  callReminder?: CallReminder;
  agent?: string;
  isCall: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ChecklistSubItemSchema = new Schema<ChecklistSubItem>(
  {
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: true },
);

const ChecklistItemSchema = new Schema<ChecklistItem>(
  {
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
    subItems: { type: [ChecklistSubItemSchema], default: [] },
  },
  { _id: true },
);

const AssignmentHistorySchema = new Schema<AssignmentHistoryEntry>(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    toUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: ["assigned", "reassigned", "forwarded"],
      required: true,
    },
    note: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true },
);

const CallReminderSchema = new Schema<CallReminder>(
  {
    clientName: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    scheduledAt: { type: Date, required: true },
    notes: { type: String, default: "" },
    completed: { type: Boolean, default: false },
  },
  { _id: true },
);

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      default: "Other Work",
      index: true,
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "pending_approval", "completed", "overdue"],
      default: "pending",
      index: true,
    },
    deadline: { type: Date, default: null, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    submittedForApprovalAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    localPath: { type: String, default: "", trim: true },
    assignmentHistory: { type: [AssignmentHistorySchema], default: [] },
    caseId: { type: Schema.Types.ObjectId, ref: "Case", index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", index: true },
    checklist: { type: [ChecklistItemSchema], default: [] },
    callReminder: { type: CallReminderSchema, default: undefined },
    agent: { type: String, default: "" },
    isCall: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
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

TaskSchema.index({ title: "text", description: "text" });
TaskSchema.index({ deadline: 1, status: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ category: 1, priority: 1 });
TaskSchema.index({ isCall: 1, "callReminder.scheduledAt": 1 });

// ---------------------------------------------------------------------------
// Pre-save: auto-set overdue status & initial assignment
// ---------------------------------------------------------------------------

TaskSchema.pre("save", function (next) {
  if (
    this.deadline &&
    this.deadline < new Date() &&
    this.status !== "completed" &&
    this.status !== "pending_approval"
  ) {
    this.status = "overdue";
  }

  // Set initial assignment timestamps and history if newly assigned
  if (this.isNew && this.assignedTo) {
    if (!this.assignedAt) this.assignedAt = new Date();
    if (!this.assignedBy) this.assignedBy = this.createdBy;
    if (!this.assignmentHistory || this.assignmentHistory.length === 0) {
      this.assignmentHistory = [
        {
          fromUser: null,
          toUser: this.assignedTo,
          assignedBy: this.assignedBy || this.createdBy,
          action: "assigned",
          note: "Initial task assignment",
          timestamp: this.assignedAt || new Date(),
        },
      ];
    }
  }

  next();
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const Task = mongoose.model<ITask>("Task", TaskSchema);
