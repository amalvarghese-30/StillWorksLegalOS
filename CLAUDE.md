## Tool and Plugin Usage Policy

You have access to various installed tools, plugins, MCP servers, skills, and integrations.

For every task:

1. First inspect the available tools/capabilities relevant to the task.
2. Use the appropriate installed tools/plugins when they materially improve accuracy, efficiency, debugging, research, testing, or implementation quality.
3. Do not ignore an available tool simply because the task can technically be completed without it.
4. Do not use tools/plugins unnecessarily when they provide no meaningful benefit.
5. Prefer specialized tools over manually reproducing information or workflows they are designed to handle.
6. Before implementing a significant change, inspect the existing codebase and understand the relevant architecture and dependencies.
7. When external documentation, APIs, libraries, frameworks, or current information are required, use the appropriate available research/documentation tools instead of guessing.
8. When a task involves testing, debugging, or verification, use the available testing and diagnostic tools and actually verify the implementation.
9. If a tool/plugin fails, investigate the failure and use a reasonable alternative rather than silently ignoring the problem.
10. Do not stop after making code changes. Validate the implementation, run relevant tests/checks, inspect errors, and fix problems you introduced.
11. Keep the existing architecture and conventions in mind before introducing new dependencies or patterns.
12. For large tasks, work systematically: understand → plan → implement → test → verify → summarize.

The goal is not to maximize tool usage. The goal is to use the RIGHT tool at the RIGHT time to produce the highest-quality implementation.

# StillWorks LegalOS — Project Status & Context

> **Last updated:** 2026-08-21
> **Current phase:** Cloud migration + secure auth + mobile responsive complete; NAS (WebDAV) integration & polish remain
> **Branch:** `main`

---

## 1. What This Is

StillWorks LegalOS is a premium legal practice management desktop app (Electron `.exe` for Windows). It's a full ERP for a law firm: case management, client KYC, task engine, NAS document storage, encrypted group chat, shared calendar, non-financial analytics, and admin command center.

**Target users:** Senior Advocates, Junior Advocates, Legal Assistants, Clerks, Office Administrators, Partners — all non-technical.

**Design philosophy:** Apple + Vercel premium SaaS. Glass sidebar, gradient buttons, soft shadows, rounded everything, generous whitespace. Calm, not cluttered.

---

## 2. Tech Stack (Concrete)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Desktop shell** | Electron 34 | Windows `.exe` via electron-builder (NSIS) |
| **Frontend framework** | React 19 + TypeScript 5.8 (strict) | SPA, hash history for `file://` compat |
| **Build tool** | Vite 8 | `vite build` for production |
| **Routing** | TanStack React Router 1.x | File-based routing, codegen route tree |
| **Server state** | TanStack React Query 5.x | All API data goes through hooks |
| **Styling** | Tailwind CSS 4 + shadcn/ui (Radix) | Design tokens via CSS vars in `src/index.css` |
| **Charts** | Recharts 2.x | Area, bar, pie, donut — no 3D |
| **Icons** | Lucide React | 1.75px stroke, 17-22px |
| **Forms** | React Hook Form 7 + Zod 3 | (imported but mostly plain state forms used) |
| **Real-time** | Socket.io Client 4.x | Chat messages, live activity |
| **Backend** | Express 4 + TypeScript | `server/` directory |
| **Database** | MongoDB 8.x via Mongoose | Atlas cluster (`MONGODB_URI` in `server/.env`) |
| **Auth** | JWT (jsonwebtoken + bcryptjs) | Hybrid: web = httpOnly refresh cookie + in-memory access token; Electron = `safeStorage`-encrypted refresh token + in-memory access token |
| **File storage** | Synology NAS (stub) | Mock structure returned; production = WebDAV over HTTPS via Cloudflare Tunnel (no cloud object storage) |
| **PWA** | manifest.json + service worker | Installable web app for mobile browser access; SW gated to prod builds |

### Key files:
- `package.json` — frontend + Electron scripts
- `server/package.json` — backend scripts
- `server/.env` — `MONGODB_URI`, `JWT_SECRET`, `PORT`

### Run commands:
| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server only (web) |
| `npm run dev:server` | Express server with hot reload (`cd server && npm run dev`) |
| `npm run dev:all` | Vite + Electron + Server concurrently |
| `npm run seed` | Populate MongoDB with sample data (`cd server && npm run seed`) |
| `npm run dist` | Full production build + Windows installer |

---

## 3. Project Structure

```
legal-clarity-suite/
├── src/                          # Frontend (React)
│   ├── components/
│   │   ├── admin/                # AddEmployeeDialog.tsx, EditEmployeeDialog.tsx
│   │   ├── calendar/             # ScheduleHearingDialog.tsx
│   │   ├── cases/                # AddCaseDialog.tsx
│   │   ├── chat/                 # ChatSidebar, MessageList, MessageBubble, MessageComposer, NewChatDialog, CreateGroupDialog, GroupInfoSheet, AddMembersDialog, ForwardDialog
│   │   ├── clients/              # AddClientDialog.tsx
│   │   ├── common/               # StatusPill.tsx, Surface.tsx, ErrorState.tsx, SkipLink.tsx
│   │   ├── documents/            # UploadDocumentDialog.tsx
│   │   ├── layout/               # PageHeader.tsx, Sidebar.tsx, Topbar.tsx, AdminSidebar.tsx, AdminTopbar.tsx, QuickActionsMenu.tsx
│   │   ├── settings/             # AppearanceSettings.tsx
│   │   ├── tasks/                # AddTaskDialog.tsx
│   │   └── ui/                   # shadcn/ui primitives (Button, Input, Label, Switch, Progress, Dialog, etc.)
│   ├── lib/
│   │   ├── auth.tsx              # AuthProvider, useAuth()
│   │   ├── socket.tsx            # SocketProvider, useSocket(), useSocketEvent(), useSocketEmit()
│   │   ├── theme.tsx             # ThemeProvider, useTheme() (light/dark/system)
│   │   └── utils.ts              # cn() helper
│   ├── routes/
│   │   ├── __root.tsx            # Root layout
│   │   ├── _shell.tsx            # Authenticated layout (sidebar + topnav)
│   │   ├── _admin.tsx            # Admin layout
│   │   ├── login.tsx             # Login page
│   │   ├── _shell/
│   │   │   ├── index.tsx         # Dashboard ("Today")
│   │   │   ├── cases.index.tsx   # Cases list
│   │   │   ├── cases.$caseId.tsx # Case workspace (detail page)
│   │   │   ├── clients.tsx       # Clients list
│   │   │   ├── clients.$clientId.tsx # Client profile (detail page)
│   │   │   ├── tasks.tsx         # Tasks list
│   │   │   ├── documents.tsx     # Documents explorer
│   │   │   ├── calendar.tsx      # Calendar views
│   │   │   ├── chat.tsx          # Group chat
│   │   │   ├── reports.tsx       # Analytics reports
│   │   │   └── settings.tsx      # User settings
│   │   └── _admin/
│   │       ├── admin.index.tsx   # Admin dashboard
│   │       ├── admin.employees.tsx   # Employee management
│   │       ├── admin.approvals.tsx   # Approval center
│   │       ├── admin.audit-logs.tsx  # Audit logs
│   │       └── admin.settings.tsx    # Admin settings
│   ├── services/
│   │   ├── api.ts                # HTTP client, auth token management
│   │   ├── admin.ts              # Employees, approvals, audit logs, updateProfile
│   │   ├── calendar.ts           # Calendar events CRUD
│   │   ├── cases.ts              # Cases CRUD
│   │   ├── chat.ts               # Chat groups & messages
│   │   ├── clients.ts            # Clients CRUD
│   │   ├── documents.ts          # Documents, NAS structure, upload
│   │   ├── reports.ts            # Dashboard summary, charts data
│   │   └── tasks.ts              # Tasks CRUD, checklist toggle
│   ├── routeTree.gen.ts          # Auto-generated route tree (MANUALLY MAINTAINED)
│   ├── router.tsx                # Router setup with hash history
│   ├── index.css                 # Tailwind + design tokens
│   └── main.tsx                  # App entry point
├── server/
│   ├── src/
│   │   ├── index.ts              # Express server entry
│   │   ├── seed.ts               # DB seed script
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT verification, requireAuth, requireAdmin
│   │   │   └── authorization.ts  # requireResourceAccess (document-level access control)
│   │   ├── models/               # Mongoose schemas (User, Client, Case, Task, Document, CalendarEvent, ChatGroup, ChatMessage, AuditLog, Session)
│   │   └── routes/
│   │       ├── auth.ts           # /api/auth (login, logout, me, change-password, seed)
│   │       ├── clients.ts        # /api/clients (CRUD)
│   │       ├── cases.ts          # /api/cases (CRUD + notes + parties + timeline)
│   │       ├── tasks.ts          # /api/tasks (CRUD + checklist toggle)
│   │       ├── documents.ts      # /api/documents (CRUD + NAS structure + access requests)
│   │       ├── calendar.ts       # /api/calendar (events CRUD)
│   │       ├── chat.ts           # /api/chat (groups + messages)
│   │       └── admin.ts          # /api/admin (employees, approvals, audit logs, reports)
│   └── .env                      # MONGODB_URI, JWT_SECRET, PORT
├── electron/
│   ├── main.js                   # Electron main process
│   └── preload.js                # Preload script
└── public/                       # Static assets
```

---

## 4. Seed Data (for testing)

Run `cd server && npm run seed` to populate MongoDB. Creates:

| Collection | Count | Details |
|------------|-------|---------|
| Users | 5 | Admin `rohan@stillworks.legal`, plus `meera@`, `kabir@`, `priya@`, `imran@` — **all passwords `password123`** |
| Clients | 5 | Mix of Individual/Corporate, some with Verified KYC |
| Cases | 5 | Mix of Active/Closed/Urgent with parties, notes, timeline |
| Tasks | 6 | Overdue, today, upcoming, with checklists |
| Documents | 5 | Various states (Draft, Pending Approval, Approved) |
| Calendar Events | 10 | Hearings, call reminders, tasks, firm events |
| Chat Groups | 5 | With 9 messages across groups |
| Audit Logs | 14 | Various actions across users |

---

## 5. What's Fully Wired (Complete)

Each of these pages loads live data from the API, has loading/error/empty states, and supports mutations where applicable:

| Page | Route | Data Source | Mutations |
|------|-------|-------------|-----------|
| **Login** | `/login` | `POST /api/auth/login` | Login, token storage |
| **Dashboard** | `/` | `useReportsSummary`, `useCalendarEvents`, `useCases`, `useDocuments`, `useApprovals`, `useAuditLogs`, `useEmployeeWorkload` | None (read-only dashboard) |
| **Cases list** | `/cases` | `useCases()` with search | None (navigate to detail) |
| **Case workspace** | `/cases/$caseId` | `useCase(id)`, `useDocuments({caseId})`, `useTasks({caseId})`, `useCalendarEvents({caseId})` | `useUpdateCase`, `useAddCaseNote`, `useAddCaseParty` — inline status/priority editing, add note form, add party form |
| **Clients list** | `/clients` | `useClients()` with search | `useCreateClient` via AddClientDialog (wired) |
| **Client profile** | `/clients/$clientId` | `useClient(id)` | `useUpdateClient` — inline tag/type editing |
| **Tasks** | `/tasks` | `useTasks()` with bucket grouping | `useCreateTask` via AddTaskDialog, `useUpdateTask`, `useDeleteTask`, `useToggleChecklistItem` |
| **Calendar** | `/calendar` | `useCalendarEvents({start,end})`, `useEmployees()` | `useCreateEvent` via ScheduleHearingDialog |
| **Chat** | `/chat` | `useChatGroups()`, `useChatMessages()` | Real-time via Socket.io (`chat:message` event), create group |
| **Reports** | `/reports` | `useReportsSummary`, `useCaseGrowth`, `usePracticeAreas`, `useEmployeeWorkload`, `useTopClients`, `useCaseStatusBreakdown`, `useMyPerformance` | None (read-only) — all charts live |
| **Documents** | `/documents` | `useDocuments()`, `useNasStructure()` | `useUploadDocument` via UploadDocumentDialog, `useRequestAccess`; "Versions"/"Open" still stubs |
| **Settings (user)** | `/settings` | `useAuth()`, `useUpdateProfile()`, `useUpdateFirm()`, `useUpdatePreferences()`, `AppearanceSettings` | Profile, Firm, Notifications, Security, Appearance wired; Storage still placeholder |
| **Admin dashboard** | `/admin` | Same hooks as user dashboard | Same |
| **Admin employees** | `/admin/employees` | `useEmployees()`, `useUpdateEmployee()`, `useCreateEmployee()` | Add/edit employee: role/status/permission editing |
| **Admin approvals** | `/admin/approvals` | `useApprovals()` | Approve/reject buttons present |
| **Admin audit logs** | `/admin/audit-logs` | `useAuditLogs()` with search, `useFileIntegrity()`, `useVerifyAuditChain()` | Read-only + file integrity verification |
| **Admin settings** | `/admin/settings` | `useAuth()`, `useUpdateProfile()`, `useUpdateFirm()`, `useUpdatePreferences()`, `useStorageConfig()`, `useUpdateStorageConfig()`, `useTestStorageConnection()` | Same as user settings, plus the Storage tab (Synology WebDAV config + test connection) |

---

## 6. What's Remaining (Incomplete / Future Phases)

The previously-listed "partially wired" gaps are now resolved:

- **AddClientDialog / AddCaseDialog / AddTaskDialog** — all wired to `useCreateClient` / `useCreateCase` / `useCreateTask` (no more fake `setTimeout`).
- **Calendar "New event"** — wired to `ScheduleHearingDialog` (`useCreateEvent`).
- **Documents NAS browser** — uses `useNasStructure()` (not a hardcoded constant); "Upload" wired to `UploadDocumentDialog`; "Request access" wired to `useRequestAccess`.
- **Reports "Case Status Breakdown" pie chart** — uses `useCaseStatusBreakdown()` (derived from `useCases`), no longer hardcoded `[18,7,22,3]`.
- **Settings Firm / Notifications / Security / Appearance** — now wired to `useUpdateFirm`, `useUpdatePreferences`, and `AppearanceSettings` (device-level theme toggle).

### 6.1 Documents "Versions" / "Open" buttons

Stubs in `src/routes/_shell/documents.tsx` — require real NAS (WebDAV) integration (future phase).

### 6.2 Settings "Storage" tab

Now wired in the **admin** settings (`/admin/settings` → Storage) to `StorageSettings`: WebDAV URL, username, password (encrypted at rest via `DB_ENCRYPTION_KEY`), root folder, "Test connection", and "Save". Non-admin user settings shows a "managed by administrator" note. Storage **metrics** (used/available quota) are still future.

### 6.3 Tasks "Calendar" view

Tab exists in the tasks page but always falls through to list view — needs actual calendar grid rendering.

### 6.4 Future phases (per README build order)

- Responsive polish (all breakpoints)
- Motion system (page transitions, micro-interactions)
- Final accessibility pass
- Real NAS (WebDAV) integration (currently stub on both server and client)
- Electron packaging & distribution testing
- Full theme system — `AppearanceSettings` currently offers a basic light/dark/system toggle (device-level); full design-token theming across all components is future
- Advanced wizard flows (README describes 5-step wizards; current forms are single-page)

---

## 7. Server API — Complete Endpoint Map

### Auth (`/api/auth`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/login` | None | Login → `{accessToken, user}`; sets httpOnly refresh cookie (web) or returns `refreshToken` in body (`x-client-type: electron`) |
| POST | `/logout` | User | Revoke session + clear refresh cookie |
| POST | `/refresh` | None | Rotate access+refresh tokens; accepts refresh token from cookie (web) or JSON body (Electron) |
| GET | `/me` | User | Get current user profile |
| PATCH | `/me` | User | Update name/phone/title |
| POST | `/change-password` | User | Change password |
| PATCH | `/firm` | User | Update firm details |
| PATCH | `/preferences` | User | Update notification + security preferences |
| POST | `/seed` | None | Create admin+employee test accounts |

### Clients (`/api/clients`) — all require auth
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | List with search, tag/type/kyc filter, pagination |
| GET | `/:id` | Single client |
| POST | `/` | Create (auto-KYC if aadhar+pan provided) |
| PATCH | `/:id` | Partial update (re-evaluates KYC) |
| DELETE | `/:id` | Delete client |

### Cases (`/api/cases`) — all require auth
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | List with search, status/priority filter, pagination |
| GET | `/:id` | Single case with populated relations |
| POST | `/` | Create case |
| PATCH | `/:id` | Partial update |
| DELETE | `/:id` | Delete case |
| POST | `/:id/notes` | Add note to case |
| POST | `/:id/parties` | Add party to case |

### Tasks (`/api/tasks`) — all require auth
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | List with search, status/priority/category/assignedTo/caseId filters, pagination |
| GET | `/:id` | Single task with populated relations |
| POST | `/` | Create task with checklist, call reminder, audit log |
| PATCH | `/:id` | Partial update (title, priority, status, deadline, assignment) |
| PATCH | `/:taskId/checklist/:itemId` | Toggle checklist item done |
| DELETE | `/:id` | Delete with audit log |

### Calendar (`/api/calendar`) — all require auth
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | List with date range, employeeId, type, caseId filters |
| GET | `/events/:id` | Single event |
| POST | `/events` | Create event |
| PATCH | `/events/:id` | Update event |
| DELETE | `/events/:id` | Delete event |

### Documents (`/api/documents`) — all require auth
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | List with search, state/caseId filters, pagination |
| GET | `/nas/structure` | Mock NAS folder tree (stub) |
| POST | `/upload-direct` | Direct multipart upload |
| POST | `/upload` | Register uploaded document metadata |
| POST | `/presigned-upload` | Request a presigned upload URL |
| POST | `/complete-upload` | Finalize a presigned upload (records sha256) |
| GET | `/:id` | Single document |
| GET | `/:id/download` | Presigned download URL |
| GET | `/:id/verify` | Verify document integrity (hash) |
| PATCH | `/:id` | Update metadata or approve/reject |
| POST | `/:docId/request-access` | Request access to restricted document |
| PATCH | `/:docId/access-requests/:requestId` | Review (approve/reject) an access request |
| DELETE | `/:id` | Delete with audit log |

### Chat (`/api/chat`) — all require auth
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/groups` | List chat groups |
| POST | `/groups` | Create group |
| GET | `/groups/:groupId/messages` | List messages with pagination |
| POST | `/groups/:groupId/messages` | Send message (triggers socket.io broadcast) |

### Admin (`/api/admin`) — all require auth (admin-only marked)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/employees` | List employees with search, role/status filters (admin) |
| POST | `/employees` | Create employee (admin) |
| PATCH | `/employees/:id` | Update employee (role, title, status, phone, permissions) (admin) |
| GET | `/approvals` | List pending approvals (admin) |
| GET | `/audit-logs` | List audit logs with search, pagination (admin) |
| GET | `/storage` | Get current Synology WebDAV config — password masked (admin) |
| PATCH | `/storage` | Save Synology WebDAV config (admin) |
| POST | `/storage/test-connection` | Test WebDAV connectivity + root folder (admin) |
| GET | `/reports/summary` | Dashboard summary stats |
| GET | `/reports/case-growth` | Monthly case growth data |
| GET | `/reports/practice-areas` | Case distribution by practice area |
| GET | `/reports/employee-workload` | Employee workload percentages |
| GET | `/reports/top-clients` | Top clients data |
| GET | `/reports/my-performance` | Per-user contribution metrics (tasks/cases done vs total) |
| GET | `/integrity/audit-chain` | Verify audit log chain integrity (admin) |
| GET | `/integrity/files` | List file integrity records (admin) |
| POST | `/integrity/verify-all` | Re-verify all files (admin) |
| POST | `/integrity/verify-file/:id` | Re-verify a single file (admin) |

---

## 8. Frontend Service Hooks — Quick Reference

Every service file follows the same pattern: query keys at the top, `useQuery`/`useMutation` hooks below, `useQueryClient` for cache invalidation on mutations.

| File | Hooks | Key exports |
|------|-------|-------------|
| `api.ts` | None | `api` (axios-like instance), `getAuthToken()`, `clearAuthToken()` |
| `admin.ts` | `useEmployees`, `useUpdateEmployee`, `useCreateEmployee`, `useUpdateProfile`, `useUpdateFirm`, `useUpdatePreferences`, `useApprovals`, `useAuditLogs`, `useVerifyAuditChain`, `useFileIntegrity`, `useVerifyAllFiles`, `useVerifyFile`, `useStorageConfig`, `useUpdateStorageConfig`, `useTestStorageConnection` | `EmployeeRecord`, `CreateEmployeePayload`, `UpdateEmployeePayload`, `UpdateFirmPayload`, `UpdatePreferencesPayload`, `StorageConfig`, `SaveStorageConfigPayload`, `TestConnectionResult`, `adminKeys` |
| `calendar.ts` | `useCalendarEvents`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent` | `CalendarEvent`, `CreateEventPayload`, `calendarKeys` |
| `cases.ts` | `useCases`, `useCase`, `useCreateCase`, `useUpdateCase`, `useDeleteCase`, `useAddCaseParty`, `useAddCaseNote` | `CaseRecord`, `CaseParty`, `CreateCasePayload`, `caseKeys` |
| `chat.ts` | `useChatGroups`, `useChatMessages`, `useChatUsers`, `useGroupMembers`, `useSendMessage`, `useCreateGroup`, `useDeleteGroup`, `useCreateDirectChat`, `useMarkRead`, `useAddGroupMembers`, `useRemoveGroupMember`, `useChangeMemberRole`, `useLeaveGroup`, `useAddReaction`, `useRenameGroup`, `useDeleteMessageForEveryone`, `useDeleteMessageForMe`, `useTogglePin`, `useToggleMute`, `useToggleArchive`, `useReportMessage` | `ChatGroup`, `ChatMessage`, `chatKeys` |
| `clients.ts` | `useClients`, `useClient`, `useCreateClient`, `useUpdateClient`, `useDeleteClient` | `ClientRecord`, `SubClient`, `CreateClientPayload`, `clientKeys` |
| `documents.ts` | `useDocuments`, `useDocument`, `useNasStructure`, `usePresignedUploadUrl`, `useCompleteUpload`, `usePresignedDownloadUrl`, `useVerifyDocument`, `useUploadDocument`, `useUpdateDocument`, `useDeleteDocument`, `useRequestAccess`, `useReviewAccessRequest` | `DocumentRecord`, `NasFolder`, `docKeys` |
| `reports.ts` | `useReportsSummary`, `useCaseGrowth`, `usePracticeAreas`, `useEmployeeWorkload`, `useTopClients`, `useMyPerformance`, `useCaseStatusBreakdown` | Response types, `reportKeys` |
| `tasks.ts` | `useTasks`, `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useToggleChecklistItem` | `TaskRecord`, `CreateTaskPayload`, `taskKeys` |

---

## 9. Route Tree — Manual Maintenance Required

**CRITICAL:** `npx tsr generate` is BROKEN (TypeScript API incompatibility with TS 5.8). The route tree at `src/routeTree.gen.ts` must be manually updated whenever a new route file is added.

When adding a new route file (e.g., `src/routes/_shell/foo.$id.tsx`), you must:
1. Add the import at the top of `routeTree.gen.ts`
2. Add the `const FooRoute = FooRouteImport.update({...})` block
3. Add it to `FileRoutesByFullPath`, `FileRoutesByTo`, `FileRoutesById`, `FileRouteTypes`
4. Add it to `ShellRouteChildren` interface and const
5. Add the `declare module` entry in `FileRoutesByPath`

Existing routes in the tree: `_shell/`, `_shell/calendar`, `_shell/chat`, `_shell/clients`, `_shell/clients/$clientId`, `_shell/documents`, `_shell/reports`, `_shell/settings`, `_shell/tasks`, `_shell/cases/`, `_shell/cases/$caseId`, `_admin/admin/`, `_admin/admin/approvals`, `_admin/admin/audit-logs`, `_admin/admin/employees`, `_admin/admin/settings`, `login`

---

## 10. Remaining Work — Priority Order

### LOW (backend/future phases needed)

1. **Tasks "Calendar" view** — Tab exists in tasks page but always falls through to list view. Needs actual calendar grid rendering.
2. **Documents "Versions" / "Open" buttons** — stubs in `src/routes/_shell/documents.tsx`; require real NAS (WebDAV) integration (future phase). "Request access" and "Upload" are already wired.

### NOT STARTED (future phases per README build order)

- Responsive polish (all breakpoints)
- Motion system (page transitions, micro-interactions)
- Final accessibility pass
- Real NAS (WebDAV) integration (currently stub on both server and client)
- Electron packaging & distribution testing
- Full theme system — `AppearanceSettings` already offers a basic light/dark/system toggle (device-level); full design-token theming across all components is future
- Advanced wizard flows (the README describes 5-step wizards; current forms are single-page)

> **Done since last update:** the six former HIGH-priority items (wire AddClientDialog/AddCaseDialog/AddTaskDialog, Calendar ScheduleHearingDialog, Documents NAS browser, Reports pie chart) plus UploadDocumentDialog, firm/notification/security settings persistence, employee creation, and file-integrity verification are all complete.

---

## 11. Key Patterns to Follow

### When adding a new page:
```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/newpage")({
  head: () => ({ meta: [{ title: "Page · StillWorks LegalOS" }] }),
  component: NewPage,
});

function NewPage() {
  // 1. useQuery hooks for data
  // 2. Loading state: <Loader2 className="animate-spin" />
  // 3. Error state: friendly message + retry
  // 4. Empty state: illustration + CTA (never "No Data")
  // 5. Data state: the actual content
}
```

### When adding a mutation:
```tsx
const mutation = useCreateThing();
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  mutation.mutate(payload, {
    onSuccess: () => { /* reset form, close dialog */ },
  });
};
// Button shows: mutation.isPending ? <Loader2 spin /> : "Save"
// Error: mutation.isError && <span className="text-destructive">Failed</span>
```

### Styling conventions:
- Buttons: `gradient-primary rounded-md text-primary-foreground shadow-soft`
- Cards: `rounded-lg border border-border bg-card p-6 shadow-soft`
- Section headers: `PageHeader` component with breadcrumbs, title, subtitle
- Dialogs: fixed overlay with `bg-background/80 backdrop-blur-sm`, rounded-xl card
- Loading: `Loader2` icon with `animate-spin`, never generic spinners
- Status pills: `StatusPill` component with tone (success/warning/destructive/primary/muted)

### Route tree conventions:
- TanStack Router uses hash history (`createHashHistory()`) for Electron `file://` compatibility
- All authenticated routes are under `_shell` (employee) or `_admin` (admin) layouts
- `Route.useParams()` extracts params like `{ caseId }` from `cases.$caseId.tsx`
- `<Link to="/cases/$caseId" params={{ caseId: id }}>` for navigation

---

## 12. How to Start a New Session

**If the app isn't running:**
```sh
# Terminal 1: Start the backend
cd server && npm run dev

# Terminal 2: Start the frontend (or both with Electron)
npm run dev          # web only
npm run dev:all      # web + electron + server
```

**If MongoDB is empty:**
```sh
cd server && npm run seed
```

**Test accounts (from `npm run seed`):**
- Admin: `rohan@stillworks.legal` / `password123`
- Senior Advocate: `meera@stillworks.legal` / `password123`
- Junior Advocate: `kabir@stillworks.legal` / `password123`
- Legal Assistant: `priya@stillworks.legal` / `password123`
- Office Admin: `imran@stillworks.legal` / `password123`

> The alternate `POST /api/auth/seed` endpoint instead creates `admin@stillworks.legal` / `admin123` + `employee@stillworks.legal` / `employee123`.

**TypeScript check before committing:**
```sh
npx tsc --noEmit          # frontend
cd server && npx tsc --noEmit  # backend
```

---

## 13. Recent Commits (git log)

```
6c2f921 Add comprehensive CLAUDE.md project context document
213af33 Add migration design spec: TanStack Start → Electron + React SPA + Express
6d7f9a2 Add project README
a237ddf Created separate admin dashboard
b94a27b Changes
```

---

## 14. Memory / Context Notes

- The user wants a premium, luxury feel — always default to Apple/Vercel aesthetic
- Design tokens are in `src/index.css` as CSS variables — never hardcode colors/spacing/radius
- Maximum ~300 lines per component — extract sub-components for anything larger
- All forms should have loading, error, and success states
- Empty states should have friendly copy + illustrations (use icons from lucide-react as stand-ins)
- The app targets non-technical legal professionals — keep copy simple, avoid jargon
- The `socket.io` connection is managed by `SocketProvider` in `_shell.tsx` — any page under `_shell` can use `useSocket()`, `useSocketEvent()`, `useSocketEmit()`
