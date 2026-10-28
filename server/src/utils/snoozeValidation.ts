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

export interface PostponeValidationResult {
  valid: boolean;
  targetUntil?: Date;
  reason?: string;
  error?: string;
  field?: string;
}

export function validatePostponePayload(
  payload: unknown,
  serverNow: Date = new Date()
): PostponeValidationResult {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Invalid request payload. Expected JSON object." };
  }

  const body = payload as Record<string, unknown>;
  const nowMs = serverNow.getTime();

  let rawUntil = body["postponeUntil"] ?? body["until"] ?? body["targetUntil"] ?? body["date"];
  const rawPreset = body["preset"] ?? body["quickChoice"];
  const rawReason = typeof body["reason"] === "string" ? body["reason"].trim() : undefined;

  if (rawReason && rawReason.length > 500) {
    return {
      valid: false,
      error: "Reason exceeds maximum length of 500 characters.",
      field: "reason",
    };
  }

  // Handle quick presets if until date not explicitly provided
  if (!rawUntil && typeof rawPreset === "string") {
    const preset = rawPreset.toLowerCase().trim();
    if (preset === "later_today" || preset === "today") {
      const later = new Date(nowMs + 4 * 60 * 60 * 1000);
      rawUntil = later.toISOString();
    } else if (preset === "tomorrow") {
      const tomorrow = new Date(serverNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      if (tomorrow.getTime() <= nowMs) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }
      rawUntil = tomorrow.toISOString();
    } else if (preset === "next_week") {
      const nextWeek = new Date(serverNow);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(10, 0, 0, 0);
      rawUntil = nextWeek.toISOString();
    }
  }

  if (!rawUntil) {
    return {
      valid: false,
      error: "Missing postpone destination. Please provide 'postponeUntil' timestamp or a preset.",
      field: "postponeUntil",
    };
  }

  let parsedDate: Date;
  if (rawUntil instanceof Date) {
    parsedDate = rawUntil;
  } else if (typeof rawUntil === "string") {
    const trimmed = rawUntil.trim();
    if (!trimmed) {
      return {
        valid: false,
        error: "Invalid postponeUntil. Must be a non-empty date string.",
        field: "postponeUntil",
      };
    }
    parsedDate = new Date(trimmed);
  } else if (typeof rawUntil === "number") {
    parsedDate = new Date(rawUntil);
  } else {
    return {
      valid: false,
      error: "Invalid postponeUntil date type.",
      field: "postponeUntil",
    };
  }

  const parsedMs = parsedDate.getTime();
  if (isNaN(parsedMs)) {
    return {
      valid: false,
      error: "Invalid calendar date in postponeUntil.",
      field: "postponeUntil",
    };
  }

  if (parsedMs <= nowMs) {
    return {
      valid: false,
      error: "postponeUntil must be strictly in the future.",
      field: "postponeUntil",
    };
  }

  // Maximum allowable postpone is 10 years in the future
  const maxPostponeMs = nowMs + 10 * 365 * 24 * 60 * 60 * 1000;
  if (parsedMs > maxPostponeMs) {
    return {
      valid: false,
      error: "postponeUntil cannot exceed 10 years in the future.",
      field: "postponeUntil",
    };
  }

  return {
    valid: true,
    targetUntil: parsedDate,
    ...(rawReason ? { reason: rawReason } : {}),
  };
}
