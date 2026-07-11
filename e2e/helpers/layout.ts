import type { Page } from '@playwright/test';

/** True when document scroll width exceeds viewport (horizontal overflow). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

export async function assertNoHorizontalOverflow(page: Page) {
  const { expect } = await import('@playwright/test');
  await expect.poll(() => hasHorizontalOverflow(page), { timeout: 8_000 }).toBe(false);
}

/** Primary CTA / chat input visible and within viewport bounds. */
export async function assertPrimaryControlInViewport(
  page: Page,
  selector: string,
  minHeight = 36,
): Promise<void> {
  const { expect } = await import('@playwright/test');
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  expect(box.height).toBeGreaterThanOrEqual(minHeight);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
  expect(box.x).toBeGreaterThanOrEqual(-2);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
}

export async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  // Avoid networkidle — SPA keepalives / analytics prevent it from ever settling.
  await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
  const { dismissCookieBanner } = await import('./auth');
  await dismissCookieBanner(page);
}

/** Full audit set (manual / nightly). Prefer AUDIT_VIEWPORTS_CORE in CI. */
export const AUDIT_VIEWPORTS = [
  { name: '320', width: 320, height: 568 },
  { name: '360', width: 360, height: 640 },
  { name: '375', width: 375, height: 667 },
  { name: '390', width: 390, height: 844 },
  { name: '412', width: 412, height: 915 },
  { name: '480', width: 480, height: 854 },
  { name: '768', width: 768, height: 1024 },
  { name: '820', width: 820, height: 1180 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1366', width: 1366, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1536', width: 1536, height: 864 },
  { name: '1728', width: 1728, height: 1117 },
  { name: '1920', width: 1920, height: 1080 },
] as const;

/** Representative breakpoints for CI matrix (covers phone → desktop). */
export const AUDIT_VIEWPORTS_CORE = [
  { name: '320', width: 320, height: 568 },
  { name: '375', width: 375, height: 667 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1920', width: 1920, height: 1080 },
] as const;

export const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;

/** Representative zoom levels for CI (extremes + common). */
export const ZOOM_LEVELS_CORE = [0.67, 1, 1.25, 1.5, 2] as const;
