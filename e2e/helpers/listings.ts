import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const VEHICLE_SEARCH_INPUT = 'input[aria-label="Search vehicles"]';
export const VEHICLE_SEARCH_INPUT_ANY =
  'input[aria-label="Search vehicles"], input[placeholder*="brand" i], input#ai-search';

/** Wait for used-cars listing cards, retrying once if the catalog fetch failed. */
export async function waitForVehicleListing(page: Page): Promise<void> {
  const card = page.locator('[data-testid="vehicle-card"]').first();
  try {
    await expect(card).toBeVisible({ timeout: 45_000 });
    return;
  } catch {
    const retry = page.getByRole('button', { name: /^Retry$/i });
    if (await retry.isVisible().catch(() => false)) {
      await retry.click();
    }
    await expect(card).toBeVisible({ timeout: 45_000 });
  }
}
