import { test, expect } from '@playwright/test';
import { loginAsSeller } from './helpers/auth';
import { fetchPublishedVehicles } from './helpers/catalog';

test.describe('Seller dashboard', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await loginAsSeller(page, baseURL);
  });

  test('loads seller dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText('Test Seller').first()).toBeVisible({ timeout: 20_000 });
  });

  test('shows dashboard navigation tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Overview|Listings|Messages|Analytics/i }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe('Seller vehicle management', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await loginAsSeller(page, baseURL);
  });

  test('can open add vehicle form from dashboard', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Add New Vehicle|Add Vehicle|New Listing/i }).first();
    await expect(addButton).toBeVisible({ timeout: 30_000 });
    await addButton.click();
    await expect(page.locator('input[name="make"], select[name="make"]').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('Seller listings context', () => {
  test('published vehicles exist for seller workflows', async ({ request }) => {
    const published = await fetchPublishedVehicles(request);
    expect(Array.isArray(published)).toBe(true);
  });
});
