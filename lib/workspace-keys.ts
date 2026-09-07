export type WorkspaceStorageKey = "classes" | "active-class" | "plans" | "saved-resources" | "attendance" | "attendance-notes" | "teacher-name" | "teacher-email" | "gabay-motion" | "pending-writes";

export const legacyWorkspaceKeys: Record<Exclude<WorkspaceStorageKey, "pending-writes">, string> = {
  classes: "kalinga-classes",
  "active-class": "kalinga-active-class",
  plans: "kalinga-plans",
  "saved-resources": "kalinga-saved-resources",
  attendance: "kalinga-attendance",
  "attendance-notes": "kalinga-attendance-notes",
  "teacher-name": "kalinga-teacher-name",
  "teacher-email": "kalinga-teacher-email",
  "gabay-motion": "kalinga-gabay-motion",
};

export function workspaceStorageKey(scope: string, key: WorkspaceStorageKey) {
  return `kalinga:${scope}:${key}`;
}

export function normalizeResourceBookmarkId(value: string | number) {
  const id = String(value);
  return /^\d+$/.test(id) ? `catalog-${id}` : id;
}

export function isStarterResourceId(value: string) {
  return value === "starter-math" || value === "starter-science";
}
