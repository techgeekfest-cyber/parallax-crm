import { expect, test, type Page } from "@playwright/test";

import { e2eUsers, PASSWORD } from "./support/users";

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("signed-out visitors are sent to sign-in and returned where they were going", async ({ page }) => {
  const { repA } = e2eUsers();
  await page.goto("/leads?q=anything");

  await expect(page).toHaveURL(/\/login\?next=%2Fleads%3Fq%3Danything$/);
  await signIn(page, repA.email, PASSWORD);

  await expect(page).toHaveURL(/\/leads\?q=anything$/);
  await expect(page.getByRole("button", { name: "Account menu" }).first()).toContainText(repA.fullName);
});

test("a wrong password shows a generic error", async ({ page }) => {
  const { repA } = e2eUsers();
  await page.goto("/login");
  await signIn(page, repA.email, "definitely not the password");

  // (Next.js renders its own empty route-announcer alert, so match the message itself.)
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("data survives signing out and back in", async ({ page }) => {
  const { repA } = e2eUsers();
  const company = `Persistence Co ${Date.now()}`;
  await page.goto("/login");
  await signIn(page, repA.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New lead" });
  await dialog.getByLabel("First name").fill("Persist");
  await dialog.getByLabel("Last name").fill("Ence");
  await dialog.getByLabel("Company").fill(company);
  await dialog.getByLabel("Email").fill(`persist.${Date.now()}@example.com`);
  await dialog.getByRole("button", { name: "Create lead" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Account menu" }).first().click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, repA.email, PASSWORD);
  await page.getByRole("searchbox", { name: "Search leads" }).fill(company);
  await expect(page.getByRole("row").filter({ hasText: company })).toBeVisible();
});
