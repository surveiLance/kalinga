# Kalinga Visual UI Redesign

**Date:** October 2, 2026

**Status:** Approved design

**Selected direction:** Guided Day

## Purpose

Refresh Kalinga's interface so it is more appealing, coherent, and logically organized while preserving the workflows built for multigrade teachers in last-mile Philippine public schools. The result must balance everyday classroom usability with a polished presentation suitable for funder and stakeholder demonstrations.

This is a visual and information-hierarchy redesign. It is not a product, feature, or workflow redesign.

## Success criteria

- Teachers can scan each screen more quickly and identify the primary action without learning a new workflow.
- The interface feels consistent across Today, Classes & learners, Plan lessons, Teaching guide, Attendance, Find resources, Ask teachers, Learn Kalinga, authentication, account controls, notifications, and Gabay.
- Desktop and mobile layouts remain usable with clear hierarchy, readable type, and appropriately sized touch targets.
- Offline, saved, syncing, loading, empty, validation, and error states remain clear and trustworthy.
- The application presents well in a live demonstration without sacrificing low-connectivity classroom practicality.
- Existing automated checks continue to pass, and the current workflows behave identically after the redesign.

## Non-negotiable visual-only boundary

The redesign must not change Kalinga's feature set, workflow order, navigation destinations, data model, persistence behavior, or user permissions.

The following invariants apply throughout implementation:

- Every existing feature remains available.
- Every existing action retains its current handler, result, and destination.
- Main navigation labels and view relationships remain unchanged.
- Authentication and prototype-mode behavior remain unchanged.
- Class and learner management behavior remains unchanged.
- ILAW planning, saved-plan management, teaching guide behavior, and PDF and Word exports remain unchanged.
- Attendance selection, status handling, saving, and history remain unchanged.
- Resource library, upload, preview, sharing, discussion, and community behavior remain unchanged.
- Gabay context, privacy protections, drafting, conversations, and rate handling remain unchanged.
- Local storage, offline-first behavior, pending writes, cloud synchronization, Supabase access, and row-level security remain unchanged.
- Loading, empty, validation, offline, sync, and error states keep their current triggers and semantics.
- User-facing instructional content remains unchanged unless a wording adjustment is separately reviewed and approved.

Sample names and lesson details in the visual mockup are illustrative only. The implemented interface will render the application's existing data and states.

## Design direction

The approved Guided Day direction combines a calm teacher workspace with a clear daily focal point.

### Visual character

- Preserve Kalinga's warm, supportive identity rather than adopting a generic enterprise dashboard.
- Retain the recognizable cream, orange, teal, and ink palette, but assign each color a consistent semantic role.
- Use editorial display typography sparingly for major headings and a highly readable sans serif for interface text.
- Reduce visual noise by limiting shadows, ornamental containers, and competing accent colors.
- Use icons to improve scanning while keeping visible labels for essential navigation and actions.
- Create consistent component geometry for buttons, inputs, cards, alerts, menus, and status indicators.

### Information hierarchy

- Give each screen one clear page title and one primary action.
- Group existing actions by task and context instead of presenting equally weighted controls.
- Put current-class and current-day context near the top of task-oriented screens.
- Treat Gabay as contextual assistance within the teacher's workflow, not as a separate destination that competes with the task.
- Keep secondary information visible but quieter through typography, spacing, and surface treatment.

## Application shell

### Desktop

- Keep the existing left sidebar navigation and top workspace bar.
- Refine sidebar spacing, iconography, active state, offline status, and account presentation.
- Keep all current destinations and labels: Today, Classes & learners, Plan lessons, Find resources, Ask teachers, and Learn Kalinga.
- Keep notifications, connectivity state, account controls, and Gabay in their current functional locations, with updated visual styling.
- Use a consistent centered content width and predictable page padding across views.

### Mobile

- Preserve the current mobile navigation model and destinations.
- Improve touch targets, label clarity, content spacing, sticky behavior, and visual priority.
- Reflow dense desktop structures into readable stacked sections without hiding features.
- Keep all actions accessible without hover and avoid horizontal page overflow.

## Screen treatment

### Today

- Present the current teaching context as the strongest visual element.
- Organize existing class details, next actions, schedule, readiness information, and Gabay guidance into a clear scan order.
- Preserve all current Today actions, conditions, and destinations.
- Use the approved Guided Day mockup as the visual reference, adapting it to the actual data and controls already present in the application.

### Classes & learners

- Clarify the relationship between the class switcher, class summary, learner roster, schedules, and existing class actions.
- Standardize empty, sample-data, create, edit, and delete presentations without changing their behavior.
- Make dense learner and schedule information easier to scan on desktop and mobile.

### Plan lessons and Teaching guide

- Preserve the complete ILAW structure and all existing editor, draft, save, selection, deletion, teaching, print, PDF, and Word behavior.
- Improve section hierarchy, field grouping, grade-level differentiation, progress cues, and document readability.
- Keep editor, print view, and Word export content aligned exactly as required by the existing product contract.

### Attendance

- Preserve class selection, date navigation, attendance statuses, saving, and history behavior.
- Improve roster scanning, status affordances, saved-state feedback, and mobile touch ergonomics.
- Retain the existing status values and database conversion behavior.

### Resources and community

- Preserve filtering, matching, bookmarks, upload, preview, sharing, comments, discussions, mentions, and notification behavior.
- Improve resource-card consistency, metadata hierarchy, trust and visibility labels, and discussion readability.
- Keep community-upload transparency and privacy messaging intact.

### Gabay, authentication, notifications, and onboarding

- Preserve all existing behavior and privacy boundaries.
- Apply the same typography, spacing, surface, control, and status system used throughout the workspace.
- Keep Gabay visibly available but subordinate to the teacher's current task until opened.
- Retain all connection, rate-limit, authentication, prototype-mode, and storage feedback.

## Implementation structure

The repository's existing architecture remains in place.

- `app/page.tsx` continues to own the single-page interface and view-state navigation.
- Existing state variables, derived values, effects, event handlers, storage keys, pending-write behavior, Supabase calls, and component props remain functionally unchanged.
- JSX may be regrouped into visual wrappers or small presentational helpers when doing so reduces duplication and does not alter data flow.
- Testable application logic remains in `lib/*.ts`; the redesign must not move or rewrite that logic without a separately approved need.
- `app/globals.css` remains the primary styling surface and will receive a coherent token layer for color, typography, spacing, radii, elevation, focus, and responsive behavior.
- Existing accessible names, semantic controls, live regions, and keyboard behavior must be preserved or improved.

## Visual system

The implementation will define a compact set of shared tokens and patterns:

- Semantic colors for background, surface, text, muted text, border, primary action, teaching assistance, success, warning, and error.
- A consistent type scale for page titles, section titles, body text, labels, helper text, and metadata.
- A spacing scale used by the application shell, page sections, forms, and dense data views.
- Shared button levels: primary, secondary, quiet/text, and destructive.
- Shared form states: default, focus, disabled, invalid, and read-only.
- Shared surfaces for page sections, action groups, menus, dialogs, status callouts, and empty states.
- Consistent status treatments for offline, syncing, saved, attention, community-upload, private, and shared states.

These patterns change presentation only. They do not introduce new states or actions.

## Data flow and state behavior

No data-flow changes are planned. Existing render conditions will continue to determine what the user sees.

Visual regrouping must use current values and callbacks rather than introduce duplicate state. Presentational helpers, if created, receive display values and callbacks through props. They do not read or write storage, call Supabase, or implement business rules.

The UI must continue to reflect:

- The active teacher workspace and authentication mode.
- The selected class, plan, lesson, resource, discussion, and attendance date.
- Local and cloud synchronization states.
- Current network availability and storage errors.
- Existing loading, success, validation, and failure states.

## Error and edge-state design

- Preserve every current error and validation message.
- Use consistent placement, contrast, iconography, and spacing so problems are noticeable without dominating the entire page.
- Never use color alone to communicate a state.
- Keep offline and pending-sync indicators continuously understandable.
- Preserve disabled-state logic and make disabled controls visually distinct.
- Keep zero states actionable using the same existing actions.
- Ensure long class names, custom grade labels, long resource titles, and translated or Taglish content wrap without clipping.

## Accessibility and responsive requirements

- Maintain semantic buttons, links, inputs, labels, fieldsets, tables, dialogs, and live regions.
- Preserve or improve visible keyboard focus.
- Maintain readable contrast for text and controls.
- Provide touch targets of approximately 44 by 44 pixels for primary mobile interactions where layout permits.
- Do not reduce essential interface text below 12 pixels; supporting metadata should remain readable.
- Respect reduced-motion preferences.
- Verify layouts at representative narrow mobile, wide mobile/tablet, laptop, and desktop widths.
- Ensure all essential content and actions work without hover.

## Verification

Implementation is complete only when all of the following pass locally:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. Desktop visual review of every primary view.
5. Mobile visual review of every primary view.
6. Manual workflow comparison confirming that navigation, class setup, planning, teaching, attendance, resources, community, Gabay, authentication, and offline feedback behave as before.
7. Keyboard and focus review for navigation, forms, menus, dialogs, and primary task flows.
8. Overflow and long-content review for representative user-generated values.

## Delivery and deployment boundary

All work occurs on the local `ui-redesign` branch. Local development and verification use the Next.js development server and local build commands. No changes will be merged into `main`, pushed to a remote, or deployed to Vercel without explicit user approval after review.

## Reference mockup

The approved Guided Day concept is stored locally at `output/kalinga-ui-directions.html`. It is a visual reference rather than production markup. Production implementation will follow the existing Kalinga structure and behavior described above.
