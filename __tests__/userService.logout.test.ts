jest.mock('../utils/nativeTokenStorage', () => ({
  clearNativeTokens: jest.fn().mockResolvedValue(undefined),
  setNativeAccessToken: jest.fn().mockResolvedValue(undefined),
  setNativeRefreshToken: jest.fn().mockResolvedValue(undefined),
  hydrateNativeTokensFromPreferences: jest.fn().mockResolvedValue(undefined),
  getNativeMemoryAccessToken: jest.fn(() => null),
  getNativeRefreshToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('../utils/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
  handleApiResponse: jest.fn(),
  postLogoutClearCookies: jest.fn().mockResolvedValue(undefined),
  resetAuthFetchStateAfterLogout: jest.fn(),
}));

jest.mock('../utils/authStorage', () => ({
  clearSupabaseAuthStorage: jest.fn(),
  clearSessionStoredAccessToken: jest.fn(),
  getBrowserAccessTokenForApi: jest.fn(() => null),
  useHttpOnlyRefreshCookie: jest.fn(() => false),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logout } = require('../services/userService') as typeof import('../services/userService');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clearNativeTokens } = require('../utils/nativeTokenStorage') as typeof import('../utils/nativeTokenStorage');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clearSupabaseAuthStorage } = require('../utils/authStorage') as typeof import('../utils/authStorage');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resetAuthFetchStateAfterLogout } = require('../utils/authenticatedFetch') as typeof import('../utils/authenticatedFetch');

describe('userService.logout', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('clears native secure tokens and Supabase auth storage', () => {
    localStorage.setItem('reRideCurrentUser', '{"email":"a@b.com"}');
    localStorage.setItem('reRideAccessToken', 'legacy-access');
    localStorage.setItem('reRideRefreshToken', 'legacy-refresh');

    logout();

    expect(clearNativeTokens).toHaveBeenCalledTimes(1);
    expect(clearSupabaseAuthStorage).toHaveBeenCalledTimes(1);
    expect(resetAuthFetchStateAfterLogout).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('reRideCurrentUser')).toBeNull();
    expect(localStorage.getItem('reRideAccessToken')).toBeNull();
    expect(localStorage.getItem('reRideRefreshToken')).toBeNull();
  });
});
