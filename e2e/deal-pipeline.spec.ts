import { test, expect } from '@playwright/test';
import { loginAsCustomer, loginAsSeller, prepareE2EPage } from './helpers/auth';
import { fetchPublishedVehicles } from './helpers/catalog';

test.describe('Deal pipeline (buyer)', () => {
  test('logged-in customer can start a tracked deal from vehicle detail', async ({ page, request, baseURL }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await prepareE2EPage(page, baseURL);
    await loginAsCustomer(page, baseURL);

    await page.goto('/used-cars', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('[data-testid="vehicle-card"]').first()).toBeVisible({ timeout: 60_000 });
    await page.locator('[data-testid="vehicle-card"]').first().click();
    await page.waitForURL(/\/vehicle\//, { timeout: 30_000 });

    const dealCta = page.getByTestId('start-tracked-deal');
    await expect(dealCta).toBeVisible({ timeout: 20_000 });
    await dealCta.click();

    await expect(page.getByRole('button', { name: /open deal room/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/awaiting accept/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Deal pipeline (seller)', () => {
  test('seller dashboard shows hot leads entry point', async ({ page, baseURL }) => {
    await loginAsSeller(page, baseURL);
    await expect(page.getByText(/hot leads|active deal/i).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Deal pipeline (API)', () => {
  test('advance-stage rejects unauthenticated requests', async ({ request }) => {
    const apiBase = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001';
    const response = await request.post(`${apiBase}/api/deals?action=advance-stage`, {
      data: { leadId: 'RR-LD-001', stage: 'deal_completed' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('complaints API is reachable in dev', async ({ request }) => {
    const apiBase = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001';
    const response = await request.get(`${apiBase}/api/complaints?action=list`);
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
