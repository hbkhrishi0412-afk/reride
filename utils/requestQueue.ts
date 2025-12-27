/**
 * Request Queue Utility
 * Staggers API requests to prevent rate limiting
 * Implements exponential backoff for 429 errors
 */

interface QueuedRequest<T> {
  id: string;
  request: () => Promise<T>;
  priority: number; // Higher priority = executed first
  retries: number;
  maxRetries: number;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private delayBetweenRequests = 200; // 200ms delay between requests
  private baseBackoffDelay = 1000; // 1 second base delay for retries

  /**
   * Add a request to the queue
   */
  async enqueue<T>(
    request: () => Promise<T>,
    options: {
      priority?: number;
      maxRetries?: number;
      id?: string;
    } = {}
  ): Promise<T> {
    const {
      priority = 0,
      maxRetries = 3,
      id = `req_${Date.now()}_${Math.random()}`
    } = options;

    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id,
        request,
        priority,
        retries: 0,
        maxRetries,
        resolve,
        reject
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(req => req.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queuedRequest);
      } else {
        this.queue.splice(insertIndex, 0, queuedRequest);
      }

      this.processQueue();
    });
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const queuedRequest = this.queue.shift();
      if (!queuedRequest) break;

      try {
        const result = await this.executeRequest(queuedRequest);
        queuedRequest.resolve(result);
      } catch (error: any) {
        // Handle rate limiting (429) with exponential backoff
        if (error.status === 429 || error.code === 429 || (error.response && error.response.status === 429)) {
          if (queuedRequest.retries < queuedRequest.maxRetries) {
            queuedRequest.retries++;
            const backoffDelay = this.baseBackoffDelay * Math.pow(2, queuedRequest.retries - 1);
            
            console.warn(`⚠️ Rate limited (429). Retrying request ${queuedRequest.id} after ${backoffDelay}ms (attempt ${queuedRequest.retries}/${queuedRequest.maxRetries})`);
            
            // Re-queue with higher priority (so it gets processed after backoff)
            setTimeout(() => {
              this.queue.unshift(queuedRequest); // Add to front of queue
              this.processQueue();
            }, backoffDelay);
            
            // Wait before processing next request
            await this.delay(backoffDelay);
            continue;
          } else {
            console.error(`❌ Request ${queuedRequest.id} failed after ${queuedRequest.maxRetries} retries due to rate limiting`);
            queuedRequest.reject(new Error('Too many requests. Please wait a moment and try again.'));
          }
        } else {
          // For other errors, reject immediately
          queuedRequest.reject(error);
        }
      }

      // Delay between requests to prevent rate limiting
      if (this.queue.length > 0) {
        await this.delay(this.delayBetweenRequests);
      }
    }

    this.processing = false;
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest<T>(queuedRequest: QueuedRequest<T>): Promise<T> {
    try {
      return await queuedRequest.request();
    } catch (error: any) {
      // Check if it's a 429 error
      if (error.status === 429 || 
          error.code === 429 || 
          (error.response && error.response.status === 429) ||
          (error.message && error.message.includes('429')) ||
          (error.message && error.message.includes('Too many requests'))) {
        throw { ...error, status: 429, code: 429 };
      }
      throw error;
    }
  }

  /**
   * Utility to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.forEach(req => {
      req.reject(new Error('Request queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Get queue length
   */
  getLength(): number {
    return this.queue.length;
  }
}

// Singleton instance
export const requestQueue = new RequestQueue();

/**
 * Helper function to queue API requests
 */
export async function queueRequest<T>(
  request: () => Promise<T>,
  options?: {
    priority?: number;
    maxRetries?: number;
    id?: string;
  }
): Promise<T> {
  return requestQueue.enqueue(request, options);
}

/**
 * Batch multiple requests with delays between them
 */
export async function batchRequests<T>(
  requests: Array<() => Promise<T>>,
  options?: {
    delayBetweenRequests?: number;
    priority?: number;
  }
): Promise<T[]> {
  const { delayBetweenRequests = 200, priority = 0 } = options || {};
  const results: T[] = [];

  for (let i = 0; i < requests.length; i++) {
    const result = await queueRequest(requests[i], { priority, id: `batch_${i}` });
    results.push(result);
    
    // Delay between requests (except for the last one)
    if (i < requests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }

  return results;
}

