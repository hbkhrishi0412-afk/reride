/**
 * Native Google Sign-In (Credential Manager on Android, Google SDK on iOS) via
 * @capawesome/capacitor-google-sign-in. Tokens are exchanged with Supabase using
 * signInWithIdToken — no Chrome Custom Tab for the OAuth round-trip.
 *
 * Requires VITE_GOOGLE_WEB_CLIENT_ID = OAuth **Web application** client ID from Google Cloud
 * (same type as Supabase Google provider uses). Android also needs an Android OAuth client
 * with your app SHA-1 + package com.reride.app registered in the same GCP project.
 */

import { Capacitor } from '@capacitor/core';

const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const;

let initPromise: Promise<void> | null = null;

export function getNativeGoogleWebClientId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const id = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim();
  return id || undefined;
}

/** True on native Capacitor when a Web client ID is configured (try native sign-in first). */
export function shouldTryNativeGoogleSignIn(): boolean {
  if (typeof window === 'undefined') return false;
  if (!getNativeGoogleWebClientId()) return false;
  const p = Capacitor.getPlatform();
  return p === 'android' || p === 'ios';
}

async function ensureGoogleSignInInitialized(clientId: string): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
      await GoogleSignIn.initialize({
        clientId,
        scopes: [...GOOGLE_SCOPES],
      });
    })().catch((err: unknown) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

/**
 * Pre-load Google Sign-In on native (Android/iOS) so the first tap is faster
 * (typical app behavior: SDK ready before the user opens the login screen).
 */
export function warmUpNativeGoogleSignIn(): void {
  if (!shouldTryNativeGoogleSignIn()) return;
  const id = getNativeGoogleWebClientId();
  if (!id) return;
  void ensureGoogleSignInInitialized(id).catch(() => {
    /* next sign-in tap will retry initialize */
  });
}

function isUserCanceledError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const o = e as { code?: string; message?: string };
  const code = (o.code || '').toString();
  if (code === 'SIGN_IN_CANCELED' || code.includes('CANCEL')) return true;
  const msg = (o.message || '').toLowerCase();
  return msg.includes('cancel') || msg.includes('canceled') || msg.includes('cancelled');
}

/**
 * Presents the system Google account picker and returns ID (and optional access) tokens.
 */
export async function signInWithGoogleNative(): Promise<{
  idToken: string;
  accessToken: string | null;
}> {
  const clientId = getNativeGoogleWebClientId();
  if (!clientId) {
    throw new Error('VITE_GOOGLE_WEB_CLIENT_ID is not set');
  }
  await ensureGoogleSignInInitialized(clientId);
  const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
  try {
    const result = await GoogleSignIn.signIn();
    if (!result?.idToken) {
      throw new Error('Google did not return an ID token');
    }
    return { idToken: result.idToken, accessToken: result.accessToken };
  } catch (e: unknown) {
    if (isUserCanceledError(e)) {
      const err = new Error('Sign in was canceled');
      err.name = 'AbortError';
      throw err;
    }
    throw e;
  }
}

/** Clears native Google session state (best-effort after Supabase sign-out). */
export async function signOutGoogleNativeIfAvailable(): Promise<void> {
  if (!shouldTryNativeGoogleSignIn()) return;
  try {
    const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
    await GoogleSignIn.signOut();
  } catch {
    /* ignore */
  }
}
