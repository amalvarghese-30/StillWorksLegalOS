import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskCategory = string;
export type TaskPriority = "High" | "Medium" | "Low";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue";

/** A checklist item within a task */
export interface ChecklistItem {
  text: string;
  done: boolean;
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

const ChecklistItemSchema = new Schema<ChecklistItem>(
  { text: { type: String, required: true }, done: { type: Boolean, default: false } },
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
      enum: ["pending", "in_progress", "completed", "overdue"],
      default: "pending",
      index: true,
    },
    deadline: { type: Date, default: null, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
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

// ---------------------------------------------------------------------------
// Pre-save: auto-set overdue status
// ---------------------------------------------------------------------------

TaskSchema.pre("save", function (next) {
  if (this.deadline && this.deadline < new Date() && this.status !== "completed") {
    this.status = "overdue";
  }
  next();
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const Task = mongoose.model<ITask>("Task", TaskSchema);
