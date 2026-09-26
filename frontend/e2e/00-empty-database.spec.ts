import { expect, test } from "@playwright/test";

/**
 * Runs first, and only when the suite is pointed at a freshly migrated, empty database (CI sets E2E_FRESH_DB=1).
 * Proves the app is usable with no seed data at all.
 */
test.skip(!process.env.E2E_FRESH_DB, "requires an empty database");

test("an empty database shows a helpful first-run state", async ({ page }) => {
  await page.goto("/leads");

  await expect(page.getByRole("heading", { name: "No leads yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New lead" }).first()).toBeVisible();
});
