import { expect, test } from "@playwright/test";

import { write } from "./support/api";
import { choose, createAccount, pickAccount, unique } from "./support/crm";
import { e2eUsers, storageState } from "./support/users";

test.use({ storageState: storageState("manager") });

test("a manager assigns an opportunity to a rep; other reps can neither see nor change it", async ({ page, browser, playwright, baseURL }) => {
  const { repA, repB } = e2eUsers();
  const tag = unique();
  await createAccount(page, `Assigned Co ${tag}`);

  await page.getByRole("button", { name: "New opportunity" }).click();
  const dialog = page.getByRole("dialog", { name: "New opportunity" });
  await dialog.getByLabel("Opportunity name").fill(`For B ${tag}`);
  await dialog.getByLabel("Amount (USD)").fill("7000");
  await choose(page, dialog, /^Owner/, repB.fullName);
  await dialog.getByRole("button", { name: "Create opportunity" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: `For B ${tag}` }).click();
  await expect(page.getByRole("heading", { name: `For B ${tag}`, level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText(repB.fullName)).toBeVisible();
  const opportunityPath = new URL(page.url()).pathname;
  const opportunityId = opportunityPath.split("/").pop()!;

  // Rep B sees it.
  const repBContext = await browser.newContext({ storageState: storageState("repB") });
  const repBPage = await repBContext.newPage();
  await repBPage.goto(opportunityPath);
  await expect(repBPage.getByRole("heading", { name: `For B ${tag}` })).toBeVisible();

  // Rep A doesn't — not in the list, not by URL, and not through the API directly.
  const repAContext = await browser.newContext({ storageState: storageState("repA") });
  const repAPage = await repAContext.newPage();
  await repAPage.goto(`/opportunities?q=${tag}`);
  await expect(repAPage.getByRole("heading", { name: "No opportunities match" })).toBeVisible();
  await repAPage.goto(opportunityPath);
  await expect(repAPage.getByRole("heading", { name: "You don't have access" })).toBeVisible();

  const repAApi = await playwright.request.newContext({ baseURL, storageState: storageState("repA") });
  const read = await repAApi.get(`/api/v1/opportunities/${opportunityId}`);
  expect(read.status()).toBe(403);
  const edit = await write(repAApi, "put", `/api/v1/opportunities/${opportunityId}`, {
    accountId: "00000000-0000-7000-8000-000000000000",
    name: "hijacked",
    amount: 1,
    stage: "PROSPECTING",
    closeDate: "2030-01-01",
    version: 0,
  });
  expect(edit.status()).toBe(403);
  expect((await edit.json()).code).toBe("PERMISSION_DENIED");
  expect(repA.id).not.toBe(repB.id);

  await Promise.all([repAApi.dispose(), repAContext.close(), repBContext.close()]);
});

test("reps can read shared accounts but only edit their own", async ({ page, browser, playwright, baseURL }) => {
  const tag = unique();
  const url = await createAccount(page, `Managers Account ${tag}`);
  const accountId = url.split("/").pop()!;

  const repContext = await browser.newContext({ storageState: storageState("repA") });
  const repPage = await repContext.newPage();
  await repPage.goto(url);
  await expect(repPage.getByRole("heading", { name: `Managers Account ${tag}` })).toBeVisible();
  await expect(repPage.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(repPage.getByRole("button", { name: "Archive" })).toHaveCount(0);

  const repApi = await playwright.request.newContext({ baseURL, storageState: storageState("repA") });
  const edit = await write(repApi, "put", `/api/v1/accounts/${accountId}`, { type: "SMB", name: "Taken over", version: 0 });
  expect(edit.status()).toBe(403);
  const archive = await write(repApi, "post", `/api/v1/accounts/${accountId}/archive`, {});
  expect(archive.status()).toBe(403);

  // The rep can still attach their own contact to the shared account.
  await repPage.goto("/contacts");
  await repPage.getByRole("button", { name: "New contact" }).first().click();
  const dialog = repPage.getByRole("dialog", { name: "New contact" });
  await pickAccount(repPage, dialog, `Managers Account ${tag}`);
  await dialog.getByLabel("First name").fill("Rep");
  await dialog.getByLabel("Last name").fill(`Contact ${tag}`);
  await dialog.getByRole("button", { name: "Create contact" }).click();
  await expect(dialog).toBeHidden();

  await Promise.all([repApi.dispose(), repContext.close()]);
});

test("unauthenticated API requests are rejected with 401", async ({ playwright, baseURL }) => {
  // Explicitly empty: request contexts otherwise inherit this file's signed-in storage state.
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  for (const path of ["/api/v1/accounts", "/api/v1/contacts", "/api/v1/opportunities", "/api/v1/sales-reps"]) {
    const response = await anonymous.get(path);
    expect(response.status(), path).toBe(401);
  }
  await anonymous.dispose();
});
