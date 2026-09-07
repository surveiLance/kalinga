import { describe, expect, it } from "vitest";
import { attendanceChanges } from "@/lib/pending-writes";

// The composite key `${classId}-${date}-grade-${grade}` is parsed back apart before
// attendance reaches Supabase. Class ids are UUIDs full of hyphens and digits, and
// grades can be named, so the split has to stay unambiguous.
const attendanceKey = /^(.*)-(\d{4}-\d{2}-\d{2})-grade-(.+)$/;

describe("attendance composite key", () => {
  it("splits a UUID class id, an ISO date, and a numbered grade", () => {
    const match = "9f2c1d4e-7b3a-4c1d-8e2f-1a2b3c4d5e6f-2026-09-07-grade-3".match(attendanceKey);
    expect(match?.[1]).toBe("9f2c1d4e-7b3a-4c1d-8e2f-1a2b3c4d5e6f");
    expect(match?.[2]).toBe("2026-09-07");
    expect(match?.[3]).toBe("3");
  });

  it("keeps a named grade intact", () => {
    expect("c1-2026-09-07-grade-Kindergarten".match(attendanceKey)?.[3]).toBe("Kindergarten");
  });

  it("does not mistake a date inside the class id for the attendance date", () => {
    const match = "class-2020-01-01-2026-09-07-grade-3".match(attendanceKey);
    expect(match?.[2]).toBe("2026-09-07");
    expect(match?.[1]).toBe("class-2020-01-01");
  });

  it("rejects a key with no date", () => {
    expect("c1-grade-3".match(attendanceKey)).toBeNull();
  });
});

describe("attendanceChanges", () => {
  const teachingClass = { id: "c1", learners: [{ id: "l1", grade: "3" }, { id: "l2", grade: "4" }] };
  const key = "c1-2026-09-07-grade-3";

  // The UI stores "Present" but the attendance_records check constraint accepts
  // lowercase only. Rows used to be filtered out here and reported as saved.
  it("lowercases the status the UI stores so the row passes the check constraint", () => {
    const [change] = attendanceChanges([teachingClass], { [key]: { l1: "Present" } }, {});
    expect(change.records[0].status).toBe("present");
  });

  it("accepts every status the UI can produce", () => {
    const statuses = { l1: "Present", l2: "Late" };
    const [change] = attendanceChanges([teachingClass], { [key]: statuses }, {});
    expect(change.records.map((row) => row.status)).toEqual(["present", "late"]);
  });

  it("rejects an unknown learner instead of silently dropping the row", () => {
    expect(() => attendanceChanges([teachingClass], { [key]: { ghost: "Present" } }, {})).toThrow(/unknown learner/);
  });

  it("rejects a status the database would refuse", () => {
    expect(() => attendanceChanges([teachingClass], { [key]: { l1: "Tardy" } }, {})).toThrow(/unknown learner or status/);
  });

  it("rejects attendance for a class that is not saved", () => {
    expect(() => attendanceChanges([teachingClass], { "c9-2026-09-07-grade-3": { l1: "Present" } }, {})).toThrow(/saved class/);
  });

  it("carries the learner's grade from the roster rather than the key", () => {
    const [change] = attendanceChanges([teachingClass], { [key]: { l2: "Present" } }, {});
    expect(change.records[0].grade).toBe("4");
  });

  it("trims notes and defaults a missing note to an empty string", () => {
    const [change] = attendanceChanges([teachingClass], { [key]: { l1: "Present", l2: "Absent" } }, { [key]: { l1: "  arrived late  " } });
    expect(change.records[0].note).toBe("arrived late");
    expect(change.records[1].note).toBe("");
  });

  it("groups one class and date into a single change across grade views", () => {
    const changes = attendanceChanges([teachingClass], {
      "c1-2026-09-07-grade-3": { l1: "Present" },
      "c1-2026-09-07-grade-4": { l2: "Absent" },
    }, {});
    expect(changes).toHaveLength(1);
    expect(changes[0].records).toHaveLength(2);
  });

  it("keeps separate dates apart", () => {
    const changes = attendanceChanges([teachingClass], {
      "c1-2026-09-07-grade-3": { l1: "Present" },
      "c1-2026-09-08-grade-3": { l1: "Absent" },
    }, {});
    expect(changes.map((change) => change.date)).toEqual(["2026-09-07", "2026-09-08"]);
  });
});
