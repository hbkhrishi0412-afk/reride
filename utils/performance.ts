// Performance monitoring utilities

/**
 * Measures and logs the performance of a function
 */
export const measurePerformance = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  label: string
): T => {
  return ((...args: Parameters<T>) => {
    const start = performance.now();
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const end = performance.now();
        console.log(`⚡ ${label}: ${(end - start).toFixed(2)}ms`);
      });
    }
    
    const end = performance.now();
    console.log(`⚡ ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }) as T;
};

/**
 * Reports Web Vitals metrics
 * Note: web-vitals package is optional. Install with: npm install web-vitals
 */
export const reportWebVitals = (onPerfEntry?: (metric: PerformanceEntry) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // Optional: Install web-vitals package for detailed metrics
    // For now, we'll use the built-in Performance API
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Use PerformanceObserver for basic metrics
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            onPerfEntry(entry);
          }
        });
        
        observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
        
        // Return cleanup function
        return () => {
          try {
            observer.disconnect();
          } catch (error) {
            console.warn('Error disconnecting PerformanceObserver:', error);
          }
        };
      } catch (error) {
        console.log('PerformanceObserver not available');
        return () => {}; // Return empty cleanup function
      }
    }
  }
  return () => {}; // Return empty cleanup function
};

/**
 * Debounce function to limit how often a function can fire
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function to ensure a function is only called once per specified time period
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Memoize function results for performance
 */
export const memoize = <T extends (...args: unknown[]) => unknown>(fn: T, maxCacheSize: number = 100): T => {
  const cache = new Map();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    
    // Prevent memory leaks by limiting cache size
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  }) as T;
};

/**
 * Log performance metrics to console
 */
export const logPerformanceMetrics = () => {
  if (typeof window !== 'undefined' && window.performance) {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    const connectTime = perfData.responseEnd - perfData.requestStart;
    const renderTime = perfData.domComplete - perfData.domLoading;
    
    console.group('📊 Performance Metrics');
    console.log(`Page Load Time: ${pageLoadTime}ms`);
    console.log(`Connect Time: ${connectTime}ms`);
    console.log(`Render Time: ${renderTime}ms`);
    console.groupEnd();
  }
};

/**
 * Check if user is on a slow connection
 */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}

export const isSlowConnection = (): boolean => {
  if ('connection' in navigator) {
    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    return conn ? !!(conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') : false;
  }
  return false;
};

/**
 * Preload critical resources
 */
export const preloadResource = (href: string, as: string, type?: string) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  if (type) link.type = type;
  document.head.appendChild(link);
};

