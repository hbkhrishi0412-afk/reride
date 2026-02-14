import { test, expect } from '@playwright/test';

test.describe('Mobile App and PWA Functionality', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.toLowerCase().includes('mobile'), 'Mobile-only spec');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display mobile bottom navigation on mobile viewport', async ({ page }) => {
    await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Home")')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Buy")')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Sell")')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Messages")')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Menu")')).toBeVisible();
  });

  test('should navigate to buy view and show mobile header controls', async ({ page }) => {
    await page.click('[data-testid="mobile-bottom-nav"] button:has-text("Buy")');
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-search-button"]')).toBeVisible();
  });

  test('should handle mobile menu drawer', async ({ page }) => {
    // Ensure header is visible first.
    await page.click('[data-testid="mobile-bottom-nav"] button:has-text("Buy")');
    await page.click('[data-testid="mobile-menu-button"]');

    const drawer = page.locator('[data-testid="mobile-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Buy Car' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Sell Car' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Login' })).toBeVisible();

    await page.click('[data-testid="mobile-drawer-close"]');
    await expect(page.locator('[data-testid="mobile-drawer"]')).not.toBeVisible();
  });

  test('should open search from mobile header', async ({ page }) => {
    await page.click('[data-testid="mobile-bottom-nav"] button:has-text("Buy")');
    await page.click('[data-testid="mobile-search-button"]');
    await expect(page).toHaveURL(/\/used-cars/);
  });

  test('should open menu drawer from home using bottom-nav menu button', async ({ page }) => {
    await page.click('[data-testid="mobile-bottom-nav"] button:has-text("Menu")');
    await expect(page.locator('[data-testid="mobile-drawer"]')).toBeVisible();
  });
});
