/**
 * supabase-auth-service.ts — Core Supabase authentication service
 *
 * All auth operations (sign-in, sign-up, OTP, password reset, etc.)
 * are handled through Supabase Auth.
 */

import { getSupabaseClient } from '../lib/supabase.js';
import type { User as SupabaseAuthUser, Session } from '@supabase/supabase-js';
import type { User } from '../types.js';
import { formatSupabaseError } from '../utils/errorUtils.js';

// ── Shared result types ─────────────────────────────────────────────────────

interface AuthResult<T = unknown> {
  success: boolean;
  reason?: string;
  data?: T;
}

interface OAuthSignInResult extends AuthResult {
  user?: { redirectUrl: string | null };
}

interface CredentialSignInResult extends AuthResult {
  user?: SupabaseAuthUser | null;
  session?: Session | null;
}

interface BackendSyncResult extends AuthResult {
  user?: User;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function wrapError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return formatSupabaseError(error.message) || fallbackMessage;
  }
  return fallbackMessage;
}

// ── Google Sign-In ──────────────────────────────────────────────────────────

export const signInWithGoogle = async (): Promise<OAuthSignInResult> => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      return {
        success: false,
        reason: formatSupabaseError(
          error.message || 'Failed to sign in with Google',
        ),
      };
    }

    // OAuth redirects — return the URL the browser should follow
    return { success: true, user: { redirectUrl: data.url } };
  } catch (error: unknown) {
    return { success: false, reason: wrapError(error, 'Failed to sign in with Google') };
  }
};

// ── Email / Password Sign-In ────────────────────────────────────────────────

export const signInWithEmail = async (
  email: string,
  password: string,
): Promise<CredentialSignInResult> => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      return {
        success: false,
        reason: formatSupabaseError(
          error.message || 'Invalid email or password',
        ),
      };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error: unknown) {
    return { success: false, reason: wrapError(error, 'Failed to sign in') };
  }
};

// ── Email / Password Sign-Up ────────────────────────────────────────────────

export const signUpWithEmail = async (
  email: string,
  password: string,
  metadata?: { name?: string; mobile?: string; role?: string },
): Promise<CredentialSignInResult> => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: { data: metadata || {} },
    });

    if (error) {
      return {
        success: false,
        reason: formatSupabaseError(
          error.message || 'Failed to create account',
        ),
      };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error: unknown) {
    return {
      success: false,
      reason: wrapError(error, 'Failed to create account'),
    };
  }
};

// ── Sign Out ────────────────────────────────────────────────────────────────

export const signOut = async (): Promise<AuthResult> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, reason: formatSupabaseError(error.message) };
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, reason: wrapError(error, 'Failed to sign out') };
  }
};

// ── Session helpers ─────────────────────────────────────────────────────────

export const getSession = async (): Promise<{
  success: boolean;
  session?: Session | null;
  user?: SupabaseAuthUser | null;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return { success: false, reason: formatSupabaseError(error.message) };
    }
    return { success: true, session, user: session?.user ?? null };
  } catch (error: unknown) {
    return {
      success: false,
      reason: wrapError(error, 'Failed to get session'),
    };
  }
};

export const getCurrentUser = async (): Promise<{
  success: boolean;
  user?: SupabaseAuthUser | null;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return { success: false, reason: formatSupabaseError(error.message) };
    }
    return { success: true, user };
  } catch (error: unknown) {
    return {
      success: false,
      reason: wrapError(error, 'Failed to get current user'),
    };
  }
};

export const refreshSession = async (): Promise<{
  success: boolean;
  session?: Session | null;
  reason?: string;
}> => {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();

    if (error) {
      return { success: false, reason: formatSupabaseError(error.message) };
    }
    return { success: true, session };
  } catch (error: unknown) {
    return {
      success: false,
      reason: wrapError(error, 'Failed to refresh session'),
    };
  }
};

// ── Password Reset ──────────────────────────────────────────────────────────

export const resetPassword = async (
  email: string,
): Promise<AuthResult> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/reset-password`
            : undefined,
      },
    );

    if (error) {
      return {
        success: false,
        reason:
          formatSupabaseError(error.message) ||
          'Failed to send password reset email',
      };
    }
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      reason: wrapError(error, 'Failed to send password reset email'),
    };
  }
};

export const updatePassword = async (
  newPassword: string,
): Promise<AuthResult> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        reason:
          formatSupabaseError(error.message) || 'Failed to update password',
      };
    }
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      reason: wrapError(error, 'Failed to update password'),
    };
  }
};

// ── Phone OTP ───────────────────────────────────────────────────────────────

export const verifyOTP = async (
  phone: string,
  token: string,
): Promise<CredentialSignInResult> => {
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
        reason: formatSupabaseError(error.message || 'Invalid OTP'),
      };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error: unknown) {
    return {
      success: false,
      reason: wrapError(error, 'Failed to verify OTP'),
    };
  }
};

// ── Backend Sync ────────────────────────────────────────────────────────────

/**
 * After authenticating with Supabase, sync the user with the ReRide backend
 * to create/retrieve the full application user profile.
 */
export const syncWithBackend = async (
  supabaseUser: Record<string, unknown>,
  role: 'customer' | 'seller',
  authProvider: 'google' | 'phone' | 'email',
): Promise<BackendSyncResult> => {
  try {
    const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;

    const mobile =
      (supabaseUser.phone as string) ||
      (metadata.mobile as string) ||
      '';

    const response = await fetch('/api/main', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'oauth-login',
        firebaseUid: supabaseUser.id, // API field name kept for backward compat
        email: supabaseUser.email,
        name:
          (metadata.name as string) ||
          ((supabaseUser.email as string) ?? '').split('@')[0] ||
          'User',
        mobile,
        avatarUrl: (metadata.avatar_url as string) || '',
        role,
        authProvider,
      }),
    });

    if (response.status === 429) {
      return {
        success: false,
        reason: 'Too many requests. Please wait a moment and try again.',
      };
    }

    if (response.status === 503) {
      return {
        success: false,
        reason: 'Service temporarily unavailable. Please try again later.',
      };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      return {
        success: false,
        reason:
          errorData.reason || errorData.error || 'Failed to sync with backend',
      };
    }

    const data = await response.json();
    return data as BackendSyncResult;
  } catch (error: unknown) {
    return { success: false, reason: 'Failed to sync with backend' };
  }
};
