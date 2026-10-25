import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassWorkspaceHeader } from "@/components/class-workspace-header";
import type { TeachingClass } from "@/lib/teaching-types";

const teachingClass: TeachingClass = { id: "c1", name: "18C", grades: ["3", "4", "5"], subjects: ["Filipino"], quarter: "Quarter 1", meetingDays: "Monday to Friday", startTime: "8:00 AM", meetings: [], learners: [{ id: "l1", name: "Sample learner", grade: "3", sex: "Not specified" }] };
const callbacks = { onSelectClass: () => {}, onAddClass: () => {}, onAttendance: () => {}, onPlan: () => {}, onResources: () => {} };
const render = (classes: TeachingClass[], selectedClass = classes[0]) => renderToStaticMarkup(createElement(ClassWorkspaceHeader, { classes, selectedClass, ...callbacks }));

describe("class workspace header", () => {
  it("shows attendance before lesson and resource actions, without a single-class picker", () => {
    const html = render([teachingClass]);
    expect(html).toContain('<h1>18C</h1>');
    expect(html).toContain('Grade 3, Grade 4, Grade 5');
    expect(html).toContain('1 learner');
    expect(html).not.toContain('<select');
    const actions = html.split('aria-label="Class actions"')[1];
    expect(actions.indexOf('Take attendance')).toBeLessThan(actions.indexOf('Plan a lesson'));
    expect(actions.indexOf('Plan a lesson')).toBeLessThan(actions.indexOf('Find resources'));
    expect(actions.match(/<button[^>]*class="primary-button[^>]*>[^<]*Take attendance/)?.[0]).toBeTruthy();
    expect(html).toContain('data-tour="class-add"');
  });
  it("retains a named selector and selects the current class when more than one exists", () => {
    const other = { ...teachingClass, id: "c2", name: "Afternoon class" };
    const html = render([teachingClass, other], other);
    expect(html).toContain('aria-label="Choose class"');
    expect(html).toContain('<option value="c2" selected="">Afternoon class</option>');
    expect(html).toContain('<h1>Afternoon class</h1>');
  });
  it("keeps attendance available for an empty roster and preserves long class names", () => {
    const html = render([{ ...teachingClass, name: 'Morning class with Grades 3, 4 and 5', learners: [] }]);
    expect(html).toContain('<h1>Morning class with Grades 3, 4 and 5</h1>');
    expect(html).toContain('0 learners');
    const attendance = html.match(/<button[^>]*>Take attendance[^<]*<\/button>/)?.[0];
    expect(attendance).toBeTruthy();
    expect(attendance).not.toContain('disabled');
  });
});
