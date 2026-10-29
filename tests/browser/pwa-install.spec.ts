import { test, expect } from "@playwright/test";

test("installation is offered at sign-in and acceptance is separate from offline readiness", async ({ page }) => {
  await page.goto("/");
  const install = page.getByRole("button", { name: "Install Kalinga", exact: true });
  await expect(install).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole("dialog", { name: "Install Kalinga" })).toHaveCount(0);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(event);
  });
  await install.click();
  const dialog = page.getByRole("dialog", { name: "Install Kalinga" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
  await page.screenshot({ path: "/private/tmp/kalinga-install-checks/install-desktop.png" });
  await dialog.getByRole("button", { name: "Install app", exact: true }).click();
  await expect(dialog.getByText("Finish installing in your browser.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Kalinga is installed", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText(/Sign in and wait for “Ready for offline teaching”/)).not.toBeVisible();
  await dialog.getByText("After installing: prepare for offline teaching", { exact: true }).click();
  await expect(dialog.getByText(/Sign in and wait for “Ready for offline teaching”/)).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(dialog.getByText("Kalinga is installed", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(install).toHaveCount(0);
});

test("iPhone teachers get readable steps and can close the install panel on a small screen", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1" });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Install Kalinga", exact: true }).click({ timeout: 3000 });
  const dialog = page.getByRole("dialog", { name: "Install Kalinga" });
  await expect(dialog.getByText(/Add to Home Screen/).first()).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Install app", exact: true })).toHaveCount(0);
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(844);
  expect(Math.abs(bounds!.x + bounds!.width / 2 - 195)).toBeLessThan(2);
  await page.screenshot({ path: "/private/tmp/kalinga-install-checks/install-mobile.png" });
  await dialog.getByRole("button", { name: "Close installation guide" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Install Kalinga", exact: true })).toBeFocused();
});

test("installation remains reachable from the mobile account menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Offline demo", exact: false }).click();
  await page.getByRole("button", { name: "Account options", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Account options" }).getByText("Ready for offline teaching", { exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole("menuitem", { name: "Install Kalinga", exact: true }).click({ timeout: 3000 });
  await expect(page.getByRole("dialog", { name: "Install Kalinga" })).toBeVisible();
});

test("the browser can read the manifest and fetch Android and Apple installation icons", async ({ page, request }) => {
  await page.goto("/");
  const cdp = await page.context().newCDPSession(page);
  const manifest = await cdp.send("Page.getAppManifest");
  expect(manifest.errors).toEqual([]);
  const data = JSON.parse(manifest.data!);
  expect(data.display).toBe("standalone");
  expect(data.start_url).toBe("/");
  expect(data.icons).toEqual(expect.arrayContaining([expect.objectContaining({ purpose: "maskable", sizes: "512x512" })]));
  for (const icon of data.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect((await response.body()).subarray(1, 4).toString()).toBe("PNG");
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(apple).toBeTruthy();
  expect((await request.get(apple!)).ok()).toBe(true);
});

test("an already-open installed app does not advertise installing again", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "standalone", { get: () => true }); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back, Teacher", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install Kalinga", exact: true })).toHaveCount(0);
});

test("Mac Chrome guidance explains Guest profiles and supports choosing Dia or Opera", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36" });
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Install Kalinga", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Install Kalinga" });
  await expect(dialog.getByText("Chrome on Mac", { exact: true })).toBeVisible({ timeout: 3000 });
  await expect(dialog.getByText(/Guest/).first()).toBeVisible();
  await expect(dialog.getByText(/Cast, save, and share/)).toBeVisible();
  for (const browser of ["dia", "opera"]) {
    await dialog.getByLabel("Your browser").selectOption(browser);
    await expect(dialog.getByText(/Add to Dock/).first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Install app", exact: true })).toHaveCount(0);
    await expect(dialog.getByText(/current browser/).first()).toBeVisible();
  }
  await expect(dialog.getByRole("button", { name: "Use Kalinga in this browser", exact: true })).toBeInViewport({ timeout: 1000 });
  await page.screenshot({ path: "/private/tmp/kalinga-install-checks/install-mac-browser-guide.png" });
  await dialog.getByRole("button", { name: "Use Kalinga in this browser", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Install Kalinga", exact: true })).toBeFocused();
});
