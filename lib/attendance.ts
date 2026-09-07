// The UI works in capitalized labels ("Present"); the attendance_records check
// constraint accepts lowercase only. Statuses cross that boundary in both
// directions, so both conversions live here rather than at each call site.

export const attendanceStatuses = ["Present", "Absent", "Late", "Excused", "Leave"];

export const storedAttendanceStatuses = ["present", "late", "absent", "excused", "leave"];

export function toStoredAttendanceStatus(value: string) {
  return value.trim().toLowerCase();
}

export function isStoredAttendanceStatus(value: string) {
  return storedAttendanceStatuses.includes(value);
}

export function attendanceStatusLabel(value: string) {
  const stored = toStoredAttendanceStatus(value);
  return attendanceStatuses.find((status) => status.toLowerCase() === stored) || "Present";
}
