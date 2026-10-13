/**
 * Canonical snooze duration and deadline validation contract
 * Accepts duration (hours: 0.5 to 168 inclusive) or ISO 8601 snoozeUntil timestamp (strictly in future, <= 168 hours).
 */

export interface SnoozeValidationResult {
  valid: boolean;
  targetUntil?: Date;
  durationHours?: number;
  error?: string;
  field?: string;
}

export function validateSnoozePayload(
  payload: unknown,
  serverNow: Date = new Date()
): SnoozeValidationResult {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Invalid request payload. Expected JSON object." };
  }

  const body = payload as Record<string, unknown>;
  const nowMs = serverNow.getTime();
  const MIN_HOURS = 0.5;
  const MAX_HOURS = 168.0;
  const maxUntilMs = nowMs + MAX_HOURS * 60 * 60 * 1000;

  const rawHours = body["hours"] !== undefined ? body["hours"] : body["durationHours"];
  const rawSnoozeUntil = body["snoozeUntil"];

  // 1. Duration-based path
  if (rawHours !== undefined) {
    if (typeof rawHours !== "number" || isNaN(rawHours) || !isFinite(rawHours)) {
      return {
        valid: false,
        error: "Invalid snooze duration. Hours must be a finite number.",
        field: "hours",
      };
    }

    if (rawHours < MIN_HOURS || rawHours > MAX_HOURS) {
      return {
        valid: false,
        error: `Snooze duration must be between ${MIN_HOURS} and ${MAX_HOURS} hours inclusive.`,
        field: "hours",
      };
    }

    const targetUntil = new Date(nowMs + rawHours * 60 * 60 * 1000);
    return {
      valid: true,
      targetUntil,
      durationHours: rawHours,
    };
  }

  // 2. Absolute ISO timestamp path
  if (rawSnoozeUntil !== undefined) {
    if (typeof rawSnoozeUntil !== "string" || !rawSnoozeUntil.trim()) {
      return {
        valid: false,
        error: "Invalid snoozeUntil. Must be an ISO 8601 string.",
        field: "snoozeUntil",
      };
    }

    const trimmed = rawSnoozeUntil.trim();

    // Enforce strict ISO 8601 format with explicit timezone (Z or ±HH:MM offset)
    const isoWithTzRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
    if (!isoWithTzRegex.test(trimmed)) {
      return {
        valid: false,
        error: "Invalid snoozeUntil format. Must be an ISO 8601 timestamp with explicit timezone (e.g. 2026-10-14T12:00:00Z).",
        field: "snoozeUntil",
      };
    }

    const parsedDate = new Date(trimmed);
    const parsedMs = parsedDate.getTime();
    if (isNaN(parsedMs)) {
      return {
        valid: false,
        error: "Invalid calendar date in snoozeUntil.",
        field: "snoozeUntil",
      };
    }

    if (parsedMs <= nowMs) {
      return {
        valid: false,
        error: "snoozeUntil must be strictly in the future.",
        field: "snoozeUntil",
      };
    }

    if (parsedMs > maxUntilMs) {
      return {
        valid: false,
        error: `snoozeUntil cannot exceed ${MAX_HOURS} hours (7 days) from current server time.`,
        field: "snoozeUntil",
      };
    }

    const durationHours = Math.round(((parsedMs - nowMs) / (60 * 60 * 1000)) * 100) / 100;
    return {
      valid: true,
      targetUntil: parsedDate,
      durationHours,
    };
  }

  return {
    valid: false,
    error: `Missing snooze duration. Please provide 'hours' (${MIN_HOURS} to ${MAX_HOURS}) or 'snoozeUntil' (future ISO timestamp within ${MAX_HOURS} hours).`,
  };
}
