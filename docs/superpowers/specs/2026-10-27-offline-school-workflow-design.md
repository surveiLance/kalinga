# Prepare online, teach offline

Status: proposed design, awaiting Lance's approval. No application implementation is included in this document.

## Intent and agreed direction

Teachers prepare lessons where internet is available, then bring their own phones to schools without signal. Kalinga must reopen there, show saved classroom records and downloaded materials, support teaching and attendance, and preserve edits until the same account can sync again.

Lance selected reliable offline preparation as the next milestone and confirmed teachers primarily use their own devices. Preserve the existing application and visual language. This is a substantive reliability feature, not a dashboard redesign or a promise that every online function works offline.

## Approaches

- Recommended within the selected direction: extend the current Next.js application into an offline-capable PWA, reusing its per-teacher local workspace and pending-write queue. This keeps the existing website, Supabase backend and teacher workflows.
- A downloadable PDF/Word-only teaching pack is simpler, but does not meet the requirement to reopen Kalinga, edit records or take attendance offline. Existing exports remain available, not the primary solution.
- A separate native app adds another application and release process. It is outside this milestone; nothing currently requires that expansion.

The PWA approach is proposed for final approval here. New dependencies, if needed for reliable PDF viewing, should be narrow and documented; do not switch the application's build system or add a state library.

## Goals and explicit limits

After initial online preparation on the same browser/device, a regular teacher can:

1. Close Kalinga and reopen it without internet, including after their short-lived cloud access token expires.
2. Read and edit saved classes, learners and lesson plans; use the existing Teaching Guide; save date-specific attendance and notes.
3. Open selected, fully downloaded starter and teacher-uploaded PDF materials.
4. Generate the existing Word export locally and use the existing browser Print/PDF workflow. OS printing and Save as PDF availability remain device-dependent, not guaranteed by Kalinga.
5. Know whether the application is prepared, a resource is downloaded, changes are pending, or cloud access requires sign-in.
6. Reconnect and sync only to the original teacher account, with pending local changes retaining existing precedence over server copies.

Not included: offline AI generation/revision/chat, new guest enrollment or guest offline-unlock behavior, offline community posting/uploads, Bluetooth/hotspot transport, class-list import, curriculum/IP education changes, new assessment tools, push notifications, or background sync while the app is closed. Existing online functionality must remain working.

First-ever use requires connectivity. Clearing browser data, browser eviction, private browsing and device loss can remove local copies. Do not promise permanent backups or "100% offline" without explaining these boundaries. Installing the PWA is optional for offline use in a supported browser and is not an Android/iOS app-store release.

## Existing implementation and integration boundaries

- `app/page.tsx` controls views and workspace hydration. Keep that structure; add narrowly scoped integration rather than splitting the page apart.
- `lib/workspace-keys.ts` defines `workspaceStorageKey(scope, key)`. Extend its key union for new per-workspace metadata, and explicitly exclude new keys from legacy prototype migration mappings.
- `lib/pending-writes.ts` already reconciles queued classes, plans, attendance and profile changes. Preserve stable record IDs, queue durability, deletion tombstones, capped retries, and attendance's `learner_id,attendance_date` identity.
- Supabase client session persistence exists, but boot currently depends on `auth.getSession()`. A token refresh that cannot reach the server must not prevent opening an eligible local workspace.
- Resource metadata is currently component memory. Uploaded PDFs use one-hour signed URLs; keeping a URL is not keeping a PDF. The new download store must contain actual bytes and display metadata.
- Word export is a dynamic import. Offline preparation must include its chunks even if the teacher has never clicked Download Word.
- The sidebar's hardcoded "2 starter PDFs ready" is not a readiness check and must be replaced with measured state.

## 1. Application installation and offline boot

Add a manifest with the existing Kalinga identity, usable icons, a clean root start URL and standalone display. Reuse existing brand assets; no new mascot/design work is required.

Register a versioned service worker in production and production previews, not normal `next dev`. Keep the current Turbopack build. Generate a deterministic, reviewed application-asset inventory from the production build: root HTML, required Next.js JavaScript/CSS, dynamically imported Word-export chunks, local fonts, and the local images needed by the shell. PDF resource bytes are separate downloads, not automatic blanket caching of public files.

Only mark application preparation complete when every required application asset has been fetched and stored successfully and the active worker confirms that build is usable. A partial install must not be described as ready. A first visit must wait for worker activation/control or clearly show preparation still pending.

Use explicit same-origin static-asset allowlists and a clean root document for navigation fallback. Never cache Supabase requests, authentication callbacks, API responses, tokens, private records, signed PDF URLs or remote write requests in the global service-worker cache. Do not turn a failed online request into a fabricated successful response.

Authentication query/hash parameters must not become cache keys or cached HTML variants. Opening confirmation or password-reset links offline must not claim confirmation/recovery success or bypass the normal callback checks.

Updates must not reload a teacher's open unsaved lesson, replace a partially prepared usable version, or delete old assets still needed by an open client. Keep the current usable version until the new version is complete. Offer an update at a safe point; preserve teacher stores and pending writes across updates. Bound application-cache retention without breaking existing clients.

## 2. Personal-device local workspace access

Offline access is local-device continuity, not new cloud authentication. It cannot authorize a Supabase request or prove an account is still valid remotely.

After an online-verified regular teacher session and successful local workspace hydration, persist a minimal local-access record under that teacher's existing storage scope. It contains the teacher ID, local display identity, schema version and last verification time, not copied credentials. A non-sensitive device-scope pointer may identify the one most recently eligible workspace; it also uses `workspaceStorageKey` with an explicit device scope/key. Never scan arbitrary teacher storage keys to offer an account picker.

On reopening, resolve ordinary authentication first when reachable, with a bounded waiting period. If the network is absent or cannot be reached, the previously eligible device workspace may open in a distinct local-only mode, even if its cloud token expired. Show that cloud access is unverified. Do not label it a newly authenticated session, silently use prototype scope, or create a new guest identity.

Use a pure, tested access-state function to separate session loading, authenticated access, local-only access, explicit local lock and signed-out state. Network errors and expired access tokens alone are not proof that classroom work should be discarded. Explicit invalid/revoked session results are different: lock local access and require sign-in, while retaining pending work for the original owner. Do not extend Supabase token lifetimes or weaken backend/RLS checks.

Only an actual online account verification may create/unlock local-access eligibility. Restoring a cached session or receiving a late auth event must not undo an explicit sign-out lock. Account changes, sign-out and lock state must propagate across open Kalinga tabs; stale async callbacks must not restore an old account.

Explicit sign-out locks local reopening immediately, including offline. Warn when unsynced changes remain. Retain private workspace records and queue for that teacher to recover after signing into the same account; do not erase work just to sign out. Clear the eligible pointer/access state and revoke open local PDF URLs. A later token-refresh or initial-session event must not reopen it without an intentional successful sign-in. Implementation may use the SDK's existing storage interface for session lifecycle handling, but must not add credential copies or use a cached marker to grant cloud access.

On reconnect, verify the session before loading/flushing cloud work. If verification fails transiently, keep local access and queued work. If authentication is required, show "Sign in to sync"; do not spend the queue's retry budget on missing/expired authentication. Resume only when the verified session ID matches the queued scope. Signing into B never flushes or displays A's pending edits/downloads. Existing server reconciliation stays queue-aware.

Prototype mode stays fully local and uses only `prototype` scope. Guest enrollment and guest re-entry keep existing server-verification requirements; do not use the new regular-teacher fallback for anonymous guests. An already open guest workspace retains existing local-save behavior, but this milestone makes no new guest cold-boot promise.

Security boundary: the device stores readable classroom data today. This milestone does not add encryption or a PIN and cannot detect remote sign-out while physically disconnected. Device screen-lock protection is important; the UI must not present local availability as remote authentication or encrypted storage. After browser-storage loss, do not claim records can be recovered offline.

## 3. Explicit PDF downloads

Add "Download for offline" and a clear local download state to the existing resource card/reader. Teachers select materials; do not silently download the entire resource library. Show progress/busy state, failure with retry, and "Downloaded on this device" only after a completed storage transaction. Include a downloaded-only filter and a local remove action. Removing a download never deletes the cloud resource or another account's copy.

Store a resource's blob and metadata atomically in IndexedDB, keyed by `[workspaceScope, resourceId]`. Reuse the existing storage-scope convention for metadata; do not repurpose `saved-resources` bookmarks as proof of a download. Keep stable resource ID, source/storage path, title, subject, grade labels, author, visibility, actual byte size, local timestamp and schema version. Do not persist signed URLs or bearer credentials as download identity. An offline-only library listing hydrates from these local records even if no server library request succeeds.

For teacher uploads, fetch the bytes while the current account is authorized, using a fresh signed URL where necessary. For starter PDFs, fetch the local public file. Respect the existing 20 MiB per-file limit and reject oversized files, empty/truncated transfers or non-PDF responses without producing a ready record. Use bounded/cancellable downloads and handle missing content length without bypassing the cap. Store nothing under a scope that changed while the transfer was in flight.

Do not destroy an existing good copy when a refresh download fails. Replacement is atomic. A completed transaction is required before status changes. On mount/open, check that bytes still exist rather than trusting a localStorage flag. Download state from other tabs must be refreshed; overlapping downloads/removals cannot incorrectly restore a removed item.

Open local PDFs from scoped blobs, using object URLs with correct cleanup and no fallback network dependence. Verify rendering and usability on the target Android browser; if native PDF embedding is inadequate, use a narrowly scoped, lazy-loaded bundled PDF viewer and worker, both included in application preparation. Do not rely on an online third-party viewer. The implementation plan must choose and test this path before claiming phone readiness.

Downloads are snapshots. Show the saved date and explain that later online edits to a resource are not automatically included. A confirmed online denial, deletion or loss of access removes the app-managed local copy after closing its reader; transient refresh failures do not. Rights cannot be rechecked offline, and downloads cannot provide instant offline revocation. Do not cache the whole online discussion, global teacher library or another user's private metadata.

Request persistent browser storage where supported, without making unsupported/denied requests fatal. Show used resource-download space and allow individual removal. Storage/quota errors must leave classroom records and pending writes untouched; never automatically delete teacher work to make room. Application-update caches and resource stores have separate lifecycles.

## 4. Readiness and online-only features

Preserve the current layout. Replace misleading hardcoded readiness copy rather than add a new navigation tab or a mandatory wizard.

Readiness has separate facts: application assets prepared, current workspace locally persisted, resource-download count/size, pending sync depth and cloud authentication/connectivity. A green connected/synced badge is not proof of offline readiness. Readiness may report issues without blocking ordinary online use.

Saved lesson plans are already local: no second per-plan download action is required. Only explicitly saved teacher work is promised; make unsaved status clear and never mark a lesson prepared before its existing save completes. Local read/write errors prevent a ready claim. Do not imply lesson-mentioned materials were automatically attached or downloaded.

When disconnected, keep local editing and Teaching Guide navigation available. Gabay's deterministic page walkthroughs remain available; online AI chat/drafting/revision clearly say internet is needed and do not start futile retries. Uploading, sharing changes, community posts/replies, resource comments, new notifications and account recovery remain online. Preserve form text on a connection error and never report a post as sent when it is not. A downloaded resource remains readable even when its discussion cannot load.

Network reachability is not equivalent to `navigator.onLine`. Prefer successful service checks and bounded failures; do not ping an external tracking endpoint or put tokens in readiness logs. Make stalled preparation/reconnect attempts cancellable or retryable, not an indefinite loading screen. A local-only connection failure must not silently change the teacher account or wipe a workspace.

## Verification and acceptance

Automated coverage must include:

- Production inventory completeness, including lazy Word/PDF viewer chunks, and worker caching allowlists/exclusions.
- Partial/failed application installs, old/new version transitions and navigation fallbacks without auth callback replay.
- Local-access eligibility, expired-token offline boot, explicit sign-out, cross-tab locks, account switching, stale auth events, network failures versus confirmed invalid sessions, and scope-safe reconnect.
- IndexedDB blob/metadata atomicity, interrupted downloads, size/type limits, quota denial, removal/replacement races, missing blobs, signed-URL renewal and account changes during transfers.
- Readiness states and offline-only feature guards; retain existing queue/reconcile/regression tests.

Production-mode browser acceptance (not `next dev`) must prove:

1. Prepare a regular test account online with a two/three-grade class, learner roster, saved ILAW lesson and one teacher-uploaded PDF. Download a starter PDF too.
2. Wait for measured application readiness. Close the browser page, disable networking, reopen root in the same browser storage context. Repeat with an expired cloud access token. Do not substitute prototype mode for this account test.
3. Open the lesson, use the Teaching Guide, edit and save a lesson field, and save date-specific attendance with a note. Reopen again offline and verify exact IDs/content.
4. Read both PDFs without network, including after the original signed link expires. Exercise Word generation on a cold offline reopen without a previous Word click. Check Print/PDF as supported by the tested device.
5. Attempt online-only actions and verify explanatory states/no false success. Simulate storage failure, an interrupted download and an application update with an unsaved lesson.
6. Reconnect as the same teacher. Check the persisted remote lesson/attendance and queue acknowledgement. Sign in as a different teacher and verify no cross-account local access or sync.
7. Sign out, reopen offline and confirm the prior teacher workspace cannot be reopened. Confirm its unsynced records were not deleted. Check cross-tab sign-out too.
8. Repeat the core cold-boot/resource flow on an actual teacher-representative Android phone; desktop emulation alone is not evidence of device PDF/performance compatibility.

Use synthetic classroom/test-account records, never real learner information in fixtures or screenshots. Mocked tests are not evidence of a live Supabase round trip. Record which checks were automated, observed locally, performed live or still need a device/account. Do not request or log credentials/tokens.

Run app lint, full unit tests and production build before shipping implementation. Existing unrelated generated/untracked media must not be committed or changed to make checks pass. Browser-test tooling can be added narrowly during implementation planning; no test-only authentication bypass in the shipped app.

## Builder choices and delivery boundaries

The builder may select exact file/module names, IndexedDB helper implementation, minimal readiness presentation, download-progress mechanics, and a compatible PDF viewer after checking the target browser. Keep pure policy/state logic testable outside `app/page.tsx`. No broad refactor, new server, database migration, cloud-secret change or Supabase security-setting change is anticipated.

Plan implementation in small verified commits, pushed to main as Lance requested, while avoiding incomplete activated offline behavior. A partial infrastructure commit must not advertise readiness. Review authentication/storage boundaries before enabling local-only access. Refresh README/onboarding/Part 2 factual claims only after acceptance evidence exists; document remaining phone/live-test limits.

Reference guidance checked during discovery: Next.js PWA guide (https://nextjs.org/docs/app/guides/progressive-web-apps), service-worker caching (https://web.dev/learn/pwa/service-workers), Supabase getSession semantics (https://supabase.com/docs/reference/javascript/auth-getsession), and the installed Auth client source. Recheck integration APIs during planning; a generic service-worker example is not a complete offline strategy.
