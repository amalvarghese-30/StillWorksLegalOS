import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HearingStatus = "held" | "rescheduled" | "cancelled" | "scheduled";

export interface IHearingRecord extends Document {
  caseId: mongoose.Types.ObjectId;
  hearingDate: Date;
  status: HearingStatus;
  remarks: string;
  nextHearingDate?: Date | null;
  recordedBy: mongoose.Types.ObjectId;
  calendarEventId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const HearingRecordSchema = new Schema<IHearingRecord>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    hearingDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["held", "rescheduled", "cancelled", "scheduled"],
      default: "held",
      index: true,
    },
    remarks: { type: String, default: "", trim: true },
    nextHearingDate: { type: Date, default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    calendarEventId: { type: Schema.Types.ObjectId, ref: "CalendarEvent", default: null },
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

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

HearingRecordSchema.index({ caseId: 1, hearingDate: -1 });
HearingRecordSchema.index({ caseId: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const HearingRecord = mongoose.model<IHearingRecord>("HearingRecord", HearingRecordSchema);
