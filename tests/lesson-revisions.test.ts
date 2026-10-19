import { describe, expect, it } from "vitest";
import { applyRevision, redactRevisionRequest, revisionConflicts, revisionGroupKeys, revisionSource, undoRevision, validateRevisionProposal, validateRevisionRequest } from "@/lib/lesson-revisions";
import type { SavedPlan } from "@/lib/teaching-types";

export const planFixture: SavedPlan = { id: "plan-one", classId: "class-one", title: "Plants", subject: "Science", quarter: "Quarter 1", grades: ["3", "4"], duration: "60 minutes", language: "English", startTime: "8:00 AM", objectives: { "3": "Name plant parts", "4": "Explain plant functions" }, competencies: { "3": "Verified reference", "4": "Another verified reference" }, materials: "Leaves", reflection: "Actual classroom observation", slots: [{ id: "s1", time: "8:00 AM", stage: "Motivation", durationMinutes: 60, wholeClass: false, teacherFocus: "Guide Grade 3", gradeTasks: { "3": "Observe leaves", "4": "Draw leaves" } }], savedAt: "today" };
const suggestion = { field: "objectives" as const, grade: "3", value: "Identify roots, stems, and leaves" };
const makeRequest = () => ({ id: "request-one", scope: "intentions" as const, instruction: "Make the objectives specific", source: revisionSource(planFixture) });

describe("reviewable lesson revisions", () => {
  it("captures curriculum context without personal or school identity data", () => {
    const source = revisionSource({ ...planFixture, schoolHeadName: "Private principal", draftNotes: "Private notes" });
    expect(JSON.stringify(source)).toContain("Verified reference");
    expect(JSON.stringify(source)).not.toContain("Private");
    expect(JSON.stringify(source)).not.toContain("Actual classroom observation");
    expect(validateRevisionRequest(makeRequest()).scope).toBe("intentions");
  });
  it("rejects protected, foreign, duplicate, blank, and out-of-scope changes", () => {
    for (const changes of [[{ field: "competencies", grade: "3", value: "Invented" }], [{ ...suggestion, grade: "99" }], [suggestion, suggestion], [{ ...suggestion, value: " " }], [{ field: "materials", value: "Paper" }], [{ field: "gradeTasks", slotId: "foreign", grade: "3", value: "Draw" }]]) {
      expect(() => validateRevisionProposal({ id: "request-one", changes }, makeRequest())).toThrow();
    }
    expect(validateRevisionProposal({ id: "request-one", changes: [] }, makeRequest()).changes).toEqual([]);
    expect(() => validateRevisionProposal({ id: "old-response", changes: [suggestion] }, makeRequest())).toThrow();
  });
  it("rejects invalid and oversized requests instead of truncating text", () => {
    expect(() => validateRevisionRequest({ ...makeRequest(), instruction: "x".repeat(2001) })).toThrow();
    expect(() => validateRevisionRequest({ ...makeRequest(), scope: "secret" })).toThrow();
    const source = revisionSource(planFixture);
    source.fields[0].value = "x".repeat(4001);
    expect(() => validateRevisionRequest({ ...makeRequest(), source })).toThrow();
    const large = revisionSource({ ...planFixture, grades: Array.from({ length: 13 }, (_, i) => String(i)), slots: Array.from({ length: 40 }, (_, i) => ({ ...planFixture.slots[0], id: `slot-${i}` })) });
    large.fields.forEach((field) => { field.value = "ñ".repeat(120); });
    expect(() => validateRevisionRequest({ ...makeRequest(), source: large })).toThrow();
    expect(() => validateRevisionRequest({ ...makeRequest(), source: { ...revisionSource(planFixture), fields: [] } })).toThrow();
    expect(() => validateRevisionRequest({ ...makeRequest(), source: { ...revisionSource(planFixture), slots: Array(41).fill(planFixture.slots[0]) } })).toThrow();
  });
  it("redacts instructions and source text but keeps target identities intact", () => {
    const request = makeRequest();
    request.instruction = "Help PrivateName";
    request.source.fields[0].value = "PrivateName needs support";
    const result = redactRevisionRequest(request, (value) => value.replaceAll("PrivateName", "[learner]"));
    expect(result.instruction).toBe("Help [learner]");
    expect(result.source.fields[0].value).toBe("[learner] needs support");
    expect(result.source.context.classId).toBe("class-one");
    expect(request.source.fields[0].value).toBe("PrivateName needs support");
  });
  it("applies selected changes without mutating the source or unrelated teacher edits", () => {
    const current = { ...planFixture, materials: "Teacher added pencils" };
    const result = applyRevision(current, makeRequest(), [suggestion]);
    expect(result.plan.objectives?.["3"]).toBe("Identify roots, stems, and leaves");
    expect(result.plan.objectives?.["4"]).toBe("Explain plant functions");
    expect(result.plan.materials).toBe("Teacher added pencils");
    expect(result.plan.competencies).toEqual(planFixture.competencies);
    expect(planFixture.objectives?.["3"]).toBe("Name plant parts");
    expect(result.plan.slots).toEqual(planFixture.slots);
  });
  it("blocks conflicting fields and invalidates changed lesson context", () => {
    const current = { ...planFixture, objectives: { "3": "Teacher revised this" } };
    const proposal = validateRevisionProposal({ id: "request-one", changes: [suggestion] }, makeRequest());
    expect(revisionConflicts(makeRequest().source, revisionSource(current), proposal)).toHaveLength(1);
    expect(applyRevision(current, makeRequest(), [suggestion]).applied).toHaveLength(0);
    expect(applyRevision({ ...planFixture, subject: "Mathematics" }, makeRequest(), [suggestion]).applied).toHaveLength(0);
  });
  it("undoes only unchanged applied suggestions, preserving newer edits and actual observations", () => {
    const result = applyRevision(planFixture, makeRequest(), [suggestion]);
    expect(undoRevision(result.plan, planFixture, result.applied).plan.objectives?.["3"]).toBe("Name plant parts");
    const newer = { ...result.plan, materials: "Pencils", objectives: { "3": "My later edit" } };
    const undone = undoRevision(newer, planFixture, result.applied);
    expect(undone.skipped).toBe(1);
    expect(undone.plan.objectives?.["3"]).toBe("My later edit");
    expect(undone.plan.materials).toBe("Pencils");
    expect(undone.plan.reflection).toBe("Actual classroom observation");
  });
  it("treats a shared whole-class activity as one group so exports cannot hide partial edits", () => {
    const together = { ...planFixture, slots: [{ ...planFixture.slots[0], wholeClass: true, gradeTasks: { "3": "Observe together", "4": "Observe together" } }] };
    const request = { ...makeRequest(), scope: "experience" as const, source: revisionSource(together) };
    const change = { field: "gradeTasks" as const, slotId: "s1", grade: "3", value: "Discuss leaves together" };
    expect(() => validateRevisionProposal({ id: request.id, changes: [change] }, request)).toThrow();
    expect(revisionGroupKeys(change, request.source)).toHaveLength(2);
    const proposal = validateRevisionProposal({ id: request.id, changes: [change, { ...change, grade: "4" }] }, request);
    expect(applyRevision(together, request, proposal.changes).plan.slots[0].gradeTasks).toEqual({ "3": "Discuss leaves together", "4": "Discuss leaves together" });
    const edited = { ...together, slots: [{ ...together.slots[0], gradeTasks: { "3": "Later edit", "4": "Observe together" } }] };
    expect(revisionConflicts(request.source, revisionSource(edited), proposal)).toHaveLength(2);
  });
});
