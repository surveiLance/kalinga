import { describe, expect, it } from "vitest";
import { createUpdateGuards } from "@/lib/app-update";

describe("safe application updates", () => {
  it("blocks refreshing while a mounted editor has unsaved work", () => {
    const guards = createUpdateGuards();
    const remove = guards.add(() => "Save your lesson before updating.");
    expect(guards.check()).toBe("Save your lesson before updating.");
    remove();
    expect(guards.check()).toBe("");
  });
  it("uses current editor state and fails closed if a persistence check throws", () => {
    const guards = createUpdateGuards(); let dirty = true;
    guards.add(() => dirty ? "Save attendance first." : "");
    expect(guards.check()).toBe("Save attendance first."); dirty = false;
    expect(guards.check()).toBe("");
    guards.add(() => { throw new Error("storage blocked"); });
    expect(guards.check()).toContain("could not");
  });
});
