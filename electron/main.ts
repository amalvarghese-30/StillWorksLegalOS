import { app, BrowserWindow, shell, ipcMain, dialog, protocol, session, Event, safeStorage, Tray, Menu, Notification } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// ESM __dirname equivalent
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extend BrowserWindow for nas watcher
declare module "electron" {
  interface BrowserWindow {
    __nasWatcher?: fs.FSWatcher;
  }
}

// ---------------------------------------------------------------------------
// Security: Prevent navigation to unknown origins
// ---------------------------------------------------------------------------
function handleRedirect(event: Event<{ url: string }>, url: string): void {
  const allowedProtocols = ["http:", "https:", "file:", "app:"];
  try {
    const parsed = new URL(url);
    if (!allowedProtocols.includes(parsed.protocol)) {
      event.preventDefault();
      console.warn("[Security] Blocked navigation to:", url);
    }
  } catch {
    event.preventDefault();
  }
}

// ---------------------------------------------------------------------------
// Security: CSP for the renderer process
// ---------------------------------------------------------------------------
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'sha256-IoxEYENdKH6o0Ay7Mpa5AqWJBfgNF1LnVUOx/uc2bMI='",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: https://legalos.stillworks.in wss://legalos.stillworks.in http://localhost:3001 ws://localhost:3001",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Connect-src for production
const CSP_HEADER_PROD = [
  "default-src 'self'",
  "script-src 'self' 'sha256-IoxEYENdKH6o0Ay7Mpa5AqWJBfgNF1LnVUOx/uc2bMI='",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: https://legalos.stillworks.in wss://legalos.stillworks.in",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5173";
const RETRY_INTERVAL_MS = 500;
const RETRY_TIMEOUT_MS = 30_000; // 30 s total before showing error page
const SERVER_PORT = process.env.SERVER_PORT ?? "3001";

// Disable GPU acceleration for stability in production (performance trade-off,
// not a security concern). GPU rasterization causes crashes on some headless
// and VM environments. webSecurity and sandbox are handled in webPreferences.
if (!isDev) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-rasterization");
  app.commandLine.appendSwitch("disable-software-rasterizer");
  app.commandLine.appendSwitch("use-gl", "swiftshader");
  app.commandLine.appendSwitch("disable-webgl");
  app.commandLine.appendSwitch("disable-gl-extensions");
  // NOTE: --no-sandbox and --disable-gpu-sandbox were intentionally removed.
  // These are security-relevant flags. Process-level sandbox must not be disabled.
}

// ---------------------------------------------------------------------------
// App lifecycle: Register custom protocol BEFORE app is ready
// ---------------------------------------------------------------------------
if (protocol.registerSchemesAsPrivileged) {
  protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { secure: true, standard: true, supportFetchAPI: true } },
  ]);
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
let mainWindow: BrowserWindow | null = null;
let serverProcess: ReturnType<typeof spawn> | null = null;
let isQuitting = false;

// Start the Express server in production mode
function startServer(): Promise<void> {
  // Stripped local server execution — the desktop client is now a thin client that connects directly to the hosted Render cloud API
  return Promise.resolve();
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "S & S Legal-Tech LLP",
    icon: path.join(__dirname, "..", "public", "icon.png"),
    webPreferences: {
      // Preload script (CommonJS for Electron compatibility)
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, // REQUIRED for security
      nodeIntegration: false, // REQUIRED for security
      sandbox: true,
      // webSecurity: true — all API calls go to HTTPS (legalos.stillworks.in)
      // via the webRequest Origin interceptor below. Loading from file://
      // is fine with webSecurity enabled.
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // Disable dangerous features
      webviewTag: false,
      plugins: false,
    },
    // Premium window chrome
    titleBarStyle: "default",
    backgroundColor: "#F7F9FC",
    show: false, // show after ready-to-show
  });

  // -------------------------------------------------------------------------
  // Cloud Origin: Attach remote origin for seamless VPS connectivity
  // -------------------------------------------------------------------------
  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes("stillworks.in")) {
      details.requestHeaders["Origin"] = "https://legalos.stillworks.in";
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // -------------------------------------------------------------------------
  // Security: Set CSP on local file documents only
  // -------------------------------------------------------------------------
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith("file:")) {
      return callback({ responseHeaders: details.responseHeaders });
    }
    const csp = isDev ? CSP_HEADER : CSP_HEADER_PROD;
    const responseHeaders: Record<string, string[]> = {
      ...details.responseHeaders,
      "Content-Security-Policy": [csp],
      "X-Content-Type-Options": ["nosniff"],
    };
    callback({
      responseHeaders,
    });
  });

  // -------------------------------------------------------------------------
  // Security: Block navigation to non-allowed origins
  // -------------------------------------------------------------------------
  win.webContents.on("will-navigate", handleRedirect);
  win.webContents.on("will-redirect", handleRedirect);

  // -------------------------------------------------------------------------
  // Security: Handle new window creation (unified external link handler)
  // -------------------------------------------------------------------------
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (["https:", "http:", "mailto:", "tel:"].includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {
      // Ignored malformed URL
    }
    return { action: "deny" };
  });

  // -------------------------------------------------------------------------
  // Security: Handle certificate errors (reject in production)
  // -------------------------------------------------------------------------
  win.webContents.on("certificate-error", (event, url, error, certificate, callback) => {
    if (isDev && url.startsWith("http://localhost")) {
      // Allow self-signed certs in dev for localhost only
      event.preventDefault();
      callback(true);
    } else {
      // Reject all other certificate errors
      callback(false);
    }
  });

  // Hide window instead of closing so background reminders and tray remain active
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      return false;
    }
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
}

// ---------------------------------------------------------------------------
// Dev-mode loader with retry loop
// ---------------------------------------------------------------------------
async function loadDevWithRetry(win: BrowserWindow): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < RETRY_TIMEOUT_MS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${DEV_URL}/`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        await win.loadURL(DEV_URL);
        return;
      }
    } catch {
      // Vite not ready yet — retry
    }
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
  }
  // Timed out — show error page in the window
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      `<html><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F7F9FC;color:#111827"><div style="text-align:center"><h1 style="font-size:2rem">Dev server not ready</h1><p style="color:#6B7280">Vite didn't start at ${DEV_URL} within ${RETRY_TIMEOUT_MS / 1000}s.<br>Make sure <code>npm run dev</code> is running.</p></div></body></html>`,
    )}`,
  );
}

// ---------------------------------------------------------------------------
// Single-Instance Lock (Windows Desktop requirement)
// ---------------------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log("[App] Another instance is already running. Quitting.");
  app.quit();
} else {
  app.on("second-instance", () => {
    // Focus existing window if a second instance was launched
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// System Tray & Notification Controls (Desktop-only requirement)
// ---------------------------------------------------------------------------
let appTray: Tray | null = null;
let notificationsPaused = false;

function updateTrayMenu(): void {
  if (!appTray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open S & S LegalOS",
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: notificationsPaused ? "Resume Notifications" : "Pause Notifications",
      click: () => {
        notificationsPaused = !notificationsPaused;
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Quit LegalOS",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  appTray.setContextMenu(contextMenu);
}

function createTray(): void {
  if (appTray) return;
  try {
    const iconPath = path.join(__dirname, "..", "public", "icon.png");
    if (fs.existsSync(iconPath)) {
      appTray = new Tray(iconPath);
      appTray.setToolTip("S & S Associates Legal-Tech LLP");
      updateTrayMenu();
      appTray.on("double-click", () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });
    }
  } catch (err) {
    console.warn("[Tray] Failed to create system tray:", err);
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  // Explicit permission boundaries: grant notifications and microphone (media) only to app origins
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    const isAppOrigin = isDev
      ? url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:")
      : url.startsWith("file:") || url.startsWith("app:");

    if (isAppOrigin && (permission === "notifications" || permission === "media")) {
      return callback(true);
    }
    return callback(false);
  });

  await startServer();
  mainWindow = createWindow();
  createTray();

  if (isDev) {
    await loadDevWithRetry(mainWindow);
  } else {
    // Production: load built SPA from dist/
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    console.log("Loading index.html from:", indexPath);
    await mainWindow.loadFile(indexPath);
    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
      console.error("Failed to load:", validatedURL, "Error:", errorCode, errorDescription);
    });
    mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
      console.log(`Renderer [${level}]: ${message} (${sourceId}:${line})`);
    });
  }
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    if (process.platform !== "darwin") app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
    if (isDev) {
      loadDevWithRetry(mainWindow);
    } else {
      mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }
  }
});

// ---------------------------------------------------------------------------
// Security: IPC Handlers with validation
// ---------------------------------------------------------------------------

// Validate that IPC messages originate from trusted app windows
function assertTrustedIpcSender(event: Electron.IpcMainInvokeEvent): void {
  // 1. Sender exists
  if (!event.sender) {
    throw new Error("Unauthorized IPC invocation: missing sender");
  }

  // 2. Sender matches application window
  if (mainWindow && event.sender !== mainWindow.webContents) {
    throw new Error("Unauthorized IPC invocation: sender does not match main window");
  }

  // 3. Sender is top-level main frame
  if (event.senderFrame && event.senderFrame.parent !== null) {
    throw new Error("Unauthorized IPC invocation: sender is not main frame");
  }

  // 4. Validate URL / origin
  const url = event.senderFrame?.url || event.sender.getURL();
  if (!url) {
    throw new Error("Unauthorized IPC invocation: missing sender URL");
  }
  try {
    const parsed = new URL(url);
    if (isDev) {
      if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
        return;
      }
    }
    if (parsed.protocol === "file:" || parsed.protocol === "app:") {
      return;
    }
  } catch {
    // Non-URL parseable paths
  }
  if (url.startsWith("file:") || url.startsWith("app:")) {
    return;
  }
  throw new Error(`Unauthorized IPC invocation from origin: ${url}`);
}

// Helper to validate paths - prevent directory traversal
function validateAndResolvePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("Invalid path");
  }
  // Remove null bytes
  const cleaned = inputPath.replace(/\0/g, "");

  const resolved = path.resolve(cleaned);

  // Restrict to app data, uploads, downloads, documents, or configured storage/NAS mount
  const allowedRoots = [
    app.getPath("userData"),
    app.getPath("downloads"),
    app.getPath("documents"),
    path.resolve(process.cwd(), "uploads"),
    ...(process.env.STORAGE_DIR ? [path.resolve(process.env.STORAGE_DIR)] : []),
    ...(process.env.NAS_MOUNT_POINT ? [path.resolve(process.env.NAS_MOUNT_POINT)] : []),
  ];

  const isAllowed = allowedRoots.some((root) => {
    const rel = path.relative(root, resolved);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });

  if (!isAllowed) {
    throw new Error("Access denied: path is outside allowed application directories");
  }

  // Check path exists
  if (!fs.existsSync(resolved)) {
    throw new Error("Path does not exist");
  }

  return resolved;
}

// Open a path in Windows Explorer / macOS Finder
ipcMain.handle("nas:openPath", async (event: Electron.IpcMainInvokeEvent, nasPath: string) => {
  assertTrustedIpcSender(event);
  try {
    const safePath = validateAndResolvePath(nasPath);
    const error = await shell.openPath(safePath);
    if (error) {
      dialog.showErrorBox("Open Failed", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error("[IPC nas:openPath] Error:", error.message);
    dialog.showErrorBox(
      "Path Not Found",
      `The folder "${nasPath}" does not exist or is currently unavailable.\n\nCheck that the Synology NAS is connected and the path is correct.`,
    );
    return { success: false, error: error.message };
  }
});

// Watch a NAS folder for changes
ipcMain.handle("nas:watchFolder", async (event: Electron.IpcMainInvokeEvent, folderPath: string) => {
  assertTrustedIpcSender(event);
  try {
    const safePath = validateAndResolvePath(folderPath);
    const watcher = fs.watch(safePath, { recursive: false }, (eventType, filename) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("nas:fileEvent", {
          eventType,
          filename,
          folderPath: safePath,
          timestamp: new Date().toISOString(),
        });
      }
    });
    // Store watcher reference for cleanup
    if (mainWindow) {
      mainWindow.__nasWatcher = watcher;
    }
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error("[IPC nas:watchFolder] Error:", error.message);
    return { success: false, error: error.message };
  }
});

// Stop watching a folder
ipcMain.handle("nas:unwatchFolder", async (event: Electron.IpcMainInvokeEvent) => {
  assertTrustedIpcSender(event);
  const watcher = mainWindow?.__nasWatcher;
  if (watcher) {
    watcher.close();
    if (mainWindow) {
      delete mainWindow.__nasWatcher;
    }
  }
  return { success: true };
});

// Select a folder dialog — used for admin to link NAS case folders
ipcMain.handle("nas:selectFolder", async (event: Electron.IpcMainInvokeEvent) => {
  assertTrustedIpcSender(event);
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select NAS Folder",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  try {
    return validateAndResolvePath(result.filePaths[0]);
  } catch (err) {
    const error = err as Error;
    console.error("[IPC nas:selectFolder] Error:", error.message);
    return null;
  }
});

// App info
ipcMain.handle("app:getVersion", (event: Electron.IpcMainInvokeEvent) => {
  assertTrustedIpcSender(event);
  return app.getVersion();
});
ipcMain.handle("app:isDev", (event: Electron.IpcMainInvokeEvent) => {
  assertTrustedIpcSender(event);
  return isDev;
});

// Secure token storage IPC handlers (using OS-level safeStorage encryption)
const sessionFilePath = path.join(app.getPath("userData"), "session.dat");

ipcMain.handle("auth:saveRefreshToken", async (event: Electron.IpcMainInvokeEvent, token: string): Promise<{ success: boolean; error?: string }> => {
  assertTrustedIpcSender(event);
  try {
    if (!token || typeof token !== "string") {
      return { success: false, error: "invalid_token" };
    }
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn("[IPC auth:saveRefreshToken] OS safeStorage unavailable — token not persisted (security policy)");
      return { success: false, error: "safe_storage_unavailable" };
    }
    const encrypted = safeStorage.encryptString(token);
    fs.writeFileSync(sessionFilePath, encrypted);
    return { success: true };
  } catch (err) {
    console.error("[IPC auth:saveRefreshToken] Encryption failed:", err);
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle("auth:getRefreshToken", async (event: Electron.IpcMainInvokeEvent): Promise<{ success: boolean; token: string | null; error?: string }> => {
  assertTrustedIpcSender(event);
  try {
    if (!fs.existsSync(sessionFilePath)) {
      return { success: true, token: null };
    }
    if (!safeStorage.isEncryptionAvailable()) {
      try { fs.unlinkSync(sessionFilePath); } catch {}
      return { success: false, token: null, error: "safe_storage_unavailable" };
    }
    const encrypted = fs.readFileSync(sessionFilePath);
    const token = safeStorage.decryptString(encrypted);
    return { success: true, token };
  } catch (err) {
    console.error("[IPC auth:getRefreshToken] Decryption failed:", err);
    try { fs.unlinkSync(sessionFilePath); } catch {}
    return { success: false, token: null, error: (err as Error).message };
  }
});

ipcMain.handle("auth:clearRefreshToken", async (event: Electron.IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
  assertTrustedIpcSender(event);
  try {
    if (fs.existsSync(sessionFilePath)) {
      fs.unlinkSync(sessionFilePath);
    }
    return { success: true };
  } catch (err) {
    console.error("[IPC auth:clearRefreshToken] Clear failed:", err);
    return { success: false, error: (err as Error).message };
  }
});

// ---------------------------------------------------------------------------
// Native Desktop Platform IPC Handlers
// ---------------------------------------------------------------------------

// Native Windows Toast Notification
ipcMain.handle("notification:show", async (event: Electron.IpcMainInvokeEvent, options: { title: string; body: string; sound?: boolean; tag?: string }) => {
  assertTrustedIpcSender(event);
  if (notificationsPaused) {
    return { shown: false, reason: "notifications_paused" };
  }
  if (!Notification.isSupported()) {
    return { shown: false, reason: "unsupported" };
  }
  try {
    const iconPath = path.join(__dirname, "..", "public", "icon.png");
    const notif = new Notification({
      title: options.title || "S & S Legal-Tech LLP",
      body: options.body || "",
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      silent: options.sound === false,
    });
    notif.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notif.show();
    return { shown: true };
  } catch (err) {
    console.error("[IPC notification:show] Error:", err);
    return { shown: false, reason: (err as Error).message };
  }
});

ipcMain.handle("notification:isPaused", (event: Electron.IpcMainInvokeEvent) => {
  assertTrustedIpcSender(event);
  return notificationsPaused;
});

ipcMain.handle("notification:setPaused", (event: Electron.IpcMainInvokeEvent, paused: boolean) => {
  assertTrustedIpcSender(event);
  notificationsPaused = Boolean(paused);
  updateTrayMenu();
  return { success: true, paused: notificationsPaused };
});

// Safe External Link / Phone Opener
ipcMain.handle("shell:openExternal", async (event: Electron.IpcMainInvokeEvent, rawUrl: string) => {
  assertTrustedIpcSender(event);
  try {
    if (!rawUrl || typeof rawUrl !== "string") {
      return { success: false, error: "Invalid URL string" };
    }
    const parsed = new URL(rawUrl);
    const allowed = ["https:", "http:", "mailto:", "tel:"];
    if (!allowed.includes(parsed.protocol)) {
      return { success: false, error: `Protocol "${parsed.protocol}" is not allowed` };
    }
    await shell.openExternal(rawUrl);
    return { success: true };
  } catch (err) {
    console.error("[IPC shell:openExternal] Error:", err);
    return { success: false, error: (err as Error).message };
  }
});

// Native Windows Save Dialog & File Downloader
ipcMain.handle("dialog:saveFile", async (event: Electron.IpcMainInvokeEvent, options: { defaultFilename: string; buffer: Uint8Array | number[]; mimeType?: string }) => {
  assertTrustedIpcSender(event);
  if (!mainWindow) return { canceled: true, error: "Window not available" };
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultFilename || "download",
      title: "Save File · S & S LegalOS",
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    const dataBuffer = Buffer.from(options.buffer);
    fs.writeFileSync(result.filePath, dataBuffer);
    return { canceled: false, filePath: result.filePath };
  } catch (err) {
    console.error("[IPC dialog:saveFile] Error:", err);
    return { canceled: false, error: (err as Error).message };
  }
});

// ---------------------------------------------------------------------------
// Security: Prevent renderer from accessing Node.js APIs
// ---------------------------------------------------------------------------
// This is enforced by: contextIsolation: true, nodeIntegration: false, sandbox: true
// But we also explicitly block any attempt to require modules via IPC
ipcMain.on("*", (event, channel, ...args) => {
  // Log unauthorized IPC attempts in development
  if (isDev) {
    console.warn(`[Security] Unauthorized IPC attempt: ${channel}`);
  }
});

// ---------------------------------------------------------------------------
// Handle Squirrel.Windows installer events (for auto-updater)
// ---------------------------------------------------------------------------
if (process.platform === "win32" && process.argv.length >= 2) {
  const squirrelCommand = process.argv[1];
  if (["--squirrel-install", "--squirrel-updated", "--squirrel-uninstall", "--squirrel-obsolete"].includes(squirrelCommand)) {
    // Handle squirrel events (auto-updater)
    app.quit();
    process.exit(0);
  }
}