/**
 * Real-time Chat Service for Buyer-Seller Conversations
 * 
 * This service provides end-to-end real-time messaging between buyers and sellers
 * using WebSocket for instant delivery and Supabase for persistent storage.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Conversation, ChatMessage, Notification } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { addMessageToConversation, saveConversationToSupabase } from './conversationService';
import {
  getMobileLocalApiOrigin,
  isLocalDevApiReachable,
  isLocalSocketIoEnvironment,
} from '../utils/apiConfig';

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

/** Per-thread metadata for Supabase Realtime broadcast (typing) + presence (online). */
export interface ChatEphemeralThreadMeta {
  conversationId: string;
  counterpartEmail: string;
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
  private onReadReceipt?: (
    conversationId: string,
    messageIds: (number | string)[],
    readBy: 'customer' | 'seller',
  ) => void;
  private onPresenceChanged?: (status: PresenceStatus) => void;
  private onNotificationReceived?: (notification: Notification) => void;
  private pendingMessages: Map<string, ChatMessage[]> = new Map(); // Queue messages when offline
  private userPresence: Map<string, UserPresence> = new Map(); // Track user presence
  private lastUserEmail = '';
  private lastUserRole: 'customer' | 'seller' = 'customer';
  private supabaseEphemeralChannels = new Map<string, RealtimeChannel>();
  private lastEphemeralSyncArgs: {
    metas: ChatEphemeralThreadMeta[];
    email: string;
    role: 'customer' | 'seller';
  } | null = null;

  /**
   * Subscribe to Supabase broadcast+presence per conversation when Socket.io is not in use
   * (production / mobile). Keeps typing + online indicators in sync with low latency.
   */
  syncChatEphemeralChannels(
    metas: ChatEphemeralThreadMeta[],
    myEmail: string,
    myRole: 'customer' | 'seller',
  ): void {
    this.lastEphemeralSyncArgs = { metas, email: myEmail, role: myRole };
    if (this.socket?.connected) {
      this.teardownSupabaseEphemeral();
      return;
    }
    this.applySupabaseEphemeralSubscriptions(metas, myEmail, myRole);
  }

  private teardownSupabaseEphemeral(): void {
    if (this.supabaseEphemeralChannels.size === 0) return;
    try {
      const supabase = getSupabaseClient();
      for (const ch of this.supabaseEphemeralChannels.values()) {
        try {
          supabase.removeChannel(ch);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    this.supabaseEphemeralChannels.clear();
  }

  private applySupabaseEphemeralSubscriptions(
    metas: ChatEphemeralThreadMeta[],
    myEmail: string,
    myRole: 'customer' | 'seller',
  ): void {
    if (typeof window === 'undefined') return;

    const norm = (e: string) => (e || '').toLowerCase().trim();
    const me = norm(myEmail);
    if (!me) {
      this.teardownSupabaseEphemeral();
      return;
    }

    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch {
      return;
    }

    const counterpartRole: 'customer' | 'seller' = myRole === 'customer' ? 'seller' : 'customer';
    const want = new Set(metas.map((m) => String(m.conversationId)));

    for (const id of [...this.supabaseEphemeralChannels.keys()]) {
      if (!want.has(id)) {
        const ch = this.supabaseEphemeralChannels.get(id);
        if (ch) {
          try {
            supabase.removeChannel(ch);
          } catch {
            /* ignore */
          }
        }
        this.supabaseEphemeralChannels.delete(id);
      }
    }

    for (const m of metas) {
      const convId = String(m.conversationId);
      if (this.supabaseEphemeralChannels.has(convId)) continue;

      const counterpart = norm(m.counterpartEmail);
      if (!counterpart) continue;

      const topic = `reride-chat-${convId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      const ch = supabase
        .channel(topic, {
          config: {
            broadcast: { self: false },
            presence: { key: me },
          },
        })
        .on(
          'broadcast',
          { event: 'typing' },
          (evt: { payload?: { userRole?: string; isTyping?: boolean } } | { userRole?: string; isTyping?: boolean }) => {
            const raw = evt as { payload?: { userRole?: string; isTyping?: boolean }; userRole?: string; isTyping?: boolean };
            const p = raw.payload ?? raw;
            if (!p || (p.userRole !== 'customer' && p.userRole !== 'seller')) return;
            this.onTypingStatusChanged?.({
              conversationId: convId,
              userRole: p.userRole as 'customer' | 'seller',
              isTyping: !!p.isTyping,
            });
          },
        )
        .on('presence', { event: 'sync' }, () => {
          try {
            const state = ch.presenceState();
            const keys = Object.keys(state).map(norm);
            const online = keys.includes(counterpart);
            this.onPresenceChanged?.({
              conversationId: convId,
              userEmail: m.counterpartEmail,
              userRole: counterpartRole,
              isOnline: online,
            });
          } catch {
            /* ignore */
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            void ch.track({ role: myRole, online_at: new Date().toISOString() }).catch(() => {});
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.supabaseEphemeralChannels.delete(convId);
          }
        });

      this.supabaseEphemeralChannels.set(convId, ch);
    }
  }

  private refreshEphemeralAfterSocketDisconnect(): void {
    if (!this.lastEphemeralSyncArgs) return;
    const { metas, email, role } = this.lastEphemeralSyncArgs;
    queueMicrotask(() => {
      if (this.socket?.connected) return;
      this.applySupabaseEphemeralSubscriptions(metas, email, role);
    });
  }

  private sendTypingSupabaseBroadcast(
    conversationId: string,
    userRole: 'customer' | 'seller',
    isTyping: boolean,
  ): void {
    const ch = this.supabaseEphemeralChannels.get(String(conversationId));
    if (!ch) return;
    try {
      void ch.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userRole, isTyping, ts: Date.now() },
      });
    } catch {
      /* ignore */
    }
  }

  /**
   * Initialize WebSocket connection for real-time chat
   */
  async connect(userEmail: string, userRole: 'customer' | 'seller'): Promise<boolean> {
    this.lastUserEmail = userEmail;
    this.lastUserRole = userRole;

    if (this.socket?.connected) {
      return true;
    }

    if (this.isConnecting) {
      return false;
    }

    this.isConnecting = true;

    try {
      // Local Node Socket.io only when the page can reach the dev API (not Android APK / WebViewAssetLoader).
      // Vite sets DEV=true for `build --mode development`; that must not imply localhost:3001 on a device.
      const useLocalSocketIo = isLocalSocketIoEnvironment();

      if (useLocalSocketIo) {
        const disableSocket =
          typeof import.meta !== 'undefined' &&
          String((import.meta as any).env?.VITE_DISABLE_DEV_SOCKET || '').toLowerCase() === 'true';
        if (disableSocket) {
          this.onConnectionStatusChanged?.(true);
          return true;
        }

        const apiUp = await isLocalDevApiReachable();
        if (!apiUp) {
          if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
            console.info(
              'ℹ️ Local dev API not reachable (start `npm run dev:api` or `npm run dev` for Socket.io). Chat uses Supabase only.',
            );
          }
          this.onConnectionStatusChanged?.(true);
          return true;
        }

        // dev-api-server uses HTTP only; `wss://` from an https WebView never matches the server.
        const socketOrigin = getMobileLocalApiOrigin();

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

          this.socket = io(socketOrigin, {
            transports: ['websocket', 'polling'],
            secure: false,
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
      this.teardownSupabaseEphemeral();
      this.onConnectionStatusChanged?.(true);

      // Sync pending messages when reconnected
      this.syncPendingMessages();
    });

    this.socket.on('disconnect', () => {
      console.log('🔧 Real-time chat disconnected');
      this.onConnectionStatusChanged?.(false);
      this.refreshEphemeralAfterSocketDisconnect();
    });

    this.socket.on('connect_error', (error: unknown) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts === 1) {
        console.warn('⚠️ Socket.io connect error (dev API may have stopped):', error);
      }
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.socket?.disconnect();
        this.socket = null;
        this.onConnectionStatusChanged?.(false);
        this.refreshEphemeralAfterSocketDisconnect();
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

    // Listen for read receipts (server emits messageIds[])
    this.socket.on(
      'conversation:read',
      (data: {
        conversationId: string;
        messageIds?: (number | string)[];
        messageId?: number | string;
        readBy: 'customer' | 'seller';
      }) => {
        const ids =
          Array.isArray(data.messageIds) && data.messageIds.length > 0
            ? data.messageIds
            : data.messageId != null
              ? [data.messageId]
              : [];
        if (ids.length > 0) {
          this.onReadReceipt?.(data.conversationId, ids, data.readBy);
        }
      },
    );

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

    const userEmail = this.lastUserEmail;
    const userRole = this.lastUserRole;

    for (const [conversationId, messages] of this.pendingMessages.entries()) {
      for (const message of messages) {
        const sentMessage: ChatMessage = {
          ...message,
          status: 'sent',
        };
        this.socket.emit('conversation:message', {
          conversationId,
          message: sentMessage,
          userEmail: userEmail.toLowerCase().trim(),
          userRole,
        });
      }
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
  ): Promise<{ success: boolean; error?: string; persisted: boolean }> {
    try {
      // CRITICAL FIX: Normalize email before sending to ensure proper matching
      const normalizedUserEmail = (userEmail || '').toLowerCase().trim();

      // Dev-only: Socket.io rooms. Production uses Supabase Realtime on conversations — no socket, no waits.
      if (this.socket) {
        console.log('🔧 Joining conversation room before send (Socket.io):', conversationId);
        await this.joinConversation(conversationId);
      }

      // Ephemeral UI status — do not persist. Production has no Socket.io acks; saving `sending` made
      // Supabase realtime merges overwrite the bubble with a stuck clock forever.
      const messageForPersistence: ChatMessage = { ...message };
      delete messageForPersistence.status;
      const messageWithStatus: ChatMessage = {
        ...message,
        status: 'sending'
      };

      // First, save to Supabase for persistence (no delivery status in JSON column)
      console.log('💾 Saving message to database:', { conversationId, messageId: message.id });
      const saveResult = await addMessageToConversation(conversationId, messageForPersistence);
      const persisted = !!saveResult.success;

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

        return { success: true, persisted };
      }

      console.warn('⚠️ WebSocket not connected (using API + Supabase Realtime only):', {
        conversationId,
        messageId: message.id,
      });

      return { success: true, persisted };
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        persisted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send typing indicator (Socket.io in local dev, Supabase broadcast in production).
   */
  sendTypingIndicator(conversationId: string, userRole: 'customer' | 'seller', isTyping: boolean): void {
    const timeoutKey = `${conversationId}-${userRole}`;
    const existingTimeout = this.typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.typingTimeouts.delete(timeoutKey);
    }

    const emitNow = () => {
      if (this.socket?.connected) {
        this.socket.emit('conversation:typing', {
          conversationId,
          userRole,
          isTyping,
        });
      } else {
        this.sendTypingSupabaseBroadcast(conversationId, userRole, isTyping);
      }
    };

    emitNow();

    if (isTyping) {
      const timeout = setTimeout(() => {
        if (this.socket?.connected) {
          this.socket.emit('conversation:typing', {
            conversationId,
            userRole,
            isTyping: false,
          });
        } else {
          this.sendTypingSupabaseBroadcast(conversationId, userRole, false);
        }
        this.typingTimeouts.delete(timeoutKey);
      }, 3000);
      this.typingTimeouts.set(timeoutKey, timeout);
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
        // Production (and any env without Socket.io): no room to join — do not block sends.
        resolve();
        return;
      }

      if (!this.socket.connected) {
        console.warn('⚠️ Cannot join conversation - socket not connected, queueing:', conversationId);
        // Queue the join request for when connection is established
        (this.socket as any).once('connect', () => {
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
  onRead(
    callback: (
      conversationId: string,
      messageIds: (number | string)[],
      readBy: 'customer' | 'seller',
    ) => void,
  ): void {
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

    this.teardownSupabaseEphemeral();
    this.lastEphemeralSyncArgs = null;

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

