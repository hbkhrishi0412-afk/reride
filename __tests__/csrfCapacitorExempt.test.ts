import {
  isTrustedCapacitorRequestOrigin,
  shouldSkipCsrfForCapacitorNative,
} from '../utils/csrfCapacitorExempt';

describe('csrfCapacitorExempt', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VERCEL_ENV = originalVercelEnv;
  });

  describe('isTrustedCapacitorRequestOrigin', () => {
    it('trusts packaged Android WebView and iOS Capacitor origins', () => {
      expect(isTrustedCapacitorRequestOrigin('https://localhost')).toBe(true);
      expect(isTrustedCapacitorRequestOrigin('capacitor://localhost')).toBe(true);
      expect(isTrustedCapacitorRequestOrigin('https://appassets.androidplatform.net')).toBe(true);
    });

    it('rejects browser localhost in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'production';
      expect(isTrustedCapacitorRequestOrigin('http://localhost')).toBe(false);
      expect(isTrustedCapacitorRequestOrigin('http://127.0.0.1')).toBe(false);
    });

    it('allows dev localhost only outside production', () => {
      process.env.NODE_ENV = 'development';
      process.env.VERCEL_ENV = '';
      expect(isTrustedCapacitorRequestOrigin('http://localhost')).toBe(true);
    });
  });

  describe('shouldSkipCsrfForCapacitorNative', () => {
    it('requires both capacitor header and trusted origin', () => {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'production';
      expect(shouldSkipCsrfForCapacitorNative('capacitor', 'https://localhost')).toBe(true);
      expect(shouldSkipCsrfForCapacitorNative('capacitor', 'http://localhost')).toBe(false);
      expect(shouldSkipCsrfForCapacitorNative('browser', 'https://localhost')).toBe(false);
    });
  });
});
