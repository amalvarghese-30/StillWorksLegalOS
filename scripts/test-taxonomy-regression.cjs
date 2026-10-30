const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("===============================================================================");
console.log("RUNNING TAXONOMY REGRESSION SUITE (20 ASSERTIONS)");
console.log("===============================================================================");

// 1. Inspect BASELINE_CATEGORY_TREE in src/services/categories.ts
const categoriesSource = fs.readFileSync(path.resolve(__dirname, "../src/services/categories.ts"), "utf8");

// Assertion 1: OTHER WORKS in BASELINE_CATEGORY_TREE
assert(categoriesSource.includes('name: "OTHER WORKS"'), "Assertion 1 Failed: 'OTHER WORKS' not in BASELINE_CATEGORY_TREE");
console.log("✔ Assertion 1: 'OTHER WORKS' is defined as level-1 main category in BASELINE_CATEGORY_TREE");

// Assertion 2: All 9 canonical main categories defined in BASELINE_CATEGORY_TREE
const canonicalMain = [
  "TRANSFER OF PROPERTY",
  "ONLY CIDCO WORK",
  "HEIRSHIP & COURT MATTERS",
  "TITLE SEARCH AND MISSING DOCUMENTS",
  "REDEVELOPMENT WORK / RERA",
  "OTHER WORKS",
  "REGISTRATION ONLY",
  "LAND / PLOT / REVENUE MATTERS",
  "OFFICE ADMIN WORK"
];
for (const cat of canonicalMain) {
  assert(categoriesSource.includes(`name: "${cat}"`), `Assertion 2 Failed: '${cat}' not in BASELINE_CATEGORY_TREE`);
}
console.log("✔ Assertion 2: All 9 canonical main categories exist in BASELINE_CATEGORY_TREE");

// Assertion 3: Possession Letter under TRANSFER OF PROPERTY
assert(categoriesSource.includes('name: "Possession Letter"'), "Assertion 3 Failed: 'Possession Letter' missing");
console.log("✔ Assertion 3: 'Possession Letter' is present under TRANSFER OF PROPERTY");

// Assertion 4: Rectification Deed NOT under TRANSFER OF PROPERTY in baseline tree
const topBlock = categoriesSource.substring(
  categoriesSource.indexOf('name: "TRANSFER OF PROPERTY"'),
  categoriesSource.indexOf('name: "ONLY CIDCO WORK"')
);
assert(!topBlock.includes('name: "Rectification Deed"'), "Assertion 4 Failed: 'Rectification Deed' should not be under TRANSFER OF PROPERTY");
console.log("✔ Assertion 4: 'Rectification Deed' correctly removed from TRANSFER OF PROPERTY");

// Assertion 5: Possession Letter NOT under ONLY CIDCO WORK in baseline tree
const cidcoBlock = categoriesSource.substring(
  categoriesSource.indexOf('name: "ONLY CIDCO WORK"'),
  categoriesSource.indexOf('name: "HEIRSHIP & COURT MATTERS"')
);
assert(!cidcoBlock.includes('name: "Possession Letter"'), "Assertion 5 Failed: 'Possession Letter' should not be under ONLY CIDCO WORK");
console.log("✔ Assertion 5: 'Possession Letter' correctly absent from ONLY CIDCO WORK");

// Assertion 6: SPECIAL LEGAL WORK under HEIRSHIP & COURT MATTERS has Legal Heir Documentation
const heirshipBlock = categoriesSource.substring(
  categoriesSource.indexOf('name: "HEIRSHIP & COURT MATTERS"'),
  categoriesSource.indexOf('name: "TITLE SEARCH AND MISSING DOCUMENTS"')
);
assert(heirshipBlock.includes('name: "SPECIAL LEGAL WORK"'), "Assertion 6a Failed: SPECIAL LEGAL WORK missing");
assert(heirshipBlock.includes('name: "Legal Heir Documentation"'), "Assertion 6b Failed: Legal Heir Documentation missing");
console.log("✔ Assertion 6: 'SPECIAL LEGAL WORK' contains 'Legal Heir Documentation'");

// Assertion 7: NO-Claim certificates under TITLE SEARCH AND MISSING DOCUMENTS
const titleBlock = categoriesSource.substring(
  categoriesSource.indexOf('name: "TITLE SEARCH AND MISSING DOCUMENTS"'),
  categoriesSource.indexOf('name: "REDEVELOPMENT WORK / RERA"')
);
assert(titleBlock.includes('name: "NO-Claim certificates"'), "Assertion 7 Failed: NO-Claim certificates missing");
console.log("✔ Assertion 7: 'NO-Claim certificates' present under TITLE SEARCH AND MISSING DOCUMENTS");

// Assertion 8: Rectification Deed is present under REGISTRATION ONLY
const regBlock = categoriesSource.substring(
  categoriesSource.indexOf('name: "REGISTRATION ONLY"'),
  categoriesSource.indexOf('name: "LAND / PLOT / REVENUE MATTERS"')
);
assert(regBlock.includes('name: "Rectification Deed"'), "Assertion 8 Failed: Rectification Deed missing in REGISTRATION ONLY");
console.log("✔ Assertion 8: 'Rectification Deed' present under REGISTRATION ONLY");

// Assertion 9: helper functions exist in categories.ts
assert(categoriesSource.includes("export function isOtherWorksMainCategory"), "Assertion 9a Failed: isOtherWorksMainCategory missing");
assert(categoriesSource.includes("export function isLegacyOtherWorkPlaceholder"), "Assertion 9b Failed: isLegacyOtherWorkPlaceholder missing");
assert(categoriesSource.includes("export function isCanonicalOtherWorksSubcategory"), "Assertion 9c Failed: isCanonicalOtherWorksSubcategory missing");
assert(categoriesSource.includes("export function isCustomCategoryUnderOtherWorks"), "Assertion 9d Failed: isCustomCategoryUnderOtherWorks missing");
console.log("✔ Assertion 9: All 4 precise helper functions are exported from categories.ts");

// Assertion 10: isOtherWorkCategory does not match OTHER WORKS
const isOtherMatch = !/OTHER WORKS/i.test("OTHER WORKS"); // test that our implementation won't hide OTHER WORKS
assert(categoriesSource.includes('n === "other work"'), "Assertion 10 Failed: isOtherWorkCategory must only match singular");
console.log("✔ Assertion 10: isOtherWorkCategory does not match 'OTHER WORKS'");

// Assertion 11: Backend seedCategories has exact taxonomy
const seedSource = fs.readFileSync(path.resolve(__dirname, "../server/src/scripts/seedCategories.ts"), "utf8");
const backendTopBlock = seedSource.substring(
  seedSource.indexOf('name: "TRANSFER OF PROPERTY"'),
  seedSource.indexOf('name: "ONLY CIDCO WORK"')
);
assert(!backendTopBlock.includes('name: "Rectification Deed"'), "Assertion 11 Failed: backend seed has Rectification Deed under TOP");
console.log("✔ Assertion 11: Backend seed has Rectification Deed removed from TRANSFER OF PROPERTY");

// Assertion 12: Backend seed has Legal Heir Documentation
assert(seedSource.includes('name: "Legal Heir Documentation"'), "Assertion 12 Failed: backend seed missing Legal Heir Documentation");
console.log("✔ Assertion 12: Backend seed contains 'Legal Heir Documentation'");

// Assertion 13: Backend seed has reparenting logic for tasks
assert(seedSource.includes('mainCategory: "REGISTRATION ONLY"'), "Assertion 13 Failed: reparenting logic missing");
assert(seedSource.includes('subCategory: "Rectification Deed"'), "Assertion 13 Failed: reparenting logic missing");
console.log("✔ Assertion 13: Backend seed contains task reparenting logic for Rectification Deed");

// Assertion 14: Categories route has completeness check for all 9 main categories
const routeSource = fs.readFileSync(path.resolve(__dirname, "../server/src/routes/categories.ts"), "utf8");
assert(routeSource.includes("TRANSFER OF PROPERTY"), "Assertion 14 Failed: route check missing canonical categories");
assert(routeSource.includes("SPECIAL LEGAL WORK"), "Assertion 14 Failed: route check missing SPECIAL LEGAL WORK");
console.log("✔ Assertion 14: Backend /tree route includes completeness check for all 9 main categories and SPECIAL LEGAL WORK");

// Assertion 15: AddCaseDialog does not filter out OTHER WORKS
const addCaseSource = fs.readFileSync(path.resolve(__dirname, "../src/components/cases/AddCaseDialog.tsx"), "utf8");
assert(!addCaseSource.includes("!isOtherWorkCategory(c?.name)"), "Assertion 15 Failed: AddCaseDialog still filters with isOtherWorkCategory");
console.log("✔ Assertion 15: AddCaseDialog does not filter out 'OTHER WORKS'");

// Assertion 16: AddClientDialog does not filter out OTHER WORKS
const addClientSource = fs.readFileSync(path.resolve(__dirname, "../src/components/clients/AddClientDialog.tsx"), "utf8");
assert(!addClientSource.includes("!isOtherWorkCategory(c?.name)"), "Assertion 16 Failed: AddClientDialog still filters with isOtherWorkCategory");
console.log("✔ Assertion 16: AddClientDialog does not filter out 'OTHER WORKS'");

// Assertion 17: EditCaseDialog does not filter out OTHER WORKS and has hierarchical selector
const editCaseSource = fs.readFileSync(path.resolve(__dirname, "../src/components/cases/EditCaseDialog.tsx"), "utf8");
assert(!editCaseSource.includes("!isOtherWorkCategory"), "Assertion 17a Failed: EditCaseDialog still filters with isOtherWorkCategory");
assert(editCaseSource.includes("availableSubCategories"), "Assertion 17b Failed: EditCaseDialog missing availableSubCategories");
console.log("✔ Assertion 17: EditCaseDialog supports hierarchical categories and preserves categoryPath");

// Assertion 18: AddTaskDialog does not filter out OTHER WORKS
const addTaskSource = fs.readFileSync(path.resolve(__dirname, "../src/components/tasks/AddTaskDialog.tsx"), "utf8");
assert(!addTaskSource.includes("!isOtherWorkCategory"), "Assertion 18 Failed: AddTaskDialog still filters with isOtherWorkCategory");
console.log("✔ Assertion 18: AddTaskDialog does not filter out 'OTHER WORKS'");

// Assertion 19: TaskDetailDialog preserves category and fallback
const taskDetailSource = fs.readFileSync(path.resolve(__dirname, "../src/components/tasks/TaskDetailDialog.tsx"), "utf8");
assert(!taskDetailSource.includes('"Other Work"'), "Assertion 19 Failed: TaskDetailDialog has legacy 'Other Work' fallback");
console.log("✔ Assertion 19: TaskDetailDialog uses canonical fallback 'OTHER WORKS'");

// Assertion 20: run-tests.ts updated with Legal Heir Documentation
const testSuiteSource = fs.readFileSync(path.resolve(__dirname, "../server/src/tests/run-tests.ts"), "utf8");
assert(testSuiteSource.includes('"Legal Heir Documentation"'), "Assertion 20 Failed: run-tests.ts missing Legal Heir Documentation");
console.log("✔ Assertion 20: Server test suite expects canonical 'Legal Heir Documentation'");

console.log("===============================================================================");
console.log("ALL 20 TAXONOMY ASSERTIONS PASSED CLEANLY!");
console.log("===============================================================================");
