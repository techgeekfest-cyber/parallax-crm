import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { apiLogin, write } from "./support/api";
import { choose, unique } from "./support/crm";
import { e2eUsers, storageState } from "./support/users";

/**
 * The dashboard against the real stack. The spec creates its own sales rep, so the figures it checks belong to records
 * made here and nothing else in the (shared, persistent) database can shift them. Every expected number is either a
 * value the API returned or one derived from the records this test created.
 */

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const tile = (page: Page, label: string) => page.getByRole("group", { name: label, exact: true });

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function dashboardJson(context: APIRequestContext, query = "") {
  const response = await context.get(`/api/v1/dashboard${query}`);
  expect(response.status()).toBe(200);
  return response.json();
}

test("the dashboard reflects real records as they change, for admins and for the rep", async ({ browser, playwright, baseURL }) => {
  test.setTimeout(120_000);
  // Signing in through the form replaces the browser's session, so use a clean browser rather than the shared admin one.
  const adminBrowser = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await adminBrowser.newPage();
  const tag = unique();
  const repEmail = `dash.${tag}@e2e.parallax.test`;
  const repPassword = "dashboard rep passphrase";
  const dealName = `Dashboard deal ${tag}`;
  const admin = await playwright.request.newContext({ baseURL, storageState: storageState("admin") });

  // A rep of our own, with a 100,000 quota, and an account to sell to.
  const created = await write(admin, "post", "/api/v1/sales-reps", {
    email: repEmail, firstName: "Dana", lastName: `Metrics ${tag}`, role: "SALES_REP", password: repPassword,
    territory: "Nordics", quota: 100000,
  });
  expect(created.status()).toBe(201);
  const rep = await created.json();
  const repId: string = rep.id;
  const repName = `Dana Metrics ${tag}`;
  const account = await write(admin, "post", "/api/v1/accounts", { type: "SMB", name: `Dashboard Co ${tag}`, ownerId: repId });
  expect(account.status()).toBe(201);

  // 1–3. Admin signs in, lands on the dashboard, and the tiles show exactly what the API computed.
  await signIn(page, e2eUsers().admin.email, process.env.E2E_ADMIN_PASSWORD ?? "parallax-local-admin");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByText(/Your organisation · Last 12 months/)).toBeVisible();
  const org = await dashboardJson(admin);
  if (org.pipeline.openCount === 0) {
    await expect(tile(page, "Open pipeline")).toContainText("No open deals");
  } else {
    await expect(tile(page, "Open pipeline")).toContainText(`${org.pipeline.openCount} open`);
    await expect(tile(page, "Open pipeline")).toContainText(money(org.pipeline.openAmount));
  }
  await expect(tile(page, "Opportunities")).toContainText(String(org.records.opportunities));

  // The new rep's own figures: nothing yet, and the dashboard says so rather than showing 0% or a fake average.
  await page.goto(`/dashboard?owner=${repId}`);
  await expect(page.getByText(new RegExp(`${repName} · Last 12 months`))).toBeVisible();
  await expect(tile(page, "Open pipeline")).toContainText("No open deals");
  await expect(tile(page, "Win rate")).toContainText("—");
  await expect(tile(page, "Win rate")).toContainText("No closed deals yet");
  await expect(tile(page, "Quota attainment")).toContainText("0%");
  await expect(tile(page, "Quota attainment")).toContainText("of $100K");
  await expect(page.getByText("No closed-won revenue in this period")).toBeVisible();

  // 4. A real opportunity for that rep, created through the UI.
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "New opportunity" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New opportunity" });
  await dialog.getByLabel("Opportunity name").fill(dealName);
  await dialog.getByRole("combobox", { name: "Account" }).fill(`Dashboard Co ${tag}`);
  await page.getByRole("option", { name: new RegExp(`Dashboard Co ${tag}`) }).click();
  await dialog.getByLabel("Amount (USD)").fill("50000");
  await choose(page, dialog, /^Owner/, repName);
  await dialog.getByRole("button", { name: "Create opportunity" }).click();
  await expect(dialog).toBeHidden();

  // 5–6. Back on the dashboard, the rep's figures include it: 50,000 open, weighted at Prospecting's 10%.
  await page.goto(`/dashboard?owner=${repId}`);
  await expect(tile(page, "Open pipeline")).toContainText("1 open deal · $50,000");
  await expect(tile(page, "Weighted pipeline")).toContainText("$5,000");
  await expect(page.locator('[data-stage="PROSPECTING"]')).toContainText("1 deal");

  // 7. Moving the stage moves the pipeline figures: Qualification weighs 25%.
  await page.goto(`/opportunities?q=${encodeURIComponent(dealName)}`);
  await page.getByRole("link", { name: dealName }).click();
  await page.getByRole("button", { name: "Advance to Qualification" }).click();
  await expect(page.getByRole("region", { name: "Stage" }).locator("[aria-current=step]")).toHaveText("Qualification");
  await page.goto(`/dashboard?owner=${repId}`);
  await expect(tile(page, "Weighted pipeline")).toContainText("$12,500");
  await expect(page.locator('[data-stage="QUALIFICATION"]')).toContainText("1 deal");
  await expect(page.locator('[data-stage="PROSPECTING"]')).toContainText("0 deals");

  // 8. Win it: revenue, win rate, average deal size and quota attainment all follow.
  await page.goto(`/opportunities?q=${encodeURIComponent(dealName)}`);
  await page.getByRole("link", { name: dealName }).click();
  for (const stage of ["Proposal", "Negotiation"]) {
    await page.getByRole("button", { name: `Advance to ${stage}` }).click();
    await expect(page.getByRole("region", { name: "Stage" }).locator("[aria-current=step]")).toHaveText(stage);
  }
  await page.getByRole("button", { name: "Mark won" }).click();
  await page.getByRole("dialog", { name: "Mark this deal as won?" }).getByRole("button", { name: "Mark won" }).click();
  await expect(page.getByRole("region", { name: "Stage" }).locator("[aria-current=step]")).toHaveText("Closed won");

  async function expectWonFigures(p: Page) {
    await expect(tile(p, "Closed-won revenue")).toContainText("$50K");
    await expect(tile(p, "Closed-won revenue")).toContainText("1 deal won");
    await expect(tile(p, "Win rate")).toContainText("100%");
    await expect(tile(p, "Win rate")).toContainText("1 won · 0 lost");
    await expect(tile(p, "Average deal size")).toContainText("$50K");
    await expect(tile(p, "Quota attainment")).toContainText("50%");
    await expect(tile(p, "Open pipeline")).toContainText("No open deals");
    await expect(p.locator('[data-stage="CLOSED_WON"]')).toContainText("1 deal");
  }
  await page.goto(`/dashboard?owner=${repId}`);
  await expectWonFigures(page);
  // The trend's table view carries the exact won amount in the current month.
  await page.getByRole("group", { name: "Closed-won revenue view" }).getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("cell", { name: "$50,000.00" })).toBeVisible();

  // The organisation's figures moved by exactly this deal.
  const orgAfter = await dashboardJson(admin);
  expect(orgAfter.outcomes.wonCount).toBe(org.outcomes.wonCount + 1);
  expect(orgAfter.outcomes.wonAmount).toBe(org.outcomes.wonAmount + 50000);

  // 10. Refresh: still there, from the database.
  await page.reload();
  await expectWonFigures(page);

  // 9. The rep's own dashboard: their figures only, no owner filter, and the API refuses anyone else's.
  const repContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const repPage = await repContext.newPage();
  await signIn(repPage, repEmail, repPassword);
  await expect(repPage.getByText(new RegExp(`${repName} · Last 12 months`))).toBeVisible();
  await expect(repPage.getByRole("combobox", { name: "Filter by owner" })).toHaveCount(0);
  await expectWonFigures(repPage);
  const team = repPage.getByRole("table", { name: "Performance by sales rep" });
  await expect(team.getByRole("row")).toHaveCount(2); // header + the rep
  await expect(team).toContainText(repName);
  await expect(team).toContainText("Nordics");

  const repApi = await apiLogin(baseURL!, repEmail, repPassword);
  const own = await dashboardJson(repApi);
  expect(own.scope.organisation).toBe(false);
  expect(own.scope.owner.id).toBe(repId);
  expect(own.team.total).toBe(1);
  const others = await repApi.get(`/api/v1/dashboard?ownerId=${e2eUsers().repA.id}`);
  expect(others.status()).toBe(403);
  expect((await others.json()).code).toBe("PERMISSION_DENIED");

  // A manager sees the whole organisation, like the admin.
  const manager = await playwright.request.newContext({ baseURL, storageState: storageState("manager") });
  const managerView = await dashboardJson(manager);
  expect(managerView.scope.organisation).toBe(true);
  expect(managerView.outcomes.wonAmount).toBe(orgAfter.outcomes.wonAmount);

  await Promise.all([admin.dispose(), repApi.dispose(), manager.dispose(), repContext.close(), adminBrowser.close()]);
});

test.describe("as an admin", () => {
  test.use({ storageState: storageState("admin") });

  test("the period filter is applied by the server", async ({ page, playwright, baseURL }) => {
    await page.goto("/dashboard");
    await page.getByRole("combobox", { name: "Reporting period" }).click();
    await page.getByRole("option", { name: "Last 30 days" }).click();
    await expect(page).toHaveURL(/range=LAST_30_DAYS/);
    await expect(page.getByText(/Your organisation · Last 30 days/)).toBeVisible();
    await expect(tile(page, "Win rate")).toContainText("last 30 days");

    const admin = await playwright.request.newContext({ baseURL, storageState: storageState("admin") });
    const month = await dashboardJson(admin, "?range=LAST_30_DAYS");
    expect(month.period.bucket).toBe("WEEK");
    await expect(tile(page, "Closed-won revenue")).toContainText(
      month.outcomes.wonCount === 0 ? "No deals won" : `${month.outcomes.wonCount} ${month.outcomes.wonCount === 1 ? "deal" : "deals"} won`,
    );
    await admin.dispose();
  });
});
