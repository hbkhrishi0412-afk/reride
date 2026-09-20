jest.mock('../utils/apiConfig', () => ({
  isCapacitorNative: jest.fn(() => false),
}));

import { View } from '../types';
import {
  dealIdFromSearch,
  getAppPathFromRouter,
  pathToView,
  resolveViewFromPathAndState,
  sanitizePostLoginPath,
} from '../utils/appNavigation';
import { computeMobileUiState } from '../hooks/useIsMobileApp';
import { APP_DESKTOP_MEDIA_QUERY, APP_DESKTOP_MIN_WIDTH } from '../hooks/useIsLgUp';

describe('app navigation regressions', () => {
  it('keeps paths authoritative over stale back-stack state', () => {
    const stale = { view: View.DETAIL, previousView: View.HOME, timestamp: Date.now() };
    expect(resolveViewFromPathAndState('/used-cars', stale)).toBe(View.USED_CARS);
    expect(resolveViewFromPathAndState('/vehicle/42', { ...stale, view: View.HOME })).toBe(View.DETAIL);
  });

  it('supports browser and hash-router vehicle deep links', () => {
    expect(pathToView('/vehicle/42')).toBe(View.DETAIL);
    expect(getAppPathFromRouter({ pathname: '/', hash: '#/vehicle/42?source=share' })).toBe('/vehicle/42');
  });

  it('parses canonical deal links and safe post-login restoration', () => {
    expect(dealIdFromSearch('?deal=lead-123')).toBe('lead-123');
    expect(pathToView('/customer/dashboard')).toBe(View.BUYER_DASHBOARD);
    expect(sanitizePostLoginPath('/customer/dashboard?deal=lead-123')).toBe(
      '/customer/dashboard?deal=lead-123',
    );
    expect(sanitizePostLoginPath('//attacker.example/path')).toBeNull();
  });

  it('uses one compact-to-desktop boundary', () => {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: false });
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    expect(APP_DESKTOP_MIN_WIDTH).toBe(1024);
    expect(APP_DESKTOP_MEDIA_QUERY).toBe('(min-width: 1024px)');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1023 });
    expect(computeMobileUiState().isMobile).toBe(true);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    expect(computeMobileUiState().isMobile).toBe(false);
  });
});
