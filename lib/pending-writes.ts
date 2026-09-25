import { attendanceStatusLabel, isStoredAttendanceStatus, toStoredAttendanceStatus } from "@/lib/attendance";

type SyncClass = { id: string; learners: { id: string; grade: string }[] };
type SyncPlan = { id: string; classId: string };
type AttendanceMap = Record<string, Record<string, string>>;
type AttendanceRow = { learnerId: string; grade: string; status: string; note: string };

export type PendingChange<C = SyncClass, P = SyncPlan> =
  | { kind: "profile"; schoolName: string }
  | { kind: "class"; classId: string; value: C }
  | { kind: "delete-class"; classId: string }
  | { kind: "plan"; classId: string; value: P }
  | { kind: "delete-plan"; classId: string; planId: string }
  | { kind: "attendance"; classId: string; date: string; records: AttendanceRow[] };

export type PendingWrite<C = SyncClass, P = SyncPlan> = PendingChange<C, P> & {
  id: string;
  scope: string;
  attempts: number;
  nextAttemptAt: number;
  error: string;
};

export const maxSyncAttempts = 5;

export function canSyncScope(scope: string, teacherId: string) {
  return Boolean(teacherId) && scope === `teacher-${teacherId}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validAttendanceRow(value: unknown): value is AttendanceRow {
  return record(value) && typeof value.learnerId === "string" && typeof value.grade === "string" && typeof value.note === "string" && typeof value.status === "string" && isStoredAttendanceStatus(value.status);
}

export function readPendingWrites<C extends SyncClass, P extends SyncPlan>(stored: string | null, scope: string): PendingWrite<C, P>[] {
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every((item: unknown) => {
    if (!record(item) || item.scope !== scope || typeof item.id !== "string" || !Number.isInteger(item.attempts) || Number(item.attempts) < 0 || typeof item.nextAttemptAt !== "number" || !Number.isFinite(item.nextAttemptAt) || typeof item.error !== "string") return false;
    if (item.kind === "profile") return typeof item.schoolName === "string";
    if (typeof item.classId !== "string") return false;
    if (item.kind === "delete-class") return true;
    if (item.kind === "class") return record(item.value) && item.value.id === item.classId && Array.isArray(item.value.learners) && item.value.learners.every((learner: unknown) => record(learner) && typeof learner.id === "string" && typeof learner.grade === "string");
    if (item.kind === "plan") return record(item.value) && typeof item.value.id === "string" && item.value.classId === item.classId;
    if (item.kind === "delete-plan") return typeof item.planId === "string";
    return item.kind === "attendance" && typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Array.isArray(item.records) && item.records.every(validAttendanceRow);
  })) throw new Error("This workspace’s pending changes could not be read safely.");
  return parsed as PendingWrite<C, P>[];
}

function changeKey<C extends SyncClass, P extends SyncPlan>(change: PendingChange<C, P>) {
  if (change.kind === "profile") return "profile:school-name";
  if (change.kind === "plan") return `plan:${change.value.id}`;
  if (change.kind === "delete-plan") return `plan:${change.planId}`;
  if (change.kind === "attendance") return `attendance:${change.classId}:${change.date}`;
  return `class:${change.classId}`;
}

export function enqueuePendingWrite<C extends SyncClass, P extends SyncPlan>(queue: PendingWrite<C, P>[], scope: string, change: PendingChange<C, P>, id: string, now: number): PendingWrite<C, P>[] {
  if (queue.some((item) => item.scope !== scope)) throw new Error("Workspace scope mismatch.");
  let next = queue;
  if (change.kind === "delete-class") {
    const deletedClassId = change.classId;
    next = next.filter((item) => item.kind === "profile" || item.classId !== deletedClassId);
  }
  if (change.kind === "class") {
    const classId = change.classId;
    const learners = new Map(change.value.learners.map((learner) => [learner.id, learner.grade]));
    next = next.flatMap((item) => {
      if (item.kind !== "attendance" || item.classId !== classId) return [item];
      const records = item.records.filter((row) => learners.has(row.learnerId)).map((row) => ({ ...row, grade: learners.get(row.learnerId)! }));
      return records.length ? [{ ...item, id: `${id}:${item.id}`, records, attempts: 0, nextAttemptAt: now, error: "" }] : [];
    });
  }
  if (change.kind === "attendance") {
    const previous = next.find((item) => changeKey(item) === changeKey(change));
    if (previous?.kind === "attendance") change = { ...change, records: [...new Map([...previous.records, ...change.records].map((row) => [row.learnerId, row])).values()] };
  }
  return [...next.filter((item) => changeKey(item) !== changeKey(change)), { ...change, id, scope, attempts: 0, nextAttemptAt: now, error: "" }];
}

export function acknowledgePendingWrite<C, P>(queue: PendingWrite<C, P>[], scope: string, id: string) {
  return queue.filter((item) => item.scope !== scope || item.id !== id);
}

export function startPendingWrite<C, P>(queue: PendingWrite<C, P>[], scope: string, id: string, now: number) {
  return queue.map((item) => item.scope === scope && item.id === id && item.attempts < maxSyncAttempts
    ? { ...item, attempts: item.attempts + 1, nextAttemptAt: now + Math.min(60_000, 2_000 * 2 ** item.attempts), error: "The last sync did not finish." }
    : item);
}

export function failPendingWrite<C, P>(queue: PendingWrite<C, P>[], scope: string, id: string, error: string) {
  return queue.map((item) => item.scope === scope && item.id === id ? { ...item, error } : item);
}

export function retryPendingWrites<C, P>(queue: PendingWrite<C, P>[], scope: string, now: number) {
  return queue.map((item) => item.scope === scope ? { ...item, attempts: 0, nextAttemptAt: now, error: "" } : item);
}

export function pendingCandidates<C, P>(queue: PendingWrite<C, P>[], scope: string) {
  const parents = new Set(queue.flatMap((item) => item.scope === scope && (item.kind === "class" || item.kind === "delete-class") ? [item.classId] : []));
  return queue.filter((item) => {
    if (item.scope !== scope || item.attempts >= maxSyncAttempts) return false;
    if (item.kind === "profile" || item.kind === "class" || item.kind === "delete-class") return true;
    return !parents.has(item.classId);
  });
}

export function attendanceChanges<C extends SyncClass>(classes: C[], updates: AttendanceMap, notes: AttendanceMap): Extract<PendingChange, { kind: "attendance" }>[] {
  const changes = new Map<string, Extract<PendingChange, { kind: "attendance" }>>();
  for (const [key, statuses] of Object.entries(updates)) {
    const match = key.match(/^(.*)-(\d{4}-\d{2}-\d{2})-grade-(.+)$/);
    const item = classes.find((entry) => entry.id === match?.[1]);
    if (!match || !item) throw new Error("Attendance must belong to a saved class and date.");
    const [, classId, date] = match;
    const change = changes.get(`${classId}:${date}`) || { kind: "attendance", classId, date, records: [] };
    for (const [learnerId, status] of Object.entries(statuses)) {
      const learner = item.learners.find((entry) => entry.id === learnerId);
      const row = { learnerId, grade: learner?.grade || "", status: toStoredAttendanceStatus(status), note: notes[key]?.[learnerId]?.trim() || "" };
      if (!learner || !validAttendanceRow(row)) throw new Error("Attendance contains an unknown learner or status.");
      change.records.push(row);
    }
    if (change.records.length) changes.set(`${classId}:${date}`, change);
  }
  return [...changes.values()];
}

export function reconcilePendingWrites<C extends SyncClass, P extends SyncPlan, W extends { classes: C[]; plans: P[]; attendance: AttendanceMap; attendanceNotes: AttendanceMap }>(workspace: W, queue: PendingWrite<C, P>[], scope: string): W {
  const classes = new Map<string, C>(workspace.classes.map((item) => [item.id, item]));
  const plans = new Map<string, P>(workspace.plans.map((item) => [item.id, item]));
  const attendance = Object.fromEntries(Object.entries(workspace.attendance).map(([key, rows]) => [key, { ...rows }]));
  const attendanceNotes = Object.fromEntries(Object.entries(workspace.attendanceNotes).map(([key, rows]) => [key, { ...rows }]));
  for (const item of queue.filter((entry) => entry.scope === scope)) {
    if (item.kind === "class") classes.set(item.classId, item.value);
    if (item.kind === "plan") plans.set(item.value.id, item.value);
    if (item.kind === "delete-plan") plans.delete(item.planId);
    if (item.kind === "delete-class") {
      classes.delete(item.classId);
      for (const plan of plans.values()) if (plan.classId === item.classId) plans.delete(plan.id);
      for (const key of new Set([...Object.keys(attendance), ...Object.keys(attendanceNotes)])) {
        if (key.startsWith(`${item.classId}-`)) { delete attendance[key]; delete attendanceNotes[key]; }
      }
    }
    if (item.kind === "attendance") {
      for (const row of item.records) {
        for (const key of new Set([...Object.keys(attendance), ...Object.keys(attendanceNotes)])) {
          if (key.includes(`-${item.date}-grade-`)) { delete attendance[key]?.[row.learnerId]; delete attendanceNotes[key]?.[row.learnerId]; }
        }
        const key = `${item.classId}-${item.date}-grade-${row.grade}`;
        // The queue holds the database's lowercase form; the roster reads labels.
        attendance[key] = { ...attendance[key], [row.learnerId]: attendanceStatusLabel(row.status) };
        attendanceNotes[key] = { ...attendanceNotes[key], [row.learnerId]: row.note };
      }
    }
  }
  return { ...workspace, classes: [...classes.values()], plans: [...plans.values()], attendance, attendanceNotes };
}
