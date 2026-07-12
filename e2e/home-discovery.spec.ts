import { test, expect } from '@playwright/test';
import { fetchPublishedVehicles, ensureSoldVehicleForE2E } from './helpers/catalog';

test.describe('Home discovery — geo & city chips', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('reRideSelectedCity');
      localStorage.removeItem('reRideUserLocation');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('popular-cities-chips')).toBeVisible({ timeout: 60_000 });
  });

  test('shows popular city chips on desktop home', async ({ page }) => {
    await expect(
      page.getByTestId('popular-cities-chips').getByRole('button', { name: 'All India', exact: true }),
    ).toBeVisible();
  });

  test('All India chip navigates to used cars without locking a city', async ({ page }) => {
    const allIndia = page.getByTestId('popular-cities-chips').getByRole('button', { name: 'All India', exact: true });
    await expect(allIndia).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/used-cars\/?$/, { timeout: 30_000 }),
      allIndia.click(),
    ]);
    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
  });

  test('shows location picker beside logo on desktop home', async ({ page }) => {
    const picker = page.getByTestId('header-location-picker');
    await expect(picker).toBeVisible({ timeout: 30_000 });
    await expect(picker).toContainText(/All of India|Select location/i);
  });

  test('selecting a popular city chip filters the used cars list', async ({ page }) => {
    const mumbaiChip = page
      .getByTestId('popular-cities-chips')
      .getByRole('button', { name: /^Mumbai/i });
    await expect(mumbaiChip).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/used-cars/, { timeout: 30_000 }),
      mumbaiChip.click(),
    ]);
    await expect
      .poll(async () => {
        return page.evaluate(() => localStorage.getItem('reRideSelectedCity'));
      })
      .toMatch(/mumbai/i);
  });
});

test.describe('Vehicle detail — stock & contact CTAs', () => {
  test('published listing shows in-stock badge and seller actions', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    const vehicle = published[0];
    await page.goto(`/vehicle/${vehicle.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`/vehicle/${vehicle.id}`), { timeout: 15_000 });

    const detailBadge = page.getByTestId('listing-stock-badge').first();
    await expect(detailBadge).toBeVisible({ timeout: 20_000 });
    await expect(detailBadge).toHaveAttribute('data-stock-status', 'in_stock');
    await expect(page.getByRole('button', { name: 'Chat with Seller' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Book test drive' }).first()).toBeVisible();
  });

  test('sold listing hides book test drive and marks stock sold', async ({ page, request }) => {
    const sold = await ensureSoldVehicleForE2E(request);
    test.skip(!sold, 'No sold vehicle in catalog — need at least one published vehicle to mark sold');

    await page.goto(`/vehicle/${sold!.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('listing-stock-badge').first()).toHaveAttribute('data-stock-status', 'sold', {
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Book test drive' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chat with Seller' })).toBeVisible();
  });

  test('guest chat CTA routes to login', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    const vehicle = published[0];
    await page.goto(`/vehicle/${vehicle.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('[data-testid="listing-stock-badge"]', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Chat with Seller' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
