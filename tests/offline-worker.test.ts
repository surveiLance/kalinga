/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";

async function worker(fail = false, active = true, htmlInsteadOfScript = false, status = 200, clientIds = ["current"], fetchAsset?: (url: string) => Promise<Response>, scriptPath = "/_next/static/main.js") {
  const handlers: Record<string, (event: any) => void> = {};
  const records = new Map<string, Response>();
  const cache = { match: async (key: string) => records.get(key)?.clone(), put: async (key: string, value: Response) => { const saved = value.clone(); await value.arrayBuffer(); records.set(key, saved); }, keys: async () => [...records.keys()].map((url) => ({ url })) };
  let skipped = false;
  const self = { location: { origin: "https://kalinga.test" }, registration: { active }, clients: { claim: async () => {}, matchAll: async () => clientIds.map((id) => ({ id, url: "https://kalinga.test/" })) }, skipWaiting: () => { skipped = true; }, addEventListener: (type: string, fn: (event: any) => void) => { handlers[type] = fn; } };
  const assets = ["/offline/shell.html", scriptPath];
  const hashes = Object.fromEntries(assets.map((url) => { const content = url.endsWith(".html") && !fetchAsset ? "clean document" : "asset"; return [url, [createHash("sha256").update(content).digest("hex"), Buffer.byteLength(content)]]; }));
  const source = (await readFile(new URL("../scripts/offline-worker.js", import.meta.url), "utf8")).replaceAll("__KALINGA_VERSION__", JSON.stringify("test")).replaceAll("__KALINGA_ASSETS__", JSON.stringify(assets)).replaceAll("__KALINGA_HASHES__", JSON.stringify(hashes));
  const crypto = { subtle: { digest: async (_algorithm: string, content: ArrayBuffer) => new Uint8Array(createHash("sha256").update(Buffer.from(content)).digest()).buffer } };
  runInNewContext(source, { self, URL, Headers, Response, Request, AbortController, AbortSignal, setTimeout, clearTimeout, crypto, caches: { open: async () => cache, keys: async () => ["kalinga-app-test"], delete: async () => { records.clear(); } }, fetch: async (request: string | { url: string }) => { if (fail) throw new Error("offline"); const url = typeof request === "string" ? request : request.url; if (fetchAsset) return fetchAsset(url); return new Response(url === "/offline/shell.html" ? "clean document" : "asset", { status, headers: { "Content-Type": htmlInsteadOfScript || url.endsWith(".html") ? "text/html" : "application/javascript" } }); } });
  return { handlers, records, skipped: () => skipped };
}

describe("offline service worker boundaries", () => {
  it("prepares independent files together instead of waiting for each slow request", async () => {
    const releases: (() => void)[] = [];
    const app = await worker(false, false, false, 200, ["current"], (url) => new Promise((resolve) => { releases.push(() => resolve(new Response("asset", { headers: { "Content-Type": url.endsWith(".html") ? "text/html" : "application/javascript" } }))); }));
    let task!: Promise<void>;
    app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const started = releases.length;
    releases.splice(0).forEach((release) => release());
    if (started === 1) { await new Promise((resolve) => setTimeout(resolve, 10)); releases.splice(0).forEach((release) => release()); }
    await task;
    expect(started).toBe(2);
    expect(app.records.has("/offline/ready")).toBe(true);
  });
  it("recovers from a temporary download failure without discarding offline access", async () => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      const app = await worker(false, false, false, 200, ["current"], async (url) => {
        if (url.endsWith(".js") && ++attempts === 1) throw new TypeError("Connection interrupted");
        return new Response("asset", { headers: { "Content-Type": url.endsWith(".html") ? "text/html" : "application/javascript" } });
      });
      let task!: Promise<void>;
      app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } });
      const result = task.then(() => "ready", () => "failed");
      await vi.runAllTimersAsync();
      expect(await result).toBe("ready");
      expect(app.records.has("/offline/ready")).toBe(true);
    } finally { vi.useRealTimers(); }
  });
  it("does not intercept cloud data, writes or arbitrary URLs", async () => {
    const { handlers } = await worker();
    for (const [url, method] of [["https://supabase.test/rest/v1/classes", "GET"], ["https://kalinga.test/", "POST"], ["https://kalinga.test/api/private", "GET"]]) {
      let intercepted = false;
      handlers.fetch({ request: { url, method, mode: "cors" }, respondWith() { intercepted = true; } });
      expect(intercepted).toBe(false);
    }
  });
  it("retries when a connection drops after response headers but before the file finishes", async () => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      const app = await worker(false, false, false, 200, ["current"], async (url) => {
        const body = url.endsWith(".js") && ++attempts === 1 ? new ReadableStream({ start(stream) { stream.error(new TypeError("Connection reset during download")); } }) : "asset";
        return new Response(body, { headers: { "Content-Type": url.endsWith(".html") ? "text/html" : "application/javascript" } });
      });
      let task!: Promise<void>;
      app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } });
      const result = task.then(() => "ready", () => "failed");
      await vi.runAllTimersAsync();
      expect(await result).toBe("ready");
      expect(app.records.has("/offline/ready")).toBe(true);
    } finally { vi.useRealTimers(); }
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
  it("rejects a captive-portal HTML response masquerading as an application asset", async () => {
    const bad = await worker(false, true, true);
    let install!: Promise<void>;
    bad.handlers.install({ waitUntil(p: Promise<void>) { install = p; } });
    await expect(install).rejects.toThrow();
    expect(bad.records.has("/offline/ready")).toBe(false);
  });
  it("uses the prepared shell when navigation resolves with a server error", async () => {
    const { handlers, records } = await worker(false, true, false, 503);
    records.set("/offline/shell.html", new Response("saved document"));
    let response!: Promise<Response>;
    const navigate = (url: string) => handlers.fetch({ request: { url, method: "GET", mode: "navigate" }, respondWith(p: Promise<Response>) { response = p; } });
    navigate("https://kalinga.test/");
    expect(await (await response).text()).toBe("saved document");
    navigate("https://kalinga.test/?confirmed=1");
    expect((await response).status).toBe(503);
  });
  it("activates a prepared update only after an explicit request from its sole open window", async () => {
    const app = await worker(); let task!: Promise<void>; let reply: any;
    app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } }); await task;
    app.handlers.message({ data: { type: "APPLY_UPDATE", version: "test" }, source: { id: "current", url: "https://kalinga.test/" }, ports: [{ postMessage(value: any) { reply = value; } }], waitUntil(p: Promise<void>) { task = p; } }); await task;
    expect(reply?.ok).toBe(true); expect(app.skipped()).toBe(true);
  });
  it("advertises explicit-update support so new pages can distinguish older waiting workers", async () => {
    const app = await worker(); let task!: Promise<void>; let reply: any;
    app.handlers.message({ data: { type: "OFFLINE_STATUS" }, source: { id: "current", url: "https://kalinga.test/" }, ports: [{ postMessage(value: any) { reply = value; } }], waitUntil(p: Promise<void>) { task = p; } }); await task;
    expect(reply.canApplyUpdate).toBe(true);
  });
  it("repairs missing files in the active build without requiring a different deployment", async () => {
    const app = await worker(); let task!: Promise<void>; let reply: any;
    app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } }); await task;
    app.records.delete("/_next/static/main.js");
    app.handlers.message({ data: { type: "PREPARE_OFFLINE", version: "test" }, source: { id: "current", url: "https://kalinga.test/" }, ports: [{ postMessage(value: any) { reply = value; } }], waitUntil(p: Promise<void>) { task = p; } }); await task;
    expect(reply?.ok).toBe(true);
    expect(app.records.has("/_next/static/main.js")).toBe(true);
    expect(await app.records.get("/offline/shell.html")!.text()).toBe("clean document");
    expect(app.skipped()).toBe(false);
  });
  it("keeps the previous version active if another window exists or preparation is incomplete", async () => {
    for (const ids of [["current", "other"], ["current"]]) {
      const app = await worker(false, true, false, 200, ids); let task!: Promise<void>; let reply: any;
      if (ids.length > 1) { app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } }); await task; }
      app.handlers.message({ data: { type: "APPLY_UPDATE", version: "test" }, source: { id: "current", url: "https://kalinga.test/" }, ports: [{ postMessage(value: any) { reply = value; } }], waitUntil(p: Promise<void>) { task = p; } }); await task;
      expect(reply?.ok).toBe(false); expect(app.skipped()).toBe(false);
    }
  });
  it("refuses a different deployment's shell when repairing an older active build", async () => {
    let changed = false;
    const app = await worker(false, true, false, 200, ["current"], async (url) => new Response(changed && url.endsWith(".html") ? '<script src="/_next/static/other-build.js"></script>' : "asset", { headers: { "Content-Type": url.endsWith(".html") ? "text/html" : "application/javascript" } }));
    let task!: Promise<void>; let reply: any;
    app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } }); await task;
    app.records.delete("/offline/shell.html"); changed = true;
    app.handlers.message({ data: { type: "PREPARE_OFFLINE", version: "test" }, source: { id: "current", url: "https://kalinga.test/" }, ports: [{ postMessage(value: any) { reply = value; } }], waitUntil(p: Promise<void>) { task = p; } }); await task;
    expect(reply?.ok).toBe(false);
    expect(app.records.has("/offline/shell.html")).toBe(false);
    expect(app.records.has("/_next/static/main.js")).toBe(true);
  });
  it("caches the verified runtime without a hosting toolbar appended after the build", async () => {
    const path = "/_next/static/chunks/turbopack-runtime.js";
    const app = await worker(false, false, false, 200, ["current"], async (url) => new Response(url === path ? "asset\n;console.log('hosting toolbar');" : "asset", { headers: { "Content-Type": url.endsWith(".html") ? "text/html" : "application/javascript" } }), path);
    let task!: Promise<void>;
    app.handlers.install({ waitUntil(p: Promise<void>) { task = p; } });
    await task;
    expect(await app.records.get(path)!.text()).toBe("asset");
    expect(app.records.has("/offline/ready")).toBe(true);
  });
});
