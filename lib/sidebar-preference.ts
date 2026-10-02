export const sidebarPreferenceKey = "kalinga-sidebar-pinned";

export function parseSidebarPinned(value: string | null) {
  return value !== "false";
}

export function serializeSidebarPinned(pinned: boolean) {
  return String(pinned);
}
