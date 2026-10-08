import { test, expect } from '@playwright/test';

// Public GET only: exercise the dashboard route in a clean browser context.
// No stored session, credentials, login submission or DB mutations.
test('unauthenticated dashboard requests resolve to a public login gate', async ({ page }) => {
  const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  expect(response, 'The dashboard must return a navigation response').not.toBeNull();
  expect(response!.status(), 'No server error or broken route').toBeLessThan(500);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('input').first(), 'Unauthenticated users should see login fields').toBeVisible();
  // This checks the visible browser gate, not server/API authorization or Supabase RLS.
});
