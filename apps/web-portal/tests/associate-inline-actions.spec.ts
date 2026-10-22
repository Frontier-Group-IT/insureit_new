import { test, expect } from "@playwright/test";

// Real browser interaction test. Requires an authorized pre-saved authenticated
// storage state and a disposable/test associate on the target environment.
// Never submit destructive forms or resend an actual invitation.
const url = process.env.ASSOCIATE_ACTIONS_TEST_URL;
const state = process.env.ASSOCIATE_ACTIONS_STORAGE_STATE;
const person = process.env.ASSOCIATE_ACTIONS_TEST_NAME;

test.describe("Associate Account inline actions", () => {
  test.skip(!url || !state || !person, "Provide ASSOCIATE_ACTIONS_TEST_URL, ASSOCIATE_ACTIONS_STORAGE_STATE and ASSOCIATE_ACTIONS_TEST_NAME");

  test.use({ storageState: state || undefined });

  test("direct icon clicks open correct dialogs without modifying data", async ({ page }) => {
    await page.goto(url!);
    const row = page.getByRole("row").filter({ hasText: person! });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Actions for " + person })).toHaveCount(0);

    await row.getByRole("button", { name: "Edit " + person }).click();
    const edit = page.getByRole("dialog", { name: "Edit Associate Account" });
    await expect(edit).toBeVisible();
    await expect(edit.getByRole("button", { name: "Save changes" })).toBeVisible();
    await edit.getByRole("button", { name: "Cancel" }).click();
    await expect(edit).not.toBeVisible();

    await row.getByRole("button", { name: /^(Enable|Disable) / }).click();
    const status = page.getByRole("dialog", { name: /(Enable|Disable) Associate Account/ });
    await expect(status).toBeVisible();
    await status.getByRole("button", { name: "Cancel" }).click();
    await expect(status).not.toBeVisible();

    await row.getByRole("button", { name: "Delete " + person }).click();
    const deletion = page.getByRole("dialog", { name: "Permanently delete associate account?" });
    await expect(deletion).toBeVisible();
    await deletion.getByRole("button", { name: "Cancel" }).click();
    await expect(deletion).not.toBeVisible();

    await expect(row.getByRole("button", { name: /Resend link/i })).toHaveCount(1);
  });
});
