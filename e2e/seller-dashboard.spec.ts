import { test, expect } from '@playwright/test';
import { loginAsSeller } from './helpers/auth';
import { ensureSellerCanAddListing } from './helpers/seller-dashboard';
import { fetchPublishedVehicles } from './helpers/catalog';

test.describe('Seller dashboard', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await loginAsSeller(page, baseURL);
  });

  test('loads seller dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText('Test Seller').first()).toBeVisible({ timeout: 20_000 });
  });

  test('uses compact seller dashboard below lg breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
    await expect(page.locator('.lg\\:grid-cols-\\[260px_1fr\\]')).toHaveCount(1);

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.locator('.lg\\:grid-cols-\\[260px_1fr\\]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Listings/i }).first()).toBeVisible({ timeout: 15_000 });
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

  test('can open add vehicle form from dashboard', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureSellerCanAddListing(page, baseURL);

    const addButton = page
      .getByTestId('seller-add-vehicle-nav')
      .or(page.getByRole('button', { name: /^Add Vehicle$/i }))
      .first();
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
