import { expect, test } from "@playwright/test";

import { e2eUsers, storageState } from "./support/users";

test.describe("as an admin", () => {
  test.use({ storageState: storageState("admin") });

  test("adds a user who can then sign in", async ({ page, browser }) => {
    const email = `new.hire.${Date.now()}@e2e.parallax.test`;
    await page.goto("/users");
    await page.getByRole("button", { name: "Add user" }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });
    await dialog.getByLabel("First name").fill("Nova");
    await dialog.getByLabel("Last name").fill("Hire");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Generate" }).click();
    const password = await dialog.getByLabel("Temporary password").inputValue();
    await dialog.getByRole("button", { name: "Add user" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("searchbox", { name: "Search users" }).fill(email);
    await expect(page.getByRole("row").filter({ hasText: email })).toContainText("Sales rep");

    // An explicitly empty state: browser.newContext() would otherwise inherit this test's admin session.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const newUser = await context.newPage();
    await newUser.goto("/login");
    await newUser.getByLabel("Email").fill(email);
    await newUser.getByLabel("Password").fill(password);
    await newUser.getByRole("button", { name: "Sign in" }).click();
    await expect(newUser.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    await expect(newUser.getByRole("link", { name: "Users" })).toHaveCount(0);
    await context.close();
  });

  test("changing a user's role signs them out immediately", async ({ page, browser }) => {
    const { repB } = e2eUsers();
    const repContext = await browser.newContext({ storageState: storageState("repB") });
    const repPage = await repContext.newPage();
    await repPage.goto("/leads");
    await expect(repPage.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();

    await page.goto("/users");
    await page.getByRole("searchbox", { name: "Search users" }).fill(repB.email);
    await page.getByRole("button", { name: `Edit ${repB.fullName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit user" });
    await dialog.getByLabel("Role").click();
    await page.getByRole("option", { name: "Sales manager" }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: repB.email })).toContainText("Sales manager");

    await repPage.reload();
    await expect(repPage).toHaveURL(/\/login/);
    await repContext.close();
  });

  test("cannot change their own role or deactivate themselves", async ({ page }) => {
    const { admin } = e2eUsers();
    await page.goto("/users");
    await page.getByRole("searchbox", { name: "Search users" }).fill(admin.email);
    await page.getByRole("button", { name: `Edit ${admin.fullName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit user" });
    await expect(dialog.getByText("You can't change your own role.")).toBeVisible();
    await expect(dialog.getByRole("switch")).toBeDisabled();
  });
});

test.describe("as a sales rep", () => {
  test.use({ storageState: storageState("repA") });

  test("has no user directory", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "You don't have access" })).toBeVisible();
  });
});
