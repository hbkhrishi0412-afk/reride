import { test, expect, type Page } from '@playwright/test';

/** react-cookie-consent default: name CookieConsent, value "true" when accepted (see node_modules/react-cookie-consent). */
async function seedCookieConsentAccepted(page: Page, baseURL: string | undefined) {
  const origin = baseURL ?? 'http://localhost:5173';
  await page.context().addCookies([
    { name: 'CookieConsent', value: 'true', url: origin.endsWith('/') ? origin : `${origin}/` },
  ]);
}

/** Fallback if cookie was cleared or domain mismatch. */
async function acceptCookiesIfShown(page: Page) {
  const accept = page.locator('#rcc-confirm-button');
  try {
    await accept.waitFor({ state: 'visible', timeout: 2000 });
    await accept.click();
  } catch {
    /* banner not shown */
  }
}

test.describe('Mobile App and PWA Functionality', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.toLowerCase().includes('mobile'), 'Mobile-only spec');
    await seedCookieConsentAccepted(page, testInfo.project.use.baseURL);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await acceptCookiesIfShown(page);
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
    await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Buy")').click({ force: true });
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-search-button"]')).toBeVisible();
  });

  test('should handle mobile menu drawer', async ({ page }) => {
    // Ensure header is visible first.
    await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Buy")').click({ force: true });
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
    await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Buy")').click({ force: true });
    await page.click('[data-testid="mobile-search-button"]');
    await expect(page).toHaveURL(/\/used-cars/);
  });

  test('should open menu drawer from home using bottom-nav menu button', async ({ page }) => {
    await page.locator('[data-testid="mobile-bottom-nav"] button:has-text("Menu")').click({ force: true });
    await expect(page.locator('[data-testid="mobile-drawer"]')).toBeVisible();
  });
});
