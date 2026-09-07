import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dateInputValue, moveDate } from "@/lib/dates";
import { daysForPattern, durationMinutes, formatMeetingDays, formatTime, parseTime, toMinutes } from "@/lib/schedule";
import { decodeCommunityMessage, encodeCommunityMessage } from "@/lib/community-message";
import { normalizeResourceBookmarkId, workspaceStorageKey } from "@/lib/workspace-keys";

// The app targets Asia/Manila (UTC+8), where a naive toISOString() lands on the
// previous day for most of the working day.
const originalTimeZone = process.env.TZ;
beforeAll(() => { process.env.TZ = "Asia/Manila"; });
afterAll(() => { process.env.TZ = originalTimeZone; });

describe("dateInputValue", () => {
  it("keeps the local calendar day for a Manila morning", () => {
    expect(dateInputValue(new Date("2026-09-07T08:00:00+08:00"))).toBe("2026-09-07");
  });

  it("keeps the local calendar day just before local midnight", () => {
    expect(dateInputValue(new Date("2026-09-07T23:30:00+08:00"))).toBe("2026-09-07");
  });

  it("keeps the local calendar day just after local midnight", () => {
    expect(dateInputValue(new Date("2026-09-07T00:30:00+08:00"))).toBe("2026-09-07");
  });
});

describe("moveDate", () => {
  it("steps forward and back a day", () => {
    expect(moveDate("2026-09-07", 1)).toBe("2026-09-08");
    expect(moveDate("2026-09-07", -1)).toBe("2026-09-06");
  });

  it("crosses month and year boundaries", () => {
    expect(moveDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(moveDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(moveDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles a leap day", () => {
    expect(moveDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("round-trips", () => {
    expect(moveDate(moveDate("2026-09-07", 5), -5)).toBe("2026-09-07");
  });
});

describe("time helpers", () => {
  it("parses a 12-hour time and falls back to 8:00 AM on junk", () => {
    expect(parseTime("1:30 PM")).toEqual({ hour: 1, minute: 30, period: "PM" });
    expect(parseTime("nonsense")).toEqual({ hour: 8, minute: 0, period: "AM" });
  });

  it("converts to minutes with noon and midnight handled correctly", () => {
    expect(toMinutes("12:00 AM")).toBe(0);
    expect(toMinutes("8:00 AM")).toBe(480);
    expect(toMinutes("12:00 PM")).toBe(720);
    expect(toMinutes("1:30 PM")).toBe(810);
  });

  it("round-trips through formatTime", () => {
    for (const time of ["12:00 AM", "8:00 AM", "12:00 PM", "1:30 PM", "11:45 PM"]) {
      expect(formatTime(toMinutes(time))).toBe(time);
    }
  });

  it("wraps rather than producing an invalid clock time", () => {
    expect(formatTime(1440)).toBe("12:00 AM");
    expect(formatTime(-60)).toBe("11:00 PM");
  });

  it("keeps a usable lesson duration", () => {
    expect(durationMinutes("80 minutes")).toBe(80);
    expect(durationMinutes(45)).toBe(45);
    expect(durationMinutes("not a number")).toBe(80);
    expect(durationMinutes(0)).toBe(80);
    expect(durationMinutes(-30)).toBe(80);
  });
});

describe("meeting day patterns", () => {
  it("expands the named patterns", () => {
    expect(daysForPattern("Monday to Friday")).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    expect(daysForPattern("Tuesday and Thursday")).toEqual(["Tuesday", "Thursday"]);
  });

  it("picks named days out of a freeform pattern", () => {
    expect(daysForPattern("Monday and Wednesday")).toEqual(["Monday", "Wednesday"]);
  });

  it("degrades to a labelled custom schedule rather than an empty week", () => {
    expect(daysForPattern("whenever")).toEqual(["Custom schedule"]);
  });

  it("round-trips the weekday pattern back to its short label", () => {
    expect(formatMeetingDays(daysForPattern("Monday to Friday"))).toBe("Monday to Friday");
    expect(formatMeetingDays(["Tuesday", "Thursday"])).toBe("Tuesday, Thursday");
  });
});

describe("community message marker", () => {
  it("round-trips a message with an attached resource", () => {
    const encoded = encodeCommunityMessage("How did this go?", "starter-math");
    expect(decodeCommunityMessage(encoded)).toEqual({ body: "How did this go?", resourceId: "starter-math" });
  });

  it("round-trips a plain message", () => {
    expect(decodeCommunityMessage(encodeCommunityMessage("Just asking", ""))).toEqual({ body: "Just asking", resourceId: "" });
  });

  it("leaves a marker-like string in the middle of a message alone", () => {
    const body = "see [[kalinga-resource:starter-math]] above and tell me";
    expect(decodeCommunityMessage(body)).toEqual({ body, resourceId: "" });
  });

  it("keeps a multi-line body intact", () => {
    const decoded = decodeCommunityMessage(encodeCommunityMessage("line one\nline two", "starter-science"));
    expect(decoded).toEqual({ body: "line one\nline two", resourceId: "starter-science" });
  });
});

describe("workspace keys", () => {
  it("namespaces storage per teacher so two accounts cannot collide", () => {
    expect(workspaceStorageKey("teacher-abc", "classes")).toBe("kalinga:teacher-abc:classes");
    expect(workspaceStorageKey("prototype", "classes")).not.toBe(workspaceStorageKey("teacher-abc", "classes"));
  });

  it("prefixes legacy numeric catalog bookmarks and leaves ids alone", () => {
    expect(normalizeResourceBookmarkId(12)).toBe("catalog-12");
    expect(normalizeResourceBookmarkId("12")).toBe("catalog-12");
    expect(normalizeResourceBookmarkId("starter-math")).toBe("starter-math");
  });
});
