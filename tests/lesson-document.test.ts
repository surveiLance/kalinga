import { describe, expect, it } from "vitest";
import { lessonObservations, preserveLessonObservations, hasInstructionalEdits } from "@/lib/lesson-document";
import { revisionSource } from "@/lib/lesson-revisions";
import type { SavedPlan } from "@/lib/teaching-types";
const plan: SavedPlan = { id: "p", classId: "c", title: "Plants", subject: "Science", grades: ["3"], duration: "60 minutes", quarter: "Quarter 1", reflection: "Actual result: learner needed support", remediation: "Actual follow-up completed", enrichment: "Actual extension completed", slots: [{ id: "s", time: "8:00 AM", durationMinutes: 60, teacherFocus: "Guide Grade 3", gradeTasks: { "3": "Guided lesson" } }], savedAt: "today" };
describe("lesson document boundaries", () => {
  it("serializes teacher observations independently of proposed support fields", () => {
    const edited = preserveLessonObservations({ ...plan, reflectionQuestions: { "3": "Did this help?" }, remediations: { "3": "Proposed practice" } }, lessonObservations(plan));
    expect(edited.reflection).toBe("Actual result: learner needed support");
    expect(edited.remediation).toBe("Actual follow-up completed");
    expect(edited.enrichment).toBe("Actual extension completed");
    expect(JSON.stringify(revisionSource(edited))).not.toContain("Actual");
  });
  it("protects teacher-focus-only edits and slot-structure edits from whole-plan replacement", () => {
    expect(hasInstructionalEdits(plan.slots, plan.slots)).toBe(false);
    expect(hasInstructionalEdits([{ ...plan.slots[0], teacherFocus: "Teacher wrote this focus" }], plan.slots)).toBe(true);
    expect(hasInstructionalEdits([{ ...plan.slots[0], durationMinutes: 30 }], plan.slots)).toBe(true);
  });
});
