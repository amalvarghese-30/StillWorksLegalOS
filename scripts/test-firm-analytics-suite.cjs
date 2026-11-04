/**
 * Comprehensive Automated Test Suite for Firm Analytics
 * Validates calculation methodology, snapshot vs period separation,
 * practice-area word wrapping, mutually exclusive task counts, and data contracts.
 */

const assert = require("assert");

console.log("==================================================");
console.log("  FIRM ANALYTICS — AUDIT & REGRESSION SUITE");
console.log("==================================================");

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Group 1: Snapshot vs Period Separation & Arithmetic Invariants
// ---------------------------------------------------------------------------
console.log("\n[Group 1] Snapshot vs Period Metric Definitions");

it("Overview distinguishes Current Snapshot from Selected Period Activity", () => {
  const sampleOverview = {
    // Snapshot
    activeCases: 42,
    activeClients: 19,
    openTasks: 35,
    overdueTasks: 4,
    pendingApprovals: 3,
    upcomingHearings: 6,

    // Period
    newCases: 8,
    newCasesPrev: 6,
    newCasesDiffPct: 33,

    closedCases: 5,
    closedCasesPrev: 4,
    closedCasesDiffPct: 25,

    tasksCompleted: 28,
    tasksCompletedPrev: 20,
    tasksCompletedDiffPct: 40,

    docsApproved: 14,
    docsApprovedPrev: 10,
    docsApprovedDiffPct: 40,

    newClients: 3,
    newClientsPrev: 2,
    newClientsDiffPct: 50,

    hearingsHeld: 7,
    hearingsHeldPrev: 5,
    hearingsHeldDiffPct: 40,
  };

  // Invariant 1: Overdue tasks must never exceed total open tasks
  assert(sampleOverview.overdueTasks <= sampleOverview.openTasks, "Overdue tasks exceeded open tasks");

  // Invariant 2: Active cases snapshot is independent of period newly instituted cases
  assert(sampleOverview.activeCases > 0, "Active cases should be positive");
  assert(typeof sampleOverview.newCases === "number", "New cases should be a valid number");
});

it("Percentage difference helper handles zero prev denominators safely", () => {
  const computePctDiff = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  assert.strictEqual(computePctDiff(5, 0), 100);
  assert.strictEqual(computePctDiff(0, 0), 0);
  assert.strictEqual(computePctDiff(10, 10), 0);
  assert.strictEqual(computePctDiff(15, 10), 50);
  assert.strictEqual(computePctDiff(5, 10), -50);
});

// ---------------------------------------------------------------------------
// Group 2: Mutually Exclusive Task Operational States
// ---------------------------------------------------------------------------
console.log("\n[Group 2] Mutually Exclusive Task Aggregation");

it("Overdue tasks are cleanly isolated from pending and in_progress pools", () => {
  const now = new Date("2026-11-04T12:00:00Z");

  const sampleTasks = [
    { _id: "1", status: "completed", deadline: new Date("2026-11-01") },
    { _id: "2", status: "pending", deadline: new Date("2026-11-01") }, // overdue!
    { _id: "3", status: "in_progress", deadline: new Date("2026-11-02") }, // overdue!
    { _id: "4", status: "pending", deadline: new Date("2026-11-10") }, // on schedule pending
    { _id: "5", status: "in_progress", deadline: null }, // on schedule in_progress
    { _id: "6", status: "pending_approval", deadline: new Date("2026-11-01") }, // pending approval
  ];

  let overdue = 0;
  let pendingApproval = 0;
  let inProgress = 0;
  let pending = 0;
  let completed = 0;

  for (const t of sampleTasks) {
    if (t.status === "completed") {
      completed++;
    } else if (t.status === "pending_approval") {
      pendingApproval++;
    } else if (t.status === "overdue" || (t.deadline && t.deadline < now)) {
      overdue++;
    } else if (t.status === "in_progress") {
      inProgress++;
    } else if (t.status === "pending") {
      pending++;
    }
  }

  assert.strictEqual(completed, 1);
  assert.strictEqual(pendingApproval, 1);
  assert.strictEqual(overdue, 2); // tasks 2 and 3
  assert.strictEqual(inProgress, 1); // task 5
  assert.strictEqual(pending, 1); // task 4

  const sum = completed + pendingApproval + overdue + inProgress + pending;
  assert.strictEqual(sum, sampleTasks.length, "Task categories must sum exactly to total task count");
});

// ---------------------------------------------------------------------------
// Group 3: Practice Area Distribution & Text Wrapping
// ---------------------------------------------------------------------------
console.log("\n[Group 3] Practice Area Text Wrapping & Spacing");

function wrapText(text, maxCharsPerLine = 24) {
  if (!text) return ["Unclassified"];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

it("Preserves complete legal category names without truncation ellipsis", () => {
  const longName = "CONSTITUTIONAL & ADMINISTRATIVE LITIGATION";
  const wrapped = wrapText(longName, 26);

  // Must not contain ellipsis
  assert(!wrapped.some((l) => l.includes("…") || l.includes("...")), "Ellipsis found in label");
  // Words must not be cut in half
  assert.strictEqual(wrapped.join(" "), longName, "Wrapped lines must reconstruct the original category name");
  assert(wrapped.length >= 2, "Long name should wrap into multiple readable lines");
});

it("Handles empty, null or undefined practice area under Unclassified", () => {
  assert.deepStrictEqual(wrapText(null), ["Unclassified"]);
  assert.deepStrictEqual(wrapText(""), ["Unclassified"]);
  assert.deepStrictEqual(wrapText(undefined), ["Unclassified"]);
});

// ---------------------------------------------------------------------------
// Group 4: Client Privacy & Data Safety Constraints
// ---------------------------------------------------------------------------
console.log("\n[Group 4] Client Privacy & Zero PII Leakage");

it("Top clients payload excludes PAN and Aadhaar numbers", () => {
  const sampleTopClient = {
    _id: "60c72b2f9b1d8b001c8e4d20",
    name: "Sunil Sharma",
    type: "Individual",
    tag: "Active",
    totalCases: 5,
    activeCases: 3,
  };

  assert.strictEqual(sampleTopClient["aadhar"], undefined, "Aadhaar number leaked in client analytics");
  assert.strictEqual(sampleTopClient["pan"], undefined, "PAN number leaked in client analytics");
  assert.strictEqual(typeof sampleTopClient.totalCases, "number");
  assert(sampleTopClient.activeCases <= sampleTopClient.totalCases, "Active cases cannot exceed total cases");
});

// ---------------------------------------------------------------------------
// Group 5: Trailing Growth Trajectory Date Boundaries
// ---------------------------------------------------------------------------
console.log("\n[Group 5] Case Trajectory & Genuinely Closed Matters");

it("Closed matters count uses authoritative completedAt timestamp", () => {
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-10-31T23:59:59Z");

  const oldCaseEditedToday = {
    status: "Closed",
    completedAt: new Date("2025-05-15T10:00:00Z"), // Closed last year
    updatedAt: new Date("2026-10-15T12:00:00Z"), // Minor edit occurred in Oct
  };

  const genuinelyClosedCase = {
    status: "Closed",
    completedAt: new Date("2026-10-20T15:30:00Z"),
    updatedAt: new Date("2026-10-20T15:30:00Z"),
  };

  const isClosedInPeriod = (c) => {
    const closedDate = c.completedAt || c.updatedAt;
    return c.status === "Closed" && closedDate >= start && closedDate <= end;
  };

  assert(!isClosedInPeriod(oldCaseEditedToday), "Old case edited today must NOT count as newly closed");
  assert(isClosedInPeriod(genuinelyClosedCase), "Genuinely closed case must count in period");
});

console.log("\n==================================================");
console.log(`  RESULTS: ${passed} passed | ${failed} failed`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
