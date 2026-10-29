import { describe, expect, it, vi } from "vitest";
import { createInstallController, installInstructions } from "@/lib/pwa-install";

function invitation(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome }) });
}

describe("Kalinga installation", () => {
  it("retains the browser invitation and prompts only after the user asks", async () => {
    const target = new EventTarget(), controller = createInstallController(target, () => false);
    const stop = controller.start(), event = invitation();
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(event.prompt).not.toHaveBeenCalled();
    expect(controller.read().canPrompt).toBe(true);
    expect(await controller.install()).toBe("accepted");
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(controller.read().installed).toBe(false);
    expect(await controller.install()).toBe("unavailable");
    target.dispatchEvent(new Event("appinstalled"));
    expect(controller.read().installed).toBe(true);
    stop();
  });
  it("discards a dismissed invitation and accepts a fresh one later", async () => {
    const target = new EventTarget(), controller = createInstallController(target, () => false);
    controller.start(); target.dispatchEvent(invitation("dismissed"));
    expect(await controller.install()).toBe("dismissed");
    expect(controller.read()).toMatchObject({ canPrompt: false, prompting: false, installed: false });
    const next = invitation(); target.dispatchEvent(next);
    expect(await controller.install()).toBe("accepted");
  });
  it("recovers from a rejected prompt without claiming installation or reusing it", async () => {
    const target = new EventTarget(), controller = createInstallController(target, () => false);
    controller.start(); const event = invitation(); event.prompt.mockRejectedValueOnce(new Error("browser declined")); target.dispatchEvent(event);
    expect(await controller.install()).toBe("failed");
    expect(controller.read()).toMatchObject({ canPrompt: false, prompting: false, installed: false });
    expect(await controller.install()).toBe("unavailable");
  });
  it("suppresses installation when running as an app and removes listeners on cleanup", () => {
    const target = new EventTarget(), controller = createInstallController(target, () => true);
    const stop = controller.start(); target.dispatchEvent(invitation());
    expect(controller.read()).toMatchObject({ installed: true, canPrompt: false });
    stop();
    const other = createInstallController(target, () => false), cleanup = other.start(); cleanup(); target.dispatchEvent(invitation());
    expect(other.read().canPrompt).toBe(false);
  });
  it("explains iPhone/iPad, Android and desktop installation without requiring a prompt API", () => {
    expect(installInstructions("iPhone", "iPhone", 1).steps.join(" ")).toContain("Add to Home Screen");
    expect(installInstructions("Macintosh", "MacIntel", 5).steps.join(" ")).toContain("Add to Home Screen");
    expect(installInstructions("Android Chrome/140", "Linux", 1).steps.join(" ")).toContain("Install app");
    expect(installInstructions("Macintosh Version/20 Safari/600", "MacIntel", 0).steps.join(" ")).toContain("Add to Dock");
    expect(installInstructions("Windows Firefox/140", "Win32", 0).steps.join(" ")).toContain("Chrome or Edge");
  });
});
