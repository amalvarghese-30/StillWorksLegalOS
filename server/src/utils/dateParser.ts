/**
 * Robust flexible date parser supporting:
 * - Date instances & numeric timestamps
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 * - YYYY-MM-DD, YYYY/MM/DD
 * - ISO-8601 strings
 * Defaults court hearings to 10:00 AM local time if date-only is provided.
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
    const month = parseInt(dmyMatch[2], 10) - 1;
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
