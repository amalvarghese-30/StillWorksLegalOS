# LEGALOS — REMEDIATION PLAN & POST-RELEASE ROADMAP

**Date:** October 2, 2026  
**Auditor:** Principal Software Engineer & Architect  
**Scope:** Remediation completed during audit and forward-looking operational recommendations.

---

## 1. Audit Remediations Completed (Current Release)

The following corrective actions were identified and implemented during the forensic audit:

1. **Authentication Uniformity:**
   - Updated `server/src/routes/auth.ts` to return uniform `{ field: "password", code: "INVALID_CREDENTIALS", message: "..." }` on all authentication failures, eliminating user enumeration vectors.
2. **API 404 & Error Handling:**
   - Mounted `app.all("/api/*", ...)` in `server/src/index.ts` to ensure unmatched routes return `{ message: "API endpoint not found" }` in JSON format.
   - Added global error middleware capturing unhandled exceptions and returning structured JSON.
3. **Case Party Management & Document Synchronization:**
   - Validated `clientId` against the MongoDB database in `POST /api/cases/:id/parties`.
   - Added `DELETE /api/cases/:id/parties/:partyId` with audit trail and timeline recording.
   - Automatically updated `DocumentModel.clientId` for all case documents when parties change.
   - Added frontend party removal button and confirmation modal in `src/routes/_shell/cases.$caseId.tsx`.
4. **Test Expansion:**
   - Added Suite 21 to `server/src/tests/run-tests.ts`, expanding automated test coverage from 234 to 245 tests.

---

## 2. Post-Release Operational Recommendations

While the application is fully functional and production-ready for its current scope, the following enhancements are recommended for future releases:

### A. Large File Upload Handling (Chunked / Resumable)
- **Current State:** Direct multipart streaming via `multer` handles files up to 100 MB.
- **Future Enhancement:** For cases with massive evidence bundles (several gigabytes), implement chunked resumable uploads (e.g., TUS protocol) with client-side SHA-256 integrity validation.

### B. Automated Virus & Malware Scanning
- **Current State:** MIME-type validation and file extension checks are enforced on all uploads.
- **Future Enhancement:** Integrate ClamAV or a cloud scanning daemon in the VPS storage pipeline to scan uploaded documents before making them available for download.

### C. Automated Database Backups & Offsite Replication
- **Current State:** Storage and MongoDB run on the host system.
- **Future Enhancement:** Implement an automated cron script for daily mongodump with GPG encryption and replication to an offsite S3-compatible cold storage bucket.

### D. Electron Auto-Updater Integration
- **Current State:** Packaged Electron executable built for Windows x64.
- **Future Enhancement:** Configure `electron-updater` with a GitHub Releases or private S3 endpoint for seamless background updates.
