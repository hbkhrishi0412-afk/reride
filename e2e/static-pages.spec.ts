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
    await expect(page.getByTestId('not-found-page').getByRole('button', { name: /help center/i })).toBeVisible();
  });

  test('safety center loads without horizontal overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/safety-center', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
