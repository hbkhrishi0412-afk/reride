import { test, expect } from '@playwright/test';
import { VEHICLE_SEARCH_INPUT_ANY } from './helpers/listings';

const API_BASE = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';

test.describe('Security smoke', () => {
  test('admin vehicle export requires authentication', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/vehicles?action=admin-all`);
    expect([401, 403]).toContain(res.status());
    const body = (await res.text()).toLowerCase();
    expect(body).not.toContain('supabase_service_role');
    expect(body).not.toContain('jwt_secret');
    expect(body).not.toMatch(/"password"\s*:\s*"[^"]+"/);
  });

  test('public seller directory omits phone and password fields', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/users?role=seller`);
    expect(res.ok()).toBeTruthy();
    const users = await res.json();
    if (Array.isArray(users) && users.length > 0) {
      for (const user of users) {
        expect(user.mobile).toBeUndefined();
        expect(user.password).toBeUndefined();
      }
    }
  });

  test('radius-search rejects invalid coordinates', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/api/vehicles?action=radius-search&lat=not-a-number&lng=0&radius=5`,
    );
    expect(res.status()).toBe(400);
  });

  test('search input does not inject script tags on used cars', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('reRideSelectedCity');
    });
    await page.goto('/used-cars', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const search = page.locator(VEHICLE_SEARCH_INPUT_ANY).first();
    test.skip((await search.count()) === 0, 'No search input on used cars page');

    const xssPayload = '<script>alert("XSS")</script>';
    await search.fill(xssPayload);
    const content = await page.content();
    expect(content).not.toContain('<script>alert("XSS")</script>');
  });
});
