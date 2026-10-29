import { test, expect, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({ actionTimeout: 10000 });
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
  const state = { offline: false, user: { ...user }, attendance: [] as Record<string, unknown>[], plan: null as Record<string, unknown> | null, calls: [] as string[], uploadFails: false, holdUpload: false, releaseUpload: undefined as (() => void) | undefined, metadataFails: false, uploads: 0, removed: 0, resources: [] as Record<string, unknown>[], posts: [] as Record<string, unknown>[] };
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
      if (table === "resources") {
        if (state.metadataFails) { await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Fixture details failure" }) }); return; }
        const row = { ...data, id: "77777777-7777-4777-8777-777777777777", created_at: new Date().toISOString() }; state.resources.push(row);
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(row) }); return;
      }
      if (table === "teacher_discussions" || table === "teacher_replies") { state.posts.push(data); await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...data, id: "88888888-8888-4888-8888-888888888888", created_at: new Date().toISOString() }) }); return; }
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
      teacher_discussions: [{ id: "discussion-fixture", author_id: "other-teacher", author_name: "Teacher Bea", title: "How can I help struggling readers?", body: "We have a small group who need reading practice.", subject: "English", grade_levels: ["3"], created_at: "2026-10-27T00:00:00Z" }],
      teacher_replies: [],
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.user.id === teacherId ? table === "resources" ? [...data.resources as unknown[], ...state.resources] : data[table] || [] : table === "profiles" ? [{ id: state.user.id, display_name: "Bea", school_name: "Other school" }] : []) });
  });
  await context.route("**/storage/v1/**", async (route) => {
    if (state.offline) { await route.abort(); return; }
    if (route.request().method() === "DELETE") { state.removed++; await route.fulfill({ contentType: "application/json", body: "[]" }); return; }
    if (route.request().method() === "POST" && !route.request().url().includes("/object/sign/")) { state.uploads++; if (state.holdUpload) await new Promise<void>((resolve) => { state.releaseUpload = resolve; }); await route.fulfill({ status: state.uploadFails ? 400 : 200, contentType: "application/json", body: JSON.stringify(state.uploadFails ? { message: "Fixture upload failure" } : { Key: "fixture.pdf" }) }); return; }
    if (route.request().method() === "POST") await route.fulfill({ contentType: "application/json", body: JSON.stringify({ signedURL: `/object/sign/teacher-resources/${teacherId}/guide.pdf?token=fixture-expiring` }) });
    else await route.fulfill({ contentType: "application/pdf", body: pdf });
  });
  await context.route("**/functions/v1/**", async (route) => { state.calls.push(route.request().url()); await route.abort(); });
  return state;
}
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill("ana@example.test");
  await page.locator('input[autocomplete="current-password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Sign in to Kalinga", exact: true }).click();
  await page.getByRole("button", { name: "Keep sidebar open", exact: true }).click();
}
async function fillResource(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog", { name: "Upload a PDF" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("PDF file", { exact: false }).setInputFiles("public/resources/fraction-market-bottle-cap-math.pdf");
  await dialog.getByLabel("Resource title").fill("Reading practice cards");
  await dialog.getByLabel("Grade levels").fill("Grades 3–4");
  await dialog.getByLabel("How to use this resource").fill("Read one card together, then let each learner practise with a partner.");
  await dialog.getByRole("button", { name: "Continue to sharing", exact: false }).click();
  return dialog;
}
test("question and reply keep their drafts through upload cancellation and failures, then attach the new PDF", async ({ context, page }) => {
  const state = await fixtures(context); await signIn(page);
  await page.getByRole("button", { name: "Ask teachers", exact: true }).click();
  await page.getByRole("button", { name: "Ask a question", exact: false }).first().click();
  const question = page.locator(".community-composer");
  await question.getByLabel("Question", { exact: true }).fill("How can we practise reading?");
  await question.getByLabel("Classroom context").fill("I would like more activities with cards.");
  await question.getByRole("button", { name: "Upload a PDF" }).click();
  const dialog = await fillResource(page);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(question.getByLabel("Question", { exact: true })).toHaveValue("How can we practise reading?");
  await question.getByRole("button", { name: "Upload a PDF" }).click();
  await dialog.getByRole("button", { name: "Publish and attach PDF" }).click();
  await expect(dialog.getByRole("alert")).toContainText("permission to share");
  expect(state.uploads).toBe(0);
  await dialog.getByLabel("I made this resource or have permission to share it.", { exact: false }).check();
  state.uploadFails = true;
  await dialog.getByRole("button", { name: "Publish and attach PDF" }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not be uploaded");
  await expect(dialog.getByLabel("Resource title")).toHaveValue("Reading practice cards");
  state.uploadFails = false; state.metadataFails = true;
  await dialog.getByRole("button", { name: "Publish and attach PDF" }).click();
  await expect(dialog.getByRole("alert")).toContainText("details could not be saved");
  expect(state.removed).toBe(1);
  state.metadataFails = false; state.holdUpload = true;
  await dialog.getByRole("button", { name: "Publish and attach PDF" }).click();
  await expect(dialog.getByRole("button", { name: "Uploading PDF…", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await expect.poll(() => Boolean(state.releaseUpload)).toBe(true);
  state.releaseUpload!(); state.holdUpload = false;
  await expect(dialog).not.toBeVisible();
  await expect(question.getByLabel("Classroom context")).toHaveValue("I would like more activities with cards.");
  await expect(question.getByLabel("Attach a shared PDF")).toHaveValue("77777777-7777-4777-8777-777777777777");
  await page.locator(".community-composer").screenshot({ path: "/private/tmp/kalinga-teacher-workflows/question.png" });
  await question.getByRole("button", { name: "Post question" }).click();
  await expect(page.locator(".discussion-thread h2")).toHaveText("How can we practise reading?");
  expect(state.posts[0].body).toContain("[[kalinga-resource:77777777-7777-4777-8777-777777777777]]");
  const reply = page.locator(".reply-composer");
  await reply.getByRole("textbox").fill("Here is another activity we can try.");
  await reply.getByRole("button", { name: "Upload a PDF" }).click();
  await fillResource(page);
  await dialog.getByLabel("I made this resource or have permission to share it.", { exact: false }).check();
  await dialog.getByRole("button", { name: "Publish and attach PDF" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(reply.getByRole("textbox")).toHaveValue("Here is another activity we can try.");
  await reply.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.locator(".reply-item").last()).toContainText("Here is another activity");
  expect(state.posts[1].body).toContain("[[kalinga-resource:77777777-7777-4777-8777-777777777777]]");
  expect(state.resources.every((row) => row.visibility === "shared")).toBe(true);
});
test("library upload keeps private sharing available and has a usable mobile popup", async ({ context, page }) => {
  const state = await fixtures(context); await signIn(page);
  await page.getByRole("button", { name: "Find resources", exact: true }).click();
  await page.getByRole("button", { name: "Upload a resource", exact: false }).click();
  const dialog = await fillResource(page);
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await dialog.screenshot({ path: "/private/tmp/kalinga-teacher-workflows/resource-desktop.png" });
  await dialog.getByRole("button", { name: "Continue to sharing", exact: false }).click();
  await dialog.getByLabel("Who can open this PDF?").selectOption("private");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole("button", { name: "Upload privately" })).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "/private/tmp/kalinga-teacher-workflows/resource-mobile.png" });
  await dialog.getByRole("button", { name: "Upload privately" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.resources[0].visibility).toBe("private");
  await expect(page.locator("article").filter({ has: page.getByRole("heading", { name: "Reading practice cards" }) })).toContainText("Only me");
});
test("new lesson makes generation explicit, focuses a missing topic and keeps manual editing available", async ({ context, page }) => {
  const state = await fixtures(context); await signIn(page);
  await page.getByRole("button", { name: "Plan lessons", exact: true }).click();
  await page.getByRole("button", { name: "New lesson", exact: false }).first().click();
  const setup = page.locator(".plan-setup");
  await expect(setup.getByRole("button", { name: "Generate lesson plan", exact: true })).toBeVisible();
  await setup.getByRole("button", { name: "Generate lesson plan", exact: true }).click();
  await expect(setup.getByLabel("Lesson topic", { exact: false })).toBeFocused();
  expect(state.calls).toHaveLength(0);
  await setup.getByLabel("Lesson topic", { exact: false }).fill("Parts of a plant");
  if (await page.getByRole("button", { name: "Not now", exact: true }).isVisible()) await page.getByRole("button", { name: "Not now", exact: true }).click();
  await page.locator(".content").evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "/private/tmp/kalinga-teacher-workflows/planner-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await setup.getByRole("button", { name: "Generate lesson plan", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/private/tmp/kalinga-teacher-workflows/planner-mobile.png" });
  await setup.getByRole("button", { name: "Write it myself", exact: false }).click();
  await expect(page.locator('[data-tour="plan-document"]')).toBeVisible();
  await expect(page.getByLabel("Lesson title", { exact: true })).toHaveValue("Parts of a plant");
  await expect(page.getByRole("button", { name: "Generate lesson plan", exact: true })).toBeVisible();
  const requests: Record<string, unknown>[] = [];
  await page.route("**/functions/v1/gabay-chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ draft: { type: "full-plan", sharedTheme: "Local plants", learnerContext: "Observe the garden", materials: "Leaves and chalk", nextSessionNotes: "", grades: { "3": { competency: "Name plant parts", objective: "Identify roots and leaves" }, "4": { competency: "Explain plant functions", objective: "Explain the job of roots" } }, slots: [{ stage: "Guided Practice", durationMinutes: 80, teacherFocus: "All grades together", gradeTasks: { "3": "Name the roots", "4": "Describe the roots" } }] } }) });
  });
  await page.getByRole("button", { name: "Generate lesson plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Improve lesson with Gabay", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Learning Objectives for Grade 3", exact: true })).toHaveValue("Identify roots and leaves");
  await page.getByRole("textbox", { name: "Learning Objectives for Grade 3", exact: true }).fill("My edited learning objective");
  await page.getByRole("button", { name: "Save lesson", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: false }).last()).toBeVisible();
  expect(requests).toHaveLength(1);
  expect((requests[0].pageContext as Record<string, unknown>).lessonTopic).toBe("Parts of a plant");
  await expect.poll(() => (state.plan?.content as Record<string, unknown>)?.objectives).toMatchObject({ "3": "My edited learning objective" });
});
