import { test, expect } from '@playwright/test';

// No credentials, form submissions, writes, authenticated pages or mutation endpoints.
// Deliberately limited to public login rendering and passive navigation.
test('public login page renders without a server error', async ({ page }) => {
  const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
  expect(response, 'A navigation response is required').not.toBeNull();
  expect(response!.status(), 'Public login must not return HTTP error').toBeLessThan(400);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('input').first(), 'Login should expose an input').toBeVisible();
  await expect(page.getByRole('button').first(), 'Login should expose an actionable button').toBeVisible();
});

test('login form remains rendered after a reload', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input').first()).toBeVisible();
  const response = await page.reload({ waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('input').first()).toBeVisible();
});
