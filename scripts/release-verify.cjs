const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(cmd, cwd = process.cwd()) {
  console.log(`\n▶ [RUN] ${cmd} (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function verifyFileExists(relativePath) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`✗ Missing required release artifact: ${relativePath}`);
    process.exit(1);
  }
  const stats = fs.statSync(fullPath);
  if (stats.size === 0) {
    console.error(`✗ Required release artifact is empty (0 bytes): ${relativePath}`);
    process.exit(1);
  }
  console.log(`✓ Verified artifact: ${relativePath} (${stats.size} bytes)`);
}

function auditForHardcodedSecrets(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        auditForHardcodedSecrets(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".cjs") || entry.name.endsWith(".html"))) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (/mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i.test(content) && !content.includes("dummy") && !content.includes("example")) {
        console.error(`✗ Potential hardcoded database URI detected in ${fullPath}`);
        process.exit(1);
      }
    }
  }
}

async function verifyRelease() {
  console.log("==================================================");
  console.log("  STILLWORKS LEGALOS — RELEASE VERIFICATION SUITE");
  console.log("==================================================");

  // 1. Backend tests and build
  console.log("\n[Step 1/5] Running Backend Security & Integration Test Matrix...");
  run("npm test", path.resolve(process.cwd(), "server"));

  console.log("\n[Step 2/5] Building Backend Server...");
  run("npm run build", path.resolve(process.cwd(), "server"));

  // 2. Client Web Build
  console.log("\n[Step 3/5] Building Web Client...");
  run("npm run build");

  // 3. Electron Build
  console.log("\n[Step 4/5] Building Electron Desktop Artifacts...");
  run("npm run electron:build");

  // 4. Artifact Validation
  console.log("\n[Step 5/5] Validating Artifact Presence & Integrity...");
  verifyFileExists("dist/index.html");
  verifyFileExists("dist-electron/main.js");
  verifyFileExists("dist-electron/preload.cjs");
  verifyFileExists("server/dist/index.js");

  // 5. Secret Leak Audit
  console.log("\n[Step 5/6] Checking output bundles for accidental credentials...");
  auditForHardcodedSecrets(path.resolve(process.cwd(), "dist"));
  auditForHardcodedSecrets(path.resolve(process.cwd(), "dist-electron"));
  console.log("✓ No hardcoded secrets detected in build artifacts");

  // 6. Automated Smoke Test
  console.log("\n[Step 6/6] Running Automated Smoke Test Suite...");
  run("node scripts/smoke-test.cjs");

  console.log("\n==================================================");
  console.log("✓ ALL RELEASE VERIFICATION CHECKS PASSED CLEANLY!");
  console.log("  Web and Windows EXE builds are production-ready.");
  console.log("==================================================\n");
}

verifyRelease().catch((err) => {
  console.error("Release verification failed:", err);
  process.exit(1);
});
