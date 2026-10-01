# LEGALOS — FORENSIC AUDIT: DISCOVERED DEFECTS & REMEDIATION LOG

**Date:** October 2, 2026  
**Auditor:** Principal Forensic Software Engineer  
**Classification:** Zero-Trust Forensic Verification  

---

### BUG ID: BUG-001
- **Severity:** P1 — CRITICAL
- **Feature:** Authentication & Account Security
- **Platform:** Web & Electron (Backend)
- **File:** `server/src/routes/auth.ts`
- **Line:** 115–133
- **Problem:** User account enumeration vulnerability in login endpoint.
- **Root Cause:** Differentiated error responses: missing email returned `code: "USER_NOT_FOUND"` and field `"email"`, while invalid password returned `code: "INVALID_PASSWORD"` and field `"password"`.
- **Impact:** External attackers could systematically enumerate registered staff and administrator email addresses.
- **Reproduction:** Send `POST /api/auth/login` with nonexistent email versus existing email with invalid password; inspect JSON response bodies and error codes.
- **Fix:** Unified both failure modes to return identical HTTP 401 status, identical `code: "INVALID_CREDENTIALS"`, and identical user-facing message targeting the password field.
- **Regression Risk:** Low. Client login forms handle any 401 code and highlight credentials invalidation.
- **Verification:** Automated tests `AUTH-ENUM-001` through `AUTH-ENUM-006` in Suite 21 assert identical status codes, error codes, and message strings.
- **Status:** **RESOLVED**

---

### BUG ID: BUG-002
- **Severity:** P2 — HIGH
- **Feature:** API Routing & Error Handling
- **Platform:** Web & Electron (Backend)
- **File:** `server/src/index.ts`
- **Line:** 324–337
- **Problem:** Unmatched API endpoints leaked Express default HTML 404 pages.
- **Root Cause:** Absence of a catch-all router for `/api/*` and missing centralized Express error middleware allowed requests to fall through to default static handlers.
- **Impact:** Frontend API clients received HTML instead of expected JSON, causing unhandled JSON parse exceptions.
- **Reproduction:** Send `GET /api/nonexistent-endpoint`; verify response Content-Type was `text/html`.
- **Fix:** Mounted `app.all("/api/*", ...)` returning `{ "message": "API endpoint not found" }` and structured JSON error-handling middleware.
- **Regression Risk:** None. Valid API routes are evaluated prior to the catch-all.
- **Verification:** Automated tests `API-404-001` through `API-404-003` assert 404 status, `application/json` Content-Type, and standard error JSON structure.
- **Status:** **RESOLVED**

---

### BUG ID: BUG-003
- **Severity:** P2 — HIGH
- **Feature:** Case Management & Referential Integrity
- **Platform:** Web & Electron (Backend)
- **File:** `server/src/routes/cases.ts`
- **Line:** 715–730
- **Problem:** Unvalidated `clientId` when appending parties to a case.
- **Root Cause:** `POST /api/cases/:id/parties` accepted any arbitrary `clientId` without verifying existence in the `Client` collection.
- **Impact:** Orphaned and corrupted client references inside case party subdocuments.
- **Reproduction:** Send `POST /api/cases/:id/parties` with random ObjectId for `clientId`; request was accepted with 200.
- **Fix:** Added strict `Types.ObjectId.isValid` format check and queried `Client.findById()` before appending the party.
- **Regression Risk:** Low. Rejects invalid IDs with HTTP 400.
- **Verification:** Automated tests `CASE-PARTY-003` and `CASE-PARTY-004` assert rejection with HTTP 400.
- **Status:** **RESOLVED**

---

### BUG ID: BUG-004
- **Severity:** P2 — HIGH
- **Feature:** Case Party Lifecycle & UI Controls
- **Platform:** Web & Electron (Full Stack)
- **File:** `server/src/routes/cases.ts`, `src/services/cases.ts`, `src/routes/_shell/cases.$caseId.tsx`
- **Line:** `cases.ts:788–846`, `cases.$caseId.tsx:320–345`
- **Problem:** Missing case party deletion endpoint and UI action.
- **Root Cause:** Backend only supported party addition (`POST`); no deletion route or frontend UI existed to remove mistakenly assigned parties.
- **Impact:** Erroneous or duplicate parties could never be removed from a case.
- **Reproduction:** Attempt to remove a party from case details; no UI control or DELETE endpoint existed.
- **Fix:** Implemented `DELETE /api/cases/:id/parties/:partyId` with audit logging, timeline tracking, and document linkage reconciliation. Added `useRemoveCaseParty()` mutation hook and an interactive confirmation dialog with trash button in the UI.
- **Regression Risk:** Low. Deletion requires explicit confirmation and updates timeline.
- **Verification:** Automated tests `CASE-PARTY-008` to `CASE-PARTY-011` assert party removal, timeline logging, and document reconciliation.
- **Status:** **RESOLVED**

---

### BUG ID: BUG-005
- **Severity:** P2 — HIGH
- **Feature:** Client ↔ Case ↔ Document Linkage
- **Platform:** Web & Electron (Backend)
- **File:** `server/src/routes/cases.ts`
- **Line:** 748–756, 815–824
- **Problem:** Document client metadata became desynchronized when case parties changed.
- **Root Cause:** Adding or removing a client party on a case did not reconcile `DocumentModel.clientId` for existing case documents.
- **Impact:** Case documents were orphaned from the client view when party associations changed.
- **Reproduction:** Add a client party to a case with existing documents; documents retained null `clientId`.
- **Fix:** Added automatic document client synchronization in `POST /api/cases/:id/parties` and `DELETE /api/cases/:id/parties/:partyId`.
- **Regression Risk:** Low. Confined strictly to documents belonging to the affected case.
- **Verification:** Automated tests `CASE-PARTY-007` and `CLIENT-SYNC-001..003` verify automatic document client metadata updates.
- **Status:** **RESOLVED**

---

### BUG ID: BUG-006
- **Severity:** P2 — HIGH
- **Feature:** Document Security & Information Disclosure
- **Platform:** Web & Electron (Backend)
- **File:** `server/src/routes/documents.ts`, `server/src/models/Document.ts`
- **Line:** `documents.ts:80`, `Document.ts:89–96`
- **Problem:** Document list query (`GET /api/documents`) leaked internal filesystem paths (`storagePath`, `storageFolder`, `nasPath`, `nasFolder`).
- **Root Cause:** `DocumentModel.find(filter).lean()` returned raw database documents without field projection or sanitization.
- **Impact:** Internal server filesystem directory structure was exposed to client applications.
- **Reproduction:** Call `GET /api/documents`; inspect document objects in the `documents` array for `storagePath`.
- **Fix:** Added `.select("-storagePath -storageFolder -nasPath -nasFolder -filePath -tempPath")` to `DocumentModel.find()` and configured `DocumentSchema.toJSON.transform` to unconditionally delete storage path attributes.
- **Regression Risk:** None. Frontend never relies on internal server paths for previews or downloads.
- **Verification:** Verified in Suite 18 and Suite 19 assertions; confirmed 0 path leakage in live API responses.
- **Status:** **RESOLVED**

---

### BUG ID: BUG-007
- **Severity:** P3 — MEDIUM
- **Feature:** Call Reminder Alerts & Background Polling
- **Platform:** Web & Electron (Frontend Service)
- **File:** `src/services/reminders.ts`
- **Line:** 35–48
- **Problem:** Reminder polling query continued firing repeatedly after session expiration.
- **Root Cause:** TanStack Query default refetch interval did not inspect query error status codes.
- **Impact:** Expired sessions resulted in repetitive 401 errors logged to console every 15 seconds.
- **Reproduction:** Log out while on a page with active reminder alerts; observe background network activity.
- **Fix:** Added `retry: false` and `refetchInterval: false` guards in `useDueReminders()` when receiving 401 or 403 status codes.
- **Regression Risk:** None. Normal polling resumes upon re-authentication.
- **Verification:** Verified via live runtime script and automated smoke test assertions.
- **Status:** **RESOLVED**
