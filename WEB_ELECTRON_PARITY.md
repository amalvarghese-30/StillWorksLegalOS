# LEGALOS — WEB AND ELECTRON DESKTOP PARITY AUDIT

**Date:** October 2, 2026  
**Auditor:** Lead Desktop & Web Engineer  
**Scope:** Functional and architectural parity between the Hosted Web Client and Windows Electron Desktop Application.

---

## 1. Architectural Model & Communication Contract

Both the Web Client and Electron Desktop Client share the exact same UI codebase (`src/`), API services (`src/services/`), state management (`@tanstack/react-query`), and backend contract.

```
       ┌────────────────────────┐      ┌────────────────────────┐
       │   Browser Web Client   │      │ Windows Desktop (EXE)  │
       │ (Chrome/Edge/Firefox)  │      │ (Electron 32 Sandbox)  │
       └───────────┬────────────┘      └───────────┬────────────┘
                   │                               │
                   │ Standard HTTP + WS            │ Secure Preload IPC
                   │                               ▼
                   │                   ┌────────────────────────┐
                   │                   │ Electron Main Process  │
                   │                   │  (safeStorage Vault)   │
                   │                   └───────────┬────────────┘
                   │                               │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                 ┌──────────────────────────────────┐
                 │    Express Backend API Server    │
                 │  (REST /api/* + Socket.IO /ws)   │
                 └─────────────────┬────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
        ┌─────────────────────┐         ┌─────────────────────┐
        │  MongoDB Database   │         │ App Storage (FS)    │
        │  (ACID Sequences)   │         │ (cases/clients/...) │
        └─────────────────────┘         └─────────────────────┘
```

---

## 2. Feature-by-Feature Parity Matrix

| Feature Module | Web Client Behavior | Electron Desktop Behavior | Parity Status |
| :--- | :--- | :--- | :---: |
| **Authentication Flow** | Email/Password login, HttpOnly refresh cookie | Email/Password login, `safeStorage` encrypted refresh token | **FULL PARITY** |
| **Session Persistence** | Refresh token cookie rotation | OS-level credential store (`auth:saveTokens`) | **FULL PARITY** |
| **Case Management** | Full CRUD, party management, timeline view | Full CRUD, party management, timeline view | **FULL PARITY** |
| **Party Add & Remove** | Interactive modal + confirmation dialog | Interactive modal + confirmation dialog | **FULL PARITY** |
| **Client Management** | Client list, creation, case association | Client list, creation, case association | **FULL PARITY** |
| **Document Uploads** | Direct multipart upload to backend | Direct multipart upload to backend | **FULL PARITY** |
| **Document Previews** | Streaming preview via backend API | Streaming preview via backend API | **FULL PARITY** |
| **Task Management** | Task creation, assignment, checklists | Task creation, assignment, checklists | **FULL PARITY** |
| **Call Reminders** | Due reminder popup, periodic polling | Due reminder popup, native OS notifications | **FULL PARITY** |
| **Realtime Chat** | Socket.IO messaging & attachment upload | Socket.IO messaging & attachment upload | **FULL PARITY** |
| **Avatar Management** | Image upload, streaming, delete | Image upload, streaming, delete | **FULL PARITY** |
| **Offline Handling** | Reconnection alerts, TanStack cached state | Reconnection alerts, TanStack cached state | **FULL PARITY** |
| **Window Controls** | Browser-native window chrome | Frameless custom titlebar with minimize/maximize/close | **OPTIMIZED** |

---

## 3. Desktop-Specific Security Verification

1. **Sandboxing Enforced:**
   `electron/main.ts` instantiates `BrowserWindow` with:
   ```typescript
   webPreferences: {
     preload: path.join(__dirname, "preload.cjs"),
     contextIsolation: true,
     nodeIntegration: false,
     sandbox: true,
   }
   ```
2. **Context Bridge Whitelisting:**
   `electron/preload.ts` exposes only vetted channels:
   - `windowControl:minimize`
   - `windowControl:maximize`
   - `windowControl:close`
   - `auth:saveTokens`
   - `auth:getTokens`
   - `auth:clearTokens`
   - `shell:openExternal`
3. **No Node Leaks:**
   Smoke test Suite 3 independently verifies that `dist-electron/preload.cjs` contains zero instances of `require('path')`, `require('fs')`, or `require('child_process')`.

---

## 4. Conclusion

There is zero functional drift between the Web and Electron environments. Both targets compile cleanly, execute against the same backend, and provide uniform legal workflow operations.
