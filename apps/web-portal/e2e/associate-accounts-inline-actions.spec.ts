/**
 * Authenticated browser regression for the actual Associate Accounts register.
 *
 * Run with Playwright and a disposable, authorized test account:
 *   ASSOCIATE_ACTIONS_TEST_URL=https://<test-host>/intermediaries/applications/<id>/associate-accounts
 *   ASSOCIATE_ACTIONS_STORAGE_STATE=/absolute/path/to/authorized-state.json
 *   npx playwright test e2e/associate-accounts-inline-actions.spec.ts
 *
 * Never run destructive confirmations against production records.
 */
import { test, expect } from "@playwright/test";

const url = process.env.ASSOCIATE_ACTIONS_TEST_URL;
const state = process.env.ASSOCIATE_ACTIONS_STORAGE_STATE;

test.describe("Associate Accounts inline actions", () => {
  test.skip(!url || !state, "Requires explicit authenticated test URL and storage state.");
  test.use({ storageState: state || undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto(url!);
    await expect(page.getByRole("heading", { name: "Associate Accounts Register" })).toBeVisible();
  });

  test("opens Edit and allows cancel without saving", async ({ page }) => {
    const edit = page.getByRole("button", { name: /^Edit / }).first();
    await expect(edit).toBeVisible();
    await edit.click();
    const dialog = page.getByRole("dialog", { name: "Edit Associate Account" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="name"]')).not.toHaveValue("");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("opens Disable or Enable confirmation and cancels safely", async ({ page }) => {
    const control = page.getByRole("button", { name: /^(Disable|Enable) / }).first();
    await control.click();
    const dialog = page.getByRole("dialog", { name: /^(Disable|Enable) Associate Account$/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("opens Delete confirmation and cancels without deletion", async ({ page }) => {
    await page.getByRole("button", { name: /^Delete / }).first().click();
    const dialog = page.getByRole("dialog", { name: "Permanently delete associate account?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Delete permanently" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("shows resend link as a directly accessible button, without a menu", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Resend link to / }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Actions for / })).toHaveCount(0);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
});
