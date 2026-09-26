import { expect, test } from "@playwright/test";

import { storageState } from "./support/users";

/**
 * Runs first, and only against a freshly migrated database that has no CRM data (CI sets E2E_FRESH_DB=1).
 * The bootstrap admin and this run's users exist; no leads do. Proves the app is usable with no seed data.
 */
test.skip(!process.env.E2E_FRESH_DB, "requires an empty database");
test.use({ storageState: storageState("admin") });

test("an empty database shows a helpful first-run state", async ({ page }) => {
  await page.goto("/leads");

  await expect(page.getByRole("heading", { name: "No leads yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New lead" }).first()).toBeVisible();
});
