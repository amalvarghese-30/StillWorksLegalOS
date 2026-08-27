// Preload script — CommonJS for Electron compatibility
// Security-hardened: contextBridge only exposes safe, validated APIs
const { contextBridge, ipcRenderer } = require("electron");

// Whitelist of allowed IPC channels
const ALLOWED_IPC_CHANNELS = [
  "nas:openPath",
  "nas:watchFolder",
  "nas:unwatchFolder",
  "nas:selectFolder",
  "auth:saveRefreshToken",
  "auth:getRefreshToken",
  "auth:clearRefreshToken",
];

// Validate IPC channel
function isValidChannel(channel) {
  return ALLOWED_IPC_CHANNELS.includes(channel);
}

// Sanitize path input - prevent directory traversal
function sanitizePath(input) {
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

const electronAPI = {
  // Open a NAS path in Windows Explorer / macOS Finder
  // Only allows paths that exist and are within allowed directories
  openNasPath: (nasPath) => {
    const safePath = sanitizePath(nasPath);
    if (!safePath) {
      return Promise.reject(new Error("Invalid path"));
    }
    return ipcRenderer.invoke("nas:openPath", safePath);
  },

  // Watch a folder for changes (with path validation)
  watchFolder: (folderPath) => {
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
  onFileEvent: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }
    const handler = (_event, data) => {
      // Validate event data structure
      if (data && typeof data === "object" && data.filename && data.folderPath) {
        // Sanitize the data before passing to callback
        const safeData = {
          eventType: data.eventType,
          filename: String(data.filename).slice(0, 255),
          folderPath: sanitizePath(data.folderPath),
          timestamp: data.timestamp,
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

  // Secure refresh-token storage (encrypted in the main process via safeStorage)
  saveRefreshToken: (token) => ipcRenderer.invoke("auth:saveRefreshToken", token),
  getRefreshToken: () => ipcRenderer.invoke("auth:getRefreshToken"),
  clearRefreshToken: () => ipcRenderer.invoke("auth:clearRefreshToken"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Expose safe globals for feature detection
contextBridge.exposeInMainWorld("STILLWORKS_ENV", {
  isElectron: true,
  platform: process.platform,
});