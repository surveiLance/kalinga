"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";

type View = "home" | "classes" | "plan" | "library" | "attendance" | "community";

type GradeLevel = string;

type LearnerSex = "Female" | "Male" | "Not specified";

type ClassLearner = {
  id: string;
  name: string;
  grade: GradeLevel;
  sex: LearnerSex;
};

type ClassMeeting = {
  id: string;
  days: string;
  startTime: string;
  durationMinutes: number;
  label: string;
};

type TeachingClass = {
  id: string;
  name: string;
  grades: GradeLevel[];
  subjects: string[];
  quarter: string;
  meetingDays: string;
  startTime: string;
  meetings: ClassMeeting[];
  learners: ClassLearner[];
};

type LegacyTeachingClass = Omit<Partial<TeachingClass>, "grades" | "learners" | "meetings"> & {
  id: string;
  name: string;
  grades?: Array<GradeLevel | number>;
  learners?: Array<Omit<ClassLearner, "grade" | "sex"> & { grade: GradeLevel | number; sex?: LearnerSex | string }>;
  meetings?: Array<Partial<ClassMeeting>>;
  subject?: string;
  learnerCount?: number;
};

type PlanSlot = {
  id: string;
  time: string;
  teacherFocus: string;
  gradeTasks: Record<GradeLevel, string>;
};

type SavedPlan = {
  id: string;
  classId: string;
  title: string;
  subject: string;
  quarter: string;
  grades: GradeLevel[];
  duration: string;
  startTime?: string;
  language?: string;
  competencies?: Record<GradeLevel, string>;
  sharedTheme?: string;
  multigradeModel?: string;
  objectives?: Record<GradeLevel, string>;
  learnerContext?: string;
  materials?: string;
  formativeAssessments?: Record<GradeLevel, string>;
  exitTasks?: Record<GradeLevel, string>;
  successCriteria?: Record<GradeLevel, string>;
  reflection?: string;
  remediation?: string;
  enrichment?: string;
  nextSessionNotes?: string;
  slots: PlanSlot[];
  savedAt: string;
};

type LegacySavedPlan = Omit<SavedPlan, "grades"> & { grades: Array<GradeLevel | number> };

const commonSubjects = ["Mathematics", "Science", "English", "Filipino", "Araling Panlipunan", "MAPEH", "Edukasyon sa Pagpapakatao", "TLE"];
const commonGradeLevels: GradeLevel[] = ["Kindergarten", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const learnerNames = ["Angela P. Morales", "Benjie R. Santos", "Carla M. Dela Cruz", "Daryl T. Gomez", "Elaine B. Ramos", "Francis A. Uy", "Grace L. Villanueva", "Harold N. Flores", "Irene C. Mendoza", "Jose R. Lim", "Karla S. Reyes", "Luis M. Aquino", "Mariel C. Torres", "Noel B. Pangan", "Olivia R. Cabahug", "Paolo S. Evasco", "Queenie M. Dayao", "Ramon L. Flores"];

function normalizeGradeLevel(grade: GradeLevel | number): GradeLevel {
  const cleaned = String(grade).trim();
  if (!cleaned) return "1";
  if (/^(k|kinder|kindergarten)$/i.test(cleaned)) return "Kindergarten";
  const numberedGrade = cleaned.match(/^grade\s+(\d+)$/i);
  return numberedGrade ? numberedGrade[1] : cleaned;
}

function gradeLabel(grade: GradeLevel) {
  return grade === "Kindergarten" || /[a-z]/i.test(grade) ? grade : `Grade ${grade}`;
}

function gradeList(grades: GradeLevel[]) {
  return grades.map(gradeLabel).join(", ");
}

function normalizeLearnerSex(value?: string): LearnerSex {
  if (/^(female|f)$/i.test(value || "")) return "Female";
  if (/^(male|m)$/i.test(value || "")) return "Male";
  return "Not specified";
}

function learnerSexCounts(learners: ClassLearner[]) {
  return learners.reduce((counts, learner) => {
    if (learner.sex === "Female") counts.female += 1;
    else if (learner.sex === "Male") counts.male += 1;
    else counts.unspecified += 1;
    return counts;
  }, { female: 0, male: 0, unspecified: 0 });
}

function learnerRosterSummary(learners: ClassLearner[], compact = false) {
  if (!learners.length) return compact ? "No learners yet" : "No sex data yet";
  const counts = learnerSexCounts(learners);
  const labels = compact
    ? [`${counts.female}F`, `${counts.male}M`]
    : [`${counts.female} female`, `${counts.male} male`];
  if (counts.unspecified) labels.push(compact ? `${counts.unspecified} not set` : `${counts.unspecified} not specified`);
  return labels.join(" · ");
}

function teacherLabel(name: string) {
  const cleaned = name.trim();
  return cleaned ? `Teacher ${cleaned}` : "Teacher";
}

function teacherInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "T";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

function dateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function moveDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

function sortGradeLevels(grades: GradeLevel[]) {
  return [...grades].sort((a, b) => {
    const aIndex = commonGradeLevels.indexOf(a);
    const bIndex = commonGradeLevels.indexOf(b);
    if (aIndex >= 0 || bIndex >= 0) return (aIndex >= 0 ? aIndex : commonGradeLevels.length) - (bIndex >= 0 ? bIndex : commonGradeLevels.length);
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function createSampleLearners(grades: GradeLevel[], count: number): ClassLearner[] {
  const safeGrades = grades.length ? grades : ["1"];
  return Array.from({ length: count }, (_, index) => ({
    id: `learner-${index + 1}`,
    name: learnerNames[index] || `Learner ${String(index + 1).padStart(2, "0")}`,
    grade: safeGrades[index % safeGrades.length],
    sex: index % 2 ? "Male" : "Female",
  }));
}

function createDefaultMeeting(days = "Monday to Friday", startTime = "8:00 AM", index = 0): ClassMeeting {
  return { id: `meeting-${Date.now()}-${index}`, days, startTime, durationMinutes: 60, label: "Regular class" };
}

function daysForPattern(pattern: string) {
  if (pattern === "Monday to Friday") return weekDays.slice(0, 5);
  if (pattern === "Monday, Wednesday, Friday") return ["Monday", "Wednesday", "Friday"];
  if (pattern === "Tuesday and Thursday") return ["Tuesday", "Thursday"];
  const namedDays = weekDays.filter((day) => pattern.toLowerCase().includes(day.toLowerCase()));
  return namedDays.length ? namedDays : ["Custom schedule"];
}

function formatMeetingDays(days: string[]) {
  const weekdays = weekDays.slice(0, 5);
  return weekdays.every((day, index) => days[index] === day) && days.length === weekdays.length ? "Monday to Friday" : days.join(", ");
}

function normalizeClass(item: LegacyTeachingClass): TeachingClass {
  const grades = Array.isArray(item.grades) && item.grades.length ? item.grades.map(normalizeGradeLevel) : ["1"];
  const subjects = Array.isArray(item.subjects) && item.subjects.length
    ? item.subjects.filter(Boolean)
    : [item.subject || "Mathematics"];
  const learners = Array.isArray(item.learners) && item.learners.length
    ? item.learners.map((learner, index) => ({ id: learner.id || `${item.id}-learner-${index + 1}`, name: learner.name, grade: normalizeGradeLevel(learner.grade || grades[0]), sex: normalizeLearnerSex(learner.sex) }))
    : createSampleLearners(grades, Math.max(0, item.learnerCount || 0)).map((learner) => ({ ...learner, id: `${item.id}-${learner.id}` }));
  const meetingDays = item.meetingDays || "Monday to Friday";
  const startTime = item.startTime || "8:00 AM";
  const meetings = Array.isArray(item.meetings) && item.meetings.length
    ? item.meetings.map((meeting, index) => ({ id: meeting.id || `${item.id}-meeting-${index + 1}`, days: meeting.days || meetingDays, startTime: meeting.startTime || startTime, durationMinutes: Math.max(5, Number(meeting.durationMinutes) || 60), label: meeting.label?.trim() || "Regular class" }))
    : [{ ...createDefaultMeeting(meetingDays, startTime), id: `${item.id}-meeting-1` }];

  return {
    id: item.id,
    name: item.name,
    grades,
    subjects,
    quarter: item.quarter || "Quarter 1",
    meetingDays: meetings[0].days,
    startTime: meetings[0].startTime,
    meetings,
    learners,
  };
}

function normalizeSavedPlan(plan: LegacySavedPlan): SavedPlan {
  return { ...plan, grades: plan.grades.map(normalizeGradeLevel) };
}

const sampleClass: TeachingClass = {
  id: "sample-morning",
  name: "Morning Multigrade Class",
  grades: ["3", "4", "5"],
  subjects: ["Mathematics", "Science", "English", "Filipino"],
  quarter: "Quarter 1",
  meetingDays: "Monday to Friday",
  startTime: "8:00 AM",
  meetings: [
    { id: "sample-meeting-morning", days: "Monday to Friday", startTime: "8:00 AM", durationMinutes: 80, label: "Morning learning block" },
    { id: "sample-meeting-remediation", days: "Tuesday and Thursday", startTime: "1:30 PM", durationMinutes: 45, label: "Reading support" },
  ],
  learners: createSampleLearners(["3", "4", "5"], 18),
};

function GradeLevelPicker({ value, onChange }: { value: GradeLevel[]; onChange: (grades: GradeLevel[]) => void }) {
  const [customGrade, setCustomGrade] = useState("");

  function toggle(grade: GradeLevel) {
    onChange(value.includes(grade) ? value.filter((item) => item !== grade) : sortGradeLevels([...value, grade]));
  }

  function addCustomGrade() {
    if (!customGrade.trim()) return;
    const next = normalizeGradeLevel(customGrade);
    const existing = value.find((item) => item.toLowerCase() === next.toLowerCase());
    if (!existing) onChange(sortGradeLevels([...value, next]));
    setCustomGrade("");
  }

  return <div className="grade-picker-wrap compact-picker"><details className="multi-select-picker"><summary><span>{value.length ? gradeList(value) : "Choose grade levels"}</span><small>{value.length ? `${value.length} selected` : "Select one or more"}</small></summary><div className="multi-select-panel"><div className="grade-picker">{commonGradeLevels.map((grade) => <button className={value.includes(grade) ? "selected" : ""} type="button" key={grade} onClick={() => toggle(grade)}><span>{value.includes(grade) ? "✓" : grade === "Kindergarten" ? "K" : grade}</span>{gradeLabel(grade)}</button>)}</div><div className="custom-grade"><input value={customGrade} onChange={(event) => setCustomGrade(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomGrade(); } }} placeholder="Another level (e.g. ALS, SPED group)" /><button className="secondary-button" type="button" onClick={addCustomGrade}>Add level</button></div></div></details>{!!value.length && <div className="selected-grades">{value.map((grade) => <button type="button" key={grade} onClick={() => toggle(grade)}>{gradeLabel(grade)} ×</button>)}</div>}</div>;
}

export default function Home() {
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("home");
  const [hasEntered, setHasEntered] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [classes, setClasses] = useState<TeachingClass[]>([]);
  const [activeClassId, setActiveClassId] = useState("");
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savedResourceIds, setSavedResourceIds] = useState<number[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, Record<string, string>>>({});
  const [attendanceNotes, setAttendanceNotes] = useState<Record<string, Record<string, string>>>({});
  const [editingPlanId, setEditingPlanId] = useState("");
  const [classDataReady, setClassDataReady] = useState(false);
  const [teacherName, setTeacherName] = useState("Ana");
  const [teacherEmail, setTeacherEmail] = useState("teacher.ana@kalinga.ph");

  useEffect(() => {
    try {
      const storedClasses = window.localStorage.getItem("kalinga-classes");
      const storedActiveClass = window.localStorage.getItem("kalinga-active-class");
      const storedPlans = window.localStorage.getItem("kalinga-plans");
      const storedResources = window.localStorage.getItem("kalinga-saved-resources");
      const storedAttendance = window.localStorage.getItem("kalinga-attendance");
      const storedAttendanceNotes = window.localStorage.getItem("kalinga-attendance-notes");
      const storedTeacherName = window.localStorage.getItem("kalinga-teacher-name");
      const storedTeacherEmail = window.localStorage.getItem("kalinga-teacher-email");
      if (storedClasses) {
        const parsed = (JSON.parse(storedClasses) as LegacyTeachingClass[]).map(normalizeClass);
        // Hydrate device-only prototype data after the client mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setClasses(parsed);
        setActiveClassId(storedActiveClass || parsed[0]?.id || "");
      }
      if (storedPlans) setSavedPlans((JSON.parse(storedPlans) as LegacySavedPlan[]).map(normalizeSavedPlan));
      if (storedResources) setSavedResourceIds(JSON.parse(storedResources) as number[]);
      if (storedAttendance) setAttendanceRecords(JSON.parse(storedAttendance) as Record<string, Record<string, string>>);
      if (storedAttendanceNotes) setAttendanceNotes(JSON.parse(storedAttendanceNotes) as Record<string, Record<string, string>>);
      if (storedTeacherName) setTeacherName(storedTeacherName);
      if (storedTeacherEmail) setTeacherEmail(storedTeacherEmail);
    } catch {
      // A clean zero state is safer than blocking the prototype on damaged local data.
    } finally {
      setClassDataReady(true);
    }
  }, []);

  useEffect(() => {
    if (!classDataReady) return;
    window.localStorage.setItem("kalinga-classes", JSON.stringify(classes));
    window.localStorage.setItem("kalinga-active-class", activeClassId);
    window.localStorage.setItem("kalinga-plans", JSON.stringify(savedPlans));
    window.localStorage.setItem("kalinga-saved-resources", JSON.stringify(savedResourceIds));
    window.localStorage.setItem("kalinga-attendance", JSON.stringify(attendanceRecords));
    window.localStorage.setItem("kalinga-attendance-notes", JSON.stringify(attendanceNotes));
    window.localStorage.setItem("kalinga-teacher-name", teacherName);
    window.localStorage.setItem("kalinga-teacher-email", teacherEmail);
  }, [classes, activeClassId, savedPlans, savedResourceIds, attendanceRecords, attendanceNotes, teacherName, teacherEmail, classDataReady]);

  const activeClass = classes.find((item) => item.id === activeClassId) || classes[0];
  const today = dateInputValue();
  const activePlans = savedPlans.filter((item) => item.classId === activeClass?.id);
  const latestPlan = activePlans[0];
  const activeAttendance = activeClass
    ? Object.entries(attendanceRecords).filter(([key]) => key.startsWith(`${activeClass.id}-${today}-grade-`) || key.startsWith(`${activeClass.id}-grade-`)).flatMap(([, records]) => Object.values(records))
    : [];

  function beginPlan(planId?: string) {
    setEditingPlanId(typeof planId === "string" ? planId : "");
    setView("plan");
    setNotice("");
  }

  function signOut() {
    setAccountOpen(false);
    setView("home");
    setNotice("");
    setHasEntered(false);
  }

  function saveClass(newClass: Omit<TeachingClass, "id">, classId?: string) {
    const item = { ...newClass, id: classId || `class-${Date.now()}` };
    setClasses((current) => classId ? current.map((entry) => entry.id === classId ? item : entry) : [...current, item]);
    setActiveClassId(item.id);
    setView("classes");
    setNotice(`${item.name} ${classId ? "was updated" : "is ready"} across planning, attendance, and resources.`);
  }

  function deleteClass(classId: string) {
    const removedClass = classes.find((item) => item.id === classId);
    const remainingClasses = classes.filter((item) => item.id !== classId);
    setClasses(remainingClasses);
    setSavedPlans((current) => current.filter((plan) => plan.classId !== classId));
    setAttendanceRecords((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${classId}-`))));
    setAttendanceNotes((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${classId}-`))));
    setActiveClassId((current) => current === classId ? remainingClasses[0]?.id || "" : current);
    setEditingPlanId((current) => savedPlans.some((plan) => plan.id === current && plan.classId === classId) ? "" : current);
    setNotice(`${removedClass?.name || "Class"} and its connected plans and attendance records were deleted.`);
  }

  function loadSampleClass() {
    setClasses([sampleClass]);
    setActiveClassId(sampleClass.id);
    setView("classes");
    setNotice("Sample school data loaded. You can edit or add classes anytime.");
  }

  function savePlan(plan: SavedPlan) {
    setSavedPlans((current) => [plan, ...current.filter((item) => item.id !== plan.id)]);
    setEditingPlanId(plan.id);
    setNotice(`${plan.title} was saved under ${classes.find((item) => item.id === plan.classId)?.name || "your class"}.`);
  }

  function toggleSavedResource(resourceId: number) {
    setSavedResourceIds((current) => current.includes(resourceId) ? current.filter((id) => id !== resourceId) : [...current, resourceId]);
  }

  function saveAttendance(updates: Record<string, Record<string, string>>, noteUpdates: Record<string, Record<string, string>>) {
    setAttendanceRecords((current) => ({ ...current, ...updates }));
    setAttendanceNotes((current) => ({ ...current, ...noteUpdates }));
  }

  if (!hasEntered) {
    return <LoginScreen name={teacherName} email={teacherEmail} onNameChange={setTeacherName} onEmailChange={setTeacherEmail} onContinue={() => setHasEntered(true)} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <button className="brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}>
          <Image src="/kalinga-logo.png" width={2172} height={724} alt="Kalinga" priority />
        </button>

        <nav className="nav-list">
          <button className={`nav-item ${view === "home" ? "active" : ""}`} type="button" onClick={() => setView("home")}><span className="nav-icon">⌂</span> Today</button>
          <button className={`nav-item ${view === "classes" ? "active" : ""}`} type="button" onClick={() => setView("classes")}><span className="nav-icon">▦</span> Classes &amp; learners</button>
          <button className={`nav-item ${view === "plan" ? "active" : ""}`} type="button" onClick={() => beginPlan()}><span className="nav-icon">＋</span> Plan lessons</button>
          <button className={`nav-item ${view === "library" ? "active" : ""}`} type="button" onClick={() => setView("library")}><span className="nav-icon">▱</span> Find resources</button>
          <button className={`nav-item ${view === "community" ? "active" : ""}`} type="button" onClick={() => setView("community")}><span className="nav-icon">♧</span> Ask teachers</button>
        </nav>

        <div className="offline-card">
          <span className="status-dot" />
          <div><strong>Offline-ready</strong><small>12 resources saved</small></div>
        </div>

        <div className="account-anchor desktop-account">
          {accountOpen && <AccountMenu name={teacherName} email={teacherEmail} onSignOut={signOut} />}
          <button className="profile" type="button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>
            <span className="avatar">{teacherInitials(teacherName)}</span>
            <span><strong>{teacherLabel(teacherName)}</strong><small>Dinagat Elementary</small></span>
            <span aria-hidden="true">···</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}><Image src="/kalinga-logo.png" width={2172} height={724} alt="Kalinga" priority /></button>
          <div className="top-actions">
            <span className="connection"><i /> Offline-ready</span>
            <button className="language" type="button">ENG / FIL</button>
            <button className="notification" type="button" aria-label="Notifications">●</button>
            <div className="account-anchor mobile-account">
              <button className="mobile-account-button" type="button" aria-label="Account options" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>{teacherInitials(teacherName)}</button>
              {accountOpen && <AccountMenu name={teacherName} email={teacherEmail} onSignOut={signOut} />}
            </div>
          </div>
        </header>

        <div className="content">
          {view === "home" && !activeClass ? <ClassZeroState onSetUp={() => setView("classes")} onLoadSample={loadSampleClass} /> : view === "home" && activeClass ? <>
            <section className="welcome-row home-welcome">
              <div><p className="eyebrow">{displayDate(today).toUpperCase()}</p><h1 className="welcome-title"><span>MAGANDANG ARAW,</span><em>{teacherLabel(teacherName)}!</em></h1><p className="lead">See what you teach today, then open the exact class tool you need.</p></div>
            </section>
            {notice && <p className="notice" role="status">{notice}</p>}
            <AllClassesSchedule classes={classes} placement="home" onOpenClass={(classId) => { setActiveClassId(classId); setView("classes"); }} />
            <section className="home-command-grid">
              <article className="home-today-card">
                <div className="card-label-row"><span className="pill orange">CLASS WORKSPACE</span><label className="home-class-context"><span>Working with</span><select value={activeClass.id} onChange={(event) => setActiveClassId(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
                <p className="muted">{gradeList(activeClass.grades).toUpperCase()} · {activeClass.subjects.length} SUBJECTS · {activeClass.learners.length} LEARNERS</p>
                <h2>{activeClass.name}</h2>
                <div className="home-readiness-list">
                  <div><span className={latestPlan ? "ready-dot complete" : "ready-dot"} /><p><b>Lesson plan</b><small>{latestPlan ? `${latestPlan.title} is ready and editable` : "No lesson prepared yet"}</small></p><button type="button" onClick={() => beginPlan(latestPlan?.id)}>{latestPlan ? "Review" : "Create"} →</button></div>
                  <div><span className={activeAttendance.length ? "ready-dot complete" : "ready-dot"} /><p><b>Attendance</b><small>{activeAttendance.length ? `${activeAttendance.length} learner records saved` : "Ready for today’s class"}</small></p><button type="button" onClick={() => setView("attendance")}>Open →</button></div>
                </div>
                <button className="dark-button home-class-button" type="button" onClick={() => setView("classes")}>Open {activeClass.name} <span>→</span></button>
              </article>
              <aside className="home-shortcuts">
                <p className="eyebrow">QUICK START</p><h2>Do one thing now</h2><p>Open the exact tool you need without scrolling through class records.</p>
                <button type="button" onClick={() => beginPlan()}><span>＋</span><p><b>Plan a lesson</b><small>Start from this saved class</small></p><b>→</b></button>
                <button type="button" onClick={() => setView("attendance")}><span>✓</span><p><b>Take attendance</b><small>{activeClass.learners.length} learners ready</small></p><b>→</b></button>
                <button type="button" onClick={() => setView("library")}><span>▤</span><p><b>Find a resource</b><small>Search the teacher library</small></p><b>→</b></button>
              </aside>
            </section>
          </> : view === "classes" ? <ClassesView classes={classes} activeClassId={activeClass?.id || ""} savedPlans={savedPlans} attendanceRecords={attendanceRecords} onSelectClass={setActiveClassId} onSave={saveClass} onDelete={deleteClass} onLoadSample={loadSampleClass} onPlan={beginPlan} onAttendance={() => setView("attendance")} /> : view === "plan" ? <PlanView key={editingPlanId || `new-${activeClass?.id || "none"}`} classes={classes} activeClassId={activeClass?.id || ""} initialPlan={savedPlans.find((item) => item.id === editingPlanId)} onSave={savePlan} onBack={() => setView("classes")} onSetUpClass={() => setView("classes")} /> : view === "library" ? <LibraryView classes={classes} activeClassId={activeClass?.id || ""} savedResourceIds={savedResourceIds} onToggleSaved={toggleSavedResource} onSetUpClass={() => setView("classes")} /> : view === "attendance" ? <AttendanceView classes={classes} activeClassId={activeClass?.id || ""} attendanceRecords={attendanceRecords} attendanceNotes={attendanceNotes} onSave={saveAttendance} onSetUpClass={() => setView("classes")} /> : <CommunityView />}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button className={view === "home" ? "active" : ""} type="button" onClick={() => setView("home")}><span>⌂</span>Today</button><button className={view === "classes" ? "active" : ""} type="button" onClick={() => setView("classes")}><span>▦</span>Classes</button><button className={view === "plan" ? "active" : ""} type="button" onClick={() => beginPlan()}><span>＋</span>Plan</button><button className={view === "library" ? "active" : ""} type="button" onClick={() => setView("library")}><span>▱</span>Resources</button><button className={view === "community" ? "active" : ""} type="button" onClick={() => setView("community")}><span>♧</span>Ask</button>
        </nav>
      </section>
    </main>
  );
}

function LoginScreen({ name, email, onNameChange, onEmailChange, onContinue }: { name: string; email: string; onNameChange: (name: string) => void; onEmailChange: (email: string) => void; onContinue: () => void }) {
  const [password, setPassword] = useState("kalinga-demo");
  const [showPassword, setShowPassword] = useState(false);

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onContinue();
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <StackedKalingaLogo />
        <div className="login-copy">
          <p className="eyebrow">TEACHERS’ ASSISTANT</p>
          <h1 id="login-title">Welcome back, Teacher</h1>
          <p>Sign in to access your lessons, saved resources, and classroom records.</p>
        </div>

        <form className="login-form" onSubmit={submitLogin}>
          <label>Teacher name<input type="text" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Your name" required /></label>
          <label>Email address<input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="teacher@school.edu.ph" required /></label>
          <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button></span></label>
          <div className="login-options"><label><input type="checkbox" defaultChecked /> Keep me signed in</label><button type="button">Forgot password?</button></div>
          <button className="login-primary" type="submit">Sign in to Kalinga</button>
        </form>

        <div className="login-divider"><span>or</span></div>
        <button className="prototype-button" type="button" onClick={onContinue}>Continue to prototype <span>→</span></button>
        <p className="demo-note"><span>i</span><b>Demo access</b> No authorization is connected yet. Either option safely opens the sample app.</p>
        <p className="login-language">English <i /> Filipino</p>
      </section>
      <KalingaFooterArtwork />
    </main>
  );
}

function StackedKalingaLogo() {
  return (
    <div className="stacked-logo" aria-label="Kalinga">
      <Image src="/kalinga-logo.png" width={2172} height={724} alt="" priority />
    </div>
  );
}

function KalingaFooterArtwork() {
  return (
    <svg className="login-artwork" viewBox="0 0 1440 215" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <pattern id="woven-band" width="180" height="96" patternUnits="userSpaceOnUse">
          <rect width="180" height="96" fill="#050505" />
          <path d="M-28 83 45 10l73 73M62 83l73-73 73 73" fill="none" stroke="#f7efe2" strokeWidth="22" />
        </pattern>
        <g id="kalinga-bloom">
          <circle cx="0" cy="0" r="6" fill="#ec5822" />
          <circle cx="-13" cy="3" r="4" fill="#ec5822" />
          <circle cx="13" cy="3" r="4" fill="#ec5822" />
          <path d="M-17 17Q0 1 17 17M-16 17l16 14 16-14M-16 17 0 8l16 9M0 31v25" fill="none" stroke="#050505" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g id="person">
          <circle cx="0" cy="0" r="13" fill="#ec5822" />
          <path d="M0 16v40M0 29l-24 18M0 29l24 18M0 56l-20 28M0 56l20 28" fill="none" stroke="#ec5822" strokeWidth="8" strokeLinecap="round" />
        </g>
      </defs>
      <rect x="0" y="119" width="1440" height="96" fill="url(#woven-band)" />
      <path d="M0 125Q75 73 150 125T300 125T450 125T600 125T750 125T900 125T1050 125T1200 125T1350 125T1500 125" fill="none" stroke="#050505" strokeWidth="17" />
      <use href="#kalinga-bloom" x="45" y="67" />
      <use href="#kalinga-bloom" x="138" y="62" />
      <use href="#kalinga-bloom" x="231" y="66" />
      <use href="#kalinga-bloom" x="324" y="60" />
      <use href="#kalinga-bloom" x="417" y="66" />
      <use href="#kalinga-bloom" x="510" y="61" />
      <use href="#kalinga-bloom" x="603" y="67" />
      <use href="#kalinga-bloom" x="696" y="62" />
      <use href="#kalinga-bloom" x="789" y="66" />
      <use href="#kalinga-bloom" x="882" y="60" />
      <use href="#kalinga-bloom" x="975" y="66" />
      <use href="#person" x="1185" y="27" />
      <use href="#person" x="1270" y="27" />
    </svg>
  );
}

function AccountMenu({ name, email, onSignOut }: { name: string; email: string; onSignOut: () => void }) {
  return (
    <div className="account-menu" role="menu" aria-label="Account options">
      <div className="account-menu-heading"><span className="avatar">{teacherInitials(name)}</span><span><strong>{teacherLabel(name)}</strong><small>{email}</small></span></div>
      <div className="account-menu-options">
        <button type="button" role="menuitem" disabled><span>◎</span> Account settings<small>Coming soon</small></button>
        <button type="button" role="menuitem" disabled><span>↓</span> Offline downloads<small>Coming soon</small></button>
        <button type="button" role="menuitem" disabled><span>?</span> Help &amp; support<small>Coming soon</small></button>
      </div>
      <button className="signout-button" type="button" role="menuitem" onClick={onSignOut}><span>↪</span> Sign out</button>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{description}</p></div>
      {action}
    </header>
  );
}

function ClassZeroState({ onSetUp, onLoadSample }: { onSetUp: () => void; onLoadSample: () => void }) {
  return (
    <section className="class-zero-state">
      <span className="zero-icon">▦</span>
      <p className="eyebrow">START WITH YOUR REAL CLASSROOM</p>
      <h1>No classes set up yet</h1>
      <p>Add each class once. Kalinga will reuse its grade levels, schedule, subjects, and learner count everywhere—so you do not have to enter the same details again.</p>
      <div><button className="primary-button" type="button" onClick={onSetUp}>＋ Set up my first class</button><button className="secondary-button" type="button" onClick={onLoadSample}>Preview with sample data</button></div>
      <small>Your classes are saved on this device for the prototype.</small>
    </section>
  );
}

function AllClassesSchedule({ classes, onOpenClass, onEditClass, placement = "classes" }: { classes: TeachingClass[]; onOpenClass: (classId: string) => void; onEditClass?: (item: TeachingClass) => void; placement?: "home" | "classes" }) {
  const [selectedDay, setSelectedDay] = useState("Today");
  const today = weekDays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const filterDay = selectedDay === "Today" ? today : selectedDay;
  const scheduleItems = classes.flatMap((item) => item.meetings.flatMap((meeting) => daysForPattern(meeting.days).map((day) => ({ key: `${item.id}-${meeting.id}-${day}`, classId: item.id, className: item.name, grades: item.grades, day, meeting, teachingClass: item }))));
  const dayCounts = Object.fromEntries(weekDays.map((day) => [day, scheduleItems.filter((item) => item.day === day).length]));
  const visibleItems = scheduleItems
    .filter((item) => filterDay === "All days" || item.day === filterDay)
    .sort((a, b) => (weekDays.indexOf(a.day) - weekDays.indexOf(b.day)) || (toMinutes(a.meeting.startTime) - toMinutes(b.meeting.startTime)));

  function hasConflict(item: (typeof scheduleItems)[number]) {
    const start = toMinutes(item.meeting.startTime);
    const end = start + item.meeting.durationMinutes;
    return scheduleItems.some((other) => other.key !== item.key && other.day === item.day && start < toMinutes(other.meeting.startTime) + other.meeting.durationMinutes && end > toMinutes(other.meeting.startTime));
  }

  const dayOptions = ["Today", ...weekDays, "All days"];

  return <section className={`all-schedule-card ${placement === "home" ? "home-schedule-card" : ""}`}><header><div><p className="eyebrow">TEACHING SCHEDULE</p><h2>{filterDay === "All days" ? "Your week at a glance" : filterDay === today ? "Today’s classes" : `${filterDay}’s classes`}</h2><p>Choose a day for its class list, or open the whole week. Possible overlaps are flagged automatically.</p></div><span>{visibleItems.length} {filterDay === "All days" ? "weekly" : "scheduled"} class {visibleItems.length === 1 ? "block" : "blocks"}</span></header><div className="schedule-day-tabs" aria-label="Choose a schedule day">{dayOptions.map((day) => { const representedDay = day === "Today" ? today : day; const count = day === "All days" ? scheduleItems.length : dayCounts[representedDay] || 0; return <button className={selectedDay === day ? "active" : ""} type="button" onClick={() => setSelectedDay(day)} key={day}><span>{day === "Today" ? "Today" : day === "All days" ? "Week" : day.slice(0, 3)}</span><small>{day === "Today" ? representedDay.slice(0, 3) : `${count} ${count === 1 ? "class" : "classes"}`}</small></button>; })}</div>{visibleItems.length ? <div className="all-schedule-list">{visibleItems.map((item) => { const conflict = hasConflict(item); return <article className={conflict ? "has-conflict" : ""} key={item.key}><time><b>{item.meeting.startTime}</b><span>{formatTime(toMinutes(item.meeting.startTime) + item.meeting.durationMinutes)}</span></time><div><span>{filterDay === "All days" ? item.day : item.meeting.label}</span><h3>{item.className}</h3><p>{filterDay === "All days" ? `${item.meeting.label} · ${gradeList(item.grades)}` : gradeList(item.grades)} · {item.meeting.durationMinutes} minutes</p></div>{conflict && <strong>⚠ Possible overlap</strong>}<div className="schedule-row-actions"><button className="schedule-open-button" type="button" onClick={() => onOpenClass(item.classId)}>Open class</button>{onEditClass && <button className="schedule-edit-button" type="button" onClick={() => onEditClass(item.teachingClass)}>Edit times</button>}</div></article>; })}</div> : <div className="all-schedule-empty"><span>○</span><p><b>No classes scheduled for {filterDay}</b><small>Use Classes &amp; learners to add or change a class meeting time.</small></p></div>}</section>;
}

function ClassesView({ classes, activeClassId, savedPlans, attendanceRecords, onSelectClass, onSave, onDelete, onLoadSample, onPlan, onAttendance }: { classes: TeachingClass[]; activeClassId: string; savedPlans: SavedPlan[]; attendanceRecords: Record<string, Record<string, string>>; onSelectClass: (classId: string) => void; onSave: (item: Omit<TeachingClass, "id">, classId?: string) => void; onDelete: (classId: string) => void; onLoadSample: () => void; onPlan: (planId?: string) => void; onAttendance: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteCandidateId, setDeleteCandidateId] = useState("");
  const [name, setName] = useState("");
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [meetings, setMeetings] = useState<ClassMeeting[]>([{ id: "meeting-draft-1", days: "Monday to Friday", startTime: "8:00 AM", durationMinutes: 60, label: "" }]);
  const [learners, setLearners] = useState<ClassLearner[]>([]);
  const [classStep, setClassStep] = useState<1 | 2 | 3>(1);
  const selectedClass = classes.find((item) => item.id === activeClassId) || classes[0];
  const selectedPlans = savedPlans.filter((plan) => plan.classId === selectedClass?.id);
  const currentPlan = selectedPlans[0];
  const selectedRosterCounts = selectedClass ? learnerSexCounts(selectedClass.learners) : { female: 0, male: 0, unspecified: 0 };
  const attendanceCount = selectedClass ? Object.entries(attendanceRecords).filter(([key]) => key.startsWith(`${selectedClass.id}-`)).flatMap(([, records]) => Object.values(records)).length : 0;
  const detailsComplete = Boolean(name.trim() && grades.length && subjects.length);
  const namedLearnerCount = learners.filter((learner) => learner.name.trim()).length;

  function resetForm() {
    setEditingId("");
    setName("");
    setGrades([]);
    setSubjects([]);
    setCustomSubject("");
    setMeetings([{ id: `meeting-${Date.now()}-1`, days: "Monday to Friday", startTime: "8:00 AM", durationMinutes: 60, label: "" }]);
    setLearners([]);
    setClassStep(1);
  }

  function openNewClassForm() {
    resetForm();
    setFormOpen(true);
    window.requestAnimationFrame(() => document.querySelector(".class-setup-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function editClass(item: TeachingClass, section: "details" | "schedule" | "learners" = "details") {
    setEditingId(item.id);
    setDeleteCandidateId("");
    setName(item.name);
    setGrades(item.grades);
    setSubjects(item.subjects);
    setMeetings(item.meetings.map((meeting) => ({ ...meeting })));
    setLearners(item.learners.map((learner) => ({ ...learner })));
    setClassStep(section === "schedule" ? 2 : section === "learners" ? 3 : 1);
    setFormOpen(true);
    window.requestAnimationFrame(() => document.querySelector(".class-setup-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function goToClassStep(step: 1 | 2 | 3) {
    setClassStep(step);
    window.requestAnimationFrame(() => document.querySelector(".class-setup-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function updateGrades(next: GradeLevel[]) {
    setGrades(next);
    setLearners((items) => items.map((learner) => next.includes(learner.grade) ? learner : { ...learner, grade: next[0] || learner.grade }));
  }

  function toggleSubject(subject: string) {
    setSubjects((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]);
  }

  function addCustomSubject() {
    const next = customSubject.trim();
    if (!next) return;
    setSubjects((current) => current.some((item) => item.toLowerCase() === next.toLowerCase()) ? current : [...current, next]);
    setCustomSubject("");
  }

  function addLearner() {
    setLearners((current) => [...current, { id: `learner-${Date.now()}-${current.length}`, name: "", grade: grades[0] || "1", sex: "Not specified" }]);
  }

  function updateLearner(id: string, field: "name" | "grade" | "sex", value: string) {
    setLearners((current) => current.map((learner) => {
      if (learner.id !== id) return learner;
      if (field === "sex") return { ...learner, sex: normalizeLearnerSex(value) };
      return { ...learner, [field]: value };
    }));
  }

  function addMeeting() {
    setMeetings((current) => [...current, { id: `meeting-${Date.now()}-${current.length + 1}`, days: "Monday", startTime: current.at(-1)?.startTime || "8:00 AM", durationMinutes: 60, label: "" }]);
  }

  function updateMeeting(id: string, changes: Partial<ClassMeeting>) {
    setMeetings((current) => current.map((meeting) => meeting.id === id ? { ...meeting, ...changes } : meeting));
  }

  function submitClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (classStep !== 3 || !detailsComplete) return;
    const safeMeetings = meetings.length ? meetings.map((meeting) => ({ ...meeting, durationMinutes: Math.max(5, Number(meeting.durationMinutes) || 60), label: meeting.label.trim() || "Regular class" })) : [{ id: `meeting-${Date.now()}-1`, days: "Monday to Friday", startTime: "8:00 AM", durationMinutes: 60, label: "Regular class" }];
    const existingQuarter = classes.find((item) => item.id === editingId)?.quarter || "Quarter 1";
    onSave({ name: name.trim(), grades, subjects, quarter: existingQuarter, meetingDays: safeMeetings[0].days, startTime: safeMeetings[0].startTime, meetings: safeMeetings, learners: learners.filter((learner) => learner.name.trim()).map((learner) => ({ ...learner, name: learner.name.trim() })) }, editingId || undefined);
    resetForm();
    setFormOpen(false);
  }

  return (
    <div className="view-page classes-page">
      {!!classes.length && <PageIntro eyebrow="CLASSES & LEARNERS" title="Choose a class" description="Manage the learners, meeting times, attendance, and lesson plans belonging to each class." />}
      {!!classes.length && selectedClass && <section className="class-hub">
        <nav className="class-switcher" aria-label="Saved classes">
          <p className="eyebrow">YOUR CLASSES</p>
          {classes.map((item) => <button className={item.id === selectedClass.id ? "active" : ""} type="button" key={item.id} onClick={() => onSelectClass(item.id)}><span><b>{item.name}</b><small>{gradeList(item.grades)} · {item.learners.length} learners</small><small>{learnerRosterSummary(item.learners, true)}</small></span><span>→</span></button>)}
        </nav>
        <div className="class-workspace">
          <header className="class-workspace-head">
            <div><p className="eyebrow">{selectedClass.meetings.length} SAVED CLASS {selectedClass.meetings.length === 1 ? "BLOCK" : "BLOCKS"}</p><h2>{selectedClass.name}</h2><p>{gradeList(selectedClass.grades)} · {selectedClass.subjects.join(" · ")}</p><p className="class-roster-line"><b>{selectedClass.learners.length} learners</b><span>{learnerRosterSummary(selectedClass.learners)}</span></p></div>
            <div className="class-header-actions"><button className="primary-button" type="button" onClick={() => onPlan()}>＋ New lesson</button><details className="class-more-menu"><summary aria-label={`More options for ${selectedClass.name}`}>•••</summary><div role="menu"><button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); editClass(selectedClass, "details"); }}><span>✎</span><span><b>Edit class details</b><small>Change grades or subjects</small></span></button><button className="delete-menu-item" type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setDeleteCandidateId(selectedClass.id); }}><span>×</span><span><b>Delete class</b><small>Remove this class and its records</small></span></button></div></details></div>
          </header>
          {deleteCandidateId === selectedClass.id && <div className="delete-confirm prominent-delete" role="alert"><div><b>Delete {selectedClass.name} permanently?</b><span>This removes the class, its lesson plans, learner attendance, and saved timetable from this device.</span></div><div><button type="button" onClick={() => setDeleteCandidateId("")}>Keep class</button><button type="button" onClick={() => { onDelete(selectedClass.id); setDeleteCandidateId(""); }}>Yes, delete class</button></div></div>}
          <div className="class-action-strip">
            <button type="button" onClick={onAttendance}><span>✓</span><p><b>Take attendance</b><small>{attendanceCount ? `${attendanceCount} records saved` : `${selectedClass.learners.length} learners ready`}</small></p><b>→</b></button>
            <button type="button" onClick={() => editClass(selectedClass, "schedule")}><span>▦</span><p><b>Class meeting times</b><small>{selectedClass.meetings.map((meeting) => `${meeting.days} ${meeting.startTime}`).join(" · ")}</small></p><b>→</b></button>
            <button type="button" onClick={() => editClass(selectedClass, "learners")}><span>◎</span><p><b>Manage learners</b><small>Add, remove, or change learner grade levels</small></p><b>→</b></button>
          </div>
          <div className="class-detail-grid">
            <article className="class-schedule-panel">
              <div className="section-title inline"><div><p className="eyebrow">CLASS SCHEDULE</p><h3>{currentPlan?.title || "No lesson scheduled yet"}</h3></div>{currentPlan && <button className="text-button" type="button" onClick={() => onPlan(currentPlan.id)}>Edit schedule →</button>}</div>
              {currentPlan ? <div className="timeline compact-timeline">{currentPlan.slots.map((slot, index) => <div className="timeline-row" key={slot.id}><time>{slot.time}</time><div className={`timeline-event ${index ? `grade${index}` : "shared"}`}><strong>{slot.teacherFocus}</strong><small>{Object.values(slot.gradeTasks).filter(Boolean).join(" · ") || "Activities not added yet"}</small></div></div>)}</div> : <div className="class-panel-empty"><span>○</span><p><b>Nothing to follow yet</b><small>Create a lesson and its editable timetable will appear here.</small></p><button className="secondary-button" type="button" onClick={() => onPlan()}>Create lesson</button></div>}
            </article>
            <aside className="class-plans-panel">
              <div className="section-title inline"><div><p className="eyebrow">LESSON PLANS</p><h3>{selectedPlans.length} saved</h3></div></div>
              {selectedPlans.length ? <div className="class-plan-links">{selectedPlans.map((plan) => <button type="button" key={plan.id} onClick={() => onPlan(plan.id)}><span><b>{plan.title}</b><small>{plan.subject} · {plan.quarter}</small></span><span>→</span></button>)}</div> : <p className="class-plan-empty">Saved plans for this class will stay together here.</p>}
              <div className="class-roster-summary"><span>{selectedClass.learners.length}</span><p><b>Named learners</b><small>{selectedRosterCounts.female} female · {selectedRosterCounts.male} male{selectedRosterCounts.unspecified ? ` · ${selectedRosterCounts.unspecified} not specified` : ""}</small></p><button type="button" onClick={onAttendance}>Open attendance →</button></div>
            </aside>
          </div>
        </div>
      </section>}
      {!!classes.length && !formOpen && <section className="add-class-bottom"><div><p className="eyebrow">NEW SCHOOL TERM OR TEACHING LOAD?</p><h2>Need another class?</h2><p>Add another class only when you begin managing a new group of learners.</p></div><button className="secondary-button" type="button" onClick={openNewClassForm}>＋ Add another class</button></section>}
      {(formOpen || !classes.length) && <form className={`class-setup-card class-form-drawer ${!classes.length ? "first-class-form" : ""}`} onSubmit={submitClass}>
        <nav className="class-wizard-progress" aria-label="Class setup progress">
          {[{ number: 1, title: "Class details", detail: "Grades and subjects" }, { number: 2, title: "Schedule", detail: "Days and times" }, { number: 3, title: "Learners", detail: "Optional" }].map((step) => <div className={`${classStep === step.number ? "current" : ""} ${classStep > step.number ? "complete" : ""}`} aria-current={classStep === step.number ? "step" : undefined} key={step.number}><span>{classStep > step.number ? "✓" : step.number}</span><p><b>{step.title}</b><small>{step.detail}</small></p></div>)}
        </nav>
        <div className="class-setup-heading">
          <span>{classStep}</span>
          <div>
            <p className="eyebrow">STEP {classStep} OF 3{editingId ? " · EDITING SAVED CLASS" : ""}</p>
            <h2>{classStep === 1 ? editingId ? `Edit ${name}` : classes.length ? "Add a class" : "Set up your first class" : classStep === 2 ? "Set the class schedule" : "Add learners (optional)"}</h2>
            <p>{classStep === 1 ? "Add the essentials once. Kalinga reuses them across planning and attendance." : classStep === 2 ? "Confirm when this class meets. Keep the ready-made schedule if it already fits." : "Add learner names for attendance now, or skip this and return later."}</p>
          </div>
          {!!classes.length && <button className="text-button cancel-edit" type="button" onClick={() => { resetForm(); setFormOpen(false); }}>{editingId ? "Cancel editing" : "Close"}</button>}
        </div>

        {classStep === 1 && <section className="class-wizard-step" aria-label="Class details">
          <div className="form-grid class-form-grid single-field">
            <label>Class or section name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Morning Multigrade Class" required /></label>
          </div>
          <div className="field-group"><p className="group-label">Which grade levels or learner groups are together?<small>Choose Kindergarten through Grade 12, or add the exact level your school uses.</small></p><GradeLevelPicker value={grades} onChange={updateGrades} /></div>
          <div className="field-group subject-setup"><p className="group-label">What subjects do you teach this class?<small>Choose one or more. You can change these later.</small></p><details className="multi-select-picker"><summary><span>{subjects.length ? subjects.join(", ") : "Choose subjects"}</span><small>{subjects.length ? `${subjects.length} selected` : "Select one or more"}</small></summary><div className="multi-select-panel"><div className="subject-options">{commonSubjects.map((subject) => <button className={subjects.includes(subject) ? "selected" : ""} type="button" onClick={() => toggleSubject(subject)} key={subject}>{subjects.includes(subject) ? "✓ " : "+ "}{subject}</button>)}</div><div className="custom-subject"><input value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomSubject(); } }} placeholder="Another subject (e.g. Mother Tongue)" /><button className="secondary-button" type="button" onClick={addCustomSubject}>Add subject</button></div></div></details>{!!subjects.length && <div className="selected-subjects">{subjects.map((subject) => <button type="button" onClick={() => toggleSubject(subject)} key={subject}>{subject} ×</button>)}</div>}</div>
        </section>}

        {classStep === 2 && <section className="class-wizard-step" aria-label="Class schedule">
          <div className="field-group class-meeting-builder"><div className="meeting-builder-heading"><div><p className="group-label">When does this class meet?<small>{meetings.length === 1 ? `${meetings[0].days} at ${meetings[0].startTime} for ${meetings[0].durationMinutes} minutes.` : `${meetings.length} class times ready.`}</small></p></div></div><div className="meeting-rows">{meetings.map((meeting, index) => <article className="meeting-row" key={meeting.id}><span>{index + 1}</span><label>Class time label <small>(optional)</small><input value={meeting.label} onChange={(event) => updateMeeting(meeting.id, { label: event.target.value })} placeholder="Leave blank for Regular class" /></label><div className="meeting-days-field"><b>Which days?</b><MeetingDayPicker value={meeting.days} onChange={(days) => updateMeeting(meeting.id, { days })} /></div><div className="meeting-time-field"><b>Starts at</b><TimePicker value={meeting.startTime} onChange={(value) => updateMeeting(meeting.id, { startTime: value })} /></div><label>How long?<div className="duration-input"><input aria-label={`Meeting ${index + 1} duration in minutes`} type="number" min="5" max="600" step="5" value={meeting.durationMinutes} onChange={(event) => updateMeeting(meeting.id, { durationMinutes: Number(event.target.value) })} /><span>minutes</span></div></label><button className="remove-meeting" type="button" disabled={meetings.length === 1} onClick={() => setMeetings((current) => current.filter((item) => item.id !== meeting.id))}>Remove</button></article>)}</div><button className="add-meeting-inline" type="button" onClick={addMeeting}>＋ Add another class time</button></div>
        </section>}

        {classStep === 3 && <section className="class-wizard-step" aria-label="Learners">
          <div className="field-group roster-builder"><div className="roster-heading"><div><p className="group-label">Who are the learners in this class?<small>Add names for attendance. Sex is optional and is used only for the class totals found in the ILAW material.</small></p></div><button className="secondary-button" type="button" onClick={addLearner} disabled={!grades.length}>＋ Add learner</button></div>{!learners.length ? <div className="roster-empty"><span>◎</span><p><b>You can skip learner names for now</b><small>Save the class now and add names from Manage learners whenever you are ready.</small></p></div> : <div className="roster-rows"><div className="roster-column-labels" aria-hidden="true"><span></span><b>Learner name</b><b>Grade</b><b>Sex (optional)</b><span></span></div>{learners.map((learner, index) => <div className="roster-row" key={learner.id}><span>{index + 1}</span><input aria-label={`Learner ${index + 1} name`} value={learner.name} onChange={(event) => updateLearner(learner.id, "name", event.target.value)} placeholder="Full name" /><select aria-label={`Learner ${index + 1} grade`} value={learner.grade} onChange={(event) => updateLearner(learner.id, "grade", event.target.value)}>{grades.map((grade) => <option value={grade} key={grade}>{gradeLabel(grade)}</option>)}</select><select aria-label={`Learner ${index + 1} sex`} value={learner.sex} onChange={(event) => updateLearner(learner.id, "sex", event.target.value)}><option>Not specified</option><option>Female</option><option>Male</option></select><button type="button" aria-label={`Remove learner ${index + 1}`} onClick={() => setLearners((current) => current.filter((item) => item.id !== learner.id))}>×</button></div>)}</div>}</div>
        </section>}

        <footer className="class-wizard-actions">
          <span>{classStep === 1 ? !name.trim() ? "Enter a class or section name to continue." : !grades.length ? "Choose at least one grade level." : !subjects.length ? "Choose or add at least one subject." : "Class details are ready." : classStep === 2 ? `${meetings.length} ${meetings.length === 1 ? "class time" : "class times"} ready. You can change these later.` : namedLearnerCount ? `${namedLearnerCount} named ${namedLearnerCount === 1 ? "learner" : "learners"} ready for attendance.` : "Learner names are optional—you can add them later."}</span>
          <div className="class-wizard-buttons">
            {classStep > 1 && <button className="secondary-button" type="button" onClick={() => goToClassStep((classStep - 1) as 1 | 2)}>← Back</button>}
            {classStep === 1 && <button className="primary-button" type="button" disabled={!detailsComplete} onClick={() => goToClassStep(2)}>Continue to schedule →</button>}
            {classStep === 2 && <button className="primary-button" type="button" onClick={() => goToClassStep(3)}>Continue to learners →</button>}
            {classStep === 3 && <button className="primary-button" type="submit">{editingId ? "Save class changes" : namedLearnerCount ? "Save class →" : "Save without learners →"}</button>}
          </div>
        </footer>
      </form>}
      {!classes.length && <button className="sample-data-button" type="button" onClick={onLoadSample}>Not ready to enter data? Load one sample class</button>}
    </div>
  );
}

function parseTime(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: 8, minute: 0, period: "AM" as "AM" | "PM" };
  return { hour: Math.min(12, Math.max(1, Number(match[1]))), minute: Math.min(59, Math.max(0, Number(match[2]))), period: match[3].toUpperCase() as "AM" | "PM" };
}

function toMinutes(time: string) {
  const { hour, minute, period } = parseTime(time);
  return (hour % 12) * 60 + minute + (period === "PM" ? 720 : 0);
}

function formatTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const period = normalized >= 720 ? "PM" : "AM";
  const hour = Math.floor(normalized / 60) % 12 || 12;
  return `${hour}:${String(normalized % 60).padStart(2, "0")} ${period}`;
}

function durationMinutes(duration: string | number) {
  const parsed = typeof duration === "number" ? duration : Number.parseInt(duration, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

function MeetingDayPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedDays = daysForPattern(value).filter((day) => weekDays.includes(day));
  function toggleDay(day: string) {
    const nextDays = selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : weekDays.filter((item) => selectedDays.includes(item) || item === day);
    if (nextDays.length) onChange(formatMeetingDays(nextDays));
  }
  return <details className="meeting-day-picker"><summary>{selectedDays.map((day) => day.slice(0, 3)).join(", ") || "Choose days"}</summary><div role="group" aria-label="Choose class days">{weekDays.map((day) => <button className={selectedDays.includes(day) ? "selected" : ""} type="button" aria-pressed={selectedDays.includes(day)} onClick={() => toggleDay(day)} key={day}><span>{selectedDays.includes(day) ? "✓" : ""}</span>{day}</button>)}</div></details>;
}

function TimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parts = parseTime(value);
  function update(next: Partial<typeof parts>) {
    const merged = { ...parts, ...next };
    onChange(`${merged.hour}:${String(merged.minute).padStart(2, "0")} ${merged.period}`);
  }
  return <div className="time-picker" aria-label="Choose time"><select aria-label="Hour" value={parts.hour} onChange={(event) => update({ hour: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option value={hour} key={hour}>{hour}</option>)}</select><span>:</span><select aria-label="Minute" value={parts.minute} onChange={(event) => update({ minute: Number(event.target.value) })}>{Array.from({ length: 60 }, (_, minute) => minute).map((minute) => <option value={minute} key={minute}>{String(minute).padStart(2, "0")}</option>)}</select><div className="period-toggle"><button className={parts.period === "AM" ? "active" : ""} type="button" onClick={() => update({ period: "AM" })}>AM</button><button className={parts.period === "PM" ? "active" : ""} type="button" onClick={() => update({ period: "PM" })}>PM</button></div></div>;
}

function createSchedule(grades: GradeLevel[], startTime = "8:00 AM", duration: string | number = "80 minutes"): PlanSlot[] {
  const sharedTasks = Object.fromEntries(grades.map((grade) => [grade, "Shared introduction"]));
  const start = toMinutes(startTime);
  const total = durationMinutes(duration);
  const sharedMinutes = Math.min(15, Math.max(10, Math.round(total * .2)));
  const guidedMinutes = grades.length ? (total - sharedMinutes) / grades.length : total - sharedMinutes;
  const guidedSlots = grades.map((focusGrade, index) => ({
    id: `slot-${focusGrade}-${index}`,
    time: formatTime(start + sharedMinutes + Math.round(index * guidedMinutes)),
    teacherFocus: `Guide ${gradeLabel(focusGrade)}`,
    gradeTasks: Object.fromEntries(grades.map((grade) => [grade, grade === focusGrade ? "Guided lesson" : "Independent task"])),
  }));
  return [{ id: "slot-shared", time: startTime, teacherFocus: "All grades together", gradeTasks: sharedTasks }, ...guidedSlots];
}

function PlanView({ classes, activeClassId, initialPlan, onSave, onBack, onSetUpClass }: { classes: TeachingClass[]; activeClassId: string; initialPlan?: SavedPlan; onSave: (plan: SavedPlan) => void; onBack: () => void; onSetUpClass: () => void }) {
  const generatedPlanId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(initialPlan ? 3 : 1);
  const [selectedClassId, setSelectedClassId] = useState(initialPlan?.classId || activeClassId || classes[0]?.id || "");
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const [grades, setGrades] = useState(initialPlan?.grades || selectedClass?.grades || []);
  const [subject, setSubject] = useState(initialPlan?.subject || selectedClass?.subjects[0] || "");
  const [quarter, setQuarter] = useState(initialPlan?.quarter || "Quarter 1");
  const [duration, setDuration] = useState(String(durationMinutes(initialPlan?.duration || 80)));
  const [startTime, setStartTime] = useState(initialPlan?.startTime || selectedClass?.startTime || "8:00 AM");
  const [language, setLanguage] = useState(initialPlan?.language || "English & Filipino");
  const [lessonTitle, setLessonTitle] = useState(initialPlan?.title || "");
  const [competencies, setCompetencies] = useState<Record<GradeLevel, string>>(initialPlan?.competencies || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, ""])));
  const [sharedTheme, setSharedTheme] = useState(initialPlan?.sharedTheme || "");
  const [multigradeModel, setMultigradeModel] = useState(initialPlan?.multigradeModel || "Same Theme, Different Task (STDT)");
  const [objectives, setObjectives] = useState<Record<GradeLevel, string>>(initialPlan?.objectives || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, ""])));
  const [learnerContext, setLearnerContext] = useState(initialPlan?.learnerContext || "");
  const [materials, setMaterials] = useState(initialPlan?.materials || "");
  const [formativeAssessments, setFormativeAssessments] = useState<Record<GradeLevel, string>>(initialPlan?.formativeAssessments || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, ""])));
  const [exitTasks, setExitTasks] = useState<Record<GradeLevel, string>>(initialPlan?.exitTasks || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, ""])));
  const [successCriteria, setSuccessCriteria] = useState<Record<GradeLevel, string>>(initialPlan?.successCriteria || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, ""])));
  const [reflection, setReflection] = useState(initialPlan?.reflection || "");
  const [remediation, setRemediation] = useState(initialPlan?.remediation || "");
  const [enrichment, setEnrichment] = useState(initialPlan?.enrichment || "");
  const [nextSessionNotes, setNextSessionNotes] = useState(initialPlan?.nextSessionNotes || "");
  const [slots, setSlots] = useState<PlanSlot[]>(initialPlan?.slots || createSchedule(selectedClass?.grades || [], selectedClass?.startTime, initialPlan?.duration || "80 minutes"));
  const [saved, setSaved] = useState(false);
  const planRosterCounts = learnerSexCounts(selectedClass?.learners || []);

  function canOpenPlanStep(nextStep: 1 | 2 | 3) {
    if (nextStep === 1) return true;
    if (!selectedClassId || !grades.length) return false;
    if (nextStep === 2) return true;
    return Boolean(subject.trim());
  }

  function goToPlanStep(nextStep: 1 | 2 | 3) {
    if (!canOpenPlanStep(nextStep)) return;
    if (nextStep === 3 && !slots.length) setSlots(createSchedule(grades, startTime, duration));
    setStep(nextStep);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function updateGrades(next: GradeLevel[]) {
    setGrades(next);
    setCompetencies((items) => Object.fromEntries(next.map((item) => [item, items[item] || ""])));
    setObjectives((items) => Object.fromEntries(next.map((item) => [item, items[item] || ""])));
    setFormativeAssessments((items) => Object.fromEntries(next.map((item) => [item, items[item] || ""])));
    setExitTasks((items) => Object.fromEntries(next.map((item) => [item, items[item] || ""])));
    setSuccessCriteria((items) => Object.fromEntries(next.map((item) => [item, items[item] || ""])));
  }

  function chooseClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId);
    setSelectedClassId(classId);
    if (!nextClass) return;
    setGrades(nextClass.grades);
    setSubject(nextClass.subjects[0] || "");
    setStartTime(nextClass.startTime);
    setCompetencies(Object.fromEntries(nextClass.grades.map((grade) => [grade, ""])));
    setObjectives(Object.fromEntries(nextClass.grades.map((grade) => [grade, ""])));
    setFormativeAssessments(Object.fromEntries(nextClass.grades.map((grade) => [grade, ""])));
    setExitTasks(Object.fromEntries(nextClass.grades.map((grade) => [grade, ""])));
    setSuccessCriteria(Object.fromEntries(nextClass.grades.map((grade) => [grade, ""])));
    setSlots(createSchedule(nextClass.grades, nextClass.startTime, duration));
    setSaved(false);
  }

  function chooseSubject(nextSubject: string) {
    setSubject(nextSubject);
    setCompetencies(Object.fromEntries(grades.map((grade) => [grade, ""])));
    setSaved(false);
  }

  function updateSlot(slotId: string, field: "teacherFocus", value: string) {
    setSlots((current) => current.map((slot) => slot.id === slotId ? { ...slot, [field]: value } : slot));
    setSaved(false);
  }

  function updateSlotTime(slotId: string, value: string) {
    const slotIndex = slots.findIndex((slot) => slot.id === slotId);
    if (slotIndex < 0) return;
    let shift = toMinutes(value) - toMinutes(slots[slotIndex].time);
    if (shift > 720) shift -= 1440;
    if (shift < -720) shift += 1440;
    setSlots((current) => current.map((slot, index) => index < slotIndex ? slot : { ...slot, time: formatTime(toMinutes(slot.time) + shift) }));
    if (slotIndex === 0) setStartTime(value);
    setSaved(false);
  }

  function updateGradeTask(slotId: string, grade: GradeLevel, value: string) {
    setSlots((current) => current.map((slot) => slot.id === slotId ? { ...slot, gradeTasks: { ...slot.gradeTasks, [grade]: value } } : slot));
    setSaved(false);
  }

  function addSlot() {
    setSlots((current) => [...current, { id: `slot-${Date.now()}`, time: formatTime(toMinutes(current.at(-1)?.time || startTime) + 15), teacherFocus: "", gradeTasks: Object.fromEntries(grades.map((grade) => [grade, ""])) }]);
  }

  function saveCurrentPlan() {
    if (!selectedClass) return;
    const plan: SavedPlan = { id: initialPlan?.id || `plan-${generatedPlanId}`, classId: selectedClass.id, title: lessonTitle.trim() || "Untitled lesson", subject, quarter, grades, duration: `${durationMinutes(duration)} minutes`, startTime, language, competencies, sharedTheme, multigradeModel, objectives, learnerContext, materials, formativeAssessments, exitTasks, successCriteria, reflection, remediation, enrichment, nextSessionNotes, slots, savedAt: "just now" };
    onSave(plan);
    setSaved(true);
  }

  if (!classes.length) {
    return <section className="class-zero-state compact-zero"><span className="zero-icon">＋</span><p className="eyebrow">CREATE A LESSON</p><h1>Add a class first</h1><p>A lesson needs a saved class so its grades, attendance list, and schedule stay connected.</p><div><button className="primary-button" type="button" onClick={onSetUpClass}>Set up a class</button><button className="secondary-button" type="button" onClick={onBack}>Back home</button></div></section>;
  }

  return (
    <div className="view-page plan-page">
      <PageIntro
        eyebrow="CREATE · MULTIGRADE LESSON"
        title={step === 1 ? "Choose the class and lesson" : step === 2 ? "Set the lesson details" : "Complete your ILAW lesson"}
        description={step === 1 ? "Start with only the class and learner groups you are preparing for." : step === 2 ? "Add the subject, timing, and classroom conditions for this lesson." : "Open one ILAW section at a time, then save whenever the plan is ready."}
        action={<button className="secondary-button" type="button" onClick={onBack}>← Back home</button>}
      />

      <div className="stepper" aria-label={`Step ${step} of 3`}>
        {(["Class & lesson", "Lesson details", "ILAW plan"] as const).map((label, index) => { const targetStep = (index + 1) as 1 | 2 | 3; return <button type="button" key={label} disabled={!canOpenPlanStep(targetStep)} onClick={() => goToPlanStep(targetStep)} aria-current={step === targetStep ? "step" : undefined} className={step === targetStep ? "current" : step > targetStep ? "complete" : ""}><span>{step > targetStep ? "✓" : targetStep}</span><strong>{label}</strong></button>; })}
      </div>

      {step === 1 && (
        <section className="builder-card">
          <div className="builder-main">
            <div className="planner-portion-heading">
              <p className="eyebrow">PART 1 OF 3 · CLASS & LESSON</p>
              <h2>What are you preparing?</h2>
              <p>Choose a saved class, give the lesson an optional title, and confirm who will learn together.</p>
            </div>
            <div className="form-grid planner-class-row">
              <label>Plan for saved class<select value={selectedClassId} onChange={(event) => chooseClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label>Lesson title <small>Optional</small><input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder="You can name this later" /></label>
            </div>
            <div className="field-group">
              <p className="group-label">Which grade levels or learner groups are learning together?<small>Use the levels saved with this class, or add another group for this lesson.</small></p>
              <GradeLevelPicker value={grades} onChange={updateGrades} />
            </div>
          </div>
          <aside className="builder-help"><span>1</span><h3>Begin with what is already saved</h3><p>Kalinga carries your class, grades, and learner groups into planning so you do not have to type them again.</p><div><b>{selectedClass?.name || "No class"}</b><small>{grades.length} learner {grades.length === 1 ? "group" : "groups"} selected</small></div></aside>
          <footer className="builder-footer"><span>Only this portion is shown. You can come back before building the plan.</span><button className="primary-button" type="button" disabled={!selectedClassId || !grades.length} onClick={() => goToPlanStep(2)}>Continue to lesson details →</button></footer>
        </section>
      )}

      {step === 2 && (
        <section className="builder-card">
          <div className="builder-main">
            <div className="planner-portion-heading">
              <p className="eyebrow">PART 2 OF 3 · LESSON DETAILS</p>
              <h2>How will this lesson run?</h2>
              <p>Enter the exact subject and teaching window. These details shape the editable schedule later.</p>
            </div>
            <div className="form-grid planner-details-grid">
              <label>Lesson subject<input list="class-subject-options" value={subject} onChange={(event) => chooseSubject(event.target.value)} placeholder="Choose or type any subject" /><datalist id="class-subject-options">{selectedClass?.subjects.map((item) => <option value={item} key={item} />)}</datalist><small>Use any subject name. Competencies remain blank until you enter them.</small></label>
              <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English & Filipino</option><option>English</option><option>Filipino</option><option>Mother Tongue</option><option>Other / Mixed</option></select></label>
              <label>Quarter<select value={quarter} onChange={(event) => setQuarter(event.target.value)}><option>Quarter 1</option><option>Quarter 2</option><option>Quarter 3</option><option>Quarter 4</option></select></label>
              <label className="duration-field">Total class time<div className="duration-input"><input aria-label="Total class time in minutes" type="number" min="5" max="600" step="5" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} /><span>minutes</span></div><small>This is the full time shared by all groups—not time per grade.</small></label>
            </div>
            <div className="lesson-timing-box"><div><p className="timing-label">When does this lesson start?</p><h3>{startTime} · {durationMinutes(duration)} minutes</h3><p>Kalinga will divide this window into an all-class opening and one teacher-focus block per group. You can change every block afterward.</p></div><TimePicker value={startTime} onChange={setStartTime} /></div>
            <div className="field-group">
              <p className="group-label">What should Kalinga consider?</p>
              <div className="context-pills"><button className="selected" type="button">Multigrade</button><button className="selected" type="button">Low connectivity</button><button type="button">No printing</button><button type="button">Indigenous context</button><button type="button">Limited materials</button></div>
            </div>
          </div>
          <aside className="builder-help"><span>2</span><h3>One teaching window</h3><p>This is not a separate duration for every grade. Kalinga will organize one class period around your different learner groups.</p><div><b>{startTime}</b><small>starts · {durationMinutes(duration)} minutes total</small></div><div><b>{subject || "No subject yet"}</b><small>{quarter} · {language}</small></div></aside>
          <footer className="builder-footer"><button className="secondary-button" type="button" onClick={() => goToPlanStep(1)}>← Class & lesson</button><button className="primary-button" type="button" disabled={!subject.trim()} onClick={() => { setSlots(createSchedule(grades, startTime, duration)); goToPlanStep(3); }}>Continue to ILAW plan →</button></footer>
        </section>
      )}

      {step === 3 && (
        <section className="plan-result">
          <div className="result-toolbar"><div><span className="pill orange">{saved ? "SAVED · EDITABLE" : "DRAFT · EDITABLE"}</span><b>{selectedClass?.name} · {subject} · {gradeList(grades)}</b></div><div><button className="secondary-button" type="button" onClick={() => goToPlanStep(2)}>← Lesson details</button><button className="primary-button" type="button" onClick={saveCurrentPlan}>{saved ? "✓ Saved to class" : "Save lesson"}</button></div></div>
          <div className="plan-title"><div><p className="eyebrow">{quarter} · MULTIGRADE LESSON PLAN</p><input className="plan-title-input" aria-label="Lesson title" value={lessonTitle} placeholder="Untitled lesson" onChange={(event) => { setLessonTitle(event.target.value); setSaved(false); }} /><p>{startTime}–{formatTime(toMinutes(startTime) + durationMinutes(duration))} · {durationMinutes(duration)} minutes total · {language}</p></div><button className="icon-button" type="button" aria-label="More lesson actions">···</button></div>
          <div className="ilaw-plan-summary"><div><span>Class</span><b>{selectedClass?.name}</b></div><div><span>Grade levels</span><b>{gradeList(grades)}</b></div><div><span>Enrolled learners</span><b>{selectedClass?.learners.length || 0} total · {planRosterCounts.female}F · {planRosterCounts.male}M{planRosterCounts.unspecified ? ` · ${planRosterCounts.unspecified} not set` : ""}</b></div><div><span>Multigrade model</span><b>{multigradeModel}</b></div>{sharedTheme && <div className="wide"><span>Shared theme</span><b>{sharedTheme}</b></div>}</div>

          <details className="ilaw-disclosure intentions-section">
            <summary><span className="ilaw-letter">I</span><span><small>INTENTIONS</small><b>Set what each group should learn</b><em>{grades.length} grade {grades.length === 1 ? "group" : "groups"} · open one at a time</em></span></summary>
            <div className="ilaw-disclosure-body intentions-body">
              <p className="competency-guidance">Nothing is generated without a verified source. Enter only what you know, or leave a field blank and return later.</p>
              <details className="ilaw-optional-disclosure"><summary><span>Shared theme and multigrade approach</span><small>Optional lesson setup</small></summary><div className="ilaw-intention-grid"><label>Shared theme or sub-theme <small>Optional</small><input value={sharedTheme} onChange={(event) => { setSharedTheme(event.target.value); setSaved(false); }} placeholder="What connects the grade-level lessons?" /></label><label>Multigrade approach<select value={multigradeModel} onChange={(event) => { setMultigradeModel(event.target.value); setSaved(false); }}><option>Same Theme, Different Task (STDT)</option><option>Teacher-led rotation</option><option>Peer or buddy learning</option><option>Cross-grade collaboration</option><option>Custom approach</option></select></label></div></details>
              <div className="intention-grade-list">{grades.map((grade) => <details className={`competency-card competency-disclosure grade-${grade}`} key={grade}><summary><span><b>{gradeLabel(grade)}</b><small>{subject || "Subject not entered"} · {quarter}</small></span><span>{competencies[grade] || objectives[grade] ? "Started" : "Not started"}</span></summary><div className="competency-fields"><label>Learning competency<textarea value={competencies[grade] || ""} onChange={(event) => { setCompetencies((current) => ({ ...current, [grade]: event.target.value })); setSaved(false); }} placeholder={`Enter the exact ${gradeLabel(grade)} competency`} /></label><label>Learning objective <small>Optional</small><textarea value={objectives[grade] || ""} onChange={(event) => { setObjectives((current) => ({ ...current, [grade]: event.target.value })); setSaved(false); }} placeholder={`What should ${gradeLabel(grade)} learners be able to do?`} /></label><p className="competency-helper">Saved offline and editable at any time.</p></div></details>)}</div>
            </div>
          </details>

          <details className="ilaw-disclosure learning-experience-disclosure">
            <summary><span className="ilaw-letter">L</span><span><small>LEARNING EXPERIENCE</small><b>Build the teaching flow</b><em>{slots.length} editable blocks · {durationMinutes(duration)} minutes</em></span></summary>
            <div className="ilaw-disclosure-body">
              <details className="ilaw-optional-disclosure"><summary><span>Learner context and materials</span><small>Optional details</small></summary><div className="ilaw-two-column"><label>Learner context<textarea value={learnerContext} onChange={(event) => { setLearnerContext(event.target.value); setSaved(false); }} placeholder="What do these learners already know, experience, or need?" /></label><label>Materials and references<textarea value={materials} onChange={(event) => { setMaterials(event.target.value); setSaved(false); }} placeholder="Local objects, activity sheets, curriculum references…" /></label></div></details>
              <div className="schedule-window-summary"><span>◎</span><p><b>Your teaching window</b><small>The blocks begin at {startTime}. Change a time only when the suggested flow does not fit your class.</small></p></div>
              <details className="schedule-editor-disclosure"><summary><span>Review or adjust the timetable</span><small>{slots.map((slot) => slot.time).join(" · ")}</small></summary><div className="rotation-table"><div className="rotation-head" style={{ "--grade-count": grades.length } as React.CSSProperties}><span>Start time</span><span>Teacher focus</span>{grades.map((grade) => <span key={grade}>{gradeLabel(grade)}</span>)}</div>{slots.map((slot) => <div className="rotation-row editable-row" style={{ "--grade-count": grades.length } as React.CSSProperties} key={slot.id}><div className="slot-time-editor"><TimePicker value={slot.time} onChange={(value) => updateSlotTime(slot.id, value)} /></div><input aria-label={`Teacher focus at ${slot.time}`} value={slot.teacherFocus} placeholder="Who has teacher support?" onChange={(event) => updateSlot(slot.id, "teacherFocus", event.target.value)} />{grades.map((grade) => <textarea aria-label={`${gradeLabel(grade)} activity at ${slot.time}`} value={slot.gradeTasks[grade] || ""} placeholder={`${gradeLabel(grade)} activity`} onChange={(event) => updateGradeTask(slot.id, grade, event.target.value)} key={grade} />)}</div>)}</div><div className="schedule-actions"><button className="secondary-button" type="button" onClick={addSlot}>＋ Add schedule block</button><span>Changing one time shifts every later block. Activities remain independently editable.</span></div></details>
            </div>
          </details>

          <details className="ilaw-disclosure assessment-section">
            <summary><span className="ilaw-letter">A</span><span><small>ASSESSMENT</small><b>Check learning by grade</b><em>Open when you are ready to add checks</em></span></summary>
            <div className="ilaw-disclosure-body"><div className="ilaw-grade-grid">{grades.map((grade) => <article key={grade}><h3>{gradeLabel(grade)}</h3><label>How will you check learning?<textarea value={formativeAssessments[grade] || ""} onChange={(event) => { setFormativeAssessments((current) => ({ ...current, [grade]: event.target.value })); setSaved(false); }} placeholder="A question, performance, observation, or short activity" /></label><details className="assessment-more"><summary>Add exit task or success criteria <span>Optional</span></summary><label>Exit task<textarea value={exitTasks[grade] || ""} onChange={(event) => { setExitTasks((current) => ({ ...current, [grade]: event.target.value })); setSaved(false); }} placeholder="What will the learner do before the lesson ends?" /></label><label>Success criteria<textarea value={successCriteria[grade] || ""} onChange={(event) => { setSuccessCriteria((current) => ({ ...current, [grade]: event.target.value })); setSaved(false); }} placeholder="What counts as successful learning?" /></label></details></article>)}</div></div>
          </details>

          <details className="ilaw-disclosure ways-forward-section">
            <summary><span className="ilaw-letter">W</span><span><small>WAYS FORWARD</small><b>Complete after the lesson</b><em>Reflection, remediation, enrichment, and next steps</em></span></summary>
            <div className="ilaw-disclosure-body"><p className="after-lesson-note">This section is intentionally optional during planning. Return after teaching while the lesson is still fresh.</p><div className="ilaw-two-column"><label>Reflection<textarea value={reflection} onChange={(event) => { setReflection(event.target.value); setSaved(false); }} placeholder="What worked, and who still needs support?" /></label><label>Remediation<textarea value={remediation} onChange={(event) => { setRemediation(event.target.value); setSaved(false); }} placeholder="What support will learners receive?" /></label><label>Enrichment<textarea value={enrichment} onChange={(event) => { setEnrichment(event.target.value); setSaved(false); }} placeholder="What extension can ready learners do?" /></label><label>Notes for the next session<textarea value={nextSessionNotes} onChange={(event) => { setNextSessionNotes(event.target.value); setSaved(false); }} placeholder="What should continue or change next time?" /></label></div></div>
          </details>
          <div className="plan-notes"><article><span>✦</span><div><b>You control the timetable</b><p>The generated blocks are only a starting point based on the lesson window you entered.</p></div></article><button className="text-button" type="button" onClick={() => setSlots(createSchedule(grades, startTime, duration))}>Reset from {startTime}</button></div>
        </section>
      )}
    </div>
  );
}

const resources = [
  { id: 1, icon: "½", title: "Fractions using local objects", type: "Activity sheet", grades: "Grades 3–5", subject: "Mathematics", tags: ["Multigrade", "No printer", "Manobo"], rating: "4.8", saves: 132, verified: true },
  { id: 2, icon: "Aa", title: "Stories from our community", type: "Reading material", grades: "Grades 2–4", subject: "English", tags: ["Low connectivity", "Indigenous context"], rating: "4.7", saves: 98, verified: true },
  { id: 3, icon: "☘", title: "Plants around our school", type: "Lesson plan", grades: "Grades 4–6", subject: "Science", tags: ["Outdoor", "Multigrade"], rating: "4.6", saves: 76, verified: false },
  { id: 4, icon: "123", title: "Number drills with bottle caps", type: "Activity cards", grades: "Grades 1–3", subject: "Mathematics", tags: ["No printer", "Limited materials"], rating: "4.9", saves: 164, verified: true },
];

function LibraryView({ classes, activeClassId, savedResourceIds, onToggleSaved, onSetUpClass }: { classes: TeachingClass[]; activeClassId: string; savedResourceIds: number[]; onToggleSaved: (id: number) => void; onSetUpClass: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All resources");
  const [selectedClassId, setSelectedClassId] = useState(activeClassId || classes[0]?.id || "");
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const visible = resources.filter((resource) => `${resource.title} ${resource.subject} ${resource.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All resources" || filter === "Saved on device" ? filter !== "Saved on device" || savedResourceIds.includes(resource.id) : resource.subject === filter));

  return <div className="view-page">
    <PageIntro eyebrow="SHARED LIBRARY" title="Resources made by teachers" description="Find materials that fit your grades, competencies, and classroom context." action={<button className="primary-button" type="button">↑ Share a resource</button>} />
    <section className="library-context"><div><p className="eyebrow">RECOMMENDATIONS FOR</p>{selectedClass ? <label><select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><span>{gradeList(selectedClass.grades)} · {selectedClass.subjects.join(", ")}</span></label> : <div className="library-no-class"><span>Add a class to receive relevant recommendations.</span><button type="button" onClick={onSetUpClass}>Set up class →</button></div>}</div><p><b>{savedResourceIds.length}</b><span>saved on this device</span></p></section>
    <aside className="prototype-disclosure"><span>i</span><p><b>Prototype offline behavior</b> Your saved selection persists on this device. The production app would also cache the actual files so they open without a connection.</p></aside>
    <section className="library-tools"><label className="library-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by lesson, competency, keyword, or author" /></label><div className="filter-row">{["All resources", "Saved on device", "Mathematics", "Science", "English"].map((item) => <button className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="filter-button" type="button">☷ More filters <span>3</span></button></section>
    <div className="library-summary"><p><strong>{visible.length} {filter === "Saved on device" ? "saved" : "recommended"} resources</strong><span>{selectedClass ? `Matched to ${gradeList(selectedClass.grades)} · ${selectedClass.subjects.join(", ")} · Agusan del Sur` : "Browse the shared teacher repository"}</span></p><select aria-label="Sort resources"><option>Most relevant</option><option>Highest rated</option><option>Most saved</option></select></div>
    <section className="resource-grid">
      {visible.map((resource) => <article className="library-card" key={resource.id}><div className="library-thumb">{resource.icon}<span>{resource.type}</span></div><div className="library-body"><div className="library-badges">{resource.verified && <span className="verified">✓ Verified</span>}<span>Shared by Teacher Lina</span></div><h2>{resource.title}</h2><p>{resource.grades} · {resource.subject}</p><div className="tags">{resource.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="library-stats"><span>★ {resource.rating}</span><span>{resource.saves} saves</span><span>Updated 2 days ago</span></div><div className="library-actions"><button className="secondary-button" type="button">Preview</button><button className={savedResourceIds.includes(resource.id) ? "saved-button" : "dark-button"} type="button" onClick={() => onToggleSaved(resource.id)}>{savedResourceIds.includes(resource.id) ? "✓ Saved on device" : "Save to device"}</button></div></div></article>)}
    </section>
    {!visible.length && <div className="empty-state"><b>No matching resources yet</b><p>Try a broader keyword or clear one of your filters.</p></div>}
  </div>;
}

function learnersForClass(item: TeachingClass, grade: GradeLevel) {
  return item.learners.filter((learner) => learner.grade === grade);
}

function learnerCountLabel(count: number) {
  return `${count} ${count === 1 ? "learner" : "learners"}`;
}

function attendanceForClass(item: TeachingClass, attendanceRecords: Record<string, Record<string, string>>, date: string) {
  return Object.fromEntries(item.learners.map((learner) => {
    const stored = attendanceRecords[`${item.id}-${date}-grade-${learner.grade}`] || attendanceRecords[`${item.id}-grade-${learner.grade}`] || {};
    return [learner.id, stored[learner.id] || stored[learner.name] || "Present"];
  }));
}

function attendanceNotesForClass(item: TeachingClass, attendanceNotes: Record<string, Record<string, string>>, date: string) {
  return Object.fromEntries(item.learners.map((learner) => {
    const stored = attendanceNotes[`${item.id}-${date}-grade-${learner.grade}`] || {};
    return [learner.id, stored[learner.id] || ""];
  }));
}

function AttendanceView({ classes, activeClassId, attendanceRecords, attendanceNotes, onSave, onSetUpClass }: { classes: TeachingClass[]; activeClassId: string; attendanceRecords: Record<string, Record<string, string>>; attendanceNotes: Record<string, Record<string, string>>; onSave: (updates: Record<string, Record<string, string>>, noteUpdates: Record<string, Record<string, string>>) => void; onSetUpClass: () => void }) {
  const [selectedClassId, setSelectedClassId] = useState(activeClassId || classes[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState(dateInputValue());
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | "all">("all");
  const allLearners = selectedClass ? selectedClass.learners : [];
  const learners = gradeFilter === "all" ? allLearners : allLearners.filter((learner) => learner.grade === gradeFilter);
  const [statuses, setStatuses] = useState<Record<string, string>>(() => selectedClass ? attendanceForClass(selectedClass, attendanceRecords, selectedDate) : {});
  const [notes, setNotes] = useState<Record<string, string>>(() => selectedClass ? attendanceNotesForClass(selectedClass, attendanceNotes, selectedDate) : {});
  const [saved, setSaved] = useState(false);

  function chooseClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId);
    setSelectedClassId(classId);
    setGradeFilter("all");
    setStatuses(nextClass ? attendanceForClass(nextClass, attendanceRecords, selectedDate) : {});
    setNotes(nextClass ? attendanceNotesForClass(nextClass, attendanceNotes, selectedDate) : {});
    setSaved(Boolean(nextClass?.grades.some((grade) => attendanceRecords[`${nextClass.id}-${selectedDate}-grade-${grade}`])));
  }

  function chooseDate(date: string) {
    setSelectedDate(date);
    setStatuses(selectedClass ? attendanceForClass(selectedClass, attendanceRecords, date) : {});
    setNotes(selectedClass ? attendanceNotesForClass(selectedClass, attendanceNotes, date) : {});
    setSaved(Boolean(selectedClass?.grades.some((grade) => attendanceRecords[`${selectedClass.id}-${date}-grade-${grade}`])));
  }

  function saveVisibleAttendance() {
    if (!selectedClass) return;
    const updates = Object.fromEntries(selectedClass.grades.map((grade) => {
      const key = `${selectedClass.id}-${selectedDate}-grade-${grade}`;
      const gradeLearners = learnersForClass(selectedClass, grade);
      return [key, Object.fromEntries(gradeLearners.map((learner) => [learner.id, statuses[learner.id] || "Present"]))];
    }));
    const noteUpdates = Object.fromEntries(selectedClass.grades.map((grade) => {
      const key = `${selectedClass.id}-${selectedDate}-grade-${grade}`;
      const gradeLearners = learnersForClass(selectedClass, grade);
      return [key, Object.fromEntries(gradeLearners.map((learner) => [learner.id, notes[learner.id]?.trim() || ""]))];
    }));
    onSave(updates, noteUpdates);
    setSaved(true);
  }

  if (!selectedClass) return <section className="class-zero-state compact-zero"><span className="zero-icon">✓</span><p className="eyebrow">RECORD ATTENDANCE</p><h1>Add a class first</h1><p>Attendance uses the classes and grade groups you manage, so there is nothing to record until a class is set up.</p><div><button className="primary-button" type="button" onClick={onSetUpClass}>Set up a class</button></div></section>;

  const attendanceStatuses = ["Present", "Absent", "Late", "Excused", "Leave"];
  const counts = learners.reduce<Record<string, number>>((total, learner) => ({ ...total, [statuses[learner.id]]: (total[statuses[learner.id]] || 0) + 1 }), {});
  const attendedCount = (counts.Present || 0) + (counts.Late || 0);
  const attendanceRate = learners.length ? Math.round((attendedCount / learners.length) * 100) : 0;

  return <div className="view-page attendance-page"><PageIntro eyebrow="RECORD · ATTENDANCE" title={selectedDate === dateInputValue() ? "Today’s attendance" : "Attendance record"} description={`${displayDate(selectedDate)} · ${selectedClass.name}`} action={<button className="primary-button" type="button" onClick={saveVisibleAttendance}>{saved ? "✓ Saved on device" : "Save attendance"}</button>} />
    <section className="attendance-class-picker"><label>Class<select value={selectedClassId} onChange={(event) => chooseClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="attendance-date-picker"><button type="button" aria-label="Previous day" onClick={() => chooseDate(moveDate(selectedDate, -1))}>←</button><label>Date<input type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} /></label><button type="button" aria-label="Next day" onClick={() => chooseDate(moveDate(selectedDate, 1))}>→</button><button type="button" onClick={() => chooseDate(dateInputValue())}>Today</button></div><span>{selectedClass.meetings.map((meeting) => `${meeting.days} · ${meeting.startTime}`).join("  |  ")}</span></section>
    <div className="attendance-grid">
      <section className="attendance-main">
        <div className="attendance-toolbar"><div className="grade-tabs"><button className={gradeFilter === "all" ? "active" : ""} type="button" onClick={() => setGradeFilter("all")}>All students<small>{learnerCountLabel(allLearners.length)}</small></button>{selectedClass.grades.map((item) => { const count = learnersForClass(selectedClass, item).length; return <button className={gradeFilter === item ? "active" : ""} type="button" onClick={() => setGradeFilter(item)} key={item}>{gradeLabel(item)}<small>{learnerCountLabel(count)}</small></button>; })}</div><button className="text-button" type="button" onClick={() => { setStatuses((current) => ({ ...current, ...Object.fromEntries(learners.map((learner) => [learner.id, "Present"])) })); setSaved(false); }}>Mark {gradeFilter === "all" ? "all" : gradeLabel(gradeFilter)} present</button></div>
        <div className="student-list">
          <div className="student-head"><span>Learner</span><span>Status</span></div>
          {learners.map((learner, index) => {
            const status = statuses[learner.id] || "Present";
            const acceptsNote = status === "Absent" || status === "Excused";
            return <div className={`student-row ${acceptsNote ? "with-note" : ""}`} key={learner.id}>
              <div><span className="student-avatar">{learner.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><p><strong>{learner.name}</strong><small>{gradeLabel(learner.grade)} · LRN •••• {2041 + index}</small>{notes[learner.id] && <small className="attendance-note-display">Note: {notes[learner.id]}</small>}</p></div>
              <div className="student-attendance-controls">
                <div className="status-options" role="group" aria-label={`Attendance status for ${learner.name}`}>{attendanceStatuses.map((nextStatus) => <button aria-label={`Mark ${learner.name} as ${nextStatus}`} aria-pressed={status === nextStatus} className={status === nextStatus ? `active ${nextStatus.toLowerCase()}` : ""} type="button" onClick={() => { setStatuses((current) => ({ ...current, [learner.id]: nextStatus })); if (nextStatus !== "Absent" && nextStatus !== "Excused") setNotes((current) => ({ ...current, [learner.id]: "" })); setSaved(false); }} key={nextStatus}>{nextStatus}</button>)}</div>
                {acceptsNote && <label className="attendance-note-field" htmlFor={`attendance-note-${learner.id}`}><span>Attendance note <small>(optional)</small></span><input id={`attendance-note-${learner.id}`} value={notes[learner.id] || ""} onChange={(event) => { setNotes((current) => ({ ...current, [learner.id]: event.target.value })); setSaved(false); }} placeholder="e.g. Reported sick by classmate" /><small>Record the reason and who shared it, if known.</small></label>}
              </div>
            </div>;
          })}
          {!learners.length && <div className="attendance-empty"><span>◎</span><p><b>{gradeFilter === "all" ? "No learners added yet" : `No ${gradeLabel(gradeFilter)} learners yet`}</b><small>Add learner names to {selectedClass.name} and they will appear here automatically.</small></p><button className="secondary-button" type="button" onClick={onSetUpClass}>Edit class roster</button></div>}
        </div>
      </section>
      <aside className="attendance-summary"><p className="eyebrow">{gradeFilter === "all" ? "ALL STUDENTS" : gradeLabel(gradeFilter).toUpperCase()} SUMMARY</p><h3>{learnerCountLabel(learners.length)}</h3><div className="summary-ring" style={{ background: `radial-gradient(circle, var(--paper) 55%, transparent 57%), conic-gradient(#46aa95 0 ${attendanceRate}%, #e8e3d9 ${attendanceRate}% 100%)` }}><strong>{attendanceRate}%</strong><span>attended</span></div><p className="attendance-rate-note">Present and late learners count as attended.</p>{attendanceStatuses.map((status) => <div className={`summary-stat ${status.toLowerCase()}`} key={status}><span>{status}</span><strong>{counts[status] || 0}</strong></div>)}<div className="sync-note"><span className="status-dot" /><p><b>Saved locally first</b><small>Records and attendance notes persist on this device and can sync when a connection returns.</small></p></div></aside>
    </div>
  </div>;
}

function CommunityView() {
  const [tab, setTab] = useState("Questions");
  const [reply, setReply] = useState("");
  const [replies, setReplies] = useState(["Try picture cards first, then let Grade 4 explain the written directions to their group."]);
  function submitReply() { if (reply.trim()) { setReplies((items) => [...items, reply.trim()]); setReply(""); } }
  return <div className="view-page"><PageIntro eyebrow="TEACHER COMMUNITY" title="Ask, review, and improve together" description="Conversations stay connected to the resources teachers are using." action={<button className="primary-button" type="button">＋ Start a discussion</button>} />
    <div className="community-tabs">{["Questions", "Reviews", "My division"].map((item) => <button className={tab === item ? "active" : ""} type="button" onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
    <section className="discussion-layout"><article className="discussion-card"><header><span className="avatar">TL</span><div><strong>Teacher Lina</strong><small>Agusan del Sur · 2h</small></div><span className="pill orange">MULTIGRADE</span></header><h2>How can I adapt this activity for Grades 2–3?</h2><p>My Grade 2 learners are still developing reading confidence. Has anyone used a visual version of the fractions activity?</p><div className="attached-resource"><span>½</span><div><strong>Fractions using local objects</strong><small>Activity sheet · Grades 3–5</small></div><button type="button">View</button></div><div className="reply-list">{replies.map((item, index) => <div className="reply-item" key={`${item}-${index}`}><span className="avatar">TM</span><p><b>{index ? "You" : "Teacher Marites"}</b>{item}</p></div>)}</div><div className="reply-box"><input value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitReply(); }} placeholder="Share an adaptation or suggestion…" /><button type="button" onClick={submitReply}>Reply</button></div></article><aside className="community-side"><p className="eyebrow">COMMUNITY PRINCIPLES</p><h3>Useful knowledge, not another noisy feed</h3><p>Discussions are attached to specific lessons and resources so teachers can find advice when they need it.</p><ul><li>Respect local teaching knowledge</li><li>Credit original authors</li><li>Explain what worked in your context</li></ul><button className="secondary-button" type="button">View community guidelines</button></aside></section>
  </div>;
}
