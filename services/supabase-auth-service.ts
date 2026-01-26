import { getSupabaseClient } from '../lib/supabase.js';
import type { User } from '../types.js';

// Google Sign-In with Supabase
export const signInWithGoogle = async (): Promise<{ 
  success: boolean; 
  user?: any; 
  supabaseUser?: any; 
  reason?: string 
}> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      return {
        success: false,
        reason: error.message || 'Failed to sign in with Google'
      };
    }

    // OAuth redirects, so we return the URL for redirect
    return {
      success: true,
      user: { redirectUrl: data.url },
    };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to sign in with Google'
    };
  }
};

// Sign in with email and password
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{
  success: boolean;
  user?: any;
  session?: any;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      return {
        success: false,
        reason: error.message || 'Invalid email or password'
      };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    console.error('Email Sign-In Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to sign in'
    };
  }
};

// Sign up with email and password
export const signUpWithEmail = async (
  email: string,
  password: string,
  metadata?: { name?: string; mobile?: string; role?: string }
): Promise<{
  success: boolean;
  user?: any;
  session?: any;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: metadata || {},
      },
    });

    if (error) {
      return {
        success: false,
        reason: error.message || 'Failed to create account'
      };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    console.error('Email Sign-Up Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to create account'
    };
  }
};

// Sign out
export const signOut = async (): Promise<{ success: boolean; reason?: string }> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return {
        success: false,
        reason: error.message
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Sign Out Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to sign out'
    };
  }
};

// Get current session
export const getSession = async (): Promise<{
  success: boolean;
  session?: any;
  user?: any;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return {
        success: false,
        reason: error.message
      };
    }

    return {
      success: true,
      session,
      user: session?.user,
    };
  } catch (error: any) {
    console.error('Get Session Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to get session'
    };
  }
};

// Get current user
export const getCurrentUser = async (): Promise<{
  success: boolean;
  user?: any;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return {
        success: false,
        reason: error.message
      };
    }

    return {
      success: true,
      user,
    };
  } catch (error: any) {
    console.error('Get Current User Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to get current user'
    };
  }
};

// Refresh session
export const refreshSession = async (): Promise<{
  success: boolean;
  session?: any;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      return {
        success: false,
        reason: error.message
      };
    }

    return {
      success: true,
      session,
    };
  } catch (error: any) {
    console.error('Refresh Session Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to refresh session'
    };
  }
};

// Send password reset email
export const resetPassword = async (email: string): Promise<{
  success: boolean;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: typeof window !== 'undefined' 
        ? `${window.location.origin}/reset-password` 
        : undefined,
    });
    
    if (error) {
      return {
        success: false,
        reason: error.message || 'Failed to send password reset email'
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Reset Password Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to send password reset email'
    };
  }
};

// Update password
export const updatePassword = async (newPassword: string): Promise<{
  success: boolean;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) {
      return {
        success: false,
        reason: error.message || 'Failed to update password'
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Update Password Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to update password'
    };
  }
};

// Verify OTP (for phone authentication if needed)
export const verifyOTP = async (
  phone: string,
  token: string
): Promise<{
  success: boolean;
  user?: any;
  session?: any;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    
    if (error) {
      return {
        success: false,
        reason: error.message || 'Invalid OTP'
      };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    console.error('Verify OTP Error:', error);
    return {
      success: false,
      reason: error.message || 'Failed to verify OTP'
    };
  }
};

// Sync user with backend after Supabase authentication
export const syncWithBackend = async (
  supabaseUser: any,
  role: 'customer' | 'seller',
  authProvider: 'google' | 'phone' | 'email'
): Promise<{ success: boolean; user?: User; reason?: string }> => {
  try {
    // Extract mobile from phone (for phone auth) or user_metadata.mobile (for email auth)
    const mobile = supabaseUser.phone || supabaseUser.user_metadata?.mobile || '';
    
    const response = await fetch('/api/main', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'oauth-login',
        firebaseUid: supabaseUser.id, // Use Supabase user ID
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
        mobile: mobile,
        avatarUrl: supabaseUser.user_metadata?.avatar_url || '',
        role,
        authProvider
      })
    });
    
    if (response.status === 429) {
      return {
        success: false,
        reason: 'Too many requests. Please wait a moment and try again.'
      };
    }
    
    if (response.status === 503) {
      return {
        success: false,
        reason: 'Service temporarily unavailable. Please try again later.'
      };
    }
    
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
    return {
      success: false,
      reason: 'Failed to sync with backend'
    };
  }
};



