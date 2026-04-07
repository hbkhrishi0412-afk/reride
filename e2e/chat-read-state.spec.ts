import { test, expect } from '@playwright/test';

async function loginAsSeller(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  const rolePicker = page.locator('select#account-type, select#mobile-account-type, select[name="account-type"]').first();

  for (const password of ['password123', 'password']) {
    if (await rolePicker.count()) {
      await rolePicker.selectOption('seller');
    }
    await page.locator('input[type="email"]').first().fill('seller@test.com');
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(1200);
    const stillOnLogin = await page.locator('input[type="email"]').first().isVisible().catch(() => false);
    if (!stillOnLogin) return;
  }

  await expect(page.locator('input[type="email"]').first()).toBeHidden({ timeout: 10000 });
}

test.describe('Chat read state controls', () => {
  test('seller sees read/unread controls in dashboard messages', async ({ page }) => {
    await loginAsSeller(page);
    await page.goto('/seller/dashboard');
    await page.getByRole('button', { name: /Messages/i }).first().click();
    await expect(
      page.getByRole('button', { name: /Mark all conversations as read|Mark all read/i }).first(),
    ).toBeVisible({ timeout: 20000 });
  });

  test('mobile inbox shows list + menu read state actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsSeller(page);

    await page.goto('/inbox');
    await expect(page.getByRole('button', { name: /Show all conversations|All/i }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Show unread conversations|Unread/i }).first()).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole('button', { name: /Show read conversations|Read/i }).first(),
    ).toBeVisible({ timeout: 20000 });
  });
});
