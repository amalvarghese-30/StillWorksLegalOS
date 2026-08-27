import mongoose, { Document, Schema } from "mongoose";
import { encryptSecret } from "../services/encryption.js";

// ---------------------------------------------------------------------------
// Types — dynamic Synology WebDAV credentials
// ---------------------------------------------------------------------------

// Stored shape. The password is encrypted at rest (aes-256-gcm).
export interface SynologyConfig {
  url: string;                 // WebDAV base URL, e.g. "https://nas.stillworks.legal"
  username: string;
  passwordEncrypted: string;   // "iv:authTag:ciphertext" (base64), aes-256-gcm
  rootPath: string;            // LegalOS data root on the NAS, e.g. "/LegalOS"
}

// Input shape. The settings UI submits a plaintext password; we encrypt it
// before persisting so plaintext never touches the database.
export interface SynologyConfigInput {
  url: string;
  username: string;
  password: string;            // plaintext (never persisted)
  rootPath: string;
}

// ---------------------------------------------------------------------------
// Types — task workflow options (admin-managed)
// ---------------------------------------------------------------------------

export interface ChecklistTemplate {
  name: string;
  items: string[];
}

export interface TaskOptions {
  categories: string[];
  checklistTemplates: ChecklistTemplate[];
  agents: string[];
}

export const DEFAULT_TASK_OPTIONS: TaskOptions = {
  categories: [
    "Agreement",
    "Sale Deed / Soc Doc",
    "CIDCO Doc",
    "CIDCO Transfer",
    "CIDCO Mortgage",
    "CIDCO Other",
    "Other Documents",
    "Other Work",
    "Court Case",
    "Meeting",
    "Personal",
  ],
  checklistTemplates: [
    "Agreement",
    "Sale Deed / Soc Doc",
    "CIDCO Doc",
    "CIDCO Transfer",
    "CIDCO Mortgage",
    "Other Work",
    "Heirship Matters",
    "Other Court Work",
  ].map((name) => ({ name, items: [name] })),
  agents: [],
};

export interface IAppSettings extends Document {
  key: string;                 // unique settings key, e.g. "synology", "firm_info"
  value: SynologyConfig | TaskOptions | Record<string, unknown>;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// ---------------------------------------------------------------------------
// Static helpers
// ---------------------------------------------------------------------------

AppSettingsSchema.statics.getSynologyConfig = async function (): Promise<SynologyConfig | null> {
  const doc = await this.findOne({ key: "synology" });
  return (doc?.value as SynologyConfig) ?? null;
};

AppSettingsSchema.statics.setSynologyConfig = async function (
  config: SynologyConfigInput,
  userId: string,
): Promise<void> {
  // Preserve the existing encrypted password when the caller submits a blank
  // one (e.g. updating the URL/username without re-entering the password).
  const existing = await this.findOne({ key: "synology" });
  const existingEncrypted =
    (existing?.value as SynologyConfig | undefined)?.passwordEncrypted ?? "";

  const stored: SynologyConfig = {
    url: config.url,
    username: config.username,
    passwordEncrypted: config.password ? encryptSecret(config.password) : existingEncrypted,
    rootPath: config.rootPath,
  };

  await this.findOneAndUpdate(
    { key: "synology" },
    { $set: { value: stored, updatedBy: userId } },
    { upsert: true, new: true },
  );
};

AppSettingsSchema.statics.getTaskOptions = async function (): Promise<TaskOptions> {
  const doc = await this.findOne({ key: "task_options" });
  const stored = (doc?.value ?? {}) as Partial<TaskOptions>;
  return {
    categories: stored.categories ?? DEFAULT_TASK_OPTIONS.categories,
    checklistTemplates: stored.checklistTemplates ?? DEFAULT_TASK_OPTIONS.checklistTemplates,
    agents: stored.agents ?? DEFAULT_TASK_OPTIONS.agents,
  };
};

AppSettingsSchema.statics.setTaskOptions = async function (
  options: TaskOptions,
  userId: string,
): Promise<void> {
  await this.findOneAndUpdate(
    { key: "task_options" },
    { $set: { value: options, updatedBy: userId } },
    { upsert: true, new: true },
  );
};

// ---------------------------------------------------------------------------
// Default NAS config (loaded from env; overridden by the DB value at runtime)
// ---------------------------------------------------------------------------

export const DEFAULT_NAS_CONFIG: SynologyConfig = {
  url: process.env["NAS_URL"] ?? "https://nas.stillworks.legal",
  username: process.env["NAS_USERNAME"] ?? "",
  passwordEncrypted: "", // set through the settings UI (encrypted)
  rootPath: process.env["NAS_ROOT_PATH"] ?? "/LegalOS",
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface AppSettingsModel extends mongoose.Model<IAppSettings> {
  getSynologyConfig(): Promise<SynologyConfig | null>;
  setSynologyConfig(config: SynologyConfigInput, userId: string): Promise<void>;
  getTaskOptions(): Promise<TaskOptions>;
  setTaskOptions(options: TaskOptions, userId: string): Promise<void>;
}

export const AppSettings = mongoose.model<IAppSettings, AppSettingsModel>("AppSettings", AppSettingsSchema);
