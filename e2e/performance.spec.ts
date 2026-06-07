import { test, expect } from '@playwright/test';
import { fetchPublishedVehicles } from './helpers/catalog';
import { VEHICLE_SEARCH_INPUT, VEHICLE_SEARCH_INPUT_ANY, waitForVehicleListing } from './helpers/listings';

test.describe('Performance smoke', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('reRideSelectedCity');
    });
  });

  test('home page loads within 15 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('popular-cities-chips')).toBeVisible({ timeout: 60_000 });
    expect(Date.now() - start).toBeLessThan(15_000);
  });

  test('used cars list renders within 20 seconds', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    const start = Date.now();
    await page.goto('/used-cars', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
    expect(Date.now() - start).toBeLessThan(20_000);
  });

  test('search input responds without blocking the UI', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await page.goto('/used-cars', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForVehicleListing(page);
    const search = page.locator(VEHICLE_SEARCH_INPUT_ANY).first();
    test.skip((await search.count()) === 0, 'No search input on used cars page');

    const start = Date.now();
    await search.fill(published[0]?.make ?? 'Maruti');
    expect(Date.now() - start).toBeLessThan(3_000);
  });

  test('vehicle detail page opens within 20 seconds', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    const vehicle = published[0];
    const start = Date.now();
    await page.goto(`/vehicle/${vehicle.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('listing-stock-badge').first()).toBeVisible({ timeout: 20_000 });
    expect(Date.now() - start).toBeLessThan(20_000);
  });
});
