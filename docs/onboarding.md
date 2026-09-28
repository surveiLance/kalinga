# Kalinga — Collaborator / AI-Agent Onboarding

You are joining an existing project called **Kalinga**. Read this before making any changes; it is the ground truth for how this repo works. If you are an AI coding assistant, treat this as your project context.

## What Kalinga is

An offline-first **teacher's assistant for multigrade classrooms in last-mile Philippine public schools** (one teacher, several grade levels in one room). It's a prototype for a university AI-in-Education course (the "Teacher Sab / Dasha Uy" teachers'-assistant brief) meant to be shown to funders. Core features: class & learner records, date-specific attendance, an **ILAW lesson planner** (Intentions · Learning Experience · Assessment · Ways Forward) with per-grade differentiation, a DepEd-style Daily Lesson Plan export to PDF and Word, a "teaching guide" run-the-lesson view, a resource library, a teacher community, and **Gabay** — an AI companion that drafts lesson plans and gives page-aware Taglish guidance.

## Tech stack

- **Frontend:** Next.js 16.2, React 19.2, TypeScript 5.9, Tailwind 4. Deployed on **Vercel**, auto-deploys from `main`. Live: https://kalinga-gules.vercel.app
- **Backend:** **Supabase** (project ref `aoiufmxzeenjrrtbkdwi`) — Postgres + row-level security, Auth, Storage, Realtime, and Edge Functions (Deno).
- **AI:** **Groq** (`openai/gpt-oss-20b`) called *only* through the `gabay-chat` Supabase Edge Function, so the model key never reaches the browser.
- **Tests:** Vitest (120 passing at time of writing).

## Repo shape (unusual — read this)

- **`app/page.tsx` is ~3,100 lines and holds almost the entire UI** as one `"use client"` component. There are no routes; navigation is a `view` state variable. This is intentional; do not "helpfully" split it apart without being asked.
- **`lib/*.ts`** (14 modules) holds the pure, tested logic extracted from the page: `pending-writes.ts` (offline queue), `lesson-plan.ts`, `ilaw-docx.ts` (Word export), `attendance.ts`, `grades.ts`, `normalize.ts`, and others. **Put testable logic here, not in the component.**
- **`supabase/migrations/*.sql`** (12) — schema + RLS. Additive only.
- **`supabase/functions/gabay-chat/index.ts`** — the AI edge function. **`supabase/functions/_shared/gabay-privacy.ts`** — PII redaction.
- **`tests/*.test.ts`** — Vitest. **`docs/part-1.md` / `docs/part-2.md`** — the graded submission documents; keep them factually accurate.

## Commands

```bash
npm install          # first time (Node 22.13+)
npm run dev          # local dev on :3000
npm run lint         # eslint — must pass
npm test             # vitest — must pass
npm run build        # next build — must pass
```

Before you consider any change done: **lint, test, and build must all pass.**

## Environment / secrets (you need these — they are NOT in the repo)

`.env.local` is gitignored. Copy `.env.example` to `.env.local` and get the values from Lance:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The Groq key lives as a Supabase **function secret**, not in the repo. Being a GitHub collaborator does **not** grant Supabase or Vercel access — those are separate invites. You can run the UI locally without them, but Gabay and cloud sync need the Supabase values.

## Git workflow — IMPORTANT (shared `main`)

This project commits **directly to `main`** and pushes; Vercel deploys from it. Two or more people now share `main`, so **always pull-rebase before pushing** or your push will be rejected:

```bash
git pull --rebase origin main
# resolve any conflicts
npm run lint && npm test && npm run build
git push
```

End commit messages with a `Co-Authored-By:` line for your AI assistant if it made the change. **Do not force-push `main`.**

## Non-negotiable conventions

1. **Never send learner PII to Groq.** The edge function sends only *aggregate* class context and **redacts** roster names + LRN-like numbers from free text. Do not route learner names or notes to the model.
2. **Match the surrounding code style:** dense, very low comment density, plain functions over abstractions. Read neighboring code first.
3. **Offline-first is the point.** Teacher edits (classes, plans, attendance, profile) persist to `localStorage` under a per-teacher key and sync through the **pending-write queue** in `lib/pending-writes.ts` with retry/backoff. Any new synced data type must go through this queue, or deletes/edits will resurrect on the next cloud load. Data is isolated per teacher by **RLS**.
4. **Attendance status casing:** the UI uses `"Present"`, the DB constraint requires `"present"`. Conversions live in `lib/attendance.ts` — use them on both read and write.
5. **The lesson plan editor, the print view, and the Word export must stay in sync** — they represent the same DepEd DLP. Export is **A4, 0.5″ margins**.

## Known gotchas (we hit these)

- **Edge function changes are NOT live until manually deployed:** `npx supabase functions deploy gabay-chat`. Committing to `main` deploys the *website* (Vercel) but not the function.
- **Dev server sometimes serves stale CSS** after scripted file edits — restart it and `rm -rf .next/dev` if styles look wrong.
- Migrations can be checked without touching production: `./scripts/verify-migrations.sh` (needs a local Postgres).
- **Don't run `supabase db push` casually** — it hits the real database with real data.

## Current state

The planner is solid: topic-required AI drafting, complete-or-reject validation (a partial AI draft never blanks existing work), per-grade redraft, editable-in-place document, PDF + Word export, plan index with select/delete, mobile layout (one grade at a time). Recently hardened: server-side PII redaction, A4 Word export, profile sync through the queue.

**Roadmap / known-missing:** a service worker for true offline *boot* (currently local-first only once loaded), CSV/XLSX class-list import, DOCX lesson-plan import, password reset, and a curated MATATAG competency table so Gabay selects codes instead of generating them.

**Ask before large refactors.** Small, verified, working changes that match the existing style are the norm here.
