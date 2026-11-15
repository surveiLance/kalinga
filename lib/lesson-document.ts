import type { SavedPlan, PlanSlot } from "@/lib/teaching-types";

export function lessonObservations(plan?: SavedPlan) {
  return { reflection: plan?.reflection || "", remediation: plan?.remediation || "", enrichment: plan?.enrichment || "" };
}
export function preserveLessonObservations(plan: SavedPlan, notes: ReturnType<typeof lessonObservations>): SavedPlan {
  return { ...plan, ...notes };
}
export function hasInstructionalEdits(slots: PlanSlot[], defaults: PlanSlot[]) {
  const content = (items: PlanSlot[]) => items.map(({ time, timeText, stage, durationMinutes, teacherFocus, focusGrade, gradeTasks }) => ({ time, timeText, stage, durationMinutes, teacherFocus, focusGrade, gradeTasks }));
  return JSON.stringify(content(slots)) !== JSON.stringify(content(defaults));
}
