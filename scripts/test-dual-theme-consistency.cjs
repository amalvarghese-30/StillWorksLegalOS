/**
 * test-dual-theme-consistency.cjs
 * Comprehensive verification of LegalOS Dual Theme (Blue & Sage) System:
 * 1. 4-Combination CSS selectors & variables (Blue/Sage x Light/Dark)
 * 2. Root element same-tag selector compatibility ([data-visual-theme="sage"].dark)
 * 3. Browser & PWA theme metadata synchronization
 * 4. Accessible Theme Switcher implementation (Radix DropdownMenu)
 * 5. Component theme token usage (elimination of hardcoded decorative accents)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    totalFailed++;
  }
}

console.log("\n==================================================================");
console.log("  LEGALOS DUAL THEME CONSISTENCY & ACCESSIBILITY AUDIT");
console.log("==================================================================\n");

// ---------------------------------------------------------------------------
// 1. CSS Selectors & 4-Combination Specificity (src/styles.css)
// ---------------------------------------------------------------------------
console.log("[Group 1] CSS Specificity & 4-Combination Selectors in styles.css");
const stylesCss = fs.readFileSync(path.join(ROOT, "src/styles.css"), "utf8");

// Check same-element Sage Dark selector
assert(
  stylesCss.includes('[data-visual-theme="sage"].dark'),
  'styles.css includes same-element selector [data-visual-theme="sage"].dark',
);

// Check Blue Dark selector
assert(
  stylesCss.includes('[data-visual-theme="blue"].dark') || stylesCss.includes(":root.dark"),
  "styles.css includes Blue dark mode selector",
);

// Check Sage Light selector
assert(
  stylesCss.includes('[data-visual-theme="sage"]'),
  'styles.css defines Sage light mode tokens under [data-visual-theme="sage"]',
);

// Check Blue Light / default selector
assert(
  stylesCss.includes('[data-visual-theme="blue"]') && stylesCss.includes(":root"),
  'styles.css defines Blue light mode tokens under :root and [data-visual-theme="blue"]',
);

// Check color-scheme declaration across dark themes
assert(
  stylesCss.includes("color-scheme: dark;"),
  "styles.css sets color-scheme: dark for dark mode combinations",
);

// Check sidebar-glass overrides for Sage and Sage Dark
assert(
  stylesCss.includes('[data-visual-theme="sage"] .sidebar-glass') &&
    stylesCss.includes('[data-visual-theme="sage"].dark .sidebar-glass'),
  "styles.css sets distinct sidebar-glass styling for Sage Light and Sage Dark",
);

// Check app-canvas radial gradient overrides for Sage and Sage Dark
assert(
  stylesCss.includes('[data-visual-theme="sage"] .app-canvas') &&
    stylesCss.includes('[data-visual-theme="sage"].dark .app-canvas'),
  "styles.css defines theme-aware app-canvas backgrounds for Sage Light and Sage Dark",
);

// ---------------------------------------------------------------------------
// 2. Browser & PWA Theme Metadata (index.html, manifest.json, theme.tsx)
// ---------------------------------------------------------------------------
console.log("\n[Group 2] Browser & PWA Theme Metadata Synchronization");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const manifestJson = JSON.parse(fs.readFileSync(path.join(ROOT, "public/manifest.json"), "utf8"));
const themeTsx = fs.readFileSync(path.join(ROOT, "src/lib/theme.tsx"), "utf8");

// Manifest defaults
assert(
  manifestJson.theme_color === "#0866E8",
  `manifest.json has default theme_color set to #0866E8 (got ${manifestJson.theme_color})`,
);
assert(
  manifestJson.background_color === "#F4F7FC",
  `manifest.json has default background_color set to #F4F7FC (got ${manifestJson.background_color})`,
);

// index.html early init script
assert(
  indexHtml.includes('localStorage.getItem("stillworks.visual_theme")') &&
    indexHtml.includes("meta.setAttribute(") &&
    indexHtml.includes('"content"'),
  "index.html early-init script updates both data-visual-theme and theme-color meta tag before paint",
);

// theme.tsx applyBrowserThemeColor function
assert(
  themeTsx.includes("export function applyBrowserThemeColor") &&
    themeTsx.includes('meta.name = "theme-color"') &&
    themeTsx.includes('meta.setAttribute("content", color)'),
  "theme.tsx defines and exports applyBrowserThemeColor",
);

// theme.tsx synchronizes in useEffect
assert(
  themeTsx.includes("applyBrowserThemeColor(visualTheme, resolvedTheme)"),
  "theme.tsx triggers applyBrowserThemeColor on visualTheme or resolvedTheme changes",
);

// theme.tsx defensive storage
assert(
  themeTsx.includes("try {") && themeTsx.includes("catch {"),
  "theme.tsx wraps localStorage interactions in defensive try-catch blocks",
);

// ---------------------------------------------------------------------------
// 3. Accessible Theme Switcher (src/components/common/ThemeSwitcher.tsx)
// ---------------------------------------------------------------------------
console.log("\n[Group 3] Theme Switcher Accessibility & Radix Integration");
const themeSwitcherTsx = fs.readFileSync(
  path.join(ROOT, "src/components/common/ThemeSwitcher.tsx"),
  "utf8",
);

assert(
  themeSwitcherTsx.includes("DropdownMenu") &&
    themeSwitcherTsx.includes("DropdownMenuTrigger") &&
    themeSwitcherTsx.includes("DropdownMenuContent"),
  "ThemeSwitcher uses Radix DropdownMenu primitives for robust accessibility",
);

assert(
  themeSwitcherTsx.includes('role="radiogroup"') && themeSwitcherTsx.includes('role="radio"'),
  "ThemeSwitcher provides clear ARIA radiogroup and radio semantics",
);

assert(
  themeSwitcherTsx.includes("aria-checked={active}"),
  "ThemeSwitcher indicates active selected theme with aria-checked",
);

assert(
  themeSwitcherTsx.includes("ThemeSwatch") &&
    themeSwitcherTsx.includes("Modern Blue") &&
    themeSwitcherTsx.includes("Premium Sage"),
  "ThemeSwitcher preserves color preview swatches for both Modern Blue and Premium Sage",
);

// ---------------------------------------------------------------------------
// 4. Component Theme Token Audit (Elimination of Hardcoded Accents)
// ---------------------------------------------------------------------------
console.log("\n[Group 4] Audited Components Use Semantic Design Tokens");

// TodaysHearingsCard
const todaysHearingsCard = fs.readFileSync(
  path.join(ROOT, "src/components/dashboard/TodaysHearingsCard.tsx"),
  "utf8",
);
assert(
  !todaysHearingsCard.includes("text-purple-600 dark:text-purple-400") &&
    todaysHearingsCard.includes("bg-primary/10 text-primary"),
  "TodaysHearingsCard replaces hardcoded purple decorative accents with bg-primary/10 text-primary",
);

// AdminTeamCapacity
const adminTeamCapacity = fs.readFileSync(
  path.join(ROOT, "src/components/admin/dashboard/AdminTeamCapacity.tsx"),
  "utf8",
);
assert(
  adminTeamCapacity.includes("bg-primary") &&
    !adminTeamCapacity.includes("bg-indigo-600 dark:bg-indigo-500"),
  "AdminTeamCapacity uses theme-aware bg-primary for normal workload capacity bars",
);

// AuditMetricsSummary
const auditMetricsSummary = fs.readFileSync(
  path.join(ROOT, "src/components/admin/audit/AuditMetricsSummary.tsx"),
  "utf8",
);
assert(
  auditMetricsSummary.includes("from-primary/10 to-primary/5 text-primary border-primary/20"),
  "AuditMetricsSummary uses theme-bound primary tokens for the Total Events card",
);

// ApprovalMetricsSummary
const approvalMetricsSummary = fs.readFileSync(
  path.join(ROOT, "src/components/admin/approvals/ApprovalMetricsSummary.tsx"),
  "utf8",
);
assert(
  approvalMetricsSummary.includes("border-primary/70 shadow-primary/10") &&
    approvalMetricsSummary.includes("bg-primary/10 text-primary"),
  "ApprovalMetricsSummary uses theme-bound primary tokens for the Submitted Today queue",
);

// Admin Employees Summary
const adminEmployees = fs.readFileSync(
  path.join(ROOT, "src/routes/_admin/admin.employees.tsx"),
  "utf8",
);
assert(
  adminEmployees.includes("bg-primary/10 text-primary border border-primary/20"),
  "admin.employees.tsx Total Employees card uses theme-bound primary tokens",
);

// Tasks Page Filter Card
const tasksRoute = fs.readFileSync(path.join(ROOT, "src/routes/_shell/tasks.tsx"), "utf8");
assert(
  !tasksRoute.includes("border-indigo-500 bg-indigo-500/10") &&
    tasksRoute.includes("border-primary bg-primary/10"),
  "tasks.tsx Pending / In Progress filter card uses border-primary bg-primary/10",
);

// Reports Page Pending Workload
const reportsRoute = fs.readFileSync(path.join(ROOT, "src/routes/_shell/reports.tsx"), "utf8");
assert(
  reportsRoute.includes("border-primary/30 bg-primary/5 p-4 shadow-soft") &&
    reportsRoute.includes("Current Pending Workload") &&
    reportsRoute.includes("text-caption font-medium text-primary"),
  "reports.tsx Pending Workload card uses border-primary/30 bg-primary/5 and text-primary",
);

// TaskDetailDialog
const taskDetailDialog = fs.readFileSync(
  path.join(ROOT, "src/components/tasks/TaskDetailDialog.tsx"),
  "utf8",
);
assert(
  taskDetailDialog.includes("bg-primary/10 text-primary border border-primary/20") &&
    !taskDetailDialog.includes("border border-blue-100 dark:bg-blue-950/40"),
  "TaskDetailDialog header uses theme-bound primary container",
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n==================================================================");
console.log(`  Tests Passed: ${totalPassed} | Tests Failed: ${totalFailed}`);
console.log("==================================================================\n");

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
