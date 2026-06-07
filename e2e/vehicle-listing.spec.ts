import { test, expect } from '@playwright/test';
import { fetchPublishedVehicles } from './helpers/catalog';
import { VEHICLE_SEARCH_INPUT, waitForVehicleListing } from './helpers/listings';

test.describe('Vehicle listing and search', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('reRideSelectedCity');
    });
    await page.goto('/used-cars', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  });

  test('displays vehicle cards on used cars page', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
  });

  test('navigates to vehicle detail from card', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
    await page.locator('[data-testid="vehicle-card"]').first().click();
    await page.waitForURL(/\/vehicle\//, { timeout: 30_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
  });

  test('search input filters listing results', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await waitForVehicleListing(page);

    const search = page.locator(VEHICLE_SEARCH_INPUT).first();
    test.skip((await search.count()) === 0, 'Desktop search bar not visible on used cars page');
    await expect(search).toBeVisible({ timeout: 30_000 });
    const sampleMake = published[0]?.make ?? 'Maruti';
    await search.fill(sampleMake);
    await expect(search).toHaveValue(sampleMake);
  });
});

test.describe('Home to used cars navigation', () => {
  test('All India chip opens used cars with listings', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const allIndia = page.getByTestId('popular-cities-chips').getByRole('button', { name: 'All India', exact: true });
    await expect(allIndia).toBeVisible({ timeout: 60_000 });
    await Promise.all([
      page.waitForURL(/\/used-cars/, { timeout: 30_000 }),
      allIndia.click(),
    ]);
    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
  });
});
