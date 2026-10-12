import mongoose, { Document, Schema } from "mongoose";

export interface IGmailAccount extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  syncStatus: "connected" | "disconnected" | "error";
  isDefault: boolean;
  label?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GmailAccountSchema = new Schema<IGmailAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    accessToken: {
      type: String,
      required: true,
      set(val: string) {
        if (!val) return val;
        try {
          const { encryptSecret } = require("../services/encryption.js");
          return encryptSecret(val);
        } catch {
          return val;
        }
      },
      get(val: string) {
        if (!val) return val;
        try {
          const { decryptSecret } = require("../services/encryption.js");
          return decryptSecret(val);
        } catch {
          return val;
        }
      },
    },
    refreshToken: {
      type: String,
      default: "",
      set(val: string) {
        if (!val) return val;
        try {
          const { encryptSecret } = require("../services/encryption.js");
          return encryptSecret(val);
        } catch {
          return val;
        }
      },
      get(val: string) {
        if (!val) return val;
        try {
          const { decryptSecret } = require("../services/encryption.js");
          return decryptSecret(val);
        } catch {
          return val;
        }
      },
    },
    expiryDate: { type: Number, default: 0 },
    syncStatus: {
      type: String,
      enum: ["connected", "disconnected", "error"],
      default: "connected",
      index: true,
    },
    isDefault: { type: Boolean, default: false },
    label: { type: String, default: "" },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toObject: { getters: true },
    toJSON: {
      getters: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).__v;
        // Never expose access tokens or refresh tokens in API JSON output
        delete (ret as any).accessToken;
        delete (ret as any).refreshToken;
        return ret;
      },
    },
  }
);

// Compound index allows multiple Gmail accounts per employee, but prevents duplicate linkage of the same email
GmailAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

export const GmailAccount = mongoose.model<IGmailAccount>("GmailAccount", GmailAccountSchema);
