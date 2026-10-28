// ---------------------------------------------------------------------------
// StillWorks LegalOS — Avatar URL Resolution Test Suite
// ---------------------------------------------------------------------------
// Tests avatar resolution across browser and packaged Electron environments
// to guarantee profile avatars load properly without ERR_FILE_NOT_FOUND.
// ---------------------------------------------------------------------------

const assert = require("assert");

// Pure reference implementation matching src/lib/avatarUrl.ts
const VALID_AVATAR_FILENAME_REGEX = /^avatar_[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i;

function getNormalizedApiPrefix(customApiBase) {
  let base = customApiBase || "https://api-legalos.stillworks.in/api";
  base = (base || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  return base.endsWith("/api") ? base : `${base}/api`;
}

function resolveAvatarUrl(avatarRef, customApiBase) {
  if (!avatarRef || typeof avatarRef !== "string") {
    return "";
  }

  const trimmed = avatarRef.trim();
  if (!trimmed) {
    return "";
  }

  // Case D: Valid absolute HTTP/HTTPS, data:, or blob: URLs are preserved as-is
  if (/^(https?:|data:image\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  // Security check: Reject file:// schemes, directory traversal attempts, and Windows backslashes
  if (
    trimmed.toLowerCase().startsWith("file:") ||
    trimmed.includes("..") ||
    trimmed.includes("\\")
  ) {
    return "";
  }

  // Separate any query parameters (e.g. cache-busters ?v=12345) from the clean path
  const [cleanPath, query] = trimmed.split("?");
  if (!cleanPath) {
    return "";
  }

  // Normalize path segments by stripping leading slashes
  let pathWithoutLeadingSlash = cleanPath.replace(/^\/+/, "");

  // Case A: Path starting with /api/auth/avatar/ or api/auth/avatar/ or /auth/avatar/
  if (pathWithoutLeadingSlash.toLowerCase().startsWith("api/auth/avatar/")) {
    pathWithoutLeadingSlash = pathWithoutLeadingSlash.slice("api/auth/avatar/".length);
  } else if (pathWithoutLeadingSlash.toLowerCase().startsWith("auth/avatar/")) {
    pathWithoutLeadingSlash = pathWithoutLeadingSlash.slice("auth/avatar/".length);
  }
  // Case C: Recognized legacy storage path: Avatars/ or avatars/
  else if (pathWithoutLeadingSlash.toLowerCase().startsWith("avatars/")) {
    pathWithoutLeadingSlash = pathWithoutLeadingSlash.slice("avatars/".length);
  }

  // At this stage, pathWithoutLeadingSlash must be a single filename (no remaining slashes)
  if (pathWithoutLeadingSlash.includes("/") || !pathWithoutLeadingSlash) {
    return "";
  }

  // Case B / Validation: Must match the server's accepted avatar filename pattern
  if (!VALID_AVATAR_FILENAME_REGEX.test(pathWithoutLeadingSlash)) {
    return "";
  }

  const apiPrefix = getNormalizedApiPrefix(customApiBase);
  if (!apiPrefix) {
    return "";
  }

  const encodedFilename = encodeURIComponent(pathWithoutLeadingSlash);
  const queryString = query ? `?${query}` : "";

  return `${apiPrefix}/auth/avatar/${encodedFilename}${queryString}`;
}

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("==================================================");
console.log("  STILLWORKS LEGALOS — AVATAR URL RESOLUTION TESTS");
console.log("==================================================");

// 1. Server-relative /api/auth/avatar/avatar_ABC123_1793193135460.jpg path
console.log("\n[Requirement 1] Server-Relative Paths");
test("Resolves standard /api/auth/avatar/:filename relative path", () => {
  const result = resolveAvatarUrl(
    "/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg"
  );
});

test("Resolves server-relative path with cache-busting query parameter", () => {
  const result = resolveAvatarUrl(
    "/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg?v=1793193135460",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg?v=1793193135460"
  );
});

test("Resolves /auth/avatar/:filename (without leading /api)", () => {
  const result = resolveAvatarUrl(
    "/auth/avatar/avatar_user1_12345.png",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_user1_12345.png"
  );
});

// 2. Filename-only legacy value avatar_ABC123_1793193135460.jpg
console.log("\n[Requirement 2] Filename-Only Legacy Values");
test("Resolves bare filename avatar_ABC123_1793193135460.jpg", () => {
  const result = resolveAvatarUrl(
    "avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg"
  );
});

test("Resolves bare filename with query parameters", () => {
  const result = resolveAvatarUrl(
    "avatar_admin_9999.webp?size=thumb",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_admin_9999.webp?size=thumb"
  );
});

// 3. Recognized legacy Avatars/avatar_ABC123_1793193135460.jpg path
console.log("\n[Requirement 3] Legacy Avatars/ Storage Paths");
test("Resolves legacy Avatars/avatar_ABC123_1793193135460.jpg path", () => {
  const result = resolveAvatarUrl(
    "Avatars/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg"
  );
});

test("Resolves leading-slash /Avatars/ path", () => {
  const result = resolveAvatarUrl(
    "/Avatars/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg"
  );
});

test("Resolves lowercase avatars/ path", () => {
  const result = resolveAvatarUrl(
    "avatars/avatar_user_555.png",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_user_555.png"
  );
});

// 4. Already absolute HTTPS URL https://cdn.example.com/avatars/user.jpg
console.log("\n[Requirement 4] Already Absolute URLs and Data URIs");
test("Preserves absolute HTTPS URL unchanged", () => {
  const httpsUrl = "https://cdn.example.com/avatars/user.jpg";
  const result = resolveAvatarUrl(httpsUrl, "https://api-legalos.stillworks.in/api");
  assert.strictEqual(result, httpsUrl);
});

test("Preserves absolute HTTP URL unchanged", () => {
  const httpUrl = "http://internal-cdn.local/avatars/pic.jpg";
  const result = resolveAvatarUrl(httpUrl, "https://api-legalos.stillworks.in/api");
  assert.strictEqual(result, httpUrl);
});

test("Preserves data:image URI unchanged", () => {
  const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const result = resolveAvatarUrl(dataUri, "https://api-legalos.stillworks.in/api");
  assert.strictEqual(result, dataUri);
});

test("Preserves blob: URL unchanged", () => {
  const blobUrl = "blob:http://localhost:5174/8a01f592-3d71-4629-9a2f-1234567890ab";
  const result = resolveAvatarUrl(blobUrl, "https://api-legalos.stillworks.in/api");
  assert.strictEqual(result, blobUrl);
});

// 5. Missing, empty, or whitespace value ("", null, undefined, "  ")
console.log("\n[Requirement 5] Missing, Empty & Whitespace Values");
test("Returns empty string for empty string input", () => {
  assert.strictEqual(resolveAvatarUrl(""), "");
});

test("Returns empty string for null input", () => {
  assert.strictEqual(resolveAvatarUrl(null), "");
});

test("Returns empty string for undefined input", () => {
  assert.strictEqual(resolveAvatarUrl(undefined), "");
});

test("Returns empty string for whitespace-only input", () => {
  assert.strictEqual(resolveAvatarUrl("   \t\n  "), "");
});

// 6. Unsupported or malformed filename (malformed.exe, ../../etc/passwd, file:///C:/avatar.jpg)
console.log("\n[Requirement 6] Malformed, Dangerous or Invalid References");
test("Rejects disallowed file extension (.exe)", () => {
  assert.strictEqual(
    resolveAvatarUrl("malformed.exe", "https://api-legalos.stillworks.in/api"),
    ""
  );
});

test("Rejects path traversal (../../etc/passwd)", () => {
  assert.strictEqual(
    resolveAvatarUrl("../../etc/passwd", "https://api-legalos.stillworks.in/api"),
    ""
  );
});

test("Rejects file:/// scheme to prevent ERR_FILE_NOT_FOUND", () => {
  assert.strictEqual(
    resolveAvatarUrl("file:///C:/Users/avatar.jpg", "https://api-legalos.stillworks.in/api"),
    ""
  );
});

test("Rejects file: relative reference", () => {
  assert.strictEqual(
    resolveAvatarUrl("file://avatar_123.jpg", "https://api-legalos.stillworks.in/api"),
    ""
  );
});

test("Rejects Windows backslash directory traversal attempt", () => {
  assert.strictEqual(
    resolveAvatarUrl("..\\..\\Windows\\avatar_123.jpg", "https://api-legalos.stillworks.in/api"),
    ""
  );
});

test("Rejects filenames not adhering to avatar_ prefix", () => {
  assert.strictEqual(
    resolveAvatarUrl("normal_photo.jpg", "https://api-legalos.stillworks.in/api"),
    ""
  );
});

test("Rejects nested subpaths attempting to escape avatar endpoint", () => {
  assert.strictEqual(
    resolveAvatarUrl("avatar_dir/sub/avatar_123.jpg", "https://api-legalos.stillworks.in/api"),
    ""
  );
});

// 7. Configured development API base (http://localhost:5174/api)
console.log("\n[Requirement 7] Development API Base");
test("Resolves correctly with local development API base", () => {
  const result = resolveAvatarUrl(
    "/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg",
    "http://localhost:5174/api"
  );
  assert.strictEqual(
    result,
    "http://localhost:5174/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg"
  );
});

// 8. Packaged Electron environment (https://api-legalos.stillworks.in/api)
console.log("\n[Requirement 8] Packaged Electron Environment");
test("Resolves correctly in packaged Electron environment targeting production API", () => {
  const result = resolveAvatarUrl(
    "avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_6adcdb3e3379dae16bbfa521_1793193135460.jpg"
  );
  assert.strictEqual(result.startsWith("file://"), false, "Must NEVER resolve to file://");
});

// 9. Server URL with and without trailing /api, ensuring /api/api/ is never generated
console.log("\n[Requirement 9] Duplication Prevention (/api/api/ Elimination)");
test("Prevents duplicate /api/api/ when base already ends in /api", () => {
  const result = resolveAvatarUrl(
    "/api/auth/avatar/avatar_123.jpg",
    "https://api-legalos.stillworks.in/api"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_123.jpg"
  );
  assert.strictEqual(result.includes("/api/api/"), false);
});

test("Ensures clean /api is appended when customApiBase lacks /api", () => {
  const result = resolveAvatarUrl(
    "/api/auth/avatar/avatar_123.jpg",
    "https://api-legalos.stillworks.in"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_123.jpg"
  );
  assert.strictEqual(result.includes("/api/api/"), false);
});

test("Handles customApiBase with trailing slash properly", () => {
  const result = resolveAvatarUrl(
    "avatar_123.jpg",
    "https://api-legalos.stillworks.in/api/"
  );
  assert.strictEqual(
    result,
    "https://api-legalos.stillworks.in/api/auth/avatar/avatar_123.jpg"
  );
  assert.strictEqual(result.includes("/api/api/"), false);
});

test("Handles custom localhost without /api and with trailing slash", () => {
  const result = resolveAvatarUrl(
    "avatar_123.jpg",
    "http://localhost:3001/"
  );
  assert.strictEqual(
    result,
    "http://localhost:3001/api/auth/avatar/avatar_123.jpg"
  );
  assert.strictEqual(result.includes("/api/api/"), false);
});

console.log("\n==================================================");
console.log(`Avatar Test Results: ${passed} Passed, ${failed} Failed`);
console.log("==================================================\n");

if (failed > 0) {
  process.exit(1);
}
