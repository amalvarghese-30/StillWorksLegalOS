import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientType = "Individual" | "Corporate";
export type ClientTag = "Active" | "VIP" | "Corporate" | "Individual" | "Archived";
export type KYCStatus = "Verified" | "Pending" | "Rejected";

/** A linked sub-client with role description (e.g., Buyer, Seller, Power of Attorney) */
export interface SubClient {
  name: string;
  relationship: string;      // e.g., "Buyer", "Seller", "Power of Attorney"
  phone?: string;
  email?: string;
  aadhar?: string;
  pan?: string;
  notes?: string;
}

export interface IClient extends Document {
  type: ClientType;
  tag: ClientTag;
  name: string;
  phone: string;
  email: string;
  address: string;
  aadhar: string;            // Aadhar Card Number
  pan: string;               // PAN Card Number
  kyc: KYCStatus;
  // Optional property details
  propertyDetails?: {
    address: string;
    surveyNo: string;
    chsName: string;
    sector: string;
    plot: string;
    area: string;
  };
  subClients: SubClient[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SubClientSchema = new Schema<SubClient>(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    aadhar: { type: String, default: "" },
    pan: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: true },
);

const ClientSchema = new Schema<IClient>(
  {
    type: {
      type: String,
      enum: ["Individual", "Corporate"],
      default: "Individual",
    },
    tag: {
      type: String,
      enum: ["Active", "VIP", "Corporate", "Individual", "Archived"],
      default: "Active",
    },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: "", index: true },
    email: { type: String, default: "", lowercase: true, trim: true, index: true },
    address: { type: String, default: "" },
    aadhar: { type: String, default: "", index: true },
    pan: { type: String, default: "", index: true },
    kyc: {
      type: String,
      enum: ["Verified", "Pending", "Rejected"],
      default: "Pending",
    },
    propertyDetails: {
      type: new Schema(
        {
          address: { type: String, default: "" },
          surveyNo: { type: String, default: "" },
          chsName: { type: String, default: "" },
          sector: { type: String, default: "" },
          plot: { type: String, default: "" },
          area: { type: String, default: "" },
        },
        { _id: false },
      ),
      default: undefined,
    },
    subClients: { type: [SubClientSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
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
// Text index for universal search (name, phone, PAN, Aadhar, property)
// ---------------------------------------------------------------------------

ClientSchema.index({
  name: "text",
  phone: "text",
  pan: "text",
  aadhar: "text",
  "propertyDetails.address": "text",
  "propertyDetails.chsName": "text",
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const Client = mongoose.model<IClient>("Client", ClientSchema);
