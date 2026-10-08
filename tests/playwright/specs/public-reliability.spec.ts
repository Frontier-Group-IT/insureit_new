import { test, expect } from '@playwright/test';

// Non-destructive checks: public /login GET only, no authentication or form submissions.
test('repeated public login navigation stays responsive', async ({ page }) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `Attempt ${attempt + 1}: login HTTP status`).toBeLessThan(400);
    await expect(page.locator('input').first()).toBeVisible();
  }
});

test('login page works at the configured desktop or mobile viewport', async ({ page }) => {
  const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('body')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.innerWidth).toBeGreaterThan(0);
  expect(dimensions.viewportWidth).toBeGreaterThan(0);
  // Record horizontal overflow as evidence; don't assume all scrollable layouts are defects.
  test.info().annotations.push({
    type: 'layout',
    description: `viewport=${dimensions.viewportWidth}px document=${dimensions.documentWidth}px`,
  });
});

test('public login has no uncaught page exceptions during initial render', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('input').first()).toBeVisible();
  // Give hydration a short bounded opportunity to report browser exceptions.
  await page.waitForTimeout(1000);
  expect(errors, 'Uncaught client exceptions on public login').toEqual([]);
});
