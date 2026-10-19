# Gabay walkthrough

The Learn Kalinga tab and separate practice missions have been replaced with optional guidance on the actual workspace.

First-time visitors can choose Start with Gabay or Not now. To resume or replay, open Ask Gabay → conversation menu (•••) → Show me around Kalinga. The chapter selector jumps between Class setup, Lesson plans, and Other features. Back, Skip step, Next, Exit tour, and Move Gabay aside are always available. Escape exits the tour without closing an active class form or discarding its edits.

The 19 short hints prioritize class details, meeting times, learners, lesson setup, AI/manual drafting, editable ILAW content, safe revisions, saving, PDF/Word export, and the teaching guide. Attendance, resources, discussions, notifications, and sync get brief introductions. The guide follows relevant screen transitions, but teachers can also advance without performing an action.

This is not a sandbox. The walkthrough never fills fields, activates workspace controls, changes pages, runs AI, saves a class/lesson, marks attendance, or uploads/posts content. The teacher operates the real controls. Existing Save, Export, and Teach actions retain their normal behavior. Guide callbacks write only walkthrough progress under `workspaceStorageKey(scope, "tutorial-status")`. Version 2 avoids mapping obsolete practice mission indices onto real-workspace hints; existing stored preferences suppress another automatic invitation. A new session resumes only when requested from Gabay's menu.

The coach highlights visible `data-tour` anchors without reading field values. It moves into native class dialogs and modal PDF readers so it does not point at inert background controls. Its compact phone layout leaves bottom navigation accessible; minimizing removes it from the form. Initial/resume focus, Escape, readable labels, reduced motion, and print exclusion are included. No new dependencies or backend deployment are needed.

Verification: full Vitest suite, TypeScript, app lint excluding pre-existing `brag-output/**` artifacts, and production build. Browser checks use fictional prototype data on a separate localhost origin. No live AI request is required to test the tour.

Release checks (19 October 2026): 175 tests pass; TypeScript, scoped lint, and the production build pass. Browser-verified opt-out, menu replay/resume, class popup progression through explicit save, manual lesson editing, no implicit tour save, explicit lesson save, Back after save, teaching-guide handoff, desktop and 390×844 layout, minimizing, Escape/focus restoration, and PDF-modal scoping. Independent review found no Critical or Important issues; its two minor focus/modal findings were addressed and browser-verified. Real mobile soft-keyboard and assistive-technology testing remain manual follow-ups. Export content and APIs are unchanged; DOCX regression tests pass.
