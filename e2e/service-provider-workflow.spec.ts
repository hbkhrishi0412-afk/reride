import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function deleteTestProvider(email: string) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: row } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (!row) return;
  await supabase.from('service_providers').delete().eq('id', row.id);
  await supabase.from('users').delete().eq('id', row.id);
  try {
    await supabase.auth.admin.deleteUser(row.id);
  } catch {
    /* ignore */
  }
}

test.describe('Car services (provider) smoke', () => {
  test('car services page loads', async ({ page }) => {
    await page.goto('/car-services', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
  });

  test('service provider login route is reachable', async ({ page }) => {
    await page.goto('/car-services/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('input[type="email"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('#car-service-password, input[name="password"]').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  // Regression: registering a service provider must land on the dashboard, not bounce back
  // to the login page. This previously failed because /api/service-providers/register wrote
  // the public.users row with `.insert()`, which always lost a race against the
  // `on_auth_user_created` DB trigger (it inserts its own row for the new auth user first) —
  // the insert silently failed, leaving the account without a role/password and permanently
  // unable to log in.
  test('service provider signup lands on the dashboard (not bounced back to login)', async ({ page }) => {
    const email = `e2e-sp-${Date.now()}@example.com`;
    const password = 'E2eTest#2026';
    try {
      await page.goto('/car-services/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.getByText('Create account', { exact: true }).click();

      await page.locator('form input[type="text"]').nth(0).fill('E2E Provider');
      await page.locator('form input[type="tel"]').fill('9999999999');
      await page.locator('form input[type="text"]').nth(1).fill('Mumbai');
      await page.locator('input[type="email"]').fill(email);
      await page.locator('#car-service-password').fill(password);
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL(/\/car-services\/dashboard/, { timeout: 20_000 });
      await expect(page.getByText('Service provider sign-in required')).toHaveCount(0);
    } finally {
      await deleteTestProvider(email);
    }
  });
});
