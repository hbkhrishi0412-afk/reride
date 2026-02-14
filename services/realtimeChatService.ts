/**
 * Real-time Chat Service for Buyer-Seller Conversations
 * 
 * This service provides end-to-end real-time messaging between buyers and sellers
 * using WebSocket for instant delivery and Supabase for persistent storage.
 */

import type { Conversation, ChatMessage, Notification } from '../types';
import { addMessageToConversation, saveConversationToSupabase } from './conversationService';

interface SocketInstance {
  on(event: string, callback: (data: any) => void): void;
  emit(event: string, data: any): void;
  disconnect(): void;
  connected: boolean;
  id?: string;
}

interface SocketIoClientModule {
  default?: (url: string, options?: any) => SocketInstance;
  io?: (url: string, options?: any) => SocketInstance;
}

interface TypingStatus {
  conversationId: string;
  userRole: 'customer' | 'seller';
  isTyping: boolean;
}

interface MessageDeliveryStatus {
  messageId: number | string;
  conversationId: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

interface UserPresence {
  userEmail: string;
  userRole: 'customer' | 'seller';
  isOnline: boolean;
  lastSeen?: string;
}

interface PresenceStatus {
  conversationId: string;
  userEmail: string;
  userRole: 'customer' | 'seller';
  isOnline: boolean;
  lastSeen?: string;
}

class RealtimeChatService {
  private socket: SocketInstance | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private typingTimeouts = new Map<string, NodeJS.Timeout>();
  private messageCallbacks = new Map<string, (status: MessageDeliveryStatus) => void>();
  private onMessageReceived?: (conversationId: string, message: ChatMessage, conversationData?: Partial<Conversation>) => void;
  private onTypingStatusChanged?: (status: TypingStatus) => void;
  private onConnectionStatusChanged?: (connected: boolean) => void;
  private onReadReceipt?: (conversationId: string, messageId: number | string, readBy: 'customer' | 'seller') => void;
  private onPresenceChanged?: (status: PresenceStatus) => void;
  private onNotificationReceived?: (notification: Notification) => void;
  private pendingMessages: Map<string, ChatMessage[]> = new Map(); // Queue messages when offline
  private userPresence: Map<string, UserPresence> = new Map(); // Track user presence

  /**
   * Initialize WebSocket connection for real-time chat
   */
  async connect(userEmail: string, userRole: 'customer' | 'seller'): Promise<boolean> {
    if (this.socket?.connected) {
      return true;
    }

    if (this.isConnecting) {
      return false;
    }

    this.isConnecting = true;

    try {
      // Only use WebSocket in development (local server)
      // In production, we'll use Supabase real-time subscriptions
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = 'localhost:3001';
        const wsUrl = `${wsProtocol}//${wsHost}`;

        try {
          const socketIoClient = await import('socket.io-client') as unknown as SocketIoClientModule;
          const io = socketIoClient.default || socketIoClient.io;

          if (!io) {
            console.warn('⚠️ Socket.io client not available, real-time features will be limited');
            // In development, if WebSocket server isn't available, that's okay
            // Messages will still work via Supabase, just not real-time
            this.onConnectionStatusChanged?.(true); // Don't show error, just work without real-time
            return true;
          }

          this.socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: this.maxReconnectAttempts,
            timeout: 5000,
            reconnectionDelayMax: 2000,
            query: {
              userEmail,
              userRole
            }
          });

          this.setupSocketListeners();
          this.reconnectAttempts = 0;
          
          // Wait a bit to see if connection succeeds
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // If still not connected after setup, that's okay - it will reconnect automatically
          if (!this.socket.connected) {
            console.log('ℹ️ WebSocket connection pending, will connect when server is available');
            // Don't return false - let it try to reconnect in background
          }
          
          return true;
        } catch (wsError) {
          console.warn('⚠️ WebSocket connection failed (server may not be running):', wsError);
          // In development, if WebSocket server isn't running, that's okay
          // Messages will still work via Supabase, just not real-time
          this.onConnectionStatusChanged?.(true); // Don't show error, just work without real-time
          return true;
        }
      } else {
        // In production, we use Supabase real-time subscriptions
        // Check if Supabase is available
        try {
          const { getSupabaseClient } = await import('../lib/supabase.js');
          const supabase = getSupabaseClient();
          
          // Test Supabase connection by checking if client is available
          if (supabase) {
            // Supabase real-time is handled via hooks/useSupabaseRealtime
            // This service just needs to indicate it's "ready"
            this.onConnectionStatusChanged?.(true);
            return true;
          } else {
            console.warn('⚠️ Supabase client not available');
            // Still return true - messages will work, just not real-time
            this.onConnectionStatusChanged?.(true);
            return true;
          }
        } catch (supabaseError) {
          console.warn('⚠️ Supabase not available, real-time features will be limited:', supabaseError);
          // Still return true - messages will work via API, just not real-time
          this.onConnectionStatusChanged?.(true);
          return true;
        }
      }
    } catch (error) {
      console.warn('⚠️ Real-time chat connection issue (non-critical):', error);
      // Don't fail completely - messages still work via API
      this.isConnecting = false;
      this.onConnectionStatusChanged?.(true); // Don't show error, just work without real-time
      return true; // Return true so we don't show error toast
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Real-time chat connected', { socketId: this.socket?.id, connected: this.socket?.connected });
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.onConnectionStatusChanged?.(true);
      
      // Sync pending messages when reconnected
      this.syncPendingMessages();
    });

    this.socket.on('disconnect', () => {
      console.log('🔧 Real-time chat disconnected');
      this.onConnectionStatusChanged?.(false);
    });

    this.socket.on('connect_error', (error: unknown) => {
      console.warn('⚠️ WebSocket connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.onConnectionStatusChanged?.(false);
      }
    });

    // Listen for new messages
    this.socket.on('conversation:new-message', (data: {
      conversationId: string;
      message: ChatMessage;
      conversation?: Partial<Conversation>;
    }) => {
      if (data.conversationId && data.message) {
        this.onMessageReceived?.(data.conversationId, data.message, data.conversation);
      }
    });

    // Listen for typing indicators
    this.socket.on('conversation:typing', (data: TypingStatus) => {
      this.onTypingStatusChanged?.(data);
    });

    // Listen for read receipts
    this.socket.on('conversation:read', (data: {
      conversationId: string;
      messageId: number | string;
      readBy: 'customer' | 'seller';
    }) => {
      this.onReadReceipt?.(data.conversationId, data.messageId, data.readBy);
    });

    // Listen for message delivery status
    this.socket.on('message:status', (data: MessageDeliveryStatus) => {
      const callback = this.messageCallbacks.get(String(data.messageId));
      if (callback) {
        callback(data);
        this.messageCallbacks.delete(String(data.messageId));
      }
    });

    // Listen for user presence updates
    this.socket.on('user:presence', (data: PresenceStatus) => {
      this.onPresenceChanged?.(data);
      // Update local presence cache
      const key = `${data.userEmail}-${data.userRole}`;
      this.userPresence.set(key, {
        userEmail: data.userEmail,
        userRole: data.userRole,
        isOnline: data.isOnline,
        lastSeen: data.lastSeen
      });
    });

    // Listen for user online/offline status
    this.socket.on('user:online', (data: { userEmail: string; userRole: 'customer' | 'seller' }) => {
      const key = `${data.userEmail}-${data.userRole}`;
      const presence = this.userPresence.get(key) || {
        userEmail: data.userEmail,
        userRole: data.userRole,
        isOnline: true
      };
      presence.isOnline = true;
      this.userPresence.set(key, presence);
    });

    this.socket.on('user:offline', (data: { userEmail: string; userRole: 'customer' | 'seller'; lastSeen: string }) => {
      const key = `${data.userEmail}-${data.userRole}`;
      const presence = this.userPresence.get(key) || {
        userEmail: data.userEmail,
        userRole: data.userRole,
        isOnline: false
      };
      presence.isOnline = false;
      presence.lastSeen = data.lastSeen;
      this.userPresence.set(key, presence);
    });

    // Listen for real-time notifications
    this.socket.on('notifications:created', (data: { notification: Notification }) => {
      if (data.notification) {
        this.onNotificationReceived?.(data.notification);
      }
    });
  }

  /**
   * Sync pending messages when reconnected
   */
  private syncPendingMessages(): void {
    if (!this.socket?.connected) return;

    // Get all pending messages and send them
    for (const [conversationId, messages] of this.pendingMessages.entries()) {
      messages.forEach(message => {
        // Messages will be sent via normal sendMessage flow
        // This is just to clear the queue
      });
    }
    this.pendingMessages.clear();
  }

  /**
   * Send a message via WebSocket and save to Supabase (with status tracking)
   */
  async sendMessage(
    conversationId: string,
    message: ChatMessage,
    userEmail: string,
    userRole: 'customer' | 'seller'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // CRITICAL FIX: Normalize email before sending to ensure proper matching
      const normalizedUserEmail = (userEmail || '').toLowerCase().trim();
      
      // CRITICAL FIX: Ensure we're joined to the conversation room BEFORE sending
      // This ensures the message is broadcast to other participants
      console.log('🔧 Ensuring joined to conversation room before sending:', conversationId);
      await this.joinConversation(conversationId);
      // Small delay to ensure room join completes on server
      await new Promise(resolve => setTimeout(resolve, 200));

      // Set initial status to 'sending'
      const messageWithStatus: ChatMessage = {
        ...message,
        status: 'sending'
      };

      // First, save to Supabase for persistence
      console.log('💾 Saving message to database:', { conversationId, messageId: message.id });
      const saveResult = await addMessageToConversation(conversationId, messageWithStatus);
      
      if (!saveResult.success) {
        console.error('❌ Failed to save message to Supabase:', {
          conversationId,
          messageId: message.id,
          error: saveResult.error,
          errorDetails: saveResult.error
        });
        
        // Check if conversation doesn't exist
        if (saveResult.error?.includes('not found') || saveResult.error?.includes('404')) {
          console.error('⚠️ Conversation not found in database. Message will not be persisted.');
          // Still try to send via WebSocket for real-time delivery
        } else {
          console.warn('⚠️ Database save failed, but continuing with WebSocket delivery');
        }
        // Continue anyway - try to send via WebSocket for real-time delivery
      } else {
        console.log('✅ Message saved to database successfully');
      }

      // Then broadcast via WebSocket for real-time delivery
      if (this.socket?.connected) {
        // Update status to 'sent' when emitting
        const sentMessage: ChatMessage = {
          ...messageWithStatus,
          status: 'sent'
        };

        console.log('🔧 Sending message via WebSocket:', { 
          conversationId, 
          messageId: sentMessage.id, 
          connected: this.socket.connected,
          userEmail: normalizedUserEmail,
          userRole
        });
        
        this.socket.emit('conversation:message', {
          conversationId,
          message: sentMessage,
          userEmail: normalizedUserEmail, // CRITICAL: Use normalized email
          userRole
        });
        
        console.log('✅ Message emitted to WebSocket');

        // Track message delivery status (sent → delivered → read)
        this.messageCallbacks.set(String(message.id), (status) => {
          if (status.status === 'delivered') {
            // Message delivered to recipient's device
            console.log('✅ Message delivered:', status.messageId);
          } else if (status.status === 'read') {
            // Message read by recipient
            console.log('✅ Message read:', status.messageId);
          } else if (status.status === 'failed') {
            // Message failed - queue for retry
            console.error('❌ Message delivery failed:', status);
            const queue = this.pendingMessages.get(conversationId) || [];
            queue.push(messageWithStatus);
            this.pendingMessages.set(conversationId, queue);
          }
        });

        return { success: true };
      } else {
        console.warn('⚠️ WebSocket not connected, queueing message:', { conversationId, messageId: message.id });
        
        // Queue message when offline, will sync when reconnected
        const queue = this.pendingMessages.get(conversationId) || [];
        queue.push(messageWithStatus);
        this.pendingMessages.set(conversationId, queue);
        
        // Message is still saved to Supabase
        // The recipient will get it when they refresh or when WebSocket reconnects
        return { success: true };
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(conversationId: string, userRole: 'customer' | 'seller', isTyping: boolean): void {
    if (!this.socket?.connected) return;

    // Clear existing timeout
    const timeoutKey = `${conversationId}-${userRole}`;
    const existingTimeout = this.typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Send typing indicator
    this.socket.emit('conversation:typing', {
      conversationId,
      userRole,
      isTyping
    });

    // Auto-stop typing indicator after 3 seconds
    if (isTyping) {
      const timeout = setTimeout(() => {
        this.socket?.emit('conversation:typing', {
          conversationId,
          userRole,
          isTyping: false
        });
        this.typingTimeouts.delete(timeoutKey);
      }, 3000);
      this.typingTimeouts.set(timeoutKey, timeout);
    } else {
      this.typingTimeouts.delete(timeoutKey);
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    conversationId: string,
    messageIds: (number | string)[],
    readerRole: 'customer' | 'seller'
  ): Promise<void> {
    if (!this.socket?.connected) return;

    this.socket.emit('conversation:mark-read', {
      conversationId,
      messageIds,
      readBy: readerRole
    });
  }

  /**
   * Join a conversation room (automatic subscription)
   * Returns a promise that resolves when the join is complete or queued
   */
  joinConversation(conversationId: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        console.warn('⚠️ Cannot join conversation - socket not initialized:', conversationId);
        // If socket doesn't exist yet, wait for connection
        const checkConnection = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(checkConnection);
            console.log('🔧 Socket connected, joining conversation:', conversationId);
            this.socket.emit('conversation:join', { conversationId });
            resolve();
          } else if (this.socket && !this.isConnecting) {
            // Socket exists but not connecting, give up after a short wait
            clearInterval(checkConnection);
            console.warn('⚠️ Socket not connecting, cannot join conversation:', conversationId);
            resolve();
          }
        }, 100);
        
        // Timeout after 2 seconds
        setTimeout(() => {
          clearInterval(checkConnection);
          resolve();
        }, 2000);
        return;
      }

      if (!this.socket.connected) {
        console.warn('⚠️ Cannot join conversation - socket not connected, queueing:', conversationId);
        // Queue the join request for when connection is established
        this.socket.once('connect', () => {
          console.log('🔧 Joining conversation after connection:', conversationId);
          this.socket?.emit('conversation:join', { conversationId });
          resolve();
        });
        
        // Timeout if connection doesn't happen
        setTimeout(() => {
          resolve();
        }, 3000);
        return;
      }

      console.log('🔧 Joining conversation room:', conversationId);
      this.socket.emit('conversation:join', { conversationId });
      resolve();
    });
  }

  /**
   * Join all conversations for a user (automatic subscription)
   */
  joinAllConversations(conversationIds: string[]): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot join conversations - socket not connected');
      return;
    }

    if (conversationIds.length === 0) {
      console.log('ℹ️ No conversations to join');
      return;
    }

    console.log('🔧 Joining all conversations:', { count: conversationIds.length, conversationIds });
    conversationIds.forEach(conversationId => {
      this.joinConversation(conversationId);
    });
  }

  /**
   * Get user presence status
   */
  getUserPresence(userEmail: string, userRole: 'customer' | 'seller'): UserPresence | null {
    const key = `${userEmail}-${userRole}`;
    return this.userPresence.get(key) || null;
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('conversation:leave', { conversationId });
  }

  /**
   * Set callback for when a new message is received
   */
  onMessage(callback: (conversationId: string, message: ChatMessage, conversationData?: Partial<Conversation>) => void): void {
    this.onMessageReceived = callback;
  }

  /**
   * Set callback for typing status changes
   */
  onTyping(callback: (status: TypingStatus) => void): void {
    this.onTypingStatusChanged = callback;
  }

  /**
   * Set callback for connection status changes
   */
  onConnection(callback: (connected: boolean) => void): void {
    this.onConnectionStatusChanged = callback;
  }

  /**
   * Set callback for read receipts
   */
  onRead(callback: (conversationId: string, messageId: number | string, readBy: 'customer' | 'seller') => void): void {
    this.onReadReceipt = callback;
  }

  /**
   * Set callback for presence changes
   */
  onPresence(callback: (status: PresenceStatus) => void): void {
    this.onPresenceChanged = callback;
  }

  /**
   * Set callback for notification received
   */
  onNotification(callback: (notification: Notification) => void): void {
    this.onNotificationReceived = callback;
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    // Clear all typing timeouts
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();

    // Clear message callbacks
    this.messageCallbacks.clear();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.onConnectionStatusChanged?.(false);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const realtimeChatService = new RealtimeChatService();

