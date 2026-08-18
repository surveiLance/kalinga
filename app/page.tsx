"use client";

import { useState } from "react";
import Image from "next/image";

const schedule = [
  { time: "8:00", title: "Shared warm-up", detail: "Fractions around us", tone: "shared" },
  { time: "8:15", title: "Guide Grade 3", detail: "Grades 4–5 work independently", tone: "grade3" },
  { time: "8:40", title: "Guide Grade 4", detail: "Grades 3 & 5 continue activities", tone: "grade4" },
  { time: "9:05", title: "Guide Grade 5", detail: "Grades 3–4 complete checks", tone: "grade5" },
];

type View = "home" | "plan" | "library" | "attendance" | "community";

export default function Home() {
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("home");
  const [hasEntered, setHasEntered] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  function beginPlan() {
    setView("plan");
    setNotice("");
  }

  function signOut() {
    setAccountOpen(false);
    setView("home");
    setNotice("");
    setHasEntered(false);
  }

  if (!hasEntered) {
    return <LoginScreen onContinue={() => setHasEntered(true)} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <button className="brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}>
          <Image src="/kalinga-logo.png" width={180} height={60} alt="Kalinga" priority />
        </button>

        <nav className="nav-list">
          <button className={`nav-item ${view === "home" ? "active" : ""}`} type="button" onClick={() => setView("home")}><span className="nav-icon">⌂</span> Home</button>
          <button className={`nav-item ${view === "plan" ? "active" : ""}`} type="button" onClick={beginPlan}><span className="nav-icon">＋</span> Create</button>
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
          <button className="mobile-brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}><Image src="/kalinga-logo.png" width={116} height={39} alt="Kalinga" priority /></button>
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
          {view === "home" ? <>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">MONDAY · AUGUST 17</p>
              <h1 className="welcome-title"><span>MAGANDANG ARAW,</span><em>Teacher Ana!</em></h1>
              <p className="lead">Your three grade groups are ready for today.</p>
            </div>
            <button className="primary-button" type="button" onClick={beginPlan}><span>＋</span> Plan a multigrade lesson</button>
          </section>

          {notice && <p className="notice" role="status">{notice}</p>}

          <section className="hero-grid">
            <article className="continue-card">
              <div className="card-label-row">
                <span className="pill orange">CONTINUE YOUR WORK</span>
                <span className="saved">● Saved offline</span>
              </div>
              <p className="muted">MATHEMATICS · GRADES 3, 4 & 5</p>
              <h2>Fractions in our surroundings</h2>
              <p>One coordinated lesson with activities adapted for every grade.</p>
              <div className="progress-copy"><strong>Lesson plan progress</strong><span>3 of 4 steps</span></div>
              <div className="progress-track"><span /></div>
              <div className="continue-actions">
                <button className="dark-button" type="button">Continue planning <span>→</span></button>
                <small>Edited 20 minutes ago</small>
              </div>
            </article>

            <article className="class-card">
              <div className="card-heading">
                <div><p className="eyebrow">TODAY’S CLASS</p><h2>One class, three learning paths</h2></div>
                <button className="text-button" type="button">View plan →</button>
              </div>
              <div className="grade-legend" aria-label="Grade color legend">
                <span><i className="g3" /> Grade 3</span><span><i className="g4" /> Grade 4</span><span><i className="g5" /> Grade 5</span>
              </div>
              <div className="timeline">
                {schedule.map((item) => (
                  <div className="timeline-row" key={item.time}>
                    <time>{item.time}</time>
                    <div className={`timeline-event ${item.tone}`}><strong>{item.title}</strong><small>{item.detail}</small></div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="section-block">
            <div className="section-title"><div><p className="eyebrow">QUICK ACTIONS</p><h2>What would you like to do?</h2></div></div>
            <div className="quick-grid">
              <button className="quick-card" type="button" onClick={beginPlan}><span className="quick-icon orange-icon">＋</span><span><strong>Create a lesson</strong><small>Build for multiple grades</small></span><b>→</b></button>
              <button className="quick-card" type="button" onClick={() => setView("attendance")}><span className="quick-icon teal-icon">✓</span><span><strong>Record attendance</strong><small>Mark today’s class</small></span><b>→</b></button>
              <button className="quick-card" type="button" onClick={() => setView("library")}><span className="quick-icon blue-icon">▤</span><span><strong>Find materials</strong><small>Search the shared library</small></span><b>→</b></button>
            </div>
          </section>

          <section className="recommended">
            <div className="section-title inline">
              <div><p className="eyebrow">RECOMMENDED FOR YOUR CLASS</p><h2>Ready-to-use resources</h2></div>
              <button className="text-button" type="button" onClick={() => setView("library")}>Browse library →</button>
            </div>
            <article className="resource-card">
              <div className="resource-thumb">½</div>
              <div className="resource-copy">
                <span className="verified">✓ Verified resource</span><h3>Fractions using local objects</h3><p>Activity sheet · Grades 3–5 · Mathematics</p>
                <div className="tags"><span>Multigrade</span><span>No printer</span><span>Manobo</span></div>
              </div>
              <div className="resource-meta"><span>★ 4.8</span><small>132 teachers saved this</small><button type="button">Save offline</button></div>
            </article>
          </section>
          </> : view === "plan" ? <PlanView onBack={() => setView("home")} /> : view === "library" ? <LibraryView /> : view === "attendance" ? <AttendanceView /> : <CommunityView />}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button className={view === "home" ? "active" : ""} type="button" onClick={() => setView("home")}><span>⌂</span>Home</button><button className={view === "plan" ? "active" : ""} type="button" onClick={beginPlan}><span>＋</span>Create</button><button className={view === "library" ? "active" : ""} type="button" onClick={() => setView("library")}><span>▱</span>Library</button><button className={view === "community" ? "active" : ""} type="button" onClick={() => setView("community")}><span>♧</span>Community</button>
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
      <span className="stacked-logo-symbol" aria-hidden="true">
        <Image src="/kalinga-logo.png" width={600} height={200} alt="" priority />
      </span>
      <span className="stacked-logo-word" aria-hidden="true">kalinga</span>
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

function PlanView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [grades, setGrades] = useState([3, 4, 5]);
  const [subject, setSubject] = useState("Mathematics");
  const [duration, setDuration] = useState("80 minutes");
  const [saved, setSaved] = useState(false);

  function toggleGrade(grade: number) {
    setGrades((current) => current.includes(grade) ? current.filter((item) => item !== grade) : [...current, grade].sort());
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
            <div className="field-group">
              <label>Which grades are learning together?</label>
              <div className="grade-picker">
                {[1, 2, 3, 4, 5, 6].map((grade) => <button className={grades.includes(grade) ? "selected" : ""} type="button" key={grade} onClick={() => toggleGrade(grade)}><span>{grades.includes(grade) ? "✓" : grade}</span>Grade {grade}</button>)}
              </div>
            </div>
            <div className="form-grid">
              <label>Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}><option>Mathematics</option><option>Science</option><option>English</option><option>Filipino</option></select></label>
              <label>Total class time<select value={duration} onChange={(event) => setDuration(event.target.value)}><option>60 minutes</option><option>80 minutes</option><option>100 minutes</option></select></label>
              <label>Language<select><option>English & Filipino</option><option>English</option><option>Filipino</option></select></label>
              <label>Quarter<select><option>Quarter 1</option><option>Quarter 2</option><option>Quarter 3</option><option>Quarter 4</option></select></label>
            </div>
            <div className="field-group">
              <label>What should Kalinga consider?</label>
              <div className="context-pills"><button className="selected" type="button">Multigrade</button><button className="selected" type="button">Low connectivity</button><button type="button">No printing</button><button type="button">Indigenous context</button><button type="button">Limited materials</button></div>
            </div>
          </div>
          <aside className="builder-help"><span>✦</span><h3>Teacher-first assistance</h3><p>Kalinga prepares suggestions from the details you provide. Nothing is final until you review and edit it.</p><div><b>{grades.length}</b><small>grade groups selected</small></div><div><b>{duration}</b><small>total teaching time</small></div></aside>
          <footer className="builder-footer"><span>Draft saves automatically on this device.</span><button className="primary-button" type="button" disabled={!grades.length} onClick={() => setStep(2)}>Choose competencies →</button></footer>
        </section>
      )}

      {step === 2 && (
        <section className="competency-layout">
          <div className="competency-list">
            {grades.map((grade, index) => (
              <article className={`competency-card grade-${grade}`} key={grade}>
                <header><span>GRADE {grade}</span><button type="button">Browse competencies</button></header>
                <label>Learning competency<textarea defaultValue={index === 0 ? "Visualizes and represents fractions that are equal to one and greater than one." : index === 1 ? "Compares and arranges similar fractions in increasing or decreasing order." : "Adds and subtracts simple fractions and mixed numbers without regrouping."} /></label>
                <div className="suggestion"><span>✦ Suggested connection</span><p>Use locally available objects to show how parts combine into a whole.</p><button type="button">Use suggestion</button></div>
              </article>
            ))}
          </div>
          <aside className="overlap-panel"><p className="eyebrow">SHARED OPPORTUNITY</p><h3>Fractions using local objects</h3><p>These competencies can begin with one shared demonstration before each grade moves to an appropriate task.</p><div className="material-list"><span>○ Leaves or bottle caps</span><span>○ Paper strips</span><span>○ Chalkboard</span></div><small>You can still teach the competencies separately.</small></aside>
          <footer className="builder-footer"><button className="secondary-button" type="button" onClick={() => setStep(1)}>← Class context</button><button className="primary-button" type="button" onClick={() => setStep(3)}>Build coordinated plan <span>✦</span></button></footer>
        </section>
      )}

      {step === 3 && (
        <section className="plan-result">
          <div className="result-toolbar"><div><span className="pill orange">DRAFT · EDITABLE</span><b>{subject} · Grades {grades.join(", ")}</b></div><div><button className="secondary-button" type="button" onClick={() => setStep(2)}>Edit inputs</button><button className="primary-button" type="button" onClick={() => setSaved(true)}>{saved ? "✓ Saved offline" : "Save offline"}</button></div></div>
          <div className="plan-title"><div><p className="eyebrow">MULTIGRADE LESSON PLAN</p><h2>Fractions in our surroundings</h2><p>{duration} · Locally available materials · English & Filipino</p></div><button className="icon-button" type="button" aria-label="More lesson actions">···</button></div>
          <div className="rotation-table">
            <div className="rotation-head"><span>Time</span><span>Teacher focus</span>{grades.map((grade) => <span key={grade}>Grade {grade}</span>)}</div>
            <div className="rotation-row"><time>8:00–8:10</time><strong>All grades</strong>{grades.map((grade) => <span className="shared-cell" key={grade}>Shared introduction: fractions around us</span>)}</div>
            {grades.map((focusGrade, row) => <div className="rotation-row" key={focusGrade}><time>{`8:${10 + row * 20}–8:${30 + row * 20}`}</time><strong>Guide Grade {focusGrade}</strong>{grades.map((grade) => <button type="button" key={grade} className={grade === focusGrade ? `focus-cell grade-${grade}` : "independent-cell"}>{grade === focusGrade ? "Guided lesson" : row % 2 ? "Peer activity" : "Independent task"}<small>{grade === focusGrade ? "Teacher-supported" : "Tap to edit"}</small></button>)}</div>)}
            <div className="rotation-row"><time>9:10–9:20</time><strong>All grades</strong>{grades.map((grade) => <span className="shared-cell" key={grade}>Reflection and quick check</span>)}</div>
          </div>
          <div className="plan-notes"><article><span>✦</span><div><b>Assisted adaptation</b><p>Kalinga balanced direct instruction and independent work. Review the timing based on your learners.</p></div></article><button className="text-button" type="button">Regenerate timing only</button></div>
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

function LibraryView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All resources");
  const [saved, setSaved] = useState<number[]>([1]);
  const visible = resources.filter((resource) => `${resource.title} ${resource.subject} ${resource.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All resources" || resource.subject === filter));

  return <div className="view-page">
    <PageIntro eyebrow="SHARED LIBRARY" title="Resources made by teachers" description="Find materials that fit your grades, competencies, and classroom context." action={<button className="primary-button" type="button">↑ Share a resource</button>} />
    <section className="library-tools"><label className="library-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by lesson, competency, keyword, or author" /></label><div className="filter-row">{["All resources", "Mathematics", "Science", "English"].map((item) => <button className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="filter-button" type="button">☷ More filters <span>3</span></button></section>
    <div className="library-summary"><p><strong>{visible.length} recommended resources</strong><span>Matched to Grades 3–5 · Agusan del Sur · low connectivity</span></p><select aria-label="Sort resources"><option>Most relevant</option><option>Highest rated</option><option>Most saved</option></select></div>
    <section className="resource-grid">
      {visible.map((resource) => <article className="library-card" key={resource.id}><div className="library-thumb">{resource.icon}<span>{resource.type}</span></div><div className="library-body"><div className="library-badges">{resource.verified && <span className="verified">✓ Verified</span>}<span>Shared by Teacher Lina</span></div><h2>{resource.title}</h2><p>{resource.grades} · {resource.subject}</p><div className="tags">{resource.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="library-stats"><span>★ {resource.rating}</span><span>{resource.saves} saves</span><span>Updated 2 days ago</span></div><div className="library-actions"><button className="secondary-button" type="button">Preview</button><button className={saved.includes(resource.id) ? "saved-button" : "dark-button"} type="button" onClick={() => setSaved((items) => items.includes(resource.id) ? items.filter((id) => id !== resource.id) : [...items, resource.id])}>{saved.includes(resource.id) ? "✓ Saved offline" : "Save offline"}</button></div></div></article>)}
    </section>
    {!visible.length && <div className="empty-state"><b>No matching resources yet</b><p>Try a broader keyword or clear one of your filters.</p></div>}
  </div>;
}

const learners = ["Angela P. Morales", "Benjie R. Santos", "Carla M. Dela Cruz", "Daryl T. Gomez", "Elaine B. Ramos", "Francis A. Uy"];

function AttendanceView() {
  const [grade, setGrade] = useState(3);
  const [statuses, setStatuses] = useState<Record<string, string>>(() => Object.fromEntries(learners.map((name) => [name, "Present"])));
  const [saved, setSaved] = useState(false);
  const counts = learners.reduce<Record<string, number>>((total, name) => ({ ...total, [statuses[name]]: (total[statuses[name]] || 0) + 1 }), {});
  return <div className="view-page"><PageIntro eyebrow="RECORD · ATTENDANCE" title="Today’s attendance" description="Monday, August 17 · Dinagat Elementary School" action={<button className="primary-button" type="button" onClick={() => setSaved(true)}>{saved ? "✓ Saved on device" : "Save attendance"}</button>} />
    <div className="attendance-grid"><section className="attendance-main"><div className="attendance-toolbar"><div className="grade-tabs">{[3, 4, 5].map((item) => <button className={grade === item ? "active" : ""} type="button" onClick={() => setGrade(item)} key={item}>Grade {item}<small>{6 + item} learners</small></button>)}</div><button className="text-button" type="button">Mark all present</button></div><div className="student-list"><div className="student-head"><span>Learner</span><span>Status</span></div>{learners.map((name, index) => <div className="student-row" key={name}><div><span className="student-avatar">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><p><strong>{name}</strong><small>LRN •••• {2041 + index}</small></p></div><div className="status-options">{["Present", "Absent", "Late", "Leave"].map((status) => <button className={statuses[name] === status ? `active ${status.toLowerCase()}` : ""} type="button" onClick={() => setStatuses((current) => ({ ...current, [name]: status }))} key={status}>{status}</button>)}</div></div>)}</div></section><aside className="attendance-summary"><p className="eyebrow">GRADE {grade} SUMMARY</p><h3>{learners.length} learners</h3><div className="summary-ring"><strong>{Math.round(((counts.Present || 0) / learners.length) * 100)}%</strong><span>present</span></div>{["Present", "Absent", "Late", "Leave"].map((status) => <div className={`summary-stat ${status.toLowerCase()}`} key={status}><span>{status}</span><strong>{counts[status] || 0}</strong></div>)}<div className="sync-note"><span className="status-dot" /><p><b>Safe while offline</b><small>Changes sync when a connection returns.</small></p></div></aside></div>
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
