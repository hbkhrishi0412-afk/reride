/**
 * Cache Manager Utility
 * Implements intelligent caching strategy for API responses and static data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxAge?: number; // Max age in milliseconds (alternative to ttl)
}

const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes default
const CACHE_PREFIX = 'reride_cache_';

/**
 * Cache Manager Class
 */
class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private maxMemorySize = 50; // Max entries in memory cache

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    // Try memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      return memoryEntry.data as T;
    }
    if (memoryEntry) {
      this.memoryCache.delete(key); // Expired, remove it
    }

    // Try localStorage (persistent)
    try {
      const stored = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      
      // Check expiration
      if (entry.expiresAt > Date.now()) {
        // Restore to memory cache
        this.setMemoryCache(key, entry);
        return entry.data;
      } else {
        // Expired, remove it
        localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || options.maxAge || DEFAULT_TTL;
    const expiresAt = Date.now() + ttl;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt
    };

    // Store in memory cache
    this.setMemoryCache(key, entry);

    // Store in localStorage (persistent)
    try {
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (error) {
      // Handle quota exceeded
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, clearing old cache entries');
        this.clearExpired();
        // Try again
        try {
          localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
        } catch (retryError) {
          console.warn('Failed to cache after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Set memory cache with size limit
   */
  private setMemoryCache<T>(key: string, entry: CacheEntry<T>): void {
    // Remove oldest entries if cache is full
    if (this.memoryCache.size >= this.maxMemorySize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, entry);
  }

  /**
   * Clear expired cache entries
   */
  clearExpired(): void {
    const now = Date.now();
    
    // Clear memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }

    // Clear localStorage
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX)) {
          try {
            const entry: CacheEntry<any> = JSON.parse(localStorage.getItem(key) || '{}');
            if (entry.expiresAt && entry.expiresAt <= now) {
              localStorage.removeItem(key);
            }
          } catch {
            // Invalid entry, remove it
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn('Error clearing expired cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Error clearing cache:', error);
    }
  }

  /**
   * Clear cache by key pattern
   */
  clearByPattern(pattern: string): void {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear localStorage
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX) && key.includes(pattern)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Error clearing cache by pattern:', error);
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

/**
 * Cache wrapper for API calls
 */
export async function cachedFetch<T>(
  url: string,
  options: RequestInit = {},
  cacheOptions: CacheOptions = {}
): Promise<T> {
  const cacheKey = `api_${url}_${JSON.stringify(options)}`;
  
  // Try cache first
  const cached = cacheManager.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Fetch from API
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json() as T;
  
  // Cache the response
  cacheManager.set(cacheKey, data, cacheOptions);
  
  return data;
}

/**
 * Cache vehicle listings with optimized TTL
 */
export function cacheVehicles(vehicles: any[], ttl: number = 10 * 60 * 1000): void {
  cacheManager.set('vehicles_list', vehicles, { ttl });
}

/**
 * Get cached vehicles
 */
export function getCachedVehicles(): any[] | null {
  return cacheManager.get<any[]>('vehicles_list');
}

// Clean up expired cache on load
if (typeof window !== 'undefined') {
  cacheManager.clearExpired();
  
  // Clean up expired cache every 5 minutes
  setInterval(() => {
    cacheManager.clearExpired();
  }, 5 * 60 * 1000);
}


