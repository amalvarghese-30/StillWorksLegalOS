// ---------------------------------------------------------------------------
// StillWorks LegalOS — Platform Abstraction Layer
// ---------------------------------------------------------------------------
// Provides a unified, clean abstraction for platform-dependent capabilities:
// notifications, file downloads, external link navigation, microphone access,
// and app lifecycle, supporting both Modern Web Browsers and Windows Desktop EXE.
// ---------------------------------------------------------------------------

export function isElectron(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.STILLWORKS_ENV?.isElectron === true ||
    window.location.protocol === "file:" ||
    window.location.protocol === "app:" ||
    (typeof navigator !== "undefined" && navigator.userAgent.includes("Electron"))
  );
}

export function isWindows(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.STILLWORKS_ENV?.platform === "win32" ||
    (typeof navigator !== "undefined" && /Windows|Win32|Win64/i.test(navigator.userAgent))
  );
}

export function isMac(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.STILLWORKS_ENV?.platform === "darwin" ||
    (typeof navigator !== "undefined" && /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent))
  );
}

export const platform = {
  get isElectron() {
    return isElectron();
  },
  get isWeb() {
    return !isElectron();
  },
  get isWindows() {
    return isWindows();
  },
  get isMac() {
    return isMac();
  },
  name: isElectron() ? "desktop-electron" : "web-browser",
};

export * from "./notifications";
export * from "./downloads";
export * from "./externalLinks";
export * from "./storage";
export * from "./microphone";
export * from "./appLifecycle";
export * from "./localPath";
