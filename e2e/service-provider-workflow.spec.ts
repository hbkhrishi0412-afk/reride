import { test, expect } from '@playwright/test';

test.describe('Car services (provider) smoke', () => {
  test('car services page loads', async ({ page }) => {
    await page.goto('/car-services', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
  });

  test('service provider login route is reachable', async ({ page }) => {
    await page.goto('/car-services/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('input[type="email"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('#car-service-password, input[name="password"]').first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
