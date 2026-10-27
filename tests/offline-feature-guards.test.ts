import { afterEach, describe, expect, it, vi } from "vitest";
import { askConnectedGabay, requestGabayDraft, requestGabayRevision } from "@/lib/gabay-ai";
afterEach(() => vi.unstubAllGlobals());
describe("offline AI boundaries", () => {
  it("rejects chat and draft attempts before any cloud request", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const context = { view: "plan", gradeLevels: ["3"], offline: true };
    expect(await askConnectedGabay("Help", context)).toEqual({ connected: false, reason: "offline" });
    expect(await requestGabayDraft("full-plan", context, "3")).toEqual({ connected: false, reason: "offline" });
    expect((await requestGabayRevision({} as never, context)).connected).toBe(false);
  });
});
