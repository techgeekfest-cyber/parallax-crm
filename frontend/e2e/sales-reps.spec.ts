import { expect, test } from "@playwright/test";

import { unique } from "./support/crm";
import { e2eUsers, storageState } from "./support/users";

test("a manager sets a rep's quota and territory; the rep sees only themselves", async ({ page, browser }) => {
  const { repA } = e2eUsers();
  const territory = `Nordics ${unique()}`;
  const managerContext = await browser.newContext({ storageState: storageState("manager") });
  const manager = await managerContext.newPage();
  await manager.goto("/sales-reps");
  await manager.getByRole("searchbox", { name: "Search sales reps" }).fill(repA.email);
  await manager.getByRole("button", { name: `Edit ${repA.fullName}'s sales profile` }).click();
  const dialog = manager.getByRole("dialog", { name: "Edit sales profile" });
  await dialog.getByLabel("Territory").fill(territory);
  await dialog.getByLabel("Annual quota (USD)").fill("400000");
  await dialog.getByRole("button", { name: "Save profile" }).click();
  await expect(dialog).toBeHidden();
  await manager.reload();
  await manager.getByRole("searchbox", { name: "Search sales reps" }).fill(repA.email);
  await expect(manager.getByRole("row").filter({ hasText: repA.fullName })).toContainText(territory);
  await expect(manager.getByRole("row").filter({ hasText: repA.fullName })).toContainText("$400,000");
  await managerContext.close();

  const repContext = await browser.newContext({ storageState: storageState("repA") });
  const rep = await repContext.newPage();
  await rep.goto("/sales-reps");
  await expect(rep.getByRole("row")).toHaveCount(2); // header + self
  await expect(rep.getByRole("row").nth(1)).toContainText(territory);
  await expect(rep.getByRole("button", { name: /sales profile/ })).toHaveCount(0);
  await repContext.close();
  void page;
});

test("an admin adds a sales rep who can then sign in", async ({ browser }) => {
  const adminContext = await browser.newContext({ storageState: storageState("admin") });
  const admin = await adminContext.newPage();
  const email = `new.rep.${unique()}@e2e.parallax.test`;
  await admin.goto("/sales-reps");
  await admin.getByRole("button", { name: "Add sales rep" }).click();
  const dialog = admin.getByRole("dialog", { name: "Add sales rep" });
  await dialog.getByLabel("First name").fill("Nia");
  await dialog.getByLabel("Last name").fill("Okafor");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Temporary password").fill("a long temporary pass");
  await dialog.getByLabel("Territory").fill("West Africa");
  await dialog.getByRole("button", { name: "Add sales rep" }).click();
  await expect(dialog).toBeHidden();
  await adminContext.close();

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a long temporary pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/leads$/);
  await page.goto("/sales-reps");
  await expect(page.getByRole("row").nth(1)).toContainText("West Africa");
  await context.close();
});
