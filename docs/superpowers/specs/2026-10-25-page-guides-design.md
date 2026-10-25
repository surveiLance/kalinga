# Page-specific Gabay guides

## Intent

Replace the long cross-page walkthrough with optional help for the page the teacher is using. Make help discoverable without requiring a teacher to complete a tutorial or interrupting their work.

## Agreed behavior

- On a teacher's first visit to each main page, show a small, non-blocking Gabay invitation: “Want me to show you how this page works?”
- “Show me” starts only that page's guide. “Not now” dismisses the invitation.
- Remember the invitation per page; do not repeat it on every visit.
- Keep “Guide this page” available beside Ask Gabay, including after dismissal or completion.
- A page change closes the active guide. Never carry instructions or highlights into another page, force navigation, or automatically start the next page's guide.
- Gabay explains and highlights only. Teachers enter information and choose whether to generate, apply, save, export, upload or post.
- A general overview video remains separate. Creating the video is not part of this change; do not add a nonfunctional video link.

## Approaches

- **Selected:** page-specific guides with a first-visit invitation and manual replay. This preserves hands-on help without the existing 19-step cross-page dependency.
- Manual-only guides: less interruption, but less discoverable; the teacher chose automatic invitations instead.
- Keep the single cross-page tour: preserves existing onboarding, but can leave teachers following instructions for a different page; rejected.

## Implementation boundaries

Reuse the existing React UI, guide positioning, reduced-motion support and account-scoped `tutorial-status` storage convention. No AI requests, new dependencies, routes or backend changes are needed for the guides.

Builder choices:

- Track invitation and guide completion independently for Today, Classes & learners, Plan lessons, Teaching guide, Attendance, Find resources, and Ask teachers. Plan list/setup/document are contexts within the lesson page, not separate automatic invitations.
- Use a gentle appearance, not blinking. Do not steal focus or open a blocking dialog for the invitation; leave it readable until dismissed, started or the teacher navigates away. Never let it cover active form controls.
- Defer an automatic invitation while a modal, another guide or Gabay chat is open. Only mark the invitation as seen when actually displayed; persist the record per workspace on this browser. If storage fails, avoid repeated offers within that session and keep manual help available.
- Start guides only after workspace preferences finish loading. Clear active guide state on account/scope changes; never reuse another teacher's progress.
- Migrate the old global status to the new version without resuming its numeric step on an unrelated page. Preserve an existing global dismissal/completion by suppressing automatic offers for that workspace; manual page help remains available.
- Use short, relevant steps. Class setup follows its actual open wizard step. Lesson help distinguishes starting a plan, reviewing/editing ILAW, improving with Gabay and exporting, without requiring generation or a save just to finish a guide.
- If a target disappears, remove its highlight immediately. Do not highlight a substitute control on another page or leave an empty tutorial blocking the teacher. Closing a modal ends modal-specific guidance or returns to the page's relevant overview.

## Non-goals

No changes to class, learner, lesson, attendance, resource-sharing, community or authentication functionality. Do not add a tutorial navigation tab. The separately planned email-confirmation handoff remains separate work.

## Acceptance checks

- First visit offers once; dismissal, reload, revisit and manual replay behave correctly for each page and workspace.
- Navigating during a guide removes stale copy/highlights and never forces the teacher back.
- Class wizard steps, saved and new lessons, empty states, modal close, sidebar collapse and mobile layouts show only valid targets without covering controls.
- Guide buttons never call AI, save, upload, export, post or mutate teacher content.
- Legacy status, unavailable storage, reduced motion and account switches have regression coverage.
- Run the full test suite, lint, TypeScript check and production build; manually verify desktop/mobile guides before claiming completion.
