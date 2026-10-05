import { describe, expect, it } from "vitest";
import {
  sidebarLayoutMode,
  sidebarPreferenceKey,
  sidebarStateFromPreference,
  sidebarToggleFocusTarget,
  serializeSidebarPinned,
  transitionSidebar,
} from "@/lib/sidebar-preference";

describe("desktop sidebar behavior", () => {
  it("starts hidden when this device has no saved pin preference", () => {
    expect(sidebarStateFromPreference(null)).toEqual({ open: false, pinned: false });
  });

  it("restores only an explicitly pinned sidebar", () => {
    expect(sidebarStateFromPreference("true")).toEqual({ open: true, pinned: true });
    expect(sidebarStateFromPreference("false")).toEqual({ open: false, pinned: false });
    expect(sidebarStateFromPreference("unexpected-value")).toEqual({ open: false, pinned: false });
  });

  it("continues using the existing pin preference key", () => {
    expect(sidebarPreferenceKey).toBe("kalinga-sidebar-pinned");
  });

  it("reveals the temporary sidebar when the pointer reaches the left edge", () => {
    expect(transitionSidebar({ open: false, pinned: false }, "edge-enter")).toEqual({ open: true, pinned: false });
  });

  it("reserves workspace room for a temporary edge reveal", () => {
    expect(sidebarLayoutMode({ open: true, pinned: false })).toBe("revealed");
  });

  it("keeps persistent and closed layouts distinct from a temporary reveal", () => {
    expect(sidebarLayoutMode({ open: true, pinned: true })).toBe("pinned");
    expect(sidebarLayoutMode({ open: false, pinned: false })).toBe("closed");
  });

  it("hides a temporary sidebar when the pointer leaves it", () => {
    expect(transitionSidebar({ open: true, pinned: false }, "edge-leave")).toEqual({ open: false, pinned: false });
  });

  it("keeps a toggled-open sidebar visible when the pointer leaves", () => {
    expect(transitionSidebar({ open: true, pinned: true }, "edge-leave")).toEqual({ open: true, pinned: true });
  });

  it("dismisses only a temporary sidebar after an explicit dismiss", () => {
    expect(transitionSidebar({ open: true, pinned: false }, "dismiss")).toEqual({ open: false, pinned: false });
    expect(transitionSidebar({ open: true, pinned: true }, "dismiss")).toEqual({ open: true, pinned: true });
  });

  it("keeps a temporary sidebar open after navigation until the pointer leaves", () => {
    expect(transitionSidebar({ open: true, pinned: false }, "navigate")).toEqual({ open: true, pinned: false });
  });

  it("uses the single toggle button to keep the sidebar open or hide it", () => {
    expect(transitionSidebar({ open: false, pinned: false }, "toggle")).toEqual({ open: true, pinned: true });
    expect(transitionSidebar({ open: true, pinned: false }, "toggle")).toEqual({ open: true, pinned: true });
    expect(transitionSidebar({ open: true, pinned: true }, "toggle")).toEqual({ open: false, pinned: false });
  });

  it("keeps focus on the single workspace toggle in every sidebar state", () => {
    expect(sidebarToggleFocusTarget({ open: false, pinned: false })).toBe("topbar");
    expect(sidebarToggleFocusTarget({ open: true, pinned: false })).toBe("topbar");
    expect(sidebarToggleFocusTarget({ open: true, pinned: true })).toBe("topbar");
  });

  it("stores a stable value for either pin preference", () => {
    expect(serializeSidebarPinned(true)).toBe("true");
    expect(serializeSidebarPinned(false)).toBe("false");
  });
});
