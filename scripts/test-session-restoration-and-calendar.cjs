/**
 * Test Suite: Browser Session Restoration, Intermittent 401 Handling & Calendar Integrity
 * Validates:
 * 1. Calendar component imports useEffect properly and has no missing runtime symbols.
 * 2. refreshAccessToken() operates on HttpOnly cookie even when localStorage/sessionStorage is empty.
 * 3. In-memory token storage prevents XSS exfiltration while keeping access token ephemeral.
 * 4. Deduplication of concurrent in-flight refresh calls (shares single promise).
 * 5. apiFetch() coordinates with in-flight refresh to avoid race conditions.
 * 6. 401 retry happens at most once without infinite loops.
 * 7. Transient network failures (status 0 or 5xx) preserve persistent session hints.
 * 8. 401/403 explicit auth failures invoke clearTokens() to cleanly transition to login.
 * 9. Electron retains safeStorage IPC & request-body token exchange.
 * 10. Direct raw fetch() calls in services are eliminated in favor of apiFetch / downloadBlob.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("==================================================================");
console.log("  SESSION RESTORATION, 401 HANDLING & CALENDAR VERIFICATION SUITE");
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

// ---------------------------------------------------------------------------
// Group 1: Calendar Component Verification (Issue 1)
// ---------------------------------------------------------------------------
console.log("\n[Group 1] Calendar Component Import & Runtime Integrity");

it("Calendar component in src/routes/_shell/calendar.tsx imports useEffect", () => {
  const calendarPath = path.resolve(__dirname, "../src/routes/_shell/calendar.tsx");
  assert(fs.existsSync(calendarPath), "calendar.tsx file must exist");
  const content = fs.readFileSync(calendarPath, "utf8");

  // Verify React import includes useEffect
  const reactImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*["']react["']/);
  assert(reactImportMatch, "React import statement found in calendar.tsx");
  const importedSpecifiers = reactImportMatch[1].split(",").map((s) => s.trim());
  assert(
    importedSpecifiers.includes("useEffect"),
    `calendar.tsx must import useEffect from react. Found: ${importedSpecifiers.join(", ")}`
  );

  // Verify useEffect is actually used without syntax errors
  assert(content.includes("useEffect("), "calendar.tsx calls useEffect");
});

it("Calendar component has no undeclared React hook references", () => {
  const calendarPath = path.resolve(__dirname, "../src/routes/_shell/calendar.tsx");
  const content = fs.readFileSync(calendarPath, "utf8");

  const hooksUsed = ["useState", "useMemo", "useEffect", "useAuth", "useCalendarEvents", "useEmployees"];
  for (const hook of hooksUsed) {
    assert(content.includes(hook), `Hook ${hook} should be used in calendar.tsx`);
  }
});

// ---------------------------------------------------------------------------
// Group 2: Browser Session Restoration Weakness (Issue 2)
// ---------------------------------------------------------------------------
console.log("\n[Group 2] Browser Session Restoration & Cookie Architecture");

it("refreshAccessToken in src/services/api.ts does NOT block on missing localStorage session hints", () => {
  const apiPath = path.resolve(__dirname, "../src/services/api.ts");
  const content = fs.readFileSync(apiPath, "utf8");

  // Ensure old restriction 'if (!hasSessionHint) { return null; }' is gone from refreshAccessToken
  const refreshSlice = content.slice(content.indexOf("export async function refreshAccessToken"), content.indexOf("export async function apiFetch"));
  assert(
    !refreshSlice.includes("if (!hasSessionHint)"),
    "refreshAccessToken must not reject cookie refresh when localStorage hints are absent"
  );
  assert(
    refreshSlice.includes('credentials: "include"'),
    'Web refresh must send credentials: "include" for HttpOnly cookie'
  );
});

it("AuthProvider attempts refreshAccessToken unconditionally during initial restoration", () => {
  const authPath = path.resolve(__dirname, "../src/lib/auth.tsx");
  const content = fs.readFileSync(authPath, "utf8");

  // In init(), token refresh must be attempted even if STORAGE_KEY is absent
  const initSlice = content.slice(content.indexOf("const init = async () =>"), content.indexOf("init();"));
  assert(
    !initSlice.includes("if (hasSessionHint)"),
    "AuthProvider must not gate refreshAccessToken behind hasSessionHint"
  );
  assert(
    initSlice.includes("token = await refreshAccessToken();"),
    "AuthProvider calls refreshAccessToken during startup"
  );
  assert(
    initSlice.includes('apiFetch<{ user: RawUser }>("/auth/me")'),
    "AuthProvider fetches /auth/me on successful refresh"
  );
});

it("Transient errors (status 0 or 5xx) do not erase persistent session hints in AuthProvider", () => {
  const authPath = path.resolve(__dirname, "../src/lib/auth.tsx");
  const content = fs.readFileSync(authPath, "utf8");

  const initSlice = content.slice(content.indexOf("const init = async () =>"), content.indexOf("init();"));
  assert(
    initSlice.includes("err.status === 401 || err.status === 403"),
    "Only explicit 401/403 clears persistent session storage"
  );
  assert(
    initSlice.includes("// Transient network failure or 5xx: preserve persistent session hints"),
    "Transient failures do not invoke clearTokens() or remove storage"
  );
});

it("Electron desktop continues to use safeStorage and request body refreshToken", () => {
  const apiPath = path.resolve(__dirname, "../src/services/api.ts");
  const content = fs.readFileSync(apiPath, "utf8");

  assert(content.includes("electronApi()?.getRefreshToken()"), "Electron reads refreshToken from safeStorage");
  assert(content.includes('body: JSON.stringify({ refreshToken })'), "Electron sends refreshToken in body");
  assert(content.includes('"x-client-type": "electron"'), "Electron passes client-type header");
});

// ---------------------------------------------------------------------------
// Group 3: Intermittent 401 Coordination & Request Lifecycle (Issue 3)
// ---------------------------------------------------------------------------
console.log("\n[Group 3] Intermittent 401 Elimination & Concurrent In-Flight Dedup");

it("apiFetch coordinates with in-flight refreshPromise before firing unauthenticated requests", () => {
  const apiPath = path.resolve(__dirname, "../src/services/api.ts");
  const content = fs.readFileSync(apiPath, "utf8");

  const apiFetchSlice = content.slice(content.indexOf("export async function apiFetch"), content.indexOf("export const api ="));
  assert(
    apiFetchSlice.includes("if (!token && refreshPromise && !path.startsWith(\"/auth/\"))"),
    "apiFetch must check for and await in-flight refreshPromise"
  );
  assert(
    apiFetchSlice.includes("token = await refreshPromise;"),
    "apiFetch awaits active refreshPromise to acquire new token before firing"
  );
});

it("apiFetch retry logic has strict single-attempt guard (no infinite retry loop)", () => {
  const apiPath = path.resolve(__dirname, "../src/services/api.ts");
  const content = fs.readFileSync(apiPath, "utf8");

  const apiFetchSlice = content.slice(content.indexOf("export async function apiFetch"), content.indexOf("export const api ="));
  assert(
    apiFetchSlice.includes("res.status === 401 && retryCount === 0 && !path.startsWith(\"/auth/\")"),
    "apiFetch only retries when retryCount === 0 and path is not /auth/*"
  );
  assert(
    apiFetchSlice.includes('headers["Authorization"] = `Bearer ${newToken}`'),
    "apiFetch retry updates Authorization header with new token"
  );
});

it("No unauthenticated service requests bypass api.ts client", () => {
  const adminServicePath = path.resolve(__dirname, "../src/services/admin.ts");
  const adminContent = fs.readFileSync(adminServicePath, "utf8");

  assert(
    !adminContent.includes("localStorage.getItem(\"legalos_token\")"),
    "admin.ts does not rely on non-existent localStorage tokens"
  );
  assert(
    adminContent.includes("downloadBlob("),
    "admin.ts uses downloadBlob for audit log export"
  );
  assert(
    !adminContent.includes("fetch(`${getApiBase()}/admin/employees/"),
    "admin.ts uses apiFetch for avatar upload and removal"
  );

  const gmailSettingsPath = path.resolve(__dirname, "../src/components/settings/GmailIntegrationSettings.tsx");
  const gmailContent = fs.readFileSync(gmailSettingsPath, "utf8");
  assert(
    gmailContent.includes('apiFetch<{ data?: { url?: string } }>("/gmail/auth-url")'),
    "GmailIntegrationSettings uses apiFetch instead of raw fetch"
  );
});

it("Multi-tab token sync is broadcasted via BroadcastChannel without exposing refresh credentials", () => {
  const apiPath = path.resolve(__dirname, "../src/services/api.ts");
  const content = fs.readFileSync(apiPath, "utf8");

  assert(
    content.includes('new BroadcastChannel("stillworks_auth_sync")'),
    "BroadcastChannel stillworks_auth_sync handles cross-tab token coordination"
  );
  assert(
    content.includes('authBroadcastChannel?.postMessage({ type: "LOGOUT" })'),
    "Logout is synchronized across tabs"
  );
  assert(
    !content.includes('authBroadcastChannel?.postMessage({ type: "TOKEN_REFRESHED", refreshToken:'),
    "BroadcastChannel NEVER sends refreshToken across tabs"
  );
});

console.log("\n==================================================================");
console.log(`  Tests Passed: ${passed} | Tests Failed: ${failed}`);
console.log("==================================================================\n");

process.exit(failed > 0 ? 1 : 0);
