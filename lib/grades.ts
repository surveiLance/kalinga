import type { GradeLevel } from "@/lib/teaching-types";

export const commonGradeLevels: GradeLevel[] = ["Kindergarten", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function normalizeGradeLevel(grade: GradeLevel | number): GradeLevel {
  const cleaned = String(grade).trim();
  if (!cleaned) return "1";
  if (/^(k|kinder|kindergarten)$/i.test(cleaned)) return "Kindergarten";
  const numberedGrade = cleaned.match(/^grade\s+(\d+)$/i);
  return numberedGrade ? numberedGrade[1] : cleaned;
}

export function gradeLabel(grade: GradeLevel) {
  return grade === "Kindergarten" || /[a-z]/i.test(grade) ? grade : `Grade ${grade}`;
}

export function gradeList(grades: GradeLevel[]) {
  return grades.map(gradeLabel).join(", ");
}

export function sortGradeLevels(grades: GradeLevel[]) {
  return [...grades].sort((a, b) => {
    const aIndex = commonGradeLevels.indexOf(a);
    const bIndex = commonGradeLevels.indexOf(b);
    if (aIndex >= 0 || bIndex >= 0) return (aIndex >= 0 ? aIndex : commonGradeLevels.length) - (bIndex >= 0 ? bIndex : commonGradeLevels.length);
    return a.localeCompare(b, undefined, { numeric: true });
  });
}
