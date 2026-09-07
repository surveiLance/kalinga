import { normalizeGradeLevel } from "@/lib/grades";
import { createSampleLearners, normalizeLearnerSex } from "@/lib/learners";
import { createDefaultMeeting } from "@/lib/schedule";
import type { LegacySavedPlan, LegacyTeachingClass, SavedPlan, TeachingClass } from "@/lib/teaching-types";

export function normalizeClass(item: LegacyTeachingClass): TeachingClass {
  const grades = Array.isArray(item.grades) && item.grades.length ? item.grades.map(normalizeGradeLevel) : ["1"];
  const subjects = Array.isArray(item.subjects) && item.subjects.length
    ? item.subjects.filter(Boolean)
    : [item.subject || "Mathematics"];
  const learners = Array.isArray(item.learners) && item.learners.length
    ? item.learners.map((learner, index) => ({ id: learner.id || `${item.id}-learner-${index + 1}`, name: learner.name, grade: normalizeGradeLevel(learner.grade || grades[0]), sex: normalizeLearnerSex(learner.sex) }))
    : createSampleLearners(grades, Math.max(0, item.learnerCount || 0)).map((learner) => ({ ...learner, id: `${item.id}-${learner.id}` }));
  const meetingDays = item.meetingDays || "Monday to Friday";
  const startTime = item.startTime || "8:00 AM";
  const meetings = Array.isArray(item.meetings) && item.meetings.length
    ? item.meetings.map((meeting, index) => ({ id: meeting.id || `${item.id}-meeting-${index + 1}`, days: meeting.days || meetingDays, startTime: meeting.startTime || startTime, durationMinutes: Math.max(5, Number(meeting.durationMinutes) || 60), label: meeting.label?.trim() || "Regular class" }))
    : [{ ...createDefaultMeeting(meetingDays, startTime), id: `${item.id}-meeting-1` }];

  return {
    id: item.id,
    name: item.name,
    grades,
    subjects,
    quarter: item.quarter || "Quarter 1",
    meetingDays: meetings[0].days,
    startTime: meetings[0].startTime,
    meetings,
    learners,
  };
}

export function normalizeSavedPlan(plan: LegacySavedPlan): SavedPlan {
  return { ...plan, grades: plan.grades.map(normalizeGradeLevel) };
}

export function remoteSchedule(value: unknown) {
  if (Array.isArray(value)) return { quarter: "Quarter 1", meetings: value };
  if (value && typeof value === "object") {
    const schedule = value as { quarter?: unknown; meetings?: unknown };
    return {
      quarter: typeof schedule.quarter === "string" ? schedule.quarter : "Quarter 1",
      meetings: Array.isArray(schedule.meetings) ? schedule.meetings : [],
    };
  }
  return { quarter: "Quarter 1", meetings: [] };
}
