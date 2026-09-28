import { expect, test, type Locator, type Page } from "@playwright/test";

import { write } from "./support/api";
import { choose, unique } from "./support/crm";
import { e2eUsers, PASSWORD, storageState } from "./support/users";

/**
 * The A3 sales workflow end to end, against the real stack (browser → Next.js → Spring Boot → PostgreSQL):
 * sign in, qualify and convert a real lead, check the account, contact and opportunity it became, work the deal
 * through the pipeline (detail page and Kanban drag and drop) to Closed won, and check stage history, the activity
 * timeline, persistence and the API's permission checks. Nothing is mocked.
 */

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A real pointer drag, so dnd-kit's sensors see exactly what a person's mouse would produce. */
async function drag(page: Page, card: Locator, column: Locator) {
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  // Grab the bottom row of the card (not its link), move a little to start the drag, then travel to the column.
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height - 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY + 12, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 140, { steps: 20 });
  await page.mouse.up();
}

const stagePath = (page: Page) => page.getByRole("region", { name: "Stage" }).locator("[aria-current=step]");
const timeline = (page: Page) => page.getByRole("list", { name: "Activity timeline" });

test("a qualified lead is converted and worked through the pipeline to Closed won", async ({ page, playwright, baseURL }) => {
  test.setTimeout(120_000);
  const { repA } = e2eUsers();
  const tag = unique();
  const person = `Grace Hopper${tag}`;
  const company = `Compiler Co ${tag}`;
  const dealName = `Compiler rollout ${tag}`;

  // 1. Sign in through the real form.
  await signIn(page, repA.email);

  // 2. A real lead, created through the UI and stored in PostgreSQL.
  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead" }).first().click();
  let dialog = page.getByRole("dialog", { name: "New lead" });
  await dialog.getByLabel("First name").fill("Grace");
  await dialog.getByLabel("Last name").fill(`Hopper${tag}`);
  await dialog.getByLabel("Company").fill(company);
  await dialog.getByLabel("Email").fill(`grace.${tag}@compiler.test`);
  await dialog.getByLabel("Estimated value (USD)").fill("60000");
  await dialog.getByRole("button", { name: "Create lead" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("searchbox", { name: "Search leads" }).fill(company);
  await page.getByRole("link", { name: person }).click();
  await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible();
  const leadId = page.url().split("/").pop()!;

  // Only qualified leads convert: qualify it first. The status change lands on the lead's timeline.
  await expect(page.getByRole("button", { name: "Convert lead" })).toHaveCount(0);
  await page.getByRole("button", { name: "Qualify" }).click();
  await expect(page.getByRole("main").getByText("Qualified", { exact: true })).toBeVisible();
  await expect(timeline(page)).toContainText("Status changed from New to Qualified");

  // 3. Convert it: review and edit the account, contact and opportunity, then confirm.
  await page.getByRole("button", { name: "Convert lead" }).click();
  dialog = page.getByRole("dialog", { name: "Convert lead" });
  await expect(dialog.getByLabel("Account name")).toHaveValue(company);
  await choose(page, dialog, "Account type", "Enterprise");
  await dialog.getByLabel(/^Industry/).fill("Software");
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByLabel("First name")).toHaveValue("Grace");
  await dialog.getByLabel(/^Title/).fill("CTO");
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByLabel("Opportunity name").fill(dealName);
  await expect(dialog.getByLabel("Amount (USD)")).toHaveValue("60000");
  await dialog.getByRole("button", { name: "Next" }).click();
  const review = dialog.getByRole("list", { name: "Review" });
  await expect(review).toContainText(`New account: ${company}`);
  await expect(review).toContainText("Enterprise");
  await expect(review).toContainText("CTO");
  await expect(review).toContainText("$60,000.00");
  await dialog.getByRole("button", { name: "Convert lead" }).click();

  // The summary links to everything the lead became.
  dialog = page.getByRole("dialog", { name: "Lead converted" });
  const converted = dialog.getByRole("list", { name: "Converted records" });
  await expect(converted.getByRole("link", { name: new RegExp(`Account created\\s*${company}`) })).toBeVisible();
  const accountHref = await converted.getByRole("link", { name: /Account created/ }).getAttribute("href");
  const contactHref = await converted.getByRole("link", { name: /Contact created/ }).getAttribute("href");
  const opportunityHref = await converted.getByRole("link", { name: /Opportunity created/ }).getAttribute("href");
  expect(accountHref).toMatch(/^\/accounts\/[0-9a-f-]{36}$/);
  expect(contactHref).toMatch(/^\/contacts\/[0-9a-f-]{36}$/);
  expect(opportunityHref).toMatch(/^\/opportunities\/[0-9a-f-]{36}$/);
  const opportunityId = opportunityHref!.split("/").pop()!;
  await dialog.getByRole("button", { name: "Done" }).click();

  // The lead is Converted, shows where it went, and offers no more conversion.
  await expect(page.getByRole("region", { name: "Conversion" })).toContainText(company);
  await expect(page.getByRole("region", { name: "Conversion" })).toContainText(dealName);
  await expect(page.getByRole("button", { name: "Convert lead" })).toHaveCount(0);
  await expect(timeline(page)).toContainText(/Converted lead LD-\d{6}/);

  // 4. The account exists, with the contact and the opportunity on it.
  await page.goto(accountHref!);
  await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Enterprise");
  await expect(page.getByRole("link", { name: person })).toBeVisible();
  await expect(page.getByRole("link", { name: dealName })).toBeVisible();

  // 5. The contact exists and belongs to the account.
  await page.goto(contactHref!);
  await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("CTO");
  await expect(page.getByRole("link", { name: company }).first()).toBeVisible();

  // 6 & 7. The opportunity exists; open it.
  await page.goto(opportunityHref!);
  await expect(page.getByRole("heading", { name: dealName, level: 1 })).toBeVisible();
  await expect(stagePath(page)).toHaveText("Prospecting");
  await expect(page.getByText("$60,000.00").first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Contacts at this account" })).toContainText(person);

  // 8. Move it through valid stages — first from the detail page…
  await page.getByRole("button", { name: "Advance to Qualification" }).click();
  await expect(stagePath(page)).toHaveText("Qualification");
  await expect(page.getByText("25%", { exact: true }).first()).toBeVisible();

  // …then on the Kanban board, where dragging calls the real stage-transition API.
  await page.goto(`/pipeline?q=${encodeURIComponent(tag)}`);
  const card = page.getByTestId("pipeline-card").filter({ hasText: dealName });
  const column = (stage: string) => page.locator(`section[data-stage="${stage}"]`);
  await expect(column("QUALIFICATION").getByTestId("pipeline-card").filter({ hasText: dealName })).toBeVisible();
  await expect(column("QUALIFICATION")).toContainText("$60,000");

  // Skipping a stage is refused with an explanation, and the card stays where it was.
  await drag(page, card, column("NEGOTIATION"));
  await expect(page.getByText(`${dealName} can't move from Qualification to Negotiation`)).toBeVisible();
  await expect(column("QUALIFICATION").getByTestId("pipeline-card").filter({ hasText: dealName })).toBeVisible();

  // A valid drop moves it, and the column totals are recomputed by the server.
  await drag(page, card, column("PROPOSAL"));
  await expect(page.getByText(`${dealName} moved to Proposal`)).toBeVisible();
  await expect(column("PROPOSAL").getByTestId("pipeline-card").filter({ hasText: dealName })).toBeVisible();
  await expect(column("PROPOSAL")).toContainText("$30,000 weighted");
  await expect(column("QUALIFICATION").getByLabel("0 opportunities")).toBeVisible();

  // The board reflects the database, not local state.
  await page.reload();
  await expect(column("PROPOSAL").getByTestId("pipeline-card").filter({ hasText: dealName })).toBeVisible();

  // Back on the detail page: Negotiation, then won with a note.
  await page.goto(opportunityHref!);
  await expect(stagePath(page)).toHaveText("Proposal");
  await page.getByRole("button", { name: "Advance to Negotiation" }).click();
  await expect(stagePath(page)).toHaveText("Negotiation");
  await page.getByRole("button", { name: "Mark won" }).click();
  dialog = page.getByRole("dialog", { name: "Mark this deal as won?" });
  await dialog.getByLabel(/^Note/).fill("Signed the three-year agreement");
  await dialog.getByRole("button", { name: "Mark won" }).click();
  await expect(dialog).toBeHidden();
  await expect(stagePath(page)).toHaveText("Closed won");
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();

  // A manual activity, logged against the deal.
  await page.getByRole("button", { name: "Log activity" }).click();
  const logForm = page.getByRole("form", { name: "Log activity" });
  await logForm.getByLabel("Subject").fill(`Kick-off call ${tag}`);
  await logForm.getByLabel(/^Details/).fill("Agreed the rollout plan");
  await logForm.getByRole("button", { name: "Log activity" }).click();
  await expect(logForm).toBeHidden();

  async function expectWorkflowRecorded() {
    // 9. Stage history from the database: every stage the deal entered, in order, with who moved it.
    const history = page.getByRole("list", { name: "Stage history" });
    await expect(history.getByRole("listitem")).toHaveCount(5);
    await expect(history.getByRole("listitem").nth(0)).toContainText("Created");
    await expect(history.getByRole("listitem").nth(0)).toContainText("Prospecting");
    await expect(history.getByRole("listitem").nth(1)).toContainText("from Prospecting");
    await expect(history.getByRole("listitem").nth(2)).toContainText("from Qualification");
    await expect(history.getByRole("listitem").nth(3)).toContainText("from Proposal");
    await expect(history.getByRole("listitem").nth(4)).toContainText("Closed won");
    await expect(history.getByRole("listitem").nth(4)).toContainText("from Negotiation");
    await expect(history.getByRole("listitem").nth(4)).toContainText(repA.fullName);

    // 10. The activity timeline: the manual call, each stage change (with the note), and the conversion.
    const entries = timeline(page).getByRole("listitem");
    await expect(entries.nth(0)).toContainText(`Kick-off call ${tag}`);
    await expect(entries.nth(0)).toContainText("Agreed the rollout plan");
    await expect(entries.nth(1)).toContainText("Closed won (from Negotiation)");
    await expect(entries.nth(1)).toContainText("Signed the three-year agreement");
    await expect(timeline(page)).toContainText("Stage changed from Qualification to Proposal");
    await expect(timeline(page)).toContainText("Stage changed from Prospecting to Qualification");
    await expect(timeline(page)).toContainText(/Converted lead LD-\d{6}/);
  }
  await expectWorkflowRecorded();

  // 11. Everything survives a full page refresh…
  await page.reload();
  await expect(stagePath(page)).toHaveText("Closed won");
  await expectWorkflowRecorded();

  // …and signing out and back in.
  await page.getByRole("button", { name: "Account menu" }).first().click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, repA.email);
  await page.goto(opportunityHref!);
  await expectWorkflowRecorded();

  // 13. Permission violations through the API: another rep can't read, move, annotate or convert repA's records,
  // and a second conversion by the owner is refused. None of it changes anything.
  const repB = await playwright.request.newContext({ baseURL, storageState: storageState("repB") });
  expect((await repB.get(`/api/v1/opportunities/${opportunityId}`)).status()).toBe(403);
  const move = await write(repB, "post", `/api/v1/opportunities/${opportunityId}/stage-transitions`, { toStage: "PROSPECTING", version: 4 });
  expect(move.status()).toBe(403);
  expect((await move.json()).code).toBe("PERMISSION_DENIED");
  const note = await write(repB, "post", "/api/v1/activities", { type: "NOTE", subject: "Not mine", opportunityId });
  expect(note.status()).toBe(403);
  const steal = await write(repB, "post", `/api/v1/leads/${leadId}/conversion`, {
    version: 2,
    account: { type: "SMB", name: `Stolen ${tag}` },
    contact: { firstName: "No", lastName: "Body" },
    opportunity: { name: "Nope", amount: 1, closeDate: "2030-01-01" },
  });
  expect(steal.status()).toBe(403);
  expect((await repB.get(`/api/v1/pipeline?ownerId=${repA.id}`)).status()).toBe(403);

  const repAApi = await playwright.request.newContext({ baseURL, storageState: storageState("repA") });
  const again = await write(repAApi, "post", `/api/v1/leads/${leadId}/conversion`, {
    version: 2,
    account: { type: "SMB", name: `Twice ${tag}` },
    contact: { firstName: "Grace", lastName: "Again" },
    opportunity: { name: "Twice", amount: 1, closeDate: "2030-01-01" },
  });
  expect(again.status()).toBe(409);
  expect((await again.json()).code).toBe("ALREADY_CONVERTED");
  const current = await (await repAApi.get(`/api/v1/opportunities/${opportunityId}`)).json();
  expect(current.stage).toBe("CLOSED_WON");
  expect(current.stageHistory).toHaveLength(5);
  const accounts = await (await repAApi.get(`/api/v1/accounts?q=${encodeURIComponent(tag)}`)).json();
  expect(accounts.content.map((account: { name: string }) => account.name)).toEqual([company]);

  await Promise.all([repB.dispose(), repAApi.dispose()]);
});

test("a stale stage change from another tab is rejected and the page shows the server's version", async ({ browser }) => {
  const tag = unique();
  const context = await browser.newContext({ storageState: storageState("repA") });
  const page = await context.newPage();
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "New opportunity" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New opportunity" });
  await dialog.getByLabel("Opportunity name").fill(`Contested ${tag}`);
  const accountName = `Contested Account ${tag}`;
  // An account to attach it to, created through the API the UI uses.
  const created = await write(context.request, "post", "/api/v1/accounts", { type: "SMB", name: accountName });
  expect(created.status()).toBe(201);
  const accountInput = dialog.getByRole("combobox", { name: "Account" });
  await accountInput.fill(accountName);
  await page.getByRole("option", { name: new RegExp(accountName) }).click();
  await dialog.getByLabel("Amount (USD)").fill("9000");
  await dialog.getByRole("button", { name: "Create opportunity" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("searchbox", { name: "Search opportunities" }).fill(tag);
  await page.getByRole("link", { name: `Contested ${tag}` }).click();
  await expect(stagePath(page)).toHaveText("Prospecting");
  const id = page.url().split("/").pop()!;

  // Another tab moves the deal first.
  const other = await write(context.request, "post", `/api/v1/opportunities/${id}/stage-transitions`, { toStage: "QUALIFICATION", version: 0 });
  expect(other.status()).toBe(200);

  // This tab still shows Prospecting at version 0; its move is refused and rolled back to the server's state.
  await page.getByRole("button", { name: "Advance to Qualification" }).click();
  await expect(page.getByText("Stage not changed")).toBeVisible();
  await expect(page.getByText(/Someone else changed this opportunity first/)).toBeVisible();
  await expect(stagePath(page)).toHaveText("Qualification");
  await expect(page.getByRole("list", { name: "Stage history" }).getByRole("listitem")).toHaveCount(2);
  await context.close();
});
