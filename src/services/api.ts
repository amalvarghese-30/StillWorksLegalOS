// ---------------------------------------------------------------------------
// Base API client for StillWorks LegalOS
// ---------------------------------------------------------------------------
// The access token is held in memory only (never persisted) so it cannot be
// exfiltrated via a localStorage XSS. On a fresh page load it is restored by
// calling /auth/refresh, which reads the refresh token from the httpOnly cookie
// (web) or from the OS-level safeStorage vault (Electron desktop).
// ---------------------------------------------------------------------------

import { isElectron } from "@/platform";
export { isElectron };

function sanitizeApiUrl(url: string): string {
  return url.replace("api.legalos.stillworks.in", "api-legalos.stillworks.in");
}

export function getApiBase(): string {
  // 1. Explicit environment variable takes precedence (development or production)
  const envUrl = import.meta.env["VITE_API_URL"];
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    const sanitized = sanitizeApiUrl(envUrl.trim().replace(/\/+$/, ""));
    return sanitized.endsWith("/api") ? sanitized : `${sanitized}/api`;
  }

  // 2. Web browser: if accessed via production domain legalos.stillworks.in or any stillworks.in subdomain
  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    if (hostname === "legalos.stillworks.in" || hostname.endsWith(".stillworks.in")) {
      return "https://api-legalos.stillworks.in/api";
    }

    // Localhost or custom LAN dev: use current origin + /api (Vite dev server proxies /api to backend)
    if (window.location.origin && window.location.origin.startsWith("http")) {
      return `${window.location.origin}/api`;
    }
  }

  // 3. Electron desktop application: default to production cloud API
  if (isElectron()) {
    return "https://api-legalos.stillworks.in/api";
  }

  // 4. Fallback for local desktop development (default to localhost:3001)
  const defaultPort = import.meta.env["VITE_BACKEND_PORT"] || "3001";
  return `http://localhost:${defaultPort}/api`;
}

export const API_URL = sanitizeApiUrl(import.meta.env["VITE_API_URL"] || getApiBase());
export const API_BASE = getApiBase();

function electronApi() {
  return typeof window !== "undefined" ? (window.electronAPI ?? null) : null;
}

export function clientTypeHeaders(): Record<string, string> {
  return isElectron() ? { "x-client-type": "electron" } : {};
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

// Access token is in-memory only.
let accessToken: string | null = null;
let sessionRefreshToken: string | null = null; // In-memory runtime refresh token for Electron when rememberMe=false

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

const REMEMBER_ME_KEY = "stillworks.remember_me";

// Persist tokens after login/refresh.
// - access token: in-memory only.
// - refresh token:
//     * Electron desktop: persisted in OS safeStorage vault via IPC.
//     * Modern Web: handled exclusively via HttpOnly Secure SameSite cookie; never exposed to JS.
export async function persistTokens(
  newAccessToken: string,
  newRefreshToken?: string,
  rememberMe?: boolean
): Promise<void> {
  accessToken = newAccessToken;

  if (isElectron()) {
    if (newRefreshToken) {
      sessionRefreshToken = newRefreshToken;
    }

    if (rememberMe !== undefined) {
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_ME_KEY, "true");
      } else {
        window.localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }

    const shouldPersist = rememberMe ?? (window.localStorage.getItem(REMEMBER_ME_KEY) === "true");

    if (newRefreshToken) {
      if (shouldPersist) {
        await electronApi()?.saveRefreshToken(newRefreshToken);
      } else {
        // Must not survive app restart — clear from safeStorage
        await electronApi()?.clearRefreshToken();
      }
    }
  } else if (typeof window !== "undefined") {
    // Web: update rememberMe preference hint (tokens are NEVER saved in localStorage/sessionStorage)
    if (rememberMe !== undefined) {
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_ME_KEY, "true");
      } else {
        window.localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }
  }

  // Cross-tab synchronization via BroadcastChannel (NEVER transmits refresh credentials)
  try {
    authBroadcastChannel?.postMessage({
      type: "TOKEN_REFRESHED",
      accessToken: newAccessToken,
    });
  } catch {
    /* ignore channel errors */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("stillworks:token-refreshed", {
        detail: { token: newAccessToken },
      })
    );
  }
}

// Multi-tab session coordination channel (safe: access token synchronization and logout only)
const authBroadcastChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("stillworks_auth_sync")
    : null;

if (authBroadcastChannel) {
  authBroadcastChannel.onmessage = (event) => {
    if (event.data?.type === "TOKEN_REFRESHED" && event.data.accessToken) {
      accessToken = event.data.accessToken;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("stillworks:token-refreshed", {
            detail: { token: accessToken },
          })
        );
      }
    } else if (event.data?.type === "LOGOUT") {
      accessToken = null;
      sessionRefreshToken = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("stillworks:logged-out"));
      }
    }
  };
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  sessionRefreshToken = null;
  if (isElectron()) {
    await electronApi()?.clearRefreshToken();
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(REMEMBER_ME_KEY);
      // Clean up any historical keys from older releases
      window.localStorage.removeItem("stillworks.refresh_token");
      window.sessionStorage.removeItem("stillworks.refresh_token");
      window.localStorage.removeItem("stillworks_session");
      window.sessionStorage.removeItem("stillworks_session");
    } catch {
      /* ignore */
    }
  }

  try {
    authBroadcastChannel?.postMessage({ type: "LOGOUT" });
  } catch {
    /* ignore */
  }
}

/**
 * Direct authenticated server logout with network timeout.
 * Does not use apiFetch to avoid triggering refresh token recursion.
 */
export async function performServerLogout(tokenToRevoke?: string | null): Promise<void> {
  const token = tokenToRevoke || accessToken;
  if (!token) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...clientTypeHeaders(),
    };
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers,
      credentials: isElectron() ? "omit" : "include",
      signal: controller.signal,
    });
  } catch {
    /* Ignore network/timeout errors — local cleanup is authoritative */
  } finally {
    clearTimeout(timeoutId);
  }
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// ---------------------------------------------------------------------------
// Refresh access token
// ---------------------------------------------------------------------------

export async function refreshAccessToken(): Promise<string | null> {
  // If in web browser and no session hint exists, don't attempt network refresh
  const hasSessionHint =
    isElectron() ||
    (typeof window !== "undefined" &&
      (Boolean(window.localStorage.getItem("stillworks.session")) ||
       Boolean(window.sessionStorage.getItem("stillworks.session")) ||
       Boolean(window.localStorage.getItem(REMEMBER_ME_KEY))));

  if (!hasSessionHint) {
    return null;
  }

  // Prevent multiple simultaneous refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      if (isElectron()) {
        let refreshToken = sessionRefreshToken;
        if (!refreshToken) {
          const result = await electronApi()?.getRefreshToken();
          refreshToken = result?.token ?? null;
        }
        if (!refreshToken) return null;

        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "electron",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          await clearTokens();
          return null;
        }

        const data = await res.json();
        await persistTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      }

      // Web: authenticate strictly via HttpOnly cookie; no refresh credentials sent in body
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        await clearTokens();
        return null;
      }

      const data = await res.json();
      await persistTokens(data.accessToken);
      return data.accessToken;
    } catch {
      await clearTokens();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Typed fetch wrapper with automatic token refresh
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    let msg = "";
    if (body && typeof body === "object" && "message" in (body as Record<string, unknown>)) {
      msg = String((body as Record<string, unknown>)["message"]);
    } else if (typeof body === "string" && body.trim()) {
      msg = body.trim();
    }
    if (!msg) {
      if (status === 401) msg = "Your session has expired. Please sign in again.";
      else if (status === 403) msg = "You don't have permission to perform this action.";
      else if (status === 404) msg = "The requested record was not found.";
      else if (status === 409) msg = "This record was updated by someone else. Please refresh.";
      else if (status === 429) msg = "Too many requests. Please wait a moment.";
      else if (status >= 500) msg = "A server error occurred. Please try again shortly.";
      else msg = `Request failed (${status})`;
    }
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get userFriendlyMessage(): string {
    if (this.isUnauthorized) return "Your session has expired. Please sign in again.";
    if (this.isForbidden) return "You don't have permission to perform this action.";
    if (this.isNotFound) return "The requested record was not found.";
    if (this.isConflict) return "This record was updated by someone else. Please refresh.";
    if (this.isRateLimited) return "Too many requests. Please wait a moment.";
    if (this.isServerError) return "A server error occurred. Please try again shortly.";
    if (this.body && typeof this.body === "object" && "message" in (this.body as Record<string, unknown>)) {
      return String((this.body as Record<string, unknown>)["message"]);
    }
    return "An unexpected error occurred. Please try again.";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    ...options,
    headers,
  };
  // Web clients need cookies (httpOnly refresh token); Electron uses body
  // tokens + Bearer header, so it omits credentials to avoid opaque-origin CORS.
  if (!isElectron()) {
    init.credentials = "include";
  }

  const res = await fetch(`${API_BASE}${path}`, init);

  // If 401 Unauthorized on a protected resource, try to refresh token once
  if (res.status === 401 && retryCount === 0 && !path.startsWith("/auth/")) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry with new token
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
      });
      if (retryRes.ok) {
        if (retryRes.status === 204) return undefined as T;
        return retryRes.json() as Promise<T>;
      }
    }
    // Refresh failed or retry failed — throw original error
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(res.status, body);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),

  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, body ? {
      method: "POST",
      body: JSON.stringify(body),
    } : { method: "POST" }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, body ? {
      method: "PATCH",
      body: JSON.stringify(body),
    } : { method: "PATCH" }),

  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, body ? {
      method: "PUT",
      body: JSON.stringify(body),
    } : { method: "PUT" }),

  delete: <T = unknown>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Streaming upload / download (multipart + binary — never JSON)
// ---------------------------------------------------------------------------

export interface UploadStreamOptions {
  path: string;
  formData: FormData;
  onProgress?: (percent: number) => void;
}

/**
 * Multipart upload via XHR so byte-level progress can be reported. Mirrors
 * `apiFetch`'s auth/credentials handling but sends the body untouched.
 */
export function uploadStream<T = unknown>({ path, formData, onProgress }: UploadStreamOptions): Promise<T> {
  const token = getAccessToken();

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);

    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (!isElectron()) xhr.withCredentials = true;

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let body: unknown;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
        } catch {
          body = undefined;
        }
        resolve(body as T);
      } else {
        let body: unknown;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = xhr.responseText;
        }
        reject(new ApiError(xhr.status, body));
      }
    });

    xhr.addEventListener("error", () => reject(new ApiError(0, { message: "Network error during upload" })));
    xhr.addEventListener("abort", () => reject(new ApiError(0, { message: "Upload aborted" })));

    xhr.send(formData);
  });
}

export interface DownloadBlobResult {
  blob: Blob;
  fileName: string;
}

/**
 * Downloads a binary resource as a Blob, extracting the filename from the
 * Content-Disposition header.
 */
export async function downloadBlob(path: string): Promise<DownloadBlobResult> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = { headers };
  if (!isElectron()) init.credentials = "include";

  const res = await fetch(`${API_BASE}${path}`, init);

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(res.status, body);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const plain = /filename="([^"]+)"/.exec(disposition);
  const fileName = utf8
    ? decodeURIComponent(utf8[1] ?? "download")
    : plain?.[1] ?? "download";

  return { blob, fileName };
}
