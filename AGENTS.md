<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Reusable Frontend Quality Workflow

Follow this engineering workflow when developing, debugging, refactoring, or reviewing frontend components and screens in this project:

### 1. Project Inspection & Architecture Respect
- Before editing or creating code, inspect the existing structure, framework (`React 19` + `Vite` + `@tanstack/react-router` + `Tailwind CSS v4`), state management, and component architecture.
- Follow existing patterns and established libraries (Radix UI primitives, Lucide icons, Sonner for toasts, Recharts, React Hook Form + Zod).
- Avoid unnecessary dependencies, duplicated components, giant monofilies, unexplained abstractions, and unrelated refactors.

### 2. Systematic Planning & Design Decisions
- Plan significant structural or UX changes before implementation.
- For UI decisions, layouts, visual hierarchy, and polished interfaces, apply installed design skills:
  - **`design-taste-frontend`**: Art direction, avoiding generic AI-generated aesthetics, clear layout contrast and typographic choices.
  - **`emil-design-eng`**: Micro-interactions, interface polish, and invisible craft details.
  - **`pick-ui-library`**: Consult before adding new UI components to reuse existing stack libraries rather than reinventing wheels or adding redundant dependencies.
  - **`apple-design`**: Fluid gestures, spring animations, depth/translucency, and typography principles when appropriate.

### 3. Motion & Animation Standards
- **`animate`** & **`find-animation-opportunities`**: Introduce intentional, purposeful animations where motion improves clarity.
- **`review-animations`** & **`improve-animations`**: Keep transitions snappy, natural, interruptible, and consistent.
- **`animation-performance`**: Animate composite-only properties (`transform`, `opacity`), maintain frame budgets, avoid main-thread jank, and respect `prefers-reduced-motion`.

### 4. Code Quality, Review & Security
- **`code-review-and-quality`**: Review changes for correctness, maintainability, architectural cleanliness, performance, and code quality.
- **`security-and-hardening`**: Audit user input handling, authentication, sensitive tokens, data sanitization, and OWASP recommendations.
- **`web-design-guidelines`**: Audit against Web Interface Guidelines and accessibility (WCAG, keyboard navigation, focus management, semantic HTML).

### 5. Systematic Debugging & Test-Driven Development (TDD)
- **`debugging-and-error-recovery`**: When errors, broken builds, or regressions occur, use systematic root-cause analysis, reproduction, and hypothesis testing instead of guessing or applying random speculative patches.
- **`test-driven-development`**: For new logic, utility functions, state transformations, and bug fixes, write or update tests, run them, and ensure all pass cleanly.

### 6. Edge Case Stress-Testing & Responsive Design
- **`break-ui`**: Stress-test UI components with edge cases: long strings, unbreakable emails, empty states, zero items, huge counts, non-Latin text, missing data, and unexpected inputs.
- **`mobile-native`**: Verify responsive mobile behavior, touch targets (minimum 44x44px), tap highlight handling, viewport heights, input zoom prevention, safe areas, and notch padding.

### 7. Verification & Tooling Execution
- If Playwright MCP or Chrome DevTools MCP is available, inspect running components and verify real browser interactions.
- Always run the relevant project validation commands when available:
  - Linting: `npm run lint`
  - Build checks: `npm run build` or `npm run build:client`
  - Type-checking / Tests: `npm run test` (or relevant test suites)
- Fix any identified failures and rerun the verification checks.
- **Strict truthfulness**: Never claim a test, browser check, or build passed unless it was actually executed successfully. Honestly report any remaining failures or blockers.

