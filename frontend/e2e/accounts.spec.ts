import { expect, test } from "@playwright/test";

import { choose, createAccount, unique } from "./support/crm";
import { storageState } from "./support/users";

test.use({ storageState: storageState("repA") });

test("an enterprise account is created with its profile, derived tier, and survives a reload", async ({ page }) => {
  const name = `Globex ${unique()}`;
  await createAccount(page, name, "Enterprise", async (dialog) => {
    await dialog.getByLabel("Industry").fill("Energy");
    await dialog.getByLabel("Annual revenue (USD)").fill("2500000000");
    await dialog.getByLabel("Subsidiaries").fill("Globex Labs\nGlobex Europe");
    await dialog.getByRole("switch", { name: "Enterprise support contract" }).click();
    await dialog.getByLabel("City").first().fill("Springfield");
  });

  await page.reload();
  const header = page.locator("header").filter({ hasText: name });
  await expect(header.getByText("Enterprise", { exact: true })).toBeVisible();
  await expect(header.getByText("Strategic")).toBeVisible();
  await expect(page.getByText("Dedicated support")).toBeVisible();
  await expect(page.getByText("Globex Europe, Globex Labs")).toBeVisible();
  await expect(page.getByText("Springfield")).toBeVisible();
  await expect(page.getByText("$2,500,000,000")).toBeVisible();
});

test("the owner edits an account and the change persists", async ({ page }) => {
  const name = `Initech ${unique()}`;
  await createAccount(page, name);

  await page.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit account" });
  await expect(dialog.getByLabel("Account type", { exact: true })).toBeDisabled();
  await dialog.getByLabel("Industry").fill("Software");
  await dialog.getByLabel("Years in business").fill("7");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByText("Software")).toBeVisible();
  await expect(page.locator("header").getByText("Established")).toBeVisible();
});

test("validation and duplicate names are reported on the field", async ({ page }) => {
  const name = `Duplicate Co ${unique()}`;
  await createAccount(page, name);

  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New account" });
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText("Account name is required")).toBeVisible();

  await dialog.getByLabel("Account name").fill(name.toUpperCase());
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText(/already exists/)).toBeVisible();
});

test("search and type filters work against the server and live in the URL", async ({ page }) => {
  const tag = unique();
  await createAccount(page, `Filterable Startup ${tag}`, "Startup");
  await createAccount(page, `Filterable Shop ${tag}`, "SMB");

  await page.goto(`/accounts?q=${tag}`);
  await expect(page.getByRole("row")).toHaveCount(3); // header + 2
  await choose(page, page.locator("main"), "Filter by type", "Startup");
  await expect(page).toHaveURL(/type=STARTUP/);
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("link", { name: `Filterable Startup ${tag}` })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: `Filterable Startup ${tag}` })).toBeVisible();
  await expect(page.getByRole("link", { name: `Filterable Shop ${tag}` })).toHaveCount(0);
});

test("reps cannot archive; managers archive and restore", async ({ page, browser }) => {
  const name = `Archivable ${unique()}`;
  const url = await createAccount(page, name);
  await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);

  const managerContext = await browser.newContext({ storageState: storageState("manager") });
  const manager = await managerContext.newPage();
  await manager.goto(url);
  await manager.getByRole("button", { name: "Archive" }).click();
  await manager.getByRole("dialog").getByRole("button", { name: "Archive account" }).click();
  await expect(manager.getByText(/^Archived/)).toBeVisible();
  await expect(manager.getByRole("button", { name: "Edit" })).toHaveCount(0);

  await manager.goto(`/accounts?q=${encodeURIComponent(name)}`);
  await expect(manager.getByRole("heading", { name: "No accounts match" })).toBeVisible();
  await manager.goto(`/accounts?q=${encodeURIComponent(name)}&status=archived`);
  await expect(manager.getByRole("link", { name })).toBeVisible();

  await manager.goto(url);
  await manager.getByRole("button", { name: "Restore" }).click();
  await expect(manager.getByRole("button", { name: "Archive" })).toBeVisible();
  await managerContext.close();
});
