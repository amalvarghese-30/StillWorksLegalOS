// ---------------------------------------------------------------------------
// StillWorks LegalOS — Centralized Date & Time Utility
// ---------------------------------------------------------------------------
// Guarantees consistent date parsing, formatting, and ISO conversion across
// Web and Windows Desktop EXE without ever rendering "Invalid Date".
// ---------------------------------------------------------------------------

/**
 * Parses any flexible date format into a valid Date object or null:
 * - Date instances
 * - Numeric timestamps
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 * - YYYY-MM-DD, YYYY/MM/DD
 * - ISO-8601 strings (e.g. 2026-11-16T10:00:00.000Z)
 * Defaults time to 10:00 AM local time if only date portion is provided,
 * preventing timezone shifts across dates.
 */
export function parseFlexibleDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s) return null;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 10;
    const minutes = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] !== undefined ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] !== undefined ? parseInt(ymdMatch[4], 10) : 10;
    const minutes = ymdMatch[5] !== undefined ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] !== undefined ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  }

  const standard = new Date(s);
  return isNaN(standard.getTime()) ? null : standard;
}

/**
 * Validates whether a value is a non-null, valid date or ISO string.
 */
export function isValidDate(val: unknown): boolean {
  return parseFlexibleDate(val) !== null;
}

/**
 * Safely converts an input into a valid ISO string. Returns null if invalid.
 */
export function toSafeIso(val: unknown): string | null {
  const d = parseFlexibleDate(val);
  return d ? d.toISOString() : null;
}

/**
 * Safely formats a date into Indian standard legal display format (e.g. "15 Oct 2026").
 * Never displays "Invalid Date".
 */
export function formatSafeDate(
  val: unknown,
  fallback = "—",
  options?: Intl.DateTimeFormatOptions
): string {
  if (!val) return fallback;
  const d = parseFlexibleDate(val);
  if (!d) return fallback;

  return d.toLocaleDateString(
    "en-IN",
    options ?? { day: "numeric", month: "short", year: "numeric" }
  );
}

/**
 * Safely formats a date with time (e.g. "15 Oct 2026, 02:30 PM").
 */
export function formatSafeDateTime(val: unknown, fallback = "—"): string {
  if (!val) return fallback;
  const d = parseFlexibleDate(val);
  if (!d) return fallback;

  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Safely formats a relative time label (e.g. "Just now", "2h ago", "3d ago").
 */
export function formatSafeRelative(val: unknown, fallback = "—"): string {
  if (!val) return fallback;
  const d = parseFlexibleDate(val);
  if (!d) return fallback;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const formatReadableDate = formatSafeDate;
