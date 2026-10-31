/**
 * Global Column Sorting & Table Ordering System for StillWorks LegalOS
 *
 * Implements a 3-state cycling comparator:
 * 1. Ascending (A -> Z / 0 -> 9 / oldest -> newest)
 * 2. Descending (Z -> A / 9 -> 0 / newest -> oldest)
 * 3. Default / Unsorted (null) — restores exact original dataset order
 *
 * Provides type-safe comparators for numbers, strings, dates, nested properties,
 * booleans, statuses, and custom computed metrics.
 */

export type SortDirection = "asc" | "desc" | null;

export interface SortState<TKey extends string = string> {
  key: TKey | null;
  direction: SortDirection;
}

export type AccessorFn<T> = (item: T) => unknown;

/**
 * Standard priority ranking for legal cases, tasks, and requests.
 * Lower number = higher priority.
 */
export const PRIORITY_RANK: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  normal: 3,
  low: 4,
};

/**
 * Standard status ranking for cases & tasks.
 */
export const STATUS_RANK: Record<string, number> = {
  urgent: 1,
  overdue: 2,
  active: 3,
  in_progress: 3,
  pending: 4,
  pending_approval: 4,
  in_review: 4,
  on_hold: 5,
  completed: 6,
  closed: 7,
  archived: 8,
};

/**
 * Calculates the next sort state in the 3-state cycle:
 * Unsorted (null) -> Ascending ('asc') -> Descending ('desc') -> Unsorted (null)
 * Switching to a different column always starts with 'asc'.
 */
export function getNextSortState<TKey extends string = string>(
  currentKey: TKey | null,
  currentDirection: SortDirection,
  targetKey: TKey
): SortState<TKey> {
  if (currentKey !== targetKey) {
    return { key: targetKey, direction: "asc" };
  }

  if (currentDirection === "asc") {
    return { key: targetKey, direction: "desc" };
  }

  if (currentDirection === "desc") {
    return { key: null, direction: null };
  }

  return { key: targetKey, direction: "asc" };
}

/**
 * Safely resolves a nested property path (e.g. "client.name", "metrics.workload").
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  if (!path.includes(".")) {
    return (obj as Record<string, unknown>)[path];
  }
  const parts = path.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Checks if a string or object represents a valid date or ISO timestamp.
 */
function isDateValue(val: unknown): val is Date | string {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === "string") {
    // Only test strings that look like date strings (e.g., 2026-10-31, 2026-10-31T..., etc.)
    if (/^\d{4}-\d{2}-\d{2}/.test(val) || /^\w{3}\s\d{1,2},\s\d{4}/.test(val)) {
      const parsed = Date.parse(val);
      return !isNaN(parsed);
    }
  }
  return false;
}

/**
 * Type-aware comparator for any two values.
 * Nulls, undefined, and empty strings always sort to the bottom regardless of direction.
 */
export function compareValues(valA: unknown, valB: unknown, direction: "asc" | "desc"): number {
  const isAEmpty = valA == null || valA === "";
  const isBEmpty = valB == null || valB === "";

  // Always keep nulls / empty values at the bottom
  if (isAEmpty && isBEmpty) return 0;
  if (isAEmpty) return 1;
  if (isBEmpty) return -1;

  // 1. Booleans
  if (typeof valA === "boolean" && typeof valB === "boolean") {
    const diff = (valA ? 1 : 0) - (valB ? 1 : 0);
    return direction === "asc" ? diff : -diff;
  }

  // 2. Numbers
  if (typeof valA === "number" && typeof valB === "number") {
    const diff = valA - valB;
    return direction === "asc" ? diff : -diff;
  }

  // 3. Dates
  if (isDateValue(valA) && isDateValue(valB)) {
    const timeA = new Date(valA).getTime();
    const timeB = new Date(valB).getTime();
    const diff = timeA - timeB;
    return direction === "asc" ? diff : -diff;
  }

  // 4. String comparisons
  const strA = String(valA).trim();
  const strB = String(valB).trim();

  // Check priority ranking
  const lowerA = strA.toLowerCase();
  const lowerB = strB.toLowerCase();
  if (lowerA in PRIORITY_RANK && lowerB in PRIORITY_RANK) {
    const diff = PRIORITY_RANK[lowerA] - PRIORITY_RANK[lowerB];
    return direction === "asc" ? diff : -diff;
  }

  // Natural numeric string comparison (e.g., "SW-2" sorts before "SW-10", "2" before "10")
  const diff = strA.localeCompare(strB, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return direction === "asc" ? diff : -diff;
}

/**
 * Pure, stable sorting function that never mutates the original dataset.
 *
 * @param data Source dataset to sort.
 * @param sortKey Target column key or nested property path.
 * @param direction "asc" | "desc" | null.
 * @param accessors Optional custom extractor functions for complex or computed fields.
 * @returns A sorted copy of the array, or a copy in original order if direction is null.
 */
export function sortData<T>(
  data: readonly T[],
  sortKey: string | null,
  direction: SortDirection,
  accessors?: Record<string, AccessorFn<T>>
): T[] {
  if (!Array.isArray(data)) return [];
  if (!sortKey || !direction) {
    // Restore default/original ordering via shallow copy
    return [...data];
  }

  const customAccessor = accessors?.[sortKey];

  // Index items for stable sorting tie-breaking
  const indexed = data.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    let valA: unknown;
    let valB: unknown;

    if (customAccessor) {
      valA = customAccessor(a.item);
      valB = customAccessor(b.item);
    } else {
      valA = getNestedValue(a.item, sortKey);
      valB = getNestedValue(b.item, sortKey);
    }

    const cmp = compareValues(valA, valB, direction);
    if (cmp !== 0) return cmp;

    // Stable sort tie-breaker: maintain original relative positions
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.item);
}
