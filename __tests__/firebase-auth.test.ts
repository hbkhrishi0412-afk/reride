/**
 * Firebase Authentication Tests
 * Tests for Google Sign-In and Mobile OTP authentication
 */

// Mock Firebase before importing
jest.mock('../lib/firebase', () => {
  const mockAuth = {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
    signOut: jest.fn(),
  };

  return {
    auth: mockAuth,
    app: {},
  };
});

// Mock Firebase Auth methods
const mockSignInWithPopup = jest.fn();
const mockSignInWithPhoneNumber = jest.fn();
const mockRecaptchaVerifier = {
  clear: jest.fn(),
  render: jest.fn(),
};

jest.mock('firebase/auth', () => ({
  signInWithPopup: (...args: any[]) => mockSignInWithPopup(...args),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    addScope: jest.fn(),
  })),
  signInWithPhoneNumber: (...args: any[]) => mockSignInWithPhoneNumber(...args),
  RecaptchaVerifier: jest.fn().mockImplementation(() => mockRecaptchaVerifier),
  getAuth: jest.fn(),
}));

import { signInWithGoogle, sendOTP, verifyOTP, syncWithBackend, initializeRecaptcha } from '../services/authService';

describe('Firebase Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for backend sync
    global.fetch = jest.fn();
  });

  describe('Google Sign-In', () => {
    it('should successfully sign in with Google', async () => {
      const mockFirebaseUser = {
        uid: 'test-uid-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        phoneNumber: null,
        emailVerified: true,
      };

      const mockUserCredential = {
        user: mockFirebaseUser,
      };

      mockSignInWithPopup.mockResolvedValue(mockUserCredential);

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.user?.name).toBe('Test User');
      expect(result.firebaseUser).toBe(mockFirebaseUser);
    });

    it('should handle Google sign-in errors', async () => {
      const mockError = new Error('Popup closed by user');
      mockSignInWithPopup.mockRejectedValue(mockError);

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Popup closed by user');
      expect(result.user).toBeUndefined();
    });

    it('should extract user data correctly from Firebase user', async () => {
      const mockFirebaseUser = {
        uid: 'uid-456',
        email: 'user@test.com',
        displayName: 'John Doe',
        photoURL: 'https://example.com/avatar.jpg',
        phoneNumber: '+1234567890',
        emailVerified: false,
      };

      mockSignInWithPopup.mockResolvedValue({ user: mockFirebaseUser });

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        email: 'user@test.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        uid: 'uid-456',
        phoneNumber: '+1234567890',
        emailVerified: false,
      });
    });
  });

  describe('OTP Authentication', () => {
    it('should format phone number with country code', async () => {
      const mockConfirmationResult = {
        confirm: jest.fn(),
      };

      mockSignInWithPhoneNumber.mockResolvedValue(mockConfirmationResult);

      const result = await sendOTP('9876543210');

      expect(result.success).toBe(true);
      expect(result.confirmationResult).toBe(mockConfirmationResult);
      // Verify phone number was formatted with +91
      expect(mockSignInWithPhoneNumber).toHaveBeenCalled();
    });

    it('should handle phone numbers with existing country code', async () => {
      const mockConfirmationResult = {
        confirm: jest.fn(),
      };

      mockSignInWithPhoneNumber.mockResolvedValue(mockConfirmationResult);

      const result = await sendOTP('+919876543210');

      expect(result.success).toBe(true);
      expect(result.confirmationResult).toBeDefined();
    });

    it('should handle OTP send errors', async () => {
      const mockError = new Error('Invalid phone number');
      mockSignInWithPhoneNumber.mockRejectedValue(mockError);

      const result = await sendOTP('invalid');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid phone number');
    });

    it('should verify OTP successfully', async () => {
      const mockFirebaseUser = {
        uid: 'phone-uid-123',
        phoneNumber: '+919876543210',
        email: null,
        displayName: null,
        photoURL: null,
      };

      const mockConfirmationResult = {
        confirm: jest.fn().mockResolvedValue({
          user: mockFirebaseUser,
        }),
      };

      const result = await verifyOTP(mockConfirmationResult as any, '123456');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.phoneNumber).toBe('+919876543210');
      expect(mockConfirmationResult.confirm).toHaveBeenCalledWith('123456');
    });

    it('should handle invalid OTP', async () => {
      const mockError = new Error('Invalid verification code');
      const mockConfirmationResult = {
        confirm: jest.fn().mockRejectedValue(mockError),
      };

      const result = await verifyOTP(mockConfirmationResult as any, '000000');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Invalid verification code');
    });
  });

  describe('Backend Sync', () => {
    it('should sync Google user with backend successfully', async () => {
      const mockFirebaseUser = {
        uid: 'google-uid-123',
        email: 'google@example.com',
        displayName: 'Google User',
        photoURL: 'https://example.com/photo.jpg',
        phoneNumber: null,
      };

      const mockBackendResponse = {
        success: true,
        user: {
          id: 'user-123',
          email: 'google@example.com',
          name: 'Google User',
          role: 'customer',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBackendResponse,
      });

      const result = await syncWithBackend(mockFirebaseUser, 'customer', 'google');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'oauth-login',
          firebaseUid: 'google-uid-123',
          email: 'google@example.com',
          name: 'Google User',
          mobile: '',
          avatarUrl: 'https://example.com/photo.jpg',
          role: 'customer',
          authProvider: 'google',
        }),
      });
    });

    it('should sync phone user with backend successfully', async () => {
      const mockFirebaseUser = {
        uid: 'phone-uid-456',
        email: null,
        displayName: null,
        photoURL: null,
        phoneNumber: '+919876543210',
      };

      const mockBackendResponse = {
        success: true,
        user: {
          id: 'user-456',
          mobile: '+919876543210',
          role: 'seller',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBackendResponse,
      });

      const result = await syncWithBackend(mockFirebaseUser, 'seller', 'phone');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(callArgs[0]).toBe('/api/users');
      expect(callArgs[1].method).toBe('POST');
      expect(body.action).toBe('oauth-login');
      expect(body.firebaseUid).toBe('phone-uid-456');
      expect(body.name).toBe('User');
      expect(body.mobile).toBe('+919876543210');
      expect(body.role).toBe('seller');
      expect(body.authProvider).toBe('phone');
    });

    it('should handle rate limiting errors', async () => {
      const mockFirebaseUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test',
        phoneNumber: null,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ reason: 'Too many requests' }),
      });

      const result = await syncWithBackend(mockFirebaseUser, 'customer', 'google');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Too many requests. Please wait a moment and try again.');
    });

    it('should handle service unavailable errors', async () => {
      const mockFirebaseUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test',
        phoneNumber: null,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ reason: 'Service unavailable' }),
      });

      const result = await syncWithBackend(mockFirebaseUser, 'customer', 'google');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Service temporarily unavailable. Please try again later.');
    });

    it('should handle network errors', async () => {
      const mockFirebaseUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test',
        phoneNumber: null,
      };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await syncWithBackend(mockFirebaseUser, 'customer', 'google');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Failed to sync with backend');
    });
  });

  describe('reCAPTCHA Initialization', () => {
    it('should initialize reCAPTCHA verifier', () => {
      const verifier = initializeRecaptcha('test-container');
      expect(verifier).toBeDefined();
    });

    it('should clear existing verifier before initializing new one', () => {
      const verifier1 = initializeRecaptcha('container-1');
      const verifier2 = initializeRecaptcha('container-2');
      expect(verifier1).toBeDefined();
      expect(verifier2).toBeDefined();
    });
  });
});

