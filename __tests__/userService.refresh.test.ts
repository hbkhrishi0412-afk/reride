const mockRefreshAuthToken = jest.fn();

jest.mock('../utils/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
  handleApiResponse: jest.fn(),
  isTokenLikelyValid: jest.fn(() => false),
  postLogoutClearCookies: jest.fn().mockResolvedValue(undefined),
  refreshAuthToken: (...args: unknown[]) => mockRefreshAuthToken(...args),
  resetAuthFetchStateAfterLogout: jest.fn(),
}));

jest.mock('../utils/nativeTokenStorage', () => ({
  clearNativeTokens: jest.fn().mockResolvedValue(undefined),
  setNativeAccessToken: jest.fn().mockResolvedValue(undefined),
  setNativeRefreshToken: jest.fn().mockResolvedValue(undefined),
  hydrateNativeTokensFromPreferences: jest.fn().mockResolvedValue(undefined),
  getNativeMemoryAccessToken: jest.fn(() => null),
  getNativeRefreshToken: jest.fn().mockResolvedValue('native-refresh-token'),
}));

jest.mock('../utils/authStorage', () => ({
  clearSupabaseAuthStorage: jest.fn(),
  clearSessionStoredAccessToken: jest.fn(),
  getBrowserAccessTokenForApi: jest.fn(() => null),
  useHttpOnlyRefreshCookie: jest.fn(() => false),
}));

describe('userService.refreshAccessToken', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRefreshAuthToken.mockResolvedValue('refreshed-access-jwt');
  });

  it('delegates to refreshAuthToken (native Keychain + cookie + legacy paths)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { refreshAccessToken } = require('../services/userService') as typeof import('../services/userService');

    const result = await refreshAccessToken();

    expect(mockRefreshAuthToken).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, accessToken: 'refreshed-access-jwt' });
  });

  it('returns failure when refreshAuthToken yields no token', async () => {
    mockRefreshAuthToken.mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { refreshAccessToken } = require('../services/userService') as typeof import('../services/userService');

    const result = await refreshAccessToken();

    expect(mockRefreshAuthToken).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('Token refresh failed');
  });
});
