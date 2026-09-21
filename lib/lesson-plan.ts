import { gradeLabel } from "@/lib/grades";
import { learnerSexCounts } from "@/lib/learners";
import type { GradeLevel, SavedPlan, TeachingClass } from "@/lib/teaching-types";

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

export function planTimeRange(plan: SavedPlan, toMinutes: (time: string) => number, formatTime: (minutes: number) => string, durationMinutes: (value: string | number) => number) {
  const start = plan.startTime || "8:00 AM";
  return `${start}–${formatTime(toMinutes(start) + durationMinutes(plan.duration))} · ${durationMinutes(plan.duration)} minutes`;
}
