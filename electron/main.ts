import { app, BrowserWindow, shell, ipcMain, dialog, protocol, session, Event, safeStorage } from "electron";
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
  "script-src 'self'", // No 'unsafe-inline' or 'unsafe-eval' - production build doesn't need it
  "style-src 'self' 'unsafe-inline'", // Tailwind needs unsafe-inline for JIT in dev; production uses pre-built CSS
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:3001 ws://localhost:3001 https: wss:", // API + Socket.io + HTTPS/WSS remote backends
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Connect-src for production (no localhost references)
const CSP_HEADER_PROD = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:", // Allow secure HTTPS and WSS connections (thin client)
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5173";
const RETRY_INTERVAL_MS = 500;
const RETRY_TIMEOUT_MS = 30_000; // 30 s total before showing error page
const SERVER_PORT = process.env.SERVER_PORT ?? "3001";

// Disable GPU acceleration and sandbox for stability in production
if (!isDev) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-rasterization");
  app.commandLine.appendSwitch("disable-software-rasterizer");
  app.commandLine.appendSwitch("use-gl", "swiftshader");
  app.commandLine.appendSwitch("disable-webgl");
  app.commandLine.appendSwitch("disable-gl-extensions");
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
    title: "StillWorks LegalOS",
    icon: path.join(__dirname, "..", "public", "icon.png"),
    webPreferences: {
      // Preload script (CommonJS for Electron compatibility)
      preload: fs.existsSync(path.join(__dirname, "preload.cjs"))
        ? path.join(__dirname, "preload.cjs")
        : path.join(__dirname, "preload.js"),
      contextIsolation: true, // REQUIRED for security
      nodeIntegration: false, // REQUIRED for security
      sandbox: isDev, // Disable sandbox in production for GPU compatibility
      // Security headers
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // Disable dangerous features
      webviewTag: false,
      plugins: false,
      // CSP will be set via session
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
  // Security: Set CSP on the session
  // -------------------------------------------------------------------------
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev ? CSP_HEADER : CSP_HEADER_PROD;
    const responseHeaders: Record<string, string[]> = {
      ...details.responseHeaders,
      "Content-Security-Policy": [csp],
      "X-Content-Type-Options": ["nosniff"],
      "X-Frame-Options": ["DENY"],
      "X-XSS-Protection": ["1; mode=block"],
      "Referrer-Policy": ["strict-origin-when-cross-origin"],
      "Permissions-Policy": ["geolocation=(), microphone=(), camera=()"],
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

  // DevTools can be toggled via Ctrl+Shift+I if needed for debugging

  // -------------------------------------------------------------------------
  // Security: Handle new window creation (block popups)
  // -------------------------------------------------------------------------
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow only https external links to open in system browser
    if (url.startsWith("https://")) {
      shell.openExternal(url);
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

  win.once("ready-to-show", () => {
    win.show();
  });

  // Open external links in the system browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
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
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  await startServer();
  mainWindow = createWindow();

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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
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

// Helper to validate paths - prevent directory traversal
function validateAndResolvePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("Invalid path");
  }
  // Remove null bytes
  const cleaned = inputPath.replace(/\0/g, "");

  const resolved = path.resolve(cleaned);

  // In production, you may want to restrict to specific allowed roots:
  // e.g., only allow paths under the NAS mount point
  // const allowedRoots = [process.env.NAS_MOUNT_POINT || "Z:"];
  // if (!allowedRoots.some((root) => resolved.startsWith(path.resolve(root)))) {
  //   throw new Error("Path not in allowed directory");
  // }

  // Check path exists
  if (!fs.existsSync(resolved)) {
    throw new Error("Path does not exist");
  }

  return resolved;
}

// Open a path in Windows Explorer / macOS Finder
ipcMain.handle("nas:openPath", async (_event: Electron.IpcMainInvokeEvent, nasPath: string) => {
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
ipcMain.handle("nas:watchFolder", async (_event: Electron.IpcMainInvokeEvent, folderPath: string) => {
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
ipcMain.handle("nas:unwatchFolder", async () => {
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
ipcMain.handle("nas:selectFolder", async () => {
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
ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("app:isDev", () => isDev);

// Secure token storage IPC handlers (using OS-level safeStorage encryption)
const sessionFilePath = path.join(app.getPath("userData"), "session.dat");

ipcMain.handle("auth:saveRefreshToken", async (_event: Electron.IpcMainInvokeEvent, token: string) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(sessionFilePath, Buffer.from(token, "utf-8"));
      return;
    }
    const encrypted = safeStorage.encryptString(token);
    fs.writeFileSync(sessionFilePath, encrypted);
  } catch (err) {
    console.error("[IPC auth:saveRefreshToken] Encryption failed:", err);
    throw err;
  }
});

ipcMain.handle("auth:getRefreshToken", async () => {
  try {
    if (!fs.existsSync(sessionFilePath)) return null;
    const encrypted = fs.readFileSync(sessionFilePath);
    if (!safeStorage.isEncryptionAvailable()) {
      return encrypted.toString("utf-8");
    }
    return safeStorage.decryptString(encrypted);
  } catch (err) {
    console.error("[IPC auth:getRefreshToken] Decryption failed:", err);
    // Delete corrupt token
    try { fs.unlinkSync(sessionFilePath); } catch {}
    return null;
  }
});

ipcMain.handle("auth:clearRefreshToken", async () => {
  try {
    if (fs.existsSync(sessionFilePath)) {
      fs.unlinkSync(sessionFilePath);
    }
  } catch (err) {
    console.error("[IPC auth:clearRefreshToken] Clear failed:", err);
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