import type { ClassLearner, GradeLevel, LearnerSex } from "@/lib/teaching-types";

export const learnerNames = ["Angela P. Morales", "Benjie R. Santos", "Carla M. Dela Cruz", "Daryl T. Gomez", "Elaine B. Ramos", "Francis A. Uy", "Grace L. Villanueva", "Harold N. Flores", "Irene C. Mendoza", "Jose R. Lim", "Karla S. Reyes", "Luis M. Aquino", "Mariel C. Torres", "Noel B. Pangan", "Olivia R. Cabahug", "Paolo S. Evasco", "Queenie M. Dayao", "Ramon L. Flores"];

export function normalizeLearnerSex(value?: string): LearnerSex {
  if (/^(female|f)$/i.test(value || "")) return "Female";
  if (/^(male|m)$/i.test(value || "")) return "Male";
  return "Not specified";
}

export function learnerSexCounts(learners: ClassLearner[]) {
  return learners.reduce((counts, learner) => {
    if (learner.sex === "Female") counts.female += 1;
    else if (learner.sex === "Male") counts.male += 1;
    else counts.unspecified += 1;
    return counts;
  }, { female: 0, male: 0, unspecified: 0 });
}

export function learnerRosterSummary(learners: ClassLearner[], compact = false) {
  if (!learners.length) return compact ? "No learners yet" : "No sex data yet";
  const counts = learnerSexCounts(learners);
  const labels = compact
    ? [`${counts.female}F`, `${counts.male}M`]
    : [`${counts.female} female`, `${counts.male} male`];
  if (counts.unspecified) labels.push(compact ? `${counts.unspecified} not set` : `${counts.unspecified} not specified`);
  return labels.join(" · ");
}

export function createSampleLearners(grades: GradeLevel[], count: number): ClassLearner[] {
  const safeGrades = grades.length ? grades : ["1"];
  return Array.from({ length: count }, (_, index) => ({
    id: `learner-${index + 1}`,
    name: learnerNames[index] || `Learner ${String(index + 1).padStart(2, "0")}`,
    grade: safeGrades[index % safeGrades.length],
    sex: index % 2 ? "Male" : "Female",
  }));
}
