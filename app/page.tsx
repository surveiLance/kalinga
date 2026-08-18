"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";

type View = "home" | "classes" | "plan" | "library" | "attendance" | "community";

type ClassLearner = {
  id: string;
  name: string;
  grade: number;
};

type TeachingClass = {
  id: string;
  name: string;
  grades: number[];
  subjects: string[];
  quarter: string;
  meetingDays: string;
  startTime: string;
  learners: ClassLearner[];
};

type LegacyTeachingClass = Partial<TeachingClass> & {
  id: string;
  name: string;
  subject?: string;
  learnerCount?: number;
};

type PlanSlot = {
  id: string;
  time: string;
  teacherFocus: string;
  gradeTasks: Record<number, string>;
};

type SavedPlan = {
  id: string;
  classId: string;
  title: string;
  subject: string;
  quarter: string;
  grades: number[];
  duration: string;
  startTime?: string;
  language?: string;
  competencies?: Record<number, string>;
  slots: PlanSlot[];
  savedAt: string;
};

const commonSubjects = ["Mathematics", "Science", "English", "Filipino", "Araling Panlipunan", "MAPEH", "Edukasyon sa Pagpapakatao", "TLE"];
const learnerNames = ["Angela P. Morales", "Benjie R. Santos", "Carla M. Dela Cruz", "Daryl T. Gomez", "Elaine B. Ramos", "Francis A. Uy", "Grace L. Villanueva", "Harold N. Flores", "Irene C. Mendoza", "Jose R. Lim", "Karla S. Reyes", "Luis M. Aquino", "Mariel C. Torres", "Noel B. Pangan", "Olivia R. Cabahug", "Paolo S. Evasco", "Queenie M. Dayao", "Ramon L. Flores"];

function createSampleLearners(grades: number[], count: number): ClassLearner[] {
  const safeGrades = grades.length ? grades : [1];
  return Array.from({ length: count }, (_, index) => ({
    id: `learner-${index + 1}`,
    name: learnerNames[index] || `Learner ${String(index + 1).padStart(2, "0")}`,
    grade: safeGrades[index % safeGrades.length],
  }));
}

function normalizeClass(item: LegacyTeachingClass): TeachingClass {
  const grades = Array.isArray(item.grades) && item.grades.length ? item.grades : [1];
  const subjects = Array.isArray(item.subjects) && item.subjects.length
    ? item.subjects.filter(Boolean)
    : [item.subject || "Mathematics"];
  const learners = Array.isArray(item.learners) && item.learners.length
    ? item.learners.map((learner, index) => ({ id: learner.id || `${item.id}-learner-${index + 1}`, name: learner.name, grade: learner.grade || grades[0] }))
    : createSampleLearners(grades, Math.max(0, item.learnerCount || 0)).map((learner) => ({ ...learner, id: `${item.id}-${learner.id}` }));

  return {
    id: item.id,
    name: item.name,
    grades,
    subjects,
    quarter: item.quarter || "Quarter 1",
    meetingDays: item.meetingDays || "Monday to Friday",
    startTime: item.startTime || "8:00 AM",
    learners,
  };
}

const sampleClass: TeachingClass = {
  id: "sample-morning",
  name: "Morning Multigrade Class",
  grades: [3, 4, 5],
  subjects: ["Mathematics", "Science", "English", "Filipino"],
  quarter: "Quarter 1",
  meetingDays: "Monday to Friday",
  startTime: "8:00 AM",
  learners: createSampleLearners([3, 4, 5], 18),
};

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
  const [editingPlanId, setEditingPlanId] = useState("");
  const [classDataReady, setClassDataReady] = useState(false);

  useEffect(() => {
    try {
      const storedClasses = window.localStorage.getItem("kalinga-classes");
      const storedActiveClass = window.localStorage.getItem("kalinga-active-class");
      const storedPlans = window.localStorage.getItem("kalinga-plans");
      const storedResources = window.localStorage.getItem("kalinga-saved-resources");
      const storedAttendance = window.localStorage.getItem("kalinga-attendance");
      if (storedClasses) {
        const parsed = (JSON.parse(storedClasses) as LegacyTeachingClass[]).map(normalizeClass);
        // Hydrate device-only prototype data after the client mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setClasses(parsed);
        setActiveClassId(storedActiveClass || parsed[0]?.id || "");
      }
      if (storedPlans) setSavedPlans(JSON.parse(storedPlans) as SavedPlan[]);
      if (storedResources) setSavedResourceIds(JSON.parse(storedResources) as number[]);
      if (storedAttendance) setAttendanceRecords(JSON.parse(storedAttendance) as Record<string, Record<string, string>>);
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
  }, [classes, activeClassId, savedPlans, savedResourceIds, attendanceRecords, classDataReady]);

  const activeClass = classes.find((item) => item.id === activeClassId) || classes[0];
  const activePlans = savedPlans.filter((item) => item.classId === activeClass?.id);
  const latestPlan = activePlans[0];
  const activeAttendance = activeClass
    ? Object.entries(attendanceRecords).filter(([key]) => key.startsWith(`${activeClass.id}-grade-`)).flatMap(([, records]) => Object.values(records))
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
    setAttendanceRecords((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${classId}-grade-`))));
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

  function saveAttendance(updates: Record<string, Record<string, string>>) {
    setAttendanceRecords((current) => ({ ...current, ...updates }));
  }

  if (!hasEntered) {
    return <LoginScreen onContinue={() => setHasEntered(true)} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <button className="brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}>
          <Image src="/kalinga-logo.png" width={2172} height={724} alt="Kalinga" priority />
        </button>

        <nav className="nav-list">
          <button className={`nav-item ${view === "home" ? "active" : ""}`} type="button" onClick={() => setView("home")}><span className="nav-icon">⌂</span> Home</button>
          <button className={`nav-item ${view === "classes" ? "active" : ""}`} type="button" onClick={() => setView("classes")}><span className="nav-icon">▦</span> My classes</button>
          <button className={`nav-item ${view === "plan" ? "active" : ""}`} type="button" onClick={() => beginPlan()}><span className="nav-icon">＋</span> Create</button>
          <button className={`nav-item ${view === "library" ? "active" : ""}`} type="button" onClick={() => setView("library")}><span className="nav-icon">▱</span> Resources</button>
          <button className={`nav-item ${view === "community" ? "active" : ""}`} type="button" onClick={() => setView("community")}><span className="nav-icon">♧</span> Community</button>
        </nav>

        <div className="offline-card">
          <span className="status-dot" />
          <div><strong>Offline-ready</strong><small>12 resources saved</small></div>
        </div>

        <div className="account-anchor desktop-account">
          {accountOpen && <AccountMenu onSignOut={signOut} />}
          <button className="profile" type="button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>
            <span className="avatar">TA</span>
            <span><strong>Teacher Ana</strong><small>Dinagat Elementary</small></span>
            <span aria-hidden="true">···</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}><Image src="/kalinga-logo.png" width={2172} height={724} alt="Kalinga" priority /></button>
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search lessons and resources" placeholder="Search lessons, competencies, or resources" />
          </label>
          <div className="top-actions">
            <span className="connection"><i /> Offline-ready</span>
            <button className="language" type="button">ENG / FIL</button>
            <button className="notification" type="button" aria-label="Notifications">●</button>
            <div className="account-anchor mobile-account">
              <button className="mobile-account-button" type="button" aria-label="Account options" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>TA</button>
              {accountOpen && <AccountMenu onSignOut={signOut} />}
            </div>
          </div>
        </header>

        <div className="content">
          {view === "home" && !activeClass ? <ClassZeroState onSetUp={() => setView("classes")} onLoadSample={loadSampleClass} /> : view === "home" && activeClass ? <>
            <section className="welcome-row home-welcome">
              <div><p className="eyebrow">MONDAY · AUGUST 17</p><h1 className="welcome-title"><span>MAGANDANG ARAW,</span><em>Teacher Ana!</em></h1><p className="lead">Here is what needs your attention today. Full class details stay in My Classes.</p></div>
              <div className="welcome-actions"><label>Today’s class<select value={activeClass.id} onChange={(event) => setActiveClassId(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
            </section>
            {notice && <p className="notice" role="status">{notice}</p>}
            <section className="home-command-grid">
              <article className="home-today-card">
                <div className="card-label-row"><span className="pill orange">NEXT CLASS · {activeClass.startTime}</span><span className="saved">{activeClass.meetingDays}</span></div>
                <p className="muted">GRADES {activeClass.grades.join(", ")} · {activeClass.subjects.length} SUBJECTS · {activeClass.learners.length} LEARNERS</p>
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
          </> : view === "classes" ? <ClassesView classes={classes} activeClassId={activeClass?.id || ""} savedPlans={savedPlans} attendanceRecords={attendanceRecords} onSelectClass={setActiveClassId} onSave={saveClass} onDelete={deleteClass} onLoadSample={loadSampleClass} onPlan={beginPlan} onAttendance={() => setView("attendance")} /> : view === "plan" ? <PlanView key={editingPlanId || `new-${activeClass?.id || "none"}`} classes={classes} activeClassId={activeClass?.id || ""} initialPlan={savedPlans.find((item) => item.id === editingPlanId)} onSave={savePlan} onBack={() => setView("classes")} onSetUpClass={() => setView("classes")} /> : view === "library" ? <LibraryView classes={classes} activeClassId={activeClass?.id || ""} savedResourceIds={savedResourceIds} onToggleSaved={toggleSavedResource} onSetUpClass={() => setView("classes")} /> : view === "attendance" ? <AttendanceView classes={classes} activeClassId={activeClass?.id || ""} attendanceRecords={attendanceRecords} onSave={saveAttendance} onSetUpClass={() => setView("classes")} /> : <CommunityView />}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button className={view === "home" ? "active" : ""} type="button" onClick={() => setView("home")}><span>⌂</span>Home</button><button className={view === "classes" ? "active" : ""} type="button" onClick={() => setView("classes")}><span>▦</span>Classes</button><button className={view === "plan" ? "active" : ""} type="button" onClick={() => beginPlan()}><span>＋</span>Create</button><button className={view === "library" ? "active" : ""} type="button" onClick={() => setView("library")}><span>▱</span>Library</button><button className={view === "community" ? "active" : ""} type="button" onClick={() => setView("community")}><span>♧</span>Community</button>
        </nav>
      </section>
    </main>
  );
}

function LoginScreen({ onContinue }: { onContinue: () => void }) {
  const [email, setEmail] = useState("teacher.ana@kalinga.ph");
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
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teacher@school.edu.ph" required /></label>
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

function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="account-menu" role="menu" aria-label="Account options">
      <div className="account-menu-heading"><span className="avatar">TA</span><span><strong>Teacher Ana</strong><small>teacher.ana@kalinga.ph</small></span></div>
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
      <p>Add each class once. Kalinga will reuse its grade levels, schedule, quarter, and learner count everywhere—so you do not have to enter the same details again.</p>
      <div><button className="primary-button" type="button" onClick={onSetUp}>＋ Set up my first class</button><button className="secondary-button" type="button" onClick={onLoadSample}>Preview with sample data</button></div>
      <small>Your classes are saved on this device for the prototype.</small>
    </section>
  );
}

function ClassesView({ classes, activeClassId, savedPlans, attendanceRecords, onSelectClass, onSave, onDelete, onLoadSample, onPlan, onAttendance }: { classes: TeachingClass[]; activeClassId: string; savedPlans: SavedPlan[]; attendanceRecords: Record<string, Record<string, string>>; onSelectClass: (classId: string) => void; onSave: (item: Omit<TeachingClass, "id">, classId?: string) => void; onDelete: (classId: string) => void; onLoadSample: () => void; onPlan: (planId?: string) => void; onAttendance: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteCandidateId, setDeleteCandidateId] = useState("");
  const [name, setName] = useState("");
  const [grades, setGrades] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [quarter, setQuarter] = useState("Quarter 1");
  const [meetingDays, setMeetingDays] = useState("Monday to Friday");
  const [startTime, setStartTime] = useState("8:00 AM");
  const [learners, setLearners] = useState<ClassLearner[]>([]);
  const selectedClass = classes.find((item) => item.id === activeClassId) || classes[0];
  const selectedPlans = savedPlans.filter((plan) => plan.classId === selectedClass?.id);
  const currentPlan = selectedPlans[0];
  const attendanceCount = selectedClass ? Object.entries(attendanceRecords).filter(([key]) => key.startsWith(`${selectedClass.id}-grade-`)).flatMap(([, records]) => Object.values(records)).length : 0;

  function resetForm() {
    setEditingId("");
    setName("");
    setGrades([]);
    setSubjects([]);
    setCustomSubject("");
    setQuarter("Quarter 1");
    setMeetingDays("Monday to Friday");
    setStartTime("8:00 AM");
    setLearners([]);
  }

  function editClass(item: TeachingClass) {
    setEditingId(item.id);
    setDeleteCandidateId("");
    setName(item.name);
    setGrades(item.grades);
    setSubjects(item.subjects);
    setQuarter(item.quarter);
    setMeetingDays(item.meetingDays);
    setStartTime(item.startTime);
    setLearners(item.learners.map((learner) => ({ ...learner })));
    setFormOpen(true);
    window.requestAnimationFrame(() => document.querySelector(".class-setup-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function toggleGrade(grade: number) {
    setGrades((current) => {
      const next = current.includes(grade) ? current.filter((item) => item !== grade) : [...current, grade].sort();
      setLearners((items) => items.map((learner) => next.includes(learner.grade) ? learner : { ...learner, grade: next[0] || learner.grade }));
      return next;
    });
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
    setLearners((current) => [...current, { id: `learner-${Date.now()}-${current.length}`, name: "", grade: grades[0] || 1 }]);
  }

  function updateLearner(id: string, field: "name" | "grade", value: string | number) {
    setLearners((current) => current.map((learner) => learner.id === id ? { ...learner, [field]: value } : learner));
  }

  function submitClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !grades.length || !subjects.length) return;
    onSave({ name: name.trim(), grades, subjects, quarter, meetingDays, startTime, learners: learners.filter((learner) => learner.name.trim()).map((learner) => ({ ...learner, name: learner.name.trim() })) }, editingId || undefined);
    resetForm();
    setFormOpen(false);
  }

  return (
    <div className="view-page classes-page">
      <PageIntro eyebrow="MY CLASSES" title="Your classes, ready to teach" description="Choose a class to manage its schedule, lesson plans, learners, and attendance in one place." action={classes.length ? <button className="primary-button" type="button" onClick={() => { resetForm(); setFormOpen(true); }}>＋ Add another class</button> : undefined} />
      {!!classes.length && selectedClass && <section className="class-hub">
        <nav className="class-switcher" aria-label="Saved classes">
          <p className="eyebrow">YOUR CLASSES</p>
          {classes.map((item) => <button className={item.id === selectedClass.id ? "active" : ""} type="button" key={item.id} onClick={() => onSelectClass(item.id)}><span><b>{item.name}</b><small>Grades {item.grades.join(", ")} · {item.startTime}</small></span><span>→</span></button>)}
        </nav>
        <div className="class-workspace">
          <header className="class-workspace-head">
            <div><p className="eyebrow">{selectedClass.quarter} · {selectedClass.meetingDays}</p><h2>{selectedClass.name}</h2><p>Grades {selectedClass.grades.join(", ")} · {selectedClass.subjects.join(" · ")} · {selectedClass.learners.length} learners</p></div>
            <div><button className="secondary-button" type="button" onClick={() => editClass(selectedClass)}>✎ Edit class</button><button className="primary-button" type="button" onClick={() => onPlan()}>＋ New lesson</button></div>
          </header>
          <div className="class-action-strip">
            <button type="button" onClick={onAttendance}><span>✓</span><p><b>Take attendance</b><small>{attendanceCount ? `${attendanceCount} records saved` : `${selectedClass.learners.length} learners ready`}</small></p><b>→</b></button>
            <button type="button" onClick={() => onPlan(currentPlan?.id)}><span>▦</span><p><b>{currentPlan ? "Open today’s schedule" : "Build the first schedule"}</b><small>{currentPlan ? `${currentPlan.startTime || selectedClass.startTime} · ${currentPlan.slots.length} blocks` : `Starts at ${selectedClass.startTime}`}</small></p><b>→</b></button>
            <button type="button" onClick={() => editClass(selectedClass)}><span>◎</span><p><b>Manage learners</b><small>Add names or change grade levels</small></p><b>→</b></button>
          </div>
          <div className="class-detail-grid">
            <article className="class-schedule-panel">
              <div className="section-title inline"><div><p className="eyebrow">CLASS SCHEDULE</p><h3>{currentPlan?.title || "No lesson scheduled yet"}</h3></div>{currentPlan && <button className="text-button" type="button" onClick={() => onPlan(currentPlan.id)}>Edit schedule →</button>}</div>
              {currentPlan ? <div className="timeline compact-timeline">{currentPlan.slots.map((slot, index) => <div className="timeline-row" key={slot.id}><time>{slot.time}</time><div className={`timeline-event ${index ? `grade${selectedClass.grades[index - 1] || selectedClass.grades[0]}` : "shared"}`}><strong>{slot.teacherFocus}</strong><small>{Object.values(slot.gradeTasks).filter(Boolean).join(" · ") || "Activities not added yet"}</small></div></div>)}</div> : <div className="class-panel-empty"><span>○</span><p><b>Nothing to follow yet</b><small>Create a lesson and its editable timetable will appear here.</small></p><button className="secondary-button" type="button" onClick={() => onPlan()}>Create lesson</button></div>}
            </article>
            <aside className="class-plans-panel">
              <div className="section-title inline"><div><p className="eyebrow">LESSON PLANS</p><h3>{selectedPlans.length} saved</h3></div></div>
              {selectedPlans.length ? <div className="class-plan-links">{selectedPlans.map((plan) => <button type="button" key={plan.id} onClick={() => onPlan(plan.id)}><span><b>{plan.title}</b><small>{plan.subject} · {plan.quarter}</small></span><span>→</span></button>)}</div> : <p className="class-plan-empty">Saved plans for this class will stay together here.</p>}
              <div className="class-roster-summary"><span>{selectedClass.learners.length}</span><p><b>Named learners</b><small>Attendance is connected to this roster.</small></p><button type="button" onClick={onAttendance}>Open attendance →</button></div>
              <button className="delete-class-button hub-delete" type="button" onClick={() => setDeleteCandidateId(selectedClass.id)}>Delete class</button>
              {deleteCandidateId === selectedClass.id && <div className="delete-confirm" role="alert"><div><b>Delete {selectedClass.name}?</b><span>This also removes its saved lesson plans and attendance records.</span></div><div><button type="button" onClick={() => setDeleteCandidateId("")}>Keep class</button><button type="button" onClick={() => onDelete(selectedClass.id)}>Delete class</button></div></div>}
            </aside>
          </div>
        </div>
      </section>}
      {(formOpen || !classes.length) && <form className="class-setup-card class-form-drawer" onSubmit={submitClass}>
        <div className="class-setup-heading"><span>{editingId ? "✓" : "1"}</span><div><h2>{editingId ? `Edit ${name}` : classes.length ? "Add another class" : "Tell us about your first class"}</h2><p>{editingId ? "Changes to subjects and learner names will appear throughout the prototype." : "You can change lesson-specific details later without changing the saved class."}</p></div>{editingId && <button className="text-button cancel-edit" type="button" onClick={() => { resetForm(); setFormOpen(false); }}>Cancel editing</button>}</div>
        <div className="form-grid class-form-grid">
          <label>Class or section name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Morning Multigrade Class" required /></label>
          <label>Current quarter<select value={quarter} onChange={(event) => setQuarter(event.target.value)}><option>Quarter 1</option><option>Quarter 2</option><option>Quarter 3</option><option>Quarter 4</option></select></label>
          <label>Meeting days<select value={meetingDays} onChange={(event) => setMeetingDays(event.target.value)}><option>Monday to Friday</option><option>Monday, Wednesday, Friday</option><option>Tuesday and Thursday</option><option>Custom schedule</option></select></label>
          <div className="time-field"><span>Usual start time</span><TimePicker value={startTime} onChange={setStartTime} /></div>
        </div>
        <div className="field-group"><p className="group-label">Which grades learn together?</p><div className="grade-picker">{[1, 2, 3, 4, 5, 6].map((grade) => <button className={grades.includes(grade) ? "selected" : ""} type="button" key={grade} onClick={() => toggleGrade(grade)}><span>{grades.includes(grade) ? "✓" : grade}</span>Grade {grade}</button>)}</div></div>
        <div className="field-group subject-setup"><p className="group-label">What subjects do you teach this class?<small>Select every subject that applies, or add the exact subject name you use.</small></p><div className="subject-options">{commonSubjects.map((subject) => <button className={subjects.includes(subject) ? "selected" : ""} type="button" onClick={() => toggleSubject(subject)} key={subject}>{subjects.includes(subject) ? "✓ " : "+ "}{subject}</button>)}</div><div className="custom-subject"><input value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomSubject(); } }} placeholder="Another subject (e.g. Mother Tongue)" /><button className="secondary-button" type="button" onClick={addCustomSubject}>Add subject</button></div>{!!subjects.length && <div className="selected-subjects">{subjects.map((subject) => <button type="button" onClick={() => toggleSubject(subject)} key={subject}>{subject} ×</button>)}</div>}</div>
        <div className="field-group roster-builder"><div className="roster-heading"><p className="group-label">Who are the learners in this class?<small>Add names now so attendance is ready. You can also save the class and add them later.</small></p><button className="secondary-button" type="button" onClick={addLearner} disabled={!grades.length}>＋ Add learner</button></div>{!learners.length ? <div className="roster-empty"><span>◎</span><p><b>No learner names yet</b><small>Select a grade, then add each learner and assign their grade level.</small></p></div> : <div className="roster-rows">{learners.map((learner, index) => <div className="roster-row" key={learner.id}><span>{index + 1}</span><input aria-label={`Learner ${index + 1} name`} value={learner.name} onChange={(event) => updateLearner(learner.id, "name", event.target.value)} placeholder="Full name" /><select aria-label={`Learner ${index + 1} grade`} value={learner.grade} onChange={(event) => updateLearner(learner.id, "grade", Number(event.target.value))}>{grades.map((grade) => <option value={grade} key={grade}>Grade {grade}</option>)}</select><button type="button" aria-label={`Remove learner ${index + 1}`} onClick={() => setLearners((current) => current.filter((item) => item.id !== learner.id))}>×</button></div>)}</div>}</div>
        <footer className="builder-footer"><span>{!grades.length ? "Select at least one grade level." : !subjects.length ? "Select or add at least one subject." : `${grades.length} grade groups · ${subjects.length} subjects · ${learners.filter((learner) => learner.name.trim()).length} named learners`}</span><button className="primary-button" type="submit" disabled={!name.trim() || !grades.length || !subjects.length}>{editingId ? "Save class changes" : "Save class and continue →"}</button></footer>
        {classes.length && <button className="close-class-form" type="button" onClick={() => { resetForm(); setFormOpen(false); }}>Close without saving</button>}
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

function durationMinutes(duration: string) {
  return Number.parseInt(duration, 10) || 80;
}

function TimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parts = parseTime(value);
  function update(next: Partial<typeof parts>) {
    const merged = { ...parts, ...next };
    onChange(`${merged.hour}:${String(merged.minute).padStart(2, "0")} ${merged.period}`);
  }
  return <div className="time-picker" aria-label="Choose time"><select aria-label="Hour" value={parts.hour} onChange={(event) => update({ hour: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option value={hour} key={hour}>{hour}</option>)}</select><span>:</span><select aria-label="Minute" value={parts.minute} onChange={(event) => update({ minute: Number(event.target.value) })}>{Array.from({ length: 60 }, (_, minute) => minute).map((minute) => <option value={minute} key={minute}>{String(minute).padStart(2, "0")}</option>)}</select><div className="period-toggle"><button className={parts.period === "AM" ? "active" : ""} type="button" onClick={() => update({ period: "AM" })}>AM</button><button className={parts.period === "PM" ? "active" : ""} type="button" onClick={() => update({ period: "PM" })}>PM</button></div></div>;
}

function createSchedule(grades: number[], startTime = "8:00 AM", duration = "80 minutes"): PlanSlot[] {
  const sharedTasks = Object.fromEntries(grades.map((grade) => [grade, "Shared introduction"]));
  const start = toMinutes(startTime);
  const total = durationMinutes(duration);
  const sharedMinutes = Math.min(15, Math.max(10, Math.round(total * .2)));
  const guidedMinutes = grades.length ? (total - sharedMinutes) / grades.length : total - sharedMinutes;
  const guidedSlots = grades.map((focusGrade, index) => ({
    id: `slot-${focusGrade}-${index}`,
    time: formatTime(start + sharedMinutes + Math.round(index * guidedMinutes)),
    teacherFocus: `Guide Grade ${focusGrade}`,
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
  const [quarter, setQuarter] = useState(initialPlan?.quarter || selectedClass?.quarter || "Quarter 1");
  const [duration, setDuration] = useState(initialPlan?.duration || "80 minutes");
  const [startTime, setStartTime] = useState(initialPlan?.startTime || selectedClass?.startTime || "8:00 AM");
  const [language, setLanguage] = useState(initialPlan?.language || "English & Filipino");
  const [lessonTitle, setLessonTitle] = useState(initialPlan?.title || "");
  const [competencies, setCompetencies] = useState<Record<number, string>>(initialPlan?.competencies || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, ""])));
  const [slots, setSlots] = useState<PlanSlot[]>(initialPlan?.slots || createSchedule(selectedClass?.grades || [], selectedClass?.startTime, initialPlan?.duration || "80 minutes"));
  const [saved, setSaved] = useState(false);

  function toggleGrade(grade: number) {
    setGrades((current) => {
      const next = current.includes(grade) ? current.filter((item) => item !== grade) : [...current, grade].sort();
      setCompetencies((items) => Object.fromEntries(next.map((item) => [item, items[item] || ""])));
      return next;
    });
  }

  function chooseClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId);
    setSelectedClassId(classId);
    if (!nextClass) return;
    setGrades(nextClass.grades);
    setSubject(nextClass.subjects[0] || "");
    setQuarter(nextClass.quarter);
    setStartTime(nextClass.startTime);
    setCompetencies(Object.fromEntries(nextClass.grades.map((grade) => [grade, ""])));
    setSlots(createSchedule(nextClass.grades, nextClass.startTime, duration));
    setSaved(false);
  }

  function chooseSubject(nextSubject: string) {
    setSubject(nextSubject);
    setCompetencies(Object.fromEntries(grades.map((grade) => [grade, ""])));
    setSaved(false);
  }

  function updateSlot(slotId: string, field: "time" | "teacherFocus", value: string) {
    setSlots((current) => current.map((slot) => slot.id === slotId ? { ...slot, [field]: value } : slot));
    setSaved(false);
  }

  function updateGradeTask(slotId: string, grade: number, value: string) {
    setSlots((current) => current.map((slot) => slot.id === slotId ? { ...slot, gradeTasks: { ...slot.gradeTasks, [grade]: value } } : slot));
    setSaved(false);
  }

  function addSlot() {
    setSlots((current) => [...current, { id: `slot-${Date.now()}`, time: formatTime(toMinutes(current.at(-1)?.time || startTime) + 15), teacherFocus: "", gradeTasks: Object.fromEntries(grades.map((grade) => [grade, ""])) }]);
  }

  function saveCurrentPlan() {
    if (!selectedClass) return;
    const plan: SavedPlan = { id: initialPlan?.id || `plan-${generatedPlanId}`, classId: selectedClass.id, title: lessonTitle.trim() || "Untitled lesson", subject, quarter, grades, duration, startTime, language, competencies, slots, savedAt: "just now" };
    onSave(plan);
    setSaved(true);
  }

  if (!classes.length) {
    return <section className="class-zero-state compact-zero"><span className="zero-icon">＋</span><p className="eyebrow">CREATE A LESSON</p><h1>Add a class first</h1><p>A lesson needs a saved class so its grades, attendance list, and schedule stay connected.</p><div><button className="primary-button" type="button" onClick={onSetUpClass}>Set up a class</button><button className="secondary-button" type="button" onClick={onBack}>Back home</button></div></section>;
  }

  return (
    <div className="view-page">
      <PageIntro
        eyebrow="CREATE · MULTIGRADE LESSON"
        title={step === 1 ? "Tell us about your class" : step === 2 ? "Choose each grade’s competency" : "Your coordinated lesson"}
        description={step === 1 ? "Kalinga uses your classroom context to prepare a useful starting point." : step === 2 ? "You remain in control—edit, replace, or leave any suggestion blank." : "One class flow, with a clear learning path for every grade."}
        action={<button className="secondary-button" type="button" onClick={onBack}>← Back home</button>}
      />

      <div className="stepper" aria-label={`Step ${step} of 3`}>
        {["Class context", "Competencies", "Review plan"].map((label, index) => <div key={label} className={step >= index + 1 ? "done" : ""}><span>{step > index + 1 ? "✓" : index + 1}</span><b>{label}</b></div>)}
      </div>

      {step === 1 && (
        <section className="builder-card">
          <div className="builder-main">
            <div className="form-grid planner-class-row">
              <label>Plan for saved class<select value={selectedClassId} onChange={(event) => chooseClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label>Lesson title<input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder="What is this lesson about?" /></label>
            </div>
            <div className="field-group">
              <p className="group-label">Which grades are learning together?</p>
              <div className="grade-picker">
                {[1, 2, 3, 4, 5, 6].map((grade) => <button className={grades.includes(grade) ? "selected" : ""} type="button" key={grade} onClick={() => toggleGrade(grade)}><span>{grades.includes(grade) ? "✓" : grade}</span>Grade {grade}</button>)}
              </div>
            </div>
            <div className="form-grid">
              <label>Lesson subject<input list="class-subject-options" value={subject} onChange={(event) => chooseSubject(event.target.value)} placeholder="Choose or type any subject" /><datalist id="class-subject-options">{selectedClass?.subjects.map((item) => <option value={item} key={item} />)}</datalist><small>Competencies stay blank until you enter this lesson’s actual topic.</small></label>
              <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English & Filipino</option><option>English</option><option>Filipino</option><option>Mother Tongue</option><option>Other / Mixed</option></select></label>
              <label>Quarter<select value={quarter} onChange={(event) => setQuarter(event.target.value)}><option>Quarter 1</option><option>Quarter 2</option><option>Quarter 3</option><option>Quarter 4</option></select></label>
              <label>Total class time<select value={duration} onChange={(event) => setDuration(event.target.value)}><option>40 minutes</option><option>60 minutes</option><option>80 minutes</option><option>100 minutes</option><option>120 minutes</option></select><small>This is the full time shared by all grade groups—not time per grade.</small></label>
            </div>
            <div className="lesson-timing-box"><div><p className="eyebrow">WHEN DOES THIS LESSON START?</p><h3>{startTime} for {duration}</h3><p>Kalinga will divide this window into an all-class opening and one teacher-focus block per grade. You can change every block afterward.</p></div><TimePicker value={startTime} onChange={setStartTime} /></div>
            <div className="field-group">
              <p className="group-label">What should Kalinga consider?</p>
              <div className="context-pills"><button className="selected" type="button">Multigrade</button><button className="selected" type="button">Low connectivity</button><button type="button">No printing</button><button type="button">Indigenous context</button><button type="button">Limited materials</button></div>
            </div>
          </div>
          <aside className="builder-help"><span>✦</span><h3>Teacher-first assistance</h3><p>Kalinga can organize what you enter, but it will not invent a competency when no matching DepEd or AI source is available.</p><div><b>{grades.length}</b><small>grade groups selected</small></div><div><b>{startTime}</b><small>lesson starts · {duration} total</small></div></aside>
          <footer className="builder-footer"><span>Draft saves automatically on this device.</span><button className="primary-button" type="button" disabled={!grades.length} onClick={() => setStep(2)}>Choose competencies →</button></footer>
        </section>
      )}

      {step === 2 && (
        <section className="competency-layout">
          <div className="competency-list">
            <aside className="competency-source-note"><span>i</span><p><b>No automatic competency was inserted</b><small>{subject || "This subject"} · {quarter}. Enter the DepEd competency you are actually teaching. When verified curriculum data or AI is unavailable offline, these fields intentionally remain blank.</small></p></aside>
            {grades.map((grade) => (
              <article className={`competency-card grade-${grade}`} key={grade}>
                <header><span>GRADE {grade}</span><small>{subject || "Subject not entered"} · {quarter}</small></header>
                <label>Learning competency<textarea value={competencies[grade] || ""} onChange={(event) => { setCompetencies((current) => ({ ...current, [grade]: event.target.value })); setSaved(false); }} placeholder={`Enter the exact Grade ${grade} competency for this lesson`} /></label>
                <p className="competency-helper">You may leave this blank and continue offline, then complete it when your competency reference is available.</p>
              </article>
            ))}
          </div>
          <aside className="overlap-panel neutral-overlap"><p className="eyebrow">OPTIONAL ASSISTANCE</p><h3>Shared opportunities appear only when supported</h3><p>With connectivity, a future AI service can compare the competencies you entered and suggest a shared opening activity. Offline, Kalinga does not guess.</p><div className="offline-ai-state"><span>○</span><p><b>No suggestion loaded</b><small>Your grade-level fields remain independent and editable.</small></p></div></aside>
          <footer className="builder-footer"><button className="secondary-button" type="button" onClick={() => setStep(1)}>← Class context</button><button className="primary-button" type="button" onClick={() => { setSlots(createSchedule(grades, startTime, duration)); setStep(3); }}>Build editable schedule →</button></footer>
        </section>
      )}

      {step === 3 && (
        <section className="plan-result">
          <div className="result-toolbar"><div><span className="pill orange">{saved ? "SAVED · EDITABLE" : "DRAFT · EDITABLE"}</span><b>{selectedClass?.name} · {subject} · Grades {grades.join(", ")}</b></div><div><button className="secondary-button" type="button" onClick={() => setStep(2)}>Edit competencies</button><button className="primary-button" type="button" onClick={saveCurrentPlan}>{saved ? "✓ Saved to class" : "Save lesson"}</button></div></div>
          <div className="plan-title"><div><p className="eyebrow">{quarter} · MULTIGRADE LESSON PLAN</p><input className="plan-title-input" aria-label="Lesson title" value={lessonTitle} placeholder="Untitled lesson" onChange={(event) => { setLessonTitle(event.target.value); setSaved(false); }} /><p>{startTime}–{formatTime(toMinutes(startTime) + durationMinutes(duration))} · {duration} total · {language}</p></div><button className="icon-button" type="button" aria-label="More lesson actions">···</button></div>
          <div className="schedule-window-summary"><span>◎</span><p><b>Your teaching window</b><small>The rows below divide {duration} beginning at {startTime}. Change a row’s hour, minute, or AM/PM directly; nothing is locked.</small></p></div>
          <div className="rotation-table">
            <div className="rotation-head" style={{ "--grade-count": grades.length } as React.CSSProperties}><span>Time</span><span>Teacher focus</span>{grades.map((grade) => <span key={grade}>Grade {grade}</span>)}</div>
            {slots.map((slot) => <div className="rotation-row editable-row" style={{ "--grade-count": grades.length } as React.CSSProperties} key={slot.id}><div className="slot-time-editor"><TimePicker value={slot.time} onChange={(value) => updateSlot(slot.id, "time", value)} /></div><input aria-label={`Teacher focus at ${slot.time}`} value={slot.teacherFocus} placeholder="Who has teacher support?" onChange={(event) => updateSlot(slot.id, "teacherFocus", event.target.value)} />{grades.map((grade) => <textarea aria-label={`Grade ${grade} activity at ${slot.time}`} value={slot.gradeTasks[grade] || ""} placeholder={`Grade ${grade} activity`} onChange={(event) => updateGradeTask(slot.id, grade, event.target.value)} key={grade} />)}</div>)}
          </div>
          <div className="schedule-actions"><button className="secondary-button" type="button" onClick={addSlot}>＋ Add schedule block</button><span>Edit any time, teacher focus, or grade activity directly. Kalinga will not lock the suggested rotation.</span></div>
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
    <section className="library-context"><div><p className="eyebrow">RECOMMENDATIONS FOR</p>{selectedClass ? <label><select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><span>Grades {selectedClass.grades.join(", ")} · {selectedClass.subjects.join(", ")} · {selectedClass.quarter}</span></label> : <div className="library-no-class"><span>Add a class to receive relevant recommendations.</span><button type="button" onClick={onSetUpClass}>Set up class →</button></div>}</div><p><b>{savedResourceIds.length}</b><span>saved on this device</span></p></section>
    <aside className="prototype-disclosure"><span>i</span><p><b>Prototype offline behavior</b> Your saved selection persists on this device. The production app would also cache the actual files so they open without a connection.</p></aside>
    <section className="library-tools"><label className="library-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by lesson, competency, keyword, or author" /></label><div className="filter-row">{["All resources", "Saved on device", "Mathematics", "Science", "English"].map((item) => <button className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="filter-button" type="button">☷ More filters <span>3</span></button></section>
    <div className="library-summary"><p><strong>{visible.length} {filter === "Saved on device" ? "saved" : "recommended"} resources</strong><span>{selectedClass ? `Matched to Grades ${selectedClass.grades.join(", ")} · ${selectedClass.subjects.join(", ")} · Agusan del Sur` : "Browse the shared teacher repository"}</span></p><select aria-label="Sort resources"><option>Most relevant</option><option>Highest rated</option><option>Most saved</option></select></div>
    <section className="resource-grid">
      {visible.map((resource) => <article className="library-card" key={resource.id}><div className="library-thumb">{resource.icon}<span>{resource.type}</span></div><div className="library-body"><div className="library-badges">{resource.verified && <span className="verified">✓ Verified</span>}<span>Shared by Teacher Lina</span></div><h2>{resource.title}</h2><p>{resource.grades} · {resource.subject}</p><div className="tags">{resource.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="library-stats"><span>★ {resource.rating}</span><span>{resource.saves} saves</span><span>Updated 2 days ago</span></div><div className="library-actions"><button className="secondary-button" type="button">Preview</button><button className={savedResourceIds.includes(resource.id) ? "saved-button" : "dark-button"} type="button" onClick={() => onToggleSaved(resource.id)}>{savedResourceIds.includes(resource.id) ? "✓ Saved on device" : "Save to device"}</button></div></div></article>)}
    </section>
    {!visible.length && <div className="empty-state"><b>No matching resources yet</b><p>Try a broader keyword or clear one of your filters.</p></div>}
  </div>;
}

function learnersForClass(item: TeachingClass, grade: number) {
  return item.learners.filter((learner) => learner.grade === grade);
}

function learnerCountLabel(count: number) {
  return `${count} ${count === 1 ? "learner" : "learners"}`;
}

function attendanceForClass(item: TeachingClass, attendanceRecords: Record<string, Record<string, string>>) {
  return Object.fromEntries(item.learners.map((learner) => {
    const stored = attendanceRecords[`${item.id}-grade-${learner.grade}`] || {};
    return [learner.id, stored[learner.id] || stored[learner.name] || "Present"];
  }));
}

function AttendanceView({ classes, activeClassId, attendanceRecords, onSave, onSetUpClass }: { classes: TeachingClass[]; activeClassId: string; attendanceRecords: Record<string, Record<string, string>>; onSave: (updates: Record<string, Record<string, string>>) => void; onSetUpClass: () => void }) {
  const [selectedClassId, setSelectedClassId] = useState(activeClassId || classes[0]?.id || "");
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const allLearners = selectedClass ? selectedClass.learners : [];
  const learners = gradeFilter === "all" ? allLearners : allLearners.filter((learner) => learner.grade === gradeFilter);
  const [statuses, setStatuses] = useState<Record<string, string>>(() => selectedClass ? attendanceForClass(selectedClass, attendanceRecords) : {});
  const [saved, setSaved] = useState(false);

  function chooseClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId);
    setSelectedClassId(classId);
    setGradeFilter("all");
    setStatuses(nextClass ? attendanceForClass(nextClass, attendanceRecords) : {});
    setSaved(Boolean(nextClass?.grades.some((grade) => attendanceRecords[`${nextClass.id}-grade-${grade}`])));
  }

  function saveVisibleAttendance() {
    if (!selectedClass) return;
    const updates = Object.fromEntries(selectedClass.grades.map((grade) => {
      const key = `${selectedClass.id}-grade-${grade}`;
      const gradeLearners = learnersForClass(selectedClass, grade);
      return [key, Object.fromEntries(gradeLearners.map((learner) => [learner.id, statuses[learner.id] || "Present"]))];
    }));
    onSave(updates);
    setSaved(true);
  }

  if (!selectedClass) return <section className="class-zero-state compact-zero"><span className="zero-icon">✓</span><p className="eyebrow">RECORD ATTENDANCE</p><h1>Add a class first</h1><p>Attendance uses the classes and grade groups you manage, so there is nothing to record until a class is set up.</p><div><button className="primary-button" type="button" onClick={onSetUpClass}>Set up a class</button></div></section>;

  const counts = learners.reduce<Record<string, number>>((total, learner) => ({ ...total, [statuses[learner.id]]: (total[statuses[learner.id]] || 0) + 1 }), {});
  return <div className="view-page"><PageIntro eyebrow="RECORD · ATTENDANCE" title="Today’s attendance" description={`Monday, August 17 · ${selectedClass.name}`} action={<button className="primary-button" type="button" onClick={saveVisibleAttendance}>{saved ? "✓ Saved on device" : "Save attendance"}</button>} />
    <section className="attendance-class-picker"><label>Class<select value={selectedClassId} onChange={(event) => chooseClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><span>{selectedClass.meetingDays} · starts {selectedClass.startTime}</span></section>
    <div className="attendance-grid"><section className="attendance-main"><div className="attendance-toolbar"><div className="grade-tabs"><button className={gradeFilter === "all" ? "active" : ""} type="button" onClick={() => setGradeFilter("all")}>All students<small>{learnerCountLabel(allLearners.length)}</small></button>{selectedClass.grades.map((item) => { const count = learnersForClass(selectedClass, item).length; return <button className={gradeFilter === item ? "active" : ""} type="button" onClick={() => setGradeFilter(item)} key={item}>Grade {item}<small>{learnerCountLabel(count)}</small></button>; })}</div><button className="text-button" type="button" onClick={() => { setStatuses((current) => ({ ...current, ...Object.fromEntries(learners.map((learner) => [learner.id, "Present"])) })); setSaved(false); }}>Mark {gradeFilter === "all" ? "all" : `Grade ${gradeFilter}`} present</button></div><div className="student-list"><div className="student-head"><span>Learner</span><span>Status</span></div>{learners.map((learner, index) => <div className="student-row" key={learner.id}><div><span className="student-avatar">{learner.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><p><strong>{learner.name}</strong><small>Grade {learner.grade} · LRN •••• {2041 + index}</small></p></div><div className="status-options">{["Present", "Absent", "Late", "Leave"].map((status) => <button className={statuses[learner.id] === status ? `active ${status.toLowerCase()}` : ""} type="button" onClick={() => { setStatuses((current) => ({ ...current, [learner.id]: status })); setSaved(false); }} key={status}>{status}</button>)}</div></div>)}{!learners.length && <div className="attendance-empty"><span>◎</span><p><b>{gradeFilter === "all" ? "No learners added yet" : `No Grade ${gradeFilter} learners yet`}</b><small>Add learner names to {selectedClass.name} and they will appear here automatically.</small></p><button className="secondary-button" type="button" onClick={onSetUpClass}>Edit class roster</button></div>}</div></section><aside className="attendance-summary"><p className="eyebrow">{gradeFilter === "all" ? "ALL STUDENTS" : `GRADE ${gradeFilter}`} SUMMARY</p><h3>{learnerCountLabel(learners.length)}</h3><div className="summary-ring"><strong>{learners.length ? Math.round(((counts.Present || 0) / learners.length) * 100) : 0}%</strong><span>present</span></div>{["Present", "Absent", "Late", "Leave"].map((status) => <div className={`summary-stat ${status.toLowerCase()}`} key={status}><span>{status}</span><strong>{counts[status] || 0}</strong></div>)}<div className="sync-note"><span className="status-dot" /><p><b>Saved locally first</b><small>Records persist on this device and can sync when a connection returns.</small></p></div></aside></div>
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
