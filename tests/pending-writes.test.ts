import { describe, expect, it } from "vitest";
import { acknowledgePendingWrite, enqueuePendingWrite, failPendingWrite, maxSyncAttempts, pendingCandidates, readPendingWrites, reconcilePendingWrites, retryPendingWrites, startPendingWrite, type PendingChange, type PendingWrite } from "@/lib/pending-writes";

type TestClass = { id: string; name: string; learners: { id: string; grade: string }[] };
type TestPlan = { id: string; classId: string };
type TestQueue = PendingWrite<TestClass, TestPlan>[];

const scope = "teacher-abc";
const now = 1_000;
const classA: TestClass = { id: "c1", name: "Morning", learners: [{ id: "l1", grade: "3" }] };
const server: { classes: TestClass[]; plans: TestPlan[]; attendance: Record<string, Record<string, string>>; attendanceNotes: Record<string, Record<string, string>> } = {
  classes: [{ id: "c1", name: "stale server copy", learners: [] }, { id: "c2", name: "server only", learners: [] }],
  plans: [],
  attendance: {},
  attendanceNotes: {},
};

function queueWith(...changes: PendingChange<TestClass, TestPlan>[]): TestQueue {
  return changes.reduce<TestQueue>((queue, change, index) => enqueuePendingWrite(queue, scope, change, `w${index}`, now), []);
}

function entryOfKind<K extends PendingChange["kind"]>(queue: TestQueue, kind: K, index = 0) {
  const entry = queue[index];
  if (entry?.kind !== kind) throw new Error(`expected a ${kind} entry, got ${entry?.kind ?? "nothing"}`);
  return entry as Extract<PendingWrite<TestClass, TestPlan>, { kind: K }>;
}

describe("enqueuePendingWrite", () => {
  it("collapses repeated saves of one class into a single latest entry", () => {
    const queue = queueWith(
      { kind: "class", classId: "c1", value: classA },
      { kind: "class", classId: "c1", value: { ...classA, name: "renamed" } },
    );
    expect(queue).toHaveLength(1);
    expect(entryOfKind(queue, "class").value.name).toBe("renamed");
  });

  it("keeps separate classes as separate entries", () => {
    const queue = queueWith(
      { kind: "class", classId: "c1", value: classA },
      { kind: "class", classId: "c2", value: { ...classA, id: "c2" } },
    );
    expect(queue).toHaveLength(2);
  });

  it("drops a class's queued work once that class is queued for deletion", () => {
    const queue = queueWith(
      { kind: "class", classId: "c1", value: classA },
      { kind: "delete-class", classId: "c1" },
    );
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe("delete-class");
  });

  it("merges attendance for the same class and date, keeping the newest per learner", () => {
    const queue = queueWith(
      { kind: "attendance", classId: "c1", date: "2026-09-07", records: [{ learnerId: "l1", grade: "3", status: "absent", note: "" }] },
      { kind: "attendance", classId: "c1", date: "2026-09-07", records: [{ learnerId: "l1", grade: "3", status: "present", note: "" }] },
    );
    expect(queue).toHaveLength(1);
    expect(entryOfKind(queue, "attendance").records).toHaveLength(1);
    expect(entryOfKind(queue, "attendance").records[0].status).toBe("present");
  });

  it("refuses to mix another teacher's queue into this scope", () => {
    const foreign = enqueuePendingWrite([], "teacher-other", { kind: "class", classId: "c1", value: classA }, "w1", now);
    expect(() => enqueuePendingWrite(foreign, scope, { kind: "class", classId: "c1", value: classA }, "w2", now)).toThrow(/scope/i);
  });
});

describe("reconcilePendingWrites", () => {
  it("lets a queued local edit win over the stale server copy", () => {
    const queue = queueWith({ kind: "class", classId: "c1", value: { ...classA, name: "edited offline" } });
    const merged = reconcilePendingWrites(server, queue, scope);
    expect(merged.classes.find((item) => item.id === "c1")?.name).toBe("edited offline");
  });

  it("keeps server records that have no pending local change", () => {
    const queue = queueWith({ kind: "class", classId: "c1", value: classA });
    expect(reconcilePendingWrites(server, queue, scope).classes.map((item) => item.id)).toContain("c2");
  });

  it("keeps a queued deletion deleted even though the server still returns the row", () => {
    const queue = queueWith({ kind: "delete-class", classId: "c2" });
    expect(reconcilePendingWrites(server, queue, scope).classes.map((item) => item.id)).toEqual(["c1"]);
  });

  it("returns the server copy untouched when nothing is queued", () => {
    expect(reconcilePendingWrites(server, [], scope).classes).toHaveLength(2);
  });

  it("ignores entries belonging to a different teacher's scope", () => {
    const foreign = enqueuePendingWrite([], "teacher-other", { kind: "delete-class", classId: "c2" }, "w1", now);
    expect(reconcilePendingWrites(server, foreign, scope).classes).toHaveLength(2);
  });

  it("does not mutate the workspace it was given", () => {
    const queue = queueWith({ kind: "delete-class", classId: "c2" });
    reconcilePendingWrites(server, queue, scope);
    expect(server.classes).toHaveLength(2);
  });
});

describe("durability", () => {
  it("survives a round trip through localStorage", () => {
    const queue = queueWith({ kind: "class", classId: "c1", value: classA });
    expect(readPendingWrites(JSON.stringify(queue), scope)).toEqual(queue);
  });

  it("reads an absent queue as empty", () => {
    expect(readPendingWrites(null, scope)).toEqual([]);
  });

  it("refuses a queue written under another teacher's scope", () => {
    const queue = queueWith({ kind: "class", classId: "c1", value: classA });
    expect(() => readPendingWrites(JSON.stringify(queue), "teacher-other")).toThrow();
  });

  it("refuses corrupt data rather than silently discarding queued work", () => {
    expect(() => readPendingWrites("[{\"kind\":\"class\"}]", scope)).toThrow();
    expect(() => readPendingWrites("not json", scope)).toThrow();
  });
});

describe("retry budget", () => {
  it("backs off further on each attempt", () => {
    let queue = queueWith({ kind: "class", classId: "c1", value: classA });
    queue = startPendingWrite(queue, scope, "w0", now);
    const first = queue[0].nextAttemptAt;
    queue = startPendingWrite(queue, scope, "w0", now);
    expect(queue[0].nextAttemptAt).toBeGreaterThan(first);
    expect(queue[0].attempts).toBe(2);
  });

  it("parks an entry after the attempt budget without discarding it", () => {
    let queue = queueWith({ kind: "class", classId: "c1", value: classA });
    for (let attempt = 0; attempt < maxSyncAttempts; attempt += 1) queue = startPendingWrite(queue, scope, "w0", now);
    expect(queue).toHaveLength(1);
    expect(pendingCandidates(queue, scope)).toHaveLength(0);
  });

  it("makes a parked entry eligible again after an explicit retry", () => {
    let queue = queueWith({ kind: "class", classId: "c1", value: classA });
    for (let attempt = 0; attempt < maxSyncAttempts; attempt += 1) queue = startPendingWrite(queue, scope, "w0", now);
    queue = retryPendingWrites(queue, scope, now);
    expect(pendingCandidates(queue, scope)).toHaveLength(1);
    expect(queue[0].error).toBe("");
  });

  it("records a failure without dropping the entry", () => {
    let queue = queueWith({ kind: "class", classId: "c1", value: classA });
    queue = failPendingWrite(queue, scope, "w0", "cloud rejected this");
    expect(queue).toHaveLength(1);
    expect(queue[0].error).toBe("cloud rejected this");
  });

  it("removes an entry only once it is acknowledged", () => {
    const queue = queueWith({ kind: "class", classId: "c1", value: classA });
    expect(acknowledgePendingWrite(queue, scope, "w0")).toHaveLength(0);
  });

  it("holds a class's dependent work until the class itself syncs", () => {
    const queue = queueWith(
      { kind: "class", classId: "c1", value: classA },
      { kind: "plan", classId: "c1", value: { id: "p1", classId: "c1" } },
    );
    expect(pendingCandidates(queue, scope).map((item) => item.kind)).toEqual(["class"]);
  });
});
