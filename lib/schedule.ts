import type { ClassMeeting } from "@/lib/teaching-types";

export const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function parseTime(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: 8, minute: 0, period: "AM" as "AM" | "PM" };
  return { hour: Math.min(12, Math.max(1, Number(match[1]))), minute: Math.min(59, Math.max(0, Number(match[2]))), period: match[3].toUpperCase() as "AM" | "PM" };
}

export function toMinutes(time: string) {
  const { hour, minute, period } = parseTime(time);
  return (hour % 12) * 60 + minute + (period === "PM" ? 720 : 0);
}

export function formatTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const period = normalized >= 720 ? "PM" : "AM";
  const hour = Math.floor(normalized / 60) % 12 || 12;
  return `${hour}:${String(normalized % 60).padStart(2, "0")} ${period}`;
}

export function durationMinutes(duration: string | number) {
  const parsed = typeof duration === "number" ? duration : Number.parseInt(duration, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

export function daysForPattern(pattern: string) {
  if (pattern === "Monday to Friday") return weekDays.slice(0, 5);
  if (pattern === "Monday, Wednesday, Friday") return ["Monday", "Wednesday", "Friday"];
  if (pattern === "Tuesday and Thursday") return ["Tuesday", "Thursday"];
  const namedDays = weekDays.filter((day) => pattern.toLowerCase().includes(day.toLowerCase()));
  return namedDays.length ? namedDays : ["Custom schedule"];
}

export function formatMeetingDays(days: string[]) {
  const weekdays = weekDays.slice(0, 5);
  return weekdays.every((day, index) => days[index] === day) && days.length === weekdays.length ? "Monday to Friday" : days.join(", ");
}

export function createDefaultMeeting(days = "Monday to Friday", startTime = "8:00 AM", index = 0): ClassMeeting {
  return { id: typeof crypto !== "undefined" ? crypto.randomUUID() : `meeting-${Date.now()}-${index}`, days, startTime, durationMinutes: 60, label: "Regular class" };
}
