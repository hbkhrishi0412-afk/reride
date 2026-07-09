import { test, expect } from '@playwright/test';
import { getViolations, injectAxe } from 'axe-playwright';
import { fetchPublishedVehicles } from './helpers/catalog';

test.describe('Accessibility smoke', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('reRideSelectedCity');
    });
  });

  test('homepage exposes a primary heading', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('popular-cities-chips')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('homepage passes axe WCAG smoke scan', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('popular-cities-chips')).toBeVisible({ timeout: 60_000 });
    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    expect(violations, formatAxeViolations(violations)).toEqual([]);
  });

  test('vehicle detail exposes accessible seller actions', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await page.goto(`/vehicle/${published[0].id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('listing-stock-badge').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Chat with Seller/i }).first()).toBeVisible();
  });

  test('vehicle detail passes axe WCAG smoke scan', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await page.goto(`/vehicle/${published[0].id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('listing-stock-badge').first()).toBeVisible({ timeout: 20_000 });
    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    expect(violations, formatAxeViolations(violations)).toEqual([]);
  });

  test('login form email field has an accessible name', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('button', { name: /^Customer$/i }).click();
    const email = page.locator('#email-address, input[name="email"]').first();
    await expect(email).toBeVisible({ timeout: 30_000 });

    const ariaLabel = await email.getAttribute('aria-label');
    const id = await email.getAttribute('id');
    const hasLabel = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false;
    expect(hasLabel || Boolean(ariaLabel)).toBe(true);
  });

  test('keyboard tab moves focus away from body', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('popular-cities-chips')).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? 'BODY');
    expect(tag).not.toBe('BODY');
  });

  test('vehicle detail images declare alt text', async ({ page, request }) => {
    const published = await fetchPublishedVehicles(request);
    test.skip(published.length === 0, 'No published vehicles in catalog');

    await page.goto(`/vehicle/${published[0].id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('listing-stock-badge').first()).toBeVisible({ timeout: 20_000 });
    const img = page.locator('[data-testid="vehicle-image"], img').first();
    await expect(img).toBeVisible({ timeout: 20_000 });
    const alt = await img.getAttribute('alt');
    expect(alt).not.toBeNull();
  });
});

function formatAxeViolations(violations: Awaited<ReturnType<typeof getViolations>>): string {
  return violations
    .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
    .join('\n\n');
}
