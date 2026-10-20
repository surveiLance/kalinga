# Public Guest Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tester enter a name and use a separate connected guest workspace without email confirmation, while preserving regular accounts and the offline demo.

**Architecture:** Use Supabase anonymous Auth, followed by idempotent server-side guest setup. Gate guest workspace activation on protected membership; enforce access and quotas in Postgres/storage and the Gabay edge function, not just the UI. Keep the existing Home client component, workspace scopes, queue, and community implementation.

**Tech Stack:** Existing Next.js 16 / React 19 / TypeScript / Supabase / PostgreSQL / Vitest; no state library or new package dependency.

**Spec:** `docs/superpowers/specs/2026-10-20-guest-testing-design.md`

**Execution status:** Native execution approved. Tasks 1–4 implemented and locally verified; Task 5 review and deployment checks in progress. Public guest access remains off until release prerequisites are completed.

## Global Constraints

- Public, name-only guest entry; no invitation or email confirmation for guests. Names are not account credentials.
- Guest scopes remain `teacher-<uuid>`; never auto-copy prototype or permanent-user data.
- Private classes, learners, attendance, plans, queues, and Gabay history remain owned by auth UUID.
- Regular email authentication, verification, mention handles, and existing access remain unchanged.
- Guest setup is automatic, server-validated, idempotent, and cannot reactivate a revoked membership.
- Per guest: 5 questions/hour, 20 replies/5 minutes, 10 PDF uploads/hour, PDF maximum 20 MB.
- Guest AI: 5 requests/5 minutes, 20/day; all guests share an initial 200-request UTC daily cap. Permanent users do not consume it.
- No service-role credentials in the browser. CAPTCHA and Auth rate limits must be configured before public release.
- Account conversion/merging is out of scope. Explain session-loss limits and warn before guest sign-out.
- Tour remains optional and account-scoped. No automatic form actions, saves, AI requests, or posts.
- Direct-main repository workflow; explicit-file commits with Codex co-author; pull-rebase before push; no force push. No broad refactors or unrelated artifacts staged.
- Deployment is separate from a frontend push. Missing backend/CAPTCHA configuration must fail clearly, never fall back to a shared guest or pretend online access works.

## Review Focus

1. Auth callback races: a late guest setup response must not activate the previous account after sign-out/account switching (Task 4).
2. Permission bypass: direct database/storage access and forged user metadata must not bypass guest setup/revocation (Tasks 1–2).
3. Parallel requests: concurrent posts/uploads/AI must not overshoot quotas, and fresh guest IDs must not reset the global AI budget (Tasks 2–3).
4. Partial setup/network failure: retry must reuse the same Auth UUID, keep existing local work, and never merge another account's queue (Task 4).
5. Mention identity: two equal names/UUID prefixes, renaming, and manually changed tags must not redirect guest mentions (Tasks 1 and 4).

## Files and Responsibilities

- `supabase/migrations/202610200001_public_guest_access.sql`: guest membership/config, enrollment/status/capability RPCs, canonical identity, restrictive access policies.
- `supabase/migrations/202610200002_guest_usage_limits.sql`: transaction-safe posting/upload counters and guest AI quota RPC.
- `supabase/tests/scaffold.sql`, `supabase/tests/guest-access.sql`, `supabase/tests/guest-usage.sql`, `scripts/verify-migrations.sh`: local SQL behavior and role tests; no live database writes.
- `lib/guest-access.ts`, `tests/guest-access.test.ts`: name validation, typed RPC/client boundary, session bootstrap orchestration.
- `supabase/functions/_shared/guest-access.ts`, `tests/guest-gabay.test.ts`: tested edge guest approval/quota guard.
- `supabase/functions/gabay-chat/index.ts`: invoke guest guard before any model call; permanent-user path preserved.
- `components/guest-entry.tsx`, `components/guest-captcha.tsx`, `tests/guest-entry.test.ts`: name/CAPTCHA form, exact error states, no new dependencies.
- `app/page.tsx`, `app/globals.css`, `lib/teachers.ts`, `tests/teachers.test.ts`: integrate entry/bootstrap, guest labelling/sign-out warning and canonical mention lookup. Do not split the page.
- `.env.example`, `docs/guest-access.md`: public site-key/feature configuration and safe deployment/runbook.

### Task 1: Guest identity and protected access

**Interfaces:** `guest_access_capabilities()` → `{ version: 1, enabled: boolean }`, callable without Auth and returning no user data. `complete_guest_setup(display_name text)` → `{ user_id: uuid, display_name: text, mention_tag: text, active: boolean }`. `guest_session_status()` → the same identity fields plus `enrolled: boolean`, restricted to the current session. `guest_has_access()` → boolean. `community_teacher_tags(teacher_ids uuid[])` → rows `{ id, display_name, mention_tag, is_guest }` for up to 100 IDs; expose no email/school/private records.

- [ ] Write `supabase/tests/guest-access.sql` using real RLS roles and temporary assertion helpers, with exact outcomes: no-session enrollment denied; anonymous user before enrollment cannot read shared discussion/resource/file data or own profile through the normal API; two anonymous users named Ana get separate UUIDs and unique stable tags; repeat setup returns the same tag; revoked users cannot re-enroll; permanent-user fixtures retain existing access and mention tags. Assert other users' classes/learners/plans are unreadable, and forged metadata cannot grant access.

  Example behavioral assertion after selecting the unenrolled guest role/session:
  ```sql
  select pg_temp.check('unenrolled guest cannot read discussions',
    (select count(*) from public.teacher_discussions) = 0);
  ```
- [ ] Extend local `auth.users` scaffold with `is_anonymous boolean not null default false`. Fix the migration runner to apply migrations in chronological order: apply files before `202609070001`, seed legacy history, then apply files at/after that name. Run both new guest SQL test files after the existing checks, propagating SQL failures and FAIL assertions. Run `./scripts/verify-migrations.sh`; expect failure because the new guest RPCs/policies do not exist yet.
- [ ] Implement migration 001 with protected `guest_memberships(user_id primary key, display_name, mention_tag unique, active, created_at)` and a server-managed singleton guest configuration initially `enabled=false`, daily AI cap 200. Determine anonymous status from the trusted `auth.users` row, never `raw_user_meta_data`. Security-definer RPCs use `set search_path=''`, explicit grants, and `auth.uid()` ownership. No caller-supplied account ID for enrollment.
- [ ] Normalize display names by trimming/collapsing whitespace, 1–80 Unicode characters, rejecting control characters. Enrollment stores the name/profile/handle atomically and returns existing active membership on retry. Lock revoked membership rather than upserting it back to active.
- [ ] Allocate stable reserved `@guest_<32 hex characters>` handles server-side, checking existing profile tags and membership uniqueness; use a new random UUID suffix on a collision. Protect that namespace from profile edits by any user; guests cannot replace their canonical tag. Preserve all existing permanent tags. Add SQL tests for a forced initial collision, same-name/same-prefix users, and attempted impersonation. Canonicalize guest author names for discussions/replies/comments from membership, not caller input.
- [ ] Add restrictive guest access policies without weakening existing owner policies on `profiles`, `classes`, `learners`, `lesson_plans`, `attendance_records`, `resources`, `resource_bookmarks`, `gabay_conversations`, `gabay_messages`, `teacher_discussions`, `teacher_replies`, `resource_comments`, `resource_approvals`, `notification_reads`, `teacher_notifications`, and `gabay_rate_limits`. Apply a bucket-scoped restrictive policy to `storage.objects` for `teacher-resources`; do not affect unrelated buckets. Inspect existing production storage policies/bucket privacy before deployment. No unauthenticated shared-resource access should be introduced.
- [ ] Run local migration checks; expect all legacy and new assertions to pass. Tests must execute as `authenticated`, not only table-owner/superuser. Commit identity/access migration plus tests: `feat: add protected public guest identities`.

### Task 2: Enforce public guest usage limits

**Interfaces:** `claim_guest_gabay_request()` → `{ allowed: boolean, retry_after_seconds: integer }` for the current trusted guest. Quota settings are protected server configuration, not client arguments. Guest posting/upload enforcement runs in database triggers, including direct API calls.

- [ ] Write `supabase/tests/guest-usage.sql`: allow the first 5 questions/hour then reject question 6; allow 20 replies/5 minutes then reject 21; reject upload 11/hour; reject revoked/uninitialized guests. Test guest A's usage does not consume guest B's per-user quota. Fixed-date fixtures backdate ledger rows to check window resets. Run migration checks and see missing-enforcement failures.
- [ ] Implement migration 002 with transactional counters and deterministic lock ordering. Count resource-file uploads at `storage.objects` insertion, not only resource metadata creation (otherwise orphaned files bypass the limit). Enforce teacher-resources PDF MIME/20 MB configuration and reject disallowed uploads server-side. Keep regular-user behavior unchanged.
- [ ] Add AI assertions: sixth request in 300 seconds denied; twenty-first/day denied; request 201 across guests denied; failed quota calls fail closed; revoked guest denied; permanent user does not consume guest counters. Denial must not increment accepted counters. Limits return a useful retry duration rather than raising an unhandled UI error.
- [ ] Add a local concurrent SQL check using separate psql sessions to race two callers for the last posting/upload/AI slot; exactly one succeeds. Repeated calls with newly created anonymous UUIDs still share the same 200/day guest budget. Do not test this against production.
- [ ] Run `./scripts/verify-migrations.sh` and commit: `feat: enforce server-side guest usage limits`.

### Task 3: Guard Gabay without changing regular accounts

**Interfaces:** `checkGuestGabayAccess(client: GuestGuardClient, anonymous: boolean)` → `Promise<{ allowed: boolean; status: 200 | 403 | 429 | 503; retryAfter?: number }>` in `_shared/guest-access.ts`. `GuestGuardClient` exposes only the RPC boundary needed by the guard. Auth identity is established by existing `auth.getUser()` in the edge function.

- [ ] Write `tests/guest-gabay.test.ts`: permanent users bypass guest RPCs; missing/revoked membership denies; RPC error is 503 and never allowed; quota exhaustion is 429 with Retry-After; valid enrollment/quota allows. Use an injected RPC test double at the network boundary and assert guard results, not mocked implementation internals. Run `npm test -- tests/guest-gabay.test.ts`; expect failure before adding the guard.

  ```typescript
  expect(await checkGuestGabayAccess(unavailableRpcClient, true))
    .toMatchObject({ allowed: false, status: 503 });
  expect(await checkGuestGabayAccess(exhaustedRpcClient, true))
    .toMatchObject({ allowed: false, status: 429 });
  ```
- [ ] Implement the guard and invoke it in `gabay-chat/index.ts` after validated Auth but before model-related task handling. Guest guard/quota failures must never enter the existing fail-open permanent-user limiter path. Read-only revision-capabilities queries may check membership without consuming AI quota; every actual generation/chat/revision request must claim quota exactly once. Invalid requests must not call the provider.
- [ ] Add tests around the provider boundary showing zero inference calls on denial, including full-plan and revision tasks. Preserve privacy filtering, request validation, existing model configuration, and complete-or-reject behavior. Use fictional fixtures, no real API key or paid inference.
- [ ] Run guest tests plus existing Gabay API/privacy/revision tests and commit: `feat: guard public guest Gabay requests`.

### Task 4: Name-entry UI and safe session bootstrap

**Interfaces:** In `lib/guest-access.ts`, define `GuestIdentity = { userId: string; displayName: string; mentionTag: string }` and `GuestSessionResult = { status: 'ready'; identity: GuestIdentity } | { status: 'setup-required' | 'revoked' | 'unavailable'; message: string }`. `normalizeGuestName(value: string)` → `{ ok: true; name: string } | { ok: false; message: string }`; `startGuestSession(client: SupabaseClient, name: string, captchaToken?: string): Promise<GuestSessionResult>`; `resolveGuestSession(client: SupabaseClient, user: User): Promise<GuestSessionResult>`. Import SDK types, no parallel Auth client. `GuestEntry` props: `onContinue(name: string, captchaToken?: string): Promise<{ ok: boolean; message?: string }>`, `onCancel(): void`, `configured: boolean`.

- [ ] Write failing Vitest tests for blank/whitespace/control-character/overlong names; duplicate names accepted; setup retry reuses an existing anonymous session; permanent sessions are never silently replaced; failed setup preserves its UUID for retry; stale responses after account switch are ignored; guest and regular scope keys never equal prototype keys.

  ```typescript
  expect(normalizeGuestName('  Ana   Reyes  ')).toEqual({ ok: true, name: 'Ana Reyes' });
  expect(normalizeGuestName('   ').ok).toBe(false);
  expect(normalizeGuestName('A'.repeat(81)).ok).toBe(false);
  expect(workspaceStorageKey(`teacher-${guestId}`, 'pending-writes'))
    .not.toBe(workspaceStorageKey('prototype', 'pending-writes'));
  ```
- [ ] Implement guest helpers with the existing Supabase browser client. Check backend capability/config before creating a new anonymous Auth user. Pass validated name and CAPTCHA token through `auth.signInAnonymously`; then call complete setup. On restore, call status and use the canonical server name/tag. Never assume a guest is enrolled because Auth succeeded.
- [ ] Add `GuestEntry` and accessible CAPTCHA component using the provider's official browser script through Next Script, no new package. `.env.example` documents `NEXT_PUBLIC_GUEST_ACCESS_ENABLED` (UI release gate) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public site key only). Require both backend enabled capability and the public UI gate. Do not infer missing CAPTCHA configuration means protection is optional. Tokens expire/reset after attempts; clean up the widget and avoid duplicate scripts. SSR/unit tests cover name prompt, disabled submission, errors, retry, cancel, and session-loss notice.
- [ ] Integrate `Continue as guest` into LoginScreen. Preserve normal Sign in/Create account forms and password behavior. Rename the old local button `Offline demo`; explain it has no connected discussion/AI access. Add loading/error handling so network failure never silently enters prototype mode or hangs the form.
- [ ] Gate Home's Auth callbacks: anonymous users must resolve membership before `setEntryMode('authenticated')`, scope hydration, sync, subscriptions, or AI become active. Incomplete guests return to name/setup; revoked guests show access unavailable without erasing local data. Use a monotonically changing auth-resolution token and current session UUID to reject stale async results. Do not await Supabase operations directly inside `onAuthStateChange`; schedule resolution outside the callback to avoid auth-lock deadlocks. Existing permanent-session resolution stays immediate.
- [ ] Show a Guest label and a guest-only sign-out warning with Cancel/Sign out; make loss-of-access explicit. Preserve saved local records and pending queues. Initial tour offer remains per UUID; existing-account replay remains available. Do not add an unimplemented upgrade/merge button.
- [ ] Fetch canonical community tags through `community_teacher_tags` for visible author IDs and the current account; display server tags for guests. Keep `teacherMention` as permanent-user compatibility fallback only; never recompute a guest's tag from its display name. Test duplicate names, profile rename, and mention notification routing end-to-end in local SQL/browser fixtures.
- [ ] Run `npm test`, `npx tsc --noEmit`, scoped lint, build. Commit: `feat: add connected guest name entry and session recovery`.

### Task 5: Verify, review, and controlled release

**Files:** `docs/guest-access.md`, existing test/documentation files above. No new application subsystem.

- [ ] Write the operational runbook with exact migration/function/config dependencies, quota settings, guest limitations, revocation, and rollback. Feature-off rollback hides new signup and denies new enrollment without deleting guest records; never roll back safety policies while anonymous Auth remains enabled. Existing permanent access stays available.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint -- --ignore-pattern 'brag-output/**'`, `npm run build`, `./scripts/verify-migrations.sh`, and `git diff --check`; record actual outcomes. Missing local tools are a stated verification gap, not a passing check.
- [ ] Use two independent local browser sessions with fictional names/data: same name produces different accounts/handles; each can create a class/lesson and see only their own; questions/replies/mentions reach the other tester; private plans and rosters do not. Verify refresh resumes, guest setup failure/retry, account switch, offline entry rejection, offline demo, guest logout Cancel, guest logout warning, and regular sign-in regression. Do not clear a real user's browsing storage.
- [ ] Verify optional tour, replay, real-screen transitions, skip pause, and non-overlapping highlight on desktop and phone widths. Do not mutate real teacher records or call live AI merely to test the tour.
- [ ] Request one independent whole-change review using the requesting-code-review skill. Resolve Critical/Important findings; run relevant regressions again. Review explicitly includes RLS/storage/counters and Auth race handling, not just visual UI.
- [ ] Commit verified release docs; pull-rebase and push explicit commits without force. Frontend remains disabled until backend deployment is verified.
- [ ] Check deployment access without printing tokens/secrets. Deploy additive migrations and `gabay-chat` only with authorized project access. Configure Supabase CAPTCHA and Auth rate limits, verify teacher-resources bucket is private/PDF/20 MB, enable backend config, then anonymous Auth, then frontend guest gate. Request action-time confirmation for security-sensitive browser settings. If credentials/config are missing, deliver the tested code and exact remaining steps; do not claim guests are live.
- [ ] Run a controlled two-tester production smoke test with disposable, explicitly approved test records. Confirm the entire rollout before declaring connected guest testing available. Preserve existing accounts and data throughout.

## Plan Self-Review

Spec coverage: identity/access → Task 1; community/storage/AI quotas → Tasks 2–3; login/session isolation/guest limitations/tour entry → Task 4; verification/deployment → Task 5. The walkthrough screen-mismatch fix already shipped in `fd948ea`; this plan only regression-tests it. No invitation flow, email-disable switch, direct-messaging feature, automatic data migration, or account merger is included.

Review-focus coverage: auth races and retry → Task 4 tests; forged access and revocation → Task 1 SQL tests; concurrent/global budgets → Task 2 SQL tests; canonical mentions → Tasks 1/4. Each RPC has one defined return shape; client wrappers consume those names. Production remains off until deployment checks pass. This plan is awaiting user review and selection of execution method.
