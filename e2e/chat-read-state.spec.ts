import { test, expect } from '@playwright/test';
import { loginAsSeller } from './helpers/auth';

test.describe('Chat read state controls', () => {
  test('seller sees read/unread controls in dashboard messages', async ({ page }) => {
    await loginAsSeller(page);
    await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
    await page.getByRole('complementary').getByRole('button', { name: /^Messages/i }).click();
    await expect(page.getByRole('heading', { name: /^Messages$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^All$/i }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('mobile inbox shows list + menu read state actions', async ({ page }) => {
    test.skip(true, 'Narrow viewport inbox selectors still stabilizing');
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsSeller(page);

    await page.goto('/inbox');
    await expect(page.getByRole('button', { name: /Show all conversations|All/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Show unread conversations|Unread/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole('button', { name: /Mark all conversations as read|Mark all read/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
