# Class Actions Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Apply the approved top-actions layout only to Classes & learners.
**Architecture:** A small presentational class header renders the class identity, conditional picker and primary actions. ClassesView retains ownership of all existing state, dialogs and callbacks; CSS is scoped to its new compact class.
**Tech Stack:** Existing React, TypeScript, CSS and Vitest; no dependencies.
**Spec:** docs/superpowers/specs/2026-10-25-class-actions-design.md

## Global Constraints
- Today is unchanged; preserve class editing, deletion, browsing tabs and walkthrough targets.
- No backend, data model or dependency changes. Preserve unrelated untracked assets.
- Use existing class callbacks; Find resources opens the library with the current class context.

## Review Focus
- Single vs multiple classes: picker appears only for multiple; selected class remains correct.
- No learners: attendance is still discoverable; existing empty-roster handling remains intact.
- Long names and 390px screens: actions wrap without clipping.
- Subject/learner/schedule edits: focused dialogs save only requested fields.
- Existing saved lessons and Today: no changes to routing semantics or the Today markup.

### Task 1: Compact class workspace
**Files:** components/class-workspace-header.tsx, app/page.tsx, app/globals.css; tests/class-workspace-header.test.ts.
**Interface:** ClassWorkspaceHeader consumes classes, selectedClass, onSelectClass, onAddClass, onAttendance, onPlan, onResources and optional children for the existing class options menu.
- [x] Write render tests for the visible action order, accessible class identity, conditional class picker, empty roster and long name.
- [x] Run the tests and observe the missing header feature fail.
- [x] Implement the header, wire existing callbacks, remove duplicate identity and Next step sidebar, and give detail edits visible buttons.
- [x] Run targeted tests, full npm test, lint, typecheck and production build. Verify desktop/mobile with real UI interactions, including attendance, resources, and all focused editing popups.
- [x] Review diff; commit only scoped changes. Report exact push status.

## Verification
227 tests pass. Desktop UI verified one class/no picker, all focused edit saves preserving 18 learners and two meetings, second-class creation/switching, correct attendance/plan/resource context, and empty-roster guidance. At 390px, all actions and all four browsing tabs fit without horizontal overflow (the old single-row tabs failed this check before the scoped two-row layout). Independent read-only review found no actionable regressions. No live account/backend writes or paid AI calls; QA records remain only in the local offline demo. Today JSX is unchanged.
