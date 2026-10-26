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
  /** True only for the canonical CalendarEvent representing Case.nextHearing. */
  isNextHearing?: boolean;
  color?: string;
  hearingStatus?: "scheduled" | "held" | "rescheduled" | "cancelled";
  hearingRecordId?: mongoose.Types.ObjectId | null;
  remarks?: string;
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
    isNextHearing: { type: Boolean, default: false, index: true },
    hearingStatus: {
      type: String,
      enum: ["scheduled", "held", "rescheduled", "cancelled"],
      default: "scheduled",
    },
    hearingRecordId: { type: Schema.Types.ObjectId, ref: "HearingRecord", default: null },
    remarks: { type: String, default: "" },
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

// At most one canonical "next hearing" event per case. Historical hearing events
// remain unmarked (isNextHearing: false) and are deliberately preserved when the next date changes.
CalendarEventSchema.index(
  { caseId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "hearing", isNextHearing: true },
    name: "uniq_next_hearing_per_case",
  },
);

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const CalendarEvent = mongoose.model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);
