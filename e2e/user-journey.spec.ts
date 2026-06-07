import { test, expect } from '@playwright/test';
import { loginAsCustomer } from './helpers/auth';
import { fetchPublishedVehicles } from './helpers/catalog';

test.describe('Customer browse journey', () => {
  test('browse used cars and open a listing', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await page.goto('/used-cars', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
    await page.locator('[data-testid="vehicle-card"]').first().click();
    await page.waitForURL(/\/vehicle\//, { timeout: 30_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
  });

  test('logged-in customer reaches wishlist route', async ({ page, baseURL }) => {
    await loginAsCustomer(page, baseURL);
    await page.goto('/wishlist', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(/\/wishlist/, { timeout: 15_000 });
  });
});
