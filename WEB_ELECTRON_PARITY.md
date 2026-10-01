# LEGALOS — WEB AND ELECTRON DESKTOP PARITY & RUNTIME AUDIT

**Date:** October 2, 2026  
**Auditor:** Principal Desktop Systems & Electron Engineer  
**Scope:** Functional and architectural parity between the Hosted Web Client and Windows Electron Desktop Application.

---

## 1. Architectural Architecture & Communication Model

Both the Web Client and Electron Desktop Application share the identical React UI codebase (`src/`), API services (`src/services/`), state queries (`@tanstack/react-query`), and backend contract (`/api/*`).

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
| **Session Persistence** | Refresh token cookie rotation | OS-level credential store (`auth:saveRefreshToken`) | **FULL PARITY** |
| **Case Management** | Full CRUD, party management, timeline view | Full CRUD, party management, timeline view | **FULL PARITY** |
| **Party Add & Remove** | Interactive modal + confirmation dialog | Interactive modal + confirmation dialog | **FULL PARITY** |
| **Client Management** | Client list, creation, case association | Client list, creation, case association | **FULL PARITY** |
| **Document Uploads** | Direct multipart upload to backend | Direct multipart upload to backend | **FULL PARITY** |
| **Document Previews** | Streaming preview via backend API | Streaming preview via backend API | **FULL PARITY** |
| **Document Downloads** | Native browser download prompt | Native Windows Save Dialog (`dialog:saveFile`) | **FULL PARITY** |
| **Task Management** | Task creation, assignment, checklists | Task creation, assignment, checklists | **FULL PARITY** |
| **Call Reminders** | Due reminder popup, Web Audio chime | Due reminder popup + Native Windows Toast (`notification:show`)| **FULL PARITY** |
| **Realtime Chat** | Socket.IO messaging & attachment upload | Socket.IO messaging & attachment upload | **FULL PARITY** |
| **Avatar Management** | Image upload, streaming, delete | Image upload, streaming, delete | **FULL PARITY** |
| **Window Controls** | Browser-native window controls | Frameless custom titlebar with minimize/maximize/close | **OPTIMIZED** |

---

## 3. Desktop Security & Preload Audit

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
   - `auth:saveRefreshToken`
   - `auth:getRefreshToken`
   - `auth:clearRefreshToken`
   - `app:getVersion`
   - `app:isDev`
   - `notification:show`
   - `notification:isPaused`
   - `notification:setPaused`
   - `shell:openExternal`
   - `dialog:saveFile`
3. **Zero Node Module Leaks:**
   Smoke test Suite 3 independently verifies that `dist-electron/preload.cjs` contains zero instances of `require('path')`, `require('fs')`, or `require('child_process')`.

---

## 4. Physical Windows EXE Runtime Status

### **EXPLICIT AUDIT DECLARATION: NOT VERIFIED (PHYSICAL EXE LAUNCH)**

- **Packaged Artifacts:** `electron:build` generates `dist-electron/main.js` and `dist-electron/preload.cjs` cleanly. Electron-builder target produces `release/win-unpacked/S & S Legal-Tech LLP.exe`.
- **Environment Limitation:** The current audit execution environment is a headless Windows/PowerShell CLI container without an interactive GUI display server or human desktop session.
- **Audit Rule Adherence:** As explicitly mandated by Audit Directive 15, build success is **NOT** converted into runtime success. While IPC contracts, TypeScript compilations, sandboxed preload isolation, and shared API endpoints have been verified, **physical interactive launch and mouse/keyboard QA of the installed `.exe` on a human desktop is explicitly recorded as NOT VERIFIED in this headless container**.
