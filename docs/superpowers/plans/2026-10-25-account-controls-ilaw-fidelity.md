# Account controls and ILAW fidelity

User approved implementation on 25 October 2026 and asked to begin without further design discussion. Preserve the original Filipino ILAW Word format while keeping Kalinga's expanded table presentation. Do not enable guest access or add roster import. Work in the existing checkout; no large page refactor, no live account changes or paid AI calls during testing.

## Implementation

- [x] Account controls: validated teacher/school editing, account-scoped durable profile queue, explicit guest restrictions, practical help, email password recovery with verified recovery-session form. Preserve existing lesson identities when account defaults change. Test validation, old queue compatibility, name/school coalescing, auth request boundaries and session failure.
- [x] Export fidelity: inspect source XML and rendered source. Match actual inherited Times New Roman body 11 pt, source heading roles, A4/half-inch margins, colors, borders and padding. Keep added fields in tables. Shared formatting contract for Word and browser/PDF. Test actual packed DOCX, variable grades, shared rows and long content.
- [x] Integration: render reference and generated Word samples with bundled LibreOffice, inspect every page; browser QA account/settings/help/forgot-password and editor with no real emails or credentials submitted. Run complete tests, lint, typecheck, build and diff check. Review before claiming completion; report rendering/platform caveats, do not claim DepEd approval. Commit independently verified changes; push only if requested.

## Boundaries

Profile jobs remain compatible with school-only jobs. Latest local queued fields win; cannot sync another account's job. Profile updates must not create new auth identities or alter email. Recovery must be based on Supabase PASSWORD_RECOVERY, never a query flag alone. Errors retain drafts, no account enumeration. No new dependency, destructive data operation or production backend deployment.

PDF pagination may differ by browser and Word pagination by installed fonts. Match source typography and structure, never shrink content silently or truncate activity text. Existing lesson content must survive formatting and profile changes.

## Verification record

224 tests, lint, TypeScript and production build pass. Fresh independent review found recovery-account binding, stale profile GET and initial-cloud-load races; all three were reproduced with failing tests and fixed. Mobile padding and fourth-grade flow colors were corrected. Final Word renders verified section banners stay attached to their following tables instead of being orphaned. Browser verified offline profile persistence, preserved saved lesson identity, help, forgot-password form, and 390px editor fit. No live recovery email/password change or backend setting was performed. Host reset redirect/delivery needs user-controlled verification.
