# Kalinga — Part 1: Scope, AI Insertion Points, and Architecture

**Course:** CSCI 111.13 — Artificial Intelligence in Education (Maria Mercedes T. Rodrigo), SY 2026–2027
**Project brief:** A prototype teachers' assistant app, as described by Teacher Sabrina Ongkiko and Ms. Dasha Uy, that can be shown to a funder and a development team to fund and build in full.
**Part 1 weight:** 15% of the final grade · **Due:** 8 October, 11:59 pm (Canvas)
**Live prototype:** https://kalinga-gules.vercel.app · **Source:** https://github.com/surveiLance/kalinga

> **Submission housekeeping**
> Rename the exported PDF `P01_LastName1LastName2LastName3.PDF` with group members' last names in alphabetical order (e.g. `P01_BonifacioRizalSilang.PDF`).
> **Authors (fill in):** _LastName, First_ · _LastName, First_ · _LastName, First_

---

## 1. What Kalinga is, in one paragraph

Kalinga is a teacher's assistant for **multigrade classrooms in last-mile Philippine public schools** — the one-teacher, several-grades-in-one-room setting that Teacher Sab works in. It carries the teacher through the work that repeats every day: keeping class and learner records, taking attendance, planning a standards-aligned lesson that differentiates across grades, running that lesson block by block, and drawing on shared teaching resources. Its distinguishing bet is that these teachers are **offline more than they are online** and are **overworked**, so core records and edits persist locally when connectivity drops, while an AI companion named **Gabay** removes the blank-page problem from the hardest task — lesson planning — whenever connectivity is available, without taking the teacher out of control.

The name *kalinga* is Filipino for care.

---

## 2. Teacher responsibilities we support

We scoped to the responsibilities that (a) recur daily or weekly, (b) are paperwork-heavy, and (c) are hardest in a multigrade room. Each maps to a core function in §3.

| Teacher responsibility | Why it is hard in a last-mile multigrade class | Kalinga's support |
|---|---|---|
| **Planning lessons** aligned to DepEd/MATATAG standards | One teacher must plan for 2–4 grade levels at once, each with distinct competencies, yet teach them in a single period. | ILAW lesson planner with per-grade columns, multigrade models, and an AI first draft. |
| **Differentiating instruction** across grades | Deciding who gets direct teaching while others work independently, every block. | A lesson-flow timeline where each block says what every grade does and who is with the teacher; whole-class blocks are marked. |
| **Recording attendance** | Daily, per learner, and later compiled into DepEd forms (e.g. SF2). | Date-specific attendance with five statuses, notes, and per-grade rollups; works offline. |
| **Managing class and learner records** | Rosters, grade levels, sex counts, schedules — re-encoded constantly. | Class + learner management with schedule/meeting blocks and roster summaries reused everywhere. |
| **Assessing and giving feedback** | Formative checks and success criteria per grade. | Assessment section of the plan (formative, exit task, success criteria) generated and editable per grade. |
| **Remediation and enrichment** | Planning next steps for learners above and below target. | "Ways Forward" section (reflection, remediation, enrichment) per grade. |
| **Finding and sharing materials** | Few resources; no printer; limited connectivity. | Resource library of no-printer, low-cost activities; teacher-to-teacher sharing. |
| **Learning from other teachers** | Professional isolation in remote postings. | "Ask teachers" community with questions, replies, and mentions. |

**Out of scope (deliberately, for the prototype):** grading/gradebook computation, official DepEd form submission/integration, parent communication, payroll/HR. These are named here so the funder sees the boundary and the roadmap.

---

## 3. Core functions

1. **Today** — a home screen that answers "what matters right now": today's classes, which need a plan, whether attendance is saved, and the next teaching block.
2. **Classes & learners** — create classes, set grade levels and subjects, add learners (name, grade, sex), and define meeting schedules.
3. **Plan lessons** — the centrepiece. A four-field setup (class, subject, topic, date) then an editable **ILAW** lesson document:
   - **I — Intentions:** content standard, performance standard, learning competency + code, and objective, per grade.
   - **L — Learning Experience:** learner context, materials, and a **flow-of-the-lesson timeline** where each block shows the stage, who the teacher is with, and each grade's task.
   - **A — Assessment:** formative assessment, exit task, and success criteria, per grade.
   - **W — Ways Forward:** reflection questions, remediation, and enrichment, per grade.
   - The plan is edited **in the exact layout that prints**, and exports as a **DepEd-style Daily Lesson Plan** to PDF or editable Word (`.docx`).
4. **Teaching guide** — turns a saved plan into a block-by-block view to run the lesson in class: current block, timer, what each grade is doing, and who is with the teacher.
5. **Attendance** — date-specific, five statuses (Present, Late, Absent, Excused, Leave), optional notes, per-grade tabs and a running summary.
6. **Find resources** — a starter library of ready-to-teach, no-printer PDFs, plus teacher uploads that can be kept private or shared with other signed-in teachers, with per-resource discussion.
7. **Ask teachers** — a shared discussion room for teacher-to-teacher questions, replies, and @-mentions, with notifications.
8. **Gabay** — the AI companion (see §4), reachable from every screen.

---

## 4. Insertion points for AI

AI is **inserted where the blank page is most expensive and the teacher can still verify the output** — never where it would fabricate records or make decisions the teacher owns. Gabay runs on an LLM (currently Groq's `openai/gpt-oss-20b`) through a server-side function. Kalinga supplies aggregate classroom context rather than roster records; the server also redacts known learner names and LRN-like identifiers from teacher-entered text before calling the model.

| # | Insertion point | What the AI does | Human-in-the-loop guardrail |
|---|---|---|---|
| 1 | **Whole-lesson draft** | From class context + a required topic + optional teacher notes ("Grade 3 struggles with regrouping; no printer; we have bottle caps"), Gabay drafts every ILAW section for every grade at once. | Requires a specific topic before it will run; the draft is applied to an editable form, and the teacher's prior work can be restored. |
| 2 | **Per-grade section redraft** | Re-draft one grade's Intentions or Assessment in place when only part of the plan is weak. | Fills a single cell the teacher can immediately overwrite. |
| 3 | **Page-aware guidance chat** | Gabay answers "what do I do here / where do I go" using the current screen and verified classroom context, in Taglish. | Advisory only; points to the most relevant action on the current page. |
| 4 | **Competency suggestion** (design) | Suggest a competency and measurable objective for a grade. | Labelled a *draft suggestion*, never asserted as an official DepEd competency; roadmap item is to have Gabay **select** from a curated MATATAG table rather than generate codes. |
| 5 | **Resource matching** (design) | Surface library resources that match the active class's grade levels and subjects. | Teacher chooses; matching is a filter, not an action. |

**Ethical design already built in (expanded in Part 2):**
- **Minimise learner PII.** Automatic app context contains aggregate information only. The server redacts names found in the teacher's roster and LRN-like identifiers from teacher-entered messages and planning notes. The interface still tells teachers not to paste attendance, health, or other sensitive details because no free-text detector can guarantee removal of every possible identifier.
- **Draft, not authority.** AI output is always framed as an editable starting point; competencies are never presented as official unless a verified source is supplied.
- **The teacher stays in control.** Every AI action lands in an editable field, with restore.
- **Key safety.** The model key lives only in the server function, never in the browser; requests are rate-limited per teacher and fail open so a limiter fault never blocks teaching.

---

## 5. Teaching and learning goals

Framed for the rubric ("clarity of teaching and learning goals"):

- **For the teacher:** reduce the time and cognitive load of planning a standards-aligned, differentiated multigrade lesson from ~an hour of blank-page work to minutes of reviewing and adjusting a draft — so more of the teacher's time goes to teaching, not paperwork.
- **For the learners (mediated through the teacher):** every grade in the room gets a lesson with an explicit competency, a grade-appropriate task in each block, a formative check, and a remediation/enrichment path — so no grade is parked with busywork while another is taught.
- **Alignment target:** DepEd's MATATAG curriculum and the Daily Lesson Plan format teachers already submit for quality assurance, so Kalinga's output is recognisable and usable by school heads, not a parallel artefact.

## 6. Teaching and evaluation methods supported

- **Multigrade instructional models**, selectable per lesson: Same Theme, Different Task (STDT); Same Topic, Same Task (STST); Different Topic, Different Task (DTDT); and peer-led rotation. The lesson flow makes the chosen model concrete block by block.
- **The ILAW lesson structure** (Intentions · Learning Experience · Assessment · Ways Forward), which organises planning around intentions and evidence rather than activities alone.
- **Evaluation:** per-grade **formative assessment**, **exit tasks**, and **success criteria** that state what a learner can do with the topic — generated as a starting point and edited by the teacher. Attendance provides the participation record.

## 7. Methods of remediation

- The **Ways Forward** section captures, per grade: a **reflection question** (what evidence the teacher will look at after teaching), a **remediation** plan (support for learners below target), and an **enrichment** plan (extension for those ready) — plus **notes for the next session / whole-school follow-up**.
- These are proposed supports, not recorded results: the app explicitly separates *planned* remediation (before teaching) from actual learner outcomes (recorded only after).

---

## 8. Platform and general architecture

**Clear platform identification (rubric item):** Kalinga is currently a **responsive web application** for desktop and phone browsers. An installable PWA with offline boot, followed by a possible native Android wrapper (Capacitor) for Play Store distribution, is on the roadmap. The mobile design is Android-first because that is the expected device context for last-mile Philippine schools.

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENTS                                                      │
│  • Web (desktop browser)      • Phone (responsive web)        │
│  • Same React codebase, responsive; one-grade-at-a-time on    │
│    phones; local edits persist while the app is available      │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼─────────────────────────────────────────────┐
│  APP  — Next.js 16 / React 19, hosted on Vercel              │
│  • All views; local-first state in the browser               │
│  • Pending-write queue: edits saved locally, synced when      │
│    a connection returns                                       │
└───────────────┬─────────────────────────────────────────────┘
                │
        ┌───────▼────────┐        ┌──────────────────────────┐
        │  SUPABASE      │        │  GABAY EDGE FUNCTION      │
        │  • Postgres    │        │  • Deno function on        │
        │    (+ RLS)     │◄──────►│    Supabase               │
        │  • Auth        │        │  • Verifies the teacher,   │
        │  • Storage     │        │    minimises learner PII,  │
        │    (resources) │        │    calls the LLM           │
        │  • Realtime    │        │  • Holds the model key      │
        └────────────────┘        └───────────┬──────────────┘
                                               │
                                     ┌─────────▼─────────┐
                                     │  LLM (Groq)        │
                                     │  gpt-oss-20b       │
                                     └───────────────────┘
```

**Web and mobile (rubric: "they will need both a web and a mobile version").** One responsive React codebase serves desktop and phone browsers. On a phone the lesson document shows one grade at a time behind a switcher and attendance is one tap per learner. Installability, a service worker for true offline boot, native sharing of the exported plan, and a Play Store APK via Capacitor remain roadmap work rather than current capabilities.

**Data shared among teachers (rubric requirement).** Private classroom data (classes, learners, attendance, plans) is isolated per teacher by Postgres **row-level security** — each teacher reads and writes only their own rows. Deliberately shared data — **resources marked "shared"** and the **Ask-teachers community** — is readable by any signed-in teacher. Sharing is always an explicit teacher action, never automatic, and learner records are never shareable.

**Last-mile circumstances (check-in rubric).** Local-first while the app is already loaded: class, plan, attendance, and profile edits persist on the device, queue durably, and sync with retry/backoff when connectivity returns; the UI shows sync state honestly. A service worker is still needed before Kalinga can promise that the application itself will open offline. Gabay, teacher discussions, uploads, and uncached files require connectivity. Resources are chosen to be no-printer and low-cost. AI cost and latency must be measured during testing against the deployed model and real token usage before making a per-teacher cost claim.

**Security posture.** Per-teacher RLS; the LLM key confined to the server function; per-teacher rate limiting that fails open; explicit sharing only.

---

## 9. Mapping to the Part 1 rubric (self-check for 14–15)

| Rubric criterion | Where addressed |
|---|---|
| High clarity of teaching and learning goals | §5 |
| Appropriate selection of teaching and evaluation methods | §6 |
| Appropriate methods of remediation | §7 |
| Clear identification of platform | §8 (responsive web now; installable PWA and Android wrapper as roadmap, Vercel + Supabase + Groq) |
| Scope of functions defined | §2, §3 |
| Insertion points for AI identified | §4 |
| Architecture (web + mobile, shared data) | §8 |

---

*This document is maintained as the working submission. Update the author line and file name before exporting to PDF for Canvas.*
