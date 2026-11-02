/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:3000/"}
 */

import { enforceRememberMePolicyOnBoot } from '../utils/rememberMe';
import { saveRememberedCredentials } from '../utils/rememberedCredentials';

jest.mock('../utils/apiConfig.js', () => ({
  isCapacitorNative: () => false,
}));

describe('remember me boot', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('drops the session when remember-me is off and this is a new visit', async () => {
    localStorage.setItem('reride_remember_me', 'false');
    localStorage.setItem('reRideCurrentUser', '{"email":"a@b.c"}');
    await expect(enforceRememberMePolicyOnBoot()).resolves.toBe(true);
    expect(localStorage.getItem('reRideCurrentUser')).toBeNull();
  });

  it('keeps the session for the same tab', async () => {
    localStorage.setItem('reride_remember_me', 'false');
    localStorage.setItem('reRideCurrentUser', '{"email":"a@b.c"}');
    sessionStorage.setItem('reride_session_alive', '1');
    await expect(enforceRememberMePolicyOnBoot()).resolves.toBe(false);
    expect(localStorage.getItem('reRideCurrentUser')).toBe('{"email":"a@b.c"}');
  });

  it('stores the email and never the password', () => {
    saveRememberedCredentials('customer', 'a@b.c', 's3cret', true);
    expect(localStorage.getItem('rememberedCustomerEmail')).toBe('a@b.c');
    expect(localStorage.getItem('rememberedCustomerPassword')).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain('s3cret');
  });
});
