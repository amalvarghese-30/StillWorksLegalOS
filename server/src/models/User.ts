import mongoose, { Document, Schema } from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "employee" | "senior_advocate" | "junior_advocate" | "legal_assistant" | "office_staff" | "reception" | "intern";
export type UserStatus = "online" | "offline" | "away";

/**
 * Permission groups — mirrors the frontend module list.
 * Each boolean controls whether the user can access that module.
 */
export interface UserPermissions {
  dashboard: boolean;
  clients: boolean;
  cases: boolean;
  tasks: boolean;
  documents: boolean;
  calendar: boolean;
  chat: boolean;
  reports: boolean;
  employees: boolean;       // admin only
  approvals: boolean;       // admin only
  auditLogs: boolean;       // admin only
  settings: boolean;        // admin only
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  title: string;
  status: UserStatus;
  phone?: string;
  avatarUrl?: string;
  permissions: UserPermissions;
  // Firm details (per-user firm settings)
  firmName?: string;
  firmBarRegistration?: string;
  firmPrimaryCourt?: string;
  firmAddress?: string;
  firmLogoUrl?: string;
  // Notification preferences
  notifyHearingReminders?: boolean;
  notifyApprovalRequests?: boolean;
  notifyCallReminders?: boolean;
  notifyDailyDigest?: boolean;
  // Security preferences
  securityTwoFactor?: boolean;
  securitySessionTimeout?: boolean;
  securityLoginAlerts?: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Default permissions by role
// ---------------------------------------------------------------------------

const EMPLOYEE_PERMISSIONS: UserPermissions = {
  dashboard: true,
  clients: true,
  cases: true,
  tasks: true,
  documents: true,
  calendar: true,
  chat: true,
  reports: true,
  employees: false,
  approvals: false,
  auditLogs: false,
  settings: false,
};

const ADMIN_PERMISSIONS: UserPermissions = {
  dashboard: true,
  clients: true,
  cases: true,
  tasks: true,
  documents: true,
  calendar: true,
  chat: true,
  reports: true,
  employees: true,
  approvals: true,
  auditLogs: true,
  settings: true,
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "employee", "senior_advocate", "junior_advocate", "legal_assistant", "office_staff", "reception", "intern"],
      default: "junior_advocate",
    },
    title: { type: String, default: "" },
    status: {
      type: String,
      enum: ["online", "offline", "away"],
      default: "offline",
    },
    phone: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    permissions: {
      type: Schema.Types.Mixed,
      default: () => ({ ...EMPLOYEE_PERMISSIONS }),
    },
    // Firm details
    firmName: { type: String, default: "" },
    firmBarRegistration: { type: String, default: "" },
    firmPrimaryCourt: { type: String, default: "" },
    firmAddress: { type: String, default: "" },
    firmLogoUrl: { type: String, default: "" },
    // Notification preferences
    notifyHearingReminders: { type: Boolean, default: true },
    notifyApprovalRequests: { type: Boolean, default: true },
    notifyCallReminders: { type: Boolean, default: true },
    notifyDailyDigest: { type: Boolean, default: false },
    // Security preferences
    securityTwoFactor: { type: Boolean, default: true },
    securitySessionTimeout: { type: Boolean, default: true },
    securityLoginAlerts: { type: Boolean, default: true },
    lastActiveAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete (ret as any).passwordHash;
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Pre-save hook: set permissions based on role if not explicitly set
// ---------------------------------------------------------------------------

UserSchema.pre("save", function (next) {
  if (this.isModified("role") && !this.isModified("permissions")) {
    this.permissions = this.role === "admin" ? { ...ADMIN_PERMISSIONS } : { ...EMPLOYEE_PERMISSIONS };
  }
  next();
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const User = mongoose.model<IUser>("User", UserSchema);
