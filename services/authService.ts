import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  UserCredential
} from 'firebase/auth';
import { auth, getFirebaseInitError } from '../lib/firebase';
import { User } from '../types';

// Helper to get production-appropriate error message
const getFirebaseErrorMessage = (): string => {
  const initError = getFirebaseInitError();
  if (initError) {
    return initError;
  }
  
  // Check if we're in production
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname.includes('vercel.app') || 
     window.location.hostname.includes('reride.co.in'));
  
  if (isProduction) {
    return 'Firebase Auth is not initialized. Please configure Firebase environment variables in your Vercel project settings (Settings → Environment Variables). Add all 6 variables: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID';
  }
  
  return 'Firebase Auth is not initialized. Please check your Firebase configuration in .env.local file.';
};

// Google Sign-In
export const signInWithGoogle = async (): Promise<{ 
  success: boolean; 
  user?: any; 
  firebaseUser?: any; 
  reason?: string 
}> => {
  try {
    // Validate that auth is initialized
    if (!auth) {
      const errorMessage = getFirebaseErrorMessage();
      console.error('❌ Firebase Auth is not initialized.');
      return {
        success: false,
        reason: errorMessage
      };
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    
    // Validate that we got a user
    if (!firebaseUser) {
      return {
        success: false,
        reason: 'No user returned from Google Sign-In'
      };
    }
    
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
    
    // Provide more specific error messages
    let errorMessage = 'Failed to sign in with Google';
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in popup was closed. Please try again.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Popup was blocked by your browser. Please allow popups and try again.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.code === 'auth/api-key-not-valid') {
      const isProduction = typeof window !== 'undefined' && 
        (window.location.hostname.includes('vercel.app') || 
         window.location.hostname.includes('reride.co.in'));
      errorMessage = isProduction 
        ? 'Firebase configuration is invalid. Please verify your Firebase environment variables in Vercel project settings.'
        : 'Firebase configuration is invalid. Please check your .env.local file.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      reason: errorMessage
    };
  }
};

// Initialize reCAPTCHA for phone authentication
let recaptchaVerifier: RecaptchaVerifier | null = null;

export const initializeRecaptcha = (containerId: string = 'recaptcha-container'): RecaptchaVerifier => {
  if (!auth) {
    throw new Error(getFirebaseErrorMessage());
  }
  
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
    if (!auth) {
      return {
        success: false,
        reason: getFirebaseErrorMessage()
      };
    }
    
    // Format phone number (must include country code, e.g., +91 for India)
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    
    if (!recaptchaVerifier) {
      initializeRecaptcha();
    }
    
    if (!recaptchaVerifier) {
      return {
        success: false,
        reason: 'Failed to initialize reCAPTCHA. Please try again.'
      };
    }
    
    const confirmationResult = await signInWithPhoneNumber(auth, formattedNumber, recaptchaVerifier);
    
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

