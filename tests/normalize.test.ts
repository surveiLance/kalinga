import { describe, expect, it } from "vitest";
import { normalizeClass, normalizeSavedPlan, remoteSchedule } from "@/lib/normalize";
import type { LegacySavedPlan, LegacyTeachingClass } from "@/lib/teaching-types";

describe("normalizeClass", () => {
  it("upgrades a legacy singular subject into the subjects array", () => {
    const item = normalizeClass({ id: "c1", name: "Morning", subject: "Science" } as LegacyTeachingClass);
    expect(item.subjects).toEqual(["Science"]);
  });

  it("defaults to Mathematics when a legacy record carries no subject at all", () => {
    expect(normalizeClass({ id: "c1", name: "Morning" }).subjects).toEqual(["Mathematics"]);
  });

  it("normalizes written grades on both the class and its learners", () => {
    const item = normalizeClass({
      id: "c1",
      name: "Morning",
      grades: ["Grade 3", 4, "K"],
      learners: [{ id: "l1", name: "A", grade: "Grade 3" }, { id: "l2", name: "B", grade: 4 }],
    });
    expect(item.grades).toEqual(["3", "4", "Kindergarten"]);
    expect(item.learners.map((learner) => learner.grade)).toEqual(["3", "4"]);
  });

  it("builds a roster from a legacy learnerCount when no learners were stored", () => {
    const item = normalizeClass({ id: "c1", name: "Morning", grades: ["3", "4"], learnerCount: 4 });
    expect(item.learners).toHaveLength(4);
    expect(item.learners.map((learner) => learner.grade)).toEqual(["3", "4", "3", "4"]);
    expect(new Set(item.learners.map((learner) => learner.id)).size).toBe(4);
  });

  it("gives learners ids scoped to the class so two classes cannot collide", () => {
    const first = normalizeClass({ id: "c1", name: "A", learnerCount: 2 });
    const second = normalizeClass({ id: "c2", name: "B", learnerCount: 2 });
    const ids = new Set([...first.learners, ...second.learners].map((learner) => learner.id));
    expect(ids.size).toBe(4);
  });

  it("synthesizes a meeting when none was stored and mirrors it onto the legacy fields", () => {
    const item = normalizeClass({ id: "c1", name: "Morning", meetingDays: "Tuesday and Thursday", startTime: "1:30 PM" });
    expect(item.meetings).toHaveLength(1);
    expect(item.meetingDays).toBe("Tuesday and Thursday");
    expect(item.startTime).toBe("1:30 PM");
  });

  it("clamps an unusable meeting duration instead of storing zero minutes", () => {
    const item = normalizeClass({ id: "c1", name: "Morning", meetings: [{ id: "m1", durationMinutes: 0 }] });
    expect(item.meetings[0].durationMinutes).toBe(60);
  });

  it("defaults an empty grade list to grade 1 rather than an empty multigrade class", () => {
    expect(normalizeClass({ id: "c1", name: "Morning", grades: [] }).grades).toEqual(["1"]);
  });

  it("is idempotent, so repeated hydration cannot drift", () => {
    const once = normalizeClass({ id: "c1", name: "Morning", grades: ["Grade 3"], learnerCount: 3 });
    expect(normalizeClass(once)).toEqual(once);
  });
});

describe("normalizeSavedPlan", () => {
  it("normalizes plan grades so a plan keeps matching its class", () => {
    const plan = { id: "p1", classId: "c1", grades: ["Grade 3", 4], slots: [] } as unknown as LegacySavedPlan;
    expect(normalizeSavedPlan(plan).grades).toEqual(["3", "4"]);
  });

  it("preserves every other field untouched", () => {
    const plan = { id: "p1", classId: "c1", title: "Fractions", grades: ["3"], slots: [], savedAt: "today" } as unknown as LegacySavedPlan;
    expect(normalizeSavedPlan(plan)).toMatchObject({ id: "p1", title: "Fractions", savedAt: "today" });
  });
});

describe("remoteSchedule", () => {
  it("reads the current object shape", () => {
    expect(remoteSchedule({ quarter: "Quarter 2", meetings: [{ days: "Monday" }] })).toEqual({ quarter: "Quarter 2", meetings: [{ days: "Monday" }] });
  });

  it("reads the legacy bare-array shape as quarter 1", () => {
    expect(remoteSchedule([{ days: "Monday" }])).toEqual({ quarter: "Quarter 1", meetings: [{ days: "Monday" }] });
  });

  it("falls back safely on null, a string, or a malformed object", () => {
    for (const value of [null, undefined, "nope", 7, { meetings: "nope" }]) {
      expect(remoteSchedule(value)).toEqual({ quarter: "Quarter 1", meetings: [] });
    }
  });
});
