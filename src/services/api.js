// ---------------------------------------------------------------------------
// Base API client for StillWorks LegalOS
// ---------------------------------------------------------------------------
// The access token is held in memory only (never persisted) so it cannot be
// exfiltrated via a localStorage XSS. On a fresh page load it is restored by
// calling /auth/refresh, which reads the refresh token from the httpOnly cookie
// (web) or from the OS-level safeStorage vault (Electron desktop).
// ---------------------------------------------------------------------------
const API_BASE = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001/api";
// ---------------------------------------------------------------------------
// Client-type detection
// ---------------------------------------------------------------------------
function isElectron() {
    return typeof window !== "undefined" && window.STILLWORKS_ENV?.isElectron === true;
}
function electronApi() {
    return typeof window !== "undefined" ? (window.electronAPI ?? null) : null;
}
export function clientTypeHeaders() {
    return isElectron() ? { "x-client-type": "electron" } : {};
}
// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------
// Access token is in-memory only.
let accessToken = null;
export function getAccessToken() {
    return accessToken;
}
export function setAccessToken(token) {
    accessToken = token;
}
// Persist tokens after login/refresh.
// - access token: in-memory only.
// - refresh token: Electron → safeStorage vault; web → httpOnly cookie (managed
//   entirely by the server, never handled here).
export async function persistTokens(newAccessToken, newRefreshToken) {
    accessToken = newAccessToken;
    if (isElectron() && newRefreshToken) {
        await electronApi()?.saveRefreshToken(newRefreshToken);
    }
}
export async function clearTokens() {
    accessToken = null;
    if (isElectron()) {
        await electronApi()?.clearRefreshToken();
    }
}
let isRefreshing = false;
let refreshPromise = null;
// ---------------------------------------------------------------------------
// Refresh access token
// ---------------------------------------------------------------------------
export async function refreshAccessToken() {
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
                if (!refreshToken)
                    return null;
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
        }
        catch {
            await clearTokens();
            return null;
        }
        finally {
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
    status;
    body;
    constructor(status, body) {
        super(`API ${status}: ${typeof body === "object" ? JSON.stringify(body) : body}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}
export async function apiFetch(path, options = {}, retryCount = 0) {
    const token = getAccessToken();
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const init = {
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
                if (retryRes.status === 204)
                    return undefined;
                return retryRes.json();
            }
        }
        // Refresh failed or retry failed — throw original error
    }
    if (!res.ok) {
        let body;
        try {
            body = await res.json();
        }
        catch {
            body = await res.text();
        }
        throw new ApiError(res.status, body);
    }
    // Handle 204 No Content
    if (res.status === 204)
        return undefined;
    return res.json();
}
// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------
export const api = {
    get: (path) => apiFetch(path),
    post: (path, body) => apiFetch(path, body ? {
        method: "POST",
        body: JSON.stringify(body),
    } : { method: "POST" }),
    patch: (path, body) => apiFetch(path, body ? {
        method: "PATCH",
        body: JSON.stringify(body),
    } : { method: "PATCH" }),
    put: (path, body) => apiFetch(path, body ? {
        method: "PUT",
        body: JSON.stringify(body),
    } : { method: "PUT" }),
    delete: (path) => apiFetch(path, { method: "DELETE" }),
};
/**
 * Multipart upload via XHR so byte-level progress can be reported. Mirrors
 * `apiFetch`'s auth/credentials handling but sends the body untouched.
 */
export function uploadStream({ path, formData, onProgress }) {
    const token = getAccessToken();
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}${path}`);
        if (token)
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        if (!isElectron())
            xhr.withCredentials = true;
        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        });
        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                let body;
                try {
                    body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
                }
                catch {
                    body = undefined;
                }
                resolve(body);
            }
            else {
                let body;
                try {
                    body = JSON.parse(xhr.responseText);
                }
                catch {
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
/**
 * Downloads a binary resource as a Blob, extracting the filename from the
 * Content-Disposition header.
 */
export async function downloadBlob(path) {
    const token = getAccessToken();
    const headers = {};
    if (token)
        headers["Authorization"] = `Bearer ${token}`;
    const init = { headers };
    if (!isElectron())
        init.credentials = "include";
    const res = await fetch(`${API_BASE}${path}`, init);
    if (!res.ok) {
        let body;
        try {
            body = await res.json();
        }
        catch {
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
