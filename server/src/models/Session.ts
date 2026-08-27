import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;           // JWT access token (for blacklisting on logout)
  refreshTokenHash: string; // bcrypt hash of refresh token
  device: string;          // e.g., "Windows · Chrome", "Electron Desktop"
  ip: string;
  lastActiveAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: { type: String, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    device: { type: String, default: "Unknown" },
    ip: { type: String, default: "" },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
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

// TTL index: auto-delete expired sessions after 24h grace period
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

// Compound index for efficient lookup by user + active status
SessionSchema.index({ userId: 1, isRevoked: 1 });

// ---------------------------------------------------------------------------
// Static helpers
// ---------------------------------------------------------------------------

interface SessionModel extends mongoose.Model<ISession> {
  revokeAllForUser(userId: mongoose.Types.ObjectId): Promise<mongoose.UpdateWriteOpResult>;
  findActiveByUser(userId: mongoose.Types.ObjectId): Promise<ISession[]>;
}

SessionSchema.statics.revokeAllForUser = async function (userId: mongoose.Types.ObjectId) {
  return this.updateMany({ userId, isRevoked: false }, { $set: { isRevoked: true } });
};

SessionSchema.statics.findActiveByUser = async function (userId: mongoose.Types.ObjectId) {
  return this.find({ userId, isRevoked: false, expiresAt: { $gt: new Date() } });
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const Session = mongoose.model<ISession, SessionModel>("Session", SessionSchema);

// For use with `await import()` inside route files
export default Session;
