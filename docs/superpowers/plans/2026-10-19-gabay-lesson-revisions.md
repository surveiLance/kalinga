# Gabay Lesson Revisions Implementation Plan

Execution status (19 October 2026): Tasks 1–4 implemented; 166 tests, TypeScript, scoped app lint, production build, and Deno function check pass. Independent review's five important findings received regression tests and fixes. Browser checks verified the manual-edit revision path, prototype sign-in error, and persisted Delete control. End-to-end selection/undo and confirmation interaction remain unverified in-browser because the native confirmation stalled browser control. Edge Function deployment was attempted but rejected with AccessTokenRequiredError. No signed-in live inference or hosted frontend deployment is claimed. The capability gate prevents unsupported revision calls. Legacy observation strings are deliberately preserved independently, superseding the earlier derived-summary wording below.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution, or superpowers:subagent-driven-development if the user selects that method. Steps use checkbox syntax for tracking.

**Goal:** Add reviewable Gabay revisions without losing teacher edits, and provide editor-to-list navigation and confirmed deletion.

**Architecture:** Keep proposal state separate from `PlanView`'s document state. A shared pure revision contract validates server and client payloads, identifies conflicts, and applies only approved fields. Keep existing generation, exports, and durable save/delete paths.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Edge Functions, Vitest; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-gabay-lesson-revisions-design.md`

## Global Constraints

- Instruction limit: 2,000 characters; each text field: 4,000 characters; grades: 13; slots: 40; total revision payload: 120,000 UTF-8 bytes. Reject rather than truncate.
- Protected metadata, curriculum references, slot structure/timing, and actual results cannot be changed by a proposal.
- No database migration, provider migration, general-chat editing, or unrelated UI restructuring.
- Proposals start unselected; applying marks the document unsaved and never invokes `onSave`.
- Preserve the existing local class-popup and chat-animation changes; leave untracked video/document assets out of commits.
- Navigation/deletion is an additional bounded task authorized by the user's request to implement the previously discussed changes. Reuse the existing deletion queue; do not delete any real records during testing.
- Commit only task-owned files, verify before push, and do not force-push. Edge Function release must precede enabling revisions in the deployed frontend.

## Review Focus

- An in-flight response arriving after close, plan switch, account switch, or a newer request must be ignored.
- A teacher changes one field while reviewing: only that field conflicts, while unrelated edits survive apply and undo.
- A valid-looking provider response includes protected fields or foreign grade/slot IDs: reject it before preview or mutation.
- Newly generated and manually saved plans must immediately support Improve/Delete without requiring an editor remount.
- Navigation with unsaved edits must offer an explicit stay/discard decision and must not trigger implicit saves.

---

### Task 1: Revision contract and safe merge engine

**Files:** Create `supabase/functions/_shared/lesson-revisions.ts`, `lib/lesson-revisions.ts`, `tests/lesson-revisions.test.ts`.

**Interfaces:** Shared module exports `RevisionScope` (`whole|intentions|experience|assessment|forward`), a bounded `RevisionSource` DTO without identity/roster data, `RevisionRequest`, `RevisionChange` (allowlisted field, optional grade/slot ID, replacement), and `RevisionProposal`. `lib/lesson-revisions.ts` reexports shared validation and adapts `SavedPlan` into the DTO without duplicating validation. Shared code has no browser, Node, React, or app-alias dependencies, so Deno can import it directly.

- [ ] Write tests for `validateRevisionRequest(value: unknown): RevisionRequest` and `validateRevisionProposal(value: unknown, request: RevisionRequest): RevisionProposal`, expecting throws for limits, invalid scope, foreign targets, protected fields, duplicate targets, blank replacements, and malformed values. Check exact byte limits using multibyte Filipino text. Valid empty change arrays remain valid; no-ops are filtered.
- [ ] Run `npm test -- tests/lesson-revisions.test.ts` and confirm failures for the missing behavior.
- [ ] Implement validation and `revisionSource(plan: SavedPlan): RevisionSource`. The DTO includes relevant curriculum references for alignment but not teacher/school names, signatures, learner names, or actual results. Implement the spec's explicit field/scope table; never dynamically write arbitrary object paths.
- [ ] Add failing tests for `revisionConflicts(source: RevisionSource, current: RevisionSource, proposal: RevisionProposal): string[]`, `applyRevision(plan: SavedPlan, request: RevisionRequest, changes: RevisionChange[]): { plan: SavedPlan; applied: RevisionChange[] }`, and `undoRevision(plan: SavedPlan, before: SavedPlan, applied: RevisionChange[]): { plan: SavedPlan; skipped: number }`. Prove unrelated fields retain literal fixture values, a changed target cannot apply, structural/context changes invalidate a proposal, and conditional undo keeps subsequent edits. Derived legacy reflection/remediation/enrichment fields must stay consistent with their canonical grade maps without replacing actual outcomes.
- [ ] Implement the pure operations; run the focused tests and full `npm test`. Commit the engine and tests only.

### Task 2: Backward-compatible revision API

**Files:** Modify `lib/gabay-ai.ts`, `supabase/functions/gabay-chat/index.ts`; add focused shared request/response helpers and tests under `tests/` if needed.

**Interfaces:** `requestGabayRevision(request: RevisionRequest, pageContext: GabayPageContext, signal?: AbortSignal): Promise<{ connected: true; proposal: RevisionProposal } | { connected: false; reason: string }>`; request task `revise-plan` with a dedicated revision payload. Keep `GabayDraft` and all current task response shapes unchanged.

- [ ] Write failing boundary tests for dispatching `revise-plan`, rejecting unknown task types, rejecting invalid/oversized requests before inference, validating proposals against scope/source, and redacting instructions/source text without truncating the source. Test that a revision request carries no roster/signature/identity fields. Extract only the pure boundary helpers needed for tests; do not import a live `Deno.serve` into Vitest.
- [ ] Implement the explicit task branch with existing auth, owned-class checks, origins, privacy redaction, and quota enforcement. Reject a missing/foreign class rather than trusting the client DTO. Preserve all existing chat/generation paths.
- [ ] Add a revision prompt that treats source/instructions as data, requires scoped allowlisted changes, aligns with references and classroom constraints, and forbids invented approval/results/codes. Enforce a 60-second inference timeout for revisions, with no automatic retry loop. Validate model output server-side and client-side; preserve original values locally for comparisons after redaction.
- [ ] Add transport tests with controlled Supabase responses for unavailable function, sign-in required, rate limit, timeout, invalid response, and successful proposal. Abort where supported; UI request identities are still required because abort alone is insufficient.
- [ ] Run full tests, app lint excluding existing generated-video assets, and build. Commit the backward-compatible API changes. Do not enable the deployed frontend until the Edge Function is deployed and checked, or provide a capability check that fails safely when the deployed function lacks revision support.

### Task 3: Review panel and planner integration

**Files:** Create `components/lesson-revision-panel.tsx`; modify `app/page.tsx`, `app/globals.css`; add `tests/lesson-revision-panel.test.ts` and request-lifecycle tests.

**Interfaces:** Panel receives the current `SavedPlan`, initial scope, close callback, and `onApply(request: RevisionRequest, changes: RevisionChange[])`. It owns instruction/proposal/selection state, not the canonical plan. `PlanView` applies through Task 1 helpers and uses its existing field setters and `touch()` without saving.

- [ ] Write failing tests for scope choices, required instruction, accessible status, Current/Suggested labels, unselected defaults, conflict-disabled selection, and unavailable/error copy. Use server rendering where sufficient and a pure request-identity helper for stale-response cases; exercise browser interactions separately.
- [ ] Build an accessible nonmodal side panel so the teacher can continue editing the document. Provide named close/Escape behavior, keyboard focus entry/restoration, a close action while generating, narrow-screen layout, thinking indicator, and clear protected-field limitations. Only report a modal if the document is actually inert.
- [ ] Capture source/request ID before inference. Close, scope change, unmount, newer request, or context invalidation aborts/increments identity and clears proposals. Compare current source on every apply; do not rely solely on disabled UI controls. The panel uses the exact pure validated changes for preview and apply.
- [ ] Add a stable Improve action whenever the plan has content, regardless of setup expansion. Retain first-generation controls for an empty plan. Route existing per-cell redraft affordances into scoped proposal review; label them consistently, with no hidden immediate replacement path. The first version covers all grades in the chosen section and says so.
- [ ] Apply selected valid changes, mark unsaved, retain conditional undo data, and show an honest undo result if later edits prevent reverting some fields. Keep Save/Export/Teach behavior unchanged. Prevent a whole-plan generation response from bypassing review once teacher content exists.
- [ ] Run full tests and browser-check controlled success, no changes, error, cancel, stale response, partial selection, live conflict, undo, narrow layout, keyboard, and reduced motion. Use only fictional prototype/staging data; do not spend production quota without approval. Commit panel/integration files.

### Task 4: Lesson navigation, deletion, release verification

**Files:** Modify `app/page.tsx`, `app/globals.css`; add a small testable navigation/confirmation component or pure state helper only if needed for behavior tests.

**Interfaces:** `PlanView` receives `onAllPlans()` and `onDelete(planId: string)`, plus a live persisted-plan signal that includes saves during the current editor session. Back explicitly opens `PlanIndex`, including its empty state; it must not call `openPlanLessons()`'s automatic new-plan fallback.

- [ ] Write failing tests for returning to the list, retaining the editor when an unsaved-leave confirmation is cancelled, showing Delete only after persistence, and passing exactly the current saved ID to deletion after confirmation. A generated/saved new plan must be handled without remounting the editor.
- [ ] Add “← All lesson plans” above the lesson heading and a separate “Delete lesson” action for a persisted plan. Confirm the named lesson with Cancel/Delete. On confirmation, use the existing `deletePlan` queue path and return to the list. No record deletion is performed by development verification against real accounts.
- [ ] Preserve any existing Today navigation where useful; do not silently save on leave. Reuse the same unsaved check for the new list action. Cancelled deletion leaves editor content and proposal state intact.
- [ ] Run `npm test`, `npm run lint -- --ignore-pattern 'brag-output/**'`, `npm run build`, and `git diff --check`. Report the existing unqualified lint failure caused by generated video assets. Verify manual edits, first generation, saved-plan Improve/Delete visibility, PDF/Word generation, and teaching-view navigation in controlled local testing.
- [ ] Conduct a fresh whole-change review, address significant findings with regression tests, and commit only app/tests/contract/documentation files. Include the previously verified class popups and chat thinking indicator in a separate commit if still uncommitted.
- [ ] Check branch/upstream and available deployment tools. Deploy the compatible Edge Function if existing credentials/tooling permit; do not claim a live smoke test without doing it. If deployment is unavailable, keep revision frontend capability-gated and explicitly report the required deployment step.
- [ ] Push the verified commits to the current authorized upstream without force. Report commit IDs, verification results, and whether the Edge Function and hosted frontend are actually deployed, distinguishing pushed source from live functionality.

## Review and execution gate

The spec is approved. This written implementation plan still needs user review and an execution-method choice before coding. Recommended method: inline/native execution, because the four tasks share one small contract and planner state. One independent whole-change review remains required before pushing.
