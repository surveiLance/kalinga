import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
let server: Server;
let version = "A";
const origin = "http://127.0.0.1:3131";
async function workerStatus(page: Page) {
  return page.evaluate(async () => {
    const channel = new MessageChannel();
    const result = new Promise<{ version: string; prepared: boolean }>((resolve) => { channel.port1.onmessage = (event) => { channel.port1.close(); resolve(event.data); }; });
    navigator.serviceWorker.controller!.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
    return result;
  });
}
test.beforeAll(async () => {
  const template = await readFile("scripts/offline-worker.js", "utf8");
  server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/kalinga-sw.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(template.replaceAll("__KALINGA_VERSION__", JSON.stringify(version)).replaceAll("__KALINGA_ASSETS__", JSON.stringify(["/offline/shell.html", version === "B" ? "/missing.js" : `/build-${version}.js`])));
    } else if (request.url === "/missing.js") { response.writeHead(503); response.end("interrupted"); }
    else if (request.url?.endsWith(".js")) { response.setHeader("Content-Type", "application/javascript"); response.end("window.fixture = true;"); }
    else { response.setHeader("Content-Type", "text/html"); response.end(`<html><head><title>Build ${version}</title></head><body><h1>Build ${version}</h1><textarea aria-label="Lesson notes"></textarea></body></html>`); }
  });
  await new Promise<void>((resolve) => server.listen(3131, "127.0.0.1", resolve));
});
test.afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
test("failed updates keep the old offline build and complete updates wait for unsaved clients", async ({ context, page }) => {
  await page.goto(origin);
  await page.evaluate(async () => { await navigator.serviceWorker.register("/kalinga-sw.js"); await navigator.serviceWorker.ready; });
  await expect.poll(async () => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await workerStatus(page)).toEqual(expect.objectContaining({ version: "A", prepared: true }));
  await page.getByLabel("Lesson notes").fill("An unsaved lesson must not be reloaded");
  version = "B";
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect.poll(() => page.evaluate(async () => !(await navigator.serviceWorker.getRegistration())!.installing)).toBe(true);
  expect(await workerStatus(page)).toEqual(expect.objectContaining({ version: "A", prepared: true }));
  expect(await page.evaluate(() => caches.keys())).not.toContain("kalinga-app-B");
  version = "C";
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())!.waiting)).toBe(true);
  await expect(page.getByLabel("Lesson notes")).toHaveValue("An unsaved lesson must not be reloaded");
  expect((await workerStatus(page)).version).toBe("A");
  const other = await context.newPage(); await other.goto(origin);
  await other.getByLabel("Lesson notes").fill("Another teacher draft must stay untouched");
  const blocked = await page.evaluate(async () => {
    const channel = new MessageChannel();
    const reply = new Promise<{ ok: boolean }>((resolve) => { channel.port1.onmessage = (event) => { channel.port1.close(); resolve(event.data); }; });
    (await navigator.serviceWorker.getRegistration())!.waiting!.postMessage({ type: "APPLY_UPDATE", version: "C" }, [channel.port2]);
    return reply;
  });
  expect(blocked.ok).toBe(false);
  await expect(other.getByLabel("Lesson notes")).toHaveValue("Another teacher draft must stay untouched");
  await expect(page.getByLabel("Lesson notes")).toHaveValue("An unsaved lesson must not be reloaded");
  await other.close();
  await page.close();
  await context.setOffline(true);
  const reopen = await context.newPage(); await reopen.goto(origin);
  await expect(reopen.getByRole("heading", { name: "Build C" })).toBeVisible();
  expect((await workerStatus(reopen)).version).toBe("C");
  await reopen.goto(`${origin}/?confirmed=1`);
  await expect(reopen.getByText("Connect to the internet to open this link.", { exact: false })).toBeVisible();
});
