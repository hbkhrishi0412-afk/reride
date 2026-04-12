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
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';
import {
  getNativeGoogleWebClientId,
  shouldTryNativeGoogleSignIn,
  signInWithGoogleNative,
  signOutGoogleNativeIfAvailable,
} from '../utils/nativeGoogleSignIn';
import {
  getNativeOAuthRedirectUrl,
  openGoogleOAuthUrl,
  shouldUseNativeGoogleOAuthFlow,
} from '../utils/oauthMobile';

// ── Shared result types ─────────────────────────────────────────────────────

interface AuthResult<T = unknown> {
  success: boolean;
  reason?: string;
  data?: T;
}

interface OAuthSignInResult extends AuthResult {
  /**
   * Null: native id-token sign-in or OAuth opened in Custom Tab (session in app via Supabase).
   * String: web OAuth URL to navigate to.
   */
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

/**
 * OAuth return URL (no `#` fragment). Must be listed under Supabase → Authentication →
 * URL Configuration → Redirect URLs (e.g. `https://www.reride.co.in/**`,
 * `https://reride.co.in/**`, `https://appassets.androidplatform.net/**`,
 * `http://localhost:5173/**`, `com.reride.app://oauth-callback` (Android Custom Tab / PKCE return).
 *
 * MUST use the **current document origin** (never force www): Supabase PKCE stores the
 * code_verifier in localStorage per-origin. If the user is on `https://reride.co.in` but
 * `redirectTo` is `https://www.reride.co.in`, the callback runs on www without the verifier
 * and no session is created (user stays "Guest").
 */
export function getOAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const native = getNativeOAuthRedirectUrl();
  if (native) return native;
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search || ''}`;
}

/**
 * Build a hash-based redirect URL for email auth links.
 * Using `/#/...` works on static hosting and mobile WebViews.
 */
function getEmailAuthRedirectUrl(path: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const fallbackOrigin =
    (import.meta as ImportMeta).env?.VITE_APP_URL?.trim() || 'https://www.reride.co.in';
  const currentOrigin = window.location.origin;
  const isLocalOrigin =
    currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');
  const origin = isLocalOrigin ? fallbackOrigin : currentOrigin;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}/#${normalizedPath}`;
}

function mapGoogleProviderError(message: string): string | undefined {
  const m = message.toLowerCase();
  if (
    m.includes('unsupported provider') ||
    (m.includes('provider') && (m.includes('not enabled') || m.includes('disabled')))
  ) {
    return (
      'Google sign-in is not enabled for this project. In the Supabase Dashboard open ' +
      'Authentication → Providers → Google, turn it on, and add the Web Client ID and secret ' +
      'from Google Cloud Console (OAuth 2.0). Also add this app URL under Redirect URLs.'
    );
  }
  return undefined;
}

export const signInWithGoogle = async (): Promise<OAuthSignInResult> => {
  try {
    const supabase = getSupabaseClient();
    const useExternalBrowser = shouldUseNativeGoogleOAuthFlow();

    if (useExternalBrowser && shouldTryNativeGoogleSignIn()) {
      try {
        const { idToken, accessToken } = await signInWithGoogleNative();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          access_token: accessToken ?? undefined,
        });
        if (error) {
          const mapped = mapGoogleProviderError(error.message || '');
          return {
            success: false,
            reason:
              mapped ||
              formatSupabaseError(error.message || 'Failed to sign in with Google'),
          };
        }
        return { success: true, user: { redirectUrl: null } };
      } catch (nativeErr: unknown) {
        const name = nativeErr instanceof Error ? nativeErr.name : '';
        if (name === 'AbortError') {
          return { success: false, reason: 'Sign in was canceled' };
        }
        console.warn(
          '[ReRide] Native Google Sign-In failed; falling back to browser OAuth. Client ID set:',
          !!getNativeGoogleWebClientId(),
          nativeErr,
        );
      }
    }

    const redirectTo = getOAuthRedirectUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: useExternalBrowser,
      },
    });

    if (error) {
      const mapped = mapGoogleProviderError(error.message || '');
      return {
        success: false,
        reason:
          mapped ||
          formatSupabaseError(error.message || 'Failed to sign in with Google'),
      };
    }

    if (!data?.url) {
      return {
        success: false,
        reason: 'Could not start Google sign-in. Please try again.',
      };
    }

    if (useExternalBrowser) {
      await openGoogleOAuthUrl(data.url);
      return { success: true, user: { redirectUrl: null } };
    }

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
      options: {
        data: metadata || {},
        emailRedirectTo: getEmailAuthRedirectUrl('/login'),
      },
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
    await signOutGoogleNativeIfAvailable();
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
        redirectTo: getEmailAuthRedirectUrl('/forgot-password'),
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
export type ServiceProviderOAuthPayload = Record<string, unknown> & {
  id?: string;
  uid?: string;
  email?: string;
  name?: string;
  phone?: string;
  city?: string;
};

/**
 * After Google (or other Supabase) sign-in as a service provider: ensure `service_providers`
 * row exists and return profile for the car-services dashboard.
 */
export const syncServiceProviderOAuth = async (
  supabaseUser: Record<string, unknown>,
): Promise<{ success: boolean; provider?: ServiceProviderOAuthPayload; reason?: string }> => {
  try {
    const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;

    const response = await authenticatedFetch('/api/main', {
      method: 'POST',
      body: JSON.stringify({
        action: 'oauth-service-provider',
        firebaseUid: supabaseUser.id,
        email: supabaseUser.email,
        name:
          (metadata.name as string) ||
          ((supabaseUser.email as string) ?? '').split('@')[0] ||
          'Service provider',
      }),
    });
    const parsed = await handleApiResponse<{
      success?: boolean;
      provider?: ServiceProviderOAuthPayload;
      reason?: string;
      error?: string;
    }>(response);
    if (!parsed.success) {
      if (response.status === 429) {
        return { success: false, reason: 'Too many requests. Please wait a moment and try again.' };
      }
      if (response.status === 503) {
        return { success: false, reason: 'Service temporarily unavailable. Please try again later.' };
      }
      return {
        success: false,
        reason: parsed.reason || parsed.error || 'Failed to complete service provider sign-in',
      };
    }
    const body = parsed.data;
    if (!body?.provider) {
      return { success: false, reason: 'Service provider profile missing from server response.' };
    }
    return { success: true, provider: body.provider };
  } catch {
    return { success: false, reason: 'Failed to sync service provider profile' };
  }
};

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

    const response = await authenticatedFetch('/api/main', {
      method: 'POST',
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
    const parsed = await handleApiResponse<BackendSyncResult>(response);
    if (!parsed.success) {
      // Preserve prior user-facing messages for common statuses
      if (response.status === 429) {
        return { success: false, reason: 'Too many requests. Please wait a moment and try again.' };
      }
      if (response.status === 503) {
        return { success: false, reason: 'Service temporarily unavailable. Please try again later.' };
      }
      return { success: false, reason: parsed.reason || parsed.error || 'Failed to sync with backend' };
    }
    return parsed.data as BackendSyncResult;
  } catch (error: unknown) {
    return { success: false, reason: 'Failed to sync with backend' };
  }
};
