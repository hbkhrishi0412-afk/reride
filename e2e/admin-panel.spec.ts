import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await loginAsAdmin(page, baseURL);
  });

  test('loads admin panel after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.getByText('Test Admin').first()).toBeVisible({ timeout: 20_000 });
  });

  test('shows admin navigation sections', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Users|Vehicles|Settings|Analytics/i }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('mobile viewport can log out from admin header', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByTestId('admin-mobile-logout')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('admin-mobile-logout').click();
    await page.waitForFunction(() => !localStorage.getItem('reRideCurrentUser'), undefined, {
      timeout: 15_000,
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^Customer$/i })).toBeVisible({ timeout: 30_000 });
  });
});
