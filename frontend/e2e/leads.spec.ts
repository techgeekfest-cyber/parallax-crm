import { expect, test, type Page } from "@playwright/test";

/**
 * The A0 vertical slice, end to end: browser → Next.js → Spring Boot → PostgreSQL.
 * Every assertion after a reload proves the data came back from the database, not from browser state.
 */

function uniqueLead() {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    firstName: "Ada",
    lastName: `Lovelace${suffix}`,
    company: `Analytical Engines ${suffix}`,
    email: `ada.${suffix}@example.com`,
  };
}

async function createLead(page: Page, lead: ReturnType<typeof uniqueLead>, extras?: { value?: string }) {
  await page.getByRole("button", { name: "New lead" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New lead" });
  await dialog.getByLabel("First name").fill(lead.firstName);
  await dialog.getByLabel("Last name").fill(lead.lastName);
  await dialog.getByLabel("Company").fill(lead.company);
  await dialog.getByLabel("Email").fill(lead.email);
  if (extras?.value) await dialog.getByLabel("Estimated value (USD)").fill(extras.value);
  await dialog.getByRole("button", { name: "Create lead" }).click();
  return dialog;
}

test("a created lead is persisted and survives a full reload", async ({ page }) => {
  const lead = uniqueLead();
  await page.goto("/leads");

  const dialog = await createLead(page, lead, { value: "48000" });
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`${lead.firstName} ${lead.lastName} added`)).toBeVisible();

  await page.reload();
  await page.getByRole("searchbox", { name: "Search leads" }).fill(lead.company);
  const row = page.getByRole("row").filter({ hasText: lead.company });
  await expect(row).toBeVisible();
  await expect(row).toContainText("$48,000");
  await expect(row).toContainText("New");

  await row.getByRole("link", { name: `${lead.firstName} ${lead.lastName}` }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: `${lead.firstName} ${lead.lastName}` })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: `${lead.firstName} ${lead.lastName}` })).toBeVisible();
  await expect(page.getByText(lead.email).first()).toBeVisible();
  await expect(page.getByText("$48,000.00")).toBeVisible();
});

test("the search query lives in the URL", async ({ page }) => {
  const lead = uniqueLead();
  await page.goto("/leads");
  await createLead(page, lead);
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto(`/leads?q=${encodeURIComponent(lead.email)}`);
  await expect(page.getByRole("searchbox", { name: "Search leads" })).toHaveValue(lead.email);
  await expect(page.getByRole("row").filter({ hasText: lead.company })).toHaveCount(1);
});

test("a duplicate email is rejected by the server and shown on the field", async ({ page }) => {
  const lead = uniqueLead();
  await page.goto("/leads");
  await createLead(page, lead);
  await expect(page.getByRole("dialog")).toBeHidden();

  const dialog = await createLead(page, { ...uniqueLead(), email: lead.email.toUpperCase() });
  await expect(dialog.getByText(/already exists/)).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("client-side validation blocks incomplete leads", async ({ page }) => {
  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New lead" });
  await dialog.getByRole("button", { name: "Create lead" }).click();

  await expect(dialog.getByText("First name is required")).toBeVisible();
  await expect(dialog.getByText("Email is required")).toBeVisible();
});

test("an unknown lead shows a not-found state", async ({ page }) => {
  await page.goto("/leads/00000000-0000-7000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Lead not found" })).toBeVisible();
});
