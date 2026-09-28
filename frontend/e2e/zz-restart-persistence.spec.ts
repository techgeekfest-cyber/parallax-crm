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

const DASHBOARD_PROBE = path.join(AUTH_DIR, "restart-dashboard-probe.json");

test("dashboard figures are recomputed from the database after a backend restart", async ({ browser, playwright, baseURL }) => {
  test.skip(!phase, "set E2E_RESTART_PHASE=before|after");
  // The bootstrap admin is the one user that is the same in every run.
  const admin = await playwright.request.newContext({ baseURL, storageState: storageState("admin") });

  if (phase === "before") {
    const tag = unique();
    const rep = await (await write(admin, "post", "/api/v1/sales-reps", {
      email: `restart.dash.${tag}@e2e.parallax.test`, firstName: "Restart", lastName: `Figures ${tag}`,
      role: "SALES_REP", password: "restart dashboard passphrase", quota: 80000,
    })).json();
    const account = await (await write(admin, "post", "/api/v1/accounts", { type: "SMB", name: `Restart Figures ${tag}`, ownerId: rep.id })).json();
    for (const [name, amount, stage] of [["Won", 20000, "CLOSED_WON"], ["Open", 30000, "PROPOSAL"]] as const) {
      const created = await write(admin, "post", "/api/v1/opportunities", {
        accountId: account.id, name: `${name} ${tag}`, amount, stage, closeDate: "2030-06-30", ownerId: rep.id,
      });
      expect(created.status()).toBe(201);
    }
    const figures = await (await admin.get(`/api/v1/dashboard?ownerId=${rep.id}`)).json();
    writeFileSync(DASHBOARD_PROBE, JSON.stringify({ repId: rep.id, figures }));
    await admin.dispose();
    return;
  }

  const { repId, figures } = JSON.parse(readFileSync(DASHBOARD_PROBE, "utf8"));
  const now = await (await admin.get(`/api/v1/dashboard?ownerId=${repId}`)).json();
  // Everything the new process computes matches what the old one did (nothing was cached in memory).
  expect(now.pipeline).toEqual(figures.pipeline);
  expect(now.outcomes).toEqual(figures.outcomes);
  expect(now.quota).toEqual(figures.quota);
  expect(now.outcomes.wonAmount).toBe(20000);
  expect(now.quota.attainmentPercent).toBe(25);

  const context = await browser.newContext({ storageState: storageState("admin") });
  const page = await context.newPage();
  await page.goto(`/dashboard?owner=${repId}`);
  await expect(page.getByRole("group", { name: "Closed-won revenue", exact: true })).toContainText("$20K");
  await expect(page.getByRole("group", { name: "Quota attainment", exact: true })).toContainText("25%");
  await expect(page.getByRole("group", { name: "Open pipeline", exact: true })).toContainText("1 open deal · $30,000");
  await Promise.all([context.close(), admin.dispose()]);
});
