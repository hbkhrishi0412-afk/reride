import { test, expect } from '@playwright/test';
import {
  openLoginPortal,
  loginAsAdmin,
  loginAsSeller,
  loginAsCustomer,
  prepareE2EPage,
  waitForAppMounted,
  waitForLoginPortal,
} from './helpers/auth';

test.describe('User Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('should display login portal correctly', async ({ page, baseURL }) => {
    await openLoginPortal(page, baseURL);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Customer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Seller$/i })).toBeVisible();
  });

  test('should login as admin successfully', async ({ page, baseURL }) => {
    await loginAsAdmin(page, baseURL);
    await expect(page).toHaveURL((url) => {
      const path = url.pathname.replace(/\/$/, '') || '/';
      return path === '/admin' || (path.startsWith('/admin/') && !path.includes('/login'));
    }, { timeout: 30_000 });
    await expect(page.getByText('Test Admin').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should login as seller successfully', async ({ page, baseURL }) => {
    await loginAsSeller(page, baseURL);
    await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText('Test Seller').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should login as customer successfully', async ({ page, baseURL }) => {
    await loginAsCustomer(page, baseURL);
    await expect(page.getByText('Test Customer').first()).toBeVisible({ timeout: 20_000 });
  });

  test('should handle invalid login credentials', async ({ page, baseURL }) => {
    await prepareE2EPage(page, baseURL);
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForAppMounted(page);
    await page.locator('#email-address').fill('invalid@test.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('alert').or(page.locator('p.text-red-500'))).toBeVisible({
      timeout: 15_000,
    });
  });

  test('should logout successfully', async ({ page, baseURL }) => {
    await loginAsAdmin(page, baseURL);
    await page.getByRole('button', { name: /log out/i }).first().click();
    await page.waitForFunction(() => !localStorage.getItem('reRideCurrentUser'), undefined, {
      timeout: 15_000,
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await waitForLoginPortal(page);
    await expect(page.getByRole('button', { name: /^Customer$/i })).toBeVisible();
  });
});
