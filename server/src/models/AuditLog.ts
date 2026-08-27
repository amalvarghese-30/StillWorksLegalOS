import mongoose, { Document, Schema, Types } from "mongoose";
import { createHash } from "node:crypto";
import { Socket } from "socket.io";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "upload"
  | "download"
  | "access_request"
  | "settings_change"
  | "report"
  | "seed";

export type AuditResource =
  | "auth"
  | "client"
  | "case"
  | "task"
  | "document"
  | "calendar"
  | "chat"
  | "user"
  | "settings"
  | "approval";

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  resourceName?: string;
  details?: string;
  ip: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  // Tamper-evident fields
  hash: string;           // SHA-256 of this log entry
  prevHash?: string;      // SHA-256 of previous log entry (chain)
  sequence: number;       // Monotonic sequence number
  createdAt: Date;
}

export interface IAuditLogModel extends mongoose.Model<IAuditLog> {
  log(data: {
    userId: mongoose.Types.ObjectId;
    userName: string;
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    resourceName?: string;
    details?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<IAuditLog>;
  logWithActivity(
    data: {
      userId: mongoose.Types.ObjectId;
      userName: string;
      action: AuditAction;
      resource: AuditResource;
      resourceId?: string;
      resourceName?: string;
      details?: string;
      ip?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    },
    io: Socket | null
  ): Promise<IAuditLog>;
  verifyChain(): Promise<{
    valid: boolean;
    brokenAt?: number;
    totalChecked: number;
  }>;
}

// ---------------------------------------------------------------------------
// Utility: Compute hash for a log entry
// ---------------------------------------------------------------------------

function computeLogHash(log: Partial<IAuditLog>): string {
  const data = JSON.stringify({
    userId: log.userId?.toString(),
    userName: log.userName,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    resourceName: log.resourceName,
    details: log.details,
    ip: log.ip,
    userAgent: log.userAgent,
    metadata: log.metadata,
    prevHash: log.prevHash,
    sequence: log.sequence,
    createdAt: log.createdAt?.toISOString?.() ?? new Date().toISOString(),
  });
  return createHash("sha256").update(data).digest("hex");
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "login",
        "logout",
        "create",
        "update",
        "delete",
        "approve",
        "reject",
        "upload",
        "download",
        "access_request",
        "settings_change",
        "report",
        "seed",
      ],
      required: true,
      index: true,
    },
    resource: {
      type: String,
      enum: [
        "auth",
        "client",
        "case",
        "task",
        "document",
        "calendar",
        "chat",
        "user",
        "settings",
        "approval",
      ],
      required: true,
      index: true,
    },
    resourceId: { type: String },
    resourceName: { type: String },
    details: { type: String },
    ip: { type: String, default: "" },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    // Tamper-evident fields
    hash: { type: String, required: true, index: true },
    prevHash: { type: String, index: true },
    sequence: { type: Number, required: true, unique: true, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Auto-populate tamper-evident fields
//
// `sequence`, `prevHash`, and `hash` are required but callers (routes, seed)
// write raw entries via `create()`. Compute them here so every write forms a
// valid, verifiable chain without each call site having to do so.
// ---------------------------------------------------------------------------

AuditLogSchema.pre("validate", async function (next) {
  try {
    if (this.isNew) {
      // Stabilize createdAt before hashing so the stored timestamp always
      // matches the timestamp baked into the hash (verification depends on it).
      if (!this.createdAt) this.createdAt = new Date();

      if (this.sequence == null) {
        const Model = this.constructor as IAuditLogModel;
        const lastLog = await Model.findOne().sort({ sequence: -1 }).lean();
        this.sequence = (lastLog?.sequence ?? 0) + 1;
        if (this.prevHash == null) this.prevHash = lastLog?.hash;
      }

      if (this.hash == null) {
        this.hash = computeLogHash(this as any);
      }
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ resource: 1, action: 1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Static helper
// ---------------------------------------------------------------------------

AuditLogSchema.statics.log = async function (data: {
  userId: mongoose.Types.ObjectId;
  userName: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  resourceName?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<IAuditLog> {
  // The pre-validate hook computes sequence/prevHash/hash automatically.
  return this.create({ ...data });
};

AuditLogSchema.statics.logWithActivity = async function (
  data: {
    userId: mongoose.Types.ObjectId;
    userName: string;
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    resourceName?: string;
    details?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  },
  io: Socket | null
): Promise<IAuditLog> {
  // Create the audit log first
  const log = await this.create({ ...data });

  // Emit activity event if io is available
  if (io) {
    // Determine activity type based on action and resource
    let activityAction = `${data.action}_${data.resource}`;
    // Clean up the activity action to be more readable
    activityAction = activityAction.replace(/_/g, " ");

    io.to("admin:live-feed").emit("activity:event", {
      userId: data.userId.toString(),
      userName: data.userName,
      action: activityAction,
      resourceId: data.resourceId,
      resourceName: data.resourceName,
      timestamp: new Date().toISOString(),
    });
  }

  return log;
};

// Verify the integrity of the audit log chain
AuditLogSchema.statics.verifyChain = async function (): Promise<{
  valid: boolean;
  brokenAt?: number;
  totalChecked: number;
}> {
  const logs = await this.find().sort({ sequence: 1 }).lean();
  let prevHash: string | undefined;
  let valid = true;
  let brokenAt: number | undefined;

  for (const log of logs) {
    const computedHash = computeLogHash({
      ...log,
      createdAt: log.createdAt,
    });

    if (computedHash !== log.hash) {
      valid = false;
      brokenAt = log.sequence;
      break;
    }

    if (prevHash && log.prevHash !== prevHash) {
      valid = false;
      brokenAt = log.sequence;
      break;
    }

    prevHash = log.hash;
  }

  return { valid, brokenAt, totalChecked: logs.length };
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const AuditLog = mongoose.model<IAuditLog, IAuditLogModel>("AuditLog", AuditLogSchema);
