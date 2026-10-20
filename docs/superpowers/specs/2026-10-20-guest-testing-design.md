# Public guest testing and screen-aware guidance

Status: proposed design, awaiting user review. No live authentication settings changed.

## Outcome

Teachers testing Kalinga can enter a name without email confirmation or an invitation code, keep individual classes and plans, and use the existing Ask teachers discussions, replies, mentions, resources, notifications, and Gabay. This is not a new direct-messaging system. Existing accounts keep their current authentication and data. The offline prototype remains available separately.

The user selected public guest access rather than invited testing. Public entry is open to anyone, subject to CAPTCHA and usage limits, and does not imply verified teacher identity. Authentication/access control is an architectural change: implementation follows approval of this revised document and an implementation plan.

## Entry and identity

- Add Continue as guest alongside normal sign-in. Its small form asks for display name only, with CAPTCHA if required. Never use a matching name to retrieve another account.
- Use Supabase anonymous Auth for a unique UUID and persistent browser session. All local workspace and pending-write keys remain `teacher-<uuid>`, never shared `prototype` keys. Do not automatically copy prototype or permanent-account work into a guest account.
- Restore an existing guest session rather than creating another user on every visit. Keep the existing offline demo, labelled Offline demo, separate from online guests. Online guest creation requires a connection.
- Record successful guest setup in a protected guest-membership table keyed by auth UUID. A server-validated setup operation validates the name and creates the stable handle; user-editable metadata cannot grant privileges. This is automatic setup, not manual approval.
- Give guests a stable distinct mention handle allocated server-side with a uniqueness constraint. Preserve existing permanent users' mention tags. Display-name duplication is permitted. Existing profile policies/triggers must not let a guest impersonate someone by changing their handle.
- Guest labels and a short notice explain that this browser remembers the session, but signing out, clearing browser data, or changing device loses access without a permanent sign-in method. Warn before guest sign-out. Never promise name-based recovery.

## Public access and abuse protection

- No invitation or name-availability check is required. Guest setup validates the current anonymous Auth user and is idempotent. Repeated visits resume the same session. Network/setup failures give clear retryable errors, never a shared-account fallback.
- Anonymous Auth users receive the authenticated database role. Therefore enabling anonymous sign-in alone is NOT the release: review every relevant RLS policy and storage policy and add restrictive membership checks. Unenrolled guests must not access shared teacher data, publish content, upload/download shared files, send notifications, or call paid AI. Existing permanent users retain existing access.
- Private records remain owned by auth UUID. Never expose rosters or other teachers' plans through guest membership. Revocation blocks connected operations but does not silently erase local work.
- Enable Supabase-supported CAPTCHA on anonymous signup and retain Auth rate limits. Browser checks alone are not protection. Server-managed guest membership may be revoked for abuse; it must not be writable by the guest.
- Community limits are enforced server-side, including direct database calls: initially 5 new questions/hour and 20 replies/5 minutes per enrolled guest. Shared resource uploads remain PDF-only and at most 20 MB, with a guest upload limit of 10/hour. These limits are deliberately separate from the existing permanent-account behavior.
- Guest AI initially allows 5 requests/5 minutes and 20/day per enrolled guest, in addition to a configurable public-guest budget initially capped at 200 requests per UTC day across all guests. Existing privacy filtering and complete-or-reject lesson generation remain unchanged. Enforce guest setup and quota before calling Groq; errors preserve the current document. Repeated new anonymous identities must not reset the shared guest budget. Regular users do not consume this guest-only budget.

## Existing accounts and recovery boundary

Keep email sign-in and verification unchanged. No service-role key in the browser and no disabling confirmation globally. The guest account can later be upgraded by linking a verified identity, but account conversion and merging into an existing permanent account are out of scope for this first release. Say this clearly rather than presenting an unimplemented upgrade button. Testers who need durable cross-device access should use regular sign-in from the start.

## Guidance

Each new guest gets a scoped Start with Gabay / Not now offer. Existing users can replay from Gabay's menu. Progress remains per account.

The guide must not fill fields, save, post, run AI, or silently change pages. Next cannot outrun required real-screen transitions. If a teacher goes elsewhere, show directions to the intended screen and pause Next instead of displaying mismatched instructions or highlighting an unrelated menu button. Skip, Back, chapter selection, minimize, and exit remain explicit choices. Existing clipping and non-overlapping layout remain intact.

## Rollout and verification

1. Implement and verify locally with anonymous Auth disabled in production.
2. Test two independent browser sessions: duplicate names, isolated records/queues, shared question/reply and mention notifications, setup retry/revocation, logout warning, guest session restoration, and account switching.
3. Test direct API/RLS denial for unenrolled guests, metadata forgery, other teachers' data, storage, and paid AI. Test concurrent setup and quota requests. No real learner data in test fixtures.
4. Full unit suite, TypeScript, scoped lint, production build, local database migration checks, and independent review. Browser-test tour transitions, off-page pause, opt-out and replay on desktop/mobile.
5. Deploy additive migrations and updated edge functions before exposing guest login. Configure the CAPTCHA provider and public-guest AI budget through secure operational steps. Confirm the backend capabilities; missing configuration must show Guest testing is not available yet, never claim success.
6. Enable anonymous Auth only after restrictive policies are deployed and verified. Run a controlled two-tester smoke test. A frontend push alone does not complete this release.

Deployment credentials/settings are not currently verified. Report missing deployment authority explicitly. Do not enable anonymous Auth as part of design review.
