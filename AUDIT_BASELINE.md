# AUDIT BASELINE REPORT — STILLWORKS LEGALOS

**Date**: 2026-09-30  
**Repository**: `amalvarghese-30/StillWorksLegalOS`  
**Branch**: `main`  
**Baseline Git Commit**: `2a58fbd`  

---

## 1. Build & Test Baseline Status

| Component | Status | Details |
| :--- | :--- | :--- |
| **Backend Test Suite** | **PASS** | 87 tests passed, 0 failed (`tsx src/tests/run-tests.ts` with in-memory MongoDB) |
| **Frontend Production Build** | **PASS** | `vite build` completed successfully (`dist/` generated, 2665 modules) |
| **Backend TypeScript Build** | **PASS** | `cd server && tsc` completed with exit code 0 |
| **Electron TypeScript Build** | **PASS** | `tsc -p electron/tsconfig.json && node scripts/build-preload.cjs` passed |
| **Frontend TypeScript Check (`tsc --noEmit`)** | **FAIL** | 7 files failed due to strict `exactOptionalPropertyTypes` and an undefined variable bug |
| **Linter (`eslint .`)** | **FAIL** | 7,179 Prettier formatting violations caught via ESLint |

---

## 2. Compilation & TypeScript Failures Found

The root TypeScript check (`npx tsc --noEmit`) failed with the following exact errors:

1. **`src/platform/externalLinks.ts` (Lines 121, 126)**:
   - `error TS2552: Cannot find name 'opened'. Did you mean 'open'?`
   - Real runtime reference bug where undefined variable `opened` was referenced instead of `open`.
2. **`src/lib/notifications.ts` (Line 107)**:
   - `error TS2339: Property 'show' does not exist on type 'Notification[]'`.
3. **`src/components/admin/AddEmployeeDialog.tsx` (Line 95)**:
   - Type incompatibility with `exactOptionalPropertyTypes`: `password: string | undefined` passed to `CreateEmployeePayload`.
4. **`src/components/calendar/CallReminderAlerts.tsx` (Line 318)**:
   - Type incompatibility with `exactOptionalPropertyTypes`: `taskId` / `eventId` `string | undefined`.
5. **`src/platform/downloads.ts` (Lines 43, 90, 102)**:
   - `ArrayBuffer | Uint8Array<ArrayBufferLike>` not assignable to `BlobPart` / `DownloadResult` exact optional properties.
6. **`src/platform/notifications.ts` (Lines 110, 155, 170)**:
   - `tag: string | undefined` incompatible with `exactOptionalPropertyTypes`.
7. **`vite.config.ts` (Line 9)**:
   - `error TS4111: Property 'VITE_API_PROXY_TARGET' comes from an index signature, so it must be accessed with ['VITE_API_PROXY_TARGET']`.

---

## 3. Known Production Errors & High-Priority Defects

1. **Case Creation 500 Error (Windows EXE & Web)**:
   - `POST https://legalos.stillworks.in/api/cases` has failed with 500 Internal Server Error in production.
   - Missing deployment identity endpoints (`/api/health`, `/api/ready` with build commit/version/environment).
   - Potential unhandled race conditions in case counter, transaction rollback, or party ID population.
2. **Call Reminder Synchronization Defect**:
   - Calendar call reminders currently only assign to `assignedTo[0]`.
   - Multi-user tasks (`assignedTo = [A, B, C]`) must generate individual authoritative reminders per user (`Reminder(A)`, `Reminder(B)`, `Reminder(C)`).
   - Reassignment (`[A, B, C] -> [A, C, D]`) must retain A and C, cancel B, and create D.
3. **BOLA & Document Authorization Defect**:
   - Access to documents was tied purely to module-level permission (`documents: true`) rather than entity ownership/case assignment.
   - Any authenticated employee could access any case document by guessing or enumerating the MongoDB ObjectId.
4. **Storage Security & Path Traversal Vulnerability**:
   - Client-supplied `nasPath` was partially trusted or verified with prefix matching (`startsWith(basePath)`) rather than canonical `path.relative` checking.
   - Chat attachment uploads allowed client metadata injection.
5. **Client <-> Case <-> Document Data Disconnect**:
   - Client page lacked dedicated tabs and queries for related cases, documents, and sub-clients.
   - Case party creation allowed pseudo-clients without real `clientId` relational references.
6. **Dead/Deprecated UI in Audit Logs**:
   - Unused buttons and tabs: "Chain Verification", "File Integrity", "Export" in Audit Logs UI.
7. **Missing Admin Password Reset Flow**:
   - Admins had no UI/API mechanism in Employee Management to issue secure temporary password resets or invalidate sessions.
8. **Profile Avatar Lifecycle Incomplete**:
   - Missing full avatar upload, validation, secure storage, and removal workflow.
9. **Environment Configuration Coupling**:
   - Development proxy had hardcoded assumptions and Electron lacked proper `VITE_API_URL` override support.

---

## 4. Codebase Audit Search Findings

- **Mocks & Stubs**:
  - `src/routes/_shell/documents.tsx`: Legacy comment `Toast state for stub actions` left behind.
  - Document preview fallback for complex binary files (DOCX, XLSX, PPTX) needs robust inline/fallback viewer instead of raw window opening.
- **`localStorage` Usage**:
  - Valid UX/theme preferences: `stillworks_sound_enabled`, `stillworks_theme`, `stillworks_login_remember`, `stillworks_fav_docs`.
  - Auth token is properly in-memory (`accessToken`), with refresh tokens handled via OS safeStorage in Electron and httpOnly cookie in browser.

---

## 5. Next Steps Plan

- **Phase 1**: Fix Case Creation, Add Deployment Identity (`/api/health`, `/api/ready`), Safe Counter & Idempotency.
- **Phase 2 & 3**: Redesign Authorization & Fix Document BOLA.
- **Phase 4 & 5**: Document Storage Security & Canonical Path Traversal Protection & Chat Attachment Security.
- **Phase 6 & 7 & 8**: Fix Client <-> Case <-> Document Relational Model & Client Detail Sections & Case Document Upload.
- **Phase 9, 10, 11, 12**: Document Actions, File Preview System, UI cleanup & Document Versioning.
- **Phase 13 & 14**: Multi-user Call Reminder Architecture & State Synchronization.
- **Phase 15, 16, 17, 18**: Task Form Validation, Broker/Agent "Other", TaskDetailDialog Redesign & Date Validation.
- **Phase 19 & 20**: Admin Password Reset & Profile Picture Lifecycle.
- **Phase 21 & 22**: Audit Log Cleanup & Route-Level Permission Guards.
- **Phase 23, 24, 25, 26**: Storage Architecture, Search Security, Chat Security, Cross-Module Consistency.
- **Phase 27 to 45**: Quality, Web & Windows EXE Verification, Automated Tests, Playwright E2E, Final Reports.
