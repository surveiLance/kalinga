/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

async function worker(fail = false, active = true) {
  const handlers: Record<string, (event: any) => void> = {};
  const records = new Map<string, Response>();
  const cache = { match: async (key: string) => records.get(key)?.clone(), put: async (key: string, value: Response) => { records.set(key, value.clone()); }, keys: async () => [...records.keys()].map((url) => ({ url })) };
  let skipped = false;
  const self = { location: { origin: "https://kalinga.test" }, registration: { active }, clients: { claim: async () => {} }, skipWaiting: () => { skipped = true; }, addEventListener: (type: string, fn: (event: any) => void) => { handlers[type] = fn; } };
  const source = (await readFile(new URL("../scripts/offline-worker.js", import.meta.url), "utf8")).replaceAll("__KALINGA_VERSION__", JSON.stringify("test")).replaceAll("__KALINGA_ASSETS__", JSON.stringify(["/offline/shell.html", "/_next/static/main.js"]));
  runInNewContext(source, { self, URL, Response, Request, AbortController, AbortSignal, setTimeout, clearTimeout, caches: { open: async () => cache, keys: async () => ["kalinga-app-test"], delete: async () => { records.clear(); } }, fetch: async (url: string) => { if (fail) throw new Error("offline"); return new Response(url === "/offline/shell.html" ? "clean document" : "asset"); } });
  return { handlers, records, skipped: () => skipped };
}

describe("offline service worker boundaries", () => {
  it("does not intercept cloud data, writes or arbitrary URLs", async () => {
    const { handlers } = await worker();
    for (const [url, method] of [["https://supabase.test/rest/v1/classes", "GET"], ["https://kalinga.test/", "POST"], ["https://kalinga.test/api/private", "GET"]]) {
      let intercepted = false;
      handlers.fetch({ request: { url, method, mode: "cors" }, respondWith() { intercepted = true; } });
      expect(intercepted).toBe(false);
    }
  });

  it("requires a complete install and never force-activates over an open app", async () => {
    const good = await worker();
    let install!: Promise<void>;
    good.handlers.install({ waitUntil(p: Promise<void>) { install = p; } });
    await install;
    expect(good.records.has("/offline/ready")).toBe(true);
    expect(good.skipped()).toBe(false);
    const bad = await worker(true);
    bad.handlers.install({ waitUntil(p: Promise<void>) { install = p; } });
    await expect(install).rejects.toThrow("offline");
    expect(bad.records.has("/offline/ready")).toBe(false);
  });

  it("serves clean cached navigation offline but never reports auth-link success", async () => {
    const { handlers, records } = await worker(true);
    records.set("/offline/shell.html", new Response("saved document"));
    let response!: Promise<Response>;
    const navigate = (url: string) => handlers.fetch({ request: { url, method: "GET", mode: "navigate" }, respondWith(p: Promise<Response>) { response = p; } });
    navigate("https://kalinga.test/");
    expect(await (await response).text()).toBe("saved document");
    navigate("https://kalinga.test/?confirmed=1");
    expect((await response).status).toBe(503);
  });
});
