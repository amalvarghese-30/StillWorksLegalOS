import mongoose, { Document, Schema } from "mongoose";
import { encryptSecret } from "../services/encryption.js";

// ---------------------------------------------------------------------------
// Types — application filesystem storage configuration
// ---------------------------------------------------------------------------

export interface StorageConfig {
  provider: "filesystem";
  storageRoot: string;
  configured: boolean;
  status: "active" | "error";
  error?: string;
}

// Backward compatibility aliases
export type SynologyConfig = StorageConfig;
export type SynologyConfigInput = Partial<StorageConfig>;

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

export const UNIFIED_CATEGORIES: string[] = [
  "Property Tax Transfer",
  "MGL Transfer",
  "MSEDCL Transfer",
  "CIDCO Papers",
  "Society Bye-Laws Papers",
  "MOU",
  "Agreement for Sale",
  "Sale Deed",
  "Sale Deed / Soc Doc",
  "POA",
  "Water Tax Transfer",
  "Will",
  "Paper Notice",
  "Registration",
  "Agreement",
  "Gift Deed",
  "CIDCO Doc",
  "CIDCO Transfer",
  "CIDCO Mortgage",
  "CIDCO Other",
  "Other Documents",
  "Other Work",
  "Court Case",
  "Meeting",
  "Personal",
];

export const DEFAULT_TASK_OPTIONS: TaskOptions = {
  categories: UNIFIED_CATEGORIES,
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

AppSettingsSchema.statics.getStorageConfig = async function (): Promise<StorageConfig> {
  const { STORAGE_ROOT } = await import("../services/storage.js");
  const doc = await this.findOne({ key: "storage" });
  if (doc?.value) {
    return doc.value as StorageConfig;
  }
  return {
    provider: "filesystem",
    storageRoot: STORAGE_ROOT,
    configured: true,
    status: "active",
  };
};

AppSettingsSchema.statics.getSynologyConfig = async function (): Promise<StorageConfig | null> {
  return (this as any).getStorageConfig();
};

AppSettingsSchema.statics.setStorageConfig = async function (
  config: Partial<StorageConfig>,
  userId: string,
): Promise<void> {
  const { STORAGE_ROOT } = await import("../services/storage.js");
  const stored: StorageConfig = {
    provider: "filesystem",
    storageRoot: config.storageRoot || STORAGE_ROOT,
    configured: true,
    status: "active",
  };

  await this.findOneAndUpdate(
    { key: "storage" },
    { $set: { value: stored, updatedBy: userId } },
    { upsert: true, new: true },
  );
};

AppSettingsSchema.statics.setSynologyConfig = async function (
  config: SynologyConfigInput,
  userId: string,
): Promise<void> {
  return (this as any).setStorageConfig(config, userId);
};

AppSettingsSchema.statics.getTaskOptions = async function (): Promise<TaskOptions> {
  const doc = await this.findOne({ key: "task_options" });
  const stored = (doc?.value ?? {}) as Partial<TaskOptions>;
  const baseCategories = stored.categories ? [...stored.categories] : [...DEFAULT_TASK_OPTIONS.categories];
  
  // Ensure all unified categories are present without duplicates, while preserving custom categories
  for (const cat of UNIFIED_CATEGORIES) {
    if (!baseCategories.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      baseCategories.push(cat);
    }
  }

  return {
    categories: baseCategories,
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
// Default storage config (application filesystem)
// ---------------------------------------------------------------------------

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  provider: "filesystem",
  storageRoot: process.env["STORAGE_DIR"] ?? "./uploads",
  configured: true,
  status: "active",
};

export const DEFAULT_NAS_CONFIG = DEFAULT_STORAGE_CONFIG;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

interface AppSettingsModel extends mongoose.Model<IAppSettings> {
  getStorageConfig(): Promise<StorageConfig>;
  setStorageConfig(config: Partial<StorageConfig>, userId: string): Promise<void>;
  getSynologyConfig(): Promise<StorageConfig | null>;
  setSynologyConfig(config: SynologyConfigInput, userId: string): Promise<void>;
  getTaskOptions(): Promise<TaskOptions>;
  setTaskOptions(options: TaskOptions, userId: string): Promise<void>;
}

export const AppSettings = mongoose.model<IAppSettings, AppSettingsModel>("AppSettings", AppSettingsSchema);
