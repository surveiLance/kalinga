import { test, expect } from "@playwright/test";

test("relaunch keeps the open page and a captured email link waits until the teacher continues", async ({ page }) => {
  test.setTimeout(30000);
  await page.addInitScript(() => { Object.defineProperty(window, "launchQueue", { value: { setConsumer(consumer: (params: { targetURL?: string }) => void) { Object.assign(window, { testLaunch: consumer }); } } }); });
  await page.goto("/");
  await page.getByRole("button", { name: "Offline demo", exact: false }).click();
  await page.getByRole("button", { name: /Set up my first class/ }).click({ timeout: 3000 });
  await page.getByLabel("Class or section name", { exact: true }).fill("Keep this unfinished class");
  const launch = (target: string) => page.evaluate((targetURL) => (window as unknown as { testLaunch: (params: { targetURL: string }) => void }).testLaunch({ targetURL }), target);
  await launch(new URL("/", page.url()).href);
  await expect(page.getByLabel("Class or section name", { exact: true })).toHaveValue("Keep this unfinished class");
  await expect(page.getByRole("dialog", { name: "Open your email link" })).not.toBeVisible();
  await launch(new URL("/?confirmed=1", page.url()).href);
  const dialog = page.getByRole("dialog", { name: "Open your email link" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep working", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Class or section name", { exact: true })).toHaveValue("Keep this unfinished class");
  await page.getByRole("button", { name: "Close class editor", exact: true }).click();
  await page.getByRole("button", { name: "Finish opening email link", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue with email link", exact: true }).click();
  await expect(page).toHaveURL(/\?confirmed=1$/);
});
