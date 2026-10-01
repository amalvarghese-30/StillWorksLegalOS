// Preload script — TypeScript for Electron compatibility
// Security-hardened: contextBridge only exposes safe, validated APIs
import { contextBridge, ipcRenderer } from "electron";

// Whitelist of allowed IPC channels
const ALLOWED_IPC_CHANNELS = [
  "auth:saveRefreshToken",
  "auth:getRefreshToken",
  "auth:clearRefreshToken",
  "app:getVersion",
  "app:isDev",
  "notification:show",
  "notification:isPaused",
  "notification:setPaused",
  "shell:openExternal",
  "dialog:saveFile",
] as const;

type AllowedChannel = (typeof ALLOWED_IPC_CHANNELS)[number];

// Validate IPC channel
function isValidChannel(channel: string): channel is AllowedChannel {
  return ALLOWED_IPC_CHANNELS.includes(channel as AllowedChannel);
}

interface ElectronAPI {
  getVersion: () => Promise<string>;
  isDev: () => Promise<boolean>;
  saveRefreshToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  getRefreshToken: () => Promise<{ success: boolean; token: string | null; error?: string }>;
  clearRefreshToken: () => Promise<{ success: boolean; error?: string }>;
  showNotification: (options: { title: string; body: string; sound?: boolean; tag?: string }) => Promise<{ shown: boolean; reason?: string }>;
  isNotificationsPaused: () => Promise<boolean>;
  setNotificationsPaused: (paused: boolean) => Promise<{ success: boolean; paused: boolean }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  saveFile: (options: { defaultFilename: string; buffer: Uint8Array | number[]; mimeType?: string }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
}

const electronAPI: ElectronAPI = {
  // Get app version
  getVersion: () => ipcRenderer.invoke("app:getVersion"),

  // Check if running in development
  isDev: () => ipcRenderer.invoke("app:isDev"),

  // Token management (using native secure credentials storage via main process)
  saveRefreshToken: (token: string) => ipcRenderer.invoke("auth:saveRefreshToken", token),
  getRefreshToken: () => ipcRenderer.invoke("auth:getRefreshToken"),
  clearRefreshToken: () => ipcRenderer.invoke("auth:clearRefreshToken"),

  // Native notifications
  showNotification: (options) => ipcRenderer.invoke("notification:show", options),
  isNotificationsPaused: () => ipcRenderer.invoke("notification:isPaused"),
  setNotificationsPaused: (paused) => ipcRenderer.invoke("notification:setPaused", paused),

  // Native external link opener
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  // Native save file dialog
  saveFile: (options) => ipcRenderer.invoke("dialog:saveFile", options),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Expose safe globals for feature detection
contextBridge.exposeInMainWorld("STILLWORKS_ENV", {
  isElectron: true,
  platform: process.platform,
});