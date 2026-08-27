import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaseStatus = "Active" | "On Hold" | "Closed" | "Urgent";
export type CasePriority = "High" | "Medium" | "Low";
export type CasePractice =
  | "Property"
  | "Corporate"
  | "Family"
  | "Criminal"
  | "Taxation"
  | "Heirship"
  | "CIDCO Transfer"
  | "Other";

/** A linked party on the case (client, sub-client, opposing party, counsel) */
export interface CaseParty {
  clientId?: mongoose.Types.ObjectId;   // reference to Client collection
  name: string;
  role: string;                          // e.g., "Primary Client", "Buyer", "Seller", "Defendant", "Opposing Counsel"
  type: "client" | "sub_client" | "opposing_party" | "counsel" | "other";
}

export interface CaseNote {
  text: string;
  author: string;                        // user name
  authorId: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface CaseTimelineEntry {
  event: string;
  by: string;
  when: Date;
}

export interface ICase extends Document {
  number: string;                        // Internal case ID (e.g., SW-2026-0001)
  courtCaseId?: string;                  // External case ID/CNR (e.g., CNR123456789)
  title: string;
  description: string;
  practice: CasePractice;
  court: string;
  judge: string;
  status: CaseStatus;
  priority: CasePriority;
  nextHearing: Date | null;
  parties: CaseParty[];
  assignedTo: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  notes: CaseNote[];
  timeline: CaseTimelineEntry[];
  nasPath: string;                       // NAS folder path for this case
  progress: number;                      // 0-100
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CasePartySchema = new Schema<CaseParty>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["client", "sub_client", "opposing_party", "counsel", "other"],
      default: "client",
    },
  },
  { _id: true },
);

const CaseNoteSchema = new Schema<CaseNote>(
  {
    text: { type: String, required: true },
    author: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const CaseTimelineSchema = new Schema<CaseTimelineEntry>(
  {
    event: { type: String, required: true },
    by: { type: String, required: true },
    when: { type: Date, default: Date.now },
  },
  { _id: true },
);

const CaseSchema = new Schema<ICase>(
  {
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    courtCaseId: {
      type: String,
      trim: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    practice: {
      type: String,
      enum: ["Property", "Corporate", "Family", "Criminal", "Taxation", "Heirship", "CIDCO Transfer", "Other"],
      default: "Property",
    },
    court: { type: String, default: "" },
    judge: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Active", "On Hold", "Closed", "Urgent"],
      default: "Active",
      index: true,
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    nextHearing: { type: Date, default: null },
    parties: { type: [CasePartySchema], default: [] },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: [CaseNoteSchema], default: [] },
    timeline: { type: [CaseTimelineSchema], default: [] },
    nasPath: { type: String, default: "" },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    tags: { type: [String], default: [] },
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
// Text index for search (updated to include courtCaseId)
// ---------------------------------------------------------------------------

CaseSchema.index({
  number: "text",
  title: "text",
  court: "text",
  "parties.name": "text",
  courtCaseId: "text",
});

// ---------------------------------------------------------------------------
// Auto-generate case number on save
// ---------------------------------------------------------------------------

CaseSchema.pre("validate", async function (next) {
  if (this.isNew && !this.number) {
    const year = new Date().getFullYear();
    const count = await mongoose.model("Case").countDocuments();
    this.number = `SW-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const Case = mongoose.model<ICase>("Case", CaseSchema);
