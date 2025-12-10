import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  UserCredential
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User } from '../types';

// Google Sign-In
export const signInWithGoogle = async (): Promise<{ 
  success: boolean; 
  user?: any; 
  firebaseUser?: any; 
  reason?: string 
}> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    
    // Extract user information
    const userData = {
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      avatarUrl: firebaseUser.photoURL || '',
      uid: firebaseUser.uid,
      phoneNumber: firebaseUser.phoneNumber || '',
      emailVerified: firebaseUser.emailVerified
    };
    
    return {
      success: true,
      user: userData,
      firebaseUser: firebaseUser
    };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to sign in with Google'
    };
  }
};

// Initialize reCAPTCHA for phone authentication
let recaptchaVerifier: RecaptchaVerifier | null = null;

export const initializeRecaptcha = (containerId: string = 'recaptcha-container'): RecaptchaVerifier => {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
  }
  
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - will proceed with phone auth
      console.log('reCAPTCHA verified');
    },
    'expired-callback': () => {
      console.log('reCAPTCHA expired');
    }
  });
  
  return recaptchaVerifier;
};

// Send OTP to phone number
export const sendOTP = async (phoneNumber: string): Promise<{
  success: boolean;
  confirmationResult?: ConfirmationResult;
  reason?: string;
}> => {
  try {
    // Format phone number (must include country code, e.g., +91 for India)
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    
    if (!recaptchaVerifier) {
      initializeRecaptcha();
    }
    
    const confirmationResult = await signInWithPhoneNumber(auth, formattedNumber, recaptchaVerifier!);
    
    return {
      success: true,
      confirmationResult
    };
  } catch (error: any) {
    console.error('Send OTP Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to send OTP'
    };
  }
};

// Verify OTP
export const verifyOTP = async (
  confirmationResult: ConfirmationResult, 
  otp: string
): Promise<{
  success: boolean;
  user?: any;
  firebaseUser?: any;
  reason?: string;
}> => {
  try {
    const result = await confirmationResult.confirm(otp);
    const firebaseUser = result.user;
    
    const userData = {
      phoneNumber: firebaseUser.phoneNumber || '',
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      avatarUrl: firebaseUser.photoURL || ''
    };
    
    return {
      success: true,
      user: userData,
      firebaseUser: firebaseUser
    };
  } catch (error: any) {
    console.error('Verify OTP Error:', error);
    return {
      success: false,
      reason: error.message || 'Invalid OTP'
    };
  }
};

// Clean up reCAPTCHA
export const cleanupRecaptcha = () => {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
};

// Register or login user with backend after Firebase authentication
export const syncWithBackend = async (
  firebaseUser: any,
  role: 'customer' | 'seller',
  authProvider: 'google' | 'phone'
): Promise<{ success: boolean; user?: User; reason?: string }> => {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'oauth-login',
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        mobile: firebaseUser.phoneNumber || '',
        avatarUrl: firebaseUser.photoURL || '',
        role,
        authProvider
      })
    });
    
    // Handle rate limiting (429) - return error without retry
    if (response.status === 429) {
      console.warn('⚠️ Rate limited during OAuth sync (429)');
      return {
        success: false,
        reason: 'Too many requests. Please wait a moment and try again.'
      };
    }
    
    // Handle service unavailable (503) - return error without retry
    if (response.status === 503) {
      console.warn('⚠️ Service unavailable during OAuth sync (503)');
      return {
        success: false,
        reason: 'Service temporarily unavailable. Please try again later.'
      };
    }
    
    // Handle other server errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      return {
        success: false,
        reason: errorData.reason || errorData.error || 'Failed to sync with backend'
      };
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Backend sync error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's a network/server error
    if (errorMessage.includes('429') || errorMessage.includes('503') || 
        errorMessage.includes('Too many requests') || 
        errorMessage.includes('Service temporarily unavailable')) {
      return {
        success: false,
        reason: errorMessage.includes('429') || errorMessage.includes('Too many requests')
          ? 'Too many requests. Please wait a moment and try again.'
          : 'Service temporarily unavailable. Please try again later.'
      };
    }
    
    return {
      success: false,
      reason: 'Failed to sync with backend'
    };
  }
};

