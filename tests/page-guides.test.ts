import { describe, expect, it } from "vitest";
import { completePageGuide, markPageGuideOffered, pageGuideSteps, readPageGuideStatus, shouldOfferPageGuide, type PageGuidePage } from "@/lib/page-guides";

describe("page-guide invitations", () => {
  it("offers help only after preferences load and blocking UI closes", () => {
    const status = readPageGuideStatus(null);
    expect(shouldOfferPageGuide(status, "classes", false, false)).toBe(false);
    expect(shouldOfferPageGuide(status, "classes", true, true)).toBe(false);
    expect(shouldOfferPageGuide(status, "classes", true, false)).toBe(true);
  });
  it("remembers seeing an invitation without suppressing other pages", () => {
    const status = readPageGuideStatus(null);
    const offered = markPageGuideOffered(status, "classes");
    expect(status.pages).toEqual({});
    expect(shouldOfferPageGuide(offered, "classes", true, false)).toBe(false);
    expect(shouldOfferPageGuide(offered, "plan", true, false)).toBe(true);
    expect(readPageGuideStatus(JSON.stringify(offered)).pages.classes).toEqual({ offered: true, completed: false });
  });
  it("completes only the current page and still supplies steps for manual replay", () => {
    const status = completePageGuide(readPageGuideStatus(null), "plan");
    expect(status.pages).toEqual({ plan: { offered: true, completed: true } });
    expect(pageGuideSteps("plan", ["plan-index", "plan-new"]).length).toBeGreaterThan(0);
    expect(shouldOfferPageGuide(status, "classes", true, false)).toBe(true);
  });
  it("normalizes malformed records without treating strings as permission to prompt", () => {
    expect(readPageGuideStatus('broken').pages).toEqual({});
    expect(readPageGuideStatus('null').pages).toEqual({});
    const status = readPageGuideStatus('{"version":3,"pages":{"classes":{"offered":"false","completed":true},"plan":null,"unknown":{"offered":true}}}');
    expect(status.pages).toEqual({ classes: { offered: true, completed: true } });
  });
  it.each([
    '{"version":2,"step":15,"dismissed":true}',
    '{"version":2,"step":18,"completed":true}',
    '{"step":5,"completed":true}',
    '{"version":99,"pages":{}}',
  ])("does not surprise a teacher who dismissed/completed an older guide: %s", (stored) => {
    const status = readPageGuideStatus(stored);
    for (const page of ["home", "classes", "plan", "teach", "library", "attendance", "community"] as const) {
      expect(shouldOfferPageGuide(status, page, true, false)).toBe(false);
    }
    expect(pageGuideSteps("classes", ["class-page", "class-add"]).length).toBeGreaterThan(0);
  });
  it("discards an old unfinished numeric step instead of resuming on the wrong page", () => {
    const status = readPageGuideStatus('{"version":2,"step":12,"completed":false,"dismissed":false}');
    expect(status).toEqual({ version: 3, pages: {} });
  });
});

describe("guides follow the current page and surface", () => {
  const ids = (page: PageGuidePage, markers: string[]) => pageGuideSteps(page, markers).map((step) => step.id);
  it("never selects another page from persistent sidebar markers", () => {
    expect(ids("classes", ["nav-plan", "plan-document", "gabay-open"])).toEqual([]);
    expect(ids("plan", ["class-page", "class-details", "nav-classes"])).toEqual([]);
  });
  it("explains creating a class separately from managing an existing class", () => {
    expect(ids("classes", ["class-page", "class-add"])).toEqual(["class-start"]);
    expect(ids("classes", ["class-page", "class-overview", "class-attendance", "class-tabs"])).toEqual(["class-attendance", "class-overview", "class-tabs"]);
  });
  it.each(["class-details", "class-schedule", "class-learners"])("shows only the real wizard step %s", (marker) => {
    expect(ids("classes", [marker])).toEqual([marker]);
  });
  it("limits the lesson index guide to opening or creating plans", () => {
    expect(ids("plan", ["plan-index", "plan-new"])).toEqual(["plan-index"]);
  });
  it("distinguishes initial lesson setup from editing a saved document", () => {
    expect(ids("plan", ["plan-page", "plan-setup-open", "plan-draft", "plan-manual", "plan-document", "plan-save", "plan-pdf", "plan-word", "plan-teach"])).toEqual(["plan-setup", "plan-start", "plan-edit", "plan-save", "plan-export", "plan-teach"]);
    expect(ids("plan", ["plan-page", "plan-change", "plan-document", "plan-improve", "plan-saved", "plan-pdf", "plan-word"])).toEqual(["plan-edit", "plan-improve", "plan-save", "plan-export"]);
  });
  it("uses reader-specific guidance inside the resource popup", () => {
    expect(ids("library", ["resource-reader", "resource-share", "resource-notes"])).toEqual(["resource-reader", "resource-share", "resource-notes"]);
    expect(ids("library", ["library-page", "resource-upload"])).toEqual(["library-browse", "resource-upload"]);
  });
  it("supports sign-in guidance when community posting is unavailable", () => {
    expect(ids("community", ["community-page", "community-signin"])).toEqual(["community-signin"]);
    expect(ids("community", ["community-page", "community-ask", "community-discussions"])).toEqual(["community-ask", "community-discussions"]);
  });
  it.each([
    ["home", ["home-page", "sync-status"], ["home-overview", "home-sync"]],
    ["teach", ["teach-page", "teach-current", "teach-steps", "teach-notes"], ["teach-current", "teach-steps", "teach-notes"]],
    ["attendance", ["attendance-page", "attendance-date", "attendance-records", "attendance-save"], ["attendance-date", "attendance-records", "attendance-save"]],
    ["attendance", ["attendance-empty"], ["attendance-empty"]],
  ] as [PageGuidePage, string[], string[]][])("provides local steps for %s", (page, markers, expected) => {
    expect(ids(page, markers)).toEqual(expected);
  });
});
