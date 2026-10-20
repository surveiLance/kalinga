import { describe, expect, it } from "vitest";
import { readWalkthroughStatus, walkthroughProgress, walkthroughSteps, nextWalkthroughStep, placeWalkthrough, canRestoreWalkthroughFocus, clipWalkthroughHighlight, canAdvanceWalkthrough } from "@/lib/gabay-walkthrough";
describe("Gabay's real-workspace walkthrough", () => {
  it("does not let Next move past class setup before the teacher opens the next real step", () => {
    expect(canAdvanceWalkthrough(2, ["class-details", "class-details-next"])).toBe(false);
    expect(canAdvanceWalkthrough(3, ["class-schedule"])).toBe(false);
    expect(canAdvanceWalkthrough(4, ["class-learners", "class-save"])).toBe(false);
    expect(canAdvanceWalkthrough(2, ["class-details", "class-schedule"])).toBe(true);
  });
  it("pauses Next on the wrong page but lets teachers move through hints on the open lesson", () => {
    expect(canAdvanceWalkthrough(7, ["nav-toggle", "community-page"])).toBe(false);
    expect(canAdvanceWalkthrough(7, ["plan-setup", "plan-document"])).toBe(true);
    expect(canAdvanceWalkthrough(5, ["nav-plan", "class-page"])).toBe(false);
  });
  it("clips the highlight to the visible scroll area above a sticky form footer", () => {
    expect(clipWalkthroughHighlight({ left: 20, top: -100, width: 900, height: 1000 }, [{ left: 0, top: 0, width: 1280, height: 720 }, { left: 20, top: 25, width: 900, height: 670 }, { left: 20, top: 25, width: 900, height: 580 }])).toEqual({ left: 20, top: 25, width: 900, height: 580 });
  });
  it("pads a visible control without shifting its highlight away from the control", () => {
    expect(clipWalkthroughHighlight({ left: 60, top: 80, width: 200, height: 40 }, [{ left: 8, top: 8, width: 1264, height: 704 }])).toEqual({ left: 55, top: 75, width: 210, height: 50 });
  });
  it("hides the highlight when the actual target is outside its scrollport", () => {
    expect(clipWalkthroughHighlight({ left: 20, top: 602, width: 500, height: 80 }, [{ left: 20, top: 100, width: 500, height: 500 }])).toBeNull();
    expect(clipWalkthroughHighlight({ left: -200, top: 100, width: 100, height: 50 }, [{ left: 8, top: 8, width: 374, height: 828 }])).toBeNull();
  });
  it("restores focus only to a usable trigger, not the document body or a removed popup", () => {
    expect(canRestoreWalkthroughFocus({ tagName: "BODY", isConnected: true }, true)).toBe(false);
    expect(canRestoreWalkthroughFocus({ tagName: "BUTTON", isConnected: false }, true)).toBe(false);
    expect(canRestoreWalkthroughFocus({ tagName: "BUTTON", isConnected: true }, false)).toBe(false);
    expect(canRestoreWalkthroughFocus({ tagName: "BUTTON", isConnected: true }, true)).toBe(true);
  });
  it("safely reads old progress without treating old practice missions as current steps", () => {
    expect(readWalkthroughStatus('{"step":5,"completed":true,"dismissed":false}')).toEqual({ version: 2, step: 0, completed: false, dismissed: true });
    expect(readWalkthroughStatus('{"version":2,"step":-100}').step).toBe(0);
    expect(readWalkthroughStatus('{"version":2,"step":999}').step).toBe(walkthroughSteps.length - 1);
    expect(readWalkthroughStatus('null').step).toBe(0);
    expect(readWalkthroughStatus('broken').completed).toBe(false);
  });
  it("moves guidance only after the relevant real screen appears", () => {
    const step = walkthroughSteps.findIndex((item) => item.id === "class-details");
    expect(nextWalkthroughStep(step, ["class-details"])).toBe(step);
    expect(nextWalkthroughStep(step, ["class-schedule"])).toBe(step + 1);
    expect(nextWalkthroughStep(step, ["plan-saved"])).toBe(step);
  });
  it("lets a teacher revisit a step without automatically jumping forward again", () => {
    const step = walkthroughSteps.findIndex((item) => item.id === "plan-save");
    expect(nextWalkthroughStep(step, ["plan-saved"], ["plan-saved"])).toBe(step);
    expect(nextWalkthroughStep(step, ["plan-saved"], [])).toBe(step + 1);
  });
  it("can finish or pause without any workspace mutation command", () => {
    expect(walkthroughProgress(3, "pause")).toEqual({ version: 2, step: 3, completed: false, dismissed: true });
    expect(walkthroughProgress(walkthroughSteps.length - 1, "next")).toEqual({ version: 2, step: walkthroughSteps.length - 1, completed: true, dismissed: false });
    expect(walkthroughProgress(0, "back").step).toBe(0);
  });
  it("places a readable coach beside the target without covering it on wide screens", () => {
    const placed = placeWalkthrough({ left: 40, top: 160, width: 280, height: 200 }, { width: 1200, height: 800 }, { width: 360, height: 300 });
    expect(placed.left).toBeGreaterThanOrEqual(336);
    expect(placed.top + 300).toBeLessThanOrEqual(784);
    expect(placed.dock).not.toBe(true);
  });
  it("reserves layout space rather than covering a large form when no floating position fits", () => {
    const placed = placeWalkthrough({ left: 200, top: 250, width: 880, height: 440 }, { width: 1280, height: 720 }, { width: 380, height: 450 });
    expect(placed.dock).toBe(true);
  });
  it("avoids nearby controls even when the highlighted target itself has room beside it", () => {
    const placed = placeWalkthrough({ left: 40, top: 160, width: 200, height: 40 }, { width: 1200, height: 800 }, { width: 360, height: 300 }, [{ left: 250, top: 150, width: 650, height: 600 }]);
    expect(placed.dock).toBe(true);
  });
  it("uses an in-flow dock instead of an overlapping bottom sheet on narrow screens", () => {
    const placed = placeWalkthrough({ left: 20, top: 100, width: 350, height: 70 }, { width: 390, height: 700 }, { width: 360, height: 280 });
    expect(placed.dock).toBe(true);
  });
});
