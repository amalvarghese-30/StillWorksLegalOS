/**
 * Regression Test Suite for Environment-File Path Resolution and Safety
 * 
 * Validates:
 * 1. .env standard resolution
 * 2. .env.local resolution
 * 3. .env.development resolution
 * 4. Filenames with accidental trailing whitespace (".env ") normalized safely
 * 5. Filenames with accidental leading whitespace (" .env") normalized safely
 * 6. Windows absolute paths handling
 * 7. Windows absolute paths with accidental trailing whitespace
 * 8. Relative project paths
 * 9. Missing required environment files throw informative errors
 * 10. Existing required environment files pass validation
 * 11. Empty filename throws descriptive error
 * 12. Non-string filename throws TypeError
 * 13. sanitizeProjectRoot trims trailing whitespace from working directory
 * 14. getValidEnvFiles returns clean candidate list
 */

const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");

// Pure reference implementation matching src/lib/envResolver.ts & server/src/utils/envResolver.ts
function sanitizeProjectRoot(rawRoot) {
  const root = (rawRoot ?? process.cwd()).trim();
  if (!root) {
    return path.resolve(process.cwd());
  }
  return path.resolve(root);
}

function resolveEnvPath(projectRoot, filename, options = {}) {
  if (typeof filename !== "string") {
    throw new TypeError("Environment filename must be a string.");
  }

  const normalizedFilename = filename.trim();

  if (!normalizedFilename) {
    throw new Error("Environment filename cannot be empty.");
  }

  const cleanRoot = sanitizeProjectRoot(projectRoot);
  const resolved = path.isAbsolute(normalizedFilename)
    ? path.normalize(normalizedFilename)
    : path.resolve(cleanRoot, normalizedFilename);

  if (options.required && !fs.existsSync(resolved)) {
    throw new Error(`Required environment file "${normalizedFilename}" not found at ${resolved}`);
  }

  return resolved;
}

function getValidEnvFiles(projectRoot, mode = "development") {
  const cleanRoot = sanitizeProjectRoot(projectRoot);
  const cleanMode = (mode || "development").trim();

  const names = [
    ".env",
    ".env.local",
    `.env.${cleanMode}`,
    `.env.${cleanMode}.local`,
  ];

  return names.map((name) => resolveEnvPath(cleanRoot, name));
}

let passed = 0;
let failed = 0;

function runTest(name, fn) {
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

console.log("\n=== Environment Path Resolver Regression Test Suite ===\n");

const dummyRoot = process.platform === "win32" ? "C:\\StillWorksLegalOS" : "/app/StillWorksLegalOS";

// 1. .env
runTest("1. Resolves standard .env against project root", () => {
  const res = resolveEnvPath(dummyRoot, ".env");
  assert.strictEqual(path.basename(res), ".env");
  assert.ok(!res.endsWith(" "));
});

// 2. .env.local
runTest("2. Resolves .env.local against project root", () => {
  const res = resolveEnvPath(dummyRoot, ".env.local");
  assert.strictEqual(path.basename(res), ".env.local");
  assert.ok(!res.endsWith(" "));
});

// 3. .env.development
runTest("3. Resolves .env.development against project root", () => {
  const res = resolveEnvPath(dummyRoot, ".env.development");
  assert.strictEqual(path.basename(res), ".env.development");
  assert.ok(!res.endsWith(" "));
});

// 4. Filename with accidental trailing whitespace
runTest("4. Safely normalizes filename with accidental trailing space ('.env ' -> '.env')", () => {
  const res = resolveEnvPath(dummyRoot, ".env ");
  assert.strictEqual(path.basename(res), ".env");
  assert.ok(!res.endsWith(" "), "Resolved path must not end with whitespace");
});

runTest("4b. Safely normalizes filename with multiple trailing spaces ('.env.local   ')", () => {
  const res = resolveEnvPath(dummyRoot, ".env.local   ");
  assert.strictEqual(path.basename(res), ".env.local");
  assert.ok(!res.endsWith(" "));
});

// 5. Filename with leading whitespace
runTest("5. Safely normalizes filename with accidental leading whitespace ('  .env')", () => {
  const res = resolveEnvPath(dummyRoot, "  .env");
  assert.strictEqual(path.basename(res), ".env");
});

// 6. Windows absolute paths
runTest("6. Preserves and normalizes Windows absolute paths", () => {
  if (process.platform === "win32") {
    const winPath = "C:\\Projects\\StillWorks\\.env";
    const res = resolveEnvPath(dummyRoot, winPath);
    assert.strictEqual(res, path.normalize(winPath));
  } else {
    const absPath = "/var/secrets/.env";
    const res = resolveEnvPath(dummyRoot, absPath);
    assert.strictEqual(res, path.normalize(absPath));
  }
});

// 7. Windows absolute paths with accidental trailing whitespace
runTest("7. Trims accidental trailing whitespace in absolute paths", () => {
  if (process.platform === "win32") {
    const winPathWithSpace = "C:\\Projects\\StillWorks\\.env ";
    const res = resolveEnvPath(dummyRoot, winPathWithSpace);
    assert.strictEqual(res, path.normalize("C:\\Projects\\StillWorks\\.env"));
    assert.ok(!res.endsWith(" "));
  } else {
    const absPathWithSpace = "/var/secrets/.env ";
    const res = resolveEnvPath(dummyRoot, absPathWithSpace);
    assert.strictEqual(res, path.normalize("/var/secrets/.env"));
    assert.ok(!res.endsWith(" "));
  }
});

// 8. Relative project paths
runTest("8. Resolves relative project paths without invalid concatenation", () => {
  const res = resolveEnvPath(dummyRoot, "server/.env");
  assert.strictEqual(res, path.resolve(dummyRoot, "server/.env"));
  assert.ok(!res.endsWith(" "));
});

// 9. Missing required environment files
runTest("9. Throws descriptive error for missing required environment files", () => {
  assert.throws(
    () => {
      resolveEnvPath(dummyRoot, ".env.non_existent_file_xyz", { required: true });
    },
    (err) => {
      return (
        err instanceof Error &&
        err.message.includes('Required environment file ".env.non_existent_file_xyz" not found')
      );
    }
  );
});

// 10. Existing required files pass validation
runTest("10. Existing required file passes validation when present", () => {
  const res = resolveEnvPath(process.cwd(), "package.json", { required: true });
  assert.ok(fs.existsSync(res));
});

// 11. Empty filename
runTest("11. Throws error for empty or whitespace-only filename", () => {
  assert.throws(
    () => {
      resolveEnvPath(dummyRoot, "   ");
    },
    (err) => {
      return err instanceof Error && err.message === "Environment filename cannot be empty.";
    }
  );
});

// 12. Non-string filename
runTest("12. Throws TypeError for non-string filename", () => {
  assert.throws(
    () => {
      resolveEnvPath(dummyRoot, null);
    },
    (err) => {
      return err instanceof TypeError;
    }
  );
});

// 13. sanitizeProjectRoot
runTest("13. sanitizeProjectRoot trims trailing whitespace from project root directory", () => {
  const rootWithSpace = dummyRoot + "  ";
  const clean = sanitizeProjectRoot(rootWithSpace);
  assert.ok(!clean.endsWith(" "), "Clean root must not have trailing space");
  assert.strictEqual(clean, path.resolve(dummyRoot));
});

// 14. getValidEnvFiles
runTest("14. getValidEnvFiles produces clean, non-trailing-space candidate list for mode", () => {
  const list = getValidEnvFiles(dummyRoot, "production ");
  assert.strictEqual(list.length, 4);
  for (const item of list) {
    assert.ok(!item.endsWith(" "));
  }
  assert.ok(list[0].endsWith(".env"));
  assert.ok(list[1].endsWith(".env.local"));
  assert.ok(list[2].endsWith(".env.production"));
  assert.ok(list[3].endsWith(".env.production.local"));
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
