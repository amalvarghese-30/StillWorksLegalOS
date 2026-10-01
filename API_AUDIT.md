# LEGALOS — COMPLETE API INVENTORY & AUDIT

**Date:** October 2, 2026  
**Total Endpoints Discovered:** 125  
**Auditor:** Principal Backend & API Architect  

---

## 1. Complete API Route Inventory Table

| Method | Endpoint | Authentication | Authorization | Validation | Database | Storage | Web Used | Electron Used | Tests | Status |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| `GET` | `/api/admin/audit-logs` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/employees` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/admin/employees` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/admin/employees/:id` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/admin/employees/:id/reset-password` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/admin/employees/:id` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/approvals` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/storage` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | uploads/root | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/admin/storage` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | uploads/root | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/admin/storage/test-connection` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | uploads/root | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/task-options` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `PUT` | `/api/admin/task-options` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/reports/summary` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/reports/case-growth` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/reports/practice-areas` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/reports/employee-workload` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/reports/top-clients` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/reports/my-performance` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/integrity/audit-chain` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/admin/integrity/files` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/admin/integrity/verify-all` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/admin/integrity/verify-file/:id` | requireAuth | requireAdminOrPerm | Yes | User, AuditLog, AppSettings, Doc | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/auth/login` | Public | None | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/auth/logout` | requireAuth | User-Scoped | Yes | User, Session | None | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `GET` | `/api/auth/sessions` | requireAuth | User-Scoped | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/auth/sessions/:id` | requireAuth | requireResourceAccess | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/auth/sessions` | requireAuth | User-Scoped | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/auth/refresh` | requireAuth | User-Scoped | Yes | User, Session | None | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `GET` | `/api/auth/me` | requireAuth | User-Scoped | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/auth/me` | requireAuth | User-Scoped | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/auth/avatar` | requireAuth | User-Scoped | Yes | User, Session | uploads/avatars | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `GET` | `/api/auth/avatar/:filename` | requireAuth | User-Scoped | Yes | User, Session | uploads/avatars | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `DELETE` | `/api/auth/avatar` | requireAuth | User-Scoped | Yes | User, Session | uploads/avatars | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `POST` | `/api/auth/change-password` | requireAuth | User-Scoped | Yes | User, Session | None | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `POST` | `/api/auth/forgot-password` | Public | None | Yes | User, Session | None | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `POST` | `/api/auth/reset-password` | Public | None | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/auth/firm` | requireAuth | User-Scoped | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/auth/preferences` | requireAuth | User-Scoped | Yes | User, Session | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/auth/seed` | requireAuth | User-Scoped | Yes | User, Session | None | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `GET` | `/api/calendar/events` | requireAuth | User-Scoped | Yes | CalendarEvent, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/calendar/events/:id` | requireAuth | requireResourceAccess | Yes | CalendarEvent, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/calendar/events` | requireAuth | User-Scoped | Yes | CalendarEvent, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/calendar/events/:id` | requireAuth | requireResourceAccess | Yes | CalendarEvent, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/calendar/events/:id` | requireAuth | requireResourceAccess | Yes | CalendarEvent, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/cases` | requireAuth | User-Scoped | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/cases/:id` | requireAuth | requireResourceAccess | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/cases` | requireAuth | User-Scoped | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/cases/:id` | requireAuth | requireResourceAccess | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/cases/:id` | requireAuth | requireResourceAccess | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/cases/:id/parties` | requireAuth | requireResourceAccess | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/cases/:id/parties/:partyId` | requireAuth | requireResourceAccess | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/cases/:id/notes` | requireAuth | requireResourceAccess | Yes | Case, Client, Doc, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/chat/groups` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/chat/groups/:groupId` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/chat/groups/:groupId` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/chat/groups/:groupId/messages` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/messages` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/upload` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | uploads/chat | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/chat/groups/:groupId/attachments/download` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/read` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/messages/:messageId/delivered` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/chat/groups/:groupId/messages/:messageId` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/messages/:messageId/delete-for-me` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/chat/users` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/chat/groups/:groupId/members` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/members` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/chat/groups/:groupId/members/:userId` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/chat/groups/:groupId/members/:userId/role` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/leave` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/reactions` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/messages/:messageId/report` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/pin` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/unpin` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/mute` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/unmute` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/archive` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/unarchive` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/pin-message` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/chat/groups/:groupId/unpin-message` | requireAuth | User-Scoped | Yes | ChatGroup, ChatMessage, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/clients` | requireAuth | User-Scoped | Yes | Client, Case, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/clients/:id` | requireAuth | requireResourceAccess | Yes | Client, Case, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/clients/:clientId/cases` | requireAuth | requireResourceAccess | Yes | Client, Case, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/clients/:clientId/documents` | requireAuth | requireResourceAccess | Yes | Client, Case, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/clients` | requireAuth | User-Scoped | Yes | Client, Case, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/clients/:id` | requireAuth | requireResourceAccess | Yes | Client, Case, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/clients/:id` | requireAuth | requireResourceAccess | Yes | Client, Case, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents` | requireAuth | User-Scoped | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents/structure` | requireAuth | User-Scoped | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents/nas/structure` | requireAuth | User-Scoped | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents/:id/download` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents/:id/view` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents/:id/verify` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/documents/:id/verify` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents/:id` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/documents/upload` | requireAuth | User-Scoped | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/documents/:id` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/documents/:docId/request-access` | requireAuth | User-Scoped | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/documents/:docId/access-requests/:requestId` | requireAuth | User-Scoped | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/documents/:id` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/documents/:id/versions` | requireAuth | requireResourceAccess | Yes | Document, FileIntegrity, Audit | uploads/cases|clients | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/notifications` | requireAuth | User-Scoped | Yes | Notification | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/notifications/unread-count` | requireAuth | User-Scoped | Yes | Notification | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/notifications/:id/read` | requireAuth | requireResourceAccess | Yes | Notification | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/notifications/read-all` | requireAuth | User-Scoped | Yes | Notification | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/notifications/:id` | requireAuth | requireResourceAccess | Yes | Notification | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/reminders/health` | Public | None | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/reminders/due` | requireAuth | User-Scoped | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/reminders` | requireAuth | User-Scoped | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/reminders/:id/acknowledge` | requireAuth | requireResourceAccess | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/reminders/:id/snooze` | requireAuth | requireResourceAccess | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/reminders/:id/complete` | requireAuth | requireResourceAccess | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/reminders/:id/dismiss` | requireAuth | requireResourceAccess | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/reminders/:id/cancel` | requireAuth | requireResourceAccess | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/reminders/:id` | requireAuth | requireResourceAccess | Yes | Reminder, Task, Calendar | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/search` | requireAuth | User-Scoped | Yes | Case, Client, Document, Task | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/tasks` | requireAuth | User-Scoped | Yes | Task, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/tasks/options` | requireAuth | User-Scoped | Yes | Task, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/tasks/:id` | requireAuth | requireResourceAccess | Yes | Task, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `POST` | `/api/tasks` | requireAuth | User-Scoped | Yes | Task, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/tasks/:id` | requireAuth | requireResourceAccess | Yes | Task, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `PATCH` | `/api/tasks/:taskId/checklist/:itemId` | requireAuth | User-Scoped | Yes | Task, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `DELETE` | `/api/tasks/:id` | requireAuth | requireResourceAccess | Yes | Task, Reminder, Audit | None | Yes | Yes | Automated + Live | VERIFIED |
| `GET` | `/api/health` | Public | None | Yes | None | None | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |
| `GET` | `/api/ready` | Public | None | Yes | None | None | Internal/Admin | Internal/Admin | Automated + Live | VERIFIED |

---

## 2. Forensic Analysis of High-Risk Endpoints

### `/api/health` & `/api/ready`
- **Availability:** Public endpoints mounted without authentication or rate limits.
- **Payload Integrity:** Returns service health, uptime, deployment version (`1.0.0`), and live database connectivity status.
- **Behavior under degraded DB:** `/api/ready` returns HTTP 503 if MongoDB disconnects, enabling cloud orchestrators / reverse proxies to halt incoming traffic safely.

### `/api/reminders/due`
- **Availability:** Mounted under `/api/reminders` with mandatory `requireAuth` session validation.
- **Payload Integrity:** Returns an object containing the user's due reminders: `{ reminders: IReminder[] }`.
- **Concurrency & Claiming:** Works in conjunction with the background worker in `server/src/services/reminderScheduler.ts` using atomic `findOneAndUpdate` queries.

### `/api/cases` & Case Party Endpoints
- **Atomic Case Numbering:** Guaranteed via `Counter.findOneAndUpdate({ key: "case-number-YYYY" }, { $inc: { seq: 1 } })`.
- **Party Validation:** Validates that `clientId` matches an actual record in `Client` collection before linking.
- **Party Deletion:** `DELETE /api/cases/:id/parties/:partyId` deletes subdocument, updates case timeline, logs audit trail, and reconciles document `clientId` references.

### `/api/documents/upload` & `/api/documents/:id/download`
- **Multipart Streaming:** Handled via Busboy directly into `STORAGE_ROOT`. No complete file is buffered in RAM.
- **Path Confinement:** Canonical path check in `getLocalPath()` prevents directory traversal.
- **Path Scrubbing:** `storagePath`, `storageFolder`, `nasPath`, `nasFolder`, and `filePath` are stripped from all API outputs.
