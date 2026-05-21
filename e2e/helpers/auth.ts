import type { Page } from '@playwright/test';
import { E2E_TEST_USERS } from '../fixtures/test-users';

export type E2ERole = 'admin' | 'seller' | 'customer';

/** Persist test users + dismiss cookie banner before navigation. */
export async function prepareE2EPage(page: Page, baseURL = 'http://localhost:5173') {
  const origin = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  await page.context().addCookies([
    {
      name: 'CookieConsent',
      value: 'true',
      url: `${origin}/`,
    },
  ]);
  await page.addInitScript((users) => {
    localStorage.setItem('reRideUsers', JSON.stringify(users));
    localStorage.setItem('reRideUsers_prod', JSON.stringify(users));
    localStorage.removeItem('reRideCurrentUser');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('accessToken');
    }
  }, E2E_TEST_USERS);
}

export async function dismissCookieBanner(page: Page) {
  const accept = page.locator('#rcc-confirm-button');
  try {
    await accept.waitFor({ state: 'visible', timeout: 2000 });
    await accept.click();
  } catch {
    /* not shown */
  }
}

async function submitCredentialForm(page: Page, email: string, password: string) {
  await page.locator('#email-address, input[name="email"]').first().fill(email);
  await page.locator('#password, input[name="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
}

/** Login portal → role tile → email/password form. */
export async function loginViaPortal(page: Page, role: 'seller' | 'customer', baseURL?: string) {
  await prepareE2EPage(page, baseURL);
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCookieBanner(page);
  const roleLabel = role === 'seller' ? /^Seller$/i : /^Customer$/i;
  const roleButton = page.getByRole('button', { name: roleLabel }).first();
  await roleButton.waitFor({ state: 'visible', timeout: 30_000 });
  await roleButton.click();
  await page.locator('#email-address, input[name="email"]').first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  const user = E2E_TEST_USERS.find((u) => u.role === role)!;
  await submitCredentialForm(page, user.email, user.password);
}

export async function loginAsAdmin(page: Page, baseURL?: string) {
  await prepareE2EPage(page, baseURL);
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCookieBanner(page);
  const user = E2E_TEST_USERS.find((u) => u.role === 'admin')!;
  await submitCredentialForm(page, user.email, user.password);
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
}

export async function loginAsSeller(page: Page, baseURL?: string) {
  await loginViaPortal(page, 'seller', baseURL);
  await page.waitForURL(/\/seller\/dashboard/, { timeout: 30_000 });
}

export async function loginAsCustomer(page: Page, baseURL?: string) {
  await loginViaPortal(page, 'customer', baseURL);
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem('reRideCurrentUser');
      return raw != null && raw.includes('customer@test.com');
    },
    { timeout: 30_000 },
  );
}

/** Header Login → portal (legacy specs). */
export async function openLoginPortal(page: Page, baseURL?: string) {
  await prepareE2EPage(page, baseURL);
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCookieBanner(page);
}
