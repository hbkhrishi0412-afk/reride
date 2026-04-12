/**
 * Auth service tests (Supabase-backed authService.ts).
 *
 * Use require() for the module under test so it loads after jest.mock runs (esbuild + import hoisting).
 */

jest.mock('../services/supabase-auth-service', () => ({
  signInWithGoogle: jest.fn(),
  syncServiceProviderOAuth: jest.fn(),
  syncWithBackend: jest.fn(),
}));

jest.mock('../lib/supabase.js', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}));

jest.mock('../utils/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const authService = require('../services/authService') as typeof import('../services/authService');
const {
  signInWithGoogle,
  syncWithBackend,
  sendOTP,
  verifyOTP,
  initializeRecaptcha,
} = authService;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticatedFetch } = require('../utils/authenticatedFetch') as {
  authenticatedFetch: jest.Mock;
};

const authSvcMock = jest.requireMock('../services/supabase-auth-service') as {
  signInWithGoogle: jest.Mock;
  syncWithBackend: jest.Mock;
};

const supabaseLibMock = jest.requireMock('../lib/supabase.js') as {
  getSupabaseClient: jest.Mock;
};

describe('authService (Supabase)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.__IMPORT_META__.env.VITE_OTP_SMS_PROVIDER = '';
    sessionStorage.clear();
    supabaseLibMock.getSupabaseClient.mockImplementation(() => ({
      auth: {
        signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
        verifyOtp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }));
  });

  describe('signInWithGoogle', () => {
    it('maps success from supabase-auth-service', async () => {
      authSvcMock.signInWithGoogle.mockResolvedValue({
        success: true,
        user: { email: 'a@b.com', name: 'A' },
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.user).toEqual({ email: 'a@b.com', name: 'A' });
      expect(result.firebaseUser).toEqual(result.user);
    });

    it('maps failure reason', async () => {
      authSvcMock.signInWithGoogle.mockResolvedValue({
        success: false,
        reason: 'Popup blocked',
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Popup blocked');
    });
  });

  describe('syncWithBackend', () => {
    it('delegates to supabase syncWithBackend', async () => {
      const user = { id: 'u1' };
      authSvcMock.syncWithBackend.mockResolvedValue({ success: true, user: user as any });

      const result = await syncWithBackend({ sub: 'x' }, 'customer', 'google');

      expect(authSvcMock.syncWithBackend).toHaveBeenCalledWith({ sub: 'x' }, 'customer', 'google');
      expect(result.success).toBe(true);
      expect(result.user).toEqual(user);
    });
  });

  describe('sendOTP', () => {
    it('uses Supabase signInWithOtp when MessageBot is disabled', async () => {
      const signInWithOtp = jest.fn().mockResolvedValue({ error: null });
      supabaseLibMock.getSupabaseClient.mockReturnValue({
        auth: { signInWithOtp, verifyOtp: jest.fn() },
      } as any);

      const result = await sendOTP('9876543210');

      expect(result.success).toBe(true);
      expect(signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ phone: expect.stringContaining('91') }),
      );
    });

    it('uses MessageBot API when VITE_OTP_SMS_PROVIDER is messagebot', async () => {
      globalThis.__IMPORT_META__.env.VITE_OTP_SMS_PROVIDER = 'messagebot';
      authenticatedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await sendOTP('9876543210');

      expect(result.success).toBe(true);
      expect(authenticatedFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('send-otp-messagebot'),
        }),
      );
    });
  });

  describe('verifyOTP', () => {
    it('returns error when phone is missing', async () => {
      const result = await verifyOTP(null, '123456');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Phone number not found. Please request OTP again.');
    });
  });

  describe('initializeRecaptcha', () => {
    it('is a no-op for Supabase', () => {
      expect(initializeRecaptcha('x')).toBeNull();
    });
  });
});
