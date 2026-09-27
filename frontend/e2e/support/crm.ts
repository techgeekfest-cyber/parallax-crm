import { expect, type Page } from "@playwright/test";

export const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** Chooses an option in a Base UI select by its trigger's label (a RegExp for labels with an "optional" suffix). */
export async function choose(page: Page, scope: ReturnType<Page["getByRole"]>, label: string | RegExp, option: string) {
  await (typeof label === "string" ? scope.getByLabel(label, { exact: true }) : scope.getByLabel(label)).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function createAccount(page: Page, name: string, type: "Enterprise" | "SMB" | "Startup" = "SMB", extra?: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>) {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New account" });
  await choose(page, dialog, "Account type", type);
  await dialog.getByLabel("Account name").fill(name);
  if (extra) await extra(dialog);
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("searchbox", { name: "Search accounts" }).fill(name);
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  return page.url();
}

/** Picks an account in the server-searched combobox. */
export async function pickAccount(page: Page, scope: ReturnType<Page["getByRole"]>, name: string) {
  const input = scope.getByRole("combobox", { name: "Account" });
  await input.fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
}
