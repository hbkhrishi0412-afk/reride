import { test, expect } from '@playwright/test';

/**
 * Capacitor WebView shell smoke tests (Playwright proxy).
 * Real device E2E requires Android Emulator + Appium or manual QA; these verify
 * hash routing, mobile chrome, and behaviors the native app shares with the WebView bundle.
 */
test.describe('Capacitor shell (WebView proxy)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.toLowerCase().includes('mobile'), 'Mobile viewport only');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () =>
          'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 ReRideCapacitor/1.0',
      });
    });
  });

  test('hash routes resolve for deep links used by push notifications', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/#\/login/);

    await page.goto('/#/used-cars');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/#\/used-cars/);
    await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeVisible();
  });

  test('mobile shell hides desktop header on auth screens', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toHaveCount(0);
  });

  test('buy tab loads vehicle results region', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Buy")').click({ force: true });
    await expect(page.locator('[data-testid="vehicle-results"]')).toBeVisible({ timeout: 30_000 });
  });
});
