# LEGALOS — SECURITY AUDIT & THREAT MODEL REPORT

**Date:** October 2, 2026  
**Auditor:** Principal Security Engineer  
**Classification:** Internal Confidential / Production Hardening  

---

## 1. Threat Modeling & Scope

The security architecture of LegalOS was evaluated against the OWASP Top 10 API Security Risks (2023) and the Electron Security Checklist:

1. **Broken Object Level Authorization (BOLA / IDOR)**
2. **Broken Authentication & Session Hijacking**
3. **Broken Object Property Level Authorization**
4. **Unrestricted Resource Consumption**
5. **Broken Function Level Authorization (BFLA)**
6. **Unrestricted Access to Sensitive Business Flows**
7. **Server-Side Request Forgery (SSRF)**
8. **Security Misconfiguration**
9. **Improper Inventory Management**
10. **Unsafe Consumption of APIs & Path Traversal**
11. **Electron Sandbox & Remote Code Execution (RCE)**

---

## 2. Security Controls & Evaluation Results

### A. Authentication & Credential Storage
- **Password Storage:** Passwords hashed with `bcrypt` at cost factor 12. No plaintext passwords stored.
- **Account Enumeration:** Hardened login route returns identical HTTP 401 and code `INVALID_CREDENTIALS` whether an email exists or not.
- **Access Tokens:** Short-lived JWTs (15 minutes default) signed with high-entropy HMAC-SHA256 (`JWT_SECRET`).
- **Refresh Tokens:** Long-lived tokens stored as cryptographic SHA-256 hashes in MongoDB `sessions` collection.
  - **Web Client:** Transmitted over secure `HttpOnly`, `SameSite=Lax` cookie.
  - **Electron Client:** Transmitted via header and encrypted into OS-level keystore using Electron `safeStorage`.
- **Session Revocation:** Logout explicitly marks the active session record `isRevoked: true` in MongoDB, immediately invalidating access across all endpoints.

### B. Authorization & Access Control (BOLA Defense)
- **Middleware Guard:** Every protected route is guarded by `requireAuth` followed by `requireResourceAccess("case" | "client" | "document")`.
- **Tenant & Role Isolation:**
  - `admin` role has administrative rights with audit trail generation.
  - `employee` role is confined to cases/clients where they are the creator, assignee, or explicitly granted collaborator.
  - Cross-tenant queries return 403 Forbidden or 404 Not Found to prevent metadata leakage.
- **Document Access:** Direct document downloads and previews verify membership of the parent case or client before file streaming.

### C. Application Filesystem Storage & Path Traversal Defense
- **Decoupled Architecture:** Zero reliance on NAS, Synology, or WebDAV protocols.
- **Storage Root:** Configured strictly via `STORAGE_ROOT` environment variable (defaults to `./uploads` in local development).
- **Subdirectory Isolation:** Enforced subdirectories:
  - `documents/cases/<caseId>/`
  - `documents/clients/<clientId>/`
  - `documents/general/`
  - `chat/<channelId>/`
  - `avatars/<userId>/`
- **Path Confinement Verification (`server/src/services/storage.ts`):**
  - Resolves canonical path using `path.resolve()` and `path.normalize()`.
  - Asserts path begins with `STORAGE_ROOT`.
  - Throws `STORAGE_ACCESS_DENIED` on `..`, `%2e%2e`, null bytes, or backslash escapes.
  - Verified by Suite 15 tests (`STORAGE-TRAV-001` through `STORAGE-TRAV-004`).

### D. Chat Attachment Containment
- Chat attachments are confined to channel participants.
- Non-channel members attempting to upload attachments or download existing attachments receive HTTP 403 Forbidden.
- Injected traversal paths in chat payloads are sanitized before database insertion (Suite 16).

### E. Electron Desktop Sandbox & IPC Security
- **Sandbox Enabled:** Electron `webPreferences` enforces:
  - `sandbox: true`
  - `contextIsolation: true`
  - `nodeIntegration: false`
- **Preload Hardening:**
  - `electron/preload.ts` does not require Node.js built-ins (`path`, `fs`, `child_process`).
  - Preload bridge uses `contextBridge.exposeInMainWorld("electronAPI", ...)` with explicit channel whitelisting.
  - Verified by Suite 3 of the automated smoke suite.

---

## 3. Vulnerability Status Matrix

| Threat Category | Mitigating Control | Test Verification | Status |
| :--- | :--- | :--- | :---: |
| **User Enumeration** | Uniform 401 on login failure | Suite 21 (`AUTH-ENUM-001..006`) | **MITIGATED** |
| **Path Traversal** | Canonical path prefix verification | Suite 15 (`STORAGE-TRAV-001..005`) | **MITIGATED** |
| **BOLA on Cases** | Role & assignment middleware | Suite 06 (`AUTHZ-001..012`) | **MITIGATED** |
| **BOLA on Documents** | Parent case access verification | Suite 10 (`PREVIEW-029..031`) | **MITIGATED** |
| **Token Theft / XSS** | HttpOnly cookies + OS safeStorage | Suite 03 (`AUTH-006..008`) | **MITIGATED** |
| **Cross-Chat Leakage** | Channel membership validation | Suite 16 (`CHAT-SEC-001..006`) | **MITIGATED** |
| **Electron RCE** | Sandbox + Context Isolation | Automated smoke suite (Suite 3) | **MITIGATED** |
| **Information Disclosure** | Global API 404 JSON catch-all | Suite 21 (`API-404-001..003`) | **MITIGATED** |

---

## 4. Conclusion

The security architecture of LegalOS meets the high standards required for legal practice management systems handling confidential client communications and court documentation.
