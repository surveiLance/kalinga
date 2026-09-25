import { describe, expect, it } from "vitest";
import { isCompleteGabayFullPlan } from "@/lib/gabay-ai";

const gradeDraft = {
  competency: "Add like fractions", competencyCode: "", contentStandard: "Understands like fractions", performanceStandard: "Solves like-fraction tasks", objective: "Adds two like fractions",
  formativeAssessment: "Explain one bottle-cap model", exitTask: "Solve 1/4 + 2/4", successCriteria: "Adds and explains the denominator", reflectionQuestion: "Who still confuses the denominator?", remediation: "Rebuild one sum with caps", enrichment: "Write a new sum for a peer",
};

const complete = {
  type: "full-plan", sharedTheme: "Adding like fractions", learnerContext: "Mixed readiness", materials: "Bottle caps and chalkboard", nextSessionNotes: "",
  grades: { "3": gradeDraft, "4": { ...gradeDraft, objective: "Adds and explains like fractions" } },
  slots: [{ stage: "Guided Practice", durationMinutes: 20, teacherFocus: "Guide Grade 3", gradeTasks: { "3": "Build 1/4 + 2/4 with caps", "4": "Solve and explain 2/5 + 1/5" } }],
};

describe("isCompleteGabayFullPlan", () => {
  it("accepts a complete draft even when an unverified competency code is blank", () => {
    expect(isCompleteGabayFullPlan(complete, ["3", "4"])).toBe(true);
  });

  it("rejects a draft that omits a requested grade", () => {
    expect(isCompleteGabayFullPlan({ ...complete, grades: { "3": gradeDraft } }, ["3", "4"])).toBe(false);
  });

  it("rejects blank grade fields or a slot with no task for one grade", () => {
    expect(isCompleteGabayFullPlan({ ...complete, grades: { ...complete.grades, "4": { ...gradeDraft, objective: "" } } }, ["3", "4"])).toBe(false);
    expect(isCompleteGabayFullPlan({ ...complete, slots: [{ ...complete.slots[0], gradeTasks: { "3": "Do the task", "4": "" } }] }, ["3", "4"])).toBe(false);
  });
});
