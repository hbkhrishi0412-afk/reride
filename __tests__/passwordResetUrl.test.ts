/**
 * @jest-environment jsdom
 */
import { getPasswordResetTokenFromBrowser, parseRecoverySignalsFromBrowser } from '../utils/passwordResetUrl';

describe('passwordResetUrl', () => {
  it('reads token from location.search', () => {
    window.history.pushState({}, '', '/forgot-password?token=abc123');
    expect(getPasswordResetTokenFromBrowser()).toBe('abc123');
    expect(parseRecoverySignalsFromBrowser().hasUsersTableToken).toBe(true);
  });

  it('reads token from hash query (HashRouter / Capacitor)', () => {
    window.history.pushState({}, '', '/#/forgot-password?token=hash-jwt');
    expect(getPasswordResetTokenFromBrowser()).toBe('hash-jwt');
    expect(parseRecoverySignalsFromBrowser().hasUsersTableToken).toBe(true);
  });
});
