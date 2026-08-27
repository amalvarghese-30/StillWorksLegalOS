# SECURITY REMEDIATION PLAN — StillWorks LegalOS

**Created:** 2026-08-18  
**Based on:** Complete Security Audit (3.5/10 overall score)  
**Goal:** Production-ready desktop application for law office deployment

---

## VERIFICATION STATUS

All findings from the audit have been verified against the actual source code. Confirmed status:

| ID | Finding | Severity | Verified | File/Location |
|----|---------|----------|----------|---------------|
| SWL-001 | Seed endpoint creates admin accounts | CRITICAL | ✅ | `server/src/routes/auth.ts:258-345` |
| SWL-002 | Socket.IO room auth bypass (chat:join) | CRITICAL | ✅ | `server/src/index.ts:172-179` |
| SWL-003 | REST chat messages IDOR (no membership) | CRITICAL | ✅ | `server/src/routes/chat.ts:134-154` |
| SWL-004 | REST chat read receipt IDOR | CRITICAL | ✅ | `server/src/routes/chat.ts:213-225` |
| SWL-005 | REST chat send message IDOR | CRITICAL | ✅ | `server/src/routes/chat.ts:160-207` |
| SWL-006 | JWT default secret "dev-secret-change-me" | CRITICAL | ✅ | `server/src/middleware/auth.ts:6`, `server/src/index.ts:38` |
| SWL-007 | MongoDB URI defaults to localhost no auth | CRITICAL | ✅ | `server/.env.example:6`, `server/src/index.ts:39-40` |
| SWL-008 | NAS path traversal in document upload | CRITICAL | ✅ | `server/src/routes/documents.ts:125,144-145` |
| SWL-009 | Socket.IO events allowed pre-auth | HIGH | ✅ | `server/src/index.ts:138-200` |
| SWL-010 | Socket.IO no Session DB validation on reconnect | HIGH | ✅ | `server/src/index.ts:143-169` |
| SWL-011 | REST requireAuth no session revocation check | HIGH | ✅ | `server/src/middleware/auth.ts:35-68` |
| SWL-012 | Weak password policy (6 chars only) | HIGH | ✅ | `server/src/routes/auth.ts:152-155` |
| SWL-013 | 7-day JWT, no refresh rotation | HIGH | ✅ | `server/src/middleware/auth.ts:112-116` |
| SWL-014 | localStorage token storage (XSS) | HIGH | ✅ | `src/services/api.ts:15-25` |
| SWL-015 | CORS allows localhost:* wildcard | HIGH | ✅ | `server/src/index.ts:46-74,110-129` |
| SWL-016 | No rate limiting on auth endpoints | HIGH | ✅ | `server/src/routes/auth.ts:13-66` |
| SWL-017 | Admin role check not on all admin routes | HIGH | ✅ | `server/src/routes/admin.ts:57-75` |
| SWL-018 | Direct chat creation no user validation | HIGH | ✅ | `server/src/routes/chat.ts:43-95` |
| SWL-019 | Regex DoS via search parameters | HIGH | ✅ | `server/src/routes/clients.ts:32-60`, `cases.ts:31-52` |
| SWL-020 | PII in audit log details field | HIGH | ✅ | `server/src/models/AuditLog.ts`, `seed.ts:922` |
| SWL-021 | Chat messages no length limit | MEDIUM | ✅ | `server/src/routes/chat.ts:162-166` |
| SWL-022 | Chat group name no length/sanitization | MEDIUM | ✅ | `server/src/routes/chat.ts:47-50` |
| SWL-023 | Socket.IO no rate limiting | MEDIUM | ✅ | `server/src/index.ts:172-189` |
| SWL-024 | WebSocket no connection limits | MEDIUM | ✅ | `server/src/index.ts:108-129` |
| SWL-025 | Password change revokes current session | MEDIUM | ✅ | `server/src/routes/auth.ts:172-173` |
| SWL-026 | User status not updated on socket disconnect | MEDIUM | ✅ | `server/src/index.ts:192-199`, `auth.ts:53-56` |
| SWL-027 | Chat mentions not validated for group membership | MEDIUM | ✅ | `server/src/routes/chat.ts:162-184` |
| SWL-028 | Documents no file type/size validation | MEDIUM | ✅ | `server/src/routes/documents.ts:115-165` |
| SWL-029 | Documents accessRequests unbounded growth | MEDIUM | ✅ | `server/src/models/Document.ts:26-31` |
| SWL-030 | Calendar no authorization checks | MEDIUM | ✅ | `server/src/routes/calendar.ts` |
| SWL-031 | Tasks no authorization checks | MEDIUM | ✅ | `server/src/routes/tasks.ts` |
| SWL-032 | Clients no authorization checks | MEDIUM | ✅ | `server/src/routes/clients.ts` |
| SWL-033 | Cases no authorization checks | MEDIUM | ✅ | `server/src/routes/cases.ts` |
| SWL-034 | Employees list no pagination enforcement | MEDIUM | ✅ | `server/src/routes/admin.ts:65-66` |
| SWL-035 | Audit logs no retention/archival policy | MEDIUM | ✅ | `server/src/models/AuditLog.ts` |
| SWL-036 | Session TTL index 24h grace period | MEDIUM | ✅ | `server/src/models/Session.ts:54` |
| SWL-037 | .env may be committed | MEDIUM | ✅ | `server/.env.example`, `.gitignore` |
| SWL-038 | JWT algorithm not explicitly enforced | LOW | ✅ | `server/src/middleware/auth.ts:46,113` |
| SWL-039 | MongoDB TLS not enforced | LOW | ✅ | `server/src/db.ts` |
| SWL-040 | Error stack traces leak internals | LOW | ✅ | All route files |
| SWL-041 | Health endpoint info disclosure | LOW | ✅ | `server/src/index.ts:86-92` |
| SWL-042 | User enumeration via login timing | LOW | ✅ | `server/src/routes/auth.ts:23-31` |
| SWL-043 | Socket.IO activity event no validation | LOW | ✅ | `server/src/index.ts:181-190` |
| SWL-044 | Seed script hardcoded passwords | LOW | ✅ | `server/src/seed.ts:30` |
| SWL-045 | Document state no transition validation | LOW | ✅ | `server/src/routes/documents.ts:171-187` |
| SWL-046 | Case number generation race condition | LOW | ✅ | `server/src/models/Case.ts:164-171` |
| SWL-047 | WebSocket CORS allows null origin | LOW | ✅ | `server/src/index.ts:112-122` |
| SWL-048 | Frontend API base hardcoded localhost | LOW | ✅ | `src/services/api.ts:9` |
| SWL-049 | Electron not implemented | CRITICAL | ✅ | No `electron/` directory |
| SWL-050 | IPC not implemented | CRITICAL | ✅ | No `electron/preload.js` |
| SWL-051 | asar: false in build config | HIGH | ✅ | `package.json:107` |
| SWL-052 | .env in extraFiles | CRITICAL | ✅ | `package.json:114-119` |
| SWL-053 | No code signing | HIGH | ✅ | `package.json:131` |

---

## REMEDIATION ROADMAP

### PHASE 0 — SECRETS PROTECTION (Days 1-2)
*Must complete before any other work*

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P0-1 | Audit all `.env` files, `.gitignore`, ensure no secrets committed | ⬜ | `git log --all --oneline --grep="secret\|password\|token"` = 0 |
| P0-2 | Remove real `.env` from repo if present; add to `.gitignore` | ⬜ | File not tracked |
| P0-3 | Rotate any exposed credentials (MongoDB, JWT secret) | ⬜ | New credentials generated |
| P0-4 | Update `.env.example` with placeholder-only values | ⬜ | No real values |

---

### PHASE 1 — CRITICAL BACKDOOR REMOVAL (Days 2-3)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P1-1 | Remove or guard `POST /api/auth/seed` endpoint | ⬜ | `POST /api/auth/seed` returns 403 in production |
| P1-2 | Add production startup guard: fail if `JWT_SECRET` uses default | ⬜ | Server exits with error if default secret detected |
| P1-3 | Remove hardcoded `admin123`, `employee123`, `password123` from seed | ⬜ | No default passwords in source |
| P1-4 | Implement secure one-time initialization script (CLI-only) | ⬜ | `npm run setup:production` works |

---

### PHASE 2 — JWT & SESSION SECURITY (Days 3-5)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P2-1 | Remove default JWT secret; require `JWT_SECRET` env var | ⬜ | Startup fails without `JWT_SECRET` |
| P2-2 | Enforce explicit `HS256` algorithm in `jwt.verify()` | ⬜ | Algorithm confusion attack blocked |
| P2-3 | Implement short-lived access tokens (15-30 min) + refresh tokens | ⬜ | Access token expires in 15 min; refresh rotates |
| P2-4 | Store refresh tokens hashed in DB (bcrypt) | ⬜ | DB stores hash, not raw token |
| P2-5 | Add Session DB validation in `requireAuth` middleware | ⬜ | Revoked session = 401 immediately |
| P2-6 | Add Session DB validation in Socket.IO auth middleware | ⬜ | Revoked session = socket disconnect |
| P2-7 | Fix password change: revoke all *except* current session | ⬜ | User stays logged in after password change |
| P2-8 | Add session limits (max concurrent sessions per user) | ⬜ | 5th login revokes oldest |
| P2-9 | Add device fingerprinting/binding to sessions | ⬜ | New device requires re-auth |

---

### PHASE 3 — CHAT SECURITY: COMPLETE OVERHAUL (Days 5-8)
**HIGHEST PRIORITY — Chat handles confidential legal communications**

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P3-1 | Add membership check to `GET /groups/:groupId/messages` | ⬜ | User A cannot `GET` User B's chat messages |
| P3-2 | Add membership check to `POST /groups/:groupId/messages` | ⬜ | User A cannot send to User B's chat |
| P3-3 | Add membership check to `POST /groups/:groupId/read` | ⬜ | User A cannot mark User B's chat read |
| P3-4 | Derive `sender`, `senderName`, `senderInitials` server-side only | ⬜ | Client-provided sender fields ignored |
| P3-5 | Implement Socket.IO authentication middleware (`io.use()`) | ⬜ | Unauthenticated socket cannot emit `chat:join` |
| P3-6 | Add room authorization: validate membership before `socket.join()` | ⬜ | User A cannot join User B's direct chat room |
| P3-7 | Add Session DB validation on Socket.IO handshake | ⬜ | Revoked token = socket disconnect |
| P3-8 | Disconnect socket if session revoked during connection | ⬜ | Logout = immediate socket disconnect |
| P3-9 | Validate mentions: only group members can be mentioned | ⬜ | Mention non-member = ignored/rejected |
| P3-10 | Add message length limit (configurable, default 10k chars) | ⬜ | 10,001 char message = 400 |
| P3-11 | Add group name length limit + sanitization | ⬜ | 101 char name = 400; control chars stripped |
| P3-12 | Add Socket.IO rate limiting (events/sec, connections/IP) | ⬜ | Flood = 429 / disconnect |
| P3-13 | Add per-user socket connection limit (e.g., 5) | ⬜ | 6th connection = oldest disconnected |
| P3-14 | Replace offset pagination with cursor-based for messages | ⬜ | 100k messages = fast pagination |
| P3-15 | Remove redundant polling where Socket.IO provides real-time | ⬜ | Message polling interval increased / removed |
| P3-16 | Fix N+1 unread count with aggregation pipeline | ⬜ | 50 groups × 1 query = 1 query |
| P3-17 | Add Redis adapter for Socket.IO horizontal scaling (optional) | ⬜ | Multi-server chat works |

---

### PHASE 4 — RESOURCE-LEVEL AUTHORIZATION (Days 8-12)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P4-1 | Create centralized authorization helpers module | ⬜ | `requireCaseAccess()`, `requireDocumentAccess()`, etc. |
| P4-2 | Define `AUTHORIZATION_MATRIX.md` with business rules | ⬜ | Documented and approved |
| P4-3 | Implement Document authorization (case/owner/team) | ⬜ | Unauthorized = 403 |
| P4-4 | Implement Case authorization (assignedTo/parties/admin) | ⬜ | Unauthorized = 403 |
| P4-5 | Implement Client authorization (assigned/team/admin) | ⬜ | Unauthorized = 403 |
| P4-6 | Implement Task authorization (assignedTo/createdBy/admin) | ⬜ | Unauthorized = 403 |
| P4-7 | Implement Calendar authorization (assignedTo/creator/admin) | ⬜ | Unauthorized = 403 |
| P4-8 | Apply helpers to ALL endpoints (GET, POST, PATCH, DELETE) | ⬜ | No endpoint skips authorization |

---

### PHASE 5 — NAS SECURITY IMPLEMENTATION (Days 12-16)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P5-1 | Implement `resolveAuthorizedNasPath()` centralized function | ⬜ | Path traversal attempts blocked |
| P5-2 | Define `NAS_ROOT` configuration, reject paths outside | ⬜ | `../` `C:\` `\\OTHER\` all rejected |
| P5-3 | Add MIME allowlist, file size limit, extension validation | ⬜ | `.exe` rejected; 500MB limit enforced |
| P5-4 | Move NAS credentials to Windows Credential Manager (or OS equivalent) | ⬜ | No credentials in `.env`, code, or build |
| P5-5 | Implement least-privilege NAS service account | ⬜ | Service account only accesses `LegalOS` share |
| P5-6 | Add SMB3 signing + encryption enforcement | ⬜ | Connection fails if signing/encryption disabled |
| P5-7 | Add NAS failure handling (timeouts, retries, user errors) | ⬜ | NAS down = graceful error, not crash |
| P5-8 | Remove mock NAS structure; use real SMB integration | ⬜ | Real NAS operations work |

---

### PHASE 6 — ELECTRON IMPLEMENTATION (Days 16-22)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P6-1 | Create `electron/main.js` with secure `BrowserWindow` config | ⬜ | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` |
| P6-2 | Create `electron/preload.js` with narrow IPC APIs | ⬜ | No `fs`, `shell`, `child_process` exposed |
| P6-3 | Implement secure IPC handlers with validation | ⬜ | `nas:openPath` validates against allowlist |
| P6-4 | Move token storage from localStorage to secure IPC (OS keychain) | ⬜ | Token not accessible from renderer |
| P6-5 | Implement CSP header (restrictive, no unsafe-inline/eval) | ⬜ | CSP violations = blocked |
| P6-6 | Restrict navigation to trusted origins only | ⬜ | External links open in system browser |
| P6-7 | Implement auto-update with signature verification (or document manual update) | ⬜ | Unsigned update rejected |
| P6-8 | Configure `asar: true`, remove `.env` from `extraFiles` | ⬜ | Source not readable in `resources/app.asar` |
| P6-9 | Configure Windows code signing | ⬜ | Installer has valid signature |
| P6-10 | Test complete Electron app launch and functionality | ⬜ | `npm run dist` produces working `.exe` |

---

### PHASE 7 — NETWORK & INFRASTRUCTURE HARDENING (Days 22-25)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P7-1 | Configure server bind: `127.0.0.1` for single-workstation; document LAN deployment with TLS | ⬜ | Server not accessible from LAN without TLS |
| P7-2 | Implement TLS for Express API (self-signed for LAN, proper cert for prod) | ⬜ | `https://localhost:3001` works |
| P7-3 | Implement WSS for Socket.IO | ⬜ | `wss://` connections only |
| P7-4 | Restrict CORS to exact origins (no wildcards) | ⬜ | `app://.`, `http://localhost:5173` only |
| P7-5 | Configure MongoDB Atlas with TLS, IP allowlist, auth | ⬜ | Localhost URI rejected in production |
| P7-6 | Add security headers (Helmet or equivalent) | ⬜ | CSP, HSTS, X-Frame-Options present |
| P7-7 | Add centralized rate limiting (login, API, Socket, search) | ⬜ | 5 login attempts/15min = 429 |

---

### PHASE 8 — DATA INTEGRITY & VALIDATION (Days 25-28)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P8-1 | Fix case number race condition with atomic counter | ⬜ | 100 concurrent creates = no duplicates |
| P8-2 | Add bounds to unbounded arrays: `readBy`, `accessRequests`, `mentions` | ⬜ | Array > 1000 = error |
| P8-3 | Fix regex DoS: replace user-controlled regex with `$text` or safe escape + length limit | ⬜ | `a*a*a*` = 400, not DoS |
| P8-4 | Add Zod validation schemas for all API inputs | ⬜ | Invalid payload = 400 with details |
| P8-5 | Add document state transition validation (Draft→Pending→Approved/Rejected) | ⬜ | Invalid transition = 400 |
| P8-6 | Replace hardcoded health endpoint with minimal response | ⬜ | No uptime/version disclosure |
| P8-7 | Sanitize error responses: no stack traces, no internal paths | ⬜ | 500 = `{ message: "Internal server error" }` |

---

### PHASE 9 — AUDIT LOGGING & PRIVACY (Days 28-30)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P9-1 | Remove PII from audit log `details` field (structured logging) | ⬜ | No Aadhar, PAN, client names in details |
| P9-2 | Add tamper-evident audit log (hash chaining) | ⬜ | Modified log = detected |
| P9-3 | Define retention policies for all data categories | ⬜ | Documented in `docs/DATA_RETENTION.md` |
| P9-4 | Encrypt sensitive fields at rest (Aadhar, PAN, chat messages) | ⬜ | MongoDB field-level encryption |

---

### PHASE 10 — TESTING & PRODUCTION BUILD (Days 30-35)

| ID | Task | Status | Tests |
|----|------|--------|-------|
| P10-1 | Create security regression test suite (all Critical/High findings) | ⬜ | All tests pass |
| P10-2 | Create two-user authorization test matrix | ⬜ | Employee A cannot access Employee B data |
| P10-3 | Create chat security test matrix (unauth, wrong-user, revoked, valid) | ⬜ | All scenarios pass |
| P10-4 | Create NAS path traversal test matrix | ⬜ | All malicious paths rejected |
| P10-5 | Create Electron security test suite | ⬜ | Sandbox, IPC, CSP verified |
| P10-6 | Run `npm audit` in root and server; fix critical/high | ⬜ | 0 critical, 0 high |
| P10-7 | Production build: `NOENV=production npm run dist` | ⬜ | No `.env`, no secrets, signed installer |
| P10-8 | Full production simulation test on clean Windows VM | ⬜ | All workflows pass |
| P10-9 | Re-audit complete application | ⬜ | Score ≥ 8/10 |
| P10-10 | Generate `PRODUCTION_READINESS_REPORT.md` | ⬜ | Document complete |

---

## DEPENDENCIES BETWEEN PHASES

```
Phase 0 (Secrets) ──────────────────────────┐
                                             ▼
Phase 1 (Seed Backdoor) ───────────────────┐
                                             ▼
Phase 2 (JWT/Session) ─────────────────────┼──► Phase 3 (Chat Security)
                                             │
Phase 4 (Authorization) ◄──────────────────┘
                                             ▼
Phase 5 (NAS) ────────────────────────────► Phase 6 (Electron)
                                             ▼
Phase 7 (Network) ────────────────────────► Phase 8 (Data Integrity)
                                             ▼
Phase 9 (Audit/Privacy) ──────────────────► Phase 10 (Testing/Build)
```

---

## KEY FILES TO MODIFY

### Server (Priority Order)
1. `server/src/routes/auth.ts` — Seed endpoint, JWT config, password policy
2. `server/src/middleware/auth.ts` — Session validation, JWT verification
3. `server/src/index.ts` — Socket.IO auth middleware, CORS, rate limiting
4. `server/src/routes/chat.ts` — All membership checks
5. `server/src/routes/documents.ts` — NAS path validation, file validation
6. `server/src/routes/cases.ts` — Authorization, case number race
7. `server/src/routes/clients.ts` — Authorization
8. `server/src/routes/tasks.ts` — Authorization
9. `server/src/routes/calendar.ts` — Authorization
10. `server/src/routes/admin.ts` — Centralized admin guard
11. `server/src/models/Session.ts` — Token hashing, revocation
12. `server/src/models/Chat.ts` — Array bounds, indexes
13. `server/src/models/Document.ts` — Array bounds, state transitions
14. `server/src/models/Case.ts` — Atomic case number
15. `server/src/db.ts` — MongoDB TLS config
16. `server/src/seed.ts` — Remove hardcoded passwords
17. `server/package.json` — Add rate limiter, helmet, zod, redis, keytar

### Frontend
1. `src/services/api.ts` — Remove localStorage token (Electron IPC)
2. `src/lib/auth.tsx` — Integrate with secure token storage
3. `src/lib/socket.tsx` — Handle reconnection with auth
4. Electron app (entire `electron/` directory — new)

### Config
1. `package.json` — `asar: true`, remove `.env` from extraFiles, add signing
2. `.gitignore` — Ensure `.env*` ignored
3. `.env.example` — Placeholders only
4. `server/.env.example` — Placeholders only

---

## TEST STRATEGY

### Automated Security Regression Tests (Required for Each Fix)

```typescript
// Example test pattern for every Critical/High finding
describe("SWL-002: Socket.IO Room Authorization", () => {
  it("User A cannot join User B's direct chat room", async () => {
    // Setup: User A token, User B's direct chat groupId
    // Act: socket.emit("chat:join", groupId)
    // Assert: socket.emit("error", { message: "Not a member" })
    // Assert: socket.rooms.has(`chat:${groupId}`) === false
  });
});
```

### Test Categories Required

| Category | Target Coverage |
|----------|----------------|
| Unit | Auth helpers, path validation, token utilities |
| Integration | API endpoints with auth, authorization checks |
| API | All 47 endpoints with 3 user roles |
| Socket.IO | Auth middleware, room auth, rate limits, reconnection |
| NAS | Path traversal, file validation, credentials |
| Electron | CSP, IPC, navigation, sandbox, packaging |
| Database | Indexes, race conditions, array bounds |
| Load | 50 users, 1000 messages, 10k documents |
| Regression | Every Critical/High finding has a test |

---

## PRODUCTION READINESS CRITERIA

The application CANNOT be declared production-ready if ANY of these remain:

| Blocker | Must Pass |
|---------|-----------|
| Authentication bypass | ✅ |
| Authorization bypass (IDOR) | ✅ |
| Chat confidentiality breach | ✅ |
| Session hijacking via app flaw | ✅ |
| JWT forgery | ✅ |
| Production seed backdoor | ✅ |
| Arbitrary NAS/filesystem access | ✅ |
| Critical secret exposure | ✅ |
| Remote code execution | ✅ |
| Unprotected sensitive network traffic | ✅ |

---

## SCORE TARGETS

| Category | Current | Target |
|----------|---------|--------|
| Overall | 3.5/10 | ≥ 8.0/10 |
| Authentication | 5/10 | 9/10 |
| Session Security | 4/10 | 9/10 |
| Authorization / IDOR | 3/10 | 9/10 |
| Chat Security (REST) | 4/10 | 9/10 |
| Chat Security (Socket.IO) | 2/10 | 9/10 |
| Electron Security | 0/10 (N/A) | 9/10 |
| IPC Security | 0/10 (N/A) | 9/10 |
| NAS Security | 1/10 | 8/10 |
| Network Security | 3/10 | 8/10 |
| Secrets Management | 2/10 | 9/10 |
| Dependency Security | 6/10 | 8/10 |
| Reliability | 5/10 | 8/10 |
| Performance | 5/10 | 7/10 |
| Scalability | 4/10 | 7/10 |

---

## DELIVERABLES

| Document | Purpose |
|----------|---------|
| `SECURITY_REMEDIATION_PLAN.md` | This plan (single source of truth) |
| `docs/AUTHORIZATION_MATRIX.md` | Resource×Role×Action permissions |
| `docs/SECURITY.md` | Architecture, threat model, hardening guide |
| `docs/DEPLOYMENT.md` | Windows, MongoDB, Synology setup |
| `docs/NAS_SETUP.md` | Synology SMB3, credentials, permissions |
| `docs/INCIDENT_RESPONSE.md` | Breach response procedures |
| `docs/BACKUP_RECOVERY.md` | Tested restore procedures |
| `docs/PERFORMANCE_REPORT.md` | Benchmarks before/after |
| `PRODUCTION_READINESS_REPORT.md` | Final sign-off document |

---

## SUCCESS DEFINITION

**PRODUCTION READY** when:

1. All Critical findings: **FIXED + TESTED**
2. All High findings: **FIXED + TESTED** (or formally accepted with mitigation)
3. Security regression suite: **100% PASS**
4. Two-user authorization tests: **100% PASS**
5. Chat security matrix: **100% PASS**
6. NAS traversal tests: **100% PASS**
7. Electron security tests: **100% PASS**
8. Production build: **No secrets, signed, verified**
9. Full simulation on clean VM: **ALL WORKFLOWS PASS**
10. Re-audit score: **≥ 8.0/10**

---

**DO NOT DECLARE COMPLETION UNTIL FINAL RE-AUDIT HAS BEEN PERFORMED AND ALL CRITERIA MET.**