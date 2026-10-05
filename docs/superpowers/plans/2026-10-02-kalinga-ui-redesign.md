# Kalinga Visual UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Guided Day visual direction across Kalinga without changing any feature, workflow, handler, persistence rule, data flow, or deployment state.

**Architecture:** Keep the existing single-page architecture in `app/page.tsx` and the existing styling surface in `app/globals.css`. Add a source-level UI contract test that protects navigation and view wiring, then update presentation in coherent screen groups; JSX changes are limited to visual wrappers, labels already present in the product, and decorative icon spans that retain the existing callbacks.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript 5.9, Tailwind 4/PostCSS, CSS, Vitest 3.2

**Spec:** `docs/superpowers/specs/2026-10-02-kalinga-ui-redesign-design.md`

## Global Constraints

- This is a visual and information-hierarchy redesign, not a product, feature, or workflow redesign.
- Every existing feature, action, handler result, navigation destination, data model, persistence rule, permission, and privacy boundary remains unchanged.
- `app/page.tsx` continues to own the single-page interface and view-state navigation; do not split the file as part of this work.
- `app/globals.css` remains the primary styling surface.
- Do not modify `lib/*.ts`, Supabase files, database migrations, AI behavior, storage keys, pending-write behavior, print content, Word export content, or user-facing instructional copy.
- The editor, print view, and Word export continue representing the same DepEd Daily Lesson Plan.
- Preserve prototype mode, authentication, offline-first behavior, synchronization feedback, Gabay privacy, and row-level-security assumptions.
- All work remains local on `ui-redesign`; do not push, merge to `main`, or deploy to Vercel.
- Required verification before completion: `npm run lint`, `npm test`, and `npm run build`.

## File structure

- Create `tests/ui-visual-contract.test.ts`: source-level regression checks for preserved navigation/view wiring and the new visual-system hooks. This is intentionally narrow and complements, rather than replaces, browser review.
- Modify `app/page.tsx`: preserve logic and callbacks while adding only the presentational grouping and decorative hooks needed by Guided Day.
- Modify `app/globals.css`: define the design tokens and implement all shell, screen, state, responsive, accessibility, and print-safe presentation.
- Keep `app/layout.tsx` unchanged unless browser inspection proves a metadata or document-level accessibility issue; any such change requires user approval before implementation.
- Keep `output/kalinga-ui-directions.html` as the approved visual reference; do not copy its standalone mockup markup into production.

## Review Focus

- Long class names, custom grade labels, resource titles, and Taglish text must wrap without clipping or pushing actions off-screen; Task 4 adds contract hooks and Tasks 4–7 include narrow-width visual checks.
- Mobile must retain all six current navigation actions and their destinations with usable touch targets; Tasks 2 and 8 test and inspect this explicitly.
- Prototype, authenticated, loading, offline, blocked-sync, and storage-error states must retain their triggers and messages; Tasks 2, 3, 4, and 8 protect their source wiring and visual treatment.
- Gabay, account, notification, resource-reader, confirmation, and menu overlays must remain readable above sticky chrome at narrow and desktop widths; Tasks 4 and 7 inspect those states.
- `@media print` rules and the ILAW export document must remain isolated from application-shell restyling; Tasks 6 and 8 compare print output and assert the print selectors remain present.

---

### Task 1: Visual contract and design-system foundation

**Files:**
- Create: `tests/ui-visual-contract.test.ts`
- Modify: `app/globals.css:1-29`

**Interfaces:**
- Consumes: the current `Home` view switch and CSS root variables.
- Produces: semantic CSS variables `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--border`, `--brand`, `--brand-strong`, `--support`, `--support-soft`, `--success`, `--warning`, `--danger`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--shadow-sm`, and `--shadow-md`; source-level contract tests reused by later tasks.

- [ ] **Step 1: Write the failing visual-foundation contract**

Create `tests/ui-visual-contract.test.ts` with a `readWorkspaceFile(path: string): Promise<string>` helper and a test named `defines the Guided Day semantic token set`. Assert that `app/globals.css` contains each token listed in this task's Produces block and that `body` still uses `--font-ui`.

- [ ] **Step 2: Run the focused test and verify the new-token assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: FAIL because `--surface` and the other Guided Day semantic tokens are not defined.

- [ ] **Step 3: Add the semantic token layer without removing compatibility variables**

Update `:root` in `app/globals.css` to define the produced tokens, then map the existing `--ink`, `--muted`, `--cream`, `--paper`, `--orange`, `--orange-dark`, `--teal`, `--teal-ink`, `--line`, and `--shadow` variables to the new semantic values. Preserve the existing font families and use the approved warm cream, orange, teal, and ink character.

- [ ] **Step 4: Normalize global interaction and typography primitives**

In `app/globals.css`, add shared `:focus-visible`, disabled, selection, body line-height, heading, button, input, select, and textarea presentation that improves consistency without changing dimensions relied on by print rules.

- [ ] **Step 5: Run the focused test**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Run existing logic tests**

Run: `npm test`

Expected: all existing tests pass with no application-logic changes.

- [ ] **Step 7: Commit the foundation**

```bash
git add app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: establish Kalinga visual foundation"
```

### Task 2: Application shell and navigation

**Files:**
- Modify: `tests/ui-visual-contract.test.ts`
- Modify: `app/page.tsx:1017-1094`
- Modify: `app/globals.css:27-127` and existing shell/mobile overrides

**Interfaces:**
- Consumes: the Task 1 tokens and current `view`, `setView`, `openPlanLessons`, `openTutorial`, `syncState`, `retrySync`, account, notification, and Gabay callbacks.
- Produces: refined `.app-shell`, `.sidebar`, `.nav-list`, `.nav-item`, `.workspace`, `.topbar`, `.content`, `.mobile-nav`, `.connection`, account, notification, and Gabay topbar presentation; decorative `.nav-icon` hooks that do not own behavior.

- [ ] **Step 1: Add navigation and view-wiring contract assertions**

Add tests named `preserves desktop navigation destinations`, `preserves mobile navigation destinations`, and `preserves view component wiring`. Read `app/page.tsx` and assert the current labels and callback fragments remain present for Today, Classes & learners, Plan lessons, Find resources, Ask teachers, Learn Kalinga, teaching, attendance, library, community, and Gabay open/close behavior. Assert there are still desktop and mobile navigation landmarks with their existing accessible labels.

- [ ] **Step 2: Add failing assertions for the new shell hooks**

Assert that every desktop `.nav-item` includes a `.nav-icon` child and a visible label child, and that `.sidebar-status` is present while `.offline-card` compatibility remains supported during the transition.

- [ ] **Step 3: Run the focused tests and verify only the new-hook assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: the existing flow assertions pass and the `.nav-icon`/`.sidebar-status` assertions fail.

- [ ] **Step 4: Add decorative navigation hooks without changing callbacks**

Update the desktop navigation button children in `Home` so each retains its existing `className`, `type`, active condition, and `onClick`, while receiving a decorative `.nav-icon` and visible label span. Rename or wrap the teaching-kit presentation with `.sidebar-status` while preserving its text and content.

- [ ] **Step 5: Restyle the desktop and mobile shell**

Implement the Guided Day sidebar, topbar, content-width, active navigation, sync status, account, notifications, and Gabay topbar styling in `app/globals.css`. Preserve sticky behavior, overlay stacking, the existing mobile navigation visibility breakpoint, and all current responsive destinations.

- [ ] **Step 6: Verify contract, lint, and desktop/mobile shell visually**

Run: `npx vitest run tests/ui-visual-contract.test.ts && npm run lint`

Expected: PASS.

Capture local screenshots at approximately 1440×1000 and 390×844. Confirm all navigation labels/actions remain available, active state is clear, the mobile bar does not overlap content, and sync/Gabay/notification controls remain readable.

- [ ] **Step 7: Commit the shell**

```bash
git add app/page.tsx app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: refine Kalinga application shell"
```

### Task 3: Guided Day Today screen

**Files:**
- Modify: `tests/ui-visual-contract.test.ts`
- Modify: `app/page.tsx:1069-1084,1353-1385`
- Modify: `app/globals.css` Today, briefing, schedule, and home-action sections

**Interfaces:**
- Consumes: `activeClass`, `todayTeachingBlocks`, `nextTeachingBlock`, `missingPlanCount`, `attendanceSavedCount`, `latestPlan`, `activeAttendance`, and the existing Today callbacks.
- Produces: Guided Day visual hierarchy using the existing `GabayTodayBriefing`, `TodayScheduleSummary`, `.home-essentials-grid`, `.home-action-card`, and `.home-essential-actions` structures.

- [ ] **Step 1: Add the Today behavior contract**

Add a test named `preserves Today actions and data sources`. Assert the source still passes the current props into `GabayTodayBriefing` and `TodayScheduleSummary`, still uses `latestPlan ? openTeachingPlan(latestPlan.id) : beginPlan()`, and still routes attendance, library, class setup, and sample-class actions to their current handlers.

- [ ] **Step 2: Add failing assertions for Guided Day hierarchy hooks**

Assert the Today source contains `.home-guided-day`, `.home-primary-context`, and `.home-quick-actions` while retaining the existing child component names.

- [ ] **Step 3: Run the focused tests and verify only new hierarchy assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: Today behavior assertions pass; the new class-hook assertions fail.

- [ ] **Step 4: Add presentation-only Today wrappers**

Wrap the current briefing, notices, schedule summary, and action card with the produced class hooks. Do not add derived state, new handlers, new feature cards, new readiness calculations, or new copy. Keep empty-class behavior inside `GabayTodayBriefing` unchanged.

- [ ] **Step 5: Apply the Guided Day styling**

Restyle the briefing as the primary contextual surface, place schedule and quick actions in a balanced desktop grid, create a clear current/next schedule emphasis, and keep Gabay supportive rather than dominant. Reflow to one column on mobile and preserve every existing action.

- [ ] **Step 6: Verify populated, empty, notice, desktop, and mobile states**

Run: `npx vitest run tests/ui-visual-contract.test.ts && npm run lint`

Expected: PASS.

In prototype mode, inspect the no-class state and the sample-class populated state at desktop and mobile widths. Confirm the same controls trigger the same views as before.

- [ ] **Step 7: Commit the Today screen**

```bash
git add app/page.tsx app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: apply Guided Day to Today"
```

### Task 4: Shared page patterns, feedback states, and overlays

**Files:**
- Modify: `tests/ui-visual-contract.test.ts`
- Modify: `app/page.tsx:1097-1385`
- Modify: `app/globals.css` login, PageIntro, zero-state, form, menu, dialog, notice, status, notification, tutorial-offer, and Gabay sections

**Interfaces:**
- Consumes: `LoginScreen`, `AccountMenu`, `NotificationPanel`, `PageIntro`, `TutorialOffer`, `TutorialView`, `GabayMascot`, `GabayTodayBriefing`, and `GabayGuide` with their current props.
- Produces: consistent `.page-intro`, action, field, empty-state, notice, alert, menu, dialog, and assistant presentation shared by later screen tasks.

- [ ] **Step 1: Add shared-state contract assertions**

Add tests named `preserves authentication and prototype actions`, `preserves sync and storage feedback`, and `preserves Gabay privacy and dialog wiring`. Assert the existing submit callbacks, prototype continuation, `role="alert"`, `role="status"`, retry behavior, Gabay `aria-haspopup`, `aria-expanded`, close, sign-in request, and privacy copy remain present.

- [ ] **Step 2: Add failing assertions for consistent shared hooks**

Assert `PageIntro` renders `.page-intro-copy` and `.page-intro-action`, and assert the stylesheet contains unified selectors for `:focus-visible`, `.notice`, `.storage-alert`, `.class-zero-state`, `.account-menu`, `.notification-panel`, `.gabay-chat-popover`, and disabled controls.

- [ ] **Step 3: Run the focused tests and verify new wrapper assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: preserved-flow assertions pass; the new `PageIntro` wrapper assertions fail.

- [ ] **Step 4: Add shared presentational wrappers**

Update `PageIntro` with the produced wrapper classes while preserving all rendered content and action nodes. Add only class hooks needed to distinguish headings, body copy, actions, and status areas in shared components; do not change their state or callbacks.

- [ ] **Step 5: Restyle shared components and overlays**

Use the Task 1 tokens to standardize page intros, primary/secondary/destructive buttons, forms, zero states, notices, authentication, tutorial surfaces, account/notification menus, Gabay chat, dialogs, and disabled/focus states. Ensure overlays remain above sticky chrome and fit within 390×844 without obscuring close controls.

- [ ] **Step 6: Verify long-content and overlay states**

Run: `npx vitest run tests/ui-visual-contract.test.ts && npm run lint`

Expected: PASS.

Inspect login/prototype mode, account menu, notifications, Gabay open/closed, storage alert styling, a zero state, and long heading/body content at desktop and mobile widths.

- [ ] **Step 7: Commit shared patterns**

```bash
git add app/page.tsx app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: unify Kalinga shared interface patterns"
```

### Task 5: Classes, learners, and attendance

**Files:**
- Modify: `tests/ui-visual-contract.test.ts`
- Modify: `app/page.tsx:1638-1885,2813-2907`
- Modify: `app/globals.css` class hub, class setup, roster, schedule, attendance, picker, and status sections

**Interfaces:**
- Consumes: `ClassesView` and `AttendanceView` current props, state, steps, tabs, save/delete handlers, grade selection, roster editing, date navigation, and attendance status handling.
- Produces: consistent workspace, form-step, roster, schedule, and attendance presentation with unchanged behavior.

- [ ] **Step 1: Add class and attendance flow contracts**

Add tests named `preserves class setup steps and actions` and `preserves attendance controls and saving`. Assert the current three class steps, workspace tabs, `onSave`, `onDelete`, `onPlan`, `onTeach`, `onAttendance`, date navigation, status options, notes, and `saveVisibleAttendance` wiring remain present.

- [ ] **Step 2: Add failing assertions for screen-level visual hooks**

Assert the source includes `.class-workspace-surface` and `.attendance-workspace-surface` around the existing screen content.

- [ ] **Step 3: Run focused tests and verify only visual-hook assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: preserved-flow assertions pass; new surface-hook assertions fail.

- [ ] **Step 4: Add the screen-level wrapper hooks**

Add the produced classes around current class workspace and attendance content without moving state, changing form order, changing labels, or replacing callbacks.

- [ ] **Step 5: Restyle classes, roster, schedule, and attendance**

Apply clear section hierarchy, consistent tabs and form controls, readable roster rows, stronger selected-class/date context, and touch-friendly attendance statuses. Preserve tables where currently used and the existing mobile adaptations.

- [ ] **Step 6: Verify representative flows**

Run: `npx vitest run tests/ui-visual-contract.test.ts && npm test && npm run lint`

Expected: PASS.

Manually compare new class creation, editing each setup step, switching workspace tabs, deleting confirmation, attendance date movement, status selection, notes, and save feedback at desktop and mobile widths.

- [ ] **Step 7: Commit class and attendance styling**

```bash
git add app/page.tsx app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: clarify class and attendance workspaces"
```

### Task 6: Lesson-plan index, editor, and teaching guide

**Files:**
- Modify: `tests/ui-visual-contract.test.ts`
- Modify: `app/page.tsx:1886-2611`
- Modify: `app/globals.css` plan-index, planner, ILAW editor, teaching-guide, grade-tab, and print sections

**Interfaces:**
- Consumes: `corePlanTasksReady`, `TeachingView`, `IlawPlanPrint`, `EditCell`, `PlanIndex`, and `PlanView` with all current props and handlers.
- Produces: visually consistent plan selection, editor, teaching flow, readiness, and classroom guide while preserving export markup.

- [ ] **Step 1: Add planner and teaching behavior contracts**

Add tests named `preserves plan index actions`, `preserves planner save draft and teach actions`, `preserves teaching block navigation`, and `preserves ILAW print structure`. Assert current open/new/back/delete, save, Gabay draft, teach, print, attendance, block-step, grade differentiation, and `IlawPlanPrint` wiring remain present. Assert `.ilaw-export-document`, `.ilaw-print-meta`, `.ilaw-flow-table`, and `@media print` remain in the source and stylesheet.

- [ ] **Step 2: Add failing assertions for plan workspace hooks**

Assert `.plan-workspace-surface` and `.teaching-workspace-surface` wrap the current plan and teaching content.

- [ ] **Step 3: Run focused tests and verify only new hook assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: behavior/export assertions pass; new surface-hook assertions fail.

- [ ] **Step 4: Add presentation-only plan and teaching wrappers**

Add the produced classes without changing plan state, generation validation, edit fields, callbacks, print markup, or export content.

- [ ] **Step 5: Restyle plan and teaching screens**

Improve plan-list scanning, ILAW section hierarchy, grade tabs, editor field states, teaching-block navigation, active block emphasis, readiness presentation, and supporting reference sections. Scope application-shell styles so `.ilaw-export-document` and print output remain stable.

- [ ] **Step 6: Verify planner, teaching, and export parity**

Run: `npx vitest run tests/ui-visual-contract.test.ts && npm test && npm run lint`

Expected: PASS.

Manually compare creating/opening/selecting/deleting plans, drafting with Gabay, editing all ILAW sections, mobile grade switching, teaching block navigation, attendance handoff, browser print preview, PDF output, and Word export content.

- [ ] **Step 7: Commit plan and teaching styling**

```bash
git add app/page.tsx app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: refine lesson planning and teaching views"
```

### Task 7: Resources, community, tutorial, and remaining states

**Files:**
- Modify: `tests/ui-visual-contract.test.ts`
- Modify: `app/page.tsx:1245-1307,2612-2812,2908-3089`
- Modify: `app/globals.css` resource library, resource reader, community, tutorial, upload, discussion, filter, and responsive sections

**Interfaces:**
- Consumes: `TutorialView`, `LibraryView`, `CommunityView`, resource preview/upload/share/comment callbacks, authentication gates, discussion/reply handlers, mentions, and notification-opening behavior.
- Produces: cohesive discovery, trust-label, reader, discussion, onboarding, and community presentation with unchanged permissions and actions.

- [ ] **Step 1: Add resource, community, and tutorial flow contracts**

Add tests named `preserves resource actions and transparency`, `preserves community actions and authentication gates`, and `preserves tutorial progress`. Assert the existing upload, filter, preview, PDF, discuss, share, visibility, rights-confirmation, comment, sign-in, discussion, reply, mention, exit, Ask Gabay, and progress callbacks remain wired.

- [ ] **Step 2: Add failing screen-hook assertions**

Assert `.resource-workspace-surface`, `.community-workspace-surface`, and `.tutorial-workspace-surface` are present in the relevant view roots.

- [ ] **Step 3: Run focused tests and verify only visual-hook assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: preserved-flow assertions pass; new surface-hook assertions fail.

- [ ] **Step 4: Add screen wrapper hooks**

Add the produced classes to existing roots without altering authentication branches, resource metadata, privacy/transparency copy, comment/reply behavior, or tutorial state.

- [ ] **Step 5: Restyle remaining screens and overlays**

Apply consistent cards, metadata hierarchy, filter tabs, upload sections, visibility/trust labels, PDF reader layout, discussion threads, tutorial progress, and empty/auth-gated states. Preserve long-form readability and overlay close/actions at mobile widths.

- [ ] **Step 6: Verify representative states**

Run: `npx vitest run tests/ui-visual-contract.test.ts && npm test && npm run lint`

Expected: PASS.

Inspect starter resources, private/shared/community labels, upload form, PDF reader, comments, signed-out community, discussion/reply composer, mentions, tutorial steps, and notification navigation at desktop and mobile widths.

- [ ] **Step 7: Commit remaining screen styling**

```bash
git add app/page.tsx app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: unify resources community and onboarding"
```

### Task 8: Responsive, accessibility, and whole-app verification

**Files:**
- Modify: `tests/ui-visual-contract.test.ts`
- Modify: `app/globals.css` responsive, reduced-motion, focus, overflow, and print sections
- Restore if generated: `next-env.d.ts`

**Interfaces:**
- Consumes: every visual hook and preserved-flow contract from Tasks 1–7.
- Produces: final responsive and accessibility polish with a clean working tree containing only intentional redesign files and the approved docs/mockup.

- [ ] **Step 1: Add final static accessibility and responsive contracts**

Add tests named `keeps visible focus and reduced motion`, `keeps mobile navigation touch sizing`, `keeps long content wrappable`, and `keeps print rules scoped`. Assert `:focus-visible`, `prefers-reduced-motion`, a mobile-nav minimum target of at least 44 pixels, overflow/wrapping rules for user content, and the existing print selectors are present.

- [ ] **Step 2: Run focused tests and verify any missing final assertions fail**

Run: `npx vitest run tests/ui-visual-contract.test.ts`

Expected: FAIL only for final responsive/accessibility rules not already satisfied.

- [ ] **Step 3: Implement the minimum final responsive and accessibility adjustments**

Update `app/globals.css` to satisfy the failing contracts. Remove obsolete overrides only when browser comparison proves the replacement covers the same state. Do not change JSX behavior in this task.

- [ ] **Step 4: Restore generated files that are unrelated to the redesign**

If `next-env.d.ts` differs only because `next dev` rewrote `.next/types/routes.d.ts` to `.next/dev/types/routes.d.ts`, restore the repository version so it is not included in a redesign commit. Preserve any unrelated user changes discovered during `git diff` review.

- [ ] **Step 5: Run the full automated verification suite**

Run: `npm run lint && npm test && npm run build`

Expected: lint exits 0, all Vitest tests pass, and the Next.js production build completes successfully.

- [ ] **Step 6: Run the whole-app visual matrix locally**

At approximately 390×844, 768×1024, 1280×800, and 1440×1000, inspect authentication, Today empty/populated, classes overview/setup/roster/schedule/lessons, plan index/editor, teaching guide, attendance, library/upload/reader, community signed-out/signed-in/thread, tutorial, Gabay, account, notifications, and error/status states. Confirm no horizontal page overflow, clipped actions, unreadable text, or overlay collisions.

- [ ] **Step 7: Run the unchanged-flow manual checklist**

In prototype mode, exercise navigation, sample-class loading, class create/edit/delete, plan create/save/open/select/delete, teaching block movement, attendance edit/save/date movement, resource filtering/preview, community authentication gate, tutorial progress, Gabay open/close, account menu, notification menu, and offline/sync presentation. Confirm each action reaches the same state or handler as before.

- [ ] **Step 8: Review the final diff for scope**

Run: `git diff --check && git status --short && git diff --stat && git diff -- app/page.tsx app/globals.css tests/ui-visual-contract.test.ts`

Expected: no whitespace errors; no changes to `lib`, Supabase, migrations, exports, package manifests, or deployment configuration; only approved UI/docs/mockup changes remain.

- [ ] **Step 9: Commit final responsive polish**

```bash
git add app/page.tsx app/globals.css tests/ui-visual-contract.test.ts
git commit -m "style: complete responsive Kalinga redesign"
```

- [ ] **Step 10: Stop before remote or deployment actions**

Report the local branch, verification results, screenshots reviewed, and remaining untracked/modified files. Do not push, merge, or deploy without explicit user approval.
