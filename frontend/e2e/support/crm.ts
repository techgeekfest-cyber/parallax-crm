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

/**
 * Picks an account in the server-searched combobox: type, wait for the server's results for what was typed, pick.
 *
 * Two things can otherwise pull the rug from under the click. After a submit that fails validation, react-hook-form
 * focuses the first invalid field again on a zero-delay timer; if that lands after typing it takes focus away, which
 * closes the list and clears the search. So any such already-queued work is allowed to run first (a zero-delay timer
 * queued now runs after it). And the list first shows unfiltered results, then re-renders with the debounced search
 * results; clicking during that switch can hit an option that is being replaced.
 */
export async function pickAccount(page: Page, scope: ReturnType<Page["getByRole"]>, name: string) {
  const input = scope.getByRole("combobox", { name: "Account" });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const searched = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/accounts" && url.searchParams.get("q") === name && response.ok();
  });
  await input.fill(name);
  await searched;
  await expect(input).toHaveValue(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
}
