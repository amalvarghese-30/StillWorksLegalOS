import mongoose, { Document, Schema } from "mongoose";

export interface IGmailAccount extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  syncStatus: "connected" | "disconnected" | "error";
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GmailAccountSchema = new Schema<IGmailAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, default: "" },
    expiryDate: { type: Number, default: 0 },
    syncStatus: {
      type: String,
      enum: ["connected", "disconnected", "error"],
      default: "connected",
    },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const GmailAccount = mongoose.model<IGmailAccount>("GmailAccount", GmailAccountSchema);
