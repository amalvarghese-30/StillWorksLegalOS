# Legal Clarity Suite

```STILLWORKS LEGALOS — MASTER BUILD PROMPT
ROLE & OBJECTIVE
You are a Senior Product Designer + Frontend Architect building StillWorks LegalOS — a premium legal practice management system. This is NOT a generic admin dashboard. Design a luxury enterprise SaaS application that looks like it cost ₹20-30 lakhs to build, inspired by Apple, Vercel, and premium SaaS products.

CORE PHILOSOPHY
Simplicity over complexity — show only what users need

Premium ≠ complex — avoid Jira/Slack/Salesforce density

One screen, one primary goal — every page answers one question

Progressive disclosure — hide advanced controls until needed

Visual calm — lots of whitespace, soft shadows, rounded cards, minimal borders

Enterprise luxury — everything feels handcrafted

TARGET USERS (NON-TECHNICAL)
Senior Advocates, Junior Advocates, Legal Assistants, Clerks, Office Administrators, Reception Staff, Partners

DESIGN LANGUAGE
40% Apple + 25% Vercel + 20% Premium SaaS + 15% Glassmorphism/Neumorphism

Glass only on: Sidebar, Header, Dialogs, Search, Quick Actions, Notifications — NEVER entire pages

VISUAL SYSTEM
Colors:

Background: #F7F9FC (not pure white)

Cards: White

Primary accent: Royal Blue #3B82F6 → Indigo #6366F1 → Purple #A78BFA gradient

Success: #10B981, Warning: #F59E0B, Danger: #EF4444

Text primary: #111827, Text secondary: #6B7280

Borders: #E8ECF3 (very subtle)

Typography:

Headings: Sora (elegant, modern)

Body: Inter (best enterprise UI font)

Numbers: IBM Plex Mono

Sizes: Hero 40px, Page 32px, Section 24px, Card 20px, Body 16px, Helper 14px, Caption 12px

Spacing: 4, 8, 12, 16, 24, 32, 48, 64 — cards always 24px padding

Border Radius: Small 12px, Medium 18px, Cards 22px, Dialogs 28px, Buttons 16px, Search 999px

Shadows: Soft blurred — 0 10px 40px rgba(15,23,42,.08), Hover 0 20px 60px rgba(15,23,42,.12)

Background: Subtle blue gradient + noise texture + large blurred circles + light glow (like Apple's website)

COMPONENT SPECS
Buttons: Gradient primary, glass secondary, ghost tertiary. Hover: translateY(-2px) scale(1.01), Click: scale(.98). 16px radius, tactile feel.

Cards: 22px radius, white, soft shadow, 24px padding, hover lifts with glow

Inputs: 16px radius, glass background, focus glow, floating labels, never square

Search: Large centered glass pill, shadow, magnifying icon, Ctrl+K shortcut hint

Tables: Rounded rows (never Bootstrap style), hover effect, large row height, status pills, avatars, action menus on hover, generous spacing

Dialogs: 28px radius, glass header, large title, soft backdrop blur, scale+fade animation

Charts: Only area, line, donut, bar, sparkline, timeline — NO 3D pie, exploding pie, rainbow

Icons: Lucide, 1.75px stroke, 18-22px sizes, consistent throughout

ANIMATION RULES
Duration 150-250ms. Only fade, scale, slide, opacity, blur. NEVER bounce, elastic, rotate, flash. Page transitions: fade + 10px slide. Cards lift 2px on hover. Feel Apple-like — fluid, natural, purposeful.

NAVIGATION
Floating glass sidebar (290px, 28px radius, 24px blur) — not attached to screen edges. Icons + labels, selected item gets blue-purple gradient pill. Bottom profile section.

Top nav: 72px height, floating glass, contains only Search, Notifications, Quick Actions, Profile, Theme Toggle.

Admin modules: Dashboard, Cases, Clients, Tasks, Documents, Calendar, Chat, Reports, Employees, Approvals, Audit Logs, Settings

Employee modules: Same minus Employees, Approvals, Audit Logs

MODULE REQUIREMENTS
AUTHENTICATION: Premium login with illustration, email/password, forgot password, remember me. Minimal, elegant forms.

ADMIN DASHBOARD: "What should I work on today?" — Overview cards (Cases/Clients/Tasks/Employees/Pending Approval/Today's Hearings), Today's Hearings timeline, Pending Approval Center, Live Activity feed, Employee Status cards, Recent Cases, Recent Documents, Quick Actions panel, Calendar widget, Performance snapshot (NOT analytics overload). Background: subtle gradient with noise texture and floating cards.

EMPLOYEE DASHBOARD: "What should I work on today?" — Today's Hearings, Assigned Work, Priority Cases, Quick Actions, Calendar, Recent Documents, Recent Chats, Call Reminder, Task Progress. Role-specific, no firm-wide metrics.

CASES (Heart of LegalOS): Case workspace, NOT a record. Case Details = central operating screen with left nav (Overview, Hearings, Documents, Tasks, Notes, Timeline, Parties, Activity, Property). Case header hero card with status, priority, assigned, next hearing, quick actions. 5-step Add Case wizard (Basic Info → Clients → Property → Schedule Hearing → Review). Support multiple clients/sub-clients with relationships (Buyer, Seller, Power of Attorney, etc.). Timeline Apple-style. Floating quick actions button.

CLIENTS: Premium digital profile, NOT CRM. Client cards with avatars, status pills (Active/VIP/Corporate/Individual). 5-step wizard (Client Type → Basic Details → KYC → Property → Sub Client). Profile includes: Personal Info, KYC verification cards, Property summary, Cases timeline, Documents (Dropbox-style), Notes (rich text), Timeline, Activity, Relationship Map (visual diagram). Support unlimited sub-clients with relationship descriptions.

TASKS: Apple Reminders style, NOT Jira. Task Dashboard: Today's Tasks → Overdue → Due Today → Upcoming → Completed → Call Reminders. Views: List, Kanban, Calendar. 5-step Create Task wizard. Task cards with priority ribbons, checklist progress, deadlines. Checklist builder with animated completion. Call Reminder system: upcoming calls, missed calls, completed calls, reminder notifications (1 day before → Dashboard → Calendar → Notification).

DOCUMENTS: Dropbox + Apple Finder hybrid, NOT file upload page. NAS-first architecture (UI shows folders/files without exposing technical storage). Layout: Left sidebar (Recent, Favorites, Assigned Cases, Shared, Pending) + Main area (Grid/List toggle) + Preview panel (slides from right). Upload: Large drop zone with drag-drop, 4-step wizard (Select Case → Category → Upload → Review → Submit for Approval). Approval Center for admin: cards with preview, approve/reject. Access request system with permission workflow. Version history timeline. Supports PDF, DOC, DOCX, JPG, PNG, Excel, ZIP preview.

CALENDAR: Google Calendar inspired. Views: Month, Week, Day, Agenda. Color-coded: Hearings (Blue), Tasks (Purple), Call Reminder (Orange), Leave (Green), Firm Events (Indigo). Event cards show title, time, case, client, location, assigned. Create Event wizard. Admin can view all employee calendars. Drag-drop reschedule.

CHAT: WhatsApp-inspired, NOT Slack. NO workspaces/channels/threads/bots. Layout: Conversation list + Chat window + Details panel. Message bubbles: iMessage style (outgoing: blue gradient, incoming: glass white). Read receipts (✓ sent, ✓✓ delivered, ✓✓ blue read). Online status (green dot only). @mentions with notifications. File sharing with preview. Groups admin-managed (employees cannot create). Shared files dedicated page.

REPORTS: Operational insights, NOT financial dashboards. Case Distribution by Practice Area (horizontal bar), Monthly Case Growth, Active vs Closed Cases, Hearing Distribution, Employee Workload, Task Completion, Document Activity, Client Growth, Top Clients. Minimal charts, focus on actionable information.

EMPLOYEES: Premium team management, NOT HR software. Employee cards grid (photo, role, status, workload, today's hearings, tasks). 5-step Add Employee wizard. Profile includes: Overview, Assigned Cases, Clients, Tasks, Calendar, Documents, Activity, Performance, Permissions, Notes. Workload indicator (progress bar showing capacity). Roles: Administrator, Senior Advocate, Junior Advocate, Legal Assistant, Office Staff, Reception, Intern. Permissions: grouped toggles (Apple style) for each module, permission templates per role.

APPROVALS (Admin): Dedicated Approval Center. Categories: Pending Document Uploads, Access Requests, Case Requests, Client Requests. Approval cards with preview thumbnail, linked case, uploader, time, approve/reject/view.

AUDIT LOGS (Admin): Activity logs showing user, action, timestamp, device, IP (optional), details. Filterable and searchable.

SETTINGS: Profile, Firm Details, Roles, Permissions, Appearance, Notifications, Security, Sessions, Integrations, Storage, Backup, About.

UNIVERSAL PAGE STRUCTURE
Hero → Toolbar → Search/Filters → Content → Details → Timeline → Related Items → Footer. Every page: Breadcrumb, clear title, primary action button, empty/loading/error states.

EMPTY/LOADING/ERROR STATES
Empty: Beautiful 3D illustration + friendly message + primary CTA (NEVER "No Data")

Loading: Skeleton shimmer everywhere (cards, tables, charts, timeline) — NO spinners

Error: Glass error card with illustration, retry button, go back option

TECH STACK
React 19, Vite, TypeScript (strict), Tailwind CSS, shadcn/ui, Lucide React, Framer Motion, Recharts, TanStack Table, React Hook Form + Zod, React Router DOM, Context API, TanStack Query ready

FOLDER STRUCTURE
text
src/
├── components/ (ui/, common/, dashboard/, cards/, forms/, tables/, charts/, dialogs/, layout/)
├── pages/
├── layouts/
├── hooks/
├── services/
├── api/
├── contexts/
├── store/
├── types/
├── constants/
├── utils/
├── lib/
└── styles/
CODING RULES
Maximum 250-300 lines per component

Reusable everything — never duplicate code

Custom hooks for repeated logic

TypeScript strict mode everywhere

Lazy loading + code splitting

Memoization where beneficial

GPU-accelerated animations (transform/opacity only)

Design tokens for all values (never hardcode colors/spacing/radius)

RESPONSIVE BREAKPOINTS
Mobile: <640px (bottom nav, single column, tables → cards, dialogs fullscreen)

Tablet: 640-1024px (collapsed sidebar, 2-column grid)

Desktop: 1024-1440px (floating sidebar, full layout)

Large: 1440px+ (max-width 1600px container)

Touch targets minimum 44px

NEVER simply shrink desktop — redesign for each breakpoint

ACCESSIBILITY
Keyboard navigation, visible focus rings, ARIA labels, screen reader support, high contrast text, 44px+ click targets, reduce motion support

QUALITY CHECKLIST (ask before every screen)
Does this feel premium and handcrafted?

Can a non-technical lawyer understand it immediately?

Would Apple simplify this further?

Is it using design tokens (not hardcoded values)?

Are animations 150-250ms with proper easing?

Is spacing generous (not cramped)?

Are empty/loading/error states handled?

BUILD ORDER (sequential phases)
Foundation: Project setup, design tokens, global styles, theme, fonts

Design System: All reusable components (buttons, cards, dialogs, inputs, tables, charts, timeline, toast, search, sidebar, nav, skeletons, badges, avatars, accordions, tabs, breadcrumbs, upload, progress)

Layout: Sidebar, top nav, hero wrapper, responsive grid, page container

Authentication: Login, forgot password, reset

Admin Dashboard

Employee Dashboard

Case Management (list, add wizard, details workspace)

Client Management (list, add wizard, profile)

Task Management (list, kanban, calendar, call reminders)

Document Management (explorer, preview, approval, upload)

Calendar (all views)

Chat (messaging, groups, file sharing)

Reports (operational analytics)

Employee Management (list, profile, permissions)

Admin Center (approvals, audit logs)

Settings

Responsive Polish (all breakpoints)

Motion System (page transitions, micro-interactions)

Final Polish (consistency, accessibility, performance)

FINAL SUCCESS CRITERIA
Visual language consistent across every page

Navigation simple enough for non-technical users

All requested workflows represented in UI

Premium feel without visual overwhelm

Components reusable and maintainable

Responsive and accessible

Motion enhances usability (not decorative)

Empty/loading/error states thoughtful

Looks like one cohesive product, not collection of screens

Demo-ready: would impress a law firm within 5 seconds

```
```FINAL DESIGN PRINCIPLES & QUALITY STANDARDS

The entire application must be built using a centralized Design Token system rather than hardcoded values. All colors, typography, spacing, border radii, shadows, animation durations, opacity values, breakpoints, and other visual properties should be managed through reusable CSS variables or theme tokens to ensure complete consistency, maintainability, and scalability across the entire product.

Motion should never exist purely for decoration. Every animation must have a purpose—to explain an interaction, guide user attention, confirm an action, reduce cognitive load, or create a subtle sense of delight. Animations should feel natural, fluid, and refined, inspired by Apple's interaction design. Every transition, hover state, dialog, page change, and loading sequence should reinforce confidence without becoming distracting or overwhelming.

The interface should include subtle premium details that collectively create the feeling of a high-end enterprise product. This includes intelligent search suggestions, contextual tooltips, elegant segmented controls, soft gradient borders where appropriate, floating utility widgets, premium toggle switches, polished empty states, refined loading experiences, carefully designed status indicators, and thoughtful micro-details that make the software feel handcrafted rather than template-generated.

The emotional experience of using the software is just as important as its functionality. Users should feel calm, organized, confident, efficient, and in control throughout every workflow. The interface should reduce stress, improve focus, and make complex legal operations feel simple and intuitive. Every interaction should reinforce professionalism, trust, and reliability.

Before finalizing any screen, apply the Luxury Test. Ask: Would Apple ship this interface? Would Vercel approve this level of polish? Does this feel handcrafted rather than generated? Is there unnecessary complexity? Can the layout be simplified further? If the answer to any of these questions is no, redesign the screen until it reaches the expected quality standard.

Every screen should follow a set of universal design principles. Each page must have one clear primary objective, common actions should require no more than three clicks, advanced functionality should follow progressive disclosure rather than overwhelming users immediately, and whitespace should be treated as an essential design element that improves readability, hierarchy, and overall visual balance rather than as empty space.

Micro-interactions should be implemented consistently throughout the application. Buttons should provide subtle tactile feedback, cards should gently lift with soft shadows on hover, cursor states should clearly communicate interactivity, success actions should feel satisfying, uploads should include elegant completion animations, toast notifications should appear and disappear smoothly, timelines should reveal information progressively, search interactions should feel responsive, and skeleton loading should replace generic loading spinners with premium shimmer effects.

The component library should be comprehensive and completely reusable. Every button, card, table, dialog, drawer, tab, accordion, breadcrumb, floating action button, timeline, progress indicator, status pill, context menu, tooltip, dropdown, search component, empty state, loading skeleton, notification, chart, avatar, and form control must belong to a single unified design system with consistent styling, spacing, animations, and interaction patterns. No page should introduce components that deviate from the established design language.

Finally, every module should pass a complete quality assurance review before being considered finished. Verify that navigation is intuitive, dashboards prioritize actionable information over unnecessary statistics, case and client workflows remain clear and organized, typography and spacing are consistent, accessibility requirements are met, responsive layouts work flawlessly across desktop, tablet, and mobile devices, performance remains smooth with optimized loading behavior, animations enhance usability rather than distract, and the overall experience feels cohesive, polished, and production-ready. The completed application should present itself as a premium legal operating system that immediately inspires confidence, reflects exceptional craftsmanship, and impresses clients from the very first interaction.```

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e3440773-ac80-4c39-8b82-5465d5836634).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
