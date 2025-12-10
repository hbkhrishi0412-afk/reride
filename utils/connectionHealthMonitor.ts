/**
 * Connection Health Monitor
 * Monitors MongoDB connection health and provides status updates
 */

export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: number;
  responseTime?: number;
  error?: string;
}

let healthCache: ConnectionHealth | null = null;
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Checks MongoDB connection health via API
 */
export async function checkConnectionHealth(forceRefresh = false): Promise<ConnectionHealth> {
  const now = Date.now();
  
  // Return cached result if still valid
  if (!forceRefresh && healthCache && (now - healthCache.lastCheck) < CACHE_DURATION) {
    return healthCache;
  }

  const startTime = Date.now();
  
  try {
    const response = await fetch('/api/db-health', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      
      healthCache = {
        status: data.status === 'ok' ? 'healthy' : 'degraded',
        lastCheck: now,
        responseTime
      };
      
      return healthCache;
    } else {
      healthCache = {
        status: 'unhealthy',
        lastCheck: now,
        responseTime,
        error: `HTTP ${response.status}`
      };
      
      return healthCache;
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    healthCache = {
      status: 'unhealthy',
      lastCheck: now,
      responseTime,
      error: errorMessage
    };
    
    return healthCache;
  }
}

/**
 * Gets cached health status without making a request
 */
export function getCachedHealth(): ConnectionHealth | null {
  return healthCache;
}

/**
 * Clears health cache
 */
export function clearHealthCache(): void {
  healthCache = null;
}

/**
 * Starts periodic health monitoring
 */
export function startHealthMonitoring(
  intervalMs: number = 60000, // Default: 1 minute
  onHealthChange?: (health: ConnectionHealth) => void
): () => void {
  let lastStatus: ConnectionHealth['status'] | null = null;

  const checkHealth = async () => {
    const health = await checkConnectionHealth(true);
    
    // Notify if status changed
    if (onHealthChange && health.status !== lastStatus) {
      onHealthChange(health);
      lastStatus = health.status;
    }
  };

  // Initial check
  checkHealth();

  // Set up interval
  const intervalId = setInterval(checkHealth, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

