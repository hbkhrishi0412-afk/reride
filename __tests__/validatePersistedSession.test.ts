/**
 * @jest-environment jsdom
 */

import {
  clearPersistedUserSession,
  isPersistedSessionAuthenticated,
  readPersistedUser,
} from '../utils/validatePersistedSession';

jest.mock('../utils/environment', () => ({
  isDevelopmentEnvironment: jest.fn(() => false),
}));

jest.mock('../utils/authenticatedFetch', () => ({
  isTokenLikelyValid: jest.fn(() => false),
  refreshAuthToken: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('../lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  })),
}));

jest.mock('../utils/authStorage', () => ({
  getBrowserAccessTokenForApi: jest.fn(() => null),
  useHttpOnlyRefreshCookie: jest.fn(() => false),
}));

jest.mock('../utils/apiConfig', () => ({
  isCapacitorNative: jest.fn(() => false),
}));

describe('validatePersistedSession', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    localStorage.clear();
    sessionStorage.clear();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns null when no persisted user exists', () => {
    expect(readPersistedUser()).toBeNull();
  });

  it('reads a valid persisted user snapshot', () => {
    localStorage.setItem(
      'reRideCurrentUser',
      JSON.stringify({ email: 'a@test.com', role: 'customer', name: 'A' }),
    );
    expect(readPersistedUser()?.email).toBe('a@test.com');
  });

  it('rejects ghost sessions without tokens in production', async () => {
    localStorage.setItem(
      'reRideCurrentUser',
      JSON.stringify({ email: 'a@test.com', role: 'customer', name: 'A' }),
    );
    await expect(isPersistedSessionAuthenticated()).resolves.toBe(false);
  });

  it('clears persisted user keys', () => {
    localStorage.setItem('reRideCurrentUser', '{}');
    sessionStorage.setItem('currentUser', '{}');
    clearPersistedUserSession();
    expect(localStorage.getItem('reRideCurrentUser')).toBeNull();
    expect(sessionStorage.getItem('currentUser')).toBeNull();
  });
});
