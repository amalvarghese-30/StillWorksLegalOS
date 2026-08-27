import mongoose, { Document, Schema } from "mongoose";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileIntegrityStatus = "verified" | "tampered" | "missing" | "pending";

export interface IFileIntegrity extends Document {
  // Document reference
  documentId: mongoose.Types.ObjectId;
  originalName: string;
  storedPath: string;           // NAS path or storage location
  size: number;
  mimeType: string;

  // Hash verification
  sha256: string;               // SHA-256 hash of the file content
  algorithm: "SHA-256";         // For future extensibility

  // Chain of custody
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  lastVerifiedAt?: Date;
  status: FileIntegrityStatus;

  // Verification history
  verifications: {
    verifiedAt: Date;
    verifiedBy: mongoose.Types.ObjectId;
    status: FileIntegrityStatus;
    computedHash: string;
  }[];

  // Metadata
  caseId?: mongoose.Types.ObjectId;
  tags?: string[];
}

export interface IFileIntegrityModel extends mongoose.Model<IFileIntegrity> {
  registerFile(data: {
    documentId: mongoose.Types.ObjectId;
    originalName: string;
    storedPath: string;
    size: number;
    mimeType: string;
    sha256: string;
    uploadedBy: mongoose.Types.ObjectId;
    caseId?: mongoose.Types.ObjectId;
    tags?: string[];
  }): Promise<IFileIntegrity>;
  verifyFile(
    fileIntegrityId: mongoose.Types.ObjectId,
    verifiedBy: mongoose.Types.ObjectId,
    actualHash: string
  ): Promise<IFileIntegrity | null>;
  verifyAllPending(
    verifiedBy: mongoose.Types.ObjectId,
    getFileBuffer: (storedPath: string) => Promise<Buffer | null>
  ): Promise<{ verified: number; tampered: number; missing: number }>;
}

// ---------------------------------------------------------------------------
// Utility: Compute SHA-256 hash of a file
// ---------------------------------------------------------------------------

export async function computeFileHash(filePath: string): Promise<string> {
  const fs = await import("node:fs/promises");
  const fileBuffer = await fs.readFile(filePath);
  return createHash("sha256").update(fileBuffer).digest("hex");
}

export function computeHashFromBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FileIntegritySchema = new Schema<IFileIntegrity>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      unique: true,
      index: true,
    },
    originalName: { type: String, required: true },
    storedPath: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    sha256: { type: String, required: true, index: true },
    algorithm: { type: String, enum: ["SHA-256"], default: "SHA-256" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    uploadedAt: { type: Date, default: Date.now, required: true },
    lastVerifiedAt: { type: Date },
    status: {
      type: String,
      enum: ["verified", "tampered", "missing", "pending"],
      default: "pending",
      index: true,
    },
    verifications: [
      {
        verifiedAt: { type: Date, default: Date.now },
        verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["verified", "tampered", "missing"], required: true },
        computedHash: { type: String, required: true },
      },
    ],
    caseId: { type: Schema.Types.ObjectId, ref: "Case", index: true },
    tags: [{ type: String }],
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

// Indexes
FileIntegritySchema.index({ uploadedAt: -1 });
FileIntegritySchema.index({ status: 1, lastVerifiedAt: 1 });

// ---------------------------------------------------------------------------
// Static methods
// ---------------------------------------------------------------------------

FileIntegritySchema.statics.registerFile = async function (data: {
  documentId: mongoose.Types.ObjectId;
  originalName: string;
  storedPath: string;
  size: number;
  mimeType: string;
  sha256: string;
  uploadedBy: mongoose.Types.ObjectId;
  caseId?: mongoose.Types.ObjectId;
  tags?: string[];
}): Promise<IFileIntegrity> {
  return this.create({
    ...data,
    status: "verified", // Newly registered files are considered verified
    lastVerifiedAt: new Date(),
    verifications: [
      {
        verifiedAt: new Date(),
        verifiedBy: data.uploadedBy,
        status: "verified",
        computedHash: data.sha256,
      },
    ],
  });
};

FileIntegritySchema.statics.verifyFile = async function (
  fileIntegrityId: mongoose.Types.ObjectId,
  verifiedBy: mongoose.Types.ObjectId,
  actualHash: string
): Promise<IFileIntegrity | null> {
  const record = await this.findById(fileIntegrityId);
  if (!record) return null;

  const isValid = actualHash === record.sha256;
  const status: FileIntegrityStatus = isValid ? "verified" : "tampered";

  record.status = status;
  record.lastVerifiedAt = new Date();
  record.verifications.push({
    verifiedAt: new Date(),
    verifiedBy,
    status,
    computedHash: actualHash,
  });

  await record.save();
  return record;
};

FileIntegritySchema.statics.verifyAllPending = async function (
  verifiedBy: mongoose.Types.ObjectId,
  getFileBuffer: (storedPath: string) => Promise<Buffer | null>
): Promise<{ verified: number; tampered: number; missing: number }> {
  const pending = await this.find({ status: { $in: ["pending", "verified"] } }).lean();
  let verified = 0;
  let tampered = 0;
  let missing = 0;

  for (const record of pending) {
    try {
      const buffer = await getFileBuffer(record.storedPath);
      if (!buffer) {
        missing++;
        await this.findByIdAndUpdate(record._id, {
          status: "missing",
          lastVerifiedAt: new Date(),
          $push: {
            verifications: {
              verifiedAt: new Date(),
              verifiedBy,
              status: "missing",
              computedHash: "",
            },
          },
        });
        continue;
      }

      const computedHash = computeHashFromBuffer(buffer);
      const isValid = computedHash === record.sha256;

      await this.findByIdAndUpdate(record._id, {
        status: isValid ? "verified" : "tampered",
        lastVerifiedAt: new Date(),
        $push: {
          verifications: {
            verifiedAt: new Date(),
            verifiedBy,
            status: isValid ? "verified" : "tampered",
            computedHash,
          },
        },
      });

      if (isValid) verified++;
      else tampered++;
    } catch {
      missing++;
      await this.findByIdAndUpdate(record._id, {
        status: "missing",
        lastVerifiedAt: new Date(),
        $push: {
          verifications: {
            verifiedAt: new Date(),
            verifiedBy,
            status: "missing",
            computedHash: "",
          },
        },
      });
    }
  }

  return { verified, tampered, missing };
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const FileIntegrity = mongoose.model<IFileIntegrity, IFileIntegrityModel>("FileIntegrity", FileIntegritySchema);