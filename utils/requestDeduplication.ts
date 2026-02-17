/**
 * Request Deduplication Utility
 * Prevents duplicate API calls for the same resource within a short time window
 * Improves performance by caching in-flight requests
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

// Cache of in-flight requests
const pendingRequests = new Map<string, PendingRequest<any>>();

// Cache of completed requests (short-term cache to prevent rapid duplicate calls)
const completedRequests = new Map<string, { data: any; timestamp: number }>();

// Default cache TTL: 1 second (prevents duplicate calls within 1 second)
const DEFAULT_CACHE_TTL = 1000;

/**
 * Deduplicates API requests - if the same request is made multiple times,
 * returns the same promise instead of making multiple API calls
 * 
 * @param key - Unique key for the request (e.g., 'vehicles', 'users', 'api/vehicles')
 * @param requestFn - Function that returns a Promise for the API call
 * @param cacheTTL - Time to live for completed request cache (ms), default 1000ms
 * @returns Promise that resolves to the request result
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  cacheTTL: number = DEFAULT_CACHE_TTL
): Promise<T> {
  // Check if there's a completed request within the cache TTL
  const completed = completedRequests.get(key);
  if (completed && Date.now() - completed.timestamp < cacheTTL) {
    return Promise.resolve(completed.data);
  }

  // Check if there's already an in-flight request
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending.promise;
  }

  // Create new request
  const promise = requestFn()
    .then((data) => {
      // Cache the result
      completedRequests.set(key, {
        data,
        timestamp: Date.now()
      });
      
      // Remove from pending after a short delay (allows other calls to join)
      setTimeout(() => {
        pendingRequests.delete(key);
      }, 100);
      
      return data;
    })
    .catch((error) => {
      // Remove from pending on error
      pendingRequests.delete(key);
      throw error;
    });

  // Store as pending
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now()
  });

  return promise;
}

/**
 * Clears the request cache (useful for testing or forced refresh)
 */
export function clearRequestCache(): void {
  pendingRequests.clear();
  completedRequests.clear();
}

/**
 * Clears a specific request from cache
 */
export function clearRequestCacheKey(key: string): void {
  pendingRequests.delete(key);
  completedRequests.delete(key);
}








