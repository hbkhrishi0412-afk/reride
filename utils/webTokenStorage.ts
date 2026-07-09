/**
 * In-memory access token for first-party web when refresh tokens are HttpOnly cookies.
 * Avoids persisting JWTs in sessionStorage/localStorage (XSS surface).
 */

let memoryAccessToken: string | null = null;

export function getWebMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function setWebMemoryAccessToken(token: string | null): void {
  memoryAccessToken = token?.trim() || null;
}

export function clearWebMemoryAccessToken(): void {
  memoryAccessToken = null;
}
