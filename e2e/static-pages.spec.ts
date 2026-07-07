import { test, expect } from '@playwright/test';

test.describe('Static pages', () => {
  test('help center loads and search filters FAQs', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading', { name: /help center/i })).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder(/search help/i).fill('RC transfer');
    await expect(page.getByText(/track RC transfer|RC transfer/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('404 page offers browse and help links', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-reride', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await expect(page.getByTestId('not-found-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /browse vehicles/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /help center/i })).toBeVisible();
  });
});
