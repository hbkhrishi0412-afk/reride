import { test, expect, type Page } from '@playwright/test';
import { prepareE2EPage, dismissCookieBanner, loginAsAdmin } from './helpers/auth';

/** True when document scroll width exceeds viewport (horizontal overflow). */
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  await expect.poll(() => hasHorizontalOverflow(page), { timeout: 10_000 }).toBe(false);
}

async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await dismissCookieBanner(page);
}

const MOBILE_VIEWPORTS = [
  { name: 'phone-320', width: 320, height: 568 },
  { name: 'phone-375', width: 375, height: 667 },
  { name: 'phone-414', width: 414, height: 896 },
] as const;

const TABLET_VIEWPORTS = [
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-900', width: 900, height: 800 },
] as const;

test.describe('Responsive layout — static pages', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.toLowerCase().includes('mobile safari'), 'Desktop viewport tests');
    await prepareE2EPage(page, testInfo.project.use.baseURL);
  });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`no horizontal overflow on key pages at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const paths = ['/help', '/about-us', '/safety-center', '/this-page-does-not-exist-reride'];
      for (const path of paths) {
        await gotoAndSettle(page, path);
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  test('help center has touch-friendly search at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoAndSettle(page, '/help');
    const search = page.getByPlaceholder(/search help/i);
    await expect(search).toBeVisible({ timeout: 15_000 });
    const box = await search.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  });

  test('about page stats stack on narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoAndSettle(page, '/about-us');
    await expect(page.getByRole('heading', { name: /about|reride/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('Responsive layout — tablet header', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.toLowerCase().includes('mobile'), 'Desktop/tablet viewport tests');
    await prepareE2EPage(page, testInfo.project.use.baseURL);
  });

  for (const vp of TABLET_VIEWPORTS) {
    test(`shows hamburger menu below lg at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/');
      const menuButton = page.getByRole('button', { name: /menu/i });
      await expect(menuButton).toBeVisible({ timeout: 15_000 });
    });
  }

  test('desktop nav visible at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, '/');
    await expect(page.getByRole('navigation').getByRole('button', { name: /dealers/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('dealers page uses compact layout below lg at 900px', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await gotoAndSettle(page, '/dealers');
    await expect(page.locator('.mdp-root')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.dp-root')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });

  test('dealers page uses desktop split layout at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, '/dealers');
    await expect(page.locator('.dp-root')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.mdp-root')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });

  test('used cars shows sidebar filters at 900px tablet', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await gotoAndSettle(page, '/used-cars');
    await expect(page.locator('aside.filters')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /open filters/i })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('Responsive layout — admin queues', () => {
  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name.toLowerCase().includes('mobile safari'), 'Admin responsive tests');
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAsAdmin(page, baseURL);
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
  });

  test('assistance queue shows mobile cards at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const jumpSelect = page.locator('#admin-panel-view');
    await expect(jumpSelect).toBeVisible({ timeout: 20_000 });
    await jumpSelect.selectOption('assistanceQueue');

    await expect(page.getByRole('heading', { name: /Assistance Queue/i })).toBeVisible({
      timeout: 20_000,
    });

    const mobileCards = page.getByTestId('admin-mobile-cards');
    const emptyState = page.getByText(/No open assistance requests/i);
    await expect(mobileCards.or(emptyState)).toBeVisible({ timeout: 15_000 });

    if (await mobileCards.isVisible()) {
      await expect(page.locator('table').first()).not.toBeVisible();
    }

    await assertNoHorizontalOverflow(page);
  });

  test('rc queue shows mobile cards at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const jumpSelect = page.locator('#admin-panel-view');
    await expect(jumpSelect).toBeVisible({ timeout: 20_000 });
    await jumpSelect.selectOption('rcQueue');

    await expect(page.getByRole('heading', { name: /RC Transfer Queue/i })).toBeVisible({
      timeout: 20_000,
    });

    const mobileCards = page.getByTestId('admin-mobile-cards');
    const emptyState = page.getByText(/No deals in RC queue/i);
    await expect(mobileCards.or(emptyState)).toBeVisible({ timeout: 15_000 });
    await assertNoHorizontalOverflow(page);
  });

  test('user directory shows mobile cards at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const jumpSelect = page.locator('#admin-panel-view');
    await expect(jumpSelect).toBeVisible({ timeout: 20_000 });
    await jumpSelect.selectOption('users');

    await expect(page.getByText('Directory').first()).toBeVisible({ timeout: 20_000 });

    const mobileCards = page.getByTestId('admin-mobile-cards');
    const emptyState = page.getByText(/No users match this filter or search/i);
    await expect(mobileCards.or(emptyState)).toBeVisible({ timeout: 15_000 });

    if (await mobileCards.isVisible()) {
      await expect(page.locator('table').first()).not.toBeVisible();
    }

    await assertNoHorizontalOverflow(page);
  });

  test('listings shows mobile cards at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const jumpSelect = page.locator('#admin-panel-view');
    await expect(jumpSelect).toBeVisible({ timeout: 20_000 });
    await jumpSelect.selectOption('listings');

    await expect(page.getByText('All listings').first()).toBeVisible({ timeout: 20_000 });

    const mobileCards = page.getByTestId('admin-mobile-cards');
    const emptyState = page.getByText(/No listings to show|No listings match/i);
    await expect(mobileCards.or(emptyState)).toBeVisible({ timeout: 15_000 });

    if (await mobileCards.isVisible()) {
      await expect(page.locator('table').first()).not.toBeVisible();
    }

    await assertNoHorizontalOverflow(page);
  });

  test('moderation queue shows mobile cards at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const jumpSelect = page.locator('#admin-panel-view');
    await expect(jumpSelect).toBeVisible({ timeout: 20_000 });
    await jumpSelect.selectOption('moderation');

    await expect(page.getByRole('heading', { name: /Moderation queue/i })).toBeVisible({
      timeout: 20_000,
    });

    const mobileCards = page.getByTestId('admin-mobile-cards');
    const emptyState = page.getByRole('heading', { name: 'All clear' });
    await expect(mobileCards.or(emptyState)).toBeVisible({ timeout: 15_000 });

    if (await mobileCards.isVisible()) {
      await expect(page.locator('table').first()).not.toBeVisible();
    }

    await assertNoHorizontalOverflow(page);
  });
});
