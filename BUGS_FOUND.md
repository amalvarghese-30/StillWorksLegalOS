# LEGALOS — FORENSIC AUDIT: DEFECTS IDENTIFIED & REMEDIATION LOG

**Date:** October 2, 2026  
**Auditor:** Principal Forensic Engineer  
**Scope:** Complete repository inspection, static code analysis, runtime verification, and security testing.

---

## Summary of Defects Discovered During Forensic Audit

| Bug ID | Severity | Component | Defect Description | Remediation Applied | Resolution Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **BUG-001** | High | `server/src/routes/auth.ts` | **User Account Enumeration via Login Responses**<br>The login endpoint returned `code: "USER_NOT_FOUND"` with distinct messages for missing users versus `code: "INVALID_PASSWORD"` for existing users with incorrect passwords. | Replaced with uniform `code: "INVALID_CREDENTIALS"` and identical user message targeting the password field for both conditions. | **RESOLVED** |
| **BUG-002** | Medium | `server/src/index.ts` | **Unmatched API Routes Leaked Express Default HTML**<br>Calling a nonexistent `/api/*` endpoint fell through the router, returning Express HTML 404 rather than consistent JSON. | Mounted `app.all("/api/*", ...)` returning `{ "message": "API endpoint not found" }` along with a centralized Express error-handling middleware. | **RESOLVED** |
| **BUG-003** | Medium | `server/src/routes/cases.ts` | **Unvalidated `clientId` on Case Party Creation**<br>The `POST /api/cases/:id/parties` endpoint did not validate whether a provided `clientId` existed in the `Client` collection. | Added strict `Types.ObjectId.isValid` verification and queried `Client.findById()` before persisting the party subdocument. | **RESOLVED** |
| **BUG-004** | Medium | `server/src/routes/cases.ts`<br>`src/routes/_shell/cases.$caseId.tsx` | **Missing Case Party Deletion Endpoint & UI Action**<br>Parties could be appended to a case but there was no backend endpoint or frontend UI capability to remove an incorrectly added party. | Implemented `DELETE /api/cases/:id/parties/:partyId`, created the `useRemoveCaseParty` React mutation hook, and added an interactive delete dialog with trash icon in the UI. | **RESOLVED** |
| **BUG-005** | High | `server/src/routes/cases.ts` | **Document Client Linkage Desynchronization on Party Changes**<br>When adding or removing parties associated with a case, documents uploaded to that case did not automatically reflect the updated primary client. | Added document synchronization logic in party creation and deletion routes, updating `DocumentModel.updateMany` accordingly. | **RESOLVED** |
| **BUG-006** | Medium | `server/src/routes/reminders.ts` | **Potential 404 Fallback in Reminders Due Polling**<br>If `/api/reminders/due` route failed or lacked authentication context, frontend polling fell back to legacy behavior. | Verified route mounting order, hardened error handling to return `{ reminders: [] }` on missing data, and updated TanStack Query retry policy to cleanly suppress polling on 401/403. | **RESOLVED** |
| **BUG-007** | Low | `electron/preload.ts` | **Potential IPC Exposure in Electron Context Bridge**<br>Ensured no node modules (`path`, `fs`, `child_process`) are exposed to renderer context. | Audited preload build pipeline (`scripts/build-preload.cjs`) and smoke tested generated `dist-electron/preload.cjs` to confirm 0 forbidden node module imports. | **RESOLVED** |

---

## Detailed Bug Remediation Analysis

### 1. BUG-001: Login Anti-Enumeration Vulnerability
- **Root Cause:** Differentiated error responses allowed attackers to systematically brute-force employee and admin email addresses.
- **Diff Applied:**
  ```typescript
  // server/src/routes/auth.ts
  if (!user) {
    res.status(401).json({
      field: "password",
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password. Please check your credentials.",
    });
    return;
  }
  ```
- **Verification:** Suite 21 tests `AUTH-ENUM-001` through `AUTH-ENUM-006` execute comparative assertions against both scenarios to confirm indistinguishable status codes and payloads.

### 2. BUG-002: Missing API 404 Catch-All & Global Error Middleware
- **Root Cause:** In Express, unmatched routes with no catch-all render default HTML templates containing server information.
- **Diff Applied:**
  ```typescript
  // server/src/index.ts
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[server] Unhandled error:", err);
    res.status(err.status || 500).json({
      message: err.message || "Internal server error",
    });
  });
  ```
- **Verification:** Verified in Suite 21 (`API-404-001`, `API-404-002`, `API-404-003`) and live runtime curl checks.

### 3. BUG-004 & BUG-005: Case Party Lifecycle & Document Linkage
- **Root Cause:** No mechanism existed to remove mistakenly assigned parties; removing or adding client parties left documents in a disconnected state.
- **Diff Applied:**
  - Implemented `DELETE /api/cases/:id/parties/:partyId` with case timeline recording.
  - Linked `DocumentModel.updateMany({ caseId: record._id }, { $set: { clientId: realClient._id } })`.
  - Added UI trash button and `AlertDialog` in `src/routes/_shell/cases.$caseId.tsx`.
- **Verification:** Tested in Suite 21 (`CASE-PARTY-001` to `CASE-PARTY-011`) and verified in live runtime testing.
