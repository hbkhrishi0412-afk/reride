/**
 * Shared rate-limit helpers for **web and Capacitor mobile** clients.
 * Both platforms call the same `/api/*` gateway tiers — this module keeps
 * retry/backoff behaviour consistent everywhere.
 */

export function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return /too many requests|rate limit|429/i.test(err.message);
  }
  if (typeof err === 'object' && err !== null) {
    const status = (err as { status?: number; code?: number }).status ?? (err as { code?: number }).code;
    if (status === 429) return true;
  }
  return false;
}

export function parseRetryAfterSeconds(response: Response): number | null {
  const header = response.headers.get('Retry-After');
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.max(1, Math.ceil((dateMs - Date.now()) / 1000));
  }
  return null;
}

export function retryDelayMs(retryAfterSeconds: number | null | undefined, attempt: number): number {
  if (retryAfterSeconds != null && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds, 30) * 1000;
  }
  return Math.min(2000 * 2 ** attempt, 15000);
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry only on HTTP 429 / rate-limit errors (web + mobile). */
export async function withRateLimitRetry<T>(
  fn: (attempt: number) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const is429 =
        isRateLimitError(err) ||
        (typeof err === 'object' &&
          err !== null &&
          ((err as { status?: number }).status === 429 || (err as { code?: number }).code === 429));
      if (!is429 || attempt >= maxAttempts - 1) throw err;
      const retryAfter =
        typeof err === 'object' && err !== null
          ? (err as { retryAfter?: number }).retryAfter
          : undefined;
      await sleepMs(retryDelayMs(retryAfter ?? null, attempt));
    }
  }
  throw lastError;
}
