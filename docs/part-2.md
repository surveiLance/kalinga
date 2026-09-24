# Kalinga — Part 2: Implementation, Testing, and Reflection

**Course:** CSCI 111.13 — Artificial Intelligence in Education (Maria Mercedes T. Rodrigo), SY 2026–2027
**Part 2 weight:** 20% of the final grade · **Due:** 26 November, 11:59 pm (Canvas)
**Check-in:** 5 November — 10-minute status presentation to the class (5% of the final grade)
**Live prototype:** https://kalinga-gules.vercel.app · **Source:** https://github.com/surveiLance/kalinga

> **Submission housekeeping**
> Export as `P01_LastName1LastName2LastName3.PDF` (last names alphabetical). Part 2 must **include all Part 1 content** — prepend [Part 1](part-1.md) (or paste it in) when producing the final PDF.
> **Authors (fill in):** _LastName, First_ · _LastName, First_ · _LastName, First_
> **Status legend:** ✅ done · 🟡 in progress · ⛁ needs data (fill after testing)

---

## 0. Part 1 recap (include in the final PDF)

The full scope, AI insertion points, and architecture are in **[Part 1](part-1.md)** and are required to be part of this submission. In brief: Kalinga is an offline-first teacher's assistant for last-mile multigrade classrooms that supports lesson planning, differentiation, attendance, class/learner records, assessment, remediation, resources, and a teacher community, with an AI companion (**Gabay**) that drafts lesson plans and gives page-aware guidance without ever receiving learner personal data. Platform: a responsive web app that is installable on phones, Android-first, on Vercel + Supabase + Groq.

---

## 1. Implementation

### 1.1 What is built (✅ unless noted)

- **Authentication** — Supabase email/password, plus a no-backend "prototype" mode for demos. 🟡 password reset is roadmap.
- **Classes & learners** — multigrade classes, per-grade rosters, sex counts, meeting schedules.
- **Attendance** — date-specific, five statuses, notes, per-grade rollups, offline-safe.
- **Lesson planning (ILAW)** — editable document that matches the DepEd Daily Lesson Plan; per-grade Intentions / Learning Experience / Assessment / Ways Forward; multigrade models; whole-class vs per-grade blocks; a lesson-flow timeline whose block times recompute from durations.
- **Export** — Print/PDF and editable **Word (`.docx`)** in the DepEd DLP layout (Roman-numeral grade titles, per-grade learner counts, signature block).
- **Teaching guide** — run-the-lesson view, block by block.
- **Gabay AI** — whole-plan draft, per-grade redraft, page-aware Taglish chat; topic required before drafting; anti-generic-filler prompting; learner-PII stripped server-side; per-teacher rate limiting.
- **Resources** — starter no-printer PDFs, teacher uploads (private/shared), per-resource discussion.
- **Ask teachers** — discussions, replies, @-mentions, notifications.
- **Offline-first** — per-teacher local storage, a durable pending-write queue with retry/backoff and reconcile, honest sync-status indicator.
- **Mobile** — responsive across every screen; one-grade-at-a-time planning on phones. 🟡 installable-PWA service worker and native share are roadmap.

### 1.2 Architecture (as implemented)

See the diagram in [Part 1 §8](part-1.md). Concretely:

- **Frontend:** Next.js 16 / React 19, deployed on Vercel. Local-first: state persists to `localStorage` under a per-teacher key; a pending-write queue syncs to Supabase when online.
- **Backend:** Supabase — Postgres with row-level security (each teacher sees only their rows), Auth, Storage (resource PDFs), Realtime (community/notifications).
- **AI:** a Supabase Edge Function (Deno) verifies the teacher's session, removes learner PII, calls Groq (`openai/gpt-oss-20b`), validates the JSON draft, and returns it. The model key never reaches the browser.
- **Data sharing:** private classroom data isolated by RLS; only resources explicitly marked *shared* and community posts are readable by other teachers.

### 1.3 Screenshots (⛁ insert before submitting)

Capture these from https://kalinga-gules.vercel.app. Suggested set:

1. **Today** — the "what matters now" home. `![Today](screens/today.png)`
2. **Plan lessons — setup** — the four fields + "Draft the whole plan with Gabay". `![Setup](screens/plan-setup.png)`
3. **Plan lessons — editable ILAW document** with grades side by side. `![Planner](screens/plan-editor.png)`
4. **Gabay drafting** — a completed AI draft in the document. `![Gabay draft](screens/gabay-draft.png)`
5. **Exported DLP** — the Word/PDF next to a real DepEd DLP for comparison. `![Export](screens/export.png)`
6. **Teaching guide** — block-by-block run view. `![Teaching guide](screens/teaching-guide.png)`
7. **Attendance** — five-status rows on a phone. `![Attendance](screens/attendance.png)`
8. **Offline** — the sync indicator showing "waiting to sync". `![Offline](screens/offline.png)`

### 1.4 Link to the implementation

- **App:** https://kalinga-gules.vercel.app (use prototype mode for a no-login demo; sign in to exercise Gabay and sync).
- **Code:** https://github.com/surveiLance/kalinga

---

## 2. Testing (the core of Part 2)

> **Primary goal:** determine the **effectiveness and usefulness** of the app for last-mile multigrade teachers.
> **Secondary goal:** reflect on the **ethics** of the work.

### 2.1 Who the testers are (⛁ confirm & record)

At least **5 users**, recruited to resemble the real user. Target mix:

| # | Profile | Why included |
|---|---|---|
| 1–2 | Practising multigrade / public-school teachers | The actual user; ground truth on usefulness. |
| 3 | An education student or newly-hired teacher | Tests learnability without deep planning experience. |
| 4 | A teacher/school head who reviews DLPs | Judges whether the export is QA-acceptable. |
| 5 | A teacher on a low-end Android / weak connection | Tests the last-mile claim directly. |

Record for each: role, years teaching, grades handled, device, and typical connectivity. Obtain informed consent (see §3.4).

### 2.2 What we ask them to do (task scenarios)

Give each tester the same realistic tasks, minimal instructions, and observe. Suggested script:

1. **Set up a class** with two or three grade levels and a few learners.
2. **Take attendance** for today, including one Absent with a note; then reopen it to confirm it saved.
3. **Plan a lesson**: enter a topic (e.g. "Adding fractions with like denominators"), add one note about their class, and **draft the whole plan with Gabay**.
4. **Edit the draft**: change one grade's objective and one activity so it fits their class.
5. **Export** the plan to PDF or Word and judge whether they could submit it.
6. **Offline test**: enable airplane mode, edit the plan, re-enable, and confirm the change is kept.
7. **Find a resource** matched to their class.

### 2.3 How we measure effectiveness and usefulness

Mixed methods — behaviour, self-report, and artefact quality:

- **Task success rate** — completed / partially / failed per task (observation).
- **Time on task** — especially planning a lesson vs. their usual method (they estimate their baseline).
- **Errors / points of confusion** — where they hesitated, mis-tapped, or asked for help (think-aloud).
- **AI draft quality** — after drafting, teacher rates each ILAW section 1–5 for *accuracy*, *specificity to the topic*, and *usability as a starting point*; count sections used vs. rewritten from scratch.
- **Export acceptability** — the DLP-reviewer tester rates the export 1–5 for whether it would pass QA and what is missing.
- **Perceived usefulness & ease of use** — a short post-test survey (adapted TAM / SUS-style, 5-point): "Kalinga would save me time," "I would use this for my real planning," "It works well on my phone / with poor signal," "I trust the AI draft as a starting point."
- **Net intent** — "Would you use this next week? Why / why not?" (open-ended).

Record results in the table in §2.5.

### 2.4 Test plan summary

| Item | Plan |
|---|---|
| Method | Moderated task-based usability test, think-aloud, + post-test survey and short interview. |
| Environment | Testers' own phones where possible; one session forced onto weak/no connectivity. |
| Duration | ~30–40 min per tester. |
| Data captured | Task success, time, errors, AI-section ratings, export rating, survey scores, quotes. |
| Analysis | Success/time/score summaries + thematic coding of think-aloud and interview notes. |

### 2.5 Results (⛁ fill after testing)

**Per-task success**

| Task | Success | Partial | Failed | Notes |
|---|---|---|---|---|
| Set up class | | | | |
| Attendance (+ persistence) | | | | |
| Draft with Gabay | | | | |
| Edit the draft | | | | |
| Export | | | | |
| Offline round-trip | | | | |
| Find a resource | | | | |

**AI draft quality (mean 1–5)** — accuracy: __ · specificity: __ · usability: __ · sections used as-is: __/__

**Survey (mean 1–5)** — saves time: __ · would use for real: __ · works on phone/poor signal: __ · trusts AI draft: __

**Key qualitative findings** — _themes and representative quotes_

---

## 3. Reflection

### 3.1 Effectiveness / usefulness in last-mile schools (⛁ ground in results)

Discuss, against the evidence: Did Kalinga save planning time? Was the AI draft a usable starting point or busywork to fix? Did the export pass as a real DLP? Did it actually work offline / on a low-end phone? Where did the multigrade differentiation help or fall short?

### 3.2 How effectiveness / usefulness can be increased

Grounded in the design and expected findings:

- **Curated MATATAG competencies.** Have Gabay *select* from a verified competency table instead of generating codes — more trustworthy and cheaper. (Highest-value next step.)
- **True offline boot.** Ship the PWA service worker so the app opens with no signal, not just runs once open; native share of the exported plan.
- **SF2 / attendance form export.** Kalinga already holds the data; generating the monthly DepEd attendance form is a large, concrete time-saver.
- **Filipino-quality generation.** Evaluate and, if needed, switch to a stronger model for formal classroom Filipino.
- **Password reset & onboarding** for real teacher accounts.
- **Localisation** beyond Taglish (e.g. mother-tongue subjects).

### 3.3 Cost and sustainability

Each AI lesson draft costs a fraction of a centavo on paid inference; a school's monthly usage is a few pesos. The binding constraint is the free-tier rate limit, not cost — so the model is fundable at scale, which matters for the funder audience.

### 3.4 Ethical concerns

- **Learner data protection.** Learner names, LRNs, attendance notes, and health details are never sent to the LLM; classroom records are isolated per teacher by RLS and are never shareable. This is enforced server-side, not by convention. (Aligns with the Data Privacy Act.)
- **AI authority and correctness.** A weak model can produce plausible-but-wrong competency codes or pedagogy. Kalinga labels AI output as an editable *draft*, never as official DepEd content, requires a specific topic before drafting, forbids generic filler, and keeps the teacher's edit as the source of truth. Residual risk: a rushed teacher may submit an unverified draft — mitigated by framing and by the curated-competency roadmap.
- **Deskilling vs. support.** The aim is to remove blank-page drudgery, not the teacher's judgement; the app is built so the teacher edits every section. Worth monitoring in testing: does the draft anchor teachers to mediocre plans?
- **Equity and access.** Offline-first and Android-first are ethical choices — a tool that only works on good connectivity would widen the gap it claims to close.
- **Consent and attribution in the community.** Shared resources require the teacher to confirm they have the right to share; posts are attributed.

---

## 4. Check-in presentation outline (5 November, 10 min)

1. **The teacher and the problem** (1 min) — Teacher Sab's multigrade, last-mile reality.
2. **What Kalinga does** (1 min) — the daily loop: plan → teach → attendance.
3. **Live demo** (4–5 min) — draft a lesson with Gabay, edit a cell, export the DLP; show it working offline; show it on a phone.
4. **Architecture & the AI insertion points** (1–2 min) — web+mobile, offline sync, PII-safe AI.
5. **Last-mile fit & ethics** (1 min) — offline, no-printer, PII protection.
6. **Status & next steps** (1 min) — what's done, what's next (curated competencies, PWA offline, SF2), testing plan.

Maps to the check-in rubric: progress evident, design consistent with teacher needs, architecture accounts for last-mile circumstances.

---

## 5. Mapping to the Part 2 rubric (self-check for 18–20)

| Rubric criterion | Where |
|---|---|
| Implementation complete and functional | §1 (+ live app & repo) |
| Documentation of design complete and well-organized | Part 1 + §1–§3 |
| Testing documentation complete and well-organized | §2 |
| Test plan clear | §2.2–§2.4 |
| Test activities aligned with gauging effectiveness | §2.2–§2.3 |
| Reflection thoughtful and insightful | §3 |

---

*Maintained as the working submission. Before exporting: fill the author line, insert screenshots (§1.3), complete the ⛁ testing results (§2.5) and evidence-based reflection (§3.1), and prepend Part 1.*
