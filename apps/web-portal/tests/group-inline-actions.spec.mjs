import { test, expect } from "@playwright/test";

// Authenticated browser test on a disposable Group only. All destructive and
// account-mutating forms are canceled; no invitation is sent.
const target = process.env.GROUP_ACTIONS_TEST_URL;
const authState = process.env.GROUP_ACTIONS_STORAGE_STATE;
const associateName = process.env.GROUP_ACTIONS_TEST_ASSOCIATE;

test.describe("Group detail inline account actions", () => {
  test.skip(!target || !authState || !associateName, "Requires authorized test URL, saved session and test associate");
  test.use({ storageState: authState || undefined });

  test("Group Administrator direct actions and deletion protection", async ({ page }) => {
    await page.goto(target);
    const row = page.getByRole("row").filter({ hasText: "Group Administrator" }).first();
    await expect(row.getByRole("button", { name: "Group Administrator actions" })).toHaveCount(0);
    await row.getByRole("button", { name: "Edit Group Administrator" }).click();
    await expect(page.getByRole("dialog", { name: "Edit Group Administrator" })).toBeVisible();
    await page.getByRole("dialog", { name: "Edit Group Administrator" }).getByRole("button", { name: "Cancel" }).click();
    await row.getByRole("button", { name: "Delete Group Administrator" }).click();
    const guard = page.getByRole("dialog", { name: "Delete Group Administrator" });
    await expect(guard).toBeVisible();
    await expect(guard.getByText("Deletion is blocked here")).toBeVisible();
    await guard.getByRole("button", { name: "Close" }).last().click();
    await expect(row.getByRole("button", { name: "Resend Group Administrator link" })).toHaveCount(1);
  });

  test("ordinary associate Edit, status, Delete all open without performing mutations", async ({ page }) => {
    await page.goto(target);
    const row = page.getByRole("row").filter({ hasText: associateName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit " + associateName }).click();
    const editor = page.getByRole("dialog", { name: "Edit Group Associate" });
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Cancel" }).click();
    await row.getByRole("button", { name: /^(Disable|Enable) / }).click();
    const status = page.getByRole("alertdialog");
    await expect(status).toBeVisible();
    await status.getByRole("button", { name: "Cancel" }).click();
    await row.getByRole("button", { name: "Delete " + associateName }).click();
    const deletion = page.getByRole("alertdialog");
    await expect(deletion).toBeVisible();
    await deletion.getByRole("button", { name: "Cancel" }).click();
    await expect(row.getByRole("button", { name: "Resend link for " + associateName })).toHaveCount(1);
  });
});
