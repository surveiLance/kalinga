# Session handoff — continue from here

_Last updated: 2026-10-06. For the durable project overview, read [`docs/onboarding.md`](./onboarding.md) first; this file is just the live state + what's in flight._

## What this session shipped

**Commit `eda1890` on `main`** — "Retry full-plan drafts and tighten the printed plan". Two bug fixes, both client/CSS only (no edge-function change). Already pushed; Vercel auto-deploys `main`.

1. **Gabay full-plan drafting: "first two clicks fail, third works."**
   - Root cause: a full plan is the biggest thing Gabay generates. Groq's **free tier meters tokens per minute**; one full-plan request (`max_completion_tokens: 8000`) can use most of a minute, so a quick re-click gets rate-limited (429 → "busy"), and the model sometimes returns a **truncated/invalid JSON** draft (502 → "unavailable"). The old flow surfaced an error the teacher cleared by re-clicking, which burned more of the minute → the fail-fail-succeed pattern.
   - Fix: [`draftCompletePlan`](../app/page.tsx) now **auto-retries up to twice (3 attempts total)** with backoff — `unavailable`: 4s then 9s; `busy`: 24s then 36s (so the per-minute token window resets). A live status (`fullPlanDraftStatus` state, `.gabay-draft-status` style) tells the teacher what it's waiting on so it never looks frozen. `not-signed-in` / `not-configured` are not retried.

2. **PDF export: extra near-blank page.**
   - Not structural (only one copy prints). The plan content ended just past a page boundary, spilling the signature block onto a near-empty sheet.
   - Fix: print-only rules in [`app/globals.css`](../app/globals.css) inside `@media print`, scoped to `.ilaw-print-mode .ilaw-export-document:not(.ilaw-editor)`, pack the **printed clean copy ~8.6% tighter** (cell padding, section/signature margins, zeroed last-child margin). The on-screen editor is untouched.

### Verified
`npm run lint`, `npx tsc --noEmit`, `npm test` (138 pass), `npm run build` all green. Planner loads clean in the preview (no console errors). All 7 print rules confirmed compiled under `@media print` via CSSOM.

### Still needs LIVE verification (can't be done from the dev environment)
- **The Gabay retry path.** Prototype mode (`Continue to prototype`) does **not** call the `gabay-chat` edge function — it needs a real signed-in Supabase session. Lance must sign in on the deployed site, click "Draft the whole plan with Gabay", and confirm it no longer errors on the first clicks.
- **The PDF page count.** Reprint a *full* plan and confirm the trailing page is gone. If a genuinely long plan still runs onto a 3rd page **with content**, that's real length, not the bug.

## How to work in this repo (what Codex needs to know)

- **Stack:** Next.js 16 / React 19 / TS / Tailwind 4 on **Vercel** (auto-deploys from `main`). **Supabase** (ref `aoiufmxzeenjrrtbkdwi`): Postgres+RLS, Auth, Storage, Realtime, Edge Functions. **Groq** `openai/gpt-oss-20b` via the `gabay-chat` edge function only — the key is never in the browser. Live: https://kalinga-gules.vercel.app · repo: github.com/surveiLance/kalinga.
- **`app/page.tsx` is ~3,100 lines** and holds almost the whole UI as one `"use client"` component; navigation is a `view` state var. **Do not split it unasked.** Testable logic lives in `lib/*.ts`.
- **Deploy caveat:** pushing `main` deploys the **website only**, NOT the edge function. Any change under `supabase/functions/` needs `npx supabase functions deploy gabay-chat` run by Lance. Don't run `supabase db push` casually (hits real data). *(This session changed neither, so nothing extra to deploy.)*
- **Three renderings of the same DepEd DLP must stay in sync:** the editor (`.ilaw-editor` in `app/page.tsx`), the print copy (`IlawPlanPrint` in `app/page.tsx` + `@media print` CSS), and the Word export (`lib/ilaw-docx.ts`). Change one, check the other two.
- **Offline/local-first:** edits persist to per-teacher localStorage and sync via the pending-write queue (`lib/pending-writes.ts`). Any new synced type MUST go through the queue or deletes resurrect.
- **Gotchas:** attendance casing is UI "Present" vs DB "present" — convert in `lib/attendance.ts`. Never send learner PII to Groq (edge fn sends aggregates only + redacts names/LRNs via `supabase/functions/_shared/gabay-privacy.ts`). The dev server sometimes serves stale CSS after scripted edits — restart + `rm -rf .next/dev`. `next-env.d.ts` shows as locally modified (generated) — discard it before committing/rebasing.

## Workflow rules (Lance's standing instructions)
- **Merge directly to `main` after every edit** — commit, push, no PRs left for review. (`git pull --rebase origin main` first; commit the staged changes, *then* rebase if needed — rebase refuses a dirty index.)
- **Always verify before calling done:** `npm run lint && npm test && npm run build`.
- End commit messages with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (adjust to the tool/model actually used).

## Open / roadmap (not started)
- Service worker for true offline boot (currently local-first only once loaded).
- CSV/XLSX class-list import; DOCX lesson-plan import; password reset.
- Curated MATATAG competency table so Gabay selects official codes instead of generating them.
- **Part 2 bottleneck:** user testing with ≥5 teachers — not yet started. (Part 1 due Oct 8; check-in demo Nov 5; Part 2 final Nov 26.)
- Possible follow-up if full-plan truncation persists for 3–4 grade classes: the 8000-token cap is a tradeoff (raising it worsens the per-minute rate-limit). Consider a paid Groq tier, or splitting the full-plan generation per grade, rather than just raising the cap.
