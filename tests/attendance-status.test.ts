import { describe, expect, it } from "vitest";
import { attendanceStatusLabel, attendanceStatuses, isStoredAttendanceStatus, toStoredAttendanceStatus } from "@/lib/attendance";
import { attendanceChanges, reconcilePendingWrites, enqueuePendingWrite } from "@/lib/pending-writes";

type TestWorkspace = { classes: { id: string; learners: { id: string; grade: string }[] }[]; plans: { id: string; classId: string }[]; attendance: Record<string, Record<string, string>>; attendanceNotes: Record<string, Record<string, string>> };

// Attendance crosses a casing boundary twice: the UI writes "Present", the
// database column accepts "present" only, and the value has to come back as
// "Present" or the roster renders nothing as selected.
describe("attendance status casing", () => {
  it("converts every UI status to a value the check constraint accepts", () => {
    for (const status of attendanceStatuses) {
      expect(isStoredAttendanceStatus(toStoredAttendanceStatus(status))).toBe(true);
    }
  });

  it("converts every stored status back to the exact UI label", () => {
    for (const status of attendanceStatuses) {
      expect(attendanceStatusLabel(toStoredAttendanceStatus(status))).toBe(status);
    }
  });

  it("round-trips through the database form without drift", () => {
    for (const status of attendanceStatuses) {
      expect(attendanceStatusLabel(toStoredAttendanceStatus(attendanceStatusLabel(toStoredAttendanceStatus(status))))).toBe(status);
    }
  });

  it("falls back to Present rather than rendering an unknown status", () => {
    expect(attendanceStatusLabel("nonsense")).toBe("Present");
    expect(attendanceStatusLabel("")).toBe("Present");
  });
});

describe("attendance survives a save and reload", () => {
  const teachingClass = { id: "c1", learners: [{ id: "l1", grade: "3" }, { id: "l2", grade: "3" }] };
  const key = "c1-2026-09-07-grade-3";
  const scope = "teacher-abc";

  it("puts a UI label into the queue in the database's form", () => {
    const [change] = attendanceChanges([teachingClass], { [key]: { l1: "Late" } }, {});
    expect(change.records[0].status).toBe("late");
  });

  // The regression: a pending change overlaid on a cloud refresh used to hand the
  // roster a lowercase status it could not match against its own buttons.
  it("overlays a pending change in the label form the roster renders", () => {
    const queue = enqueuePendingWrite([], scope, { kind: "attendance", classId: "c1", date: "2026-09-07", records: [{ learnerId: "l1", grade: "3", status: "late", note: "" }] }, "w1", 1);
    const merged = reconcilePendingWrites({ classes: [teachingClass], plans: [], attendance: {}, attendanceNotes: {} } as TestWorkspace, queue, scope);
    expect(merged.attendance[key].l1).toBe("Late");
    expect(attendanceStatuses).toContain(merged.attendance[key].l1);
  });

  it("keeps a saved status through queue and overlay unchanged", () => {
    const changes = attendanceChanges([teachingClass], { [key]: { l1: "Excused", l2: "Present" } }, {});
    const queue = changes.reduce((current, change, index) => enqueuePendingWrite(current, scope, change, `w${index}`, 1), [] as ReturnType<typeof enqueuePendingWrite>);
    const merged = reconcilePendingWrites({ classes: [teachingClass], plans: [], attendance: {}, attendanceNotes: {} } as TestWorkspace, queue, scope);
    expect(merged.attendance[key]).toEqual({ l1: "Excused", l2: "Present" });
  });
});
