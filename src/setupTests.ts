import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// JSDOM does not provide Fetch API globals; code paths using `new Response()` need these.
if (typeof globalThis.Response === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require('node:undici') as typeof import('node:undici');
    globalThis.Response = undici.Response as typeof Response;
    globalThis.Request = undici.Request as typeof Request;
    globalThis.Headers = undici.Headers as typeof Headers;
  } catch {
    /* ignore — tests that need Response will mock at file level */
  }
}

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

declare global {
  // eslint-disable-next-line no-var
  var __IMPORT_META__: { env: Record<string, string | boolean | undefined> };
}

const viteEnv: Record<string, string | boolean | undefined> = {
  MODE: 'test',
  DEV: true,
  PROD: false,
  VITE_FORCE_API: '',
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  VITE_OTP_SMS_PROVIDER: '',
  VITE_VEHICLES_PAGE_SIZE: '',
  VITE_VEHICLES_LEGACY_FULL_FETCH: '',
  VITE_APP_URL: 'https://www.reride.co.in',
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_APP_ID: '1:123456789:web:test',
  VITE_FIREBASE_DATABASE_URL: 'https://test-project.firebaseio.com',
};

globalThis.__IMPORT_META__ = { env: viteEnv };

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as unknown as Storage;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock as unknown as Storage;

// Mock fetch
global.fetch = jest.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  class MockIntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  } as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

// Suppress console warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
