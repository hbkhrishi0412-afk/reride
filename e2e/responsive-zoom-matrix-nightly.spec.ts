import { test, expect } from '@playwright/test';
import { prepareE2EPage } from './helpers/auth';
import {
  AUDIT_VIEWPORTS,
  ZOOM_LEVELS,
  assertNoHorizontalOverflow,
  gotoAndSettle,
} from './helpers/layout';

/**
 * Full responsive + zoom audit matrix (nightly / pre-release).
 * CI uses responsive-zoom-matrix.spec.ts with a smaller core set.
 */
const KEY_PAGES = [
  { path: '/', name: 'home', ready: '[data-testid="popular-cities-chips"], #search-bar' },
  { path: '/used-cars', name: 'used-cars', ready: '[data-testid="vehicle-card"], #filters' },
  { path: '/help', name: 'help', ready: 'main, [role="main"]' },
  { path: '/about-us', name: 'about', ready: 'h1' },
  { path: '/login', name: 'login', ready: '[data-testid="login-portal"], button:has-text("Customer")' },
] as const;

test.describe('Responsive + zoom matrix @nightly', () => {
  test.describe.configure({ timeout: 300_000, mode: 'serial' });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.toLowerCase().includes('mobile safari'), 'Desktop viewport matrix');
    await prepareE2EPage(page, testInfo.project.use.baseURL);
  });

  for (const vp of AUDIT_VIEWPORTS) {
    test(`no horizontal overflow on key pages at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const entry of KEY_PAGES) {
        await gotoAndSettle(page, entry.path);
        await page.locator(entry.ready).first().waitFor({ state: 'visible', timeout: 25_000 }).catch(() => undefined);
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  for (const zoom of ZOOM_LEVELS) {
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
        await expect(ready).toBeVisible({ timeout: 25_000 });

        const box = await ready.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThan(8);
          expect(box.height).toBeGreaterThan(8);
        }

        await assertNoHorizontalOverflow(page);

        await page.evaluate(() => {
          document.documentElement.style.zoom = '1';
        });
      }
    });
  }
});
