export const sidebarPreferenceKey = "kalinga-sidebar-pinned";

export type SidebarState = { open: boolean; pinned: boolean };
export type SidebarAction = "toggle" | "edge-enter" | "edge-leave" | "dismiss" | "navigate";
export type SidebarLayoutMode = "closed" | "revealed" | "pinned";
export type SidebarFocusTarget = "topbar";

export function sidebarStateFromPreference(value: string | null): SidebarState {
  const pinned = value === "true";
  return { open: pinned, pinned };
}

export function transitionSidebar(state: SidebarState, action: SidebarAction): SidebarState {
  if (action === "navigate") return state;

  if (action === "edge-enter") {
    return state.pinned ? state : { open: true, pinned: false };
  }

  if (action === "edge-leave" || action === "dismiss") {
    return state.pinned ? state : { open: false, pinned: false };
  }

  return state.pinned
    ? { open: false, pinned: false }
    : { open: true, pinned: true };
}

export function sidebarLayoutMode(state: SidebarState): SidebarLayoutMode {
  if (!state.open) return "closed";
  return state.pinned ? "pinned" : "revealed";
}

export function sidebarToggleFocusTarget(state: SidebarState): SidebarFocusTarget {
  void state;
  return "topbar";
}

export function serializeSidebarPinned(pinned: boolean) {
  return String(pinned);
}
