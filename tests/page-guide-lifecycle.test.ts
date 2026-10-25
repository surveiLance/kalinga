import { describe, expect, it } from "vitest";
import { isCurrentPageGuide, isNewPageGuideRequest, markPageGuideOffered, readPageGuideStatus, shouldOfferPageGuide } from "@/lib/page-guides";

describe("page guide lifecycle", () => {
  const current = { scope: "teacher-a", page: "classes" as const };
  it("cannot render the previous page or workspace's guidance", () => {
    expect(isCurrentPageGuide(current, "teacher-a", "classes")).toBe(true);
    expect(isCurrentPageGuide(current, "teacher-a", "plan")).toBe(false);
    expect(isCurrentPageGuide(current, "teacher-b", "classes")).toBe(false);
    expect(isCurrentPageGuide(current, "", "classes")).toBe(false);
    expect(isCurrentPageGuide(null, "teacher-a", "classes")).toBe(false);
  });
  it("does not reopen a consumed request when returning to a page", () => {
    const request = { ...current, id: 4 };
    expect(isNewPageGuideRequest(request, "teacher-a", "classes", 3)).toBe(true);
    expect(isNewPageGuideRequest(request, "teacher-a", "classes", 4)).toBe(false);
    expect(isNewPageGuideRequest(request, "teacher-a", "plan", 3)).toBe(false);
    expect(isNewPageGuideRequest(request, "teacher-b", "classes", 3)).toBe(false);
    expect(isNewPageGuideRequest(null, "teacher-a", "classes", 0)).toBe(false);
  });
  it("retains only in-memory invitation progress when storage is unavailable", () => {
    const original = readPageGuideStatus(null);
    const currentSession = markPageGuideOffered(original, "classes");
    expect(shouldOfferPageGuide(currentSession, "classes", true, false)).toBe(false);
    expect(shouldOfferPageGuide(currentSession, "plan", true, false)).toBe(true);
    expect(shouldOfferPageGuide(original, "classes", true, true)).toBe(false);
  });
});
