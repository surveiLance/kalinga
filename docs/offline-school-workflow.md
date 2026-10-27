# Prepare online, teach offline

Implemented 27 October 2026. This is local-device continuity, not offline AI or a cloud-backup guarantee.

## Preparing a personal device

1. Open the published Kalinga app online and sign into a regular teacher account. Use the same browser/device later. Installing its PWA is optional.
2. Save the classes, learners and lesson plans you need. The existing local workspace and durable pending-write queue hold saved classroom work; unsaved document edits are not promised after closing.
3. In Find resources, choose **Download for offline** for each PDF you want. Wait for **Downloaded on this device**. A title, bookmark or signed URL alone is not a download. Use **Downloaded only** to see the saved snapshots; the saved date shows when each copy was obtained.
4. Check the sidebar's offline readiness. Application preparation and local workspace persistence must both succeed. Download count/storage use are reported separately. A successful cloud sync does not mean application files have been prepared.
5. Test airplane mode before leaving signal: close the page, reopen Kalinga, open a saved lesson and a downloaded PDF. An actual device check is important.

## Without signal

The eligible regular teacher workspace can reopen even if its cloud access token expired. This is labelled local device work, not newly authenticated cloud access. Saved classes/learners, lesson editing, the Teaching Guide and date-specific attendance remain available. Changes use the same per-account queue. Word generation uses downloaded application code; Print/PDF uses the device's existing print/Save as PDF support.

Downloaded PDFs contain actual file bytes in scoped IndexedDB storage, with a bundled PDF.js reader, page navigation and a readable-text alternative. Downloads are limited to 20 MiB each. Refreshing replaces a snapshot only after the new copy is complete; cancelling or removing it cannot be undone by an older in-flight response. Removal affects only the local copy, not its shared cloud original.

Gabay AI chat/drafting/revision, uploads, resource comments/sharing changes, teacher discussions, new notifications and password recovery need internet. Deterministic Gabay page guides remain available. New guest enrollment and offline guest re-entry are not part of this feature; prototype mode remains separate.

## Reconnecting and signing out

Reconnection verifies cloud identity before resuming cloud reads/sync. Queued records are never flushed under a different account. If cloud authentication needs renewal, sign into the same teacher account; local work remains stored. Authentication failures do not consume the row retry budget. The existing pending-local-wins reconciliation is preserved.

Explicit sign-out immediately locks offline reopening, including across open tabs. Pending work is retained under its original teacher scope, not deleted. Sign in intentionally as that teacher to recover it. An old cached auth event cannot unlock a sign-out lock. Switching accounts keeps records and downloads separate.

Downloaded resource snapshots cannot be remotely revoked while a device is disconnected. A confirmed online denial/deletion removes the app-managed copy after reconnect; a transient outage does not. Do not download materials you lack permission to retain.

## Storage, updates and security

Use a device screen lock. Classroom data is locally readable; this feature does not add encryption or a PIN. Clearing browser data, browser eviction, private browsing or device loss can remove local copies. Persistent-storage requests are best effort. Storage errors must be resolved before offline readiness is claimed; the app does not delete classroom work to make room for PDFs.

The service worker caches only explicit same-origin application files and the clean application shell, not Supabase responses, classroom records, credentials, auth callback URLs, signed PDF URLs or arbitrary requests. Files needed for lazy Word export and PDF viewing are included in the production inventory. Normal development does not register the worker.

An update waits rather than reloading an unsaved document. Save work, close Kalinga tabs and reopen online when the app asks to finish preparation. The currently usable application cache is retained if a new preparation fails. A page using different build assets from its active worker is not marked prepared.

## Verification record

Automated unit tests exercise worker allowlists/incomplete installs, build inventories, scoped PDF bytes/transaction races/stream limits, local access locks/epochs, authentication error classification and readiness/AI guards. Production Chromium tests use the real built UI, service worker, browser storage, PDF renderer and Word exporter, but intercept Supabase requests with synthetic teacher/class records.

Observed with synthetic network fixtures: regular-account online preparation; expired-token cold offline reopen; teacher PDF reading after its network link is unavailable; first-use offline Word generation; manual lesson edits and Teaching Guide access offline; attendance/note persistence across reopen; same-account mocked reconnect; cross-tab sign-out and locked offline reopening; account-switch isolation; mobile-width PDF rendering. These are **not** claims of a live Supabase test or an actual Android phone test.

Remaining acceptance: a user-controlled regular test account round-trip against the live Supabase deployment, an actual teacher-representative Android phone (including native Print/PDF), long-duration storage/battery checks, and a real deployment update across browser versions. Desktop phone-width rendering is not Android compatibility evidence. Never put real learner data, passwords or email sign-in links into test fixtures or logs.

Dependency audit on 27 October: `npm audit --omit=dev` flags six production dependency-tree findings, including a critical finding on the existing Next.js 16.2.6 version. The new PDF.js package is not listed. Framework/transitive updates need their own compatibility/security follow-up; no unrelated automatic audit fix was applied in this feature.

Run `npm test`, application lint and `npm run build`; then `npm run test:offline` against the build. Browser tests use installed Chrome by default, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to select a supported Chromium binary. Do not run them against real account sessions. Unit tests are `.test.ts`; browser tests are isolated `.spec.ts` files.
