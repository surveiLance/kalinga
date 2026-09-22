import { gradeLabel } from "@/lib/grades";
import { formatTime, toMinutes } from "@/lib/schedule";
import { learnerSexCounts } from "@/lib/learners";
import type { GradeLevel, PlanSlot, SavedPlan, TeachingClass } from "@/lib/teaching-types";

const perGradeFields = ["competencies", "competencyCodes", "contentStandards", "performanceStandards", "objectives", "formativeAssessments", "exitTasks", "successCriteria", "reflectionQuestions", "remediations", "enrichments"] as const;

// Whether the teacher has typed anything worth keeping. Slots are excluded: a fresh
// plan always carries a default timetable, so they say nothing about teacher effort.
export function planHasTeacherContent(plan: SavedPlan) {
  if ([plan.sharedTheme, plan.learnerContext, plan.materials, plan.nextSessionNotes].some((value) => value?.trim())) return true;
  return perGradeFields.some((field) => Object.values(plan[field] || {}).some((value) => value?.trim()));
}

export function learnersPerGrade(teachingClass: TeachingClass, grades: GradeLevel[]) {
  return grades.map((grade) => {
    const counts = learnerSexCounts(teachingClass.learners.filter((learner) => learner.grade === grade));
    const total = counts.female + counts.male + counts.unspecified;
    return { grade, label: gradeLabel(grade), total, female: counts.female, male: counts.male };
  });
}

// "Gr.3: 6 (F-3, M-3) · Gr.4: 1 (F-0, M-1)" — the form supervisors expect on a multigrade DLP.
export function learnerCountSummary(teachingClass: TeachingClass, grades: GradeLevel[]) {
  return learnersPerGrade(teachingClass, grades).map((item) => `${item.label}: ${item.total} (F-${item.female}, M-${item.male})`).join(" · ");
}

export const ilawStages = ["Preliminary Activities", "Motivation", "Direct Teaching", "Guided Practice", "Independent Practice", "Cross-Grade Collaboration", "Application", "Generalization", "Assessment", "Wrap-Up"];

// Slot times are derived: the lesson starts at one time and each block follows
// the last. Editing a duration therefore shifts everything after it.
export function retimeSlots(slots: PlanSlot[], startTime: string) {
  let cursor = toMinutes(startTime);
  return slots.map((slot) => {
    const time = formatTime(cursor);
    cursor += Math.max(1, slot.durationMinutes || 10);
    return slot.time === time ? slot : { ...slot, time };
  });
}

export function slotsTotalMinutes(slots: PlanSlot[]) {
  return slots.reduce((total, slot) => total + Math.max(1, slot.durationMinutes || 10), 0);
}

export function planTimeRange(plan: SavedPlan) {
  const start = plan.startTime || "8:00 AM";
  const minutes = Number.parseInt(plan.duration, 10) || 80;
  return `${start}–${formatTime(toMinutes(start) + minutes)} · ${minutes} minutes`;
}

// DepEd forms write grade levels in Roman numerals: "GRADE III & IV".
const romanNumerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function romanGrade(grade: GradeLevel) {
  const number = Number(grade);
  return Number.isInteger(number) && number >= 1 && number <= 12 ? romanNumerals[number] : grade === "Kindergarten" ? "KINDERGARTEN" : grade.toUpperCase();
}

export function planTitleLine(grades: GradeLevel[]) {
  const labels = grades.map(romanGrade);
  const joined = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}` : labels[0] || "";
  return `DAILY LESSON PLAN FOR GRADE ${joined}`;
}

// A whole-class block prints as one cell spanning every grade, as the DepEd form
// does for Motivation and Wrap-Up. Older plans carry no flag, so identical text
// in every grade column is read as the same intent.
export function slotIsWholeClass(slot: PlanSlot) {
  if (typeof slot.wholeClass === "boolean") return slot.wholeClass;
  const tasks = Object.values(slot.gradeTasks).map((task) => task.trim().toLowerCase());
  return tasks.length > 1 && tasks.every((task) => task && task === tasks[0]);
}

export function wholeClassTask(slot: PlanSlot) {
  return Object.values(slot.gradeTasks).find((task) => task.trim()) || "";
}

export function withWholeClassTask(slot: PlanSlot, grades: GradeLevel[], task: string): PlanSlot {
  return { ...slot, wholeClass: true, gradeTasks: Object.fromEntries(grades.map((grade) => [grade, task])) };
}
