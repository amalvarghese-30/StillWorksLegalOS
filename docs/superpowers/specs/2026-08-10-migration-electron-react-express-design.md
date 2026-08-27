# Migration Design: TanStack Start → Electron + React SPA + Express

**Date:** 2026-08-10
**Status:** Approved
**Scope:** Restructure project from SSR web app to Electron desktop app with dedicated backend

---

## 1. Target Architecture

Three distinct layers:

1. **React SPA** (`src/`) — Client-side React 19 app rendered inside Electron's Chromium
2. **Electron Shell** (`electron/`) — Native Windows .exe wrapper with filesystem access
3. **Express Backend** (`server/`) — REST API + MongoDB + Socket.io for real-time features

```
legal-clarity-suite/
├── package.json              # Root: Electron + shared scripts
├── electron/
│   ├── main.ts               # Electron main process
│   └── preload.ts            # Context bridge (NAS shell.openPath, file watchers)
├── src/                      # React SPA
│   ├── components/           # ui/, layout/, common/ (PRESERVED)
│   ├── routes/               # Pages (migrated from SSR to SPA)
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Utilities
│   ├── services/             # API client layer (NEW)
│   ├── styles.css            # Design tokens (PRESERVED)
│   └── main.tsx              # SPA entry point (NEW)
├── server/                   # Express + MongoDB + Socket.io (NEW)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # Server bootstrap
│       ├── db.ts             # Mongoose connection
│       ├── models/           # Mongoose schemas
│       ├── routes/           # REST API endpoints
│       ├── middleware/       # Auth, error handling
│       ├── socket/           # Socket.io (chat, live activity)
│       └── services/         # Business logic (NAS bridge, encryption)
├── index.html                # Vite SPA entry (NEW)
├── vite.config.ts            # Standard Vite React config (REWRITTEN)
└── electron-builder.yml      # Windows installer packaging (NEW)
```

---

## 2. File Migration Map

### 2.1 Files to Delete
- `src/start.ts` — TanStack Start SSR entry
- `src/server.ts` — SSR error wrapper
- `src/lib/error-capture.ts` — SSR-specific
- `src/lib/error-page.ts` — SSR-specific
- `src/lib/lovable-error-reporting.ts` — Lovable telemetry

### 2.2 Files to Preserve (No Changes)
- `src/components/ui/*` — 50 shadcn/ui components
- `src/components/layout/*` — Sidebar, AdminSidebar, Topbar, AdminTopbar, PageHeader
- `src/components/common/*` — StatusPill, Surface
- `src/styles.css` — Complete design token system
- `src/lib/mock-data.ts` — Temporary until API replaces it
- `src/lib/utils.ts` — cn() utility
- `src/hooks/use-mobile.tsx` — Responsive hook
- `tailwind.config` — Via Tailwind 4 CSS-first config
- ESLint, Prettier configs
- `public/` directory

### 2.3 Files to Rewrite
| File | Changes |
|------|---------|
| `src/routes/__root.tsx` | Remove SSR shell, keep AuthProvider + Outlet |
| `src/router.tsx` | Use `createHashHistory` for Electron compatibility |
| `src/routes/login.tsx` | Minor router API updates |
| `src/routes/_shell.tsx` | Remove SSR flag, keep auth guard |
| `src/routes/_admin.tsx` | Remove SSR flag, keep auth + role guard |

### 2.4 Files to Create
- `index.html` — Standard Vite SPA HTML shell
- `src/main.tsx` — React DOM render entry
- `electron/main.ts` — Electron main process (window creation, IPC)
- `electron/preload.ts` — Context bridge exposing `shell.openPath`
- `server/` — Complete Express backend scaffold

---

## 3. Router Migration Details

TanStack Router's `@tanstack/react-router` supports pure SPA mode natively. Key changes:

- Use `createHashHistory()` instead of default history — prevents Electron `file://` protocol 404s
- Remove `ssr: false` flags (no longer needed)
- Remove `HeadContent`, `Scripts` imports (HTML is served from `index.html`)
- Keep all route file structure identical — migration is config-only

```ts
// src/router.tsx (after migration)
import { createHashHistory } from "@tanstack/react-router";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
  // No SSR context needed
});
```

---

## 4. Electron Configuration

### Main Process Responsibilities
- Create BrowserWindow loading the Vite dev server (dev) or built files (prod)
- Register IPC handlers: `shell.openPath` for NAS file opening, file watcher events
- Set Content-Security-Policy for security
- Window state persistence (size, position)

### Preload Script
- Expose `window.electronAPI.openNasPath(path: string)` via contextBridge
- Expose `window.electronAPI.watchFolder(path: string)` for NAS pending folder monitoring

### Build
- `electron-builder` for Windows .exe / .msi packaging
- NSIS installer for distribution

---

## 5. Backend Scaffold

### Express Server
- Port: 3001 (configurable via `SERVER_PORT`)
- MongoDB connection via Mongoose at `mongodb://localhost:27017/stillworks`
- JWT authentication middleware
- CORS configured for Electron origin
- Socket.io attached to same HTTP server

### Initial Mongoose Models (Phase 1)
- `User` — name, email, passwordHash, role, title, status, permissions
- `Session` — userId, token, device, lastActive, ip

### API Structure
```
/api/auth          — login, logout, refresh
/api/users         — CRUD (admin only), profile
/api/clients       — CRUD, KYC fields
/api/cases         — CRUD, multi-client linking
/api/tasks         — CRUD, checklist, call reminders
/api/documents     — metadata CRUD, approval workflow
/api/calendar      — events, reminders
/api/chat          — groups, messages (admin managed)
/api/reports       — analytics (non-financial)
/api/admin         — audit logs, live activity, approvals
```

---

## 6. What Breaks (Risk Register)

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSR-only APIs (`HeadContent`, `Scripts`) referenced in routes | Build errors | Remove during migration |
| `lovable-tanstack-config` vite plugin incompatible | Build errors | Replace with standard `@vitejs/plugin-react` |
| Route generation (`routeTree.gen.ts`) depends on TanStack Start conventions | Missing routes | Regenerate after cleanup |
| Google Fonts loaded via `<link>` in `__root.tsx` | Missing fonts | Move to `index.html` |
| Mock auth stores to `localStorage` | Works unchanged in Electron | No action needed |

---

## 7. What's Preserved

- **Design tokens**: 100% — all CSS custom properties, Tailwind theme config, glass utility
- **shadcn/ui components**: 100% — Radix primitives work identically in Electron
- **Layout shell**: Sidebar, Topbar, AdminSidebar, AdminTopbar — unchanged
- **Page components**: All 13 route pages keep their JSX/rendering logic
- **Google Fonts**: Sora, Inter, IBM Plex Mono
- **Mock data**: `mock-data.ts` serves as API contract reference during backend build

---

## 8. Migration Steps (Ordered)

1. **Clean up**: Delete SSR-specific files
2. **Create `index.html`**: Standard Vite SPA shell with font links
3. **Create `src/main.tsx`**: React DOM render entry
4. **Rewrite `vite.config.ts`**: Standard Vite + React plugin
5. **Rewrite `src/routes/__root.tsx`**: Remove SSR shell, simplify
6. **Rewrite `src/router.tsx`**: Hash history, no SSR context
7. **Update route files**: Remove `ssr`, `HeadContent`, `Scripts` references
8. **Update `package.json`**: New scripts, Electron dependencies
9. **Install dependencies**: `npm install`
10. **Verify build**: `npm run build` must succeed
11. **Create `electron/`**: Main process + preload
12. **Create `server/`**: Express + MongoDB scaffold
13. **Verify dev mode**: `npm run dev` launches Electron with working app
