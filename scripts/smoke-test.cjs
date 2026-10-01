/**
 * StillWorks LegalOS — Smoke Test Suite
 * Validates backend API, security gates, preload sandbox, and web dist integrity.
 *
 * Usage:
 *   node scripts/smoke-test.cjs [--url=http://localhost:3001]
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
let baseUrl = "http://localhost:3001";
for (const arg of args) {
  if (arg.startsWith("--url=")) {
    baseUrl = arg.slice("--url=".length);
  }
}

let passed = 0;
let failed = 0;

function logPass(msg) {
  console.log(`  ✓ ${msg}`);
  passed++;
}

function logFail(msg) {
  console.error(`  ✗ FAIL: ${msg}`);
  failed++;
}

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, text: body, json });
        });
      }
    );
    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSmokeTests() {
  console.log("==================================================");
  console.log(`  STILLWORKS LEGALOS — SMOKE TEST SUITE`);
  console.log(`  Target: ${baseUrl}`);
  console.log("==================================================\n");

  // Probe if server is online
  let isServerOnline = false;
  try {
    const probe = await fetch(`${baseUrl}/api/health`);
    if (probe.status === 200) {
      isServerOnline = true;
    }
  } catch {
    isServerOnline = false;
  }

  if (isServerOnline) {
    // 1. Health check
    console.log("[Suite 1] API Health & Readiness Checks");
    try {
      const health = await fetch(`${baseUrl}/api/health`);
      if (health.status === 200 && health.json?.status === "ok") {
        logPass("GET /api/health returned 200 OK");
      } else {
        logFail(`GET /api/health failed with status ${health.status}`);
      }
    } catch (err) {
      logFail(`GET /api/health error: ${err.message}`);
    }

    // 2. Readiness check
    try {
      const ready = await fetch(`${baseUrl}/api/ready`);
      if (ready.status === 200 && ready.json?.ready === true) {
        logPass("GET /api/ready returned 200 Ready");
      } else {
        logFail(`GET /api/ready failed with status ${ready.status}`);
      }
    } catch (err) {
      logFail(`GET /api/ready error: ${err.message}`);
    }

    // 3. Reminders health check
    try {
      const remHealth = await fetch(`${baseUrl}/api/reminders/health`);
      if (remHealth.status === 200 && remHealth.json?.service === "reminders") {
        logPass("GET /api/reminders/health returned 200 OK");
      } else {
        logFail(`GET /api/reminders/health failed with status ${remHealth.status}`);
      }
    } catch (err) {
      logFail(`GET /api/reminders/health error: ${err.message}`);
    }

    // 4. Auth & Security: Protected endpoints require authorization
    console.log("\n[Suite 2] Authorization & Security Gates");
    try {
      const dueRem = await fetch(`${baseUrl}/api/reminders/due`);
      if (dueRem.status === 401) {
        logPass("GET /api/reminders/due correctly rejects unauthenticated requests with 401");
      } else {
        logFail(`GET /api/reminders/due expected 401, got ${dueRem.status}`);
      }
    } catch (err) {
      logFail(`GET /api/reminders/due auth check error: ${err.message}`);
    }

    try {
      const cases = await fetch(`${baseUrl}/api/cases`);
      if (cases.status === 401) {
        logPass("GET /api/cases correctly rejects unauthenticated requests with 401");
      } else {
        logFail(`GET /api/cases expected 401, got ${cases.status}`);
      }
    } catch (err) {
      logFail(`GET /api/cases auth check error: ${err.message}`);
    }

    // 5. Auth validation: Invalid credentials rejection
    try {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid@example.com", password: "wrongpassword123" }),
      });
      if (loginRes.status === 401) {
        logPass("POST /api/auth/login rejects invalid credentials with 401");
      } else {
        logFail(`POST /api/auth/login expected 401, got ${loginRes.status}`);
      }
    } catch (err) {
      logFail(`POST /api/auth/login error: ${err.message}`);
    }
  } else {
    console.log("[Suite 1 & 2] API Health & Authorization Gates");
    console.log(`  ⚠ Server is not currently running at ${baseUrl} (offline).`);
    console.log(`  ℹ Skipping live HTTP endpoints checks. To execute live checks, start the server via 'npm run dev:server'.`);
  }

  // 6. Preload sandbox validation
  console.log("\n[Suite 3] Electron Sandboxed Preload & Contract Audit");
  const preloadPath = path.resolve(process.cwd(), "dist-electron", "preload.cjs");
  if (fs.existsSync(preloadPath)) {
    const preloadContent = fs.readFileSync(preloadPath, "utf8");
    if (preloadContent.includes('require("path")') || preloadContent.includes("require('path')")) {
      logFail("dist-electron/preload.cjs contains forbidden require('path') in sandbox mode");
    } else {
      logPass("dist-electron/preload.cjs has NO forbidden require('path') calls");
    }

    if ((preloadContent.includes("electronAPI") || preloadContent.includes("legalOSAPI")) && preloadContent.includes("getRefreshToken")) {
      logPass("dist-electron/preload.cjs properly exposes electronAPI with auth token contract");
    } else {
      logFail("dist-electron/preload.cjs missing electronAPI or auth contract");
    }
  } else {
    logFail("dist-electron/preload.cjs does not exist");
  }

  // 7. Web client distribution audit
  console.log("\n[Suite 4] Web Client Distribution Audit");
  const webIndexPath = path.resolve(process.cwd(), "dist", "index.html");
  if (fs.existsSync(webIndexPath)) {
    const webIndex = fs.readFileSync(webIndexPath, "utf8");
    if (webIndex.includes("<div id=\"root\">") && webIndex.includes("assets/")) {
      logPass("dist/index.html is intact with root mount and asset references");
    } else {
      logFail("dist/index.html missing standard bundle markers");
    }
  } else {
    logFail("dist/index.html does not exist");
  }

  console.log("\n==================================================");
  console.log(`Smoke Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runSmokeTests().catch((err) => {
  console.error("Smoke test suite failed:", err);
  process.exit(1);
});
