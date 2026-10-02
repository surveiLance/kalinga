import { describe, expect, it } from "vitest";
import { parseSidebarPinned, serializeSidebarPinned } from "@/lib/sidebar-preference";

describe("sidebar pin preference", () => {
  it("keeps the full sidebar open when this device has no saved preference", () => {
    expect(parseSidebarPinned(null)).toBe(true);
  });

  it("restores the icon rail only after the teacher explicitly unpins the sidebar", () => {
    expect(parseSidebarPinned("false")).toBe(false);
    expect(parseSidebarPinned("true")).toBe(true);
    expect(parseSidebarPinned("unexpected-value")).toBe(true);
  });

  it("stores a stable value for either sidebar state", () => {
    expect(serializeSidebarPinned(true)).toBe("true");
    expect(serializeSidebarPinned(false)).toBe("false");
  });
});
