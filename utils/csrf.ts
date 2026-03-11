/**
 * CSRF token utilities for server and client.
 * Token is generated server-side, stored in cookie (httpOnly=false so client can read for SPA),
 * and must be sent in X-CSRF-Token header for state-changing requests.
 */

import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'reride_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_BYTES = 32;

export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}

export function getCsrfCookieName(): string {
  return CSRF_COOKIE_NAME;
}

/**
 * Generate a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('hex');
}

/**
 * Validate that the token from the request header matches the cookie.
 * Cookie is set by the server when sending the token endpoint response.
 */
export function validateCsrfToken(headerToken: string | undefined, cookieToken: string | undefined): boolean {
  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== CSRF_TOKEN_BYTES * 2) return false;
  return headerToken === cookieToken && /^[a-f0-9]+$/i.test(headerToken);
}
