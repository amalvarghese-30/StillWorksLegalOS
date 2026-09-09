// ---------------------------------------------------------------------------
// Base API client for StillWorks LegalOS
// ---------------------------------------------------------------------------
// The access token is held in memory only (never persisted) so it cannot be
// exfiltrated via a localStorage XSS. On a fresh page load it is restored by
// calling /auth/refresh, which reads the refresh token from the httpOnly cookie
// (web) or from the OS-level safeStorage vault (Electron desktop).
// ---------------------------------------------------------------------------

function getApiBase(): string {
  if (import.meta.env["VITE_API_URL"]) {
    return import.meta.env["VITE_API_URL"];
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Electron desktop app: connect to the hosted production API
    if (window.STILLWORKS_ENV?.isElectron) {
      return "https://legalos.stillworks.in/api";
    }
    // Local dev
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001/api";
    }
    // Local LAN IP (testing on same WiFi)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      return `${window.location.protocol}//${host}:3001/api`;
    }
    // Production domain (e.g. legalos.stillworks.in) behind Nginx reverse proxy
    return `${window.location.origin}/api`;
  }
  return "https://legalos.stillworks.in/api";
}

const API_BASE = getApiBase();

// ---------------------------------------------------------------------------
// Client-type detection
// ---------------------------------------------------------------------------

function isElectron(): boolean {
  return typeof window !== "undefined" && window.STILLWORKS_ENV?.isElectron === true;
}

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

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Persist tokens after login/refresh.
// - access token: in-memory only.
// - refresh token: Electron → safeStorage vault; web → httpOnly cookie (managed
//   entirely by the server, never handled here).
export async function persistTokens(
  newAccessToken: string,
  newRefreshToken?: string
): Promise<void> {
  accessToken = newAccessToken;
  if (isElectron() && newRefreshToken) {
    await electronApi()?.saveRefreshToken(newRefreshToken);
  }
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  if (isElectron()) {
    await electronApi()?.clearRefreshToken();
  }
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// ---------------------------------------------------------------------------
// Refresh access token
// ---------------------------------------------------------------------------

export async function refreshAccessToken(): Promise<string | null> {
  // Prevent multiple simultaneous refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      if (isElectron()) {
        const result = await electronApi()?.getRefreshToken();
        const refreshToken = result?.token ?? null;
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

      // Web: refresh token lives in an httpOnly cookie — sent automatically.
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
      accessToken = data.accessToken;
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
    super(`API ${status}: ${typeof body === "object" ? JSON.stringify(body) : body}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
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

  // If 401 Unauthorized, try to refresh token once
  if (res.status === 401 && retryCount === 0) {
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
