import { describe, expect, it } from "vitest";
import { readWalkthroughStatus, walkthroughProgress, walkthroughSteps, nextWalkthroughStep, placeWalkthrough, canRestoreWalkthroughFocus } from "@/lib/gabay-walkthrough";
describe("Gabay's real-workspace walkthrough", () => {
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
