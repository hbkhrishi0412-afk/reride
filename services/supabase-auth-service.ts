/**
 * supabase-auth-service.ts — Core Supabase authentication service
 *
 * All auth operations (sign-in, sign-up, OTP, password reset, etc.)
 * are handled through Supabase Auth.
 */

import { Capacitor } from '@capacitor/core';
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
import { clearSupabaseAuthStorage } from '../utils/authStorage';

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
 *
 * `http://localhost:5173` and `https://localhost` are different origins — whitelist each dev URL
 * in Supabase Redirect URLs and open the app using the same origin you registered.
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
  if (m.includes('redirect_uri_mismatch') || m.includes('redirect url')) {
    return (
      'Google rejected the sign-in redirect. In Google Cloud Console, add this site URL to ' +
      "OAuth 2.0 → Web client's Authorized redirect URIs, and the same under Supabase " +
      '→ Authentication → URL Configuration → Redirect URLs (including exact origin and path).'
    );
  }
  if (m.includes('nonce') && (m.includes('id_token') || m.includes('token'))) {
    return (
      'Google token did not pass validation. In Supabase Dashboard open Authentication ' +
      '→ Providers → Google, enable "Skip nonce check" for native / mobile sign-in, or ' +
      'see Supabase Google provider docs for nonce configuration.'
    );
  }
  return undefined;
}

function formatNativeGoogleSignInFailure(nativeErr: unknown): string {
  const msg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
  const m = msg.toLowerCase();
  if (m.includes('10:') || m.includes('developer_error') || m.includes('12500')) {
    return (
      'Google sign-in is misconfigured for this app build. In Google Cloud Console add an ' +
      'Android OAuth client: package com.reride.app and SHA-1 from `cd android && gradlew signingReport` ' +
      '(debug and release). Add that Android client ID with the Web client ID in Supabase → Google → Client IDs, then rebuild.'
    );
  }
  return formatSupabaseError(msg) || msg || 'Google sign-in failed. Check Android OAuth + Supabase Google provider.';
}

export const signInWithGoogle = async (): Promise<OAuthSignInResult> => {
  try {
    const supabase = getSupabaseClient();
    const useExternalBrowser = shouldUseNativeGoogleOAuthFlow();
    const isAndroidApp = useExternalBrowser && Capacitor.getPlatform() === 'android';

    // Production Android apps (same pattern as major commerce apps) use Google Play Services
    // (native ID token) — not a Chrome OAuth tab. Browser OAuth on WebView+Chrome is unreliable
    // (infinite load, disallowed user agent) unless fully configured; require native path.
    if (isAndroidApp && !shouldTryNativeGoogleSignIn()) {
      return {
        success: false,
        reason:
          'Google on Android needs VITE_GOOGLE_WEB_CLIENT_ID in your build (.env + npm run build:android). ' +
          'Add a Web client ID, an Android OAuth client (com.reride.app + your keystore SHA-1), and both IDs in Supabase → Authentication → Google. Then reinstall the app.',
      };
    }

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
        console.warn('[ReRide] Native Google Sign-In failed:', nativeErr);
        if (isAndroidApp) {
          return {
            success: false,
            reason: formatNativeGoogleSignInFailure(nativeErr),
          };
        }
        // iOS: fall through to in-app / Safari browser OAuth
      }
    }

    const redirectTo = getOAuthRedirectUrl();

    if (import.meta.env.DEV && typeof redirectTo === 'string' && redirectTo) {
      const base = redirectTo.split('?')[0];
      console.info(
        '[ReRide OAuth] Add to Supabase → Authentication → URL → Redirect URLs:',
        `${base.split('/').slice(0, 3).join('/')}/**`,
        '(or the exact return URL) so Google can redirect back; PKCE requires the same origin you use in the browser.',
      );
    }

    // Do not pass extra Google queryParams (e.g. prompt=select_account) — can leave accounts.google.com
    // stuck loading on some browsers; Supabase + Google set the right consent flow by default.
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
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      return { success: false, reason: formatSupabaseError(error.message) };
    }
    await signOutGoogleNativeIfAvailable();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, reason: wrapError(error, 'Failed to sign out') };
  } finally {
    clearSupabaseAuthStorage();
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

/**
 * Resolves a Supabase access token for `Authorization: Bearer` on API calls.
 * Proactively calls `refreshSession` when the access token is missing or expires
 * within ~60s so the server (getUser) does not see an expired JWT.
 */
export const getValidAccessToken = async (): Promise<{
  success: boolean;
  accessToken?: string;
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

    const accessToken = session?.access_token;
    const expSec = session?.expires_at;
    const stillValid =
      Boolean(accessToken) &&
      (typeof expSec !== 'number' || expSec * 1000 > Date.now() + 60_000);

    if (stillValid) {
      return { success: true, accessToken: accessToken! };
    }

    const { data, error: refError } = await supabase.auth.refreshSession();
    if (refError) {
      return { success: false, reason: formatSupabaseError(refError.message) };
    }
    const t = data.session?.access_token;
    if (!t) {
      return { success: false, reason: 'Not authenticated' };
    }
    return { success: true, accessToken: t };
  } catch (error: unknown) {
    return { success: false, reason: wrapError(error, 'Failed to get access token') };
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
