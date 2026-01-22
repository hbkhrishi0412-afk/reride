import { getSupabaseClient } from '../lib/supabase.js';
import { User } from '../types';

// Google Sign-In with Supabase
export const signInWithGoogle = async (): Promise<{ 
  success: boolean; 
  user?: any; 
  firebaseUser?: any; // Keep for backward compatibility
  reason?: string 
}> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google Sign-In Error:', error);
      return {
        success: false,
        reason: error.message || 'Failed to sign in with Google'
      };
    }

    // OAuth redirects, so we return the URL for redirect
    // The actual user data will be available after redirect
    return {
      success: true,
      user: { redirectUrl: data.url },
      firebaseUser: { redirectUrl: data.url }, // Backward compatibility
    };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    
    let errorMessage = 'Failed to sign in with Google';
    if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      reason: errorMessage
    };
  }
};

// Phone/OTP Authentication with Supabase
// Note: Supabase phone auth requires Twilio configuration in Supabase dashboard

// Send OTP to phone number
export const sendOTP = async (phoneNumber: string): Promise<{
  success: boolean;
  confirmationResult?: any; // Keep for backward compatibility
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    
    // Format phone number (must include country code, e.g., +91 for India)
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: formattedNumber,
    });

    if (error) {
      console.error('Send OTP Error:', error);
      
      let errorMessage = 'Failed to send OTP';
      if (error.message.includes('invalid')) {
        errorMessage = 'Invalid phone number format. Please enter a valid phone number with country code.';
      } else if (error.message.includes('too many')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        reason: errorMessage
      };
    }

    // Store phone number for verification
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('supabase_phone_auth', formattedNumber);
    }
    
    return {
      success: true,
      confirmationResult: { phone: formattedNumber } // Backward compatibility
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
  confirmationResult: any, // Can be phone number or confirmation result
  otp: string
): Promise<{
  success: boolean;
  user?: any;
  firebaseUser?: any; // Keep for backward compatibility
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    
    // Get phone number from confirmationResult or sessionStorage
    const phone = confirmationResult?.phone || 
                 (typeof window !== 'undefined' ? sessionStorage.getItem('supabase_phone_auth') : null);
    
    if (!phone) {
      return {
        success: false,
        reason: 'Phone number not found. Please request OTP again.'
      };
    }
    
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) {
      console.error('Verify OTP Error:', error);
      return {
        success: false,
        reason: error.message || 'Invalid OTP'
      };
    }

    // Clear stored phone number
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('supabase_phone_auth');
    }
    
    const userData = {
      phoneNumber: data.user?.phone || phone,
      uid: data.user?.id || '',
      email: data.user?.email || '',
      name: data.user?.user_metadata?.name || '',
      avatarUrl: data.user?.user_metadata?.avatar_url || ''
    };
    
    return {
      success: true,
      user: userData,
      firebaseUser: data.user // Backward compatibility
    };
  } catch (error: any) {
    console.error('Verify OTP Error:', error);
    return {
      success: false,
      reason: error.message || 'Invalid OTP'
    };
  }
};

// Initialize reCAPTCHA (no-op for Supabase, kept for backward compatibility)
export const initializeRecaptcha = (containerId: string = 'recaptcha-container'): any => {
  console.log('reCAPTCHA initialization not needed for Supabase Auth');
  return { containerId };
};

// Clean up reCAPTCHA (no-op for Supabase, kept for backward compatibility)
export const cleanupRecaptcha = () => {
  // No cleanup needed for Supabase
};

// Register or login user with backend after Supabase authentication
export const syncWithBackend = async (
  supabaseUser: any, // Can be Firebase user (backward compat) or Supabase user
  role: 'customer' | 'seller',
  authProvider: 'google' | 'phone'
): Promise<{ success: boolean; user?: User; reason?: string }> => {
  try {
    // Extract user data (handles both Firebase and Supabase user formats)
    const userId = supabaseUser.uid || supabaseUser.id;
    const email = supabaseUser.email || supabaseUser.email;
    const name = supabaseUser.displayName || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User';
    const mobile = supabaseUser.phoneNumber || supabaseUser.phone || '';
    const avatarUrl = supabaseUser.photoURL || supabaseUser.user_metadata?.avatar_url || '';
    
    const response = await fetch('/api/main', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'oauth-login',
        firebaseUid: userId, // Keep field name for API compatibility
        email,
        name,
        mobile,
        avatarUrl,
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

