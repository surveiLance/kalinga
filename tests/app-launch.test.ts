import { describe, expect, it } from "vitest";
import { appLaunchTarget } from "@/lib/app-launch";

describe("installed app launch targets", () => {
  it("keeps ordinary icon launches on the current window without restarting its work", () => {
    expect(appLaunchTarget("https://kalinga.test/", "https://kalinga.test/")).toBe("");
    expect(appLaunchTarget("https://kalinga.test/", "https://kalinga.test/?confirmed=1")).toBe("");
  });
  it("retains captured confirmation and recovery URLs for explicit same-window navigation", () => {
    expect(appLaunchTarget("https://kalinga.test/?confirmed=1#access_token=fixture", "https://kalinga.test/")).toBe("https://kalinga.test/?confirmed=1#access_token=fixture");
    expect(appLaunchTarget("https://kalinga.test/?password-reset=1&code=fixture", "https://kalinga.test/")).toBe("https://kalinga.test/?password-reset=1&code=fixture");
  });
  it("ignores foreign, unsupported and already-open targets", () => {
    for (const target of [undefined, "invalid", "https://other.test/?code=fixture", "https://kalinga.test/api?code=fixture", "https://kalinga.test/?other=1", "https://kalinga.test/?code=already-open"]) expect(appLaunchTarget(target, "https://kalinga.test/?code=already-open")).toBe("");
  });
});
