// ---------------------------------------------------------------------------
// StillWorks LegalOS — Centralized Date & Time Utility
// ---------------------------------------------------------------------------
// Guarantees consistent date parsing, formatting, and ISO conversion across
// Web and Windows Desktop EXE without ever rendering "Invalid Date".
// ---------------------------------------------------------------------------

/**
 * Validates whether a value is a non-null, valid date or ISO string.
 */
export function isValidDate(val: unknown): boolean {
  if (!val) return false;
  const d = val instanceof Date ? val : new Date(val as string | number);
  return !isNaN(d.getTime());
}

/**
 * Safely converts an input into a valid ISO string. Returns null if invalid.
 */
export function toSafeIso(val: unknown): string | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val as string | number);
  return isNaN(d.getTime()) ? null : d.toISOString();
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
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return fallback;

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
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return fallback;

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
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return fallback;

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
