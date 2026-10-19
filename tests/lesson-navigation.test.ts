import { describe, expect, it } from "vitest";
import { leaveLesson, deleteLesson } from "@/lib/lesson-navigation";
describe("lesson editor navigation", () => {
  it("keeps unsaved work when leaving is cancelled, without saving", () => {
    let page = "editor";
    leaveLesson(true, () => false, () => { page = "list"; });
    expect(page).toBe("editor");
    leaveLesson(true, () => true, () => { page = "list"; });
    expect(page).toBe("list");
  });
  it("returns a clean lesson directly to the full list", () => {
    let page = "editor";
    leaveLesson(false, () => { throw new Error("Unexpected confirmation"); }, () => { page = "list"; });
    expect(page).toBe("list");
  });
  it("deletes exactly the confirmed lesson and never deletes after cancellation", () => {
    let plans = ["first", "second"];
    const remove = (id: string) => { plans = plans.filter((item) => item !== id); };
    expect(deleteLesson("first", "Plants", () => false, remove)).toBe(false);
    expect(plans).toEqual(["first", "second"]);
    expect(deleteLesson("second", "Fractions", (message) => message.includes("Fractions"), remove)).toBe(true);
    expect(plans).toEqual(["first"]);
    expect(deleteLesson("", "Unsaved", () => true, remove)).toBe(false);
  });
});
