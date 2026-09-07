import { describe, expect, it } from "vitest";
import { gradeLabel, gradeList, normalizeGradeLevel, sortGradeLevels } from "@/lib/grades";

describe("normalizeGradeLevel", () => {
  it("keeps every spelling of kindergarten together", () => {
    for (const value of ["K", "k", "Kinder", "kindergarten", "KINDERGARTEN"]) {
      expect(normalizeGradeLevel(value)).toBe("Kindergarten");
    }
  });

  it("reduces a written grade to its number so the same grade never splits in two", () => {
    expect(normalizeGradeLevel("Grade 3")).toBe("3");
    expect(normalizeGradeLevel("grade 12")).toBe("12");
    expect(normalizeGradeLevel(3)).toBe("3");
    expect(normalizeGradeLevel(" 3 ")).toBe("3");
  });

  it("is idempotent, so re-normalizing stored data cannot drift", () => {
    for (const value of ["Kindergarten", "3", "Grade 3", "K", "ALS"]) {
      expect(normalizeGradeLevel(normalizeGradeLevel(value))).toBe(normalizeGradeLevel(value));
    }
  });

  it("falls back to grade 1 on empty input rather than producing an unlabelled grade", () => {
    expect(normalizeGradeLevel("")).toBe("1");
    expect(normalizeGradeLevel("   ")).toBe("1");
  });

  it("passes through a named grade it does not recognize", () => {
    expect(normalizeGradeLevel("ALS")).toBe("ALS");
  });
});

describe("gradeLabel", () => {
  it("prefixes numbered grades and leaves named grades alone", () => {
    expect(gradeLabel("3")).toBe("Grade 3");
    expect(gradeLabel("Kindergarten")).toBe("Kindergarten");
    expect(gradeLabel("ALS")).toBe("ALS");
  });

  it("renders a multigrade class list in order", () => {
    expect(gradeList(["Kindergarten", "3", "4"])).toBe("Kindergarten, Grade 3, Grade 4");
  });
});

describe("sortGradeLevels", () => {
  it("orders a multigrade roster by school order, not string order", () => {
    expect(sortGradeLevels(["10", "2", "Kindergarten", "1"])).toEqual(["Kindergarten", "1", "2", "10"]);
  });

  it("keeps unrecognized grades after the known ones", () => {
    expect(sortGradeLevels(["ALS", "3", "Kindergarten"])).toEqual(["Kindergarten", "3", "ALS"]);
  });

  it("does not mutate the caller's array", () => {
    const grades = ["4", "3"];
    sortGradeLevels(grades);
    expect(grades).toEqual(["4", "3"]);
  });
});
