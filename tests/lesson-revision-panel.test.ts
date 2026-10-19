import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonRevisionPanel } from "@/components/lesson-revision-panel";
import { createRevisionLifecycle } from "@/lib/revision-lifecycle";
import type { SavedPlan } from "@/lib/teaching-types";
const plan: SavedPlan = { id: "p", classId: "c", title: "Plants", subject: "Science", grades: ["3"], duration: "60 minutes", quarter: "Quarter 1", slots: [{ id: "s", time: "8:00 AM", teacherFocus: "Guide", gradeTasks: { "3": "Observe leaves" } }], savedAt: "today" };
describe("lesson revision panel", () => {
  it("identifies itself as nonmodal and keeps teacher approval explicit", () => {
    const markup = renderToStaticMarkup(createElement(LessonRevisionPanel, { plan, initialScope: "whole", onClose: () => {}, onApply: () => {} }));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="false"');
    expect(markup).toContain("Whole lesson");
    expect(markup).toContain("I · Intentions");
    expect(markup).toContain("W · Ways Forward");
    expect(markup).toContain("Your lesson stays unchanged");
    expect(markup).toContain("Suggest changes");
  });
  it("invalidates requests after cancellation, replacement, or leaving the plan", () => {
    const lifecycle = createRevisionLifecycle();
    const first = lifecycle.start();
    expect(lifecycle.isCurrent(first.id)).toBe(true);
    const second = lifecycle.start();
    expect(first.signal.aborted).toBe(true);
    expect(lifecycle.isCurrent(first.id)).toBe(false);
    lifecycle.cancel();
    expect(second.signal.aborted).toBe(true);
    expect(lifecycle.isCurrent(second.id)).toBe(false);
  });
});
