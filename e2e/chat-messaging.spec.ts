import { test, expect } from '@playwright/test';
import { fetchPublishedVehicles } from './helpers/catalog';

test.describe('Chat from vehicle detail', () => {
  test('guest chat CTA routes to login from published listing', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    const vehicle = published[0];
    await page.goto(`/vehicle/${vehicle.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('listing-stock-badge').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Chat with Seller/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
