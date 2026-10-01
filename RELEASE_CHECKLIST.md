# LEGALOS — PRODUCTION RELEASE CHECKLIST

**Date:** October 2, 2026  
**Version:** 1.0.0  
**Build Commit:** Current Verified Head  

---

## Pre-Release Verification Checklist

### 1. Codebase & Hygiene
- [x] No lingering references to legacy NAS, Synology, or WebDAV storage.
- [x] No hardcoded remote host fallbacks (`legalos.stillworks.in`).
- [x] No 2FA enforcement blockers in authentication flows.
- [x] No mock or placeholder data in production services.
- [x] Zero TypeScript compilation errors in client (`npm run check`).
- [x] Zero TypeScript compilation errors in backend server (`npm run build:server`).
- [x] Zero TypeScript compilation errors in desktop app (`npm run electron:build`).

### 2. Security & Compliance
- [x] User login returns uniform 401 code (`INVALID_CREDENTIALS`) on failure to prevent user enumeration.
- [x] Unmatched `/api/*` endpoints return structured JSON 404 (`{ message: "API endpoint not found" }`).
- [x] Filesystem storage strictly confined to `STORAGE_ROOT` (`./uploads` in development).
- [x] Directory traversal vectors (`../`, `%2e%2e`, backslashes) blocked with 400 Bad Request.
- [x] Document preview and download endpoints require valid authenticated session and case/client authorization.
- [x] Electron preload script uses sandboxed IPC context bridge with zero Node.js module leaks.
- [x] Session revocation on logout tested and operational.

### 3. Automated Test Suite
- [x] All 21 test suites in `server/src/tests/run-tests.ts` pass cleanly (245/245 tests).
- [x] Automated release verification script (`npm run release:verify`) completes with code 0.
- [x] Smoke test script (`node scripts/smoke-test.cjs`) executes against running server (9/9 pass).

### 4. Build Artifacts
- [x] Web production distribution exists in `dist/` with valid `index.html` and hashed assets.
- [x] Backend compilation outputs JavaScript modules to `server/dist/`.
- [x] Electron desktop scripts compile to `dist-electron/main.js` and `dist-electron/preload.cjs`.

### 5. Deployment Procedures
- [x] Seed script verified (`server/src/scripts/seed.ts`).
- [x] Health check endpoints verified (`/api/health`, `/api/ready`, `/api/reminders/health`).
- [x] Port assignment verified (API: 3001, Vite Web: 8080/5173).

---

## Post-Deployment Smoke Verification Plan (Future Cloud VPS)

When deploying to the cloud VPS:
1. Populate production `.env` with strong secrets (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, MongoDB URI, `STORAGE_ROOT`).
2. Run database migration and verification: `npm run build:server && node server/dist/index.js`.
3. Verify public health check: `curl -f https://<vps-domain>/api/health`.
4. Verify due reminders endpoint: `curl -f -H "Authorization: Bearer <token>" https://<vps-domain>/api/reminders/due`.
5. Perform test case creation and document upload through web browser.
