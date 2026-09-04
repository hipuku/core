import { expect, test } from "@playwright/test";

/**
 * The flow the case study describes: sign in, open a decision, read its
 * lifecycle. The permission model is the product here, so a test that never
 * authenticates is testing a different application.
 *
 * Credentials are the seed's own defaults, not a deployed account. The suite
 * owns its database and can therefore own its users, which is the same reason
 * drift-tests boots its own drift rather than pointing at a live one.
 */

const EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@core.hipuku.dev";
const PASSWORD = process.env.DEMO_USER_PASSWORD ?? "read-only-demo-2026";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // `/app` is the workspace list, not the decision log. The log lives at
  // `/app/{workspaceId}`, one click in. Assuming otherwise is what the first
  // run of this suite got wrong.
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();
}

/** Sign in, then open the seeded workspace's decision log. */
async function openLog(page: import("@playwright/test").Page) {
  await signIn(page);
  await page.getByRole("link", { name: /haus/ }).first().click();
  await page.waitForURL(/\/app\/[^/]+$/, { timeout: 30_000 });
}

test("signs in and reaches the decision log", async ({ page }) => {
  await openLog(page);

  // The seed builds haus's real decisions, so these are the titles that exist.
  await expect(page.getByRole("link", { name: /Split the brand out of the role layer/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /New decision/ })).toBeVisible();
});

test("opens a decision and shows its status and history", async ({ page }) => {
  await openLog(page);
  await page.getByRole("link", { name: /Split the brand out of the role layer/ }).click();

  await expect(page.getByRole("heading", { name: /Split the brand out of the role layer/ })).toBeVisible();

  // A decision without its status is a document; the status is what makes it a
  // decision log. One of the five the lifecycle defines has to be on the page.
  await expect(
    page.getByText(/proposed|accepted|rejected|superseded|deprecated/i).first(),
  ).toBeVisible();
});

test("is reachable and readable by keyboard alone", async ({ page }) => {
  await openLog(page);

  // Same assertion as drift's: whatever takes focus has to be rendered. The
  // defect this guards against shipped on hipuku-web and no unit test saw it.
  let checked = 0;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    if ((await focused.count()) === 0) continue;
    await expect(focused).toBeVisible();
    const opacity = await focused.evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBeGreaterThan(0);
    checked++;
  }
  // Without a floor the loop passes by focusing nothing.
  expect(checked).toBeGreaterThan(5);
});

test("refuses the app to a signed-out visitor", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/app");
  // The permission model is the product: an unauthenticated visitor lands on
  // sign-in rather than seeing a workspace.
  await expect(page).toHaveURL(/\/sign-in/);
});
