import { describe, expect, it } from "vitest";
import { placeWalkthrough, canRestoreWalkthroughFocus, clipWalkthroughHighlight } from "@/lib/gabay-walkthrough";
describe("Gabay's real-workspace walkthrough", () => {
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
