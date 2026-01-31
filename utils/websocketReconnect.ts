/**
 * Resilient WebSocket Reconnection Utility
 * Handles network drops, connection failures, and exponential backoff
 */

export interface ReconnectOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onReconnect?: () => void;
  onMaxRetriesReached?: () => void;
}

export class ResilientWebSocket {
  private url: string;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isManualClose = false;
  private options: Required<ReconnectOptions>;
  private messageQueue: string[] = [];

  constructor(
    url: string,
    options: ReconnectOptions = {}
  ) {
    this.url = url;
    this.options = {
      maxRetries: options.maxRetries ?? 10,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      onReconnect: options.onReconnect ?? (() => {}),
      onMaxRetriesReached: options.onMaxRetriesReached ?? (() => {}),
    };
  }

  connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);
        
        this.socket.onopen = () => {
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          this.options.onReconnect();
          resolve(this.socket!);
        };

        this.socket.onerror = (error) => {
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        };

        this.socket.onclose = (event) => {
          if (!this.isManualClose && !event.wasClean) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxRetries) {
      this.options.onMaxRetriesReached();
      return;
    }

    const delay = Math.min(
      this.options.initialDelay * Math.pow(this.options.backoffMultiplier, this.reconnectAttempts),
      this.options.maxDelay
    );

    this.reconnectAttempts++;
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Connection failed, will retry on next attempt
      });
    }, delay);
  }

  private flushMessageQueue(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.socket.send(message);
        }
      }
    }
  }

  send(data: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(data);
      // Try to reconnect if not already attempting
      if (!this.reconnectTimeout && this.reconnectAttempts < this.options.maxRetries) {
        this.scheduleReconnect();
      }
    }
  }

  close(): void {
    this.isManualClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  getSocket(): WebSocket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}




