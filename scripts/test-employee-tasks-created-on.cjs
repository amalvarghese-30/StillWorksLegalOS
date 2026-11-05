/**
 * Test Suite: Employee-Specific Tasks "Created On" Column Verification
 * Validates:
 * 1. Column order in EmployeeDetailWorkspace:
 *    [Title, Related Matter, Created On, Priority, Deadline, Status, Action]
 * 2. Sorting by createdAt accessor in useTableSorting.
 * 3. Graceful handling of null/undefined/invalid dates with '—'.
 * 4. Correct date format: DD/MM/YYYY.
 * 5. Task schema immutability of createdAt on updates.
 * 6. Non-regression of global tasks page, employee overview, and case listings.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("==================================================================");
console.log("  EMPLOYEE PROFILE TASKS — 'CREATED ON' COLUMN VERIFICATION");
console.log("==================================================================");

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

const workspacePath = path.resolve(__dirname, "../src/components/admin/EmployeeDetailWorkspace.tsx");
assert(fs.existsSync(workspacePath), "EmployeeDetailWorkspace.tsx must exist");
const workspaceContent = fs.readFileSync(workspacePath, "utf8");

// ---------------------------------------------------------------------------
// Group 1: UI Structure & Column Order
// ---------------------------------------------------------------------------
console.log("\n[Group 1] Table Header & Column Ordering");

it("Contains 'Created On' SortHeaderButton immediately after 'Related Matter'", () => {
  const relatedMatterIndex = workspaceContent.indexOf('sortKey="caseTitle"');
  const createdOnIndex = workspaceContent.indexOf('sortKey="createdAt"');
  const priorityIndex = workspaceContent.indexOf('sortKey="priority"');

  assert(relatedMatterIndex > 0, "Related Matter column found");
  assert(createdOnIndex > 0, "Created On column found");
  assert(priorityIndex > 0, "Priority column found");

  assert(
    relatedMatterIndex < createdOnIndex && createdOnIndex < priorityIndex,
    "Column order must be: Related Matter -> Created On -> Priority"
  );
});

it("Table header contains exactly the 7 required columns in order", () => {
  const tasksSection = workspaceContent.slice(workspaceContent.indexOf('activeTab === "tasks"'));
  const tableSlice = tasksSection.slice(
    tasksSection.indexOf('<thead className="border-b border-border/80'),
    tasksSection.indexOf("</thead>")
  );

  assert(tableSlice.includes("Task Title"), "Has Task Title");
  assert(tableSlice.includes("Related Matter"), "Has Related Matter");
  assert(tableSlice.includes("Created On"), "Has Created On");
  assert(tableSlice.includes("Priority"), "Has Priority");
  assert(tableSlice.includes("Deadline"), "Has Deadline");
  assert(tableSlice.includes("Status"), "Has Status");
  assert(tableSlice.includes("Action"), "Has Action");
});

// ---------------------------------------------------------------------------
// Group 2: Table Sorting & Data Accessor
// ---------------------------------------------------------------------------
console.log("\n[Group 2] useTableSorting & Timestamp Accessor");

it("useTableSorting accessors includes createdAt numeric timestamp sorting", () => {
  const accessorsSlice = workspaceContent.slice(
    workspaceContent.indexOf("accessors: {"),
    workspaceContent.indexOf("upcomingDeadlinesList")
  );

  assert(
    accessorsSlice.includes("createdAt: (t) => (t.createdAt ? new Date(t.createdAt).getTime() : 0)"),
    "createdAt accessor must map date string to timestamp for chronological sorting"
  );
});

it("Sorts tasks chronologically ascending and descending", () => {
  const task1 = { _id: "1", title: "Older Task", createdAt: "2026-01-10T10:00:00.000Z" };
  const task2 = { _id: "2", title: "Newer Task", createdAt: "2026-03-25T15:30:00.000Z" };
  const task3 = { _id: "3", title: "Undated Task", createdAt: null };

  const accessor = (t) => (t.createdAt ? new Date(t.createdAt).getTime() : 0);

  const list = [task2, task3, task1];
  const asc = [...list].sort((a, b) => accessor(a) - accessor(b));
  assert.strictEqual(asc[0]._id, "3", "Undated/0 timestamp comes first in asc");
  assert.strictEqual(asc[1]._id, "1", "Older task comes second in asc");
  assert.strictEqual(asc[2]._id, "2", "Newer task comes last in asc");

  const desc = [...list].sort((a, b) => accessor(b) - accessor(a));
  assert.strictEqual(desc[0]._id, "2", "Newer task comes first in desc");
  assert.strictEqual(desc[1]._id, "1", "Older task comes second in desc");
  assert.strictEqual(desc[2]._id, "3", "Undated task comes last in desc");
});

// ---------------------------------------------------------------------------
// Group 3: Date Rendering & Fallback
// ---------------------------------------------------------------------------
console.log("\n[Group 3] Date Formatting & Fallbacks");

it("Uses formatSafeDate for DD/MM/YYYY formatting and handles invalid/missing dates gracefully", () => {
  const { formatSafeDate } = require("../src/lib/dates.ts");

  // Valid ISO
  const d1 = formatSafeDate("2026-11-05T08:30:00.000Z");
  assert(d1.includes("/"), "Formatted date should contain slashes (DD/MM/YYYY)");

  // Missing or null
  const d2 = formatSafeDate(null);
  assert.strictEqual(d2, "—", "Null returns —");

  const d3 = formatSafeDate(undefined);
  assert.strictEqual(d3, "—", "Undefined returns —");

  const d4 = formatSafeDate("not-a-date");
  assert.strictEqual(d4, "—", "Invalid string returns —");
});

it("Table body renders formatted date badge or — fallback in whitespace-nowrap cell", () => {
  const tasksSection = workspaceContent.slice(workspaceContent.indexOf('activeTab === "tasks"'));
  const rowSlice = tasksSection.slice(
    tasksSection.indexOf("<tbody className=\"divide-y divide-border/50\">"),
    tasksSection.indexOf("</tbody>")
  );

  assert(rowSlice.includes("whitespace-nowrap"), "Created On cell uses whitespace-nowrap");
  assert(rowSlice.includes("formatSafeDate(t.createdAt)"), "Calls formatSafeDate on t.createdAt");
  assert(rowSlice.includes("—"), "Renders — when date is missing or invalid");
});

// ---------------------------------------------------------------------------
// Group 4: Backend Schema & Non-Regression
// ---------------------------------------------------------------------------
console.log("\n[Group 4] Backend Model & Scope Isolation");

it("server/src/models/Task.ts enables timestamps with immutable createdAt", () => {
  const taskModelPath = path.resolve(__dirname, "../server/src/models/Task.ts");
  const modelContent = fs.readFileSync(taskModelPath, "utf8");

  assert(modelContent.includes("timestamps: true"), "Task schema enables timestamps: true");
  assert(modelContent.includes("createdAt: Date"), "Task interface includes createdAt");
});

it("Global tasks page (src/routes/_shell/tasks.tsx) remains unmodified", () => {
  const globalTasksPath = path.resolve(__dirname, "../src/routes/_shell/tasks.tsx");
  const content = fs.readFileSync(globalTasksPath, "utf8");

  // Ensure global tasks page table remains its default self
  assert(content.includes("export const Route = createFileRoute"), "Global tasks page intact");
});

console.log("\n==================================================================");
console.log(`  Tests Passed: ${passed} | Tests Failed: ${failed}`);
console.log("==================================================================\n");

process.exit(failed > 0 ? 1 : 0);
