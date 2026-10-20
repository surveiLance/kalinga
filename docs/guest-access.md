# Public guest testing

Guest access uses a real Supabase anonymous Auth account, not the local prototype. Continue as guest asks for a name and security verification. Each person has a distinct auth UUID, private classes/plans/roster/history, and account-scoped offline queue. Matching names never recover or share accounts. Existing Ask teachers discussions, replies, mentions, and deliberately shared PDFs are available to enrolled guests; direct messaging is not added.

## Status

Implementation is feature-gated. A frontend push alone does not enable guests. Until the release checks below are completed, keep `NEXT_PUBLIC_GUEST_ACCESS_ENABLED=false` and `guest_configuration.enabled=false`. Normal sign-in and the Offline demo remain available. Do not claim guest testing is live until two separate sessions pass the smoke test.

## Safeguards and limits

Guest setup is idempotent and cannot reactivate revoked membership. Database/storage policies deny uninitialized and revoked guests. Guest author names/mention tags are canonical server values, not browser-generated identities. Existing permanent mention handles remain unchanged.

Per guest: 5 questions/hour; 20 replies and resource comments combined per 5 minutes; 10 file insert/update operations/hour. Private teacher-resources storage accepts PDF MIME only, at most 20 MB. File overwrites count too. PostgreSQL counters are atomic; deleting content does not refund usage. Quota errors leave the form/draft available to retry.

Guest Gabay allows 5 requests per 300-second fixed window and 20 per UTC day. All guests share a default 200/day UTC budget, controlled by the protected `guest_configuration.daily_ai_limit` value. The browser cannot set limits. Denials do not consume accepted quota; capability checks consume no AI quota. Missing membership/quota configuration fails closed before the model pipeline. Permanent users keep their existing separate limiter.

Session persists in this browser. Signing out, clearing browser data, or changing device means the guest cannot recover that account. The app warns before sign-out; it does not delete local records. Account conversion and merging are not implemented. Use regular sign-in from the start for long-term work. Use fictional learner details for testing.

Guest labels do not verify teacher identity. Shared-resource submissions and question forms explain that public guests can view shared content; private work is not automatically shared.

## Deployment order — do not skip

1. Run tests and independent review before changing production. Verify the linked project is `aoiufmxzeenjrrtbkdwi` (Kalinga), not another saved Supabase project.
2. Inspect migration history: `npx supabase migration list --linked`. The read-only audit on 20 October 2026 found `202609070001` and `202609070002` pending, in addition to the two new guest migrations. Do not mark them applied merely to hide the discrepancy. Check whether tables/triggers already exist from manual changes; reconcile that drift before running SQL. Do not replay the historical `202609190001` discussion-reset migration.
3. Preview: `npx supabase db push --linked --include-all --dry-run`. The expected files are the two September rate-limit/notification prerequisites plus `202610200001_public_guest_access.sql` and `202610200002_guest_usage_limits.sql`. Stop if unexpected/destructive migrations appear. Only apply a reviewed, reconciled migration set with authorized database access. The guest config starts disabled.
4. Deploy the reviewed function: `npx supabase functions deploy gabay-chat --project-ref aoiufmxzeenjrrtbkdwi`. Preserve existing model secrets/origins. Never put service-role or model credentials in Next.js public variables. Verify regular-account chat/draft/revision behavior before enabling guests.
5. Create a Cloudflare Turnstile widget for the actual Kalinga deployment domains. Add localhost domains only for controlled testing. Store the secret key directly in Supabase Auth CAPTCHA settings, not git/chat/frontend variables. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is the public site key and may be set in the frontend host's environment. No usable keys are committed.
6. Deploy the frontend with the public Turnstile site key but guest gate still false. Verify regular sign-in and Create account receive valid verification tokens. Only then enable Supabase Auth CAPTCHA with the matching Turnstile secret. CAPTCHA applies to regular sign-in/signup too, so reversing this order can block existing users. Keep Supabase Auth signup/IP rate limits enabled.
7. Confirm teacher-resources is a private bucket with PDF MIME / 20 MB controls. The guest migration refuses a public bucket rather than silently changing its visibility. Confirm RLS on every private/shared table and storage policies using direct-API tests. Check `guest_access_capabilities()` returns version 1; enrollment should still be off.
8. Enable anonymous sign-in in Supabase Auth only after restrictive guest policies and the updated function exist. Through a trusted SQL/admin session, set `update public.guest_configuration set enabled=true where singleton;`. This is not a frontend-writable setting. Then set `NEXT_PUBLIC_GUEST_ACCESS_ENABLED=true` and redeploy the frontend.
9. With approved disposable test records, use two independent browser sessions with the same display name. Each should create its own class/lesson, see no other's private data, and exchange a question/reply/mention. Test refresh, setup retry, guest sign-out Cancel, permanent sign-in, and quota denial. Clear test content only with explicit authority and preserve real records. Live AI smoke tests should be deliberate and budgeted, not part of routine UI testing.

## Feature-off and revocation

To stop new guest enrollment, set backend `enabled=false`, turn the frontend gate off and redeploy. Keep the restrictive policies and guest AI guard deployed while anonymous accounts exist. Existing enrolled guests can still resume; to revoke one session, use a trusted admin SQL session to set `guest_memberships.active=false` for the exact validated UUID. Do not delete the membership row: deletion could allow re-enrollment. To stop all guest use, revoke guest memberships explicitly after confirming scope; do not change permanent Auth accounts. Never delete auth.users or localStorage as a shortcut.

To adjust the global guest AI budget, update only the protected singleton config. Per-user limits are deliberate constants in the quota migration. Failed guest checks cannot fall back to the permanent-user fail-open limiter.

## Verification commands

```sh
npm test
npx tsc --noEmit
npm run lint -- --ignore-pattern 'brag-output/**'
npm run build
./scripts/verify-migrations.sh
npx --yes deno check supabase/functions/gabay-chat/index.ts
git diff --check
```

The local SQL runner creates a disposable Postgres instance, applies historical migrations in order, and uses real authenticated/anonymous roles for access tests. It tests duplicate names/forced handle collisions, revocation, shared file access, guest-to-guest notification delivery, private record isolation, quota boundaries, overwrites, and concurrent posting/upload/AI calls. It never touches production.

Local unit tests cover session creation/retry, identity validation, stale resolution cancellation, name validation, error copy, guest-entry markup, and the edge provider-dispatch guard. These tests do not prove hosted Auth/CAPTCHA configuration. Until the two-session hosted test is completed, report that part as unverified.
