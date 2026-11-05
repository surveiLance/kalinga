import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

it("recognizes an already prepared app offline without fetching its worker again", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const window = Object.assign(new EventTarget(), { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms).unref(), clearTimeout });
  class Script { src = "https://kalinga.test/_next/static/main.js"; }
  const controller = { postMessage(_message: unknown, ports: MessagePort[]) { ports[0].postMessage({ version: "A", prepared: true, assets: ["/_next/static/main.js"], canApplyUpdate: true }); ports[0].close(); } };
  const registration = Object.assign(new EventTarget(), { active: controller, installing: null, waiting: null });
  const serviceWorker = Object.assign(new EventTarget(), { controller, getRegistration: async () => registration, register: async () => { throw new TypeError("No internet"); } });
  vi.stubGlobal("window", window);
  vi.stubGlobal("HTMLScriptElement", Script);
  vi.stubGlobal("document", { querySelectorAll: () => [new Script()] });
  vi.stubGlobal("navigator", { onLine: false, serviceWorker });
  const app = await import("@/lib/offline-availability");
  await app.prepareOfflineApplication();
  expect(app.readOfflineAvailability()).toMatchObject({ state: "ready", prepared: true });
});
