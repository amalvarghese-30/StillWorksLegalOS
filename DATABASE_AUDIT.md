# LEGALOS — COMPREHENSIVE DATABASE AUDIT & DATA MODEL REPORT

**Date:** October 2, 2026  
**Auditor:** Principal Database Architect & Data Engineer  
**Database Engine:** MongoDB 6.0+ / 7.0+ with Mongoose ODM  
**Target Database:** `stillworks_legalos`  

---

## 1. Executive Summary

Every Mongoose model, schema definition, index specification, and relationship was audited across the entire data layer.
The system maintains strict ACID sequencing for entity identifiers, referential integrity via cascade listeners and service synchronization, and comprehensive index coverage for high-throughput queries.

---

## 2. Model-by-Model Deep Audit

| Model | Collection | Primary Keys & Indexes | Foreign Keys / Relations | Concurrency / Integrity Controls |
| :--- | :--- | :--- | :--- | :--- |
| **Counter** | `counters` | `key: 1` (Unique) | None | Atomic sequence increments via `$inc: { seq: 1 }` with `new: true, upsert: true`. Race-condition free. |
| **Case** | `cases` | `number: 1` (Unique), text indexes on `(number, title, court, parties.name, courtCaseId)`, compound on `(status, priority, updatedAt)` | `parties.clientId` → `Client`, `assignedTo` → `User`, `createdBy` → `User` | Auto-generates `SW-YYYY-XXXX` in pre-validate hook using atomic Counter. Soft-delete archive lifecycle. |
| **Client** | `clients` | `email: 1` (Sparse, Unique), `phone: 1`, text indexes on `(name, email, phone, pan, aadhar)` | `assignedTo` → `User`, `createdBy` → `User` | Normalized phone numbers and email uniqueness. Sub-clients stored as structured subdocuments. |
| **Document** | `documents` | `name: "text"`, compound `(state: 1, createdAt: -1)`, `caseId: 1`, `clientId: 1` | `caseId` → `Case`, `clientId` → `Client`, `uploadedBy` → `User` | Linked client synchronization on party changes. File hash (`sha256`) recorded for integrity validation. |
| **Task** | `tasks` | `assignedTo: 1`, `status: 1`, `deadline: 1`, `caseId: 1`, `clientId: 1`, text on `(title, description, agent)` | `caseId` → `Case`, `clientId` → `Client`, `assignedTo` → `User`, `createdBy` → `User` | Subdocument checklist with atomic toggle. Auto-syncs call reminder documents on create/update/delete. |
| **Reminder** | `reminders` | `userId: 1`, `status: 1`, `scheduledAt: 1`, `sourceType: 1, sourceId: 1` | `userId` → `User`, polymorphic `sourceId` → `Task` or `CalendarEvent` | Atomic claim via `findOneAndUpdate` preventing duplicate alerts across concurrent scheduler workers. |
| **CalendarEvent** | `calendarevents`| `start: 1, end: 1`, `assignedTo: 1`, `caseId: 1`, `type: 1` | `caseId` → `Case`, `clientId` → `Client`, `assignedTo` → `[User]`, `createdBy` → `User` | Timezone-aware date parsing. Call reminder events cascade to the reminder engine. |
| **User** | `users` | `email: 1` (Unique), `phone: 1`, `role: 1`, `status: 1` | References in all models | Password hashed with `bcrypt` (cost 12). Safe JSON serialization strips `passwordHash`. |
| **Session** | `sessions` | `token: 1` (Index), `userId: 1`, TTL index on `expiresAt: 1` (86400s) | `userId` → `User` | Encrypted refresh token hash. Immediate invalidation on logout or password reset via `isRevoked: true`. |
| **AuditLog** | `auditlogs` | `createdAt: -1`, `userId: 1`, `resource: 1`, `resourceId: 1` | `userId` → `User` | Append-only audit trail with actor name, IP, user-agent, and non-fatal error isolation. |
| **ChatGroup** | `chatgroups` | `type: 1`, `members.userId: 1`, `updatedAt: -1` | `members.userId` → `User`, `createdBy` → `User` | Group membership enforcement. Unread count aggregations with composite indexing. |
| **ChatMessage** | `chatmessages`| `groupId: 1`, `createdAt: -1`, `readBy: 1` | `groupId` → `ChatGroup`, `sender` → `User` | Attachment records store logical paths. Soft-delete flags (`deletedForEveryone`, `deletedFor`). |
| **FileIntegrity**| `fileintegrities`| `documentId: 1`, `sha256: 1`, `status: 1` | `documentId` → `Document`, `uploadedBy` → `User` | Cryptographic file hashes compared periodically against physical disk bytes. |
| **AppSettings** | `appsettings` | `key: 1` (Unique) | `updatedBy` → `User` | Key-value firm configuration with schema validation for task options and system settings. |

---

## 3. Referential Integrity & Cascading Lifecycle

### A. Case ↔ Client ↔ Document Integrity
- **Party Association:** Adding a party to a case validates the `clientId` using `mongoose.Types.ObjectId.isValid` and queries the `Client` collection.
- **Document Re-parenting:** When a case's primary client changes, existing case documents with unassigned or outdated `clientId` automatically synchronize to the new client.
- **Party Removal:** Deleting a party from a case reconciles the case's remaining client parties with linked documents and records an audit log entry and timeline update.

### B. Task & Calendar ↔ Reminder Cascading
- **Creation:** Creating a Task with `callReminder` or a CalendarEvent with `type: "call_reminder"` calls `syncCallReminders()`, inserting a synchronized record for each assignee.
- **Assignment Changes:** When assignees are updated, unassigned users have their reminders cleanly purged (`userId: { $nin: userIds }`) while retained users preserve their reminder records.
- **Cascade Deletion:** When a Task or CalendarEvent is deleted, `deleteCallReminders(sourceType, sourceId)` deletes all associated reminder documents atomically.

### C. User Deletion & Session Cleanup
- **Session Revocation:** Deleting an employee or resetting an employee's password immediately updates all active sessions to `isRevoked: true` and severs active Socket.IO connections.

---

## 4. Indexing & Query Performance Audit

1. **Text Search Efficiency:**
   - Full-text indexes are mounted on high-cardinality search targets (`Case`: `number`, `title`, `court`, `parties.name`, `courtCaseId`; `Client`: `name`, `email`, `phone`, `pan`, `aadhar`).
2. **Compound Filtering:**
   - Compound indexes cover common UI sort/filter combinations (e.g. `(status, priority, updatedAt)` for case boards, `(state, createdAt)` for document approvals, `(assignedTo, status)` for task lists).
3. **Session TTL Index:**
   - `SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 })` offloads expired session cleanup to the MongoDB internal TTL thread, preventing unbounded database growth.

---

## 5. Conclusion

The database architecture is robust, indexed for scalable production workloads, protected against concurrent sequence collisions, and enforces referential integrity across all interconnected entities.
