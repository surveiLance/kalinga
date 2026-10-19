import type { SavedPlan } from "@/lib/teaching-types";
import { revisionFields, revisionKey, revisionContextMatches, revisionConflicts, validateRevisionProposal, type RevisionChange, type RevisionRequest, type RevisionSource } from "../supabase/functions/_shared/lesson-revisions";
export * from "../supabase/functions/_shared/lesson-revisions";

export function revisionSource(plan: SavedPlan): RevisionSource {
  const fields: RevisionChange[] = [];
  for (const [field, [, , kind]] of Object.entries(revisionFields)) {
    const name = field as RevisionChange["field"];
    if (kind === "text") fields.push({ field: name, value: String(plan[field as keyof SavedPlan] || "") });
    if (kind === "grade") for (const grade of plan.grades) fields.push({ field: name, grade, value: (plan[field as keyof SavedPlan] as Record<string, string> | undefined)?.[grade] || "" });
    if (kind === "slot") for (const slot of plan.slots) fields.push({ field: name, slotId: slot.id, value: slot.teacherFocus });
    if (kind === "task") for (const slot of plan.slots) for (const grade of plan.grades) fields.push({ field: name, slotId: slot.id, grade, value: slot.gradeTasks[grade] || "" });
  }
  return { context: { planId: plan.id, classId: plan.classId, title: plan.title, subject: plan.subject, grades: [...plan.grades], language: plan.language || "", duration: plan.duration, startTime: plan.startTime || "", quarter: plan.quarter, date: plan.teachingDate || "", model: plan.multigradeModel || "" }, slots: plan.slots.map((slot) => ({ id: slot.id, time: slot.time, stage: slot.stage || "", durationMinutes: slot.durationMinutes || 10, wholeClass: !!slot.wholeClass })), references: Object.fromEntries(["competencies", "competencyCodes", "contentStandards", "performanceStandards"].map((field) => [field, Object.fromEntries(plan.grades.map((grade) => [grade, (plan[field as keyof SavedPlan] as Record<string, string> | undefined)?.[grade] || ""]))])), fields };
}
function writeChanges(plan: SavedPlan, changes: RevisionChange[]): SavedPlan {
  let next = { ...plan };
  for (const change of changes) {
    const kind = revisionFields[change.field][2];
    if (kind === "text") next = { ...next, [change.field]: change.value };
    if (kind === "grade") next = { ...next, [change.field]: { ...(next[change.field as keyof SavedPlan] as Record<string, string>), [change.grade!]: change.value } };
    if (kind === "slot" || kind === "task") next = { ...next, slots: next.slots.map((slot) => slot.id !== change.slotId ? slot : kind === "slot" ? { ...slot, teacherFocus: change.value } : { ...slot, gradeTasks: { ...slot.gradeTasks, [change.grade!]: change.value } }) };
  }
  return next;
}
export function applyRevision(plan: SavedPlan, request: RevisionRequest, changes: RevisionChange[]) {
  const proposal = validateRevisionProposal({ id: request.id, changes }, request);
  const conflicts = revisionConflicts(request.source, revisionSource(plan), proposal);
  const applied = proposal.changes.filter((change) => !conflicts.includes(revisionKey(change)));
  return { plan: writeChanges(plan, applied), applied };
}
export function undoRevision(plan: SavedPlan, before: SavedPlan, applied: RevisionChange[]) {
  const current = revisionSource(plan);
  const original = revisionSource(before);
  const undo = applied.filter((change) => current.fields.find((field) => revisionKey(field) === revisionKey(change))?.value === change.value).flatMap((change) => original.fields.find((field) => revisionKey(field) === revisionKey(change)) || []);
  if (!revisionContextMatches(original, current)) {
    return { plan, skipped: applied.length };
  }
  return { plan: writeChanges(plan, undo), skipped: applied.length - undo.length };
}
