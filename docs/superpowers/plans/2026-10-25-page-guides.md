# Page-Specific Gabay Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for direct implementation, or superpowers:subagent-driven-development if the user selects delegated implementation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer each teacher an optional guide once per page, with manual replay and no cross-page tutorial state.

**Architecture:** Add pure page-guide definitions and versioned per-page preferences in `lib/page-guides.ts`. Reuse the current walkthrough component's geometry, clipping, docking and focus safeguards, but replace its global sequence with page-local steps selected from the current visible context. Keep active UI bound to both workspace scope and page; persist preferences under the existing `tutorial-status` key.

**Tech Stack:** Existing Next.js 16, React 19, TypeScript and Vitest; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-page-guides-design.md`

## Global Constraints

- Gabay explains and highlights only; guide controls must never call AI or mutate teacher content.
- No forced navigation, tutorial sidebar tab, new backend behavior, new storage-key convention, or nonfunctional video link.
- First-visit invitations are non-blocking, do not steal focus, and defer while another modal or Gabay chat is open.
- Remember invitation/completion per page and per workspace on this browser.
- Keep class, learner, lesson, attendance, resource-sharing, community and authentication functionality unchanged.
- Preserve existing reduced-motion, visible-target clipping and non-overlapping dock behavior.
- Keep the separate email-confirmation work and unrelated untracked assets untouched.

## Review Focus

- A queued observer or persistence callback from the previous workspace must not update the new teacher's preferences.
- Fast page changes must hide stale invitations, guide copy and highlights in the render itself, not only after an effect.
- Class modal transitions and plan list/setup/document contexts must use only their currently available controls.
- Unavailable storage, old global progress and preference hydration must not trigger repeated invitations or restore the wrong step.
- Existing data controls must remain usable on narrow screens, with keyboard navigation and reduced motion.

---

## Task 1: Page definitions and scoped preferences

**Files:** Create `lib/page-guides.ts` and `tests/page-guides.test.ts`. Keep existing walkthrough exports until Task 2 replaces their consumers.

**Interfaces:**

- `PageGuidePage = "home" | "classes" | "plan" | "teach" | "library" | "attendance" | "community"`.
- `PageGuideStatus = { version: 3; pages: Partial<Record<PageGuidePage, { offered: boolean; completed: boolean }>> }`.
- `PageGuideStep = { id: string; title: string; body: string; targets: string[] }`.
- `readPageGuideStatus(value: string | null): PageGuideStatus` returns normalized preferences; old dismissed/completed global status suppresses all automatic offers without migrating numeric steps.
- `markPageGuideOffered(status: PageGuideStatus, page: PageGuidePage): PageGuideStatus` and `completePageGuide(status: PageGuideStatus, page: PageGuidePage): PageGuideStatus` return immutable updates for that page only.
- `shouldOfferPageGuide(status: PageGuideStatus, page: PageGuidePage, ready: boolean, blocked: boolean): boolean` is false before hydration, while blocked, and after the page has been offered.
- `pageGuideSteps(page: PageGuidePage, markers: string[]): PageGuideStep[]` returns only steps relevant to the current page and visible context, with stable step IDs.

- [ ] **Write failing tests** for once-per-page eligibility, manual replay independent of completion, immutable updates, all seven pages, partial/malformed version-3 records and migration from old completed/dismissed/in-progress records. Assert that future/unknown versions suppress automatic offers safely while retaining manual help.
- [ ] **Write context tests** for empty Classes versus overview, class-details/schedule/learners modals, plan index versus setup versus saved document, resource reader versus library, and signed-out community. Assert that markers from another page cannot select its steps, including persistent sidebar markers.
- [ ] **Run** `npm test -- tests/page-guides.test.ts`; confirm the new module/API is missing before implementation.
- [ ] **Implement** the pure interfaces and concise guide copy. Inventory the existing `data-tour` markers in `app/page.tsx`; use those markers rather than guessed DOM text. Class guidance explains the current wizard step without requiring advancing/saving; lesson guidance covers ILAW review, teacher editing, optional AI revision and PDF/Word export without executing them.
- [ ] **Run** `npm test -- tests/page-guides.test.ts`; expect all assertions to pass.
- [ ] **Commit** only the new module/tests and approved page-guide design/plan: `feat: define page-specific Gabay guide preferences`.

## Task 2: Invitations, guide lifecycle and integration

**Files:** Modify `components/gabay-walkthrough.tsx`, `lib/gabay-walkthrough.ts`, `app/page.tsx`, `app/globals.css`, `tests/gabay-walkthrough.test.ts`, `tests/gabay-walkthrough-ui.test.ts`; create `tests/page-guide-lifecycle.test.ts`.

**Interfaces:**

- Consume Task 1's `PageGuidePage`, `PageGuideStatus`, `PageGuideStep` and pure preference/context functions.
- `WalkthroughOffer` accepts the page label, `onShown`, `onStart` and `onDismiss`; renders an in-flow invitation rather than opening a dialog. Invoke `onShown` only when the offer is eligible and mounted, without moving focus.
- `WalkthroughCard` receives its actual `PageGuideStep`, zero-based index and page-local total, rather than indexing a global sequence. It provides Back, Next/Finish, minimize and exit; no chapter selector or cross-page directions.
- `GabayWalkthrough` receives `page`, `motion`, `onComplete` and `onExit`; step selection is internal and page-local. Reuse `placeWalkthrough`, `clipWalkthroughHighlight` and `canRestoreWalkthroughFocus` from `lib/gabay-walkthrough.ts`.
- Export a pure `isCurrentPageGuide(active: { scope: string; page: PageGuidePage } | null, scope: string, page: PageGuidePage): boolean` for render gating and lifecycle tests.

- [ ] **Write failing UI tests** requiring a non-modal invitation, exact “Show me”/“Not now” choices, readable page-local count, “Guide this page” access and no global chapter selector. Preserve geometry/focus regression tests while replacing obsolete global-sequence assertions.
- [ ] **Write failing lifecycle tests** for page mismatch, scope mismatch, empty scope, stale workspace callbacks and modal-blocked invitation eligibility. Assert that completing one page does not complete another and that guide navigation has no content-mutating callbacks.
- [ ] **Run** `npm test -- tests/gabay-walkthrough.test.ts tests/gabay-walkthrough-ui.test.ts tests/page-guide-lifecycle.test.ts`; confirm the intended new behavior fails.
- [ ] **Replace global step/progress state** in `app/page.tsx` with per-page preferences and an active `{ scope, page }` identity. Read/write through `workspaceStorageKey(scope, "tutorial-status")`. Capture and validate the originating scope for preference callbacks; retain in-memory status if persistence fails. Do not let tutorial-preference failure clear or alter teacher data.
- [ ] **Gate rendering synchronously** on hydrated scope and current page. Unmount the old guide immediately on navigation/account changes. A manually reopened guide starts from the current page/context, not the old global step. Remove the old first-run modal offer and global chapter logic.
- [ ] **Add invitation blocking** using existing UI state plus visible modal detection (class/resource modals are owned by child views). Observe only changes needed to update the blocker, clean up listeners/observers on unmount, and do not persist “offered” until the invitation actually displays. Mark it shown once so it does not reappear after navigating away without choosing a button.
- [ ] **Add manual access** beside Ask Gabay in the responsive topbar; change Gabay's menu action to “Guide this page.” Starting help closes Gabay chat so they cannot cover each other. Place the automatic invitation in document flow rather than over form controls, with subdued motion and no focus stealing.
- [ ] **Adapt the guide renderer** to visible context and stable step IDs. A modal/context change selects the relevant local steps; closing the modal returns to the page overview. Clear stale highlights before the new measurement is ready, never select hidden/background targets, and offer a safe exit if no steps are available. Do not require teacher actions, saving or AI to finish.
- [ ] **Keep docking/cleanup intact:** use the existing workspace/class/resource dock hosts, clipping and reduced-motion rules; remove dock attributes and resize/scroll/mutation observers on page change, exit or scope change. Restore focus only to a still-valid control on the current surface.
- [ ] **Run focused tests**, then `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; require successful exits before claiming completion.
- [ ] **Verify in the local browser** at desktop and mobile sizes: fresh page offer, dismiss/reload/revisit, manual replay, navigation midway, class wizard steps and close, saved/new lesson contexts, resource reader, account switch, reduced motion and no overlap. Use local demo/sample data; do not send AI requests, upload/post or modify live teacher records merely to test a guide. Save screenshots as proof.
- [ ] **Review the final diff** against the spec and five review-focus cases. Confirm no lesson/class mutation handlers, live auth settings or email-handoff files changed. Commit task files only: `feat: replace global tour with optional page guides`.

## Plan self-review

The preference tests cover invitation timing, migration and page independence; lifecycle tests plus browser verification cover scope/page changes and context changes. Geometry regression coverage stays in place. No new infrastructure is needed, and the overview video/email work remains out of scope. This is one feature with two sequential tasks; direct implementation in this session is the recommended execution method.
