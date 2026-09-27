import { expect, test } from "@playwright/test";

import { choose, createAccount, pickAccount, unique } from "./support/crm";
import { storageState } from "./support/users";

test.use({ storageState: storageState("repA") });

test("account → contacts → opportunity, with primary contact and pipeline totals", async ({ page }) => {
  const tag = unique();
  const accountName = `Northwind ${tag}`;
  await createAccount(page, accountName, "SMB");

  // Contacts added from the account page are linked to it.
  await page.getByRole("button", { name: "Add contact" }).click();
  let dialog = page.getByRole("dialog", { name: "New contact" });
  await expect(dialog.getByRole("combobox", { name: "Account" })).toHaveValue(accountName);
  await dialog.getByLabel("First name").fill("Maria");
  await dialog.getByLabel("Last name").fill(`Anders ${tag}`);
  await dialog.getByLabel("Email").fill(`maria.${tag}@northwind.test`);
  await dialog.getByRole("switch", { name: "Primary contact" }).click();
  await dialog.getByRole("button", { name: "Create contact" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Add contact" }).click();
  dialog = page.getByRole("dialog", { name: "New contact" });
  await dialog.getByLabel("First name").fill("Thomas");
  await dialog.getByLabel("Last name").fill(`Hardy ${tag}`);
  await dialog.getByRole("switch", { name: "Primary contact" }).click();
  await dialog.getByRole("button", { name: "Create contact" }).click();
  await expect(dialog).toBeHidden();

  // Only one primary contact per account: Thomas replaced Maria.
  const contacts = page.locator("section").filter({ hasText: "Contacts" });
  await expect(contacts.getByRole("row").filter({ hasText: `Thomas Hardy ${tag}` })).toContainText("Primary");
  await expect(contacts.getByRole("row").filter({ hasText: `Maria Anders ${tag}` })).not.toContainText("Primary");

  // An opportunity created from the account page.
  await page.getByRole("button", { name: "New opportunity" }).click();
  dialog = page.getByRole("dialog", { name: "New opportunity" });
  await dialog.getByLabel("Opportunity name").fill(`Platform rollout ${tag}`);
  await dialog.getByLabel("Amount (USD)").fill("50000");
  await choose(page, dialog, "Stage", "Proposal");
  await expect(dialog.getByLabel("Probability (%)")).toHaveValue("50");
  await dialog.getByRole("button", { name: "Create opportunity" }).click();
  await expect(dialog).toBeHidden();

  const pipeline = page.locator("section").filter({ hasText: "Pipeline" }).first();
  await expect(pipeline.getByText("$50,000")).toBeVisible();
  await expect(pipeline.getByText("$25,000")).toBeVisible();

  // Close it as won through the stage workflow: Proposal → Negotiation → Closed won. The edit form can't change stages.
  await page.getByRole("link", { name: `Platform rollout ${tag}` }).click();
  await expect(page.getByRole("heading", { name: `Platform rollout ${tag}`, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  dialog = page.getByRole("dialog", { name: "Edit opportunity" });
  await expect(dialog.getByText("Change the stage with the stage controls on the opportunity.")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Advance to Negotiation" }).click();
  await expect(page.getByRole("region", { name: "Stage" }).locator("[aria-current=step]")).toHaveText("Negotiation");
  await page.getByRole("button", { name: "Mark won" }).click();
  dialog = page.getByRole("dialog", { name: "Mark this deal as won?" });
  await dialog.getByRole("button", { name: "Mark won" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
  const history = page.locator("[data-slot=card]").filter({ hasText: "Stage history" });
  await expect(history.getByText("Created", { exact: true })).toBeVisible();
  await expect(history.getByText("from Negotiation")).toBeVisible();
  await expect(history.getByText("Closed won")).toBeVisible();

  // The contact page links back to the account.
  await page.goto(`/contacts?q=${tag}`);
  await page.getByRole("link", { name: `Maria Anders ${tag}` }).click();
  await expect(page.getByRole("link", { name: accountName }).first()).toBeVisible();
});

test("a contact can be created from the contacts page by searching for its account", async ({ page }) => {
  const tag = unique();
  const accountName = `Searchable Account ${tag}`;
  await createAccount(page, accountName);

  await page.goto("/contacts");
  await page.getByRole("button", { name: "New contact" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New contact" });
  await dialog.getByRole("button", { name: "Create contact" }).click();
  await expect(dialog.getByText("Choose an account")).toBeVisible();

  await pickAccount(page, dialog, accountName);
  await dialog.getByLabel("First name").fill("Ana");
  await dialog.getByLabel("Last name").fill(`Trujillo ${tag}`);
  await dialog.getByRole("button", { name: "Create contact" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await page.getByRole("searchbox", { name: "Search contacts" }).fill(tag);
  await expect(page.getByRole("row").filter({ hasText: `Ana Trujillo ${tag}` })).toContainText(accountName);
});

test("opportunity stage filters query the server", async ({ page }) => {
  const tag = unique();
  const accountName = `Stagey ${tag}`;
  await createAccount(page, accountName);
  for (const [name, stage] of [[`Early ${tag}`, "Prospecting"], [`Late ${tag}`, "Negotiation"]] as const) {
    await page.getByRole("button", { name: "New opportunity" }).click();
    const dialog = page.getByRole("dialog", { name: "New opportunity" });
    await dialog.getByLabel("Opportunity name").fill(name);
    await dialog.getByLabel("Amount (USD)").fill("1000");
    await choose(page, dialog, "Stage", stage);
    await dialog.getByRole("button", { name: "Create opportunity" }).click();
    await expect(dialog).toBeHidden();
  }

  await page.goto(`/opportunities?q=${tag}&stage=NEGOTIATION`);
  await expect(page.getByRole("link", { name: `Late ${tag}` })).toBeVisible();
  await expect(page.getByRole("link", { name: `Early ${tag}` })).toHaveCount(0);
});
