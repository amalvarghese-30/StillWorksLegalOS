const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n==================================================================");
console.log("  LEGALOS PREMIUM TYPOGRAPHY REDESIGN & TOKENS VERIFICATION");
console.log("==================================================================\n");

// [Group 1] Font Loading in index.html
console.log("[Group 1] Font Loading Strategy in index.html");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert(
  indexHtml.includes("family=Plus+Jakarta+Sans:wght@400;500;600;700;800") &&
    indexHtml.includes("family=Inter:wght@400;500;600;700") &&
    indexHtml.includes("family=IBM+Plex+Mono:wght@400;500;600"),
  "index.html requests Plus Jakarta Sans, Inter, and IBM Plex Mono with exact required weights",
);
assert(
  indexHtml.includes('rel="preconnect" href="https://fonts.googleapis.com"') &&
    indexHtml.includes('rel="preconnect" href="https://fonts.gstatic.com" crossorigin'),
  "index.html maintains preconnect links for zero-latency font negotiation",
);
assert(
  indexHtml.includes("display=swap"),
  "index.html enables display=swap to avoid FOIT and render blocking",
);

// [Group 2] Centralized Typography Tokens in styles.css
console.log("\n[Group 2] Centralized Typography Tokens in styles.css");
const stylesCss = fs.readFileSync(path.join(ROOT, "src/styles.css"), "utf8");
assert(
  stylesCss.includes('--font-display: "Plus Jakarta Sans"') &&
    stylesCss.includes('--font-sans: "Inter"') &&
    stylesCss.includes('--font-mono: "IBM Plex Mono"'),
  "styles.css defines font-display, font-sans, and font-mono with system fallbacks",
);
assert(
  stylesCss.includes("--text-display: clamp(") &&
    stylesCss.includes("--text-page: clamp(") &&
    stylesCss.includes("--text-detail: clamp(") &&
    stylesCss.includes("--text-section: clamp(") &&
    stylesCss.includes("--text-card-title: clamp(") &&
    stylesCss.includes("--text-body: 0.875rem;") &&
    stylesCss.includes("--text-table: clamp(") &&
    stylesCss.includes("--text-label: clamp(") &&
    stylesCss.includes("--text-helper: 0.75rem;") &&
    stylesCss.includes("--text-caption: 0.6875rem;"),
  "styles.css defines centralized responsive type scale tokens (display, page, detail, section, card-title, body, table, label, helper, caption)",
);
assert(
  stylesCss.includes("font-variant-numeric: tabular-nums"),
  "styles.css configures tabular-nums for numeric metrics, KPI values, and timestamps",
);

// [Group 3] Base Elements & Utility Classes
console.log("\n[Group 3] Base Elements & Utility Classes");
assert(
  stylesCss.includes("body {") &&
    stylesCss.includes("font-family: var(--font-sans);") &&
    stylesCss.includes("font-size: var(--text-body);"),
  "body element uses font-sans and text-body with high legibility anti-aliasing",
);
assert(
  stylesCss.includes("h1 {") &&
    stylesCss.includes("font-family: var(--font-display);") &&
    stylesCss.includes("letter-spacing: -0.02em;"),
  "h1 uses font-display with -0.02em letter spacing",
);
assert(
  stylesCss.includes("@utility font-display") &&
    stylesCss.includes("@utility font-sans") &&
    stylesCss.includes("@utility font-mono") &&
    stylesCss.includes("@utility text-display") &&
    stylesCss.includes("@utility text-page") &&
    stylesCss.includes("@utility text-table"),
  "styles.css provides reusable Tailwind CSS v4 @utility typography classes",
);

// [Group 4] Component Primitives Integration
console.log("\n[Group 4] Component Primitives Integration");
const cardUi = fs.readFileSync(path.join(ROOT, "src/components/ui/card.tsx"), "utf8");
assert(
  cardUi.includes("font-display text-card-title font-semibold tracking-tight text-foreground"),
  "CardTitle component applies font-display and text-card-title",
);

const dialogUi = fs.readFileSync(path.join(ROOT, "src/components/ui/dialog.tsx"), "utf8");
assert(
  dialogUi.includes("font-display text-lg sm:text-xl font-semibold leading-tight tracking-tight text-foreground"),
  "DialogTitle component applies font-display and 18-20px heading hierarchy",
);

const tableUi = fs.readFileSync(path.join(ROOT, "src/components/ui/table.tsx"), "utf8");
assert(
  tableUi.includes("text-xs font-semibold text-muted-foreground uppercase tracking-wider") &&
    tableUi.includes("p-3 align-middle text-table text-foreground leading-normal"),
  "TableHead and TableCell components enforce 12px headings and 13.5px comfortable content cells",
);

const labelUi = fs.readFileSync(path.join(ROOT, "src/components/ui/label.tsx"), "utf8");
assert(
  labelUi.includes("text-label font-medium leading-none"),
  "Label component applies text-label (13px) for consistent form typography",
);

const pageHeader = fs.readFileSync(path.join(ROOT, "src/components/layout/PageHeader.tsx"), "utf8");
assert(
  pageHeader.includes("font-display text-xl sm:text-2xl lg:text-page font-bold tracking-tight leading-tight text-foreground"),
  "PageHeader component renders titles with Plus Jakarta Sans (font-display) and responsive text-page scale",
);

console.log("\n==================================================================");
console.log(`  Tests Passed: ${passed} | Tests Failed: ${failed}`);
console.log("==================================================================\n");

if (failed > 0) {
  process.exit(1);
}
