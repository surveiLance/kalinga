"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askConnectedGabay, isSupabaseConfigured, requestGabayDraft, type GabayDraft, type GabayPageContext } from "@/lib/gabay-ai";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { attendanceStatusLabel, attendanceStatuses, isStoredAttendanceStatus, toStoredAttendanceStatus } from "@/lib/attendance";
import { ilawStages, learnerCountSummary, planHasTeacherContent, planTitleLine, retimeSlots, slotIsWholeClass, slotsTotalMinutes, wholeClassTask, withWholeClassTask } from "@/lib/lesson-plan";
import { commonGradeLevels, gradeLabel, gradeList, normalizeGradeLevel, sortGradeLevels } from "@/lib/grades";
import { createSampleLearners, learnerRosterSummary, learnerSexCounts, normalizeLearnerSex } from "@/lib/learners";
import { daysForPattern, durationMinutes, formatMeetingDays, formatTime, parseTime, toMinutes, weekDays } from "@/lib/schedule";
import { teacherInitials, teacherLabel, teacherMention } from "@/lib/teachers";
import { dateInputValue, displayDate, moveDate } from "@/lib/dates";
import { normalizeClass, normalizeSavedPlan, remoteSchedule } from "@/lib/normalize";
import { decodeCommunityMessage, encodeCommunityMessage } from "@/lib/community-message";
import { isStarterResourceId, legacyWorkspaceKeys, normalizeResourceBookmarkId, workspaceStorageKey, type WorkspaceStorageKey } from "@/lib/workspace-keys";
import type { ClassLearner, ClassMeeting, GradeLevel, LegacySavedPlan, LegacyTeachingClass, PlanSlot, SavedPlan, TeachingClass, TeacherWorkspace, TodayTeachingBlock } from "@/lib/teaching-types";
import { acknowledgePendingWrite, attendanceChanges, canSyncScope, enqueuePendingWrite, failPendingWrite, maxSyncAttempts, pendingCandidates, readPendingWrites, reconcilePendingWrites, retryPendingWrites, startPendingWrite, type PendingChange, type PendingWrite } from "@/lib/pending-writes";

type View = "home" | "classes" | "plan" | "teach" | "library" | "attendance" | "community" | "tutorial";
type EntryMode = "loading" | "signed-out" | "prototype" | "authenticated";
type AuthActionResult = { ok: boolean; message?: string };
type GabayLiveContext = Partial<GabayPageContext> & { view: View };
type AppNotification = { id: string; kind: "reply" | "mention" | "resource"; title: string; body: string; createdAt?: string; view: View; targetId?: string; read?: boolean };
type NotificationRow = { id: string; kind: string; title: string; body: string; discussion_id: string; read_at: string | null; created_at: string };
type TutorialStatus = { step: number; completed: boolean; dismissed: boolean };

type RemoteClassRow = {
  id: string;
  name: string;
  grade_levels: string[];
  subjects: string[];
  schedule: unknown;
};

type RemoteLearnerRow = {
  id: string;
  class_id: string;
  display_name: string;
  grade_level: string;
  sex: string;
};

type RemotePlanRow = {
  id: string;
  class_id: string;
  title: string;
  subject: string | null;
  grade_levels: string[];
  content: unknown;
};

type RemoteAttendanceRow = {
  class_id: string;
  learner_id: string;
  attendance_date: string;
  status: string;
  note: string | null;
};

const commonSubjects = ["Mathematics", "Science", "English", "Filipino", "Araling Panlipunan", "MAPEH", "Edukasyon sa Pagpapakatao", "TLE"];
const gabayPageLabels: Record<View, string> = {
  home: "Today",
  classes: "Classes",
  plan: "Lesson plan",
  teach: "Teaching guide",
  library: "Resources",
  attendance: "Attendance",
  community: "Teacher community",
  tutorial: "Learn Kalinga",
};
const tutorialStepCount = 6;
const emptyTutorialStatus: TutorialStatus = { step: 0, completed: false, dismissed: false };
const notificationResourceCatalog = [
  { id: "starter-math", subject: "Mathematics", title: "Fraction Market with Bottle Caps" },
  { id: "starter-science", subject: "Science", title: "Schoolyard Plant Detectives" },
];
function loadPendingWrites(scope: string) {
  return readPendingWrites<TeachingClass, SavedPlan>(window.localStorage.getItem(workspaceStorageKey(scope, "pending-writes")), scope);
}

function persistPendingWrites(scope: string, queue: PendingWrite<TeachingClass, SavedPlan>[]) {
  window.localStorage.setItem(workspaceStorageKey(scope, "pending-writes"), JSON.stringify(queue));
  return queue;
}

function loadDeviceWorkspace(scope: string): TeacherWorkspace {
  return {
    classes: (JSON.parse(window.localStorage.getItem(workspaceStorageKey(scope, "classes")) || "[]") as LegacyTeachingClass[]).map(normalizeClass),
    plans: (JSON.parse(window.localStorage.getItem(workspaceStorageKey(scope, "plans")) || "[]") as LegacySavedPlan[]).map(normalizeSavedPlan),
    savedResourceIds: (JSON.parse(window.localStorage.getItem(workspaceStorageKey(scope, "saved-resources")) || "[]") as Array<string | number>).map(normalizeResourceBookmarkId).filter(isStarterResourceId),
    attendance: JSON.parse(window.localStorage.getItem(workspaceStorageKey(scope, "attendance")) || "{}"),
    attendanceNotes: JSON.parse(window.localStorage.getItem(workspaceStorageKey(scope, "attendance-notes")) || "{}"),
  };
}

function persistDeviceWorkspace(scope: string, workspace: TeacherWorkspace) {
  window.localStorage.setItem(workspaceStorageKey(scope, "classes"), JSON.stringify(workspace.classes));
  window.localStorage.setItem(workspaceStorageKey(scope, "plans"), JSON.stringify(workspace.plans));
  window.localStorage.setItem(workspaceStorageKey(scope, "attendance"), JSON.stringify(workspace.attendance));
  window.localStorage.setItem(workspaceStorageKey(scope, "attendance-notes"), JSON.stringify(workspace.attendanceNotes));
  window.localStorage.setItem(workspaceStorageKey(scope, "saved-resources"), JSON.stringify(workspace.savedResourceIds));
}

function readTutorialStatus(value: string | null): TutorialStatus {
  if (!value) return emptyTutorialStatus;
  try {
    const status = JSON.parse(value) as Partial<TutorialStatus>;
    return { step: Math.min(tutorialStepCount, Math.max(0, Number(status.step) || 0)), completed: status.completed === true, dismissed: status.dismissed === true };
  } catch {
    return emptyTutorialStatus;
  }
}

function migrateLegacyPrototypeWorkspace() {
  const alreadyMigrated = window.localStorage.getItem("kalinga:prototype:migrated") === "true";
  if (alreadyMigrated) return;
  for (const [key, legacyKey] of Object.entries(legacyWorkspaceKeys) as Array<[WorkspaceStorageKey, string]>) {
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue !== null && window.localStorage.getItem(workspaceStorageKey("prototype", key)) === null) {
      window.localStorage.setItem(workspaceStorageKey("prototype", key), legacyValue);
    }
  }
  window.localStorage.setItem("kalinga:prototype:migrated", "true");
}

async function loadTeacherWorkspace(supabase: SupabaseClient, teacherId: string, signal: AbortSignal): Promise<TeacherWorkspace> {
  const [classResult, learnerResult, planResult, attendanceResult, resourceBookmarkResult] = await Promise.all([
    supabase.from("classes").select("id,name,grade_levels,subjects,schedule").eq("teacher_id", teacherId).order("created_at").abortSignal(signal),
    supabase.from("learners").select("id,class_id,display_name,grade_level,sex").eq("teacher_id", teacherId).order("created_at").abortSignal(signal),
    supabase.from("lesson_plans").select("id,class_id,title,subject,grade_levels,content").eq("teacher_id", teacherId).order("updated_at", { ascending: false }).abortSignal(signal),
    supabase.from("attendance_records").select("class_id,learner_id,attendance_date,status,note").eq("teacher_id", teacherId).abortSignal(signal),
    supabase.from("resource_bookmarks").select("resource_id").eq("teacher_id", teacherId).order("created_at").abortSignal(signal),
  ]);
  const firstError = classResult.error || learnerResult.error || planResult.error || attendanceResult.error || resourceBookmarkResult.error;
  if (firstError) throw firstError;

  const learnerRows = (learnerResult.data || []) as RemoteLearnerRow[];
  const learnersByClass = new Map<string, ClassLearner[]>();
  for (const learner of learnerRows) {
    const current = learnersByClass.get(learner.class_id) || [];
    current.push({ id: learner.id, name: learner.display_name, grade: normalizeGradeLevel(learner.grade_level), sex: normalizeLearnerSex(learner.sex) });
    learnersByClass.set(learner.class_id, current);
  }

  const classes = ((classResult.data || []) as RemoteClassRow[]).map((row) => {
    const schedule = remoteSchedule(row.schedule);
    return normalizeClass({
      id: row.id,
      name: row.name,
      grades: row.grade_levels,
      subjects: row.subjects,
      quarter: schedule.quarter,
      meetings: schedule.meetings as Array<Partial<ClassMeeting>>,
      learners: learnersByClass.get(row.id) || [],
    });
  });

  const plans = ((planResult.data || []) as RemotePlanRow[]).map((row) => {
    const content = row.content && typeof row.content === "object" ? row.content as Partial<SavedPlan> : {};
    return normalizeSavedPlan({
      ...content,
      id: row.id,
      classId: row.class_id,
      title: row.title,
      subject: row.subject || content.subject || "",
      quarter: content.quarter || "Quarter 1",
      grades: row.grade_levels,
      duration: content.duration || "60 minutes",
      slots: Array.isArray(content.slots) ? content.slots : [],
      savedAt: content.savedAt || "saved online",
    });
  });

  const learnerGrades = new Map(learnerRows.map((learner) => [learner.id, normalizeGradeLevel(learner.grade_level)]));
  const attendance: Record<string, Record<string, string>> = {};
  const attendanceNotes: Record<string, Record<string, string>> = {};
  for (const row of (attendanceResult.data || []) as RemoteAttendanceRow[]) {
    const grade = learnerGrades.get(row.learner_id);
    if (!grade) continue;
    const key = `${row.class_id}-${row.attendance_date}-grade-${grade}`;
    attendance[key] = { ...(attendance[key] || {}), [row.learner_id]: attendanceStatusLabel(row.status) };
    if (row.note) attendanceNotes[key] = { ...(attendanceNotes[key] || {}), [row.learner_id]: row.note };
  }
  const savedResourceIds = (resourceBookmarkResult.data || []).map((bookmark) => normalizeResourceBookmarkId(bookmark.resource_id)).filter(isStarterResourceId);
  return { classes, plans, savedResourceIds, attendance, attendanceNotes };
}

async function saveClassToCloud(supabase: SupabaseClient, teacherId: string, item: TeachingClass, signal: AbortSignal, checkSession: () => void) {
  checkSession();
  const { error: classError } = await supabase.from("classes").upsert({
    id: item.id,
    teacher_id: teacherId,
    name: item.name,
    grade_levels: item.grades,
    subjects: item.subjects,
    schedule: { quarter: item.quarter, meetings: item.meetings },
  }).abortSignal(signal);
  if (classError) throw classError;

  checkSession();
  const { data: existingLearners, error: learnerReadError } = await supabase.from("learners").select("id").eq("teacher_id", teacherId).eq("class_id", item.id).abortSignal(signal);
  if (learnerReadError) throw learnerReadError;
  const learnerIds = new Set(item.learners.map((learner) => learner.id));
  const removedLearnerIds = (existingLearners || []).map((learner) => learner.id as string).filter((id) => !learnerIds.has(id));
  if (removedLearnerIds.length) {
    checkSession();
    const { error } = await supabase.from("learners").delete().eq("teacher_id", teacherId).in("id", removedLearnerIds).abortSignal(signal);
    if (error) throw error;
  }
  if (item.learners.length) {
    checkSession();
    const { error } = await supabase.from("learners").upsert(item.learners.map((learner) => ({
      id: learner.id,
      class_id: item.id,
      teacher_id: teacherId,
      display_name: learner.name,
      grade_level: learner.grade,
      sex: learner.sex,
    }))).abortSignal(signal);
    if (error) throw error;
  }
}

async function savePlanToCloud(supabase: SupabaseClient, teacherId: string, plan: SavedPlan, signal: AbortSignal) {
  const { error } = await supabase.from("lesson_plans").upsert({
    id: plan.id,
    class_id: plan.classId,
    teacher_id: teacherId,
    title: plan.title,
    subject: plan.subject,
    grade_levels: plan.grades,
    status: "draft",
    content: plan,
  }).abortSignal(signal);
  if (error) throw error;
}

async function saveAttendanceToCloud(
  supabase: SupabaseClient,
  teacherId: string,
  classes: Pick<TeachingClass, "id">[],
  updates: Record<string, Record<string, string>>,
  noteUpdates: Record<string, Record<string, string>>,
  signal: AbortSignal,
) {
  const classIds = new Set(classes.map((item) => item.id));
  const rows = Object.entries(updates).flatMap(([key, learnerStatuses]) => {
    const match = key.match(/^(.*)-(\d{4}-\d{2}-\d{2})-grade-(.+)$/);
    if (!match || !classIds.has(match[1])) return [];
    const [, classId, attendanceDate] = match;
    return Object.entries(learnerStatuses).flatMap(([learnerId, value]) => {
      const status = toStoredAttendanceStatus(value);
      if (!isStoredAttendanceStatus(status)) return [];
      return [{
        class_id: classId,
        learner_id: learnerId,
        teacher_id: teacherId,
        attendance_date: attendanceDate,
        status,
        note: noteUpdates[key]?.[learnerId]?.trim() || null,
      }];
    });
  });
  if (!rows.length) throw new Error("No valid attendance records to sync.");
  const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "learner_id,attendance_date" }).abortSignal(signal);
  if (error) throw error;
}

function copySampleClass() {
  return {
    ...sampleClass,
    id: crypto.randomUUID(),
    meetings: sampleClass.meetings.map((meeting) => ({ ...meeting, id: crypto.randomUUID() })),
    learners: sampleClass.learners.map((learner) => ({ ...learner, id: crypto.randomUUID() })),
  };
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

function notificationFromRow(row: NotificationRow): AppNotification {
  return {
    id: String(row.id),
    kind: row.kind === "mention" ? "mention" : "reply",
    title: String(row.title),
    body: String(row.body || "Teacher discussion"),
    createdAt: String(row.created_at),
    view: "community",
    targetId: String(row.discussion_id),
    read: Boolean(row.read_at),
  };
}

export default function Home() {
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("home");
  const [entryMode, setEntryMode] = useState<EntryMode>(isSupabaseConfigured ? "loading" : "signed-out");
  const [accountOpen, setAccountOpen] = useState(false);
  const [gabayOpen, setGabayOpen] = useState(false);
  const [gabayMotion, setGabayMotion] = useState(true);
  const [gabayEventMessage, setGabayEventMessage] = useState("");
  const [gabayLiveContext, setGabayLiveContext] = useState<GabayLiveContext>({ view: "home" });
  const [classes, setClasses] = useState<TeachingClass[]>([]);
  const [activeClassId, setActiveClassId] = useState("");
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savedResourceIds, setSavedResourceIds] = useState<string[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, Record<string, string>>>({});
  const [attendanceNotes, setAttendanceNotes] = useState<Record<string, Record<string, string>>>({});
  const [editingPlanId, setEditingPlanId] = useState("");
  const [classDataReady, setClassDataReady] = useState(false);
  const [hydratedWorkspaceScope, setHydratedWorkspaceScope] = useState("");
  const [teacherAccountId, setTeacherAccountId] = useState("");
  const [teacherName, setTeacherName] = useState("Ana");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [authWelcomeMessage, setAuthWelcomeMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [replyNotifications, setReplyNotifications] = useState<AppNotification[]>([]);
  const [notificationReadIds, setNotificationReadIds] = useState<string[]>([]);
  const [communityTargetId, setCommunityTargetId] = useState("");
  const [communityResourceId, setCommunityResourceId] = useState("");
  const [pendingWrites, setPendingWrites] = useState<PendingWrite<TeachingClass, SavedPlan>[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [tutorialStatus, setTutorialStatus] = useState<TutorialStatus>(emptyTutorialStatus);
  const [tutorialStatusKnown, setTutorialStatusKnown] = useState(false);
  const [tutorialStatusReady, setTutorialStatusReady] = useState(false);
  const sessionTeacherId = useRef("");
  const wakeSync = useRef<(refresh?: boolean) => void>(() => {});
  const syncRun = useRef<Promise<void> | null>(null);
  const workspaceScope = entryMode === "authenticated" && teacherAccountId
    ? `teacher-${teacherAccountId}`
    : entryMode === "prototype"
      ? "prototype"
      : "";

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;

    function applyTeacherAccount(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
      sessionTeacherId.current = user.id;
      const displayName = typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : user.email?.split("@")[0] || "Teacher";
      setTeacherName(displayName);
      setTeacherEmail(user.email || "");
      setTeacherAccountId(user.id);
      setEntryMode("authenticated");
      window.setTimeout(() => wakeSync.current(true), 0);
      if (new URLSearchParams(window.location.search).get("confirmed") === "1") {
        setAuthWelcomeMessage("Email confirmed—welcome to Kalinga. Your teacher workspace is ready.");
        setView("home");
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) applyTeacherAccount(data.session.user);
      else {
        sessionTeacherId.current = "";
        setTeacherAccountId("");
        setEntryMode((current) => current === "prototype" ? current : "signed-out");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) applyTeacherAccount(session.user);
      else {
        sessionTeacherId.current = "";
        setTeacherAccountId("");
        setEntryMode((current) => current === "prototype" ? current : "signed-out");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function updateConnection() {
      setOnline(navigator.onLine);
      if (navigator.onLine) wakeSync.current(true);
    }
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (entryMode !== "authenticated" || !teacherAccountId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    void supabase.from("profiles").select("school_name").eq("id", teacherAccountId).maybeSingle().then(({ data }) => {
      const remote = typeof data?.school_name === "string" ? data.school_name.trim() : "";
      // Never clobber something the teacher typed while this was in flight.
      if (active && remote) setSchoolName((current) => current.trim() ? current : remote);
    });
    return () => { active = false; };
  }, [entryMode, teacherAccountId]);

  useEffect(() => {
    if (!workspaceScope) return;
    const hydrationTimer = window.setTimeout(() => {
      setClassDataReady(false);
      setHydratedWorkspaceScope("");
      setClasses([]);
      setActiveClassId("");
      setSavedPlans([]);
      setSavedResourceIds([]);
      setAttendanceRecords({});
      setAttendanceNotes({});
      setEditingPlanId("");
      setNotice("");
      setGabayEventMessage("");
      setPendingWrites([]);
      setStorageError("");
      setCloudLoaded(false);
      setSyncing(false);
      setTutorialStatus(emptyTutorialStatus);
      setTutorialStatusKnown(false);
      setTutorialStatusReady(false);

      try {
        if (workspaceScope === "prototype") migrateLegacyPrototypeWorkspace();
        const storedActiveClass = window.localStorage.getItem(workspaceStorageKey(workspaceScope, "active-class"));
        const storedTeacherName = window.localStorage.getItem(workspaceStorageKey(workspaceScope, "teacher-name"));
        const storedTeacherEmail = window.localStorage.getItem(workspaceStorageKey(workspaceScope, "teacher-email"));
        const storedSchoolName = window.localStorage.getItem(workspaceStorageKey(workspaceScope, "school-name"));
        const storedGabayMotion = window.localStorage.getItem(workspaceStorageKey(workspaceScope, "gabay-motion"));
        const storedTutorialStatus = window.localStorage.getItem(workspaceStorageKey(workspaceScope, "tutorial-status"));
        const queue = loadPendingWrites(workspaceScope);
        const workspace = reconcilePendingWrites(loadDeviceWorkspace(workspaceScope), queue, workspaceScope);
        setPendingWrites(queue);
        setClasses(workspace.classes);
        setActiveClassId(workspace.classes.some((item) => item.id === storedActiveClass) ? storedActiveClass! : workspace.classes[0]?.id || "");
        setSavedPlans(workspace.plans);
        setSavedResourceIds(workspace.savedResourceIds);
        setAttendanceRecords(workspace.attendance);
        setAttendanceNotes(workspace.attendanceNotes);
        if (workspaceScope === "prototype" && storedTeacherName) setTeacherName(storedTeacherName);
        if (workspaceScope === "prototype" && storedTeacherEmail) setTeacherEmail(storedTeacherEmail);
        setSchoolName(storedSchoolName || "");
        if (storedGabayMotion) setGabayMotion(storedGabayMotion !== "false");
        setTutorialStatus(readTutorialStatus(storedTutorialStatus));
        setTutorialStatusKnown(storedTutorialStatus !== null);
      } catch {
        setStorageError("This device’s saved work could not be read. Sync is paused to protect it. Do not clear browser storage; reload after checking device storage.");
      } finally {
        setTutorialStatusReady(true);
        setHydratedWorkspaceScope(workspaceScope);
        setClassDataReady(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, [workspaceScope]);

  useEffect(() => {
    if (!classDataReady || !workspaceScope || hydratedWorkspaceScope !== workspaceScope || storageError) return;
    try {
      persistDeviceWorkspace(workspaceScope, { classes, plans: savedPlans, savedResourceIds, attendance: attendanceRecords, attendanceNotes });
      window.localStorage.setItem(workspaceStorageKey(workspaceScope, "active-class"), activeClassId);
      window.localStorage.setItem(workspaceStorageKey(workspaceScope, "teacher-name"), teacherName);
      window.localStorage.setItem(workspaceStorageKey(workspaceScope, "teacher-email"), teacherEmail);
      window.localStorage.setItem(workspaceStorageKey(workspaceScope, "school-name"), schoolName);
      window.localStorage.setItem(workspaceStorageKey(workspaceScope, "gabay-motion"), String(gabayMotion));
    } catch {
      // Only reached when device storage rejects the write, so this reports a failure rather than cascading renders.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError("Device storage could not save your work. Keep this page open and free some space before retrying.");
    }
  }, [classes, activeClassId, savedPlans, savedResourceIds, attendanceRecords, attendanceNotes, teacherName, teacherEmail, schoolName, gabayMotion, classDataReady, hydratedWorkspaceScope, workspaceScope, storageError]);

  useEffect(() => {
    if (entryMode !== "authenticated" || !canSyncScope(workspaceScope, teacherAccountId) || hydratedWorkspaceScope !== workspaceScope || storageError) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    let running = false;
    let requested = false;
    let loadRequested = true;
    let timer: number | undefined;
    let controller: AbortController | undefined;

    function currentSession() {
      return active && canSyncScope(workspaceScope, sessionTeacherId.current);
    }

    function checkSession() {
      if (!currentSession()) throw new Error("The teacher session changed.");
    }

    async function syncWorkspace() {
      while (currentSession() && navigator.onLine) {
        let queue = loadPendingWrites(workspaceScope);
        if (loadRequested) {
          loadRequested = false;
          controller = new AbortController();
          const timeout = window.setTimeout(() => controller?.abort(), 30_000);
          let remote: TeacherWorkspace | undefined;
          try {
            remote = await loadTeacherWorkspace(supabase!, teacherAccountId, controller.signal);
          } catch {
            if (currentSession()) setNotice("The cloud workspace could not refresh. Your device copy and pending changes are being kept.");
          } finally {
            window.clearTimeout(timeout);
          }
          if (!currentSession()) return;
          queue = loadPendingWrites(workspaceScope);
          if (remote) {
            const workspace = reconcilePendingWrites(remote, queue, workspaceScope);
            persistDeviceWorkspace(workspaceScope, workspace);
            setClasses(workspace.classes);
            setActiveClassId((current) => workspace.classes.some((item) => item.id === current) ? current : workspace.classes[0]?.id || "");
            setSavedPlans(workspace.plans);
            setSavedResourceIds(workspace.savedResourceIds);
            setAttendanceRecords(workspace.attendance);
            setAttendanceNotes(workspace.attendanceNotes);
            setCloudLoaded(true);
          }
        }
        setPendingWrites(queue);
        const candidates = pendingCandidates(queue, workspaceScope);
        const item = candidates.find((entry) => entry.nextAttemptAt <= Date.now());
        if (!item) {
          if (candidates.length) timer = window.setTimeout(() => wake(), Math.max(0, Math.min(...candidates.map((entry) => entry.nextAttemptAt)) - Date.now()));
          return;
        }
        const { data, error } = await supabase!.auth.getSession();
        if (!currentSession() || error || !canSyncScope(workspaceScope, data.session?.user.id || "") || !navigator.onLine) return;
        queue = loadPendingWrites(workspaceScope);
        if (!queue.some((entry) => entry.id === item.id)) continue;
        setPendingWrites(persistPendingWrites(workspaceScope, startPendingWrite(queue, workspaceScope, item.id, Date.now())));
        controller = new AbortController();
        const timeout = window.setTimeout(() => controller?.abort(), 30_000);
        let failed = false;
        try {
          checkSession();
          if (item.kind === "class") await saveClassToCloud(supabase!, teacherAccountId, item.value, controller.signal, checkSession);
          if (item.kind === "plan") await savePlanToCloud(supabase!, teacherAccountId, item.value, controller.signal);
          if (item.kind === "delete-class") {
            const { error } = await supabase!.from("classes").delete().eq("teacher_id", teacherAccountId).eq("id", item.classId).abortSignal(controller.signal);
            if (error) throw error;
          }
          if (item.kind === "attendance") {
            const updates: Record<string, Record<string, string>> = {};
            const notes: Record<string, Record<string, string>> = {};
            for (const row of item.records) {
              const key = `${item.classId}-${item.date}-grade-${row.grade}`;
              updates[key] = { ...updates[key], [row.learnerId]: row.status };
              notes[key] = { ...notes[key], [row.learnerId]: row.note };
            }
            await saveAttendanceToCloud(supabase!, teacherAccountId, [{ id: item.classId }], updates, notes, controller.signal);
          }
        } catch {
          failed = true;
        } finally {
          window.clearTimeout(timeout);
        }
        if (!currentSession()) return;
        queue = loadPendingWrites(workspaceScope);
        if (failed) {
          setPendingWrites(persistPendingWrites(workspaceScope, failPendingWrite(queue, workspaceScope, item.id, "The cloud rejected this change or could not be reached.")));
        } else {
          persistDeviceWorkspace(workspaceScope, reconcilePendingWrites(loadDeviceWorkspace(workspaceScope), [item, ...queue], workspaceScope));
          setPendingWrites(persistPendingWrites(workspaceScope, acknowledgePendingWrite(queue, workspaceScope, item.id)));
        }
      }
    }

    function wake(refresh = false) {
      if (!currentSession()) return;
      if (refresh) loadRequested = true;
      window.clearTimeout(timer);
      if (running) { requested = true; return; }
      running = true;
      requested = false;
      const previous = syncRun.current;
      const task = (async () => {
        await previous;
        if (!currentSession() || !navigator.onLine) return;
        setSyncing(true);
        if (navigator.locks) await navigator.locks.request(workspaceStorageKey(workspaceScope, "pending-writes"), syncWorkspace);
        else await syncWorkspace();
      })().catch(() => {
        if (currentSession()) setStorageError("Sync paused because device storage could not be read or updated. Your pending changes have not been discarded. Keep this page open and check device storage.");
      }).finally(() => {
        running = false;
        if (!currentSession()) return;
        setSyncing(false);
        if (requested) wake();
      });
      syncRun.current = task;
    }

    function storageChanged(event: StorageEvent) {
      if (event.key === workspaceStorageKey(workspaceScope, "pending-writes")) wake(true);
    }

    wakeSync.current = wake;
    wake();
    window.addEventListener("storage", storageChanged);
    return () => {
      active = false;
      controller?.abort();
      window.clearTimeout(timer);
      window.removeEventListener("storage", storageChanged);
      wakeSync.current = () => {};
    };
  }, [entryMode, hydratedWorkspaceScope, teacherAccountId, workspaceScope, storageError]);

  useEffect(() => {
    if (entryMode !== "authenticated" || !teacherAccountId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;

    async function loadNotifications() {
      const [notificationResult, readResult] = await Promise.all([
        supabase!.from("teacher_notifications").select("id,kind,title,body,discussion_id,read_at,created_at").eq("teacher_id", teacherAccountId).order("created_at", { ascending: false }).limit(40),
        supabase!.from("notification_reads").select("notification_id").eq("teacher_id", teacherAccountId),
      ]);
      if (!active) return;
      const localReadIds = readResult.error ? [] : (readResult.data || []).map((row) => String(row.notification_id));
      if (notificationResult.error) {
        setReplyNotifications([]);
        setNotificationReadIds(localReadIds);
        return;
      }
      const rows = (notificationResult.data || []).map(notificationFromRow);
      setReplyNotifications(rows);
      setNotificationReadIds([...new Set([...localReadIds, ...rows.filter((row) => row.read).map((row) => row.id)])]);
    }

    void loadNotifications();
    const channel = supabase.channel(`notifications-${teacherAccountId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "teacher_notifications", filter: `teacher_id=eq.${teacherAccountId}` }, (payload) => {
        if (!active) return;
        const item = notificationFromRow(payload.new as NotificationRow);
        setReplyNotifications((current) => current.some((entry) => entry.id === item.id) ? current : [item, ...current].slice(0, 40));
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [entryMode, teacherAccountId]);

  useEffect(() => {
    if (!gabayOpen) return;
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setGabayOpen(false);
    }
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [gabayOpen]);

  const activeClass = classes.find((item) => item.id === activeClassId) || classes[0];
  const resourceNotifications: AppNotification[] = entryMode === "authenticated" && activeClass
    ? notificationResourceCatalog.filter((resource) => activeClass.subjects.includes(resource.subject) && !savedResourceIds.includes(resource.id)).map((resource) => ({
      id: `resource:${activeClass.id}:${resource.id}`,
      kind: "resource" as const,
      title: `New match for ${activeClass.name}`,
      body: `${resource.title} · ${resource.subject}`,
      view: "library" as const,
    }))
    : [];
  const notifications = entryMode === "authenticated" ? [...replyNotifications, ...resourceNotifications] : [];
  const unreadNotifications = notifications.filter((item) => !notificationReadIds.includes(item.id));
  const blockedWrites = pendingWrites.filter((item) => item.attempts >= maxSyncAttempts);
  const syncState = storageError ? "blocked"
    : entryMode !== "authenticated" ? "device"
      : blockedWrites.length ? "blocked"
        : !online ? "offline"
          : syncing ? "syncing"
            : pendingWrites.length ? "waiting"
              : cloudLoaded ? "synced" : "device";
  const syncLabel = {
    blocked: `${blockedWrites.length || "Some"} ${blockedWrites.length === 1 ? "change needs" : "changes need"} attention`,
    device: "Saved on this device",
    offline: `Offline · ${pendingWrites.length} waiting`,
    syncing: "Syncing…",
    waiting: `${pendingWrites.length} waiting to sync`,
    synced: "All work synced",
  }[syncState];
  const showTutorialOffer = tutorialStatusReady && !tutorialStatusKnown && view !== "tutorial" && classes.length === 0 && savedPlans.length === 0 && (entryMode === "prototype" || cloudLoaded);
  const today = dateInputValue();
  const activePlans = savedPlans.filter((item) => item.classId === activeClass?.id);
  const latestPlan = activePlans[0];
  const teachingPlan = savedPlans.find((item) => item.id === editingPlanId);
  const activeAttendance = activeClass
    ? Object.entries(attendanceRecords).filter(([key]) => key.startsWith(`${activeClass.id}-${today}-grade-`) || key.startsWith(`${activeClass.id}-grade-`)).flatMap(([, records]) => Object.values(records))
    : [];
  const currentWeekday = weekDays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayTeachingBlocks: TodayTeachingBlock[] = classes
    .flatMap((item) => item.meetings
      .filter((meeting) => daysForPattern(meeting.days).includes(currentWeekday))
      .map((meeting) => ({ classId: item.id, className: item.name, grades: item.grades, meeting })))
    .sort((a, b) => toMinutes(a.meeting.startTime) - toMinutes(b.meeting.startTime));
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextTeachingBlock = todayTeachingBlocks.find((block) => toMinutes(block.meeting.startTime) + block.meeting.durationMinutes >= nowMinutes);
  const todayClassIds = [...new Set(todayTeachingBlocks.map((block) => block.classId))];
  const missingPlanCount = todayClassIds.filter((classId) => !savedPlans.some((plan) => plan.classId === classId)).length;
  const attendanceSavedCount = todayClassIds.filter((classId) => Object.keys(attendanceRecords).some((key) => key.startsWith(`${classId}-${today}-grade-`))).length;
  const livePageContext = gabayLiveContext.view === view ? gabayLiveContext : {};
  const pageActions: Record<View, string[]> = {
    home: activeClass ? ["Open today’s class", "Plan a lesson", "Take attendance", "Find a resource"] : ["Set up the first class", "Preview sample data"],
    classes: activeClass ? ["Manage learners", "Edit meeting times", "Create a lesson", "Take attendance"] : ["Set up the first class"],
    plan: ["Choose a class", "Continue the lesson plan", "Review incomplete ILAW sections", "Save the lesson"],
    teach: ["Move through the teaching blocks", "Review grade tasks", "Check learning intentions", "Open attendance"],
    library: ["Open a ready-to-use PDF", "Filter by subject", "Discuss a resource with teachers", "Share a resource"],
    attendance: ["Change the attendance date", "Filter by grade", "Mark learners present", "Save attendance"],
    community: ["Start a discussion", "Ask a clearer question", "Reply to another teacher"],
    tutorial: ["Complete the current practice mission", "Explain this feature", "Repeat a tutorial step", "Return to the real workspace"],
  };
  const gabayPageContext: GabayPageContext = {
    view,
    teacherName,
    classId: activeClass?.id,
    className: activeClass?.name,
    gradeLevels: activeClass?.grades || [],
    subjects: activeClass?.subjects || [],
    learnerCount: activeClass?.learners.length || 0,
    scheduleSummary: activeClass?.meetings.map((meeting) => `${meeting.label}: ${meeting.days} at ${meeting.startTime} for ${meeting.durationMinutes} minutes`) || [],
    subject: latestPlan?.subject || activeClass?.subjects[0],
    lessonTopic: latestPlan?.title,
    lessonDuration: latestPlan?.duration,
    currentSummary: view === "home" ? [
      `${todayTeachingBlocks.length} class blocks scheduled today`,
      `${missingPlanCount} scheduled classes still need a lesson plan`,
      `${attendanceSavedCount} scheduled classes have attendance saved today`,
      nextTeachingBlock ? `Next class: ${nextTeachingBlock.className} at ${nextTeachingBlock.meeting.startTime}` : "No later scheduled class remains today",
    ] : [],
    availableActions: pageActions[view],
    offline: typeof navigator !== "undefined" && !navigator.onLine,
    ...livePageContext,
  };
  gabayPageContext.currentSummary = [
    `Teacher account has ${classes.length} classes and ${savedPlans.length} saved lesson plans; 2 starter PDF resources are available`,
    ...classes.slice(0, 12).map((item) => `${item.name}: ${gradeList(item.grades)}; ${item.subjects.join(", ")}; ${item.learners.length} learners`),
    ...(gabayPageContext.currentSummary || []),
  ];
  function beginPlan(planId?: string) {
    setEditingPlanId(typeof planId === "string" ? planId : "");
    setView("plan");
    setNotice("");
  }

  function openTeachingPlan(planId: string) {
    const plan = savedPlans.find((item) => item.id === planId);
    if (!plan) return;
    setEditingPlanId(plan.id);
    setActiveClassId(plan.classId);
    setView("teach");
    setNotice("");
  }

  function saveTutorialProgress(status: TutorialStatus) {
    setTutorialStatus(status);
    setTutorialStatusKnown(true);
    try {
      window.localStorage.setItem(workspaceStorageKey(workspaceScope, "tutorial-status"), JSON.stringify(status));
    } catch {
      setNotice("Tutorial progress could not be saved on this device, but you can continue while this page stays open.");
    }
  }

  function openTutorial() {
    if (!tutorialStatusKnown) saveTutorialProgress(emptyTutorialStatus);
    setView("tutorial");
    setGabayOpen(false);
    setAccountOpen(false);
  }

  function markNotificationsRead(ids: string[]) {
    const newIds = ids.filter((id) => !notificationReadIds.includes(id));
    if (!newIds.length) return;
    setNotificationReadIds((current) => [...new Set([...current, ...newIds])]);
    const supabase = getSupabaseBrowserClient();
    if (entryMode !== "authenticated" || !teacherAccountId || !supabase) return;
    function reportUnsynced({ error }: { error: unknown }) {
      if (error) setNotice("Notifications were read on this device, but could not sync yet.");
    }
    // Server-derived notifications carry their read state on the row itself; the
    // resource matches are derived in the browser and have no row to update.
    const serverIds = newIds.filter((id) => replyNotifications.some((item) => item.id === id));
    const localIds = newIds.filter((id) => !serverIds.includes(id));
    if (serverIds.length) {
      void supabase.from("teacher_notifications").update({ read_at: new Date().toISOString() }).eq("teacher_id", teacherAccountId).in("id", serverIds).then(reportUnsynced);
    }
    if (localIds.length) {
      void supabase.from("notification_reads").upsert(localIds.map((notificationId) => ({ teacher_id: teacherAccountId, notification_id: notificationId }))).then(reportUnsynced);
    }
  }

  function openNotification(item: AppNotification) {
    markNotificationsRead([item.id]);
    setNotificationsOpen(false);
    if (item.view === "community") setCommunityTargetId(item.targetId || "");
    setView(item.view);
  }

  async function signOut() {
    setAccountOpen(false);
    setView("home");
    setNotice("");
    setAuthWelcomeMessage("");
    setNotificationsOpen(false);
    setReplyNotifications([]);
    setNotificationReadIds([]);
    if (entryMode === "authenticated") {
      await getSupabaseBrowserClient()?.auth.signOut();
    }
    setTeacherAccountId("");
    setEntryMode("signed-out");
  }

  async function signInTeacher(email: string, password: string): Promise<AuthActionResult> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { ok: false, message: "Supabase is not configured on this device yet." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "We could not open this teacher account." };
    return { ok: true };
  }

  async function createTeacherAccount(name: string, email: string, password: string): Promise<AuthActionResult> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { ok: false, message: "Supabase is not configured on this device yet." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/?confirmed=1`,
      },
    });
    if (error) return { ok: false, message: error.message };
    if (!data.session) return { ok: true, message: "Check your email and tap Confirm. Kalinga will bring you straight into your teacher workspace." };
    return { ok: true };
  }

  function queueChanges(changes: PendingChange<TeachingClass, SavedPlan>[], offlineNotice: string) {
    if (entryMode !== "authenticated" || !canSyncScope(workspaceScope, teacherAccountId) || storageError || !changes.length) return;
    try {
      const queue = changes.reduce((current, change) => enqueuePendingWrite(current, workspaceScope, change, crypto.randomUUID(), Date.now()), loadPendingWrites(workspaceScope));
      setPendingWrites(persistPendingWrites(workspaceScope, queue));
    } catch {
      setStorageError("This change could not be queued for sync because device storage is unavailable. Keep this page open and free some space before editing again.");
      return;
    }
    if (!navigator.onLine) setNotice(offlineNotice);
    wakeSync.current();
  }

  function retrySync() {
    if (entryMode !== "authenticated" || !canSyncScope(workspaceScope, teacherAccountId) || storageError) return;
    try {
      setPendingWrites(persistPendingWrites(workspaceScope, retryPendingWrites(loadPendingWrites(workspaceScope), workspaceScope, Date.now())));
    } catch {
      setStorageError("Pending changes could not be read from device storage. They have not been discarded. Keep this page open and check device storage.");
      return;
    }
    setNotice("");
    wakeSync.current(true);
  }

  function saveClass(newClass: Omit<TeachingClass, "id">, classId?: string) {
    const item = { ...newClass, id: classId || crypto.randomUUID() };
    setClasses((current) => classId ? current.map((entry) => entry.id === classId ? item : entry) : [...current, item]);
    setActiveClassId(item.id);
    setView("classes");
    setNotice(`${item.name} ${classId ? "was updated" : "is ready"} across planning, attendance, and resources.`);
    setGabayEventMessage(classId ? `Updated na ang ${item.name}. Ginagamit na rin ang changes sa planning at attendance.` : `Handa na ang ${item.name}! Saved na ang roster at schedule para hindi mo na ulit i-encode.`);
    queueChanges([{ kind: "class", classId: item.id, value: item }], `${item.name} is saved on this device and will sync when your connection returns.`);
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
    setGabayEventMessage(`Tinanggal na ang ${removedClass?.name || "class"} at ang connected local records nito.`);
    queueChanges([{ kind: "delete-class", classId }], `${removedClass?.name || "Class"} was removed on this device. The cloud copy is deleted when your connection returns.`);
  }

  function loadSampleClass() {
    const sample = copySampleClass();
    setClasses([sample]);
    setActiveClassId(sample.id);
    setView("classes");
    setNotice("Sample school data loaded. You can edit or add classes anytime.");
    setGabayEventMessage("Sample class loaded. Puwede mo itong galawin para makita ang buong workflow.");
    queueChanges([{ kind: "class", classId: sample.id, value: sample }], "The sample class is saved on this device and will sync when your connection returns.");
  }

  function updateSchoolName(name: string) {
    setSchoolName(name);
    const supabase = getSupabaseBrowserClient();
    if (entryMode === "authenticated" && teacherAccountId && supabase) {
      void supabase.from("profiles").upsert({ id: teacherAccountId, school_name: name.trim() || null }).then(({ error }) => {
        if (error) setNotice("Your school name is saved on this device, but could not sync yet.");
      });
    }
  }

  function savePlan(plan: SavedPlan) {
    setSavedPlans((current) => [plan, ...current.filter((item) => item.id !== plan.id)]);
    // Not setEditingPlanId: that id is part of the planner's key, and changing it
    // mid-edit remounts the planner and throws the teacher back to the first tab.
    // Navigation into a plan (beginPlan, openTeachingPlan) sets it instead.
    setNotice(`${plan.title} was saved under ${classes.find((item) => item.id === plan.classId)?.name || "your class"}.`);
    setGabayEventMessage(`Saved ang “${plan.title}.” Nasa class workspace na ito at puwedeng balikan offline.`);
    queueChanges([{ kind: "plan", classId: plan.classId, value: plan }], `${plan.title} is saved on this device and will sync when your connection returns.`);
  }

  function saveAttendance(updates: Record<string, Record<string, string>>, noteUpdates: Record<string, Record<string, string>>) {
    setAttendanceRecords((current) => ({ ...current, ...updates }));
    setAttendanceNotes((current) => ({ ...current, ...noteUpdates }));
    setGabayEventMessage("Attendance saved locally. Maaari mo pa itong i-edit before it syncs later.");
    let changes: PendingChange<TeachingClass, SavedPlan>[];
    try {
      changes = attendanceChanges(classes, updates, noteUpdates);
    } catch {
      setNotice("Attendance is saved on this device, but these records could not be prepared for sync. Reopen the class roster and save again.");
      return;
    }
    queueChanges(changes, "Attendance is saved on this device and will sync when your connection returns.");
  }

  if (entryMode === "loading") {
    return <main className="login-screen"><section className="login-panel auth-loading" aria-live="polite"><StackedKalingaLogo /><p>Opening your teaching space…</p></section><KalingaFooterArtwork /></main>;
  }

  if (entryMode === "signed-out") {
    return <LoginScreen name={teacherName} email={teacherEmail} onNameChange={setTeacherName} onEmailChange={setTeacherEmail} onSignIn={signInTeacher} onCreateAccount={createTeacherAccount} onContinue={() => setEntryMode("prototype")} />;
  }

  if (!workspaceScope || hydratedWorkspaceScope !== workspaceScope) {
    return <main className="login-screen"><section className="login-panel auth-loading" aria-live="polite"><StackedKalingaLogo /><p>Opening this teacher’s workspace…</p></section><KalingaFooterArtwork /></main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <button className="brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}>
          <Image src="/kalinga-logo.png" width={2172} height={724} alt="Kalinga" priority />
        </button>

        <nav className="nav-list">
          <button className={`nav-item ${view === "home" ? "active" : ""}`} type="button" onClick={() => setView("home")}>Today</button>
          <button className={`nav-item ${view === "classes" ? "active" : ""}`} type="button" onClick={() => setView("classes")}>Classes &amp; learners</button>
          <button className={`nav-item ${view === "plan" ? "active" : ""}`} type="button" onClick={() => beginPlan()}>Plan lessons</button>
          <button className={`nav-item ${view === "library" ? "active" : ""}`} type="button" onClick={() => setView("library")}>Find resources</button>
          <button className={`nav-item ${view === "community" ? "active" : ""}`} type="button" onClick={() => { setCommunityTargetId(""); setCommunityResourceId(""); setView("community"); }}>Ask teachers</button>
          <button className={`nav-item tutorial-nav ${view === "tutorial" ? "active" : ""}`} type="button" onClick={openTutorial}><span className="nav-icon">?</span> Learn Kalinga{tutorialStatus.completed && <small>✓</small>}</button>
        </nav>

        <div className="offline-card">
          <span className="status-dot" />
          <div><strong>Teaching kit</strong><small>2 starter PDFs ready</small></div>
        </div>

        <div className="account-anchor desktop-account">
          {accountOpen && <AccountMenu name={teacherName} email={teacherEmail} onSignOut={signOut} />}
          <button className="profile" type="button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>
            <span className="avatar">{teacherInitials(teacherName)}</span>
            <span><strong>{teacherLabel(teacherName)}</strong><small>{schoolName.trim() || "Add your school in a lesson plan"}</small></span>
            <span aria-hidden="true">···</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" type="button" aria-label="Kalinga home" onClick={() => setView("home")}><Image src="/kalinga-logo.png" width={2172} height={724} alt="Kalinga" priority /></button>
          <div className="top-actions">
            {blockedWrites.length && !storageError
              ? <button className={`connection ${syncState}`} type="button" onClick={retrySync} aria-label={`${syncLabel}. Retry sync now.`}><i /> {syncLabel} · Retry</button>
              : <span className={`connection ${syncState}`} role="status"><i /> {syncLabel}</span>}
            <button className={`gabay-topbar-assistant ${gabayEventMessage ? "has-update" : ""}`} type="button" aria-label={`Ask Gabay about ${gabayPageLabels[view]}`} aria-haspopup="dialog" aria-expanded={gabayOpen} onClick={() => { setGabayEventMessage(""); setGabayOpen((open) => !open); }}><GabayMascot size="small" motion={gabayMotion} /><span><b>Ask Gabay</b><small>{gabayPageLabels[view]} · AI assistant</small></span></button>
            <div className="notification-anchor">
              <button className={`notification ${unreadNotifications.length ? "has-unread" : ""}`} type="button" aria-label={`Notifications${unreadNotifications.length ? `, ${unreadNotifications.length} unread` : ""}`} aria-haspopup="dialog" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><BellIcon />{unreadNotifications.length > 0 && <b>{Math.min(unreadNotifications.length, 9)}</b>}</button>
              {notificationsOpen && <NotificationPanel notifications={notifications} readIds={notificationReadIds} authenticated={entryMode === "authenticated"} onOpen={openNotification} onMarkAll={() => markNotificationsRead(unreadNotifications.map((item) => item.id))} />}
            </div>
            <div className="account-anchor mobile-account">
              <button className="mobile-account-button" type="button" aria-label="Account options" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>{teacherInitials(teacherName)}</button>
              {accountOpen && <AccountMenu name={teacherName} email={teacherEmail} onSignOut={signOut} />}
            </div>
          </div>
        </header>

        {storageError && <p className="storage-alert" role="alert">{storageError}</p>}
        {showTutorialOffer && <TutorialOffer teacherName={teacherName} onStart={() => { saveTutorialProgress(emptyTutorialStatus); setView("tutorial"); }} onDismiss={() => saveTutorialProgress({ ...emptyTutorialStatus, dismissed: true })} />}

        <div className="content">
          {view === "home" ? <div className="view-page home-page">
            <GabayTodayBriefing teacherName={teacherName} activeClass={activeClass} blocks={todayTeachingBlocks} nextBlock={nextTeachingBlock} missingPlanCount={missingPlanCount} attendanceSavedCount={attendanceSavedCount} latestUpdate={gabayEventMessage} motion={gabayMotion} onOpen={() => setGabayOpen(true)} onSetUp={() => setView("classes")} onLoadSample={loadSampleClass} />
            {(authWelcomeMessage || notice) && <p className="notice" role="status">{authWelcomeMessage || notice}</p>}
            {activeClass && <section className="home-essentials-grid">
              <TodayScheduleSummary blocks={todayTeachingBlocks} onOpenClass={(classId) => { setActiveClassId(classId); setView("classes"); }} />
              <article className="home-action-card">
                <div className="home-action-heading"><div><p className="eyebrow">WORKING WITH</p><h2>{activeClass.name}</h2><p>{gradeList(activeClass.grades)} · {activeClass.learners.length} learners</p></div>{classes.length > 1 && <select aria-label="Choose active class" value={activeClass.id} onChange={(event) => setActiveClassId(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}</div>
                <div className="home-essential-actions">
                  <button type="button" onClick={() => latestPlan ? openTeachingPlan(latestPlan.id) : beginPlan()}><p><b>{latestPlan ? "Open teaching guide" : "Plan a lesson"}</b><small>{latestPlan ? `${latestPlan.title} · ${corePlanTasksReady(latestPlan)}/3 core tasks ready.` : "Start with the essentials, then edit one task at a time."}</small></p><b>→</b></button>
                  <button type="button" onClick={() => setView("attendance")}><p><b>Take attendance</b><small>{activeAttendance.length ? `${activeAttendance.length} records saved. Open to review them.` : `Mark the status of ${activeClass.learners.length} learners.`}</small></p><b>→</b></button>
                  <button type="button" onClick={() => setView("library")}><p><b>Find a resource</b><small>Browse materials matched to these grade levels.</small></p><b>→</b></button>
                </div>
              </article>
            </section>}
          </div> : view === "classes" ? <ClassesView classes={classes} activeClassId={activeClass?.id || ""} savedPlans={savedPlans} attendanceRecords={attendanceRecords} onSelectClass={setActiveClassId} onSave={saveClass} onDelete={deleteClass} onLoadSample={loadSampleClass} onPlan={beginPlan} onTeach={openTeachingPlan} onAttendance={() => setView("attendance")} onAskGabay={() => setGabayOpen(true)} onGabayContext={setGabayLiveContext} /> : view === "plan" ? <PlanView key={editingPlanId || `new-${activeClass?.id || "none"}`} classes={classes} activeClassId={activeClass?.id || ""} initialPlan={savedPlans.find((item) => item.id === editingPlanId)} teacherName={teacherName} schoolName={schoolName} onSchoolNameChange={updateSchoolName} onSave={savePlan} onTeach={(plan) => { setEditingPlanId(plan.id); setActiveClassId(plan.classId); setView("teach"); }} onBack={() => setView("home")} onSetUpClass={() => setView("classes")} onGabayContext={setGabayLiveContext} /> : view === "teach" ? teachingPlan ? <TeachingView plan={teachingPlan} teachingClass={classes.find((item) => item.id === teachingPlan.classId)} onBack={() => setView("home")} onEdit={() => beginPlan(teachingPlan.id)} onAttendance={() => setView("attendance")} onGabayContext={setGabayLiveContext} /> : <section className="class-zero-state compact-zero"><span className="zero-icon">▶</span><div><p className="eyebrow">TEACHING GUIDE</p><h2>Open a saved lesson first</h2><p>The classroom guide is created from a saved lesson plan.</p></div><div className="zero-actions"><button className="primary-button" type="button" onClick={() => setView("home")}>Back to Today</button></div></section> : view === "tutorial" ? <TutorialView teacherName={teacherName} status={tutorialStatus} onProgress={saveTutorialProgress} onExit={() => setView("home")} onAskGabay={() => setGabayOpen(true)} onGabayContext={setGabayLiveContext} /> : view === "library" ? <LibraryView classes={classes} activeClassId={activeClass?.id || ""} authenticated={entryMode === "authenticated"} teacherAccountId={teacherAccountId} teacherName={teacherName} onSetUpClass={() => setView("classes")} onRequestSignIn={() => setEntryMode("signed-out")} onOpenCommunity={(resourceId) => { setCommunityTargetId(""); setCommunityResourceId(resourceId); setView("community"); }} onGabayContext={setGabayLiveContext} /> : view === "attendance" ? <AttendanceView classes={classes} activeClassId={activeClass?.id || ""} attendanceRecords={attendanceRecords} attendanceNotes={attendanceNotes} onSave={saveAttendance} onSetUpClass={() => setView("classes")} onGabayContext={setGabayLiveContext} /> : <CommunityView key={`community-${communityTargetId}-${communityResourceId}`} authenticated={entryMode === "authenticated"} teacherAccountId={teacherAccountId} teacherName={teacherName} openDiscussionId={communityTargetId} initialResourceId={communityResourceId} onRequestSignIn={() => setEntryMode("signed-out")} onOpenLibrary={() => setView("library")} onGabayContext={setGabayLiveContext} />}
        </div>

        <GabayGuide open={gabayOpen} view={view} pageContext={gabayPageContext} activeClass={activeClass} motion={gabayMotion} authenticated={entryMode === "authenticated"} teacherAccountId={teacherAccountId} onClose={() => setGabayOpen(false)} onRequestSignIn={() => { setGabayOpen(false); setEntryMode("signed-out"); }} />

        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button className={view === "home" ? "active" : ""} type="button" onClick={() => setView("home")}><span>⌂</span>Today</button><button className={view === "classes" ? "active" : ""} type="button" onClick={() => setView("classes")}><span>▦</span>Classes</button><button className={view === "plan" || view === "teach" ? "active" : ""} type="button" onClick={() => beginPlan()}><span>＋</span>Plan</button><button className={view === "library" ? "active" : ""} type="button" onClick={() => setView("library")}><span>▱</span>Resources</button><button className={view === "community" ? "active" : ""} type="button" onClick={() => { setCommunityTargetId(""); setCommunityResourceId(""); setView("community"); }}><span>♧</span>Ask</button><button className={view === "tutorial" ? "active" : ""} type="button" onClick={openTutorial}><span>?</span>Learn</button>
        </nav>
      </section>
    </main>
  );
}

function LoginScreen({ name, email, onNameChange, onEmailChange, onSignIn, onCreateAccount, onContinue }: { name: string; email: string; onNameChange: (name: string) => void; onEmailChange: (email: string) => void; onSignIn: (email: string, password: string) => Promise<AuthActionResult>; onCreateAccount: (name: string, email: string, password: string) => Promise<AuthActionResult>; onContinue: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formMode, setFormMode] = useState<"sign-in" | "create">("sign-in");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFormMessage("");
    const result = formMode === "sign-in"
      ? await onSignIn(email.trim(), password)
      : await onCreateAccount(name.trim(), email.trim(), password);
    setSubmitting(false);
    if (!result.ok) setFormError(result.message || "Something went wrong. Please try again.");
    else if (result.message) setFormMessage(result.message);
  }

  function switchMode(mode: "sign-in" | "create") {
    setFormMode(mode);
    setFormError("");
    setFormMessage("");
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <StackedKalingaLogo />
        <div className="login-copy">
          <p className="eyebrow">TEACHERS’ ASSISTANT</p>
          <h1 id="login-title">{formMode === "sign-in" ? "Welcome back, Teacher" : "Create your teacher account"}</h1>
          <p>{formMode === "sign-in" ? "Sign in to securely access your teaching space and Gabay." : "Set up one account for your classes, plans, and attendance."}</p>
        </div>

        <div className="auth-mode-switch" role="tablist" aria-label="Account access"><button className={formMode === "sign-in" ? "active" : ""} type="button" role="tab" aria-selected={formMode === "sign-in"} onClick={() => switchMode("sign-in")}>Sign in</button><button className={formMode === "create" ? "active" : ""} type="button" role="tab" aria-selected={formMode === "create"} onClick={() => switchMode("create")}>Create account</button></div>
        <form className="login-form" onSubmit={submitLogin}>
          {formMode === "create" && <label>Teacher name<input type="text" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Your name" autoComplete="name" required /></label>}
          <label>Email address<input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="teacher@school.edu.ph" required /></label>
          <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete={formMode === "sign-in" ? "current-password" : "new-password"} required /><button type="button" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button></span></label>
          <div className="login-options"><span>{formMode === "sign-in" ? "Your session stays securely signed in on this device." : "Use at least 6 characters."}</span></div>
          {formError && <p className="auth-feedback error" role="alert">{formError}</p>}
          {formMessage && <p className="auth-feedback success" role="status">{formMessage}</p>}
          <button className="login-primary" type="submit" disabled={submitting}>{submitting ? "Please wait…" : formMode === "sign-in" ? "Sign in to Kalinga" : "Create teacher account"}</button>
        </form>

        <div className="login-divider"><span>or</span></div>
        <button className="prototype-button" type="button" onClick={onContinue}>Continue to prototype <span>→</span></button>
        <p className="demo-note"><span>i</span><b>Demo access</b> Prototype mode stays on this device. Sign in to securely use connected Gabay.</p>
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
        <button type="button" role="menuitem" disabled><span>?</span> Help &amp; support<small>Coming soon</small></button>
      </div>
      <button className="signout-button" type="button" role="menuitem" onClick={onSignOut}><span>↪</span> Sign out</button>
    </div>
  );
}

function NotificationPanel({ notifications, readIds, authenticated, onOpen, onMarkAll }: { notifications: AppNotification[]; readIds: string[]; authenticated: boolean; onOpen: (item: AppNotification) => void; onMarkAll: () => void }) {
  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length;
  return <section className="notification-panel" role="dialog" aria-label="Notifications">
    <header><div><p className="eyebrow">WHAT NEEDS YOU</p><h2>Notifications</h2></div>{unreadCount > 0 && <button type="button" onClick={onMarkAll}>Mark all read</button>}</header>
    {!authenticated ? <div className="notification-empty"><b>Sign in for personal notifications</b><p>Replies, mentions, and class-matched resources belong to a teacher account.</p></div> : notifications.length ? <div className="notification-list">{notifications.map((item) => { const read = readIds.includes(item.id); return <button className={read ? "read" : ""} type="button" onClick={() => onOpen(item)} key={item.id}><span>{item.kind === "mention" ? "@" : item.kind === "reply" ? "↩" : "▱"}</span><p><b>{item.title}</b><small>{item.body}</small>{item.createdAt && <em>{communityTime(item.createdAt)}</em>}</p>{!read && <i aria-label="Unread" />}</button>; })}</div> : <div className="notification-empty"><b>You’re caught up</b><p>New replies, mentions, and useful class matches will appear here.</p></div>}
    <footer>Only useful signals—no noisy activity feed.</footer>
  </section>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{description}</p></div>
      {action}
    </header>
  );
}

const tutorialMissions = [
  { label: "Today", title: "Know what needs you first", detail: "Read Gabay’s briefing and spot the most useful next action.", gabay: "Start here every day. I’ll summarize the schedule and unfinished work so you do not have to search the whole app." },
  { label: "Classes", title: "Set up a practice class", detail: "Try the minimum information Kalinga needs to organize your work.", gabay: "A class is the home for its learners, meeting times, lesson plans, and attendance. This practice class will not be saved." },
  { label: "Plan", title: "Start a focused lesson", detail: "Choose a subject and give the lesson a working topic.", gabay: "Begin with what you already know. The detailed ILAW sections can stay out of the way until they are useful." },
  { label: "Teach", title: "Follow one teaching block", detail: "Choose the grade you would guide while other groups work independently.", gabay: "Teaching View turns the plan into a classroom guide: one time block, one teacher focus, and a clear task for every grade." },
  { label: "Attendance", title: "Record a quick attendance check", detail: "Mark the three practice learners to see how fast a class can be recorded.", gabay: "Attendance belongs to the selected class and date. Kalinga keeps it available on the device and syncs it when possible." },
  { label: "Share", title: "Ask with useful context", detail: "Attach a practice resource and write a clear question for other teachers.", gabay: "Resources and Ask Teachers work together. Share the material and explain what kind of help you need—without including private learner details." },
] as const;

function TutorialOffer({ teacherName, onStart, onDismiss }: { teacherName: string; onStart: () => void; onDismiss: () => void }) {
  return <div className="tutorial-offer-backdrop"><section className="tutorial-offer" role="dialog" aria-modal="true" aria-labelledby="tutorial-offer-title"><div className="tutorial-offer-mascot"><GabayMascot size="hero" motion={false} /></div><div><p className="eyebrow">OPTIONAL GUIDED TOUR</p><h2 id="tutorial-offer-title">Want to practice first, {teacherLabel(teacherName)}?</h2><p>Gabay can walk you through six short missions using demo information. Nothing in the tutorial changes your real classes, plans, attendance, resources, or messages.</p><div className="tutorial-offer-facts"><span>About 5 minutes</span><span>Practice data only</span><span>Available again anytime</span></div><div className="tutorial-offer-actions"><button className="primary-button" type="button" onClick={onStart}>Start with Gabay →</button><button className="secondary-button" type="button" onClick={onDismiss}>Not now</button></div></div></section></div>;
}

function TutorialView({ teacherName, status, onProgress, onExit, onAskGabay, onGabayContext }: { teacherName: string; status: TutorialStatus; onProgress: (status: TutorialStatus) => void; onExit: () => void; onAskGabay: () => void; onGabayContext: (context: GabayLiveContext) => void }) {
  const [selectedStep, setSelectedStep] = useState(status.completed ? tutorialStepCount : status.step);
  const [briefingOpened, setBriefingOpened] = useState(false);
  const [demoClassName, setDemoClassName] = useState("");
  const [demoGrades, setDemoGrades] = useState<string[]>([]);
  const [demoSubject, setDemoSubject] = useState("");
  const [demoTopic, setDemoTopic] = useState("");
  const [guidedGrade, setGuidedGrade] = useState("");
  const [demoAttendance, setDemoAttendance] = useState<Record<string, string>>({});
  const [resourceAttached, setResourceAttached] = useState(false);
  const [demoQuestion, setDemoQuestion] = useState("");
  const mission = tutorialMissions[Math.min(selectedStep, tutorialStepCount - 1)];
  const previouslyCompleted = status.completed || selectedStep < status.step;
  const ready = previouslyCompleted || (selectedStep === 0 ? briefingOpened
    : selectedStep === 1 ? Boolean(demoClassName.trim() && demoGrades.length)
      : selectedStep === 2 ? Boolean(demoSubject && demoTopic.trim())
        : selectedStep === 3 ? Boolean(guidedGrade)
          : selectedStep === 4 ? Object.keys(demoAttendance).length === 3
            : resourceAttached && demoQuestion.trim().length >= 12);

  useEffect(() => {
    onGabayContext({ view: "tutorial", pageStep: status.completed ? "Tutorial complete" : `Practice mission ${selectedStep + 1} of ${tutorialStepCount}: ${mission.label}`, currentSummary: status.completed ? ["The teacher completed the guided Kalinga tutorial"] : [mission.title, mission.detail, "All information on this page is practice data and will not change the teacher workspace"], availableActions: ["Explain this practice step", "Tell me why this feature matters", "Give me an example", "Repeat the instruction in simpler Taglish"] });
  }, [mission, onGabayContext, selectedStep, status.completed]);

  function advance() {
    const next = selectedStep + 1;
    if (next >= tutorialStepCount) {
      onProgress({ step: tutorialStepCount, completed: true, dismissed: false });
      setSelectedStep(tutorialStepCount);
      return;
    }
    onProgress({ step: Math.max(status.step, next), completed: false, dismissed: false });
    setSelectedStep(next);
  }

  function restart() {
    setSelectedStep(0); setBriefingOpened(false); setDemoClassName(""); setDemoGrades([]); setDemoSubject(""); setDemoTopic(""); setGuidedGrade(""); setDemoAttendance({}); setResourceAttached(false); setDemoQuestion("");
    onProgress(emptyTutorialStatus);
  }

  if (selectedStep >= tutorialStepCount) return <div className="view-page tutorial-page"><section className="tutorial-complete"><GabayMascot size="hero" motion={false} speaking /><p className="eyebrow">ALL SIX MISSIONS COMPLETE</p><h1>You’re ready to use Kalinga.</h1><p>You practiced the full flow without changing any real records. Return to Today when you are ready, or replay the tour whenever you want.</p><div><button className="primary-button" type="button" onClick={onExit}>Go to Today →</button><button className="secondary-button" type="button" onClick={restart}>Replay tutorial</button></div></section></div>;

  return <div className="view-page tutorial-page">
    <PageIntro eyebrow="LEARN KALINGA" title={`Practice with Gabay, ${teacherLabel(teacherName)}`} description="A safe, guided workspace. Every class, learner, lesson, and message shown here is only a demo." action={<button className="secondary-button" type="button" onClick={onExit}>Exit tutorial</button>} />
    <div className="tutorial-safety"><span>✓</span><p><b>Practice mode is on</b><small>Your real workspace will not be changed.</small></p><strong>{Math.round((status.step / tutorialStepCount) * 100)}% complete</strong></div>
    <div className="tutorial-layout">
      <nav className="tutorial-missions" aria-label="Tutorial missions">{tutorialMissions.map((item, index) => { const complete = status.completed || index < status.step; const available = complete || index === status.step; return <button className={`${index === selectedStep ? "active" : ""} ${complete ? "complete" : ""}`} type="button" disabled={!available} onClick={() => setSelectedStep(index)} key={item.label}><span>{complete ? "✓" : index + 1}</span><p><b>{item.label}</b><small>{complete ? "Completed" : index === status.step ? "Current mission" : "Locked"}</small></p></button>; })}</nav>
      <main className="tutorial-stage">
        <section className="tutorial-gabay"><GabayMascot size="medium" motion={false} speaking /><div><p className="eyebrow">GABAY · MISSION {selectedStep + 1}</p><h2>{mission.title}</h2><p>{mission.gabay}</p></div><button type="button" onClick={onAskGabay}>Ask Gabay</button></section>
        <section className="tutorial-practice"><header><div><p className="eyebrow">YOUR TURN · PRACTICE ONLY</p><h2>{mission.detail}</h2></div><span>{selectedStep + 1} / {tutorialStepCount}</span></header>
          {selectedStep === 0 && <div className="tutorial-today-demo"><div><small>TODAY</small><b>1 class at 8:00 AM</b></div><div><small>NEEDS ATTENTION</small><b>Lesson plan needs a learning check</b></div><button className={briefingOpened ? "done" : ""} type="button" onClick={() => setBriefingOpened(true)}>{briefingOpened ? "✓ Priorities checked" : "Check today’s priorities →"}</button></div>}
          {selectedStep === 1 && <div className="tutorial-class-demo"><label>Practice class name<input value={demoClassName} onChange={(event) => setDemoClassName(event.target.value)} placeholder="e.g. Morning Multigrade Class" /></label><fieldset><legend>Choose at least one grade</legend><div>{["Grade 2", "Grade 3", "Grade 4"].map((grade) => <button className={demoGrades.includes(grade) ? "selected" : ""} type="button" onClick={() => setDemoGrades((current) => current.includes(grade) ? current.filter((item) => item !== grade) : [...current, grade])} key={grade}>{demoGrades.includes(grade) ? "✓ " : "+ "}{grade}</button>)}</div></fieldset><small>This class exists only inside this tutorial.</small></div>}
          {selectedStep === 2 && <div className="tutorial-plan-demo"><label>Subject<select value={demoSubject} onChange={(event) => setDemoSubject(event.target.value)}><option value="">Choose a subject</option><option>Mathematics</option><option>Science</option><option>English</option><option>Filipino</option></select></label><label>Working lesson topic<input value={demoTopic} onChange={(event) => setDemoTopic(event.target.value)} placeholder="What will the class learn?" /></label><div><span>1</span><p><b>Start with the essentials</b><small>Detailed ILAW fields remain editable later.</small></p></div></div>}
          {selectedStep === 3 && <div className="tutorial-teach-demo"><p>It is 8:15 AM. Which group will you guide directly?</p><div>{["Grade 2", "Grade 3", "Grade 4"].map((grade) => <button className={guidedGrade === grade ? "selected" : ""} type="button" onClick={() => setGuidedGrade(grade)} key={grade}><small>{guidedGrade === grade ? "WITH TEACHER" : "INDEPENDENT"}</small><b>{grade}</b><span>{guidedGrade === grade ? "Guided lesson" : "Practice activity"}</span></button>)}</div></div>}
          {selectedStep === 4 && <div className="tutorial-attendance-demo">{["Mika · Grade 2", "Paolo · Grade 3", "Lina · Grade 4"].map((learner) => <div key={learner}><b>{learner}</b><span>{["Present", "Late", "Absent"].map((value) => <button className={demoAttendance[learner] === value ? "selected" : ""} type="button" onClick={() => setDemoAttendance((current) => ({ ...current, [learner]: value }))} key={value}>{value}</button>)}</span></div>)}</div>}
          {selectedStep === 5 && <div className="tutorial-share-demo"><button className={resourceAttached ? "resource-attached" : ""} type="button" onClick={() => setResourceAttached(true)}><span>PDF</span><p><b>Fractions using local objects</b><small>{resourceAttached ? "✓ Attached to practice question" : "Attach this resource"}</small></p></button><label>Question for teachers<textarea value={demoQuestion} onChange={(event) => setDemoQuestion(event.target.value)} placeholder="What would you like another teacher to help with?" /></label><small>This question will not be posted.</small></div>}
          <footer><button className="secondary-button" type="button" disabled={selectedStep === 0} onClick={() => setSelectedStep((current) => Math.max(0, current - 1))}>← Back</button><p>{ready ? <><b>✓ Ready</b> This practice step is complete.</> : "Complete the practice action above to continue."}</p><button className="primary-button" type="button" disabled={!ready} onClick={advance}>{selectedStep === tutorialStepCount - 1 ? "Finish tutorial" : "Complete mission →"}</button></footer>
        </section>
      </main>
    </div>
  </div>;
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>;
}

function GabayMascot({ size = "medium", motion = true, speaking = false }: { size?: "small" | "medium" | "large" | "hero" | "companion"; motion?: boolean; speaking?: boolean }) {
  return <span className={`gabay-mascot gabay-mascot-${size} ${motion ? "" : "motion-paused"} ${speaking ? "is-speaking" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 96 96" role="img">
      <path className="gabay-arm gabay-arm-left" d="M28 57c-8 2-12 8-13 14" />
      <path className="gabay-arm gabay-arm-right" d="M68 57c9-1 13-7 15-13" />
      <path className="gabay-body" d="M22 55c0-17 11-28 26-28s26 11 26 28v18c0 8-7 14-15 14H37c-8 0-15-6-15-14z" />
      <ellipse className="gabay-face" cx="48" cy="51" rx="19" ry="17" />
      <g className="gabay-eyes"><circle cx="41" cy="49" r="2.4" /><circle cx="55" cy="49" r="2.4" /></g>
      <path className="gabay-smile" d="M41 57c4 4 10 4 14 0" />
      <path className="gabay-cape" d="M31 69c5 4 11 6 17 6s12-2 17-6v9c-5 4-11 6-17 6s-12-2-17-6z" />
    </svg>
  </span>;
}

type GabayChatMessage = { id: string; conversationId: string; role: "teacher" | "gabay"; text: string; view: View; createdAt: string };
type GabayConversation = { id: string; title: string; createdAt: string; updatedAt: string; messages: GabayChatMessage[] };

function normalizeGabayView(value: unknown): View {
  return typeof value === "string" && value in gabayPageLabels ? value as View : "home";
}

function readStoredStringArray(key: string) {
  if (!key || typeof window === "undefined") return [] as string[];
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]") as string[];
  } catch {
    return [] as string[];
  }
}

function FormattedGabayMessage({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\n)/g).map((part, index) => {
    if (part === "\n") return <br key={`line-${index}`} />;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  })}</>;
}

function GabayTodayBriefing({ teacherName, activeClass, blocks, nextBlock, missingPlanCount, attendanceSavedCount, latestUpdate, motion, onOpen, onSetUp, onLoadSample }: { teacherName: string; activeClass?: TeachingClass; blocks: TodayTeachingBlock[]; nextBlock?: TodayTeachingBlock; missingPlanCount: number; attendanceSavedCount: number; latestUpdate: string; motion: boolean; onOpen: () => void; onSetUp: () => void; onLoadSample: () => void }) {
  const headline = !activeClass
    ? "Let’s set up your first class."
    : !blocks.length
      ? "No class today—good time to prep ahead."
      : nextBlock
        ? `${nextBlock.className} starts at ${nextBlock.meeting.startTime}.`
        : "You’re done with today’s scheduled classes.";

  return <section className={`gabay-today-briefing ${activeClass ? "" : "is-empty"}`} aria-label={`Gabay’s briefing for ${teacherLabel(teacherName)}`}>
    <button className="gabay-briefing-mascot" type="button" aria-label="Open Gabay" onClick={onOpen}><GabayMascot size="large" motion={motion} speaking /></button>
    <div className="gabay-briefing-copy">
      <p>{displayDate(dateInputValue()).toUpperCase()} · GABAY</p>
      <h1>Hi, {teacherLabel(teacherName)}. {headline}</h1>
      <span>{activeClass ? "Here’s what matters right now." : "Add it once, then I’ll carry its details into planning and attendance."}</span>
      {activeClass && <div className="gabay-briefing-updates">
        <span><b>{blocks.length}</b> {blocks.length === 1 ? "class" : "classes"} today</span>
        <span><b>{attendanceSavedCount}</b> attendance saved</span>
        <span className={missingPlanCount ? "needs-attention" : "is-ready"}><b>{missingPlanCount}</b> {missingPlanCount === 1 ? "plan needed" : "plans needed"}</span>
      </div>}
      {latestUpdate && <small className="gabay-briefing-latest"><b>Latest:</b> {latestUpdate}</small>}
    </div>
    <div className="gabay-briefing-actions">{activeClass ? <button className="gabay-briefing-action" type="button" onClick={onOpen}>Ask Gabay <span>→</span></button> : <><button className="primary-button" type="button" onClick={onSetUp}>＋ Set up my first class</button><button className="gabay-sample-link" type="button" onClick={onLoadSample}>Preview sample data</button></>}</div>
  </section>;
}

function TodayScheduleSummary({ blocks, onOpenClass }: { blocks: TodayTeachingBlock[]; onOpenClass: (classId: string) => void }) {
  return <section className="today-schedule-summary">
    <header><div><p className="eyebrow">TODAY’S SCHEDULE</p><h2>{blocks.length ? `${blocks.length} ${blocks.length === 1 ? "class" : "classes"}` : "No classes today"}</h2></div><span>{weekDays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}</span></header>
    {blocks.length ? <div className="today-schedule-list">{blocks.map((block) => { const endTime = formatTime(toMinutes(block.meeting.startTime) + block.meeting.durationMinutes); return <article key={`${block.classId}-${block.meeting.id}`}><div className="today-schedule-time"><b>{block.meeting.startTime}</b><span>to {endTime}</span></div><div className="today-schedule-details"><b>{block.className}</b><span>{gradeList(block.grades)}</span><small>{block.meeting.durationMinutes} min · {block.meeting.label || "Class block"}</small></div><button type="button" onClick={() => onOpenClass(block.classId)}>Open <span>→</span></button></article>; })}</div> : <p className="today-schedule-empty">Nothing scheduled. You can use the time to prepare a lesson or browse resources.</p>}
  </section>;
}

function GabayGuide({ open, view, pageContext, activeClass, motion, authenticated, teacherAccountId, onClose, onRequestSignIn }: { open: boolean; view: View; pageContext: GabayPageContext; activeClass?: TeachingClass; motion: boolean; authenticated: boolean; teacherAccountId: string; onClose: () => void; onRequestSignIn: () => void }) {
  const [chatInput, setChatInput] = useState("");
  const [conversations, setConversations] = useState<GabayConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [hydratedChatAccountId, setHydratedChatAccountId] = useState("");
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [conversationDeleteError, setConversationDeleteError] = useState("");
  const [readyContextSignature, setReadyContextSignature] = useState("");
  const chatInputId = useId();

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const chatMessages = activeConversation?.messages || [];
  const chatCacheKey = teacherAccountId ? `kalinga:teacher-${teacherAccountId}:gabay-chat` : "";
  const deletedChatIdsKey = teacherAccountId ? `kalinga:teacher-${teacherAccountId}:gabay-deleted-chats` : "";
  const contextSignature = JSON.stringify({ view, pageStep: pageContext.pageStep, classId: pageContext.classId, subject: pageContext.subject, lessonTopic: pageContext.lessonTopic, incompleteSections: pageContext.incompleteSections });
  const contextReady = readyContextSignature === contextSignature;

  useEffect(() => {
    const contextTimer = window.setTimeout(() => setReadyContextSignature(contextSignature), 280);
    return () => window.clearTimeout(contextTimer);
  }, [contextSignature]);

  useEffect(() => {
    if (!authenticated || !teacherAccountId) return;
    let active = true;
    const cacheTimer = window.setTimeout(() => {
      let cachedConversations: GabayConversation[] = [];
      try {
        const cached = window.localStorage.getItem(`kalinga:teacher-${teacherAccountId}:gabay-chat`);
        if (cached) cachedConversations = JSON.parse(cached) as GabayConversation[];
      } catch {
        cachedConversations = [];
      }
      if (!active) return;
      const deletedIds = readStoredStringArray(deletedChatIdsKey);
      const visibleCachedConversations = cachedConversations.filter((conversation) => !deletedIds.includes(conversation.id));
      setConversations(visibleCachedConversations);
      setActiveConversationId(visibleCachedConversations[0]?.id || "");
      setHydratedChatAccountId(teacherAccountId);
    }, 0);

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      void supabase.from("gabay_conversations").select("id,title,created_at,updated_at").eq("teacher_id", teacherAccountId).order("updated_at", { ascending: false }).limit(12).then(async ({ data: conversationRows, error }) => {
        if (!active || error || !conversationRows) return;
        const deletedIds = readStoredStringArray(deletedChatIdsKey);
        const visibleConversationRows = conversationRows.filter((row) => !deletedIds.includes(row.id as string));
        const conversationIds = visibleConversationRows.map((row) => row.id as string);
        const messageResult = conversationIds.length
          ? await supabase.from("gabay_messages").select("id,conversation_id,role,content,page_view,created_at").eq("teacher_id", teacherAccountId).in("conversation_id", conversationIds).order("created_at").limit(600)
          : { data: [], error: null };
        if (!active || messageResult.error) return;
        const messages = (messageResult.data || []).map((row) => ({
          id: row.id as string,
          conversationId: row.conversation_id as string,
          role: row.role === "gabay" ? "gabay" as const : "teacher" as const,
          text: row.content as string,
          view: normalizeGabayView(row.page_view),
          createdAt: row.created_at as string,
        }));
        const nextConversations: GabayConversation[] = visibleConversationRows.map((row) => ({
          id: row.id as string,
          title: row.title as string,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
          messages: messages.filter((message) => message.conversationId === row.id),
        }));
        setConversations((current) => {
          const latestDeletedIds = readStoredStringArray(deletedChatIdsKey);
          const mergedRemote = nextConversations.filter((conversation) => !latestDeletedIds.includes(conversation.id)).map((remote) => {
            const local = current.find((conversation) => conversation.id === remote.id);
            if (!local) return remote;
            const mergedMessages = [...remote.messages, ...local.messages.filter((message) => !remote.messages.some((remoteMessage) => remoteMessage.id === message.id))]
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            return { ...remote, updatedAt: remote.updatedAt > local.updatedAt ? remote.updatedAt : local.updatedAt, messages: mergedMessages };
          });
          return [...mergedRemote, ...current.filter((conversation) => !latestDeletedIds.includes(conversation.id) && !mergedRemote.some((remote) => remote.id === conversation.id))];
        });
        setActiveConversationId((current) => current || nextConversations[0]?.id || "");
        setHydratedChatAccountId(teacherAccountId);
      });
      const deletedIds = readStoredStringArray(deletedChatIdsKey);
      if (deletedIds.length) void (async () => {
        await supabase.from("gabay_messages").delete().eq("teacher_id", teacherAccountId).in("conversation_id", deletedIds);
        await supabase.from("gabay_conversations").delete().eq("teacher_id", teacherAccountId).in("id", deletedIds);
      })();
    }
    return () => {
      active = false;
      window.clearTimeout(cacheTimer);
    };
  }, [authenticated, deletedChatIdsKey, teacherAccountId]);

  useEffect(() => {
    if (!chatCacheKey || hydratedChatAccountId !== teacherAccountId) return;
    window.localStorage.setItem(chatCacheKey, JSON.stringify(conversations));
  }, [chatCacheKey, conversations, hydratedChatAccountId, teacherAccountId]);

  if (!open) return null;

  const pagePrompt: Record<View, string> = {
    home: activeClass ? `Need a hand with today or ${activeClass.name}?` : "Need a hand setting up your first class?",
    classes: "Ask about this class, learners, or schedule.",
    plan: "Ask about the ILAW section you are working on.",
    teach: "Ask about this teaching block or what each grade should do next.",
    library: "Ask me to help narrow down a resource.",
    attendance: "Ask about a status, note, or attendance step.",
    community: "Ask me to help make your teacher question clearer.",
    tutorial: "Ask me to explain this practice mission.",
  };

  async function askGabay(message: string) {
    if (!message || isReplying) return;
    if (!authenticated) {
      onRequestSignIn();
      return;
    }
    const stamp = new Date().toISOString();
    const conversationId = activeConversationId || crypto.randomUUID();
    const conversationTitle = message.length > 54 ? `${message.slice(0, 51)}…` : message;
    const teacherMessage: GabayChatMessage = { id: crypto.randomUUID(), conversationId, role: "teacher", text: message, view, createdAt: stamp };
    if (!activeConversationId) {
      const conversation: GabayConversation = { id: conversationId, title: conversationTitle, createdAt: stamp, updatedAt: stamp, messages: [teacherMessage] };
      setConversations((current) => [conversation, ...current]);
      setActiveConversationId(conversationId);
    } else {
      setConversations((current) => {
        const conversation = current.find((item) => item.id === conversationId);
        if (!conversation) return current;
        const updated = { ...conversation, updatedAt: stamp, messages: [...conversation.messages, teacherMessage] };
        return [updated, ...current.filter((item) => item.id !== conversationId)];
      });
    }
    setChatInput("");

    setIsReplying(true);
    setConnectionIssue(false);

    const supabase = getSupabaseBrowserClient();
    if (supabase && teacherAccountId) {
      if (!activeConversationId) {
        await supabase.from("gabay_conversations").insert({ id: conversationId, teacher_id: teacherAccountId, title: conversationTitle });
      }
      await supabase.from("gabay_messages").insert({ id: teacherMessage.id, conversation_id: conversationId, teacher_id: teacherAccountId, role: "teacher", content: message, page_view: view });
      void supabase.from("gabay_conversations").update({ updated_at: stamp }).eq("teacher_id", teacherAccountId).eq("id", conversationId);
    }

    const result = await askConnectedGabay(message, {
      ...pageContext,
      offline: typeof navigator !== "undefined" && !navigator.onLine,
    }, chatMessages.slice(-12).map(({ role, text }) => ({ role, text })));

    setConnectionIssue(!result.connected);
    const gabayReply = result.connected
      ? result.reply.slice(0, 3990)
      : result.reason === "busy"
        ? "Ang dami nating natanong sa maikling panahon. Let us pause for a moment, then ask again. Your classroom data is still safe."
        : "I could not reach Groq right now. Please try again shortly. Your classroom data is still safe.";
    const gabayMessage: GabayChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role: "gabay",
      text: gabayReply,
      view,
      createdAt: new Date().toISOString(),
    };
    setConversations((current) => {
      const conversation = current.find((item) => item.id === conversationId);
      if (!conversation) return current;
      const updated = { ...conversation, updatedAt: gabayMessage.createdAt, messages: [...conversation.messages, gabayMessage] };
      return [updated, ...current.filter((item) => item.id !== conversationId)];
    });
    if (supabase && teacherAccountId) {
      await supabase.from("gabay_messages").upsert({ id: gabayMessage.id, conversation_id: conversationId, teacher_id: teacherAccountId, role: "gabay", content: gabayMessage.text, page_view: view });
      await supabase.from("gabay_conversations").update({ updated_at: gabayMessage.createdAt }).eq("teacher_id", teacherAccountId).eq("id", conversationId);
    }
    setIsReplying(false);
  }

  async function sendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await askGabay(chatInput.trim());
  }

  function closeGuide() {
    setConversationMenuOpen(false);
    onClose();
  }

  function startNewConversation() {
    setActiveConversationId("");
    setChatInput("");
    setConnectionIssue(false);
    setConversationDeleteError("");
    setConversationMenuOpen(false);
  }

  function openConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setConversationMenuOpen(false);
    setConnectionIssue(false);
    setConversationDeleteError("");
  }

  async function deleteConversations(conversationIds: string[]) {
    if (!conversationIds.length) return;
    const deletedIds = [...new Set([...readStoredStringArray(deletedChatIdsKey), ...conversationIds])];
    if (deletedChatIdsKey) window.localStorage.setItem(deletedChatIdsKey, JSON.stringify(deletedIds));
    const remaining = conversations.filter((conversation) => !conversationIds.includes(conversation.id));
    setConversations(remaining);
    setActiveConversationId(remaining[0]?.id || "");
    setConversationMenuOpen(false);
    setConversationDeleteError("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !teacherAccountId) return;
    const messageResult = await supabase.from("gabay_messages").delete().eq("teacher_id", teacherAccountId).in("conversation_id", conversationIds);
    const conversationResult = await supabase.from("gabay_conversations").delete().eq("teacher_id", teacherAccountId).in("id", conversationIds);
    if (messageResult.error || conversationResult.error) setConversationDeleteError("Removed here, but cloud cleanup is waiting for a connection.");
  }

  async function clearCurrentConversation() {
    if (activeConversationId) await deleteConversations([activeConversationId]);
  }

  async function clearAllConversations() {
    const conversationIds = conversations.map((conversation) => conversation.id);
    const deletedIds = [...new Set([...readStoredStringArray(deletedChatIdsKey), ...conversationIds])];
    if (deletedChatIdsKey) window.localStorage.setItem(deletedChatIdsKey, JSON.stringify(deletedIds));
    setConversations([]);
    setActiveConversationId("");
    setConversationMenuOpen(false);
    setConversationDeleteError("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !teacherAccountId) return;
    const messageResult = await supabase.from("gabay_messages").delete().eq("teacher_id", teacherAccountId);
    const conversationResult = await supabase.from("gabay_conversations").delete().eq("teacher_id", teacherAccountId);
    if (messageResult.error || conversationResult.error) setConversationDeleteError("Removed here, but cloud cleanup is waiting for a connection.");
  }

  return <aside className="gabay-chat-popover" role="dialog" aria-modal="false" aria-labelledby="gabay-title">
    <header><GabayMascot size="small" motion={motion} speaking={isReplying} /><div><h2 id="gabay-title">Gabay</h2><small>{authenticated ? isReplying ? "Thinking with your page context…" : contextReady ? `${gabayPageLabels[view]} context ready` : "Reading this page…" : "Sign in for AI"}</small></div><div className="gabay-chat-header-actions"><button type="button" aria-label="Conversation options" aria-expanded={conversationMenuOpen} onClick={() => setConversationMenuOpen((shown) => !shown)}>•••</button><button className="gabay-close" type="button" aria-label="Close Gabay" onClick={closeGuide}>×</button></div></header>
    {authenticated && <div className={`gabay-context-status ${contextReady ? "ready" : "loading"}`} role="status" aria-live="polite"><i />{contextReady ? `Ready to help with ${pageContext.pageStep || gabayPageLabels[view]}` : "Loading the current page context…"}</div>}
    {conversationMenuOpen && <div className="gabay-conversation-menu"><div><b>Conversations</b><button type="button" disabled={isReplying} onClick={startNewConversation}>＋ New chat</button></div>{conversations.length ? <div className="gabay-recent-chats">{conversations.slice(0, 12).map((conversation) => <button className={conversation.id === activeConversationId ? "active" : ""} type="button" onClick={() => openConversation(conversation.id)} key={conversation.id}><span>{conversation.title}</span><small>{conversation.messages.length} messages</small></button>)}</div> : <p>No saved conversations yet.</p>}<div className="gabay-delete-actions">{activeConversationId && <button className="gabay-clear-chat" type="button" disabled={isReplying} onClick={clearCurrentConversation}>Delete this conversation</button>}{conversations.length > 1 && <button className="gabay-clear-chat" type="button" disabled={isReplying} onClick={clearAllConversations}>Delete all conversations</button>}</div>{conversationDeleteError && <p className="gabay-delete-error">{conversationDeleteError}</p>}<small>Private to this teacher account. Avoid learner names or sensitive details.</small></div>}
    <div className="gabay-chat-body">
      {authenticated && hydratedChatAccountId !== teacherAccountId ? <div className="gabay-chat-empty"><b>Opening your chats…</b></div> : !chatMessages.length ? <div className="gabay-chat-empty"><b>How can I help?</b><p>{pagePrompt[view]}</p>{!authenticated && <button type="button" onClick={onRequestSignIn}>Sign in to start chatting</button>}</div> : <div className="gabay-chat-thread" aria-live="polite">{chatMessages.map((message, index) => <Fragment key={message.id}>{index > 0 && chatMessages[index - 1].view !== message.view && <div className="gabay-context-divider"><span>Now helping with {gabayPageLabels[message.view]}</span></div>}<div className={message.role}><p><FormattedGabayMessage text={message.text} /></p></div></Fragment>)}{isReplying && <div className="gabay"><p>Sandali, teacher…</p></div>}</div>}
    </div>
    <form className="gabay-chat-composer" onSubmit={sendChat}><label className="sr-only" htmlFor={chatInputId}>Ask Gabay a question</label><input id={chatInputId} value={chatInput} maxLength={2000} disabled={!authenticated || hydratedChatAccountId !== teacherAccountId || !contextReady} onChange={(event) => setChatInput(event.target.value)} placeholder={!authenticated ? "Sign in to chat" : contextReady ? `Ask about ${gabayPageLabels[view]}…` : "Reading this page…"} /><button type="submit" disabled={!authenticated || hydratedChatAccountId !== teacherAccountId || !contextReady || !chatInput.trim() || isReplying} aria-label="Send question to Gabay">↑</button>{connectionIssue && <small>Gabay could not connect. Please try again.</small>}</form>
  </aside>;
}

function ClassesView({ classes, activeClassId, savedPlans, attendanceRecords, onSelectClass, onSave, onDelete, onLoadSample, onPlan, onTeach, onAttendance, onAskGabay, onGabayContext }: { classes: TeachingClass[]; activeClassId: string; savedPlans: SavedPlan[]; attendanceRecords: Record<string, Record<string, string>>; onSelectClass: (classId: string) => void; onSave: (item: Omit<TeachingClass, "id">, classId?: string) => void; onDelete: (classId: string) => void; onLoadSample: () => void; onPlan: (planId?: string) => void; onTeach: (planId: string) => void; onAttendance: () => void; onAskGabay: () => void; onGabayContext: (context: GabayLiveContext) => void }) {
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
  const [workspaceTab, setWorkspaceTab] = useState<"overview" | "learners" | "schedule" | "lessons">("overview");
  const selectedClass = classes.find((item) => item.id === activeClassId) || classes[0];
  const selectedPlans = savedPlans.filter((plan) => plan.classId === selectedClass?.id);
  const currentPlan = selectedPlans[0];
  const selectedRosterCounts = selectedClass ? learnerSexCounts(selectedClass.learners) : { female: 0, male: 0, unspecified: 0 };
  const attendanceCount = selectedClass ? Object.entries(attendanceRecords).filter(([key]) => key.startsWith(`${selectedClass.id}-`)).flatMap(([, records]) => Object.values(records)).length : 0;
  const detailsComplete = Boolean(name.trim() && grades.length && subjects.length);
  const namedLearnerCount = learners.filter((learner) => learner.name.trim()).length;

  useEffect(() => {
    onGabayContext({
      view: "classes",
      pageStep: formOpen ? `Class setup step ${classStep} of 3` : `Class workspace · ${workspaceTab}`,
      classId: selectedClass?.id,
      className: selectedClass?.name,
      gradeLevels: formOpen ? grades : selectedClass?.grades || [],
      subjects: formOpen ? subjects : selectedClass?.subjects || [],
      learnerCount: formOpen ? namedLearnerCount : selectedClass?.learners.length || 0,
      scheduleSummary: (formOpen ? meetings : selectedClass?.meetings || []).map((meeting) => `${meeting.days} at ${meeting.startTime} for ${meeting.durationMinutes} minutes`),
      incompleteSections: formOpen ? [!name.trim() && "class name", !grades.length && "grade levels", !subjects.length && "subjects", classStep < 2 && "schedule", classStep < 3 && "learners"].filter(Boolean) as string[] : [],
      currentSummary: selectedClass ? [`${selectedPlans.length} saved lesson plans`, `${attendanceCount} attendance statuses recorded`, `${selectedClass.learners.length} learners enrolled`] : ["No class has been created yet"],
      availableActions: formOpen ? ["Continue class setup", "Go back one setup step", "Save the class"] : ["Manage learners", "Edit meeting times", "Create a lesson", "Take attendance"],
    });
  }, [attendanceCount, classStep, formOpen, grades, learners, meetings, name, namedLearnerCount, onGabayContext, selectedClass, selectedPlans.length, subjects, workspaceTab]);

  function selectWorkspaceClass(classId: string) {
    onSelectClass(classId);
    setWorkspaceTab("overview");
    setFormOpen(false);
  }

  function resetForm() {
    setEditingId("");
    setName("");
    setGrades([]);
    setSubjects([]);
    setCustomSubject("");
    setMeetings([{ id: crypto.randomUUID(), days: "Monday to Friday", startTime: "8:00 AM", durationMinutes: 60, label: "" }]);
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
    setLearners((current) => [...current, { id: crypto.randomUUID(), name: "", grade: grades[0] || "1", sex: "Not specified" }]);
  }

  function updateLearner(id: string, field: "name" | "grade" | "sex", value: string) {
    setLearners((current) => current.map((learner) => {
      if (learner.id !== id) return learner;
      if (field === "sex") return { ...learner, sex: normalizeLearnerSex(value) };
      return { ...learner, [field]: value };
    }));
  }

  function addMeeting() {
    setMeetings((current) => [...current, { id: crypto.randomUUID(), days: "Monday", startTime: current.at(-1)?.startTime || "8:00 AM", durationMinutes: 60, label: "" }]);
  }

  function updateMeeting(id: string, changes: Partial<ClassMeeting>) {
    setMeetings((current) => current.map((meeting) => meeting.id === id ? { ...meeting, ...changes } : meeting));
  }

  function submitClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (classStep !== 3 || !detailsComplete) return;
    const safeMeetings = meetings.length ? meetings.map((meeting) => ({ ...meeting, durationMinutes: Math.max(5, Number(meeting.durationMinutes) || 60), label: meeting.label.trim() || "Regular class" })) : [{ id: crypto.randomUUID(), days: "Monday to Friday", startTime: "8:00 AM", durationMinutes: 60, label: "Regular class" }];
    const existingQuarter = classes.find((item) => item.id === editingId)?.quarter || "Quarter 1";
    onSave({ name: name.trim(), grades, subjects, quarter: existingQuarter, meetingDays: safeMeetings[0].days, startTime: safeMeetings[0].startTime, meetings: safeMeetings, learners: learners.filter((learner) => learner.name.trim()).map((learner) => ({ ...learner, name: learner.name.trim() })) }, editingId || undefined);
    resetForm();
    setFormOpen(false);
  }

  return (
    <div className="view-page classes-page">
      {!!classes.length && selectedClass && <>
        <section className="class-page-heading">
          <div><p className="eyebrow">CLASSES & LEARNERS</p><h1>Your classes</h1></div>
          <label><span>Class</span><select value={selectedClass.id} onChange={(event) => selectWorkspaceClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <button type="button" onClick={openNewClassForm}>Add class</button>
        </section>
        <div className="class-page-layout">
          <section className="class-hub class-hub-tabbed">
          <div className="class-workspace">
          <header className="class-workspace-head">
            <div><h2>{selectedClass.name}</h2><p>{gradeList(selectedClass.grades)} · {selectedClass.learners.length} {selectedClass.learners.length === 1 ? "learner" : "learners"}</p></div>
            <details className="class-more-menu"><summary aria-label={`More options for ${selectedClass.name}`}>•••</summary><div role="menu"><button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); editClass(selectedClass, "details"); }}><span>✎</span><span><b>Edit class details</b><small>Change grades or subjects</small></span></button><button className="delete-menu-item" type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setDeleteCandidateId(selectedClass.id); }}><span>×</span><span><b>Delete class</b><small>Remove this class and its records</small></span></button></div></details>
          </header>
          {deleteCandidateId === selectedClass.id && <div className="delete-confirm prominent-delete" role="alert"><div><b>Delete {selectedClass.name} permanently?</b><span>This removes the class, its lesson plans, learner attendance, and saved timetable from this device.</span></div><div><button type="button" onClick={() => setDeleteCandidateId("")}>Keep class</button><button type="button" onClick={() => { onDelete(selectedClass.id); setDeleteCandidateId(""); }}>Yes, delete class</button></div></div>}
          <nav className="class-workspace-tabs" aria-label={`${selectedClass.name} sections`}>{([['overview', 'Class details'], ['learners', 'Learners'], ['schedule', 'Schedule'], ['lessons', 'Lesson plans']] as const).map(([value, label]) => <button className={workspaceTab === value ? "active" : ""} type="button" aria-current={workspaceTab === value ? "page" : undefined} onClick={() => setWorkspaceTab(value)} key={value}>{label}</button>)}</nav>

          {workspaceTab === "overview" && <div className="class-overview-panel">
            <button type="button" onClick={() => editClass(selectedClass, "details")}><b>Subjects</b><span>{selectedClass.subjects.join(", ") || "No subjects added"}</span><strong>Edit subjects</strong></button>
            <button type="button" onClick={() => setWorkspaceTab("learners")}><b>Learners</b><span>{selectedClass.learners.length ? `${selectedClass.learners.length} enrolled · ${learnerRosterSummary(selectedClass.learners)}` : "No learners enrolled yet"}</span><strong>View learners</strong></button>
            <button type="button" onClick={() => setWorkspaceTab("schedule")}><b>Meeting</b><span>{selectedClass.meetings[0] ? `${selectedClass.meetings[0].days} at ${selectedClass.meetings[0].startTime}` : "No meeting time added"}</span><strong>Edit schedule</strong></button>
          </div>}

          {workspaceTab === "learners" && <section className="class-tab-panel"><header><div><p className="eyebrow">LEARNERS</p><h3>{selectedClass.learners.length ? `${selectedClass.learners.length} enrolled` : "No learners added yet"}</h3><p>{selectedRosterCounts.female} female · {selectedRosterCounts.male} male{selectedRosterCounts.unspecified ? ` · ${selectedRosterCounts.unspecified} not specified` : ""}</p></div><button className="secondary-button" type="button" onClick={() => editClass(selectedClass, "learners")}>{selectedClass.learners.length ? "Edit learners" : "＋ Add learners"}</button></header>{selectedClass.learners.length ? <div className="class-roster-table">{selectedClass.learners.map((learner, index) => <div key={learner.id}><span>{index + 1}</span><b>{learner.name}</b><small>{gradeLabel(learner.grade)}</small><small>{learner.sex}</small></div>)}</div> : <div className="class-tab-empty"><span>◎</span><b>Build this class roster once</b><p>Kalinga will reuse it for attendance and class counts.</p></div>}</section>}

          {workspaceTab === "schedule" && <section className="class-tab-panel"><header><div><p className="eyebrow">SCHEDULE</p><h3>Class meeting times</h3><p>{selectedClass.meetings.length} saved {selectedClass.meetings.length === 1 ? "block" : "blocks"}</p></div><button className="secondary-button" type="button" onClick={() => editClass(selectedClass, "schedule")}>Edit schedule</button></header><div className="class-meeting-list">{selectedClass.meetings.map((meeting) => <article key={meeting.id}><time>{meeting.startTime}</time><div><b>{meeting.label || "Regular class"}</b><small>{meeting.days} · {meeting.durationMinutes} minutes</small></div></article>)}</div>{currentPlan && <details className="class-plan-preview"><summary>Preview the latest lesson timetable <span>⌄</span></summary><div className="timeline compact-timeline">{currentPlan.slots.map((slot, index) => <div className="timeline-row" key={slot.id}><time>{slot.time}</time><div className={`timeline-event ${index ? `grade${index}` : "shared"}`}><strong>{slot.teacherFocus}</strong><small>{Object.values(slot.gradeTasks).filter(Boolean).join(" · ") || "Activities not added yet"}</small></div></div>)}</div></details>}</section>}

          {workspaceTab === "lessons" && <section className="class-tab-panel"><header><div><p className="eyebrow">LESSON PLANS</p><h3>{selectedPlans.length ? `${selectedPlans.length} saved` : "No saved lessons yet"}</h3><p>Every plan for {selectedClass.name} stays together here.</p></div><button className="primary-button" type="button" onClick={() => onPlan()}>＋ New lesson</button></header>{selectedPlans.length ? <div className="class-plan-links class-plan-grid">{selectedPlans.map((plan) => { const readyTasks = corePlanTasksReady(plan); return <article key={plan.id}><div><b>{plan.title}</b><small>{plan.subject} · {plan.quarter} · {plan.duration}</small><span className={readyTasks === 3 ? "ready" : "draft"}>{readyTasks === 3 ? "Ready to teach" : `${readyTasks}/3 core tasks ready`}</span></div><footer><button type="button" onClick={() => onPlan(plan.id)}>Edit plan</button><button className="teach-plan-button" type="button" onClick={() => onTeach(plan.id)}>Teaching view →</button></footer></article>; })}</div> : <div className="class-tab-empty"><span>＋</span><b>Start with one lesson</b><p>Choose a subject and let Gabay help with editable starting points.</p></div>}</section>}
          </div>
          </section>
          <aside className="class-next-step">
            <p className="eyebrow">NEXT STEP</p>
            <h2>{!selectedClass.learners.length ? "Add your learners" : !selectedPlans.length ? "Plan the first lesson" : "Take attendance"}</h2>
            <p>{!selectedClass.learners.length ? `Add the class roster once so ${selectedClass.name} is ready for attendance.` : !selectedPlans.length ? `There are no saved lesson plans for ${selectedClass.name} yet.` : `${selectedClass.learners.length} learners are ready for the next class.`}</p>
            <button className="primary-button" type="button" onClick={!selectedClass.learners.length ? () => editClass(selectedClass, "learners") : !selectedPlans.length ? () => onPlan() : onAttendance}>{!selectedClass.learners.length ? "Manage learners" : !selectedPlans.length ? "Start lesson plan" : "Take attendance"}</button>
            <button className="class-next-gabay" type="button" onClick={onAskGabay}>Ask Gabay for help</button>
          </aside>
        </div>
      </>}
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
          <div className="field-group roster-builder"><div className="roster-heading"><div><p className="group-label">Who are the learners in this class?<small>Add names for attendance. Sex fills the F / M counts printed on every lesson plan, so set it for each learner.</small></p></div><button className="secondary-button" type="button" onClick={addLearner} disabled={!grades.length}>＋ Add learner</button></div>{!learners.length ? <div className="roster-empty"><span>◎</span><p><b>You can skip learner names for now</b><small>Save the class now and add names from Manage learners whenever you are ready.</small></p></div> : <div className="roster-rows"><div className="roster-column-labels" aria-hidden="true"><span></span><b>Learner name</b><b>Grade</b><b>Sex (optional)</b><span></span></div>{learners.map((learner, index) => <div className="roster-row" key={learner.id}><span>{index + 1}</span><input aria-label={`Learner ${index + 1} name`} value={learner.name} onChange={(event) => updateLearner(learner.id, "name", event.target.value)} placeholder="Full name" /><select aria-label={`Learner ${index + 1} grade`} value={learner.grade} onChange={(event) => updateLearner(learner.id, "grade", event.target.value)}>{grades.map((grade) => <option value={grade} key={grade}>{gradeLabel(grade)}</option>)}</select><select aria-label={`Learner ${index + 1} sex`} className={learner.sex === "Not specified" ? "needs-choice" : ""} value={learner.sex} onChange={(event) => updateLearner(learner.id, "sex", event.target.value)}><option>Female</option><option>Male</option><option>Not specified</option></select><button type="button" aria-label={`Remove learner ${index + 1}`} onClick={() => setLearners((current) => current.filter((item) => item.id !== learner.id))}>×</button></div>)}</div>}</div>
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
  // Split the remainder so the blocks sum to the lesson exactly; any leftover
  // minutes go to the first guided blocks rather than being rounded away.
  const remaining = Math.max(grades.length, total - sharedMinutes);
  const base = grades.length ? Math.floor(remaining / grades.length) : remaining;
  const extra = grades.length ? remaining - base * grades.length : 0;
  let cursor = start + sharedMinutes;
  const guidedSlots = grades.map((focusGrade, index) => ({
    id: `slot-${focusGrade}-${index}`,
    time: formatTime((cursor += index === 0 ? 0 : base + (index - 1 < extra ? 1 : 0))),
    stage: index === 0 ? "Direct Teaching" : "Guided Practice",
    durationMinutes: base + (index < extra ? 1 : 0),
    teacherFocus: `Guide ${gradeLabel(focusGrade)}`,
    gradeTasks: Object.fromEntries(grades.map((grade) => [grade, grade === focusGrade ? "Guided lesson" : "Independent task"])),
  }));
  return [{ id: "slot-shared", time: startTime, stage: "Motivation", durationMinutes: sharedMinutes, wholeClass: true, teacherFocus: "All grades together", gradeTasks: sharedTasks }, ...guidedSlots];
}

function corePlanTasksReady(plan: SavedPlan) {
  return [
    plan.grades.every((grade) => plan.competencies?.[grade]?.trim() || plan.objectives?.[grade]?.trim()),
    plan.slots.some((slot) => slot.teacherFocus.trim() || Object.values(slot.gradeTasks).some((task) => task.trim())),
    plan.grades.every((grade) => plan.formativeAssessments?.[grade]?.trim()),
  ].filter(Boolean).length;
}

function TeachingView({ plan, teachingClass, onBack, onEdit, onAttendance, onGabayContext }: { plan: SavedPlan; teachingClass?: TeachingClass; onBack: () => void; onEdit: () => void; onAttendance: () => void; onGabayContext: (context: GabayLiveContext) => void }) {
  const [activeSlotId, setActiveSlotId] = useState(plan.slots[0]?.id || "");
  const activeSlot = plan.slots.find((slot) => slot.id === activeSlotId) || plan.slots[0];
  const activeIndex = Math.max(0, plan.slots.findIndex((slot) => slot.id === activeSlot?.id));
  const planStart = plan.startTime || teachingClass?.startTime || plan.slots[0]?.time || "8:00 AM";
  const planEnd = formatTime(toMinutes(planStart) + durationMinutes(plan.duration));
  const activeEnd = plan.slots[activeIndex + 1]?.time || planEnd;
  const readyTasks = corePlanTasksReady(plan);
  const teacherFocusGrade = plan.grades.find((grade) => activeSlot?.teacherFocus.toLowerCase().includes(gradeLabel(grade).toLowerCase()));

  useEffect(() => {
    onGabayContext({
      view: "teach",
      pageStep: activeSlot ? `Teaching block ${activeIndex + 1} of ${plan.slots.length}` : "Teaching guide overview",
      classId: plan.classId,
      className: teachingClass?.name,
      gradeLevels: plan.grades,
      subjects: [plan.subject],
      learnerCount: teachingClass?.learners.length || 0,
      subject: plan.subject,
      lessonTopic: plan.title,
      lessonDuration: `${plan.duration} starting at ${planStart}`,
      incompleteSections: readyTasks === 3 ? [] : [`${3 - readyTasks} core lesson ${3 - readyTasks === 1 ? "task is" : "tasks are"} incomplete`],
      currentSummary: activeSlot ? [`Current block: ${activeSlot.time} to ${activeEnd}`, `Teacher focus: ${activeSlot.teacherFocus}`, ...plan.grades.map((grade) => `${gradeLabel(grade)} task: ${activeSlot.gradeTasks[grade] || "not entered"}`)] : ["No teaching blocks have been added"],
      availableActions: ["Explain the current teaching block", "Adapt a grade task", "Suggest a low-material alternative", "Create a quick transition", "Review the assessment"],
    });
  }, [activeEnd, activeIndex, activeSlot, onGabayContext, plan, planStart, readyTasks, teachingClass]);

  if (!teachingClass) return <section className="class-zero-state compact-zero"><span className="zero-icon">▶</span><div><p className="eyebrow">TEACHING GUIDE</p><h2>This lesson’s class is unavailable</h2><p>Return to Today and choose another saved lesson.</p></div><button className="secondary-button" type="button" onClick={onBack}>Back to Today</button></section>;

  return <div className="view-page teaching-page">
    <PageIntro eyebrow="TEACH · MULTIGRADE LESSON" title={plan.title} description={`${teachingClass.name} · ${plan.subject} · ${planStart}–${planEnd}`} action={<div className="teaching-page-actions"><button className="secondary-button" type="button" onClick={onBack}>← Today</button><button className="secondary-button" type="button" onClick={onEdit}>Edit plan</button><button className="primary-button" type="button" onClick={() => window.print()}>Print or save PDF</button></div>} />

    <section className="teaching-guide-summary">
      <div><p className="eyebrow">CLASSROOM TEACHING GUIDE</p><h2>{plan.slots.length ? `${plan.slots.length} teaching ${plan.slots.length === 1 ? "block" : "blocks"}` : "Add a teaching flow"}</h2><p>{gradeList(plan.grades)} · {plan.duration} · {plan.multigradeModel || "Multigrade lesson"}</p><p className="teaching-guide-hint">Step through the lesson block by block while you teach — each block shows what every grade is doing and who is with you.</p></div>
      <div className={`teaching-readiness ${readyTasks === 3 ? "ready" : "draft"}`}><b>{readyTasks === 3 ? "Ready to teach" : "Usable draft"}</b><span>{readyTasks}/3 core tasks prepared</span></div>
    </section>

    {plan.slots.length ? <>
      <nav className="teaching-block-nav" aria-label="Teaching blocks">{plan.slots.map((slot, index) => <button className={slot.id === activeSlot?.id ? "active" : ""} type="button" aria-current={slot.id === activeSlot?.id ? "step" : undefined} onClick={() => setActiveSlotId(slot.id)} key={slot.id}><span>{index + 1}</span><p><b>{slot.time}</b><small>{slot.teacherFocus}</small></p></button>)}</nav>

      {activeSlot && <section className="teaching-focus-card">
        <header><div><p className="eyebrow">BLOCK {activeIndex + 1} OF {plan.slots.length} · {activeSlot.time}–{activeEnd}</p><h2>{activeSlot.teacherFocus || "Class activity"}</h2><p>{teacherFocusGrade ? `Give direct support to ${gradeLabel(teacherFocusGrade)} while the other groups continue their assigned work.` : "Guide the whole class through this part of the lesson."}</p></div><span>{Math.max(1, toMinutes(activeEnd) - toMinutes(activeSlot.time))}<small>minutes</small></span></header>
        <div className="teaching-grade-tasks">{plan.grades.map((grade) => { const teacherLed = grade === teacherFocusGrade || activeIndex === 0; return <article className={teacherLed ? "teacher-led" : "independent"} key={grade}><div><span>{teacherLed ? "WITH TEACHER" : "INDEPENDENT"}</span><b>{gradeLabel(grade)}</b></div><p>{activeSlot.gradeTasks[grade]?.trim() || "No activity has been entered for this group yet."}</p></article>; })}</div>
        <footer><button type="button" disabled={activeIndex === 0} onClick={() => setActiveSlotId(plan.slots[activeIndex - 1]?.id || activeSlot.id)}>← Previous block</button><span>{activeIndex + 1} of {plan.slots.length}</span>{activeIndex < plan.slots.length - 1 ? <button className="next" type="button" onClick={() => setActiveSlotId(plan.slots[activeIndex + 1].id)}>Next block →</button> : <button className="next" type="button" onClick={onAttendance}>Finish with attendance →</button>}</footer>
      </section>}
    </> : <section className="teaching-empty-flow"><span>＋</span><h2>This lesson needs a teaching flow</h2><p>Add at least one activity block before using it in class.</p><button className="primary-button" type="button" onClick={onEdit}>Edit teaching flow</button></section>}

    <section className="teaching-reference-grid">
      <article><p className="eyebrow">BEFORE CLASS</p><h3>Materials and context</h3><dl><div><dt>Materials</dt><dd>{plan.materials?.trim() || "No materials listed"}</dd></div><div><dt>Learner context</dt><dd>{plan.learnerContext?.trim() || "No additional learner notes"}</dd></div></dl></article>
      <article><p className="eyebrow">LEARNING TARGETS</p><h3>What each group should learn</h3><div className="teaching-reference-list">{plan.grades.map((grade) => <div key={grade}><b>{gradeLabel(grade)}</b><p>{plan.objectives?.[grade]?.trim() || plan.competencies?.[grade]?.trim() || "No learning target entered"}</p></div>)}</div></article>
      <article><p className="eyebrow">ASSESSMENT</p><h3>Assessment by grade</h3><div className="teaching-reference-list">{plan.grades.map((grade) => <div key={grade}><b>{gradeLabel(grade)}</b><p>{plan.formativeAssessments?.[grade]?.trim() || "No assessment entered"}</p>{plan.successCriteria?.[grade]?.trim() && <small>Success: {plan.successCriteria[grade]}</small>}</div>)}</div></article>
    </section>
  </div>;
}

function IlawPlanPrint({ plan, teachingClass, teacherName, schoolName, inline = false }: { plan: SavedPlan; teachingClass: TeachingClass; teacherName: string; schoolName: string; inline?: boolean }) {
  const printedDate = plan.teachingDate ? new Date(`${plan.teachingDate}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "";
  const lines = (value?: string) => (value || "—").split(/\r?\n/).map((line, index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>);
  const gradeRow = (label: string, values?: Record<GradeLevel, string>, extra?: Record<GradeLevel, string>) => <tr><th>{label}</th>{plan.grades.map((grade) => <td key={grade}>{lines(values?.[grade])}{extra?.[grade]?.trim() && <small>{extra[grade]}</small>}</td>)}</tr>;
  const gradeHead = <thead><tr><th />{plan.grades.map((grade) => <th key={grade}>{gradeLabel(grade).toUpperCase()}</th>)}</tr></thead>;
  return <article className={`ilaw-export-document${inline ? " ilaw-export-inline" : ""}`}>
    <header className="ilaw-print-title"><p>{planTitleLine(plan.grades)}</p><h1>{plan.title}</h1></header>
    <table className="ilaw-print-meta"><tbody>
      <tr><th>School</th><td>{schoolName.trim() || "—"}</td><th>Grade Levels</th><td>{gradeList(plan.grades)}</td></tr>
      <tr><th>Teacher</th><td>{teacherName}</td><th>Learning Area</th><td>{plan.subject}</td></tr>
      <tr><th>Teaching Date</th><td>{printedDate || "—"}</td><th>Quarter/Term</th><td>{plan.quarter}</td></tr>
      <tr><th>Time / Sessions</th><td>1 session, {plan.duration} · {plan.startTime}</td><th>No. of Learners</th><td>{learnerCountSummary(teachingClass, plan.grades)}</td></tr>
      <tr><th>Multigrade Model</th><td colSpan={3}>{plan.multigradeModel || "—"}</td></tr>
    </tbody></table>
    <section className="ilaw-print-section"><h2><span>I</span> Intentions</h2>
      {plan.sharedTheme?.trim() && <p><b>Shared Sub-theme:</b> {lines(plan.sharedTheme)}</p>}
      <table>{gradeHead}<tbody>
        {gradeRow("Pamantayang Pangnilalaman (Content Standard)", plan.contentStandards)}
        {gradeRow("Pamantayan sa Pagganap (Performance Standard)", plan.performanceStandards)}
        {gradeRow("Learning Competencies and Codes", plan.competencies, plan.competencyCodes)}
        {gradeRow("Learning Objectives", plan.objectives)}
      </tbody></table>
    </section>
    <section className="ilaw-print-section"><h2><span>L</span> Learning Experience</h2>
      <div className="ilaw-print-notes"><p><b>Learner Context:</b> {lines(plan.learnerContext)}</p><p><b>Instructional Materials and Resources:</b> {lines(plan.materials)}</p></div>
      <p><b>Flow of the Lesson</b></p>
      <table className="ilaw-flow-table"><thead><tr><th>Time</th><th>Stage</th>{plan.grades.map((grade) => <th key={grade}>{gradeLabel(grade).toUpperCase()}</th>)}</tr></thead><tbody>
        {plan.slots.map((slot) => <tr key={slot.id}>
          <td>{slot.durationMinutes ? `${slot.durationMinutes} min` : ""}<small>{slot.time}</small></td>
          <td><b>{slot.stage || "Learning activity"}</b>{slot.teacherFocus?.trim() && <small>{slot.teacherFocus}</small>}</td>
          {slotIsWholeClass(slot)
            ? <td colSpan={plan.grades.length}>{lines(wholeClassTask(slot))}</td>
            : plan.grades.map((grade) => <td key={grade}>{lines(slot.gradeTasks[grade])}</td>)}
        </tr>)}
      </tbody></table>
    </section>
    <section className="ilaw-print-section"><h2><span>A</span> Assessment</h2>
      <table>{gradeHead}<tbody>
        {gradeRow("Formative", plan.formativeAssessments)}
        {gradeRow("Exit Task", plan.exitTasks)}
        {gradeRow("Success Criteria", plan.successCriteria)}
      </tbody></table>
    </section>
    <section className="ilaw-print-section ways-forward-print-section"><h2><span>W</span> Ways Forward</h2>
      <table>{gradeHead}<tbody>
        {gradeRow("Reflection Questions", plan.reflectionQuestions)}
        {gradeRow("Remediation", plan.remediations)}
        {gradeRow("Enrichment", plan.enrichments)}
      </tbody></table>
      <p><b>Notes for Next Session / Whole-School Follow-Up:</b> {lines(plan.nextSessionNotes)}</p>
    </section>
    <footer className="ilaw-print-signatures"><div><span>Prepared by:</span><b>{teacherName}</b><small>Classroom Adviser</small></div><div><span>Checked by:</span><b>{plan.schoolHeadName || " "}</b><small>School Head</small></div></footer>
  </article>;
}

// A textarea that reads as document text and grows with its content, so the
// plan can be edited exactly where it prints.
function EditCell({ value, onChange, placeholder, label, compact = false }: { value: string; onChange: (value: string) => void; placeholder?: string; label: string; compact?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fit = () => {
      node.style.height = "0px";
      node.style.height = `${node.scrollHeight}px`;
    };
    fit();
    // Height depends on width: a cell measured before its column settled, or
    // after the phone rotates, would otherwise keep a stale height.
    let lastWidth = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (Math.abs(node.clientWidth - lastWidth) < 1) return;
      lastWidth = node.clientWidth;
      fit();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);
  return <textarea ref={ref} className={`edit-cell${compact ? " compact" : ""}`} aria-label={label} value={value} placeholder={placeholder} rows={1} onChange={(event) => onChange(event.target.value)} />;
}

// True below the phone breakpoint. The planner shows one grade at a time there,
// because three grade columns cannot share a 375px screen.
function useIsNarrow(query = "(max-width: 720px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}

function PlanView({ classes, activeClassId, initialPlan, teacherName, schoolName, onSchoolNameChange, onSave, onTeach, onBack, onSetUpClass, onGabayContext }: { classes: TeachingClass[]; activeClassId: string; initialPlan?: SavedPlan; teacherName: string; schoolName: string; onSchoolNameChange: (name: string) => void; onSave: (plan: SavedPlan) => void; onTeach: (plan: SavedPlan) => void; onBack: () => void; onSetUpClass: () => void; onGabayContext: (context: GabayLiveContext) => void }) {
  const [selectedClassId, setSelectedClassId] = useState(initialPlan?.classId || activeClassId || classes[0]?.id || "");
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const emptyByGrade = (list: GradeLevel[]) => Object.fromEntries(list.map((grade) => [grade, ""]));
  const [grades, setGrades] = useState(initialPlan?.grades || selectedClass?.grades || []);
  const [subject, setSubject] = useState(initialPlan?.subject || selectedClass?.subjects[0] || "");
  const [quarter, setQuarter] = useState(initialPlan?.quarter || "Quarter 1");
  const [duration, setDuration] = useState(String(durationMinutes(initialPlan?.duration || 80)));
  const [startTime, setStartTime] = useState(initialPlan?.startTime || selectedClass?.startTime || "8:00 AM");
  const [language, setLanguage] = useState(initialPlan?.language || "English & Filipino");
  const [lessonTitle, setLessonTitle] = useState(initialPlan?.title || "");
  const [planId] = useState(initialPlan?.id || crypto.randomUUID());
  const [teachingDate, setTeachingDate] = useState(initialPlan?.teachingDate || new Date().toLocaleDateString("en-CA"));
  const [competencies, setCompetencies] = useState<Record<GradeLevel, string>>(initialPlan?.competencies || emptyByGrade(selectedClass?.grades || []));
  const [competencyCodes, setCompetencyCodes] = useState<Record<GradeLevel, string>>(initialPlan?.competencyCodes || emptyByGrade(selectedClass?.grades || []));
  const [contentStandards, setContentStandards] = useState<Record<GradeLevel, string>>(initialPlan?.contentStandards || emptyByGrade(selectedClass?.grades || []));
  const [performanceStandards, setPerformanceStandards] = useState<Record<GradeLevel, string>>(initialPlan?.performanceStandards || emptyByGrade(selectedClass?.grades || []));
  const [sharedTheme, setSharedTheme] = useState(initialPlan?.sharedTheme || "");
  const [multigradeModel, setMultigradeModel] = useState(initialPlan?.multigradeModel || "Same Theme, Different Task (STDT)");
  const [objectives, setObjectives] = useState<Record<GradeLevel, string>>(initialPlan?.objectives || emptyByGrade(selectedClass?.grades || []));
  const [learnerContext, setLearnerContext] = useState(initialPlan?.learnerContext || "");
  const [materials, setMaterials] = useState(initialPlan?.materials || "");
  const [formativeAssessments, setFormativeAssessments] = useState<Record<GradeLevel, string>>(initialPlan?.formativeAssessments || emptyByGrade(selectedClass?.grades || []));
  const [exitTasks, setExitTasks] = useState<Record<GradeLevel, string>>(initialPlan?.exitTasks || emptyByGrade(selectedClass?.grades || []));
  const [successCriteria, setSuccessCriteria] = useState<Record<GradeLevel, string>>(initialPlan?.successCriteria || emptyByGrade(selectedClass?.grades || []));
  const [reflectionQuestions, setReflectionQuestions] = useState<Record<GradeLevel, string>>(initialPlan?.reflectionQuestions || emptyByGrade(selectedClass?.grades || []));
  const [remediations, setRemediations] = useState<Record<GradeLevel, string>>(initialPlan?.remediations || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, initialPlan?.remediation || ""])));
  const [enrichments, setEnrichments] = useState<Record<GradeLevel, string>>(initialPlan?.enrichments || Object.fromEntries((selectedClass?.grades || []).map((grade) => [grade, initialPlan?.enrichment || ""])));
  const [nextSessionNotes, setNextSessionNotes] = useState(initialPlan?.nextSessionNotes || "");
  const [schoolHeadName, setSchoolHeadName] = useState(initialPlan?.schoolHeadName || "");
  const [draftNotes, setDraftNotes] = useState(initialPlan?.draftNotes || "");
  const [topicPrompt, setTopicPrompt] = useState("");
  const topicRef = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<PlanSlot[]>(initialPlan?.slots || createSchedule(selectedClass?.grades || [], selectedClass?.startTime, initialPlan?.duration || "80 minutes"));
  const [saved, setSaved] = useState(false);
  const [setupOpen, setSetupOpen] = useState(!initialPlan);
  const narrow = useIsNarrow();
  const [mobileGrade, setMobileGrade] = useState<GradeLevel>((initialPlan?.grades || selectedClass?.grades || [])[0] || "");
  const shownGrades = narrow ? grades.filter((grade) => grade === (grades.includes(mobileGrade) ? mobileGrade : grades[0])) : grades;
  const [draftingGrade, setDraftingGrade] = useState("");
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [draftingFullPlan, setDraftingFullPlan] = useState(false);
  const [previousDraft, setPreviousDraft] = useState<SavedPlan | null>(null);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [docxError, setDocxError] = useState("");
  const [fullPlanDraftError, setFullPlanDraftError] = useState("");
  const [printingPlan, setPrintingPlan] = useState(false);
  const documentRef = useRef<HTMLElement>(null);
  const incompletePlanSections = useMemo(() => [
    !subject.trim() && "lesson subject",
    !grades.every((grade) => competencies[grade]?.trim() || objectives[grade]?.trim()) && "grade-level intentions",
    !slots.some((slot) => Object.values(slot.gradeTasks).some((task) => task.trim())) && "learning experience",
    !grades.every((grade) => formativeAssessments[grade]?.trim()) && "assessment",
  ].filter(Boolean) as string[], [competencies, formativeAssessments, grades, objectives, slots, subject]);
  const plannedMinutes = slotsTotalMinutes(slots);
  const targetMinutes = durationMinutes(duration);
  const printedDate = teachingDate ? new Date(`${teachingDate}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "";

  useEffect(() => {
    onGabayContext({
      view: "plan",
      pageStep: setupOpen ? "Lesson setup" : "Editing the lesson plan document",
      classId: selectedClass?.id,
      className: selectedClass?.name,
      gradeLevels: grades,
      subjects: selectedClass?.subjects || [],
      learnerCount: selectedClass?.learners.length || 0,
      subject,
      lessonTopic: lessonTitle || "Untitled lesson",
      lessonDuration: `${targetMinutes} minutes starting at ${startTime}`,
      language,
      incompleteSections: incompletePlanSections,
      currentSummary: [`Language: ${language}`, `Multigrade approach: ${multigradeModel}`, sharedTheme ? `Shared theme: ${sharedTheme}` : "No shared theme entered", ...grades.map((grade) => `${gradeLabel(grade)} competency: ${competencies[grade]?.trim() || "blank"}; objective: ${objectives[grade]?.trim() || "blank"}`), saved ? "Draft is saved" : "Draft has unsaved changes"],
      availableActions: ["Draft the whole plan with Gabay", "Edit any cell of the plan directly", "Redraft one grade's intentions or assessment", "Download as Word or print to PDF", "Save the lesson"],
    });
  }, [competencies, grades, incompletePlanSections, language, lessonTitle, multigradeModel, objectives, onGabayContext, saved, selectedClass, setupOpen, sharedTheme, startTime, subject, targetMinutes]);

  useEffect(() => {
    function finishPrinting() { setPrintingPlan(false); }
    window.addEventListener("afterprint", finishPrinting);
    return () => window.removeEventListener("afterprint", finishPrinting);
  }, []);

  function touch() { setSaved(false); }
  function setGradeField(setter: React.Dispatch<React.SetStateAction<Record<GradeLevel, string>>>) {
    return (grade: GradeLevel, value: string) => { setter((current) => ({ ...current, [grade]: value })); touch(); };
  }
  const gradeSetters = {
    contentStandards: setGradeField(setContentStandards), performanceStandards: setGradeField(setPerformanceStandards), competencies: setGradeField(setCompetencies), competencyCodes: setGradeField(setCompetencyCodes), objectives: setGradeField(setObjectives),
    formativeAssessments: setGradeField(setFormativeAssessments), exitTasks: setGradeField(setExitTasks), successCriteria: setGradeField(setSuccessCriteria),
    reflectionQuestions: setGradeField(setReflectionQuestions), remediations: setGradeField(setRemediations), enrichments: setGradeField(setEnrichments),
  };

  function updateGrades(next: GradeLevel[]) {
    setGrades(next);
    const keep = (items: Record<GradeLevel, string>) => Object.fromEntries(next.map((item) => [item, items[item] || ""]));
    setCompetencies(keep); setCompetencyCodes(keep); setContentStandards(keep); setPerformanceStandards(keep); setObjectives(keep);
    setFormativeAssessments(keep); setExitTasks(keep); setSuccessCriteria(keep); setReflectionQuestions(keep); setRemediations(keep); setEnrichments(keep);
    setSlots((current) => current.map((slot) => ({ ...slot, gradeTasks: keep(slot.gradeTasks) })));
    touch();
  }

  function chooseClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId);
    setSelectedClassId(classId);
    if (!nextClass) return;
    setGrades(nextClass.grades);
    setSubject(nextClass.subjects[0] || "");
    setStartTime(nextClass.startTime);
    const blank = emptyByGrade(nextClass.grades);
    setCompetencies(blank); setCompetencyCodes(blank); setContentStandards(blank); setPerformanceStandards(blank); setObjectives(blank);
    setFormativeAssessments(blank); setExitTasks(blank); setSuccessCriteria(blank); setReflectionQuestions(blank); setRemediations(blank); setEnrichments(blank);
    setSlots(createSchedule(nextClass.grades, nextClass.startTime, duration));
    touch();
  }

  function changeStartTime(value: string) {
    setStartTime(value);
    setSlots((current) => retimeSlots(current, value));
    touch();
  }

  function updateSlot(slotId: string, patch: Partial<PlanSlot>) {
    setSlots((current) => retimeSlots(current.map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot), startTime));
    touch();
  }

  function updateGradeTask(slotId: string, grade: GradeLevel, value: string) {
    setSlots((current) => current.map((slot) => slot.id === slotId ? { ...slot, gradeTasks: { ...slot.gradeTasks, [grade]: value } } : slot));
    touch();
  }

  function updateWholeClassTask(slotId: string, value: string) {
    setSlots((current) => current.map((slot) => slot.id === slotId ? withWholeClassTask(slot, grades, value) : slot));
    touch();
  }

  function setSlotWholeClass(slotId: string, wholeClass: boolean) {
    setSlots((current) => current.map((slot) => {
      if (slot.id !== slotId) return slot;
      return wholeClass ? withWholeClassTask(slot, grades, wholeClassTask(slot)) : { ...slot, wholeClass: false };
    }));
    touch();
  }

  function addSlot(afterId?: string) {
    setSlots((current) => {
      const index = afterId ? current.findIndex((slot) => slot.id === afterId) : current.length - 1;
      const fresh: PlanSlot = { id: `slot-${Date.now()}`, time: startTime, stage: "Application", durationMinutes: 10, wholeClass: false, teacherFocus: "Independent work", gradeTasks: emptyByGrade(grades) };
      return retimeSlots([...current.slice(0, index + 1), fresh, ...current.slice(index + 1)], startTime);
    });
    touch();
  }

  function removeSlot(slotId: string) {
    setSlots((current) => current.length === 1 ? current : retimeSlots(current.filter((slot) => slot.id !== slotId), startTime));
    touch();
  }

  function resetTeachingFlow() {
    setSlots(createSchedule(grades, startTime, duration));
    touch();
  }

  const topicReady = Boolean(lessonTitle.trim());

  // Gabay cannot write a specific plan for "Mathematics". Without a topic the
  // draft buttons lead the teacher to the topic field instead of calling the API.
  function requireTopic(): boolean {
    if (topicReady) { setTopicPrompt(""); return true; }
    setSetupOpen(true);
    setTopicPrompt("Tell Gabay what this lesson is about first — the more specific, the better the plan.");
    window.requestAnimationFrame(() => { topicRef.current?.focus(); topicRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); });
    return false;
  }

  function draftContext(pageStep: string, summary: string[]): GabayPageContext {
    return {
      view: "plan",
      pageStep,
      classId: selectedClass?.id,
      className: selectedClass?.name,
      gradeLevels: grades,
      subjects: selectedClass?.subjects || [],
      learnerCount: selectedClass?.learners.length || 0,
      subject,
      lessonTopic: lessonTitle.trim(),
      lessonDuration: `${targetMinutes} minutes starting at ${startTime}`,
      language,
      incompleteSections: incompletePlanSections,
      currentSummary: [...(draftNotes.trim() ? [`Teacher's notes for this draft: ${draftNotes.trim()}`] : []), ...summary],
      availableActions: ["Edit any field directly", "Redraft again", "Save the lesson"],
      offline: typeof navigator !== "undefined" && !navigator.onLine,
    };
  }

  function draftFailure(reason: string, what: string) {
    return reason === "not-signed-in" ? `Sign in to let Gabay draft ${what}.` : reason === "busy" ? "Gabay is helping many teachers right now. Please try again shortly." : `Gabay could not draft ${what} right now. Your work is unchanged.`;
  }

  // A single grade's section is redrafted in place; the teacher asked for it and
  // can keep typing over the result.
  async function redraftGrade(type: "intentions" | "assessment", grade: GradeLevel) {
    if (!selectedClass || draftingGrade || !requireTopic()) return;
    const key = `${type}:${grade}`;
    setDraftingGrade(key);
    setCellErrors((current) => ({ ...current, [key]: "" }));
    const result = await requestGabayDraft(type, draftContext(`${type === "intentions" ? "Intentions" : "Assessment"} · ${gradeLabel(grade)}`, [`Drafting only for ${gradeLabel(grade)}`, sharedTheme ? `Shared theme: ${sharedTheme}` : "No shared theme entered", ...(type === "assessment" ? [`Competency: ${competencies[grade] || "blank"}`, `Objective: ${objectives[grade] || "blank"}`] : [])]), gradeLabel(grade));
    setDraftingGrade("");
    if (!result.connected) { setCellErrors((current) => ({ ...current, [key]: draftFailure(result.reason, `${gradeLabel(grade)} ${type}`) })); return; }
    if (result.draft.type === "intentions") {
      setCompetencies((current) => ({ ...current, [grade]: result.draft.type === "intentions" ? result.draft.competency : current[grade] }));
      setObjectives((current) => ({ ...current, [grade]: result.draft.type === "intentions" ? result.draft.objective : current[grade] }));
    }
    if (result.draft.type === "assessment") {
      const draft = result.draft;
      setFormativeAssessments((current) => ({ ...current, [grade]: draft.formativeAssessment }));
      setExitTasks((current) => ({ ...current, [grade]: draft.exitTask }));
      setSuccessCriteria((current) => ({ ...current, [grade]: draft.successCriteria }));
    }
    touch();
  }

  async function draftCompletePlan() {
    if (!selectedClass || draftingFullPlan || !requireTopic()) return;
    setDraftingFullPlan(true);
    setFullPlanDraftError("");
    const result = await requestGabayDraft("full-plan", draftContext("Complete ILAW draft", [`Quarter: ${quarter}`, `Language: ${language}`, `Multigrade approach: ${multigradeModel}`, ...grades.map((grade) => `${gradeLabel(grade)} competency: ${competencies[grade]?.trim() || "blank"}; objective: ${objectives[grade]?.trim() || "blank"}`)]), "");
    setDraftingFullPlan(false);
    if (!result.connected) { setFullPlanDraftError(draftFailure(result.reason, "the complete plan")); return; }
    if (result.draft.type !== "full-plan") return;
    // Apply straight away. The teacher asked for a plan and should see one, not a
    // second button. Their own draft, if they had one, stays one click away.
    if (currentPlan && planHasTeacherContent(currentPlan)) setPreviousDraft(currentPlan);
    applyCompletePlan(result.draft);
    setSetupOpen(false);
    window.requestAnimationFrame(() => documentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function restorePreviousDraft() {
    if (!previousDraft) return;
    applyPlanFields(previousDraft);
    setPreviousDraft(null);
    touch();
  }

  function applyPlanFields(source: SavedPlan) {
    const pick = (record?: Record<GradeLevel, string>) => Object.fromEntries(grades.map((grade) => [grade, record?.[grade] || ""]));
    setSharedTheme(source.sharedTheme || "");
    setLearnerContext(source.learnerContext || "");
    setMaterials(source.materials || "");
    setNextSessionNotes(source.nextSessionNotes || "");
    setCompetencies(pick(source.competencies)); setCompetencyCodes(pick(source.competencyCodes)); setContentStandards(pick(source.contentStandards)); setPerformanceStandards(pick(source.performanceStandards)); setObjectives(pick(source.objectives));
    setFormativeAssessments(pick(source.formativeAssessments)); setExitTasks(pick(source.exitTasks)); setSuccessCriteria(pick(source.successCriteria));
    setReflectionQuestions(pick(source.reflectionQuestions)); setRemediations(pick(source.remediations)); setEnrichments(pick(source.enrichments));
    setSlots(retimeSlots(source.slots, startTime));
  }

  function applyCompletePlan(draft: Extract<GabayDraft, { type: "full-plan" }>) {
    const gradeDraft = (grade: GradeLevel) => draft.grades[grade] || draft.grades[gradeLabel(grade)];
    const fromDraft = (field: keyof NonNullable<ReturnType<typeof gradeDraft>>) => Object.fromEntries(grades.map((grade) => [grade, gradeDraft(grade)?.[field] || ""]));
    setSharedTheme(draft.sharedTheme);
    setLearnerContext(draft.learnerContext);
    setMaterials(draft.materials);
    setNextSessionNotes(draft.nextSessionNotes);
    setCompetencies(fromDraft("competency")); setCompetencyCodes(fromDraft("competencyCode")); setContentStandards(fromDraft("contentStandard")); setPerformanceStandards(fromDraft("performanceStandard")); setObjectives(fromDraft("objective"));
    setFormativeAssessments(fromDraft("formativeAssessment")); setExitTasks(fromDraft("exitTask")); setSuccessCriteria(fromDraft("successCriteria"));
    setReflectionQuestions(fromDraft("reflectionQuestion")); setRemediations(fromDraft("remediation")); setEnrichments(fromDraft("enrichment"));
    setSlots(retimeSlots(draft.slots.map((slot, index) => {
      const gradeTasks = Object.fromEntries(grades.map((grade) => [grade, slot.gradeTasks[grade] || slot.gradeTasks[gradeLabel(grade)] || ""]));
      const built: PlanSlot = { id: `slot-gabay-${Date.now()}-${index}`, time: startTime, stage: slot.stage, durationMinutes: slot.durationMinutes, teacherFocus: slot.teacherFocus, gradeTasks };
      return { ...built, wholeClass: /all grades|whole[- ]class|buong klase/i.test(slot.teacherFocus + " " + slot.stage) || slotIsWholeClass(built) };
    }), startTime));
    touch();
  }

  const currentPlan: SavedPlan | null = selectedClass ? {
    id: planId, classId: selectedClass.id, title: lessonTitle.trim() || "Untitled lesson", subject, quarter, grades, duration: `${targetMinutes} minutes`, startTime, language, teachingDate,
    competencies, competencyCodes, contentStandards, performanceStandards, sharedTheme, multigradeModel, objectives, learnerContext, materials,
    formativeAssessments, exitTasks, successCriteria, reflectionQuestions, remediations, enrichments,
    reflection: Object.values(reflectionQuestions).filter(Boolean).join("\n"), remediation: Object.values(remediations).filter(Boolean).join("\n"), enrichment: Object.values(enrichments).filter(Boolean).join("\n"),
    nextSessionNotes, schoolHeadName, draftNotes, slots, savedAt: "just now",
  } : null;

  function saveCurrentPlan(openTeachingView = false) {
    if (!currentPlan) return;
    onSave(currentPlan);
    setSaved(true);
    if (openTeachingView) onTeach(currentPlan);
  }

  function exportCurrentPlan() {
    if (!currentPlan) return;
    onSave(currentPlan);
    setSaved(true);
    setPrintingPlan(true);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  }

  async function downloadCurrentPlanDocx() {
    if (!currentPlan || !selectedClass || downloadingDocx) return;
    onSave(currentPlan);
    setSaved(true);
    setDownloadingDocx(true);
    setDocxError("");
    try {
      // The Word library is only needed here, so it stays out of the main bundle.
      const { ilawDocumentBlob, ilawDocumentFileName } = await import("@/lib/ilaw-docx");
      const blob = await ilawDocumentBlob(currentPlan, selectedClass, teacherName, schoolName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = ilawDocumentFileName(currentPlan);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setDocxError("The Word file could not be prepared. Printing to PDF still works.");
    } finally {
      setDownloadingDocx(false);
    }
  }

  if (!classes.length) {
    return <section className="class-zero-state compact-zero"><span className="zero-icon">＋</span><div><p className="eyebrow">PLAN A LESSON</p><h2>Set up a class first</h2><p>Kalinga uses its grade levels, subjects, and schedule to start the lesson for you.</p></div><div className="zero-actions"><button className="primary-button" type="button" onClick={onSetUpClass}>Set up a class</button><button className="secondary-button" type="button" onClick={onBack}>Back to Today</button></div></section>;
  }

  const gradeRow = (label: string, field: keyof typeof gradeSetters, placeholder: string, extra?: (grade: GradeLevel) => React.ReactNode) => {
    const values = { contentStandards, performanceStandards, competencies, competencyCodes, objectives, formativeAssessments, exitTasks, successCriteria, reflectionQuestions, remediations, enrichments }[field];
    return <tr><th>{label}</th>{shownGrades.map((grade) => <td key={grade}><EditCell label={`${label} for ${gradeLabel(grade)}`} value={values[grade] || ""} placeholder={placeholder} onChange={(value) => gradeSetters[field](grade, value)} />{extra?.(grade)}</td>)}</tr>;
  };

  const redraftButton = (type: "intentions" | "assessment", grade: GradeLevel) => {
    const key = `${type}:${grade}`;
    return <div className="cell-tools"><button type="button" className="cell-gabay" disabled={Boolean(draftingGrade)} onClick={() => redraftGrade(type, grade)}>{draftingGrade === key ? "Gabay is drafting…" : "↻ Redraft with Gabay"}</button>{cellErrors[key] && <small role="alert">{cellErrors[key]}</small>}</div>;
  };

  return (
    <div className={`view-page plan-page${printingPlan ? " ilaw-print-mode" : ""}`}>
      <PageIntro eyebrow="MULTIGRADE LESSON PLAN" title={lessonTitle.trim() || "New lesson plan"} description="Set four things, let Gabay draft, then edit the plan exactly where it prints." action={<button className="secondary-button" type="button" onClick={onBack}>← Today</button>} />

      <section className={`plan-setup${setupOpen ? " open" : ""}`}>
        {setupOpen ? <>
          <div className="plan-setup-grid">
            <label>Class<select value={selectedClassId} onChange={(event) => chooseClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Subject<input list="plan-subjects" value={subject} onChange={(event) => { setSubject(event.target.value); touch(); }} placeholder="e.g. Filipino" /><datalist id="plan-subjects">{[...new Set([...(selectedClass?.subjects || []), ...commonSubjects])].map((item) => <option value={item} key={item} />)}</datalist></label>
            <label className={topicPrompt ? "needs-topic" : ""}>Lesson topic <small>Needed for Gabay</small><input ref={topicRef} value={lessonTitle} onChange={(event) => { setLessonTitle(event.target.value); if (event.target.value.trim()) setTopicPrompt(""); touch(); }} placeholder="e.g. Adding fractions with like denominators" /></label>
            <label>Teaching date<input type="date" value={teachingDate} onChange={(event) => { setTeachingDate(event.target.value); touch(); }} /></label>
          </div>
          {topicPrompt && <p className="topic-prompt" role="alert">{topicPrompt}</p>}
          <label className="plan-setup-notes">Anything Gabay should know <small>Optional</small><textarea rows={2} value={draftNotes} onChange={(event) => { setDraftNotes(event.target.value); touch(); }} placeholder="e.g. Grade 3 still struggles with regrouping. No printer. We have bottle caps and a chalkboard." /></label>
          <details className="plan-setup-more">
            <summary><span>{quarter} · {startTime} · {targetMinutes} min · {language} · {multigradeModel}</span><b>Change</b></summary>
            <div className="plan-setup-grid">
              <label>Quarter<select value={quarter} onChange={(event) => { setQuarter(event.target.value); touch(); }}>{["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <div className="field-group"><span className="field-label">Starts at</span><TimePicker value={startTime} onChange={changeStartTime} /></div>
              <label>Total class time<div className="duration-input"><input type="number" min={10} max={240} value={duration} onChange={(event) => { setDuration(event.target.value); touch(); }} /><span>minutes</span></div></label>
              <label>Language<select value={language} onChange={(event) => { setLanguage(event.target.value); touch(); }}>{["English & Filipino", "Filipino", "English", "Mother Tongue & Filipino"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Multigrade model<select value={multigradeModel} onChange={(event) => { setMultigradeModel(event.target.value); touch(); }}>{["Same Theme, Different Task (STDT)", "Same Topic, Same Task (STST)", "Different Topic, Different Task (DTDT)", "Peer-led rotation"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <div className="field-group wide"><span className="field-label">Grades in this lesson</span><GradeLevelPicker value={grades} onChange={updateGrades} /></div>
            </div>
          </details>
          <footer>
            <button className="gabay-draft-button toolbar-gabay" type="button" disabled={draftingFullPlan || !subject.trim() || !grades.length} onClick={draftCompletePlan}><GabayMascot size="small" motion={!draftingFullPlan} />{draftingFullPlan ? "Gabay is drafting the whole plan…" : topicReady ? "Draft the whole plan with Gabay" : "Add a topic to draft with Gabay"}</button>
            <button className="secondary-button" type="button" onClick={() => setSetupOpen(false)}>I’ll write it myself</button>
          </footer>
        </> : <button type="button" className="plan-setup-summary" onClick={() => setSetupOpen(true)}><span><b>{selectedClass?.name}</b> · {subject || "No subject"} · {printedDate || "No date"} · {quarter} · {startTime} · {targetMinutes} min · {language}</span><b>Change setup</b></button>}
        {fullPlanDraftError && <p className="gabay-draft-error" role="alert">{fullPlanDraftError}</p>}
      </section>

      <div className="plan-toolbar">
        <div>
          <span className="pill orange">{saved ? "SAVED" : "UNSAVED"}</span>
          {plannedMinutes !== targetMinutes && <span className="plan-time-warning">Blocks add up to {plannedMinutes} min; the lesson is {targetMinutes} min.</span>}
        </div>
        <div>
          {!setupOpen && <button className="gabay-draft-button toolbar-gabay" type="button" disabled={draftingFullPlan} onClick={draftCompletePlan}><GabayMascot size="small" motion={!draftingFullPlan} />{draftingFullPlan ? "Drafting…" : topicReady ? "Draft with Gabay" : "Add a topic to draft"}</button>}
          <button className="secondary-button" type="button" onClick={exportCurrentPlan}>Print / PDF</button>
          <button className="secondary-button" type="button" disabled={downloadingDocx} onClick={downloadCurrentPlanDocx}>{downloadingDocx ? "Preparing…" : "Download Word"}</button>
          <button className="feature-button" type="button" onClick={() => saveCurrentPlan(true)}><span className="feature-icon" aria-hidden="true">▷</span> Teach this lesson</button>
          <button className="primary-button" type="button" onClick={() => saveCurrentPlan()}>{saved ? "✓ Saved" : "Save lesson"}</button>
        </div>
      </div>
      {previousDraft && <p className="draft-restore" role="status">Gabay’s draft replaced what you had written. <button type="button" onClick={restorePreviousDraft}>Restore my previous draft</button></p>}
      {docxError && <p className="gabay-draft-error" role="alert">{docxError}</p>}

      {narrow && grades.length > 1 && <nav className="grade-switcher" aria-label="Grade shown">{grades.map((grade) => <button type="button" className={shownGrades.includes(grade) ? "active" : ""} aria-pressed={shownGrades.includes(grade)} onClick={() => setMobileGrade(grade)} key={grade}>{gradeLabel(grade)}</button>)}<small>Showing one grade at a time on this screen. The export includes all grades.</small></nav>}

      {selectedClass && <article className={`ilaw-export-document ilaw-export-inline ilaw-editor${narrow ? " narrow" : ""}`} ref={documentRef}>
        <header className="ilaw-print-title"><p>{planTitleLine(grades)}</p><input className="ilaw-title-input" aria-label="Lesson title" value={lessonTitle} placeholder="Untitled lesson" onChange={(event) => { setLessonTitle(event.target.value); touch(); }} /></header>
        <table className="ilaw-print-meta"><tbody>
          <tr><th>School</th><td><input className="cell-input" aria-label="School" value={schoolName} placeholder="School name" onChange={(event) => onSchoolNameChange(event.target.value)} /></td><th>Grade Levels</th><td>{gradeList(grades)}</td></tr>
          <tr><th>Teacher</th><td>{teacherName}</td><th>Learning Area</th><td>{subject || "—"}</td></tr>
          <tr><th>Teaching Date</th><td>{printedDate || "Not set"}</td><th>Quarter/Term</th><td>{quarter}</td></tr>
          <tr><th>Time / Sessions</th><td>1 session, {targetMinutes} minutes · {startTime}</td><th>No. of Learners</th><td>{learnerCountSummary(selectedClass, grades)}</td></tr>
          <tr><th>Multigrade Model</th><td colSpan={3}><EditCell compact label="Multigrade model" value={multigradeModel} placeholder="e.g. Same Theme, Different Task (STDT) with a Grade 4 peer leader supporting Grade 3" onChange={(value) => { setMultigradeModel(value); touch(); }} /></td></tr>
        </tbody></table>

        <section className="ilaw-print-section"><h2><span>I</span> Intentions</h2>
          <p><b>Shared Sub-theme:</b> <EditCell compact label="Shared sub-theme" value={sharedTheme} placeholder="The theme every grade works under this session" onChange={(value) => { setSharedTheme(value); touch(); }} /></p>
          <table><thead><tr><th />{shownGrades.map((grade) => <th key={grade}>{gradeLabel(grade).toUpperCase()}</th>)}</tr></thead><tbody>
            {gradeRow("Pamantayang Pangnilalaman (Content Standard)", "contentStandards", "Naipamamalas ng mag-aaral ang…")}
            {gradeRow("Pamantayan sa Pagganap (Performance Standard)", "performanceStandards", "Nagagamit ng mag-aaral ang…")}
            {gradeRow("Learning Competencies and Codes", "competencies", "The competency for this grade", (grade) => <><input className="cell-input code" aria-label={`Competency code for ${gradeLabel(grade)}`} value={competencyCodes[grade] || ""} placeholder="Code, e.g. F3PB-Ia-1" onChange={(event) => gradeSetters.competencyCodes(grade, event.target.value)} />{redraftButton("intentions", grade)}</>)}
            {gradeRow("Learning Objectives", "objectives", "What learners will be able to do by the end")}
          </tbody></table>
        </section>

        <section className="ilaw-print-section"><h2><span>L</span> Learning Experience</h2>
          <div className="ilaw-print-notes">
            <p><b>Learner Context:</b> <EditCell compact label="Learner context" value={learnerContext} placeholder="Who these learners are and what they bring to this lesson" onChange={(value) => { setLearnerContext(value); touch(); }} /></p>
            <p><b>Instructional Materials and Resources:</b> <EditCell compact label="Instructional materials and resources" value={materials} placeholder={"Mga Kagamitan: …\nMga Sanggunian: …"} onChange={(value) => { setMaterials(value); touch(); }} /></p>
          </div>
          {narrow ? <div className="flow-blocks">
            {slots.map((slot, index) => <article className="flow-block" key={slot.id}>
              <header><b>{slot.time}</b><label><input type="number" min={1} max={240} aria-label="Minutes" value={slot.durationMinutes || 10} onChange={(event) => updateSlot(slot.id, { durationMinutes: Math.max(1, Number(event.target.value) || 1) })} /> min</label><span className="flow-block-index">Block {index + 1}</span></header>
              <input className="cell-input strong" list="ilaw-stages" aria-label="Stage" value={slot.stage || ""} placeholder="Stage (e.g. Motivation)" onChange={(event) => updateSlot(slot.id, { stage: event.target.value })} />
              <input className="cell-input" list="ilaw-focus" aria-label="Teacher focus" value={slot.teacherFocus} placeholder="Who the teacher is with" onChange={(event) => updateSlot(slot.id, { teacherFocus: event.target.value })} />
              <label className="whole-class-toggle"><input type="checkbox" checked={slotIsWholeClass(slot)} onChange={(event) => setSlotWholeClass(slot.id, event.target.checked)} /> Whole class does this together</label>
              {slotIsWholeClass(slot)
                ? <label className="flow-block-task"><span>Whole-class activity</span><EditCell label={`Whole-class activity at ${slot.time}`} value={wholeClassTask(slot)} placeholder="What the whole class does together" onChange={(value) => updateWholeClassTask(slot.id, value)} /></label>
                : shownGrades.map((grade) => <label className="flow-block-task" key={grade}><span>{gradeLabel(grade)} activity</span><EditCell label={`${gradeLabel(grade)} activity at ${slot.time}`} value={slot.gradeTasks[grade] || ""} placeholder={`What ${gradeLabel(grade)} does in this block`} onChange={(value) => updateGradeTask(slot.id, grade, value)} /></label>)}
              <footer><button type="button" onClick={() => addSlot(slot.id)}>＋ Add block below</button><button type="button" disabled={slots.length === 1} onClick={() => removeSlot(slot.id)}>Remove</button></footer>
            </article>)}
          </div> : <><p className="flow-heading"><b>Flow of the Lesson</b></p><table className="ilaw-flow-table"><thead><tr><th>Time</th><th>Stage</th>{grades.map((grade) => <th key={grade}>{gradeLabel(grade).toUpperCase()}</th>)}<th className="row-tools-head" aria-label="Row actions" /></tr></thead><tbody>
            {slots.map((slot) => <tr key={slot.id}>
              <td className="flow-time"><b>{slot.time}</b><label><input type="number" min={1} max={240} aria-label="Minutes" value={slot.durationMinutes || 10} onChange={(event) => updateSlot(slot.id, { durationMinutes: Math.max(1, Number(event.target.value) || 1) })} /> min</label></td>
              <td className="flow-stage"><EditCell label="Stage" compact value={slot.stage || ""} placeholder="Stage, e.g. Direct Teaching" onChange={(value) => updateSlot(slot.id, { stage: value })} /><EditCell label="Teacher focus" compact value={slot.teacherFocus} placeholder="Who the teacher is with" onChange={(value) => updateSlot(slot.id, { teacherFocus: value })} /><label className="whole-class-toggle"><input type="checkbox" checked={slotIsWholeClass(slot)} onChange={(event) => setSlotWholeClass(slot.id, event.target.checked)} /> Whole class</label></td>
              {slotIsWholeClass(slot)
                ? <td colSpan={grades.length} className="whole-class-cell"><EditCell label={`Whole-class activity at ${slot.time}`} value={wholeClassTask(slot)} placeholder="What the whole class does together" onChange={(value) => updateWholeClassTask(slot.id, value)} /></td>
                : grades.map((grade) => <td key={grade}><EditCell label={`${gradeLabel(grade)} activity at ${slot.time}`} value={slot.gradeTasks[grade] || ""} placeholder={`${gradeLabel(grade)} activity`} onChange={(value) => updateGradeTask(slot.id, grade, value)} /></td>)}
              <td className="row-tools"><button type="button" aria-label="Add a block after this one" title="Add block below" onClick={() => addSlot(slot.id)}>＋</button><button type="button" aria-label="Remove this block" title="Remove block" disabled={slots.length === 1} onClick={() => removeSlot(slot.id)}>×</button></td>
            </tr>)}
          </tbody></table></>}
          <datalist id="ilaw-stages">{ilawStages.map((stage) => <option value={stage} key={stage} />)}</datalist>
          <datalist id="ilaw-focus">{["All grades together", ...grades.map((grade) => `Guide ${gradeLabel(grade)}`), "Independent work", "Peer-led"].map((item) => <option value={item} key={item} />)}</datalist>
          <p className="flow-footer"><button type="button" className="text-button" onClick={() => addSlot()}>＋ Add a block</button><button type="button" className="text-button" onClick={resetTeachingFlow}>Reset to the default rotation</button></p>
        </section>

        <section className="ilaw-print-section"><h2><span>A</span> Assessment</h2>
          <table><thead><tr><th />{shownGrades.map((grade) => <th key={grade}>{gradeLabel(grade).toUpperCase()}</th>)}</tr></thead><tbody>
            {gradeRow("Formative", "formativeAssessments", "How you will check understanding during the lesson", (grade) => redraftButton("assessment", grade))}
            {gradeRow("Exit Task", "exitTasks", "What each learner hands in or shows")}
            {gradeRow("Success Criteria", "successCriteria", "What a learner can do with this topic when they have got it")}
          </tbody></table>
        </section>

        <section className="ilaw-print-section ways-forward-print-section"><h2><span>W</span> Ways Forward</h2>
          <table><thead><tr><th />{shownGrades.map((grade) => <th key={grade}>{gradeLabel(grade).toUpperCase()}</th>)}</tr></thead><tbody>
            {gradeRow("Reflection Questions", "reflectionQuestions", "What you will ask yourself after teaching")}
            {gradeRow("Remediation", "remediations", "Support for learners below the target")}
            {gradeRow("Enrichment", "enrichments", "Extension for learners who are ready")}
          </tbody></table>
          <p><b>Notes for Next Session / Whole-School Follow-Up:</b> <EditCell compact label="Notes for the next session" value={nextSessionNotes} placeholder="What should continue or change next time" onChange={(value) => { setNextSessionNotes(value); touch(); }} /></p>
        </section>

        <footer className="ilaw-print-signatures"><div><span>Prepared by:</span><b>{teacherName}</b><small>Classroom Adviser</small></div><div><span>Checked by:</span><input className="cell-input signature" aria-label="School head name" value={schoolHeadName} placeholder="School head name" onChange={(event) => { setSchoolHeadName(event.target.value); touch(); }} /><small>School Head</small></div></footer>
      </article>}

      {currentPlan && selectedClass && <IlawPlanPrint plan={currentPlan} teachingClass={selectedClass} teacherName={teacherName} schoolName={schoolName} />}
    </div>
  );
}

type LibraryResource = {
  id: string;
  icon: string;
  title: string;
  type: string;
  grades: string;
  subject: string;
  tags: string[];
  description: string;
  author: string;
  pages: number;
  pdfPath: string;
  source: "starter" | "teacher";
  ownerId?: string;
  visibility?: "private" | "shared";
  reviewStatus?: string;
};

type ResourceComment = { id: string; resourceId: string; teacherId: string; teacherName: string; body: string; createdAt: string };

const starterResources: LibraryResource[] = [
  { id: "starter-math", icon: "½", title: "Fraction Market with Bottle Caps", type: "Teacher guide + learner sheet", grades: "Grades 3-5", subject: "Mathematics", tags: ["Multigrade", "No printer", "Local objects"], description: "A ready-to-teach fraction activity with differentiated grade guidance, a learner record sheet, and an exit check.", author: "Kalinga starter library", pages: 3, pdfPath: "/resources/fraction-market-bottle-cap-math.pdf", source: "starter", reviewStatus: "Kalinga starter" },
  { id: "starter-science", icon: "☘", title: "Schoolyard Plant Detectives", type: "Investigation guide + field notes", grades: "Grades 3-5", subject: "Science", tags: ["Outdoor", "Low-cost", "Evidence-based"], description: "A safe local-plant investigation with multigrade prompts, an observation table, and an evidence-based claim activity.", author: "Kalinga starter library", pages: 3, pdfPath: "/resources/schoolyard-plant-detectives-science.pdf", source: "starter", reviewStatus: "Kalinga starter" },
];

type ResourceSubmission = {
  title: string;
  subject: string;
  grades: string;
  type: string;
  description: string;
  tags: string;
  visibility: "private" | "shared";
};

const emptyResourceSubmission: ResourceSubmission = { title: "", subject: "Mathematics", grades: "", type: "Activity sheet", description: "", tags: "", visibility: "shared" };

function resourceIcon(subject: string) {
  if (/math/i.test(subject)) return "½";
  if (/science/i.test(subject)) return "☘";
  return "▤";
}

// Signed URLs last an hour, so a realtime event does not need to re-mint one for
// every resource it already holds. Retired a few minutes early to avoid handing
// out a link that expires while the reader is open.
const signedResourceUrls = new Map<string, { url: string; expiresAt: number }>();

async function signedResourceUrl(supabase: SupabaseClient, storagePath: string) {
  const cached = signedResourceUrls.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data } = await supabase.storage.from("teacher-resources").createSignedUrl(storagePath, 60 * 60);
  const url = data?.signedUrl || "";
  if (url) signedResourceUrls.set(storagePath, { url, expiresAt: Date.now() + 55 * 60_000 });
  return url;
}

async function loadTeacherResources(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("resources").select("id,owner_id,title,storage_path,visibility,metadata,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return Promise.all((data || []).filter((row) => Boolean(row.storage_path)).map(async (row): Promise<LibraryResource> => {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
    const signedUrl = await signedResourceUrl(supabase, String(row.storage_path));
    const subject = String(metadata.subject || "General");
    return {
      id: String(row.id), ownerId: String(row.owner_id), title: String(row.title), icon: resourceIcon(subject), subject,
      grades: String(metadata.grades || "Grade levels not specified"), type: String(metadata.type || "Teacher resource"),
      description: String(metadata.description || "No description was provided."), tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : [],
      author: String(metadata.author || "Kalinga teacher"), pages: Number(metadata.pages || 0), pdfPath: signedUrl,
      source: "teacher", visibility: row.visibility === "shared" ? "shared" : "private", reviewStatus: String(metadata.reviewStatus || "Community upload · not reviewed"),
    };
  }));
}

function LibraryView({ classes, activeClassId, authenticated, teacherAccountId, teacherName, onSetUpClass, onRequestSignIn, onOpenCommunity, onGabayContext }: { classes: TeachingClass[]; activeClassId: string; authenticated: boolean; teacherAccountId: string; teacherName: string; onSetUpClass: () => void; onRequestSignIn: () => void; onOpenCommunity: (resourceId: string) => void; onGabayContext: (context: GabayLiveContext) => void }) {
  const [filter, setFilter] = useState<"all" | "Mathematics" | "Science">("all");
  const [libraryError, setLibraryError] = useState("");
  const [previewResource, setPreviewResource] = useState<LibraryResource>();
  const [teacherResources, setTeacherResources] = useState<LibraryResource[]>([]);
  const [comments, setComments] = useState<ResourceComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [submission, setSubmission] = useState<ResourceSubmission>(emptyResourceSubmission);
  const [submissionFile, setSubmissionFile] = useState<File>();
  const [sharingRightsConfirmed, setSharingRightsConfirmed] = useState(false);
  const activeClass = classes.find((item) => item.id === activeClassId);

  useEffect(() => {
    if (!authenticated || !teacherAccountId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    async function refresh() {
      let uploaded: LibraryResource[] = [];
      try { uploaded = await loadTeacherResources(supabase!); } catch { if (active) setLibraryError("Teacher uploads could not refresh. The starter PDFs are still available."); }
      const resourceIds = [...starterResources, ...uploaded].map((item) => item.id);
      const commentResult = await supabase!.from("resource_comments").select("id,resource_id,teacher_id,teacher_name,body,created_at").in("resource_id", resourceIds).order("created_at");
      if (!active) return;
      setTeacherResources(uploaded);
      if (commentResult.error) { setLibraryError("Teacher comments could not refresh. The PDFs are still available."); return; }
      setComments((commentResult.data || []).map((row) => ({ id: String(row.id), resourceId: String(row.resource_id), teacherId: String(row.teacher_id), teacherName: String(row.teacher_name), body: String(row.body), createdAt: String(row.created_at) })));
      setLibraryError("");
    }
    void refresh();
    const channel = supabase.channel(`resource-room-${teacherAccountId}`).on("postgres_changes", { event: "*", schema: "public", table: "resource_comments" }, () => { void refresh(); }).on("postgres_changes", { event: "*", schema: "public", table: "resources" }, () => { void refresh(); }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [authenticated, teacherAccountId]);

  const allResources = [...teacherResources, ...starterResources];
  const visible = allResources.filter((resource) => filter === "all" || resource.subject === filter);
  const previewComments = comments.filter((comment) => comment.resourceId === previewResource?.id);

  useEffect(() => {
    onGabayContext({
      view: "library", pageStep: previewResource ? `Review ${previewResource.title}` : "Choose a ready-to-use PDF resource", classId: activeClass?.id, className: activeClass?.name,
      gradeLevels: activeClass?.grades || [], subjects: activeClass?.subjects || [], learnerCount: activeClass?.learners.length || 0,
      currentSummary: [`Filter: ${filter}`, `${visible.length} resources shown`, `${teacherResources.length} teacher uploads available`, previewResource ? `${previewComments.length} teacher comments on the open resource` : "No resource is currently open"],
      availableActions: ["Help prepare a transparent resource submission", "Help adapt the Mathematics activity", "Help adapt the Science investigation", "Summarize the open PDF", "Draft a useful teacher comment"],
    });
  }, [activeClass, filter, onGabayContext, previewComments.length, previewResource, teacherResources.length, visible.length]);

  async function submitResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated || !teacherAccountId) { onRequestSignIn(); return; }
    if (!submissionFile || submissionFile.type !== "application/pdf") { setLibraryError("Choose a PDF file to submit."); return; }
    if (submissionFile.size > 20 * 1024 * 1024) { setLibraryError("The PDF must be 20 MB or smaller."); return; }
    if (submission.visibility === "shared" && !sharingRightsConfirmed) { setLibraryError("Confirm that you have permission to share this material."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSubmitting(true); setLibraryError("");
    const safeName = submissionFile.name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "teacher-resource.pdf";
    const storagePath = `${teacherAccountId}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("teacher-resources").upload(storagePath, submissionFile, { contentType: "application/pdf", upsert: false });
    if (upload.error) { setSubmitting(false); setLibraryError("The PDF could not be uploaded. Apply the latest Supabase migration, then try again."); return; }
    const metadata = {
      subject: submission.subject.trim() || "General", grades: submission.grades.trim() || "Grade levels not specified",
      type: submission.type.trim() || "Teacher resource", description: submission.description.trim(),
      tags: submission.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 8), author: teacherLabel(teacherName),
      reviewStatus: "Community upload · not reviewed", originalFileName: submissionFile.name, mimeType: submissionFile.type,
    };
    const result = await supabase.from("resources").insert({ owner_id: teacherAccountId, title: submission.title.trim(), storage_path: storagePath, visibility: submission.visibility, metadata }).select("id,owner_id,title,storage_path,visibility,metadata,created_at").single();
    if (result.error || !result.data) {
      await supabase.storage.from("teacher-resources").remove([storagePath]);
      setSubmitting(false); setLibraryError("The resource details could not be saved. The unfinished upload was removed; please try again."); return;
    }
    const uploadedSignedUrl = await signedResourceUrl(supabase, storagePath);
    const uploadedResource: LibraryResource = {
      id: String(result.data.id), ownerId: teacherAccountId, title: submission.title.trim(), icon: resourceIcon(metadata.subject), subject: metadata.subject,
      grades: metadata.grades, type: metadata.type, description: metadata.description || "No description was provided.", tags: metadata.tags,
      author: metadata.author, pages: 0, pdfPath: uploadedSignedUrl, source: "teacher", visibility: submission.visibility, reviewStatus: metadata.reviewStatus,
    };
    setTeacherResources((current) => [uploadedResource, ...current.filter((item) => item.id !== uploadedResource.id)]);
    setSubmission(emptyResourceSubmission); setSubmissionFile(undefined); setSharingRightsConfirmed(false); setSubmissionOpen(false); setSubmitting(false);
    setShareMessage(submission.visibility === "shared" ? "Resource published for signed-in teachers" : "Private resource uploaded");
    window.setTimeout(() => setShareMessage(""), 2400);
  }

  async function shareResource(resource: LibraryResource) {
    const url = /^https?:\/\//i.test(resource.pdfPath) ? resource.pdfPath : `${window.location.origin}${resource.pdfPath}`;
    try {
      if (navigator.share) await navigator.share({ title: resource.title, text: `Kalinga teacher resource: ${resource.title}`, url });
      else { await navigator.clipboard.writeText(url); setShareMessage("PDF link copied"); window.setTimeout(() => setShareMessage(""), 1800); }
    } catch {
      setShareMessage("");
    }
  }

  async function makeResourceShared(resource: LibraryResource) {
    if (!authenticated || resource.ownerId !== teacherAccountId) return;
    if (!window.confirm("Share this PDF with all signed-in Kalinga teachers? Confirm that you made it or have permission to share it.")) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("resources").update({ visibility: "shared" }).eq("id", resource.id).eq("owner_id", teacherAccountId);
    if (error) { setLibraryError("This resource could not be shared yet. Please try again."); return; }
    setTeacherResources((current) => current.map((item) => item.id === resource.id ? { ...item, visibility: "shared" } : item));
    setLibraryError(""); setShareMessage("Resource is now available to signed-in teachers");
    window.setTimeout(() => setShareMessage(""), 2400);
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!previewResource || !commentInput.trim()) return;
    if (!authenticated || !teacherAccountId) { onRequestSignIn(); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("resource_comments").insert({ resource_id: previewResource.id, teacher_id: teacherAccountId, teacher_name: teacherLabel(teacherName), body: commentInput.trim() }).select("id,resource_id,teacher_id,teacher_name,body,created_at").single();
    setSubmitting(false);
    if (error || !data) { setLibraryError("Your comment could not be posted. Please try again."); return; }
    setComments((current) => [...current, { id: String(data.id), resourceId: String(data.resource_id), teacherId: String(data.teacher_id), teacherName: String(data.teacher_name), body: String(data.body), createdAt: String(data.created_at) }]);
    setCommentInput(""); setLibraryError("");
  }

  return <div className="view-page resource-library-page">
    <PageIntro eyebrow="TEACHER RESOURCE LIBRARY" title="Open it. Teach it. Improve it together." description="Use the two Kalinga starters or submit a PDF of your own with clear classroom details." action={<button className="primary-button" type="button" onClick={() => authenticated ? setSubmissionOpen((open) => !open) : onRequestSignIn()}>＋ Upload a resource</button>} />
    {submissionOpen && <form className="resource-submission" onSubmit={submitResource}>
      <header><div><p className="eyebrow">RESOURCE SUBMISSION</p><h2>Tell teachers exactly what they are opening</h2><p>Your name, classroom fit, and sharing status stay visible. Uploading does not mean Kalinga has reviewed or approved the material.</p></div><button type="button" aria-label="Close resource submission" onClick={() => setSubmissionOpen(false)}>×</button></header>
      <div className="resource-submission-sections">
        <fieldset><legend><span>1</span> PDF and title</legend><label>PDF file <small>Required · PDF only · up to 20 MB</small><input required type="file" accept=".pdf,application/pdf" onChange={(event) => setSubmissionFile(event.target.files?.[0])} /></label><label>Resource title<input required minLength={4} maxLength={200} value={submission.title} onChange={(event) => setSubmission((current) => ({ ...current, title: event.target.value }))} placeholder="A clear, specific title" /></label></fieldset>
        <fieldset><legend><span>2</span> Classroom fit</legend><div className="resource-submission-grid"><label>Subject<select value={submission.subject} onChange={(event) => setSubmission((current) => ({ ...current, subject: event.target.value }))}>{commonSubjects.map((subject) => <option key={subject}>{subject}</option>)}<option>General</option></select></label><label>Grade levels<input required value={submission.grades} onChange={(event) => setSubmission((current) => ({ ...current, grades: event.target.value }))} placeholder="e.g. Grades 3–5" /></label><label>Material type<select value={submission.type} onChange={(event) => setSubmission((current) => ({ ...current, type: event.target.value }))}><option>Activity sheet</option><option>Teacher guide</option><option>Lesson exemplar</option><option>Assessment</option><option>Reading material</option><option>Presentation</option><option>Other</option></select></label><label>Tags <small>Comma-separated</small><input value={submission.tags} onChange={(event) => setSubmission((current) => ({ ...current, tags: event.target.value }))} placeholder="Low-cost, multigrade, offline" /></label><label className="wide">What is this and how should it be used?<textarea required minLength={20} maxLength={1200} value={submission.description} onChange={(event) => setSubmission((current) => ({ ...current, description: event.target.value }))} placeholder="Briefly explain the activity, materials needed, and anything another teacher should check first." /></label></div></fieldset>
        <fieldset><legend><span>3</span> Sharing and transparency</legend><label>Who can open this PDF?<select value={submission.visibility} onChange={(event) => setSubmission((current) => ({ ...current, visibility: event.target.value as ResourceSubmission["visibility"] }))}><option value="shared">All signed-in Kalinga teachers</option><option value="private">Only me</option></select></label><div className="submission-transparency"><p><b>Shown on the resource card</b><span>Uploaded by {teacherLabel(teacherName)} · {submission.visibility === "shared" ? "Shared with signed-in teachers" : "Private to your account"} · Community upload, not reviewed</span></p><p><b>Not shared automatically</b><span>Your classes, learners, attendance, and lesson-plan records are never added to the PDF submission.</span></p></div>{submission.visibility === "shared" && <div className="rights-check"><input id="resource-sharing-rights" type="checkbox" aria-labelledby="resource-sharing-rights-label" checked={sharingRightsConfirmed} onChange={(event) => setSharingRightsConfirmed(event.target.checked)} /><span id="resource-sharing-rights-label"><b>I made this resource or have permission to share it.</b><small>I understand other signed-in teachers can open it and discuss it.</small></span></div>}</fieldset>
      </div>
      <footer><button className="secondary-button" type="button" onClick={() => setSubmissionOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={submitting || !submissionFile || !submission.title.trim() || !submission.description.trim() || (submission.visibility === "shared" && !sharingRightsConfirmed)}>{submitting ? "Uploading…" : submission.visibility === "shared" ? "Publish resource" : "Upload privately"}</button></footer>
    </form>}
    <section className="starter-library-toolbar"><div role="tablist" aria-label="Filter resources">{[["all", "All resources"], ["Mathematics", "Mathematics"], ["Science", "Science"]].map(([value, label]) => <button role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} type="button" onClick={() => setFilter(value as typeof filter)} key={value}>{label}</button>)}</div>{activeClass ? <p><b>Matched to {activeClass.name}</b><span>{gradeList(activeClass.grades)} · {activeClass.subjects.join(", ")}</span></p> : <button type="button" onClick={onSetUpClass}>Set up a class for matching →</button>}</section>
    {libraryError && <p className="library-error" role="status">{libraryError}</p>}
    {shareMessage && <p className="resource-share-message" role="status">{shareMessage}</p>}
    <section className="resource-grid starter-resource-grid">
      {visible.map((resource) => { const resourceComments = comments.filter((comment) => comment.resourceId === resource.id); const isOwner = resource.ownerId === teacherAccountId; return <article className={`library-card starter-resource-card ${resource.subject.toLowerCase()}`} key={resource.id}><div className="library-thumb">{resource.icon}<span>{resource.subject}</span></div><div className="library-body"><div className="library-badges"><span className={resource.source === "starter" ? "verified" : "community-upload"}>{resource.source === "starter" ? `PDF · ${resource.pages} pages` : "TEACHER UPLOAD · NOT REVIEWED"}</span><span className={`resource-visibility ${resource.visibility || "shared"}`}>{resource.visibility === "private" ? "Only me" : "Shared"}</span><span>{resource.type}</span></div><h2>{resource.title}</h2><p>{resource.grades} · {resource.author}{isOwner ? " · Your resource" : ""}</p><p className="library-description">{resource.description}</p><div className="tags">{resource.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="resource-social-proof"><span><b>{resourceComments.length}</b> teacher {resourceComments.length === 1 ? "note" : "notes"}</span><span>{resource.reviewStatus || "Community upload · not reviewed"}</span></div><div className="library-actions starter-resource-actions"><button className="dark-button" type="button" disabled={!resource.pdfPath} onClick={() => setPreviewResource(resource)}>View PDF</button><button className="secondary-button" type="button" onClick={() => setPreviewResource(resource)}>Discuss</button>{resource.visibility === "private" && isOwner ? <button className="secondary-button" type="button" onClick={() => makeResourceShared(resource)}>Share with teachers</button> : <button className="secondary-button" type="button" onClick={() => onOpenCommunity(resource.id)}>Ask teachers</button>}</div></div></article>; })}
    </section>
    {previewResource && <div className="resource-preview-backdrop"><section className="resource-reader" role="dialog" aria-modal="true" aria-labelledby="resource-preview-title"><header><div><p className="eyebrow">{previewResource.subject} · PDF RESOURCE</p><h2 id="resource-preview-title">{previewResource.title}</h2></div><button type="button" aria-label="Close resource" onClick={() => { setPreviewResource(undefined); setCommentInput(""); }}>×</button></header><div className="resource-reader-layout"><div className="resource-pdf-panel"><iframe src={previewResource.pdfPath} title={`${previewResource.title} PDF`} /><a href={previewResource.pdfPath} target="_blank" rel="noreferrer">Open PDF in a new tab ↗</a></div><aside className="resource-conversation"><div className="resource-reader-actions"><a className="secondary-button" href={previewResource.pdfPath} target="_blank" rel="noreferrer">Open full PDF</a><button className="secondary-button" type="button" onClick={() => shareResource(previewResource)}>Share link</button></div><p className="resource-reader-description">{previewResource.description}</p><div className="resource-comments-heading"><b>Teacher notes</b><span>{previewComments.length}</span></div><div className="resource-comment-list">{previewComments.map((comment) => <article key={comment.id}><span className="avatar">{teacherInitials(comment.teacherName.replace(/^Teacher\s+/i, ""))}</span><p><b>{comment.teacherName} <small>{communityTime(comment.createdAt)}</small></b>{comment.body}</p></article>)}{!previewComments.length && <p>No notes yet. Add what worked, what you changed, or a question for teachers using this material.</p>}</div>{authenticated ? <form className="resource-comment-form" onSubmit={submitComment}><label className="sr-only" htmlFor="resource-comment">Comment on this resource</label><textarea id="resource-comment" maxLength={1500} value={commentInput} onChange={(event) => setCommentInput(event.target.value)} placeholder="What worked? What would you change?" /><button type="submit" disabled={!commentInput.trim() || submitting}>{submitting ? "Posting…" : "Add note"}</button><small>Keep this thread about the material. Ask broader questions in Ask Teachers.</small></form> : <button className="resource-signin-comment" type="button" onClick={onRequestSignIn}>Sign in to join the material discussion</button>}</aside></div></section></div>}
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

function AttendanceView({ classes, activeClassId, attendanceRecords, attendanceNotes, onSave, onSetUpClass, onGabayContext }: { classes: TeachingClass[]; activeClassId: string; attendanceRecords: Record<string, Record<string, string>>; attendanceNotes: Record<string, Record<string, string>>; onSave: (updates: Record<string, Record<string, string>>, noteUpdates: Record<string, Record<string, string>>) => void; onSetUpClass: () => void; onGabayContext: (context: GabayLiveContext) => void }) {
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

  const counts = learners.reduce<Record<string, number>>((total, learner) => ({ ...total, [statuses[learner.id]]: (total[statuses[learner.id]] || 0) + 1 }), {});
  const attendedCount = (counts.Present || 0) + (counts.Late || 0);
  const attendanceRate = learners.length ? Math.round((attendedCount / learners.length) * 100) : 0;

  useEffect(() => {
    onGabayContext({
      view: "attendance",
      pageStep: selectedDate === dateInputValue() ? "Today’s attendance" : "Past or future attendance date",
      classId: selectedClass?.id,
      className: selectedClass?.name,
      gradeLevels: selectedClass?.grades || [],
      subjects: selectedClass?.subjects || [],
      learnerCount: selectedClass?.learners.length || 0,
      currentSummary: selectedClass ? [`Date: ${displayDate(selectedDate)}`, `Showing: ${gradeFilter === "all" ? "all grade levels" : gradeLabel(gradeFilter)}`, `${learners.length} learners in the current view`, `${counts.Present || 0} present`, `${counts.Late || 0} late`, `${counts.Absent || 0} absent`, `${counts.Excused || 0} excused`, `${counts.Leave || 0} on leave`, saved ? "Attendance is saved" : "Attendance has unsaved changes"] : ["No class roster is available for attendance"],
      availableActions: selectedClass ? ["Change the date", "Filter by grade", "Mark the current group present", "Save attendance"] : ["Set up a class"],
    });
  }, [counts.Absent, counts.Excused, counts.Late, counts.Leave, counts.Present, gradeFilter, learners.length, onGabayContext, saved, selectedClass, selectedDate]);

  if (!selectedClass) return <section className="class-zero-state compact-zero"><span className="zero-icon">✓</span><div><p className="eyebrow">RECORD ATTENDANCE</p><h2>Set up a class first</h2><p>Attendance needs a saved learner list and class schedule before there is anything to record.</p></div><div className="zero-actions"><button className="primary-button" type="button" onClick={onSetUpClass}>Set up a class</button></div></section>;

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
    <div className="attendance-save-bar"><span>{learners.length} learners · {counts.Present || 0} present</span><button className="primary-button" type="button" onClick={saveVisibleAttendance}>{saved ? "✓ Saved" : "Save attendance"}</button></div>
  </div>;
}

type TeacherDiscussion = { id: string; authorId: string; authorName: string; schoolName: string; title: string; body: string; resourceId: string; subject: string; gradeLevels: string[]; createdAt: string };
type TeacherReply = { id: string; discussionId: string; authorId: string; authorName: string; body: string; resourceId: string; createdAt: string };
type CommunityDiscussionRow = { id: string; author_id: string; author_name: string; school_name: string | null; title: string; body: string; subject: string | null; grade_levels: unknown; created_at: string };
type CommunityReplyRow = { id: string; discussion_id: string; author_id: string; author_name: string; body: string; created_at: string };

function discussionFromRow(row: CommunityDiscussionRow): TeacherDiscussion {
  const message = decodeCommunityMessage(String(row.body));
  return { id: String(row.id), authorId: String(row.author_id), authorName: String(row.author_name), schoolName: row.school_name ? String(row.school_name) : "", title: String(row.title), body: message.body, resourceId: message.resourceId, subject: row.subject ? String(row.subject) : "General", gradeLevels: Array.isArray(row.grade_levels) ? row.grade_levels.map(String) : [], createdAt: String(row.created_at) };
}

function replyFromRow(row: CommunityReplyRow): TeacherReply {
  const message = decodeCommunityMessage(String(row.body));
  return { id: String(row.id), discussionId: String(row.discussion_id), authorId: String(row.author_id), authorName: String(row.author_name), body: message.body, resourceId: message.resourceId, createdAt: String(row.created_at) };
}

function renderCommunityMessage(body: string) {
  return body.split(/(@[a-z0-9_]+)/gi).map((part, index) => part.startsWith("@") ? <strong className="teacher-mention" key={`${part}-${index}`}>{part}</strong> : <Fragment key={`${index}-${part.slice(0, 8)}`}>{part}</Fragment>);
}

function SharedMaterialCard({ resourceId, resources }: { resourceId: string; resources: LibraryResource[] }) {
  const resource = resources.find((item) => item.id === resourceId);
  if (!resource) return null;
  return <a className="community-material-card" href={resource.pdfPath} target="_blank" rel="noreferrer"><span>{resource.icon}</span><p><b>{resource.title}</b><small>{resource.subject} · PDF · {resource.author}{resource.source === "teacher" ? " · Community upload, not reviewed" : ""}</small></p><strong>Open ↗</strong></a>;
}

function communityTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function CommunityView({ authenticated, teacherAccountId, teacherName, openDiscussionId, initialResourceId, onRequestSignIn, onOpenLibrary, onGabayContext }: { authenticated: boolean; teacherAccountId: string; teacherName: string; openDiscussionId: string; initialResourceId: string; onRequestSignIn: () => void; onOpenLibrary: () => void; onGabayContext: (context: GabayLiveContext) => void }) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [discussions, setDiscussions] = useState<TeacherDiscussion[]>([]);
  const [replies, setReplies] = useState<TeacherReply[]>([]);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(openDiscussionId);
  const [loading, setLoading] = useState(authenticated);
  const [communityError, setCommunityError] = useState("");
  const [composerOpen, setComposerOpen] = useState(Boolean(initialResourceId));
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [questionSubject, setQuestionSubject] = useState("General");
  const [questionGrades, setQuestionGrades] = useState("");
  const [questionResourceId, setQuestionResourceId] = useState(initialResourceId);
  const [reply, setReply] = useState("");
  const [replyResourceId, setReplyResourceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "question" | "reply"; id: string }>();
  const [teacherResources, setTeacherResources] = useState<LibraryResource[]>([]);

  useEffect(() => {
    if (!authenticated || !teacherAccountId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    async function refresh() {
      const [discussionResult, replyResult, uploadedResources] = await Promise.all([
        supabase!.from("teacher_discussions").select("id,author_id,author_name,school_name,title,body,subject,grade_levels,created_at").order("created_at", { ascending: false }).limit(80),
        supabase!.from("teacher_replies").select("id,discussion_id,author_id,author_name,body,created_at").order("created_at").limit(500),
        loadTeacherResources(supabase!).catch(() => []),
      ]);
      if (!active) return;
      if (discussionResult.error || replyResult.error) { setCommunityError("The teacher room could not refresh. Please check your connection."); setLoading(false); return; }
      const nextDiscussions = (discussionResult.data || []).map(discussionFromRow);
      const nextReplies = (replyResult.data || []).map(replyFromRow);
      setDiscussions(nextDiscussions); setReplies(nextReplies); setTeacherResources(uploadedResources.filter((resource) => resource.visibility === "shared")); setSelectedDiscussionId((current) => nextDiscussions.some((item) => item.id === current) ? current : nextDiscussions[0]?.id || ""); setCommunityError(""); setLoading(false);
    }
    void refresh();
    // A new post appends the one row it carries. Only edits and deletes, which
    // carry no reliable before-image here, fall back to a full reload.
    const channel = supabase.channel(`teacher-room-${teacherAccountId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "teacher_discussions" }, (payload) => {
        if (!active) return;
        const item = discussionFromRow(payload.new as CommunityDiscussionRow);
        setDiscussions((current) => current.some((entry) => entry.id === item.id) ? current : [item, ...current].slice(0, 80));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "teacher_replies" }, (payload) => {
        if (!active) return;
        const item = replyFromRow(payload.new as CommunityReplyRow);
        setReplies((current) => current.some((entry) => entry.id === item.id) ? current : [...current, item]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teacher_discussions" }, () => { void refresh(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "teacher_discussions" }, () => { void refresh(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teacher_replies" }, () => { void refresh(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "teacher_replies" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "resources" }, () => { void refresh(); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [authenticated, teacherAccountId]);

  const visibleDiscussions = tab === "mine" ? discussions.filter((item) => item.authorId === teacherAccountId) : discussions;
  const attachableResources = [...teacherResources, ...starterResources];
  const selectedDiscussion = visibleDiscussions.find((item) => item.id === selectedDiscussionId) || visibleDiscussions[0];
  const selectedReplies = replies.filter((item) => item.discussionId === selectedDiscussion?.id);
  const teacherTags = [...new Map([...discussions.map((item) => ({ name: item.authorName, id: item.authorId })), ...replies.map((item) => ({ name: item.authorName, id: item.authorId }))].map((item) => [item.id, teacherMention(item.name, item.id)])).entries()]
    .filter(([id]) => id !== teacherAccountId)
    .map(([, tag]) => tag)
    .slice(0, 8);

  useEffect(() => {
    onGabayContext({
      view: "community", pageStep: selectedDiscussion ? "Read and reply to a teacher discussion" : "Teacher discussion room", gradeLevels: selectedDiscussion?.gradeLevels || [], subjects: selectedDiscussion?.subject ? [selectedDiscussion.subject] : [],
      currentSummary: [`Viewing ${tab === "mine" ? "questions from this account" : "all teacher questions"}`, `${visibleDiscussions.length} discussions visible`, `${attachableResources.length} shared resources can be attached`, selectedDiscussion ? `Open discussion: ${selectedDiscussion.title}` : "No discussion is open", `${selectedReplies.length} replies in the open discussion`, reply.trim() ? "A reply is being drafted" : "No reply is being drafted"],
      availableActions: ["Help write a clear teacher question", "Draft a constructive reply", "Summarize the open discussion", "Suggest useful teaching context to include"],
    });
  }, [attachableResources.length, onGabayContext, reply, selectedDiscussion, selectedReplies.length, tab, visibleDiscussions.length]);

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated || !teacherAccountId) { onRequestSignIn(); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase || questionTitle.trim().length < 4 || questionBody.trim().length < 4) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("teacher_discussions").insert({ author_id: teacherAccountId, author_name: teacherLabel(teacherName), title: questionTitle.trim(), body: encodeCommunityMessage(questionBody, questionResourceId), subject: questionSubject === "General" ? null : questionSubject, grade_levels: questionGrades.split(",").map((grade) => grade.trim()).filter(Boolean) }).select("id,author_id,author_name,school_name,title,body,subject,grade_levels,created_at").single();
    setSubmitting(false);
    if (error || !data) { setCommunityError("Your question could not be posted. Please check your connection and try again."); return; }
    const message = decodeCommunityMessage(String(data.body));
    const item: TeacherDiscussion = { id: String(data.id), authorId: String(data.author_id), authorName: String(data.author_name), schoolName: data.school_name ? String(data.school_name) : "", title: String(data.title), body: message.body, resourceId: message.resourceId, subject: data.subject ? String(data.subject) : "General", gradeLevels: Array.isArray(data.grade_levels) ? data.grade_levels.map(String) : [], createdAt: String(data.created_at) };
    setDiscussions((current) => [item, ...current.filter((discussion) => discussion.id !== item.id)]); setSelectedDiscussionId(item.id); setQuestionTitle(""); setQuestionBody(""); setQuestionGrades(""); setQuestionResourceId(""); setComposerOpen(false); setTab("all"); setCommunityError("");
  }

  async function submitReply() {
    if (!selectedDiscussion || !reply.trim()) return;
    if (!authenticated || !teacherAccountId) { onRequestSignIn(); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("teacher_replies").insert({ discussion_id: selectedDiscussion.id, author_id: teacherAccountId, author_name: teacherLabel(teacherName), body: encodeCommunityMessage(reply, replyResourceId) }).select("id,discussion_id,author_id,author_name,body,created_at").single();
    setSubmitting(false);
    if (error || !data) { setCommunityError("Your reply could not be sent. Please try again."); return; }
    const message = decodeCommunityMessage(String(data.body));
    const item: TeacherReply = { id: String(data.id), discussionId: String(data.discussion_id), authorId: String(data.author_id), authorName: String(data.author_name), body: message.body, resourceId: message.resourceId, createdAt: String(data.created_at) };
    setReplies((current) => [...current.filter((entry) => entry.id !== item.id), item]); setReply(""); setReplyResourceId(""); setCommunityError("");
  }

  async function deleteCommunityPost() {
    if (!deleteTarget || !teacherAccountId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSubmitting(true);
    const table = deleteTarget.kind === "question" ? "teacher_discussions" : "teacher_replies";
    const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id).eq("author_id", teacherAccountId);
    setSubmitting(false);
    if (error) { setCommunityError(`Your ${deleteTarget.kind} could not be deleted. Please try again.`); return; }
    if (deleteTarget.kind === "question") {
      setDiscussions((current) => current.filter((item) => item.id !== deleteTarget.id));
      setReplies((current) => current.filter((item) => item.discussionId !== deleteTarget.id));
      setSelectedDiscussionId("");
    } else {
      setReplies((current) => current.filter((item) => item.id !== deleteTarget.id));
    }
    setDeleteTarget(undefined); setCommunityError("");
  }

  if (!authenticated) return <div className="view-page"><PageIntro eyebrow="TEACHER ROOM" title="Ask teachers who understand the classroom" description="Sign in to read questions and exchange practical ideas with other Kalinga teachers." /><section className="community-signin"><span>♧</span><h2>Your teacher room is account-based</h2><p>Posts and replies are shared with signed-in teachers. Classes, learner records, lesson plans, and private resources remain yours.</p><button className="primary-button" type="button" onClick={onRequestSignIn}>Sign in to join</button></section></div>;

  return <div className="view-page community-page"><PageIntro eyebrow="TEACHER ROOM" title="Ask teachers. Share what worked." description="Questions, practical replies, and classroom materials live together here." action={<button className="primary-button" type="button" onClick={() => setComposerOpen((open) => !open)}>＋ Ask a question</button>} />
    <aside className="community-explainer"><span>@</span><p><b>Your tag is {teacherMention(teacherName, teacherAccountId)}</b><small>Use a teacher’s tag in a question or reply and Kalinga will notify that exact account. Attach one of your shared PDFs when the material helps explain the idea.</small></p><button type="button" onClick={onOpenLibrary}>Upload or manage resources →</button></aside>
    {composerOpen && <form className="community-composer" onSubmit={submitQuestion}>
      <header><div><p className="eyebrow">NEW QUESTION</p><h2>Give teachers enough context to help</h2></div><button type="button" aria-label="Close question form" onClick={() => setComposerOpen(false)}>×</button></header>
      <div>
        <label>Question<input required minLength={4} maxLength={180} value={questionTitle} onChange={(event) => setQuestionTitle(event.target.value)} placeholder="What are you trying to solve?" /></label>
        <label>Subject<select value={questionSubject} onChange={(event) => setQuestionSubject(event.target.value)}><option>General</option>{commonSubjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        <label>Grade levels<input value={questionGrades} onChange={(event) => setQuestionGrades(event.target.value)} placeholder="e.g. Grade 2, Grade 3" /></label>
        <label className="wide">Classroom context<textarea required minLength={4} maxLength={3000} value={questionBody} onChange={(event) => setQuestionBody(event.target.value)} placeholder="What have you tried? Add a teacher tag if you want their attention." /></label>
        <div className="community-compose-tools wide"><label>Attach your resource <small>Shared PDFs only</small><select value={questionResourceId} onChange={(event) => setQuestionResourceId(event.target.value)}><option value="">No attachment</option>{attachableResources.map((resource) => <option value={resource.id} key={resource.id}>{resource.ownerId === teacherAccountId ? "My PDF" : resource.source === "starter" ? "Kalinga starter" : "Teacher PDF"} · {resource.subject} · {resource.title}</option>)}</select></label><div><small>Tag a teacher</small>{teacherTags.length ? teacherTags.map((tag) => <button type="button" onClick={() => setQuestionBody((body) => `${body}${body.endsWith(" ") || !body ? "" : " "}${tag} `)} key={tag}>{tag}</button>) : <span>Teacher tags appear after another account posts.</span>}</div></div>
      </div>
      <footer><small>Shared with signed-in Kalinga teachers. Keep learner names and private records out.</small><button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Posting…" : "Post question"}</button></footer>
    </form>}
    <div className="community-toolbar"><div className="community-tabs"><button className={tab === "all" ? "active" : ""} type="button" onClick={() => setTab("all")}>All questions <span>{discussions.length}</span></button><button className={tab === "mine" ? "active" : ""} type="button" onClick={() => setTab("mine")}>My questions <span>{discussions.filter((item) => item.authorId === teacherAccountId).length}</span></button></div><small><i /> Live room · new replies appear automatically</small></div>
    {communityError && <p className="community-error" role="status">{communityError}</p>}
    {deleteTarget && <div className="community-delete-confirm" role="alert"><p><b>Delete this {deleteTarget.kind}?</b><span>{deleteTarget.kind === "question" ? "Its replies and related notifications will also be removed." : "This cannot be undone."}</span></p><div><button type="button" onClick={() => setDeleteTarget(undefined)}>Keep it</button><button type="button" disabled={submitting} onClick={deleteCommunityPost}>{submitting ? "Deleting…" : "Delete permanently"}</button></div></div>}
    {loading ? <div className="community-loading">Opening the teacher room…</div> : <section className="teacher-room-layout"><aside className="discussion-index" aria-label="Teacher discussions">{visibleDiscussions.map((discussion) => { const replyCount = replies.filter((item) => item.discussionId === discussion.id).length; return <button className={selectedDiscussion?.id === discussion.id ? "active" : ""} type="button" onClick={() => setSelectedDiscussionId(discussion.id)} key={discussion.id}><span><b>{discussion.title}</b><small>{discussion.subject || "General"} · {discussion.authorName}</small></span><em>{replyCount} {replyCount === 1 ? "reply" : "replies"}</em></button>; })}{!visibleDiscussions.length && <div className="discussion-index-empty"><b>{tab === "mine" ? "You have not asked anything yet" : "No questions yet"}</b><p>Start the first focused teacher discussion.</p><button type="button" onClick={() => setComposerOpen(true)}>Ask a question</button></div>}</aside>
      <article className="discussion-thread">{selectedDiscussion ? <>
        <header><div><span className="avatar">{teacherInitials(selectedDiscussion.authorName.replace(/^Teacher\s+/i, ""))}</span><p><b>{selectedDiscussion.authorName}</b><small>{selectedDiscussion.schoolName || "Kalinga teacher"} · {communityTime(selectedDiscussion.createdAt)}</small></p></div><div><span className="pill orange">{selectedDiscussion.subject || "GENERAL"}</span>{selectedDiscussion.gradeLevels.map((grade) => <span className="pill" key={grade}>{grade}</span>)}{selectedDiscussion.authorId === teacherAccountId && <button className="community-delete-button" type="button" onClick={() => setDeleteTarget({ kind: "question", id: selectedDiscussion.id })}>Delete question</button>}</div></header>
        <h2>{selectedDiscussion.title}</h2><p className="discussion-body">{renderCommunityMessage(selectedDiscussion.body)}</p><SharedMaterialCard resourceId={selectedDiscussion.resourceId} resources={attachableResources} />
        <div className="discussion-replies-heading"><b>{selectedReplies.length} {selectedReplies.length === 1 ? "reply" : "replies"}</b><small>Replying automatically notifies the teacher who asked.</small></div>
        <div className="reply-list">{selectedReplies.map((item) => <div className="reply-item" key={item.id}><span className="avatar">{teacherInitials(item.authorName.replace(/^Teacher\s+/i, ""))}</span><div><p><b>{item.authorName} <small>{communityTime(item.createdAt)}</small></b>{renderCommunityMessage(item.body)}</p><SharedMaterialCard resourceId={item.resourceId} resources={attachableResources} /></div>{item.authorId === teacherAccountId && <button className="reply-delete-button" type="button" onClick={() => setDeleteTarget({ kind: "reply", id: item.id })}>Delete</button>}</div>)}{!selectedReplies.length && <p className="no-replies">No replies yet. Share one useful idea to get the conversation started.</p>}</div>
        <div className="reply-composer"><div className="reply-box"><textarea value={reply} maxLength={2000} onChange={(event) => setReply(event.target.value)} placeholder="Share a practical suggestion or tag a teacher…" /><button type="button" disabled={!reply.trim() || submitting} onClick={submitReply}>{submitting ? "Sending…" : "Reply"}</button></div><div className="reply-tools"><select aria-label="Attach one of your shared resources" value={replyResourceId} onChange={(event) => setReplyResourceId(event.target.value)}><option value="">＋ Attach your resource</option>{attachableResources.map((resource) => <option value={resource.id} key={resource.id}>{resource.ownerId === teacherAccountId ? "My PDF" : resource.source === "starter" ? "Kalinga starter" : "Teacher PDF"} · {resource.title}</option>)}</select><button type="button" onClick={onOpenLibrary}>＋ Upload PDF</button>{teacherTags.map((tag) => <button type="button" onClick={() => setReply((body) => `${body}${body.endsWith(" ") || !body ? "" : " "}${tag} `)} key={tag}>{tag}</button>)}</div></div>
      </> : <div className="discussion-empty"><span>♧</span><b>Choose a question</b><p>Open a teacher discussion to read its replies.</p></div>}</article>
    </section>}
  </div>;
}
