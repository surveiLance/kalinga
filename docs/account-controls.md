# Account controls

Account settings and Help & support are available from the sidebar profile menu or mobile account button. Regular teachers can edit their display name and school. Email is read-only. Offline demo details stay in the prototype scope; guest names remain server-controlled. No guest-access setting is changed by this feature.

Name and school edits use account-scoped local storage and the durable pending-write queue. School-only jobs from older versions still replay correctly. Later school edits cannot discard an earlier unsynced name. Profile reads started before an edit cannot overwrite the successful edit when they arrive late.

For regular accounts, the initial cloud profile and lesson workspace must load before saving settings. After that, edits can be queued offline. Teacher/school identity is captured on saved plans before account defaults change. New plans use current defaults; editing a lesson's school field affects that lesson, not account defaults.

Forgot password is available on Sign in and through permanent-account settings. Reset emails use Supabase Auth and the existing CAPTCHA when configured. The recovery form opens only after PASSWORD_RECOVERY, never from a query flag alone. It is bound to the recovery account ID and dismissed when the session changes. New passwords require confirmation and at least eight characters; Supabase may enforce additional rules.

## Deployment check

Permit `https://kalinga-gules.vercel.app/?password-reset=1` in Supabase Auth's allowed redirects if it is not already allowed. Controlled localhost previews need their own permitted redirect. Verify recovery email templates, Site URL, SMTP delivery and rate limits in the intended project. Never paste a reset link or password in chat.

Local tests cover API payloads, expired/switched sessions, request errors, profile-read races, initial-load protection, queue coalescing and identity snapshots. Browser QA uses offline demo records. No real recovery email was sent and no real password was changed. Hosted delivery remains a separate user-controlled verification step; do not claim it was tested end to end.
