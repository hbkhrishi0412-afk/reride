import { expect, type Page } from '@playwright/test';
import { loginAsSeller } from './auth';

const SELLER_EMAIL = 'seller@test.com';
const API_BASE = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';

async function freeSellerListingSlots(page: Page) {
  const vehicles = await page.evaluate(
    async ({ apiBase, sellerEmail }) => {
      const listRes = await fetch(`${apiBase}/api/vehicles`);
      if (!listRes.ok) return [] as Record<string, unknown>[];
      const list = await listRes.json();
      return (Array.isArray(list) ? list : (list.vehicles ?? [])).filter(
        (v: { sellerEmail?: string; status?: string }) =>
          String(v.sellerEmail ?? '').toLowerCase() === sellerEmail && v.status === 'published',
      );
    },
    { apiBase: API_BASE, sellerEmail: SELLER_EMAIL },
  );

  for (const vehicle of vehicles) {
    await page.request.post(`${API_BASE}/api/vehicles?action=sold`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        vehicleId: vehicle.id,
        id: vehicle.id,
        databaseId: vehicle.databaseId,
        sellerEmail: vehicle.sellerEmail,
      },
    });
  }
}

/** Free a listing slot so the seller dashboard enables "Add Vehicle". */
export async function ensureSellerCanAddListing(page: Page, baseURL?: string) {
  await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
  await expect(page.getByText('Test Seller').first()).toBeVisible({ timeout: 30_000 });

  const addButton = page.getByTestId('seller-add-vehicle-nav');
  await expect(addButton).toBeVisible({ timeout: 30_000 });

  if (await addButton.isEnabled().catch(() => false)) {
    return;
  }

  await freeSellerListingSlots(page);
  await loginAsSeller(page, baseURL);

  await expect(page).toHaveURL(/\/seller\/dashboard/, { timeout: 30_000 });
  await expect(page.getByText('Test Seller').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('seller-add-vehicle-nav')).toBeEnabled({ timeout: 30_000 });
}
