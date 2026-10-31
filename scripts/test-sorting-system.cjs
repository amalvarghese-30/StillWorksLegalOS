/**
 * Verification test suite for Global Column Sorting & Table Ordering System
 * Tests 3-state cycling, stable tie-breaking, numeric vs string comparison,
 * date handling, null resilience, and zero mutation.
 */

const assert = require("assert");

// Mocking the TypeScript pure functions compiled to CommonJS logic
function getNextSortState(currentKey, currentDirection, targetKey) {
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

const PRIORITY_RANK = {
  urgent: 1,
  high: 2,
  medium: 3,
  normal: 3,
  low: 4,
};

function getNestedValue(obj, path) {
  if (obj == null || typeof obj !== "object") return undefined;
  if (!path.includes(".")) {
    return obj[path];
  }
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function isDateValue(val) {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(val) || /^\w{3}\s\d{1,2},\s\d{4}/.test(val)) {
      const parsed = Date.parse(val);
      return !isNaN(parsed);
    }
  }
  return false;
}

function compareValues(valA, valB, direction) {
  const isAEmpty = valA == null || valA === "";
  const isBEmpty = valB == null || valB === "";

  if (isAEmpty && isBEmpty) return 0;
  if (isAEmpty) return 1;
  if (isBEmpty) return -1;

  if (typeof valA === "boolean" && typeof valB === "boolean") {
    const diff = (valA ? 1 : 0) - (valB ? 1 : 0);
    return direction === "asc" ? diff : -diff;
  }

  if (typeof valA === "number" && typeof valB === "number") {
    const diff = valA - valB;
    return direction === "asc" ? diff : -diff;
  }

  if (isDateValue(valA) && isDateValue(valB)) {
    const timeA = new Date(valA).getTime();
    const timeB = new Date(valB).getTime();
    const diff = timeA - timeB;
    return direction === "asc" ? diff : -diff;
  }

  const strA = String(valA).trim();
  const strB = String(valB).trim();

  const lowerA = strA.toLowerCase();
  const lowerB = strB.toLowerCase();
  if (lowerA in PRIORITY_RANK && lowerB in PRIORITY_RANK) {
    const diff = PRIORITY_RANK[lowerA] - PRIORITY_RANK[lowerB];
    return direction === "asc" ? diff : -diff;
  }

  const diff = strA.localeCompare(strB, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return direction === "asc" ? diff : -diff;
}

function sortData(data, sortKey, direction, accessors) {
  if (!Array.isArray(data)) return [];
  if (!sortKey || !direction) {
    return [...data];
  }

  const customAccessor = accessors && accessors[sortKey];
  const indexed = data.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    let valA;
    let valB;

    if (customAccessor) {
      valA = customAccessor(a.item);
      valB = customAccessor(b.item);
    } else {
      valA = getNestedValue(a.item, sortKey);
      valB = getNestedValue(b.item, sortKey);
    }

    const cmp = compareValues(valA, valB, direction);
    if (cmp !== 0) return cmp;
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.item);
}

console.log("==================================================");
console.log("  TESTING GLOBAL TABLE SORTING SYSTEM");
console.log("==================================================");

// TEST 1: Three-state cycling on same column
{
  let state = { key: null, direction: null };

  // First click: asc
  state = getNextSortState(state.key, state.direction, "name");
  assert.strictEqual(state.key, "name");
  assert.strictEqual(state.direction, "asc");
  console.log("✓ Cycle 1: Null -> Ascending on 'name'");

  // Second click: desc
  state = getNextSortState(state.key, state.direction, "name");
  assert.strictEqual(state.key, "name");
  assert.strictEqual(state.direction, "desc");
  console.log("✓ Cycle 2: Ascending -> Descending on 'name'");

  // Third click: null (Restores default ordering!)
  state = getNextSortState(state.key, state.direction, "name");
  assert.strictEqual(state.key, null);
  assert.strictEqual(state.direction, null);
  console.log("✓ Cycle 3: Descending -> Null (Reset to original order)");
}

// TEST 2: Switching to a new column resets to Ascending
{
  let state = { key: "workload", direction: "desc" };
  state = getNextSortState(state.key, state.direction, "name");
  assert.strictEqual(state.key, "name");
  assert.strictEqual(state.direction, "asc");
  console.log("✓ Column switch: 'workload' (desc) -> 'name' (asc)");
}

// TEST 3: Numeric sorting (10 must sort after 2, not after 1)
{
  const testData = [
    { id: 1, count: 10 },
    { id: 2, count: 2 },
    { id: 3, count: 1 },
    { id: 4, count: 20 },
  ];

  const sortedAsc = sortData(testData, "count", "asc");
  assert.deepStrictEqual(
    sortedAsc.map((x) => x.count),
    [1, 2, 10, 20],
    "Numeric asc failed: 10 should sort after 2"
  );

  const sortedDesc = sortData(testData, "count", "desc");
  assert.deepStrictEqual(
    sortedDesc.map((x) => x.count),
    [20, 10, 2, 1],
    "Numeric desc failed: 20 should be first, 1 last"
  );
  console.log("✓ Numeric sorting: 10 properly sorts after 2");
}

// TEST 4: Date sorting (chronological, not string comparison)
{
  const testData = [
    { id: 1, date: "2026-03-15T10:00:00.000Z" },
    { id: 2, date: "2026-01-02T10:00:00.000Z" },
    { id: 3, date: "2026-11-20T10:00:00.000Z" },
  ];

  const sortedAsc = sortData(testData, "date", "asc");
  assert.strictEqual(sortedAsc[0].id, 2); // Jan
  assert.strictEqual(sortedAsc[1].id, 1); // Mar
  assert.strictEqual(sortedAsc[2].id, 3); // Nov

  const sortedDesc = sortData(testData, "date", "desc");
  assert.strictEqual(sortedDesc[0].id, 3); // Nov
  assert.strictEqual(sortedDesc[2].id, 2); // Jan
  console.log("✓ Date sorting: Compared chronologically as timestamps");
}

// TEST 5: Null / undefined resilience (nulls always sort to bottom)
{
  const testData = [
    { id: 1, score: 50 },
    { id: 2, score: null },
    { id: 3, score: 90 },
    { id: 4, score: undefined },
    { id: 5, score: 10 },
  ];

  const sortedAsc = sortData(testData, "score", "asc");
  assert.strictEqual(sortedAsc[0].id, 5); // 10
  assert.strictEqual(sortedAsc[1].id, 1); // 50
  assert.strictEqual(sortedAsc[2].id, 3); // 90
  assert(sortedAsc[3].score == null);
  assert(sortedAsc[4].score == null);

  const sortedDesc = sortData(testData, "score", "desc");
  assert.strictEqual(sortedDesc[0].id, 3); // 90
  assert.strictEqual(sortedDesc[1].id, 1); // 50
  assert.strictEqual(sortedDesc[2].id, 5); // 10
  assert(sortedDesc[3].score == null);
  assert(sortedDesc[4].score == null);
  console.log("✓ Null resilience: Missing values safely positioned at bottom in both asc and desc");
}

// TEST 6: Stable tie-breaking
{
  const testData = [
    { id: 1, role: "Associate", origIndex: 0 },
    { id: 2, role: "Partner", origIndex: 1 },
    { id: 3, role: "Associate", origIndex: 2 },
    { id: 4, role: "Associate", origIndex: 3 },
  ];

  const sortedAsc = sortData(testData, "role", "asc");
  const associates = sortedAsc.filter((x) => x.role === "Associate");
  assert.deepStrictEqual(
    associates.map((x) => x.origIndex),
    [0, 2, 3],
    "Stable sort tie-breaking failed"
  );
  console.log("✓ Stable sorting: Equal values preserve initial relative order");
}

// TEST 7: Zero mutation of original array
{
  const original = Object.freeze([
    Object.freeze({ id: 1, name: "Charlie" }),
    Object.freeze({ id: 2, name: "Alice" }),
    Object.freeze({ id: 3, name: "Bob" }),
  ]);

  const sorted = sortData(original, "name", "asc");
  assert.strictEqual(original[0].name, "Charlie");
  assert.strictEqual(sorted[0].name, "Alice");
  assert.notStrictEqual(original, sorted);
  console.log("✓ Zero mutation: Original array is never altered");
}

// TEST 8: Computed accessors (like derived workload)
{
  const testData = [
    { id: "e1", name: "Employee A" },
    { id: "e2", name: "Employee B" },
    { id: "e3", name: "Employee C" },
  ];

  const workloadLookup = {
    e1: 85,
    e2: 25,
    e3: 60,
  };

  const sorted = sortData(testData, "workload", "desc", {
    workload: (emp) => workloadLookup[emp.id] ?? 0,
  });

  assert.strictEqual(sorted[0].id, "e1"); // 85%
  assert.strictEqual(sorted[1].id, "e3"); // 60%
  assert.strictEqual(sorted[2].id, "e2"); // 25%
  console.log("✓ Computed accessors: Successfully sorted derived workload percentage");
}

console.log("==================================================");
console.log("✓ ALL SORTING SYSTEM TESTS PASSED CLEANLY!");
console.log("==================================================");
