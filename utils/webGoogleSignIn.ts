/**
 * Web Google Sign-In via Google Identity Services (FedCM / One Tap).
 * Returns an ID token for Supabase `signInWithIdToken` — no full-page OAuth redirect.
 *
 * Requires VITE_GOOGLE_WEB_CLIENT_ID (Web OAuth client) listed in Supabase Google provider
 * and the site origin under Google Cloud → Authorized JavaScript origins.
 */

import { Capacitor } from '@capacitor/core';
import { getNativeGoogleWebClientId } from './nativeGoogleSignIn.js';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GIS_PROMPT_FALLBACK_MS = 4_000;

type CredentialResponse = { credential?: string };
type PromptMomentNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getDismissedReason?: () => string;
};

type GoogleAccountsId = {
  initialize: (config: Record<string, unknown>) => void;
  prompt: (momentListener?: (n: PromptMomentNotification) => void) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

let scriptPromise: Promise<void> | null = null;

export function shouldTryWebGoogleIdToken(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return false;
  return Boolean(getNativeGoogleWebClientId());
}

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Google Sign-In'));
    };
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    scriptPromise = null;
    throw err;
  });

  return scriptPromise;
}

/** Pre-load GIS on the login screen so the first Google tap opens the account UI immediately. */
export function warmUpWebGoogleSignIn(): void {
  if (!shouldTryWebGoogleIdToken()) return;
  void loadGisScript().catch(() => {
    /* next tap retries */
  });
}

/**
 * Shows Google's on-page account chooser and resolves with an ID token.
 * Throws `GisUnavailableError` when FedCM/One Tap cannot be shown (caller falls back to OAuth).
 * Throws `AbortError` when the user dismisses the prompt.
 */
export async function signInWithGoogleWebIdToken(): Promise<{ idToken: string }> {
  const clientId = getNativeGoogleWebClientId();
  if (!clientId) {
    throw new Error('VITE_GOOGLE_WEB_CLIENT_ID is not set');
  }

  await loadGisScript();
  const googleId = window.google?.accounts?.id;
  if (!googleId) {
    const err = new Error('Google Sign-In unavailable');
    err.name = 'GisUnavailableError';
    throw err;
  }

  try {
    googleId.cancel();
  } catch {
    /* ignore */
  }

  return new Promise<{ idToken: string }>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        try {
          googleId.cancel();
        } catch {
          /* ignore */
        }
        const err = new Error('Google Sign-In prompt timed out');
        err.name = 'GisUnavailableError';
        reject(err);
      });
    }, GIS_PROMPT_FALLBACK_MS);

    googleId.initialize({
      client_id: clientId,
      // Returning users: auto-select the last account when FedCM allows it.
      auto_select: true,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      context: 'signin',
      callback: (response: CredentialResponse) => {
        finish(() => {
          if (response?.credential) {
            resolve({ idToken: response.credential });
            return;
          }
          reject(new Error('Google did not return a sign-in credential'));
        });
      },
    });

    googleId.prompt((notification: PromptMomentNotification) => {
      if (settled) return;
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        finish(() => {
          const err = new Error('Google Sign-In prompt unavailable');
          err.name = 'GisUnavailableError';
          reject(err);
        });
        return;
      }
      if (notification.isDismissedMoment()) {
        const reason = notification.getDismissedReason?.() || '';
        if (reason === 'credential_returned') return;
        finish(() => {
          const err = new Error('Sign in was canceled');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  });
}
