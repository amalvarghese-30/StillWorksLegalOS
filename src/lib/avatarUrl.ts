// ---------------------------------------------------------------------------
// StillWorks LegalOS — Centralized Avatar URL Resolver
// ---------------------------------------------------------------------------
// Resolves avatar references (modern server-relative paths, legacy filenames,
// and legacy storage paths) into valid absolute URLs. Guarantees avatars load
// in both web browsers and packaged Windows Electron (file:// scheme) without
// triggering ERR_FILE_NOT_FOUND.
// ---------------------------------------------------------------------------

import { getApiBase } from "@/services/api";

/**
 * Valid avatar filename format accepted by server storage:
 * - Must begin with "avatar_"
 * - Safe alphanumeric, underscore, and hyphen characters
 * - Valid image extension (.jpg, .jpeg, .png, .webp)
 */
export const VALID_AVATAR_FILENAME_REGEX = /^avatar_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i;

/**
 * Normalizes an API base URL into a clean base URL without trailing slashes.
 * Ensures the returned endpoint always targets the API without duplicating "/api".
 */
export function getNormalizedApiPrefix(customApiBase?: string): string {
  let base = customApiBase;
  if (!base) {
    try {
      base = getApiBase();
    } catch {
      base = "https://api-legalos.stillworks.in/api";
    }
  }
  base = (base || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  // If base already ends with /api, use it directly; otherwise append /api
  return base.endsWith("/api") ? base : `${base}/api`;
}

/**
 * Resolves any avatar reference into a safe, absolute image URL.
 *
 * @param avatarRef The avatar path, URL, or filename from user/employee data.
 * @param customApiBase Optional override for API base URL (useful for unit tests and environment switches).
 * @returns An absolute URL or data/blob URL, or an empty string if invalid or missing.
 */
export function resolveAvatarUrl(
  avatarRef?: string | null,
  customApiBase?: string
): string {
  if (!avatarRef || typeof avatarRef !== "string") {
    return "";
  }

  const trimmed = avatarRef.trim();
  if (!trimmed) {
    return "";
  }

  // Case D: Valid absolute HTTP/HTTPS, data:, or blob: URLs are preserved as-is
  if (/^(https?:|data:image\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  // Security check: Reject file:// schemes, directory traversal attempts, and Windows backslashes
  if (
    trimmed.toLowerCase().startsWith("file:") ||
    trimmed.includes("..") ||
    trimmed.includes("\\")
  ) {
    return "";
  }

  // Separate any query parameters (e.g. cache-busters ?v=12345) from the clean path
  const [cleanPath, query] = trimmed.split("?");
  if (!cleanPath) {
    return "";
  }

  // Normalize path segments by stripping leading slashes
  let pathWithoutLeadingSlash = cleanPath.replace(/^\/+/, "");

  // Case A: Path starting with /api/auth/avatar/ or api/auth/avatar/ or /auth/avatar/
  if (pathWithoutLeadingSlash.toLowerCase().startsWith("api/auth/avatar/")) {
    pathWithoutLeadingSlash = pathWithoutLeadingSlash.slice("api/auth/avatar/".length);
  } else if (pathWithoutLeadingSlash.toLowerCase().startsWith("auth/avatar/")) {
    pathWithoutLeadingSlash = pathWithoutLeadingSlash.slice("auth/avatar/".length);
  }
  // Case C: Recognized legacy storage path: Avatars/ or avatars/
  else if (pathWithoutLeadingSlash.toLowerCase().startsWith("avatars/")) {
    pathWithoutLeadingSlash = pathWithoutLeadingSlash.slice("avatars/".length);
  }

  // At this stage, pathWithoutLeadingSlash must be a single filename (no remaining slashes)
  if (pathWithoutLeadingSlash.includes("/") || !pathWithoutLeadingSlash) {
    return "";
  }

  // Case B / Validation: Must match the server's accepted avatar filename pattern
  if (!VALID_AVATAR_FILENAME_REGEX.test(pathWithoutLeadingSlash)) {
    return "";
  }

  const apiPrefix = getNormalizedApiPrefix(customApiBase);
  if (!apiPrefix) {
    return "";
  }

  const encodedFilename = encodeURIComponent(pathWithoutLeadingSlash);
  const queryString = query ? `?${query}` : "";

  // Target endpoint is always ${apiPrefix}/auth/avatar/${encodedFilename}
  // Example: https://api-legalos.stillworks.in/api/auth/avatar/avatar_ABC_123.jpg
  // Ensures /api/api/ is never generated regardless of whether apiBase ends in /api
  return `${apiPrefix}/auth/avatar/${encodedFilename}${queryString}`;
}
