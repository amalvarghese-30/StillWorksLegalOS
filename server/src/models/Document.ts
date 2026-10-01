import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentState = "Pending" | "Approved" | "Rejected" | "Draft";

export interface IDocument extends Document {
  name: string;
  originalName: string;
  kind: string; // file extension: PDF, DOCX, XLSX, ZIP, etc.
  mimeType: string;
  size: number; // bytes
  sizeFormatted: string; // human-readable: "3.2 MB"
  caseId: mongoose.Types.ObjectId | null;
  clientId?: mongoose.Types.ObjectId | null;
  uploadedBy: mongoose.Types.ObjectId;
  state: DocumentState;
  storagePath: string; // full path in application filesystem storage
  storageFolder: string; // parent folder in application filesystem storage
  nasPath?: string; // legacy alias
  nasFolder?: string; // legacy alias
  version: number;
  sha256?: string; // SHA-256 hash for integrity verification
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedReason?: string;
  accessRequests: {
    userId: mongoose.Types.ObjectId;
    reason: string;
    status: "pending" | "approved" | "rejected";
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AccessRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const DocumentSchema = new Schema<IDocument>(
  {
    name: { type: String, required: true, trim: true, index: true },
    originalName: { type: String, required: true },
    kind: { type: String, default: "" },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    sizeFormatted: { type: String, default: "0 KB" },
    caseId: { type: Schema.Types.ObjectId, ref: "Case", index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", index: true, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    state: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Draft"],
      default: "Pending",
      index: true,
    },
    storagePath: { type: String, default: "" },
    storageFolder: { type: String, default: "" },
    nasPath: { type: String, default: "" },
    nasFolder: { type: String, default: "" },
    version: { type: Number, default: 1 },
    sha256: { type: String, default: "" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedReason: { type: String, default: "" },
    accessRequests: { type: [AccessRequestSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        delete (ret as any).storagePath;
        delete (ret as any).storageFolder;
        delete (ret as any).nasPath;
        delete (ret as any).nasFolder;
        delete (ret as any).filePath;
        delete (ret as any).tempPath;
        return ret;
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

DocumentSchema.index({ name: "text" });
DocumentSchema.index({ state: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const DocumentModel = mongoose.model<IDocument>("Document", DocumentSchema);
