import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { write } from "./support/api";
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

const WORKFLOW_PROBE = path.join(AUTH_DIR, "restart-workflow-probe.json");

test("a converted lead and a moved deal are served after a backend restart", async ({ browser, playwright, baseURL }) => {
  test.skip(!phase, "set E2E_RESTART_PHASE=before|after");

  if (phase === "before") {
    // Drive the workflow through the same API the UI uses: create, qualify, convert, move, log.
    const tag = unique();
    const repA = await playwright.request.newContext({ baseURL, storageState: storageState("repA") });
    const lead = await (await write(repA, "post", "/api/v1/leads", {
      firstName: "Restart", lastName: `Probe${tag}`, company: `Restart Works ${tag}`, email: `restart.${tag}@probe.test`,
    })).json();
    expect((await write(repA, "post", `/api/v1/leads/${lead.id}/status-transitions`, { status: "QUALIFIED", version: 0 })).status()).toBe(200);
    const conversion = await write(repA, "post", `/api/v1/leads/${lead.id}/conversion`, {
      version: 1,
      account: { type: "STARTUP", name: `Restart Works ${tag}` },
      contact: { firstName: "Restart", lastName: `Probe${tag}`, email: `restart.${tag}@probe.test` },
      opportunity: { name: `Restart deal ${tag}`, amount: 12000, closeDate: "2030-06-30" },
    });
    expect(conversion.status()).toBe(201);
    const { opportunity } = await conversion.json();
    expect((await write(repA, "post", `/api/v1/opportunities/${opportunity.id}/stage-transitions`, { toStage: "QUALIFICATION", version: 0 })).status()).toBe(200);
    expect((await write(repA, "post", "/api/v1/activities", { type: "MEETING", subject: `Restart meeting ${tag}`, opportunityId: opportunity.id })).status()).toBe(201);
    writeFileSync(WORKFLOW_PROBE, JSON.stringify({ tag, leadId: lead.id, opportunityId: opportunity.id }));
    await repA.dispose();
    return;
  }

  const { tag, leadId, opportunityId } = JSON.parse(readFileSync(WORKFLOW_PROBE, "utf8")) as { tag: string; leadId: string; opportunityId: string };
  // Each Playwright run creates its own users, so this run's repA doesn't own the deal. A manager sees every deal.
  const context = await browser.newContext({ storageState: storageState("manager") });
  const page = await context.newPage();
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: `Restart deal ${tag}`, level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Stage" }).locator("[aria-current=step]")).toHaveText("Qualification");
  await expect(page.getByRole("list", { name: "Stage history" }).getByRole("listitem")).toHaveCount(2);
  const timeline = page.getByRole("list", { name: "Activity timeline" });
  await expect(timeline).toContainText(`Restart meeting ${tag}`);
  await expect(timeline).toContainText("Stage changed from Prospecting to Qualification");
  await expect(timeline).toContainText(/Converted lead LD-\d{6}/);

  await page.goto(`/leads/${leadId}`);
  await expect(page.getByRole("region", { name: "Conversion" })).toContainText(`Restart deal ${tag}`);
  await page.goto(`/pipeline?q=${encodeURIComponent(tag)}`);
  await expect(page.locator('section[data-stage="QUALIFICATION"]').getByTestId("pipeline-card")).toContainText(`Restart deal ${tag}`);
  await context.close();
});
