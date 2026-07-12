import { isRateLimitError, retryDelayMs } from '../utils/rateLimitClient.js';

describe('rateLimitClient', () => {
  it('detects rate limit errors on web and mobile clients', () => {
    expect(isRateLimitError(new Error('Too many requests. Please try again later.'))).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError(new Error('Network error'))).toBe(false);
  });

  it('uses Retry-After when provided', () => {
    expect(retryDelayMs(10, 0)).toBe(10_000);
  });

  it('falls back to exponential backoff', () => {
    expect(retryDelayMs(null, 1)).toBe(4000);
  });
});
