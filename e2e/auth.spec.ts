import { test, expect } from '@playwright/test';
import {
  prepareE2EPage,
  openLoginPortal,
  loginViaPortal,
  loginAsAdmin,
  loginAsSeller,
  loginAsCustomer,
} from './helpers/auth';

test.describe('User Authentication Flow', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await prepareE2EPage(page, baseURL);
  });

  test('should display login portal correctly', async ({ page }) => {
    await openLoginPortal(page);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /^Customer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Seller$/i })).toBeVisible();
  });

  test('should login as admin successfully', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.getByText('Test Admin').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should login as seller successfully', async ({ page }) => {
    await loginAsSeller(page);
    await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText('Test Seller').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should login as customer successfully', async ({ page }) => {
    await loginAsCustomer(page);
    await expect(page.getByText('Test Customer').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('#email-address').fill('invalid@test.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('alert').or(page.locator('p.text-red-500'))).toBeVisible({
      timeout: 15_000,
    });
  });

  test('should logout successfully', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /log out/i }).first().click();
    await page.waitForFunction(() => !localStorage.getItem('reRideCurrentUser'), { timeout: 15_000 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^Customer$/i })).toBeVisible({ timeout: 15_000 });
  });
});
