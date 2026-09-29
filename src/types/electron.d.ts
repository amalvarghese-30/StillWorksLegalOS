// Type declarations for the Electron context bridge API
// Exposed by electron/preload.ts via contextBridge.exposeInMainWorld

export interface FileEvent {
  eventType: "rename" | "change";
  filename: string | null;
  folderPath: string;
  timestamp: string;
}

export interface TokenResult {
  success: boolean;
  token?: string | null;
  error?: string;
}

export interface ElectronAPI {
  openNasPath: (nasPath: string) => Promise<{ success: boolean; error?: string }>;
  watchFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  unwatchFolder: () => Promise<{ success: boolean }>;
  selectFolder: () => Promise<string | null>;
  onFileEvent: (callback: (event: FileEvent) => void) => () => void;
  saveRefreshToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  getRefreshToken: () => Promise<TokenResult>;
  clearRefreshToken: () => Promise<{ success: boolean; error?: string }>;
  getVersion?: () => Promise<string>;
  isDev?: () => Promise<boolean>;
  showNotification?: (options: {
    title: string;
    body: string;
    sound?: boolean;
    tag?: string;
  }) => Promise<{ shown: boolean; reason?: string }>;
  isNotificationsPaused?: () => Promise<boolean>;
  setNotificationsPaused?: (paused: boolean) => Promise<{ success: boolean; paused: boolean }>;
  openExternal?: (url: string) => Promise<{ success: boolean; error?: string }>;
  saveFile?: (options: {
    defaultFilename: string;
    buffer: Uint8Array | number[];
    mimeType?: string;
  }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    STILLWORKS_ENV?: { isElectron: boolean; platform: string };
  }
}

export {};
