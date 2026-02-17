/**
 * authService.ts — Unified authentication service
 *
 * Delegates all operations to the Supabase auth service.
 * Provides Google sign-in, OTP, and backend sync helpers.
 */

import {
  signInWithGoogle as supabaseGoogleSignIn,
  syncWithBackend as supabaseSyncWithBackend,
} from './supabase-auth-service';
import { getSupabaseClient } from '../lib/supabase.js';
import type { User } from '../types';

// ── Google Sign-In ──────────────────────────────────────────────────────────

export const signInWithGoogle = async (): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  firebaseUser?: Record<string, unknown>; // kept for backward-compat callers
  reason?: string;
}> => {
  const result = await supabaseGoogleSignIn();
  return {
    success: result.success,
    user: result.user,
    firebaseUser: result.user, // alias for callers that still reference firebaseUser
    reason: result.reason,
  };
};

// ── OTP / Phone Authentication ──────────────────────────────────────────────

/**
 * Send an OTP to a phone number via Supabase phone auth.
 */
export const sendOTP = async (
  phoneNumber: string,
): Promise<{
  success: boolean;
  confirmationResult?: { phone: string };
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();

    // Format phone number — must include country code
    const formattedNumber = phoneNumber.startsWith('+')
      ? phoneNumber
      : `+91${phoneNumber}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedNumber,
    });

    if (error) {
      let errorMessage = 'Failed to send OTP';

      if (
        error.message?.toLowerCase().includes('unsupported phone provider') ||
        error.message?.toLowerCase().includes('twilio')
      ) {
        errorMessage =
          'Phone authentication is not configured. Please contact support or configure Twilio in Supabase dashboard.';
      } else if (
        error.message?.toLowerCase().includes('invalid') ||
        error.message?.toLowerCase().includes('format')
      ) {
        errorMessage =
          'Invalid phone number format. Please enter a valid 10-digit Indian mobile number.';
      } else if (
        error.message?.toLowerCase().includes('too many') ||
        error.message?.toLowerCase().includes('rate limit')
      ) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (
        error.message?.toLowerCase().includes('not enabled') ||
        error.message?.toLowerCase().includes('disabled')
      ) {
        errorMessage =
          'Phone authentication is not enabled. Please configure it in Supabase dashboard.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { success: false, reason: errorMessage };
    }

    // Store phone for verification step
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('supabase_phone_auth', formattedNumber);
    }

    return {
      success: true,
      confirmationResult: { phone: formattedNumber },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to send OTP';
    return { success: false, reason: message };
  }
};

/**
 * Verify an OTP code.
 */
export const verifyOTP = async (
  confirmationResult: { phone?: string } | null,
  otp: string,
): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  firebaseUser?: Record<string, unknown>;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();

    const phone =
      confirmationResult?.phone ||
      (typeof window !== 'undefined'
        ? sessionStorage.getItem('supabase_phone_auth')
        : null);

    if (!phone) {
      return {
        success: false,
        reason: 'Phone number not found. Please request OTP again.',
      };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) {
      return { success: false, reason: error.message || 'Invalid OTP' };
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
      avatarUrl: data.user?.user_metadata?.avatar_url || '',
    };

    return {
      success: true,
      user: userData,
      firebaseUser: data.user as unknown as Record<string, unknown>,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Invalid OTP';
    return { success: false, reason: message };
  }
};

// ── reCAPTCHA stubs (not needed for Supabase) ───────────────────────────────

/** No-op — reCAPTCHA is not required for Supabase Auth. */
export const initializeRecaptcha = (
  _containerId: string = 'recaptcha-container',
): null => null;

/** No-op — nothing to clean up. */
export const cleanupRecaptcha = (): void => {};

// ── Backend Sync ────────────────────────────────────────────────────────────

/**
 * Sync a Supabase-authenticated user with the backend API to
 * create/retrieve the full user profile.
 */
export const syncWithBackend = async (
  supabaseUser: Record<string, unknown>,
  role: 'customer' | 'seller',
  authProvider: 'google' | 'phone' | 'email',
): Promise<{ success: boolean; user?: User; reason?: string }> => {
  return supabaseSyncWithBackend(supabaseUser, role, authProvider);
};
