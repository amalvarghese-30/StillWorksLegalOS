import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarEventType =
  | "hearing"
  | "task"
  | "call_reminder"
  | "leave"
  | "firm_event"
  | "personal";

export interface ICalendarEvent extends Document {
  title: string;
  description: string;
  type: CalendarEventType;
  start: Date;
  end: Date;
  allDay: boolean;
  caseId: mongoose.Types.ObjectId | null;
  clientId: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId[];
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    type: {
      type: String,
      enum: ["hearing", "task", "call_reminder", "leave", "firm_event", "personal"],
      default: "personal",
      index: true,
    },
    start: { type: Date, required: true, index: true },
    end: { type: Date, default: null },
    allDay: { type: Boolean, default: false },
    caseId: { type: Schema.Types.ObjectId, ref: "Case" },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    color: { type: String, default: "" },
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
// Index: query by date range
// ---------------------------------------------------------------------------

CalendarEventSchema.index({ start: 1, end: 1 });
CalendarEventSchema.index({ assignedTo: 1, start: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const CalendarEvent = mongoose.model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);
