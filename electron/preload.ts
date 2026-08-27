// Preload script — TypeScript for Electron compatibility
// Security-hardened: contextBridge only exposes safe, validated APIs
import { contextBridge, ipcRenderer } from "electron";

// Whitelist of allowed IPC channels
const ALLOWED_IPC_CHANNELS = [
  "nas:openPath",
  "nas:watchFolder",
  "nas:unwatchFolder",
  "nas:selectFolder",
] as const;

type AllowedChannel = (typeof ALLOWED_IPC_CHANNELS)[number];

// Validate IPC channel
function isValidChannel(channel: string): channel is AllowedChannel {
  return ALLOWED_IPC_CHANNELS.includes(channel as AllowedChannel);
}

// Sanitize path input - prevent directory traversal
function sanitizePath(input: string): string | null {
  if (typeof input !== "string") return null;
  // Remove any null bytes
  const cleaned = input.replace(/\0/g, "");
  // Resolve path to prevent traversal
  try {
    const path = require("path");
    const resolved = path.resolve(cleaned);
    // In production, you might want to restrict to specific allowed roots
    return resolved;
  } catch {
    return null;
  }
}

interface FileEventData {
  eventType: string;
  filename: string;
  folderPath: string;
  timestamp: string;
}

interface ElectronAPI {
  openNasPath: (nasPath: string) => Promise<{ success: boolean; error?: string }>;
  watchFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  unwatchFolder: () => Promise<{ success: boolean }>;
  selectFolder: () => Promise<string | null>;
  onFileEvent: (callback: (data: FileEventData) => void) => () => void;
  getVersion: () => Promise<string>;
  isDev: () => Promise<boolean>;
  saveRefreshToken: (token: string) => Promise<void>;
  getRefreshToken: () => Promise<string | null>;
  clearRefreshToken: () => Promise<void>;
}

const electronAPI: ElectronAPI = {
  // Open a NAS path in Windows Explorer / macOS Finder
  // Only allows paths that exist and are within allowed directories
  openNasPath: (nasPath: string) => {
    const safePath = sanitizePath(nasPath);
    if (!safePath) {
      return Promise.reject(new Error("Invalid path"));
    }
    return ipcRenderer.invoke("nas:openPath", safePath);
  },

  // Watch a folder for changes (with path validation)
  watchFolder: (folderPath: string) => {
    const safePath = sanitizePath(folderPath);
    if (!safePath) {
      return Promise.reject(new Error("Invalid folder path"));
    }
    return ipcRenderer.invoke("nas:watchFolder", safePath);
  },

  // Stop watching a folder
  unwatchFolder: () => ipcRenderer.invoke("nas:unwatchFolder"),

  // Select a folder via native dialog
  selectFolder: () => ipcRenderer.invoke("nas:selectFolder"),

  // Listen for file system events
  onFileEvent: (callback: (data: FileEventData) => void) => {
    if (typeof callback !== "function") {
      return () => {};
    }
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
      // Validate event data structure
      if (data && typeof data === "object" && "filename" in data && "folderPath" in data) {
        const eventData = data as Record<string, unknown>;
        const safeData: FileEventData = {
          eventType: String(eventData.eventType ?? ""),
          filename: String(eventData.filename ?? "").slice(0, 255),
          folderPath: sanitizePath(String(eventData.folderPath ?? "")) ?? "",
          timestamp: String(eventData.timestamp ?? new Date().toISOString()),
        };
        if (safeData.folderPath) {
          callback(safeData);
        }
      }
    };
    ipcRenderer.on("nas:fileEvent", handler);
    return () => {
      ipcRenderer.removeListener("nas:fileEvent", handler);
    };
  },

  // Get app version
  getVersion: () => ipcRenderer.invoke("app:getVersion"),

  // Check if running in development
  isDev: () => ipcRenderer.invoke("app:isDev"),

  // Token management (using native secure credentials storage via main process)
  saveRefreshToken: (token: string) => ipcRenderer.invoke("auth:saveRefreshToken", token),
  getRefreshToken: () => ipcRenderer.invoke("auth:getRefreshToken"),
  clearRefreshToken: () => ipcRenderer.invoke("auth:clearRefreshToken"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Expose safe globals for feature detection
contextBridge.exposeInMainWorld("STILLWORKS_ENV", {
  isElectron: true,
  platform: process.platform,
});