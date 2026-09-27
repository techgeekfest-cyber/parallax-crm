import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { createAccount, unique } from "./support/crm";
import { AUTH_DIR, storageState } from "./support/users";

/**
 * Persistence across a backend restart, in two phases driven by the test runner:
 *   E2E_RESTART_PHASE=before → create records and remember them
 *   (restart the backend process)
 *   E2E_RESTART_PHASE=after  → the records must still be there, served by the new process
 */
const PROBE = path.join(AUTH_DIR, "restart-probe.json");
const phase = process.env.E2E_RESTART_PHASE;

test.use({ storageState: storageState("repA") });

test("records created before a backend restart are served after it", async ({ page }) => {
  test.skip(!phase, "set E2E_RESTART_PHASE=before|after");

  if (phase === "before") {
    const name = `Restart Probe ${unique()}`;
    const url = await createAccount(page, name, "Startup");
    writeFileSync(PROBE, JSON.stringify({ name, url }));
    return;
  }

  const { name, url } = JSON.parse(readFileSync(PROBE, "utf8")) as { name: string; url: string };
  await page.goto(url);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await page.goto(`/accounts?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name })).toBeVisible();
});
