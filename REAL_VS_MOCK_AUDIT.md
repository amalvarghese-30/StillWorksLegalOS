# LEGALOS — REAL FUNCTIONALITY VS. MOCKS AUDIT

**Date:** October 2, 2026  
**Auditor:** Principal Forensic Engineer  
**Scope:** Repository-wide audit of all business operations, data flows, storage mechanisms, and notifications to verify genuine persistence versus simulated/mock logic.

---

## 1. Classification Methodology

Every functional module was evaluated across the entire stack (UI → Service → Backend Router → Database → Storage) and classified into one of five categories:
- **REAL:** Fully implemented end-to-end with persistent database storage, server-side validation, authentication, and state management.
- **MOCK:** Simulated response or in-memory stub substituting for a real backend service.
- **DEMO:** UI-only interactive mock or hardcoded demonstration flow.
- **TEST-ONLY:** Mocks, fixtures, or test utilities restricted exclusively to automated test suites.
- **DEAD CODE:** Unused stubs, abandoned functions, or obsolete legacy references.

---

## 2. Feature Classification Table

| Feature / Subsystem | Trace Path | Classification | Detailed Forensic Finding |
| :--- | :--- | :---: | :--- |
| **User Authentication** | `Login Form` → `POST /api/auth/login` → `User.findOne()` + `bcrypt.compare()` → `JWT & Refresh Hash` | **REAL** | Genuine password verification using bcrypt cost factor 12. Generates genuine cryptographic tokens. Revokes sessions on logout. |
| **Password Reset OTP** | `Forgot Password` → `POST /api/auth/forgot-password` → `Crypto OTP` → `User.resetOtpHash` → `Verify OTP` | **REAL** | Generates 6-digit random crypto token, stores bcrypt hash with 15-minute TTL, and enforces rate limiting. |
| **Case Number Generation** | `Create Case` → `CaseSchema.pre('validate')` → `Counter.findOneAndUpdate($inc)` | **REAL** | Monotonically increments database sequence counter (`SW-YYYY-XXXX`). No client-generated or dummy numbers. |
| **Case Lifecycle & Notes** | `Case Details` → `POST /api/cases/:id/notes` → `Case.notes.push()` + `AuditLog` | **REAL** | Genuine persistence in MongoDB `cases` collection with populated user attribution. |
| **Case Party Management** | `Case Details` → `POST/DELETE /api/cases/:id/parties` → `Case.parties` + `Doc Sync` | **REAL** | Validates `clientId` foreign key, updates subdocument array, logs timeline events, and syncs linked documents. |
| **Client Management** | `Client List` → `POST /api/clients` → `Client.create()` → `MongoDB Index` | **REAL** | Full CRUD with duplicate email checks, phone normalization, and associated case counts. |
| **Document Uploads** | `Upload Modal` → `POST /api/documents/upload` → `busboy` → `StorageService` → Disk | **REAL** | Direct streaming to filesystem storage (`STORAGE_ROOT`). SHA-256 computed on the fly. No mock uploads or in-memory blobs. |
| **Document Previews** | `Preview Modal` → `GET /api/documents/:id/view` → `StorageService.streamFile()` → Res | **REAL** | Verified for PDF, PNG, JPG, WEBP, TXT, CSV. Streamed with strict Content-Disposition and security headers. |
| **Document Versioning** | `Upload New Version` → Increments `version` → `StorageService` → History Array | **REAL** | Maintains immutable historical versions in filesystem storage and database metadata. |
| **Task Management** | `Task Board` → `POST /api/tasks` → `Task.create()` → `Checklist` + `Audit` | **REAL** | Persistent task records with checklists, priorities, deadline filters, and agent tracking. |
| **Call Reminders** | `Task/Event` → `syncCallReminders()` → `Reminder.create()` → `Socket.IO` + Polling | **REAL** | Genuine multi-user reminder persistence. Atomic claim via `findOneAndUpdate`. Real-time socket emission and catch-up polling. |
| **Calendar System** | `Calendar View` → `POST /api/calendar/events` → `CalendarEvent.create()` → Sync | **REAL** | Persistent calendar events with timezone support. Auto-syncs call reminder events to the reminder engine. |
| **Realtime Chat** | `Chat Screen` → `POST /api/chat/groups/:id/messages` → `ChatMessage` → `Socket.IO` | **REAL** | Real-time broadcast to room members, unread message counts, delivered/read receipts, and persistent attachment storage. |
| **User Avatars** | `Settings` → `POST /api/auth/me/avatar` → `StorageService` → Disk → Streaming | **REAL** | Image MIME validation, size caps (5MB), saved to `STORAGE_ROOT/avatars/<userId>/`, streamed via authenticated route. |
| **Audit Logging** | System actions → `AuditLog.logWithActivity()` → `auditlogs` collection + Socket | **REAL** | Immutable audit trail with actor name, IP, action, resource, and timestamp. |
| **Admin Reports** | `Reports Dashboard` → `GET /api/admin/reports/*` → MongoDB Aggregation Pipelines | **REAL** | Computed dynamically from live cases, tasks, clients, and documents. No hardcoded or dummy report statistics. |
| **Global Search** | `Search Bar` → `GET /api/search?q=...` → MongoDB Text Indexes & Regex Queries | **REAL** | Live search across cases, clients, documents, and tasks with BOLA authorization filtering. |
| **Test Fixtures (Mocks)** | `server/src/tests/run-tests.ts` | **TEST-ONLY** | Mock file buffers (e.g. `%PDF-1.4 Mock PDF Content`) used exclusively within automated regression tests. |
| **WebDAV Stub** | `server/src/services/webdav.ts` | **DEAD CODE** | 20-line compatibility re-export left from legacy NAS deprecation; not imported by any server component. |

---

## 3. Detailed Audit of Potential Mock Vectors

### A. Dashboard Statistics & Counters
- **Investigation:** Examined `server/src/routes/admin.ts` (`/reports/summary`, `/reports/case-growth`, `/reports/practice-areas`, `/reports/employee-workload`, `/reports/top-clients`) and `src/services/reports.ts`.
- **Finding:** Every metric is computed dynamically via MongoDB queries:
  - `Client.countDocuments()`
  - `Case.countDocuments({ status: { $ne: "Archived" } })`
  - `Task.countDocuments({ status: "completed" })`
  - `DocumentModel.countDocuments({ state: "Approved" })`
- **Verdict:** **100% REAL**. Zero fake numbers or hardcoded dashboard metrics.

### B. File Uploads & Downloads
- **Investigation:** Examined `server/src/routes/documents.ts`, `server/src/routes/chat.ts`, and `server/src/services/storage.ts`.
- **Finding:** Uploaded files are written directly to disk via Node.js readable streams piped into `fs.createWriteStream`. File downloads and inline previews stream directly from physical disk via `fs.createReadStream`.
- **Verdict:** **100% REAL**. Zero setTimeout-based fake progress or mock storage.

### C. Search Subsystem
- **Investigation:** Examined `server/src/routes/search.ts` and `src/lib/search.ts`.
- **Finding:** The `/api/search` route runs real MongoDB `$regex` and text index queries across `Case`, `Client`, `DocumentModel`, and `Task` collections, filtering results by the user's role and case access permissions.
- **Verdict:** **100% REAL**.

---

## 4. Conclusion

There are **zero production mocks, zero placeholder data sources, and zero simulated APIs** in the LegalOS production runtime. All workflows interact with live database collections and application filesystem storage.
