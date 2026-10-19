# Gabay lesson revisions

Status: proposed design for teacher review; not implemented.

## Purpose and scope

Teachers should improve an existing ILAW lesson without restarting it or losing their own edits. The approved direction is a consistent **Improve lesson with Gabay** action, a focused instruction panel, and a review step before applying changes. Keep the printable document, direct editing, teaching view, PDF and Word exports, and current save/sync workflow.

This is an architectural change to the editor–Edge Function interface, not just a button rename. It does not include lesson-list navigation/deletion, provider migration, general-chat document editing, or changes to class management.

## Current behavior

- `PlanView` collapses setup after full-plan generation. The toolbar then exposes the same generator with a shorter label.
- `draftCompletePlan` generates a new full plan, applies it immediately, and saves it. Its restore snapshot is temporary React state.
- General chat receives a short context summary, not the complete editable document, and cannot apply changes.
- The existing context sanitizer limits summaries to 16 items of 240 characters. A complete revision source must not be smuggled into that summary and silently truncated.

## Teacher experience

1. New, empty lessons retain **Draft the whole plan with Gabay** and **I'll write it myself**. First-time generation is not a revision.
2. Once the document contains teacher content, show **Improve lesson with Gabay** in a stable position beside the document actions, whether setup is expanded or collapsed. Existing per-cell redraft actions must also use proposal review instead of silently bypassing it.
3. Open an accessible right-side panel (full-width on a small screen), using the existing warm cream, teal, and orange design. Choose **Whole lesson**, **I · Intentions**, **L · Learning Experience**, **A · Assessment**, or **W · Ways Forward**. Each choice covers all grades currently in the lesson; a per-grade scope is out of this first version.
4. Require a short instruction: for example, “Make the activities easier and use materials available in the classroom.” Explain: “Gabay suggests changes. Your lesson stays unchanged until you apply them.”
5. **Suggest changes** captures the current document and generates a proposal. Show Gabay's thinking indicator and readable status. Cancel or close invalidates the pending response; it cannot later apply itself. The document remains editable.
6. Review labeled **Current** and **Suggested** text, grouped by ILAW section and grade. Use stacked comparisons on narrow screens. The preview must include every field that would change, not only an AI-written summary.
7. Each change is initially unselected. Teachers choose changes, then click **Apply selected changes**. A select-all control may select the currently valid proposal items. **Keep my lesson** discards the proposal. An empty proposal is reported as “No changes suggested.”
8. Applying updates the editable local draft, marks it unsaved, and preserves the previous snapshot for **Undo applied changes**. It does not auto-save or invoke cloud writes. Existing **Save lesson**, exports, and teaching actions retain their current save behavior.

The panel is a focused revision tool, not another general chat window. Whole-lesson revision is explicitly different from creating a replacement plan.

## Request and response contract

Add an explicit `revise-plan` task alongside existing draft tasks. Keep all current task contracts compatible.

The request includes a bounded instruction, scope enum, the captured plan's editable content, and a request identity. Send no learner roster, personal names, account details, signatures, or school metadata. Retain existing authentication, origin checks, teacher ownership validation, and privacy redaction. Apply redaction to revision text and instructions as well as normal context.

Use a dedicated, validated revision payload instead of `currentSummary`. Bound the instruction to 2,000 characters, each text field to 4,000 characters, the number of grades to 13, slots to 40, and the total revision payload to 120,000 UTF-8 bytes. Reject oversized or malformed input with a useful error; do not silently truncate the lesson. Unknown task types must return an error instead of falling through to ordinary chat.

Return a typed proposal with an allowlisted field identifier, grade or stable slot ID where relevant, and a nonempty replacement string. A field may appear at most once. Do not accept arbitrary property paths, model-generated executable content, or new grade/slot IDs. The server and client both validate the proposal against the captured source and selected scope.

Initial editable allowlist:

| Scope | Fields Gabay may propose changing |
| --- | --- |
| I | Shared theme; objectives by grade |
| L | Learner context without identifying details; materials; existing slot teacher focus and grade tasks |
| A | Formative assessments, exit tasks, success criteria by grade |
| W | Proposed reflection questions, remediation and enrichment activities by grade; next-session notes |
| Whole lesson | Union of the above |

Keep competencies, competency codes, content/performance standards, teacher/school identity, class, grades, title/topic, subject, date, language, duration, multigrade model, signatures, slot identity/order/stage/timing, and actual post-lesson results unchanged. Teachers can still edit these manually. This conservative first version protects curriculum references and timing while improving teaching content. If an instruction needs protected changes, explain the limitation instead of pretending it was completed.

Do not invent official DepEd approval, curriculum codes, or teaching outcomes. Proposed activities and supports are suggestions, not evidence that teaching occurred. Revised activities should remain aligned with the supplied curriculum references, grades, duration, language, and material constraints.

## State and conflict rules

Use panel states closed, instructions, generating, review, and error. A proposal is separate from the canonical editable plan until applied.

Capture source values before requesting. At apply time compare against the current document:

- Edits outside selected proposal fields are retained exactly.
- If a selected field has changed since capture, mark it as conflicting, disable its selection, and ask the teacher to generate a fresh suggestion for it.
- If class, grade set, subject, topic, language, duration, or slot structure changes, invalidate the entire proposal. Do not apply suggestions to a different lesson or context.
- Reject out-of-scope fields, missing targets, duplicates, empty deletions, invalid types, and no-op changes before displaying an actionable proposal.
- Closing, changing scope, switching plans/accounts, or starting a newer request invalidates any older response. Request cancellation should abort transport where supported, but response identity checks remain mandatory.
- Undo reverts only fields applied by that revision whose current value still equals the applied suggestion. If the teacher subsequently edits a field, keep that edit and report that it was not undone. Do not restore an entire stale plan over unrelated edits.

Both preview rendering and apply/undo use the same pure allowlisted change representation. Applying a whole-lesson proposal is never a blanket object replacement.

## Implementation boundaries

- `app/page.tsx`: stable action, panel state, captured source/request identity, apply/undo wiring, unsaved state; no unrelated restructuring.
- A focused revision panel component: instructions, accessible controls, current/suggested comparisons, selected changes, and errors.
- A new pure `lib/lesson-revisions.ts`: field allowlist, proposal validation, scope enforcement, diff/conflict calculation, apply and conditional undo. Cover it with unit tests.
- `lib/gabay-ai.ts`: typed revision request/result and strict client-side response validation.
- `supabase/functions/gabay-chat/index.ts` and focused shared validation helpers: validated revision task, authorization/privacy handling, scoped prompt and response normalization. Preserve existing generation and chat contracts.

No database migration or new provider is needed. Reuse the existing saved-plan schema and durable write queue only when a teacher explicitly saves through current actions.

## Failure and release behavior

Sign-in required, offline, rate-limited, timed-out, provider failure, oversized input, and invalid response states keep both the current plan and its saved copy untouched. Offer manual editing and retry with the teacher's instruction preserved; avoid silent retry loops. Use bounded request timeouts and retain the existing rate-limit behavior.

Deploy the backward-compatible Edge Function before enabling revision requests in the frontend. Verify existing draft/chat behavior after deployment. Local UI verification can use controlled responses without spending the production API quota. A signed-in staging smoke test must still confirm the deployed contract; a local build alone does not verify a live model.

## Acceptance checks

- Whole lesson and each ILAW scope produce reviewable, scoped proposals.
- Generation, preview, cancellation, errors, and stale responses never mutate/save a lesson.
- Applying a subset changes only those fields and marks the draft unsaved.
- Conflicting edits are preserved; protected metadata/curriculum and slot timing remain unchanged.
- Undo preserves subsequent teacher edits and unrelated changes.
- Malformed, duplicate, out-of-scope, oversized, and unauthorized requests/responses fail safely.
- Existing manual editing, first draft, per-cell suggestions, lesson save/sync, teaching view, PDF, and Word export continue working.
- Keyboard focus, close/Escape, readable labels, screen-reader status, reduced motion, and small-screen comparisons are verified.
- Run the full test suite, production build, and lint. Report the existing generated-video lint exclusions explicitly rather than claiming an unqualified full lint pass.

## Approval gate

Review this written design before creating the implementation plan. No product code for the revision workflow has been changed by this document.
