/**
 * authService.ts — Unified authentication service
 *
 * Delegates all operations to the Supabase auth service.
 * Provides Google sign-in, OTP, and backend sync helpers.
 */

import type { Session } from '@supabase/supabase-js';
import {
  signInWithGoogle as supabaseGoogleSignIn,
  syncServiceProviderOAuth as supabaseSyncServiceProviderOAuth,
  syncWithBackend as supabaseSyncWithBackend,
} from './supabase-auth-service.js';
import { getSupabaseClient } from '../lib/supabase.js';
import type { User } from '../types.js';
import { authenticatedFetch } from '../utils/authenticatedFetch.js';
import { clearSupabaseAuthStorage, resolveSupabaseAccessTokenForApi } from '../utils/authStorage.js';

export type GoogleOAuthRole = 'customer' | 'seller' | 'service_provider';

const GOOGLE_SIGN_IN_TIMEOUT_MS = 65_000;
const GOOGLE_BACKEND_SYNC_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function resolveSessionForGoogleSync(
  sessionFromSignIn?: Session | null,
): Promise<Session | null> {
  if (sessionFromSignIn?.user) return sessionFromSignIn;
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session;
  const token = await resolveSupabaseAccessTokenForApi(4000);
  if (!token) return null;
  const { data: retry } = await supabase.auth.getSession();
  return retry.session ?? null;
}

export function persistGoogleOAuthRole(role: GoogleOAuthRole): void {
  try {
    sessionStorage.setItem('reride_oauth_role', role);
    localStorage.setItem('reride_oauth_role', role);
  } catch {
    /* ignore */
  }
}

export function clearGoogleOAuthRole(): void {
  try {
    sessionStorage.removeItem('reride_oauth_role');
    localStorage.removeItem('reride_oauth_role');
  } catch {
    /* ignore */
  }
}

function extractGoogleRedirectUrl(result: Awaited<ReturnType<typeof supabaseGoogleSignIn>>): string | null {
  const user = result.user;
  if (
    user &&
    typeof user === 'object' &&
    'redirectUrl' in user &&
    typeof (user as { redirectUrl?: string }).redirectUrl === 'string'
  ) {
    return (user as { redirectUrl: string }).redirectUrl;
  }
  return null;
}

/** After native Google id-token sign-in, sync ReRide profile and invoke the right callback. */
export async function completeGoogleSignInForRole(
  role: GoogleOAuthRole,
  handlers: {
    onLogin: (user: User) => void;
    onRegister?: (user: User) => void;
    onServiceProviderLogin?: (provider: Record<string, unknown>) => void;
  },
  mode: 'login' | 'register' = 'login',
  sessionFromSignIn?: Session | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await resolveSessionForGoogleSync(sessionFromSignIn);
  if (!session?.user) {
    return { ok: false, reason: 'Google sign-in did not create a session. Please try again.' };
  }

  const accessToken = session.access_token;
  const supabaseUser = session.user as unknown as Record<string, unknown>;

  if (role === 'service_provider') {
    if (!handlers.onServiceProviderLogin) {
      return { ok: false, reason: 'Service provider sign-in is not available here.' };
    }
    const spResult = await withTimeout(
      supabaseSyncServiceProviderOAuth(supabaseUser, accessToken),
      GOOGLE_BACKEND_SYNC_TIMEOUT_MS,
      'Signing in took too long. Check your connection and try again.',
    );
    if (!spResult.success || !spResult.provider) {
      return { ok: false, reason: spResult.reason || 'Google sign-in failed.' };
    }
    clearGoogleOAuthRole();
    handlers.onServiceProviderLogin(spResult.provider);
    return { ok: true };
  }

  if (role !== 'customer' && role !== 'seller') {
    return { ok: false, reason: 'Google sign-in is not available for this account type.' };
  }

  const syncResult = await withTimeout(
    supabaseSyncWithBackend(supabaseUser, role, 'google', accessToken),
    GOOGLE_BACKEND_SYNC_TIMEOUT_MS,
    'Signing in took too long. Check your connection and try again.',
  );
  if (!syncResult.success || !syncResult.user) {
    return { ok: false, reason: syncResult.reason || 'Google sign-in failed.' };
  }

  clearGoogleOAuthRole();
  if (mode === 'register' && handlers.onRegister) {
    handlers.onRegister(syncResult.user);
  } else {
    handlers.onLogin(syncResult.user);
  }
  return { ok: true };
}

/**
 * Shared Google button flow for UnifiedLogin, Login, and CustomerLogin.
 * Returns null on success or when browser OAuth was opened (AppProvider finishes the return).
 */
export async function runGoogleSignInButtonFlow(
  role: GoogleOAuthRole,
  handlers: {
    onLogin: (user: User) => void;
    onRegister?: (user: User) => void;
    onServiceProviderLogin?: (provider: Record<string, unknown>) => void;
  },
  mode: 'login' | 'register' = 'login',
): Promise<string | null> {
  persistGoogleOAuthRole(role);

  const result = await Promise.race([
    supabaseGoogleSignIn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Google sign-in timed out. Please try again.')), GOOGLE_SIGN_IN_TIMEOUT_MS);
    }),
  ]);

  if (!result.success) {
    clearGoogleOAuthRole();
    return result.reason || 'Failed to sign in with Google';
  }

  const redirectUrl = extractGoogleRedirectUrl(result);
  if (redirectUrl) {
    window.location.replace(redirectUrl);
    return null;
  }

  if (result.pendingExternalAuth) {
    return null;
  }

  const completed = await completeGoogleSignInForRole(
    role,
    handlers,
    mode,
    result.session ?? null,
  );
  if (!completed.ok) {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* ignore */
    }
    clearSupabaseAuthStorage();
    clearGoogleOAuthRole();
    return completed.reason;
  }

  return null;
}

/** In-memory only (not persisted) — avoids storing the phone number in sessionStorage. */
let pendingOtpPhoneForVerification: string | null = null;

/** @internal Resets module OTP state between unit tests. */
export function resetOtpSessionForTests(): void {
  pendingOtpPhoneForVerification = null;
}

function isMessageBotOtpEnabled(): boolean {
  try {
    return import.meta.env.VITE_OTP_SMS_PROVIDER === 'messagebot';
  } catch {
    return false;
  }
}

// ── Google Sign-In ──────────────────────────────────────────────────────────

export const signInWithGoogle = async (): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  firebaseUser?: Record<string, unknown>; // kept for backward-compat callers
  reason?: string;
  pendingExternalAuth?: boolean;
  session?: Session | null;
}> => {
  const result = await supabaseGoogleSignIn();
  return {
    success: result.success,
    user: result.user,
    firebaseUser: result.user, // alias for callers that still reference firebaseUser
    reason: result.reason,
    pendingExternalAuth: result.pendingExternalAuth,
    session: result.session ?? null,
  };
};

// ── OTP / Phone Authentication ──────────────────────────────────────────────

/**
 * Send an OTP: either MessageBot SMS (server) or Supabase phone auth (Twilio/Supabase SMS).
 */
export const sendOTP = async (
  phoneNumber: string,
): Promise<{
  success: boolean;
  confirmationResult?: { phone: string };
  reason?: string;
}> => {
  try {
    const formattedNumber = phoneNumber.startsWith('+')
      ? phoneNumber
      : `+91${phoneNumber}`;

    if (isMessageBotOtpEnabled()) {
      const response = await authenticatedFetch('/api/users', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          action: 'send-otp-messagebot',
          phoneNumber: formattedNumber,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        reason?: string;
      };
      if (!response.ok || !data.success) {
        return {
          success: false,
          reason: data.reason || 'Failed to send OTP',
        };
      }
      pendingOtpPhoneForVerification = formattedNumber;
      return {
        success: true,
        confirmationResult: { phone: formattedNumber },
      };
    }

    const supabase = getSupabaseClient();

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

    pendingOtpPhoneForVerification = formattedNumber;

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
 * Verify an OTP code (MessageBot + JWT session, or Supabase verifyOtp + oauth-login sync).
 */
export const verifyOTP = async (
  confirmationResult: { phone?: string } | null,
  otp: string,
  role: 'customer' | 'seller' = 'customer',
): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  firebaseUser?: Record<string, unknown>;
  reason?: string;
  /** MessageBot path: session stored; use appUser with onLogin */
  sessionComplete?: boolean;
  appUser?: User;
}> => {
  try {
    const phone =
      confirmationResult?.phone || pendingOtpPhoneForVerification;

    if (!phone) {
      return {
        success: false,
        reason: 'Phone number not found. Please request OTP again.',
      };
    }

    if (isMessageBotOtpEnabled()) {
      const response = await authenticatedFetch('/api/users', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          action: 'verify-otp-messagebot',
          phoneNumber: phone,
          otp,
          role,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        reason?: string;
        user?: User;
        accessToken?: string;
        refreshToken?: string;
        detectedRole?: string;
      };
      if (!response.ok || !data.success) {
        return {
          success: false,
          reason: data.reason || 'Invalid OTP',
        };
      }
      if (!data.user || !data.accessToken || !data.refreshToken) {
        return { success: false, reason: 'Invalid response from server.' };
      }
      const { establishSessionFromOtpAuth } = await import('./userService');
      establishSessionFromOtpAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      pendingOtpPhoneForVerification = null;
      return {
        success: true,
        sessionComplete: true,
        appUser: data.user,
      };
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) {
      return { success: false, reason: error.message || 'Invalid OTP' };
    }

    pendingOtpPhoneForVerification = null;

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

export const syncServiceProviderOAuth = supabaseSyncServiceProviderOAuth;
