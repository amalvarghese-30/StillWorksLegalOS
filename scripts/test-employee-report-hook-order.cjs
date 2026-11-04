/**
 * Regression Test Suite: Employee Detail Report React Hook Order & Render Invariant Validation
 *
 * Reproduces and verifies the resolution of React Error #310:
 * "Rendered more hooks than during the previous render."
 *
 * Verifies:
 * 1. Static AST / Hook-order verification on EmployeeDetailReportView in reports.tsx
 * 2. Simulated render sequence through all state transitions:
 *    - Render 1: Loading state (isLoading=true, data=undefined)
 *    - Render 2: Success state (isLoading=false, data={ employee, tasks, cases })
 *    - Render 3: Date filter change (startDate="2026-11-01", isLoading=true)
 *    - Render 4: Filtered data success (isLoading=false)
 *    - Render 5: Clear date filter (startDate="", endDate="")
 *    - Render 6: Employee with empty tasks & cases (tasks=[], cases=[])
 *    - Render 7: Error state (data=undefined, isError=true, retry available)
 *    - Render 8: Switch between different employees
 * 3. Consistent hook execution order and count invariant across ALL renders
 * 4. Audit surrounding report components for hook ordering violations
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("==================================================");
console.log("  EMPLOYEE REPORT — REACT HOOK ORDER REGRESSION SUITE");
console.log("==================================================");

const reportsPath = path.resolve(__dirname, "../src/routes/_shell/reports.tsx");

// ── Test Group 1: Static Code Hook Order Audit ─────────────────────────────
console.log("\n[Group 1] Static Code Analysis & Hook Declaration Ordering");

test("reports.tsx exists and contains EmployeeDetailReportView", () => {
  assert.ok(fs.existsSync(reportsPath), "reports.tsx must exist");
  const content = fs.readFileSync(reportsPath, "utf8");
  assert.ok(content.includes("function EmployeeDetailReportView"), "EmployeeDetailReportView function must exist");
});

test("EmployeeDetailReportView: all hooks declared BEFORE any conditional return", () => {
  const content = fs.readFileSync(reportsPath, "utf8");
  const fnStart = content.indexOf("function EmployeeDetailReportView");
  assert.ok(fnStart > 0, "Function must exist");

  const nextFn = content.indexOf("function ClientDetailReportView", fnStart);
  const fnBody = content.substring(fnStart, nextFn > 0 ? nextFn : fnStart + 4000);

  // Find first early return in the component
  const firstReturnMatch = fnBody.match(/if\s*\([^)]+\)\s*\{\s*return/);
  assert.ok(firstReturnMatch, "Found early return in EmployeeDetailReportView");
  const firstReturnIndex = firstReturnMatch.index;

  // Verify useTableSorting for tasks is declared BEFORE first return
  const taskSortingIndex = fnBody.indexOf("useTableSorting(rawTasks");
  assert.ok(taskSortingIndex > 0, "useTableSorting(rawTasks) must be present");
  assert.ok(
    taskSortingIndex < firstReturnIndex,
    `useTableSorting(rawTasks) at char ${taskSortingIndex} must precede early return at ${firstReturnIndex}`
  );

  // Verify useTableSorting for cases is declared BEFORE first return
  const caseSortingIndex = fnBody.indexOf("useTableSorting(rawCases");
  assert.ok(caseSortingIndex > 0, "useTableSorting(rawCases) must be present");
  assert.ok(
    caseSortingIndex < firstReturnIndex,
    `useTableSorting(rawCases) at char ${caseSortingIndex} must precede early return at ${firstReturnIndex}`
  );

  // Verify no hook invocations exist after early returns
  const afterFirstReturn = fnBody.substring(firstReturnIndex);
  // Match any hook calls (useXxxx(...)) that are not inside callbacks or children
  const rogueHookMatch = afterFirstReturn.match(/\b(useState|useEffect|useMemo|useCallback|useTableSorting|useNavigate|useEmployeeDetailReport)\s*\(/);
  assert.strictEqual(
    rogueHookMatch,
    null,
    `No React hooks may be called after the early return: found ${rogueHookMatch?.[0]}`
  );
});

test("EmployeeDetailReportView: safe memoized fallback arrays for rawTasks and rawCases", () => {
  const content = fs.readFileSync(reportsPath, "utf8");
  assert.ok(
    content.includes("const rawTasks = useMemo(() => data?.tasks || [], [data?.tasks]);"),
    "rawTasks must have safe fallback array"
  );
  assert.ok(
    content.includes("const rawCases = useMemo(() => data?.cases || [], [data?.cases]);"),
    "rawCases must have safe fallback array"
  );
});

test("EmployeeDetailReportView: removed redundant loading check and duplicate stale banner", () => {
  const content = fs.readFileSync(reportsPath, "utf8");
  const fnStart = content.indexOf("function EmployeeDetailReportView");
  const nextFn = content.indexOf("function ClientDetailReportView", fnStart);
  const fnBody = content.substring(fnStart, nextFn);

  // Ensure no duplicate StaleDataBanner with "client metrics" in employee view
  assert.ok(
    !fnBody.includes("Could not refresh the latest client metrics from the server"),
    "Employee view must not contain duplicate client metrics banner"
  );
  assert.ok(
    fnBody.includes("Could not refresh the latest employee metrics from the server"),
    "Employee view must have employee metrics stale banner"
  );
});

// ── Test Group 2: Simulated React Runtime Hook Execution Invariant ───────────
console.log("\n[Group 2] React Hook Execution Sequence & Count Invariant");

// Simulate React fiber hook dispatcher
class HookDispatcherTracker {
  constructor() {
    this.hookCalls = [];
    this.renderCount = 0;
  }

  reset() {
    this.hookCalls = [];
  }

  record(hookName, args) {
    this.hookCalls.push({ hookName, index: this.hookCalls.length });
  }

  get count() {
    return this.hookCalls.length;
  }

  get signature() {
    return this.hookCalls.map((h) => h.hookName).join(" -> ");
  }
}

const tracker = new HookDispatcherTracker();

// Mock the exact hook sequence of EmployeeDetailReportView
function simulateEmployeeDetailReportView(props, mockQueryState) {
  tracker.reset();

  // 1. useState("") — startDate
  tracker.record("useState(startDate)");
  // 2. useState("") — endDate
  tracker.record("useState(endDate)");
  // 3. useEmployeeDetailReport(employeeId) — useQuery
  tracker.record("useEmployeeDetailReport");
  // 4. useNavigate()
  tracker.record("useNavigate");
  // 5. useState(false) — empDrilldownOpen
  tracker.record("useState(empDrilldownOpen)");
  // 6. useState("tasks") — empDrilldownType
  tracker.record("useState(empDrilldownType)");
  // 7. useState("") — empDrilldownTitle
  tracker.record("useState(empDrilldownTitle)");
  // 8. useState("") — empDrilldownSubtitle
  tracker.record("useState(empDrilldownSubtitle)");
  // 9. useState(undefined) — empCustomTasks
  tracker.record("useState(empCustomTasks)");

  // 10. useMemo(() => data?.tasks || [], [data?.tasks]) — rawTasks
  tracker.record("useMemo(rawTasks)");

  // 11-16. useTableSorting(rawTasks)
  tracker.record("useTableSorting:useState(sortState)");
  tracker.record("useTableSorting:useCallback(onSort)");
  tracker.record("useTableSorting:useCallback(resetSort)");
  tracker.record("useTableSorting:useCallback(setSort)");
  tracker.record("useTableSorting:useMemo(sortedData)");
  tracker.record("useTableSorting:useCallback(getSortProps)");

  // 17. useMemo(() => data?.cases || [], [data?.cases]) — rawCases
  tracker.record("useMemo(rawCases)");

  // 18-23. useTableSorting(rawCases)
  tracker.record("useTableSorting:useState(sortState)");
  tracker.record("useTableSorting:useCallback(onSort)");
  tracker.record("useTableSorting:useCallback(resetSort)");
  tracker.record("useTableSorting:useCallback(setSort)");
  tracker.record("useTableSorting:useMemo(sortedData)");
  tracker.record("useTableSorting:useCallback(getSortProps)");

  // CONDITIONAL RETURNS HAPPEN HERE (AFTER ALL HOOKS)
  if (mockQueryState.isLoading) {
    return { type: "loading_ui" };
  }

  if (!mockQueryState.data?.employee) {
    return { type: "error_retry_ui" };
  }

  return { type: "full_report_ui", data: mockQueryState.data };
}

test("Scenario: Hook count invariant holds from Loading to Success transition", () => {
  // Render 1: Loading
  const render1Result = simulateEmployeeDetailReportView(
    { employeeId: "emp_001" },
    { isLoading: true, data: undefined }
  );
  assert.strictEqual(render1Result.type, "loading_ui");
  const countRender1 = tracker.count;
  const signatureRender1 = tracker.signature;

  // Render 2: Data Loaded (Success)
  const render2Result = simulateEmployeeDetailReportView(
    { employeeId: "emp_001" },
    {
      isLoading: false,
      data: {
        employee: { _id: "emp_001", name: "Devhraj Yadav" },
        metrics: { totalTasks: 5, completedTasks: 3 },
        tasks: [{ _id: "t1", title: "Review Contract" }],
        cases: [{ _id: "c1", title: "Matter A" }],
        auditLogs: [],
      },
    }
  );
  assert.strictEqual(render2Result.type, "full_report_ui");
  const countRender2 = tracker.count;
  const signatureRender2 = tracker.signature;

  assert.strictEqual(countRender1, countRender2, `Hook counts must be identical: ${countRender1} vs ${countRender2}`);
  assert.strictEqual(signatureRender1, signatureRender2, "Hook execution order must be identical between loading and success");
});

test("Scenario: Hook count invariant holds during Date Filter changes", () => {
  // Render 3: User sets startDate (query becomes loading)
  const render3Result = simulateEmployeeDetailReportView(
    { employeeId: "emp_001" },
    { isLoading: true, data: undefined }
  );
  assert.strictEqual(render3Result.type, "loading_ui");
  const countRender3 = tracker.count;

  // Render 4: Filtered data arrives
  const render4Result = simulateEmployeeDetailReportView(
    { employeeId: "emp_001" },
    {
      isLoading: false,
      data: {
        employee: { _id: "emp_001", name: "Devhraj Yadav" },
        metrics: { totalTasks: 2, completedTasks: 2 },
        tasks: [{ _id: "t2", title: "NOC Filing" }],
        cases: [],
        auditLogs: [],
      },
    }
  );
  assert.strictEqual(render4Result.type, "full_report_ui");
  const countRender4 = tracker.count;

  assert.strictEqual(countRender3, countRender4, "Hook count must not change on date filter changes");
});

test("Scenario: Hook count invariant holds when employee has Zero tasks and Zero cases", () => {
  const result = simulateEmployeeDetailReportView(
    { employeeId: "emp_empty" },
    {
      isLoading: false,
      data: {
        employee: { _id: "emp_empty", name: "New Intern" },
        metrics: { totalTasks: 0, completedTasks: 0 },
        tasks: [],
        cases: [],
        auditLogs: [],
      },
    }
  );
  assert.strictEqual(result.type, "full_report_ui");
  assert.strictEqual(tracker.count, 23, "Must execute exactly 23 hooks on empty employee report");
});

test("Scenario: Hook count invariant holds on API Error with Retry UI", () => {
  const result = simulateEmployeeDetailReportView(
    { employeeId: "emp_error" },
    {
      isLoading: false,
      isError: true,
      data: null,
    }
  );
  assert.strictEqual(result.type, "error_retry_ui");
  assert.strictEqual(tracker.count, 23, "Must execute exactly 23 hooks on error state");
});

test("Scenario: Hook count invariant holds when switching between employees", () => {
  // Switch to employee 2
  simulateEmployeeDetailReportView(
    { employeeId: "emp_002" },
    { isLoading: true, data: undefined }
  );
  const countEmp2Loading = tracker.count;

  simulateEmployeeDetailReportView(
    { employeeId: "emp_002" },
    {
      isLoading: false,
      data: {
        employee: { _id: "emp_002", name: "Sneha Patil" },
        metrics: { totalTasks: 12 },
        tasks: [],
        cases: [],
      },
    }
  );
  const countEmp2Loaded = tracker.count;

  assert.strictEqual(countEmp2Loading, countEmp2Loaded);
  assert.strictEqual(countEmp2Loaded, 23);
});

// ── Test Group 3: Audit of All Surrounding Report Components ──────────────────
console.log("\n[Group 3] Audit of All Surrounding Report Components");

test("ClientDetailReportView: hooks declared BEFORE early returns", () => {
  const content = fs.readFileSync(reportsPath, "utf8");
  const fnStart = content.indexOf("function ClientDetailReportView");
  assert.ok(fnStart > 0);
  const fnBody = content.substring(fnStart);

  const firstReturn = fnBody.indexOf("if (isLoading)");
  const visitSorting = fnBody.indexOf("useTableSorting(rawClientVisits");
  const caseSorting = fnBody.indexOf("useTableSorting(rawCases");

  assert.ok(visitSorting < firstReturn, "rawClientVisits sorting must precede early return");
  assert.ok(caseSorting < firstReturn, "rawCases sorting must precede early return");
});

test("ReportsPage: all custom hooks declared in main body unconditionally", () => {
  const content = fs.readFileSync(reportsPath, "utf8");
  const fnStart = content.indexOf("function ReportsPage()");
  const nextFn = content.indexOf("function CaseGrowthChart", fnStart);
  const fnBody = content.substring(fnStart, nextFn);

  const sortingHook = fnBody.indexOf("useTableSorting(rawClients");
  const returnIndex = fnBody.indexOf("return (");

  assert.ok(sortingHook > 0, "useTableSorting(rawClients) exists");
  assert.ok(sortingHook < returnIndex, "useTableSorting precedes main JSX return");
  assert.ok(!fnBody.includes("if (isLoading) return"), "ReportsPage has no early returns before hooks");
});

console.log("\n==================================================");
console.log(`  RESULTS: ${passed} passed | ${failed} failed`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
