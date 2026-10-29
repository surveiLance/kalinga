import { test, expect, type BrowserContext, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
const teacherId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const learnerId = "33333333-3333-4333-8333-333333333333";
const planId = "44444444-4444-4444-8444-444444444444";
const resourceId = "55555555-5555-4555-8555-555555555555";
const user = { id: teacherId, aud: "authenticated", role: "authenticated", email: "ana@example.test", email_confirmed_at: "2026-10-27T00:00:00Z", phone: "", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { display_name: "Ana" }, identities: [], created_at: "2026-10-27T00:00:00Z", updated_at: "2026-10-27T00:00:00Z", is_anonymous: false };
function session(account = user) {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: account.id, exp: expiry, aud: "authenticated", role: "authenticated" })).toString("base64url")}.fixture-not-a-real-signature`;
  return { access_token: token, refresh_token: "fixture-refresh-not-a-credential", expires_in: 3600, expires_at: expiry, token_type: "bearer", user: account };
}
async function fixtures(context: BrowserContext) {
  const state = { offline: false, user: { ...user }, attendance: [] as Record<string, unknown>[], plan: null as Record<string, unknown> | null, calls: [] as string[] };
  const pdf = await readFile("public/resources/fraction-market-bottle-cap-math.pdf");
  await context.routeWebSocket("**/realtime/**", (socket) => socket.close());
  await context.route("**/auth/v1/**", async (route) => {
    if (state.offline) { await route.abort(); return; }
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/token") && route.request().postDataJSON()?.email === "bea@example.test") state.user = { ...user, id: "66666666-6666-4666-8666-666666666666", email: "bea@example.test", user_metadata: { display_name: "Bea" } };
    await route.fulfill({ status: path.endsWith("/logout") ? 204 : 200, contentType: "application/json", body: path.endsWith("/logout") ? "" : JSON.stringify(path.endsWith("/user") ? state.user : session(state.user)) });
  });
  await context.route("**/rest/v1/**", async (route) => {
    if (state.offline) { await route.abort(); return; }
    const table = new URL(route.request().url()).pathname.split("/").pop()!;
    if (route.request().method() !== "GET") {
      const data = route.request().postDataJSON();
      if (table === "attendance_records") state.attendance = Array.isArray(data) ? data : [data];
      if (table === "lesson_plans") state.plan = Array.isArray(data) ? data[0] : data;
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    const data: Record<string, unknown> = {
      profiles: [{ id: teacherId, display_name: "Ana", school_name: "Test school" }],
      classes: [{ id: classId, name: "Offline Class", grade_levels: ["3", "4"], subjects: ["Science"], schedule: { quarter: "Quarter 1", meetings: [{ id: "meeting", days: "Monday to Friday", startTime: "8:00 AM", durationMinutes: 60 }] } }],
      learners: [{ id: learnerId, class_id: classId, display_name: "Sample Learner", grade_level: "3", sex: "female" }],
      lesson_plans: [{ id: planId, class_id: classId, title: "Plants around us", subject: "Science", grade_levels: ["3", "4"], content: { id: planId, classId, title: "Plants around us", grades: ["3", "4"], subject: "Science", quarter: "Quarter 1", duration: "60 minutes", startTime: "8:00 AM", teachingDate: "2026-10-27", sharedTheme: "Local plants", competencies: { "3": "Identify leaves", "4": "Explain plant functions" }, objectives: { "3": "Name two leaves", "4": "Explain roots" }, slots: [{ id: "slot", time: "8:00 AM", durationMinutes: 60, stage: "Guided Practice", teacherFocus: "All grades together", gradeTasks: { "3": "Observe leaves", "4": "Observe roots" } }] } }],
      resources: [{ id: resourceId, owner_id: teacherId, title: "Downloaded local guide", storage_path: `${teacherId}/guide.pdf`, visibility: "private", metadata: { subject: "Science", grades: "3, 4", author: "Ana", description: "Local PDF fixture", type: "Teacher guide" }, created_at: "2026-10-27T00:00:00Z" }],
      attendance_records: state.attendance,
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.user.id === teacherId ? data[table] || [] : table === "profiles" ? [{ id: state.user.id, display_name: "Bea", school_name: "Other school" }] : []) });
  });
  await context.route("**/storage/v1/**", async (route) => {
    if (state.offline) { await route.abort(); return; }
    if (route.request().method() === "POST") await route.fulfill({ contentType: "application/json", body: JSON.stringify({ signedURL: `/object/sign/teacher-resources/${teacherId}/guide.pdf?token=fixture-expiring` }) });
    else await route.fulfill({ contentType: "application/pdf", body: pdf });
  });
  await context.route("**/functions/v1/**", async (route) => { state.calls.push(route.request().url()); await route.abort(); });
  return state;
}
test("regular teacher reopens offline, reads PDF and exports Word without earlier export", async ({ context, page }) => {
  page.on("pageerror", (error) => console.log("Synthetic browser page error:", error.message));
  const state = await fixtures(context);
  await page.goto("/");
  await page.getByLabel("Email address").fill("ana@example.test");
  await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
  await expect(page.getByRole("button", { name: "Find resources", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Find resources", exact: true }).click();
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Downloaded local guide" }) });
  await card.getByRole("button", { name: "Download for offline", exact: true }).click();
  await expect(card.getByText("Downloaded on this device")).toBeVisible();
  await expect(page.getByText("Ready for offline teaching", { exact: true })).toBeVisible({ timeout: 90000 });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (/^sb-.*-auth-token$/.test(key)) { const value = JSON.parse(localStorage.getItem(key)!); value.expires_at = 1; localStorage.setItem(key, JSON.stringify(value)); }
    }
  });
  state.offline = true; await context.setOffline(true); await page.close();
  const offline = await context.newPage(); await offline.goto("/");
  await expect(offline.getByRole("button", { name: "Classes & learners", exact: true })).toBeVisible();
  await offline.getByRole("button", { name: "Find resources", exact: true }).click();
  const downloaded = offline.locator("article").filter({ has: offline.getByRole("heading", { name: "Downloaded local guide" }) });
  await downloaded.getByRole("button", { name: "View PDF", exact: true }).click();
  await expect(offline.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  expect(await offline.locator(".offline-pdf-viewer canvas").evaluate((c) => (c as HTMLCanvasElement).width)).toBeGreaterThan(0);
  await offline.setViewportSize({ width: 390, height: 844 });
  await expect(offline.getByRole("button", { name: "Next page →", exact: true })).toBeVisible();
  await expect(offline.getByText("Read page text", { exact: true })).toBeVisible();
  expect(await offline.locator(".offline-pdf-viewer canvas").evaluate((node) => { const element = node as HTMLCanvasElement; const rect = element.getBoundingClientRect(); return Math.abs(rect.width / rect.height - element.width / element.height); })).toBeLessThan(0.02);
  const beforeZoom = await offline.locator(".offline-pdf-viewer canvas").evaluate((node) => node.getBoundingClientRect().width);
  await offline.getByRole("button", { name: "Zoom in", exact: true }).click({ timeout: 2000 });
  await expect.poll(() => offline.locator(".offline-pdf-viewer canvas").evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(beforeZoom);
  await offline.getByRole("button", { name: "Zoom out", exact: true }).click();
  await offline.screenshot({ path: "tmp/offline-pdf-mobile.png", fullPage: true });
  await offline.setViewportSize({ width: 1280, height: 900 });
  await offline.getByRole("button", { name: "Close resource", exact: true }).click();
  await offline.getByRole("button", { name: "Plan lessons", exact: true }).click();
  await offline.getByRole("button", { name: /Plants around us/ }).first().click();
  await offline.getByLabel("Shared sub-theme", { exact: true }).fill("Edited while offline");
  await offline.getByRole("button", { name: "Save lesson", exact: true }).click();
  await offline.getByRole("button", { name: /Teach this lesson/ }).click();
  await expect(offline.getByText("Observe leaves", { exact: true }).first()).toBeVisible();
  await offline.getByRole("button", { name: "Plan lessons", exact: true }).click();
  await offline.getByRole("button", { name: /Plants around us/ }).first().click();
  const file = offline.waitForEvent("download"); await offline.getByRole("button", { name: "Download Word", exact: true }).click();
  expect((await file).suggestedFilename()).toMatch(/\.docx$/);
  await offline.getByRole("button", { name: "Classes & learners", exact: true }).click();
  await offline.getByRole("button", { name: "Take attendance", exact: true }).click();
  await offline.getByRole("button", { name: "Mark Sample Learner as Absent", exact: true }).click();
  await offline.locator(`#attendance-note-${learnerId}`).fill("Synthetic absence note");
  await offline.getByRole("button", { name: "Save attendance", exact: true }).first().click();
  const queued = await offline.evaluate((id) => JSON.parse(localStorage.getItem(`kalinga:teacher-${id}:pending-writes`) || "[]"), teacherId);
  expect(queued).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "attendance", scope: `teacher-${teacherId}`, classId })]));
  await offline.close();
  const reopen = await context.newPage(); await reopen.goto("/");
  expect(await reopen.evaluate((id) => JSON.parse(localStorage.getItem(`kalinga:teacher-${id}:plans`) || "[]")[0]?.sharedTheme, teacherId)).toBe("Edited while offline");
  await reopen.getByRole("button", { name: "Classes & learners", exact: true }).click();
  await reopen.getByRole("button", { name: "Take attendance", exact: true }).click();
  await expect(reopen.getByRole("button", { name: "Mark Sample Learner as Absent", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(reopen.locator(`#attendance-note-${learnerId}`)).toHaveValue("Synthetic absence note");
  state.offline = false; await context.setOffline(false);
  await expect.poll(() => state.attendance.find((item) => item.learner_id === learnerId)?.status).toBe("absent");
  expect(state.attendance.find((item) => item.learner_id === learnerId)?.note).toBe("Synthetic absence note");
  await expect.poll(() => (state.plan?.content as Record<string, unknown> | undefined)?.sharedTheme).toBe("Edited while offline");
  expect(state.calls).toEqual([]);
});

test("explicit sign-out locks other tabs and offline reopening without deleting the workspace", async ({ context, page }) => {
  const state = await fixtures(context);
  await page.goto("/");
  await page.getByLabel("Email address").fill("ana@example.test");
  await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
  await expect(page.getByText("Ready for offline teaching", { exact: true })).toBeVisible({ timeout: 90000 });
  const second = await context.newPage(); await second.goto("/");
  await expect(second.getByRole("button", { name: "Classes & learners", exact: true })).toBeVisible();
  state.offline = true; await context.setOffline(true);
  await page.getByRole("button", { name: "Account options for Teacher Ana", exact: true }).click();
  await page.getByRole("menuitem", { name: /Sign out$/ }).click();
  await expect(second.getByRole("heading", { name: "Welcome back, Teacher" })).toBeVisible();
  await page.close(); await second.close();
  const locked = await context.newPage(); await locked.goto("/");
  await expect(locked.getByRole("heading", { name: "Welcome back, Teacher" })).toBeVisible();
  expect(await locked.evaluate((id) => JSON.parse(localStorage.getItem(`kalinga:teacher-${id}:classes`) || "[]").length, teacherId)).toBe(1);
});

test("signing in as another teacher never shows the previous teacher's classes or downloads", async ({ context, page }) => {
  await fixtures(context); await page.goto("/");
  await page.getByLabel("Email address").fill("ana@example.test"); await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
  await expect(page.getByText("Ready for offline teaching", { exact: true })).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Find resources", exact: true }).click();
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Downloaded local guide" }) });
  await card.getByRole("button", { name: "Download for offline", exact: true }).click();
  await expect(card.getByText("Downloaded on this device")).toBeVisible();
  await page.getByRole("button", { name: "Account options for Teacher Ana", exact: true }).click(); await page.getByRole("menuitem", { name: /Sign out$/ }).click();
  await page.getByLabel("Email address").fill("bea@example.test"); await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account options for Teacher Bea", exact: true })).toBeVisible();
  await expect(page.getByText("Offline Class", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Find resources", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Downloaded local guide" })).toHaveCount(0);
  await expect(page.getByText("0 PDFs downloaded · 0.0 MB", { exact: true })).toBeVisible();
});

test("a verified email callback unlocks a signed-out device but a confirmation flag does not", async ({ context, page }) => {
  await fixtures(context); await page.goto("/");
  await page.getByLabel("Email address").fill("ana@example.test"); await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account options for Teacher Ana", exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("kalinga:device:offline-lock", "signed-out"));
  await page.goto("/?confirmed=1");
  await expect(page.getByRole("heading", { name: "Welcome back, Teacher" })).toBeVisible();
  const callback = session();
  const hash = new URLSearchParams({ access_token: callback.access_token, refresh_token: callback.refresh_token, expires_in: "3600", token_type: "bearer", type: "signup" });
  await page.goto("/");
  await page.goto(`/?confirmed=1#${hash}`);
  await expect(page.getByRole("button", { name: "Account options for Teacher Ana", exact: true })).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => localStorage.getItem("kalinga:device:offline-lock"))).toBeNull();
});

test("a stale foreign sign-in event preserves the verified teacher's offline workspace", async ({ context, page }) => {
  await fixtures(context); await page.goto("/");
  await page.getByLabel("Email address").fill("ana@example.test"); await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
  await expect(page.getByText("Ready for offline teaching", { exact: true })).toBeVisible({ timeout: 90000 });
  const foreign = session({ ...user, id: "66666666-6666-4666-8666-666666666666" });
  await page.evaluate((value) => {
    const key = Object.keys(localStorage).find((key) => /^sb-.*-auth-token$/.test(key))!;
    const channel = new BroadcastChannel(key); channel.postMessage({ event: "SIGNED_IN", session: value }); channel.close();
  }, foreign);
  await expect(page.getByRole("button", { name: "Account options for Teacher Ana", exact: true })).toBeVisible({ timeout: 5000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kalinga:device:offline-workspace")), { timeout: 3000 }).toBe(teacherId);
});

test("cancelling during PDF link renewal releases the controls and ignores a late link", async ({ context, page }) => {
  await fixtures(context); await page.goto("/");
  await page.getByLabel("Email address").fill("ana@example.test"); await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
  await page.getByRole("button", { name: "Find resources", exact: true }).click();
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Downloaded local guide" }) });
  await expect(card).toBeVisible();
  let renewal: Route | undefined; let transfers = 0;
  await context.route("**/storage/v1/**", async (route) => {
    if (route.request().method() === "POST") renewal = route;
    else { transfers++; await route.abort(); }
  });
  await card.getByRole("button", { name: "Download for offline", exact: true }).click();
  await expect.poll(() => !!renewal).toBe(true);
  await card.getByRole("button", { name: "Cancel download", exact: true }).click();
  await expect(card.getByRole("button", { name: "Download for offline", exact: true })).toBeVisible({ timeout: 1500 });
  await renewal!.fulfill({ contentType: "application/json", body: JSON.stringify({ signedURL: "/object/sign/teacher-resources/late.pdf?token=fixture" }) });
  await expect(page.getByText("Download cancelled. Any earlier copy is unchanged.", { exact: true })).toBeVisible();
  expect(transfers).toBe(0);
  await expect(card.getByText("Downloaded on this device")).toHaveCount(0);
});

test("a downloaded update protects an unsaved lesson then refreshes the same window after saving", async ({ context, page }) => {
  const state = await fixtures(context);
  const template = await readFile("scripts/offline-worker.js", "utf8");
  const generated = await readFile("public/kalinga-sw.js", "utf8");
  const assets = JSON.parse(generated.match(/^const ASSETS = (.+);$/m)![1]);
  let version = "update-A";
  const server = createServer(async (request, response) => {
    if (request.url === "/kalinga-sw.js") {
      response.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" });
      response.end(template.replaceAll("__KALINGA_VERSION__", JSON.stringify(version)).replaceAll("__KALINGA_ASSETS__", JSON.stringify(assets)));
    } else {
      try { const upstream = await fetch(`http://127.0.0.1:3120${request.url}`); response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") || "application/octet-stream", "Cache-Control": "no-store" }); response.end(Buffer.from(await upstream.arrayBuffer())); }
      catch { response.writeHead(503); response.end("Fixture unavailable"); }
    }
  });
  await new Promise<void>((resolve) => server.listen(3132, "127.0.0.1", resolve));
  try {
    await page.goto("http://127.0.0.1:3132/");
    await page.getByLabel("Email address").fill("ana@example.test"); await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
    await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
    await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
    await expect(page.getByText("Ready for offline teaching", { exact: true })).toBeVisible({ timeout: 90000 });
    await page.getByRole("button", { name: "Plan lessons", exact: true }).click();
    await page.getByRole("button", { name: /Plants around us/ }).first().click();
    state.offline = true;
    await page.getByLabel("Shared sub-theme", { exact: true }).fill("Keep this lesson through the update");
    version = "update-B";
    const openUpdates = async () => {
      if (!await page.getByRole("menu", { name: "Account options", exact: true }).isVisible()) await page.getByRole("button", { name: "Account options for Teacher Ana", exact: true }).click();
      await page.getByRole("menuitem", { name: "App updates", exact: true }).click();
      return page.getByRole("dialog", { name: "App updates", exact: true });
    };
    let dialog = await openUpdates();
    await dialog.getByRole("button", { name: "Check for updates", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Update now", exact: true })).toBeEnabled({ timeout: 90000 });
    await dialog.getByRole("button", { name: "Update now", exact: true }).click();
    await expect(dialog.getByText("Save your lesson before updating.", { exact: true })).toBeVisible();
    await page.screenshot({ path: "/private/tmp/kalinga-update-checks/update-panel.png" });
    await expect(page.getByLabel("Shared sub-theme", { exact: true })).toHaveValue("Keep this lesson through the update");
    await dialog.getByRole("button", { name: "Close app updates", exact: true }).click();
    await page.getByRole("button", { name: "Save lesson", exact: true }).click();
    dialog = await openUpdates();
    const loaded = page.waitForEvent("load");
    await dialog.getByRole("button", { name: "Update now", exact: true }).click();
    await loaded;
    await expect(page.getByRole("button", { name: "Classes & learners", exact: true })).toBeVisible();
    expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`kalinga:teacher-${id}:plans`) || "[]")[0]?.sharedTheme, teacherId)).toBe("Keep this lesson through the update");
    expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`kalinga:teacher-${id}:pending-writes`) || "[]").some((item: { kind: string }) => item.kind === "plan"), teacherId)).toBe(true);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
