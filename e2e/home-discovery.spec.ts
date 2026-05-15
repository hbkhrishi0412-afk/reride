import { test, expect } from '@playwright/test';
import { fetchPublishedVehicles, fetchSoldVehicle } from './helpers/catalog';

test.describe('Home discovery — geo & city chips', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.removeItem('reRide_homeGeoBannerDismissed');
      localStorage.removeItem('reRideSelectedCity');
      localStorage.removeItem('reRideUserLocation');
    });
    await page.goto('/');
    await expect(page.getByTestId('popular-cities-chips')).toBeVisible({ timeout: 60_000 });
  });

  test('shows popular city chips and location banner on desktop home', async ({ page }) => {
    await expect(
      page.getByTestId('popular-cities-chips').getByRole('button', { name: 'All India', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('home-location-banner')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Choose how to browse cars' }),
    ).toContainText('Browse used cars across India');
  });

  test('Browse all India from banner navigates to used cars without locking a city', async ({ page }) => {
    await page.getByTestId('home-location-banner').getByRole('button', { name: 'Browse all India' }).click();
    await expect(page).toHaveURL(/\/used-cars\/?$/);
    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
  });

  test('selecting a popular city chip filters the used cars list', async ({ page }) => {
    const mumbaiChip = page
      .getByTestId('popular-cities-chips')
      .getByRole('button', { name: /^Mumbai/i });
    await mumbaiChip.click();
    await expect(page).toHaveURL(/\/used-cars/);
    const selectedCity = await page.evaluate(() => localStorage.getItem('reRideSelectedCity'));
    expect(selectedCity?.toLowerCase()).toContain('mumbai');
  });

  test('Use my location grants geo and navigates to used cars', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 19.076, longitude: 72.8777 });
    await page.getByTestId('home-location-banner').getByRole('button', { name: 'Use my location' }).click();
    await expect(page).toHaveURL(/\/used-cars/, { timeout: 15_000 });
    await expect(page.getByTestId('home-location-banner')).toBeHidden();
  });
});

test.describe('Vehicle detail — stock & contact CTAs', () => {
  test('published listing shows in-stock badge and seller actions', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    const vehicle = published[0];
    await page.goto(`/vehicle/${vehicle.id}`);
    await expect(page).toHaveURL(new RegExp(`/vehicle/${vehicle.id}`), { timeout: 15_000 });

    const detailBadge = page.getByTestId('listing-stock-badge').first();
    await expect(detailBadge).toHaveAttribute('data-stock-status', 'in_stock');
    await expect(page.getByRole('button', { name: 'Chat with Seller' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Book test drive' }).first()).toBeVisible();
  });

  test('sold listing hides book test drive and marks stock sold', async ({ page, request }) => {
    const sold = await fetchSoldVehicle(request);
    test.skip(!sold, 'No sold vehicle in catalog — seed one in Supabase to exercise this path');

    await page.goto(`/vehicle/${sold!.id}`);
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
    await page.goto(`/vehicle/${vehicle.id}`);
    await page.waitForSelector('[data-testid="listing-stock-badge"]', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Chat with Seller' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
