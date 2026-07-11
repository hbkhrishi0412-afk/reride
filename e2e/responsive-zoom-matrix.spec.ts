import { test, expect } from '@playwright/test';
import { prepareE2EPage, dismissCookieBanner } from './helpers/auth';
import {
  AUDIT_VIEWPORTS_CORE,
  ZOOM_LEVELS_CORE,
  assertNoHorizontalOverflow,
  gotoAndSettle,
} from './helpers/layout';

const KEY_PAGES = [
  { path: '/', name: 'home', ready: '[data-testid="popular-cities-chips"], #search-bar' },
  { path: '/used-cars', name: 'used-cars', ready: '[data-testid="vehicle-card"], #filters' },
  { path: '/help', name: 'help', ready: 'main, [role="main"]' },
  { path: '/login', name: 'login', ready: '[data-testid="login-portal"], button:has-text("Customer")' },
] as const;

test.describe('Responsive + zoom matrix', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.toLowerCase().includes('mobile safari'), 'Desktop viewport matrix');
    await prepareE2EPage(page, testInfo.project.use.baseURL);
  });

  for (const vp of AUDIT_VIEWPORTS_CORE) {
    test(`no horizontal overflow on key pages at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const entry of KEY_PAGES) {
        await gotoAndSettle(page, entry.path);
        await page.locator(entry.ready).first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  for (const zoom of ZOOM_LEVELS_CORE) {
    test(`home and used-cars usable at ${Math.round(zoom * 100)}% zoom (1280px)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });

      for (const entry of [
        { path: '/', ready: '#search-bar, [data-testid="popular-cities-chips"]' },
        { path: '/used-cars', ready: '#filters, [data-testid="vehicle-card"]' },
      ] as const) {
        await gotoAndSettle(page, entry.path);
        await page.evaluate((z) => {
          document.documentElement.style.zoom = String(z);
        }, zoom);

        const ready = page.locator(entry.ready).first();
        await expect(ready).toBeVisible({ timeout: 20_000 });

        const box = await ready.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          // Usable at zoom: control has size and can be brought into the layout viewport.
          expect(box.width).toBeGreaterThan(8);
          expect(box.height).toBeGreaterThan(8);
          const vp = page.viewportSize();
          expect(vp).not.toBeNull();
          if (vp) {
            expect(box.x + box.width).toBeGreaterThan(0);
            expect(box.x).toBeLessThan(vp.width);
          }
        }

        await assertNoHorizontalOverflow(page);

        await page.evaluate(() => {
          document.documentElement.style.zoom = '1';
        });
      }
    });
  }

  test('mobile bottom nav visible and tappable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoAndSettle(page, '/');
    const nav = page.getByTestId('mobile-bottom-nav');
    await expect(nav).toBeVisible({ timeout: 20_000 });
    const buyTab = nav.getByRole('button', { name: /buy/i }).first();
    const box = await buyTab.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await assertNoHorizontalOverflow(page);
  });

  test('skip link targets exist in DOM', async ({ page }) => {
    await gotoAndSettle(page, '/');
    await expect(page.locator('#main-content')).toHaveCount(1);
    await expect(page.locator('#search-bar')).toHaveCount(1);
    await gotoAndSettle(page, '/used-cars');
    await expect(page.locator('#filters')).toHaveCount(1);
  });
});

test.describe('Responsive + zoom matrix — mobile project', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.toLowerCase().includes('mobile chrome'), 'Mobile Chrome only');
    await prepareE2EPage(page, testInfo.project.use.baseURL);
    await dismissCookieBanner(page);
  });

  test('vehicle detail primary actions visible on Mobile Chrome', async ({ page, request }) => {
    const { fetchPublishedVehicles } = await import('./helpers/catalog');
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles');

    await page.goto(`/vehicle/${published[0].id}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);

    const cta = page.locator('[data-testid="mobile-vehicle-detail-cta"], button:has-text("Contact")').first();
    await expect(cta).toBeVisible({ timeout: 25_000 });
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const vp = page.viewportSize();
      expect(vp).not.toBeNull();
      if (vp) {
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 2);
      }
    }
    await assertNoHorizontalOverflow(page);
  });
});
