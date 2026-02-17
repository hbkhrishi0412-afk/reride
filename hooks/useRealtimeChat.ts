/**
 * React Hook for Real-time Chat Service
 * 
 * Provides easy access to real-time chat functionality for components
 */

import { useEffect, useCallback, useState } from 'react';
import { realtimeChatService } from '../services/realtimeChatService';
import type { Conversation, ChatMessage } from '../types';

interface UseRealtimeChatOptions {
  conversationId?: string;
  userEmail?: string;
  userRole?: 'customer' | 'seller';
  onMessageReceived?: (message: ChatMessage) => void;
  onTypingStatusChanged?: (isTyping: boolean, userRole: 'customer' | 'seller') => void;
}

interface UseRealtimeChatReturn {
  isConnected: boolean;
  sendMessage: (message: string) => Promise<{ success: boolean; error?: string }>;
  sendTypingIndicator: (isTyping: boolean) => void;
  markAsRead: (messageIds: (number | string)[]) => Promise<void>;
  joinConversation: () => void;
  leaveConversation: () => void;
}

/**
 * Hook for real-time chat functionality
 */
export function useRealtimeChat(options: UseRealtimeChatOptions): UseRealtimeChatReturn {
  const {
    conversationId,
    userEmail,
    userRole,
    onMessageReceived,
    onTypingStatusChanged
  } = options;

  const [isConnected, setIsConnected] = useState(false);

  // Connect to chat service when user info is available
  useEffect(() => {
    if (!userEmail || !userRole) {
      return;
    }

    realtimeChatService.connect(userEmail, userRole).then((connected) => {
      setIsConnected(connected);
    });

    // Setup connection status callback
    const handleConnection = (connected: boolean) => {
      setIsConnected(connected);
    };

    realtimeChatService.onConnection(handleConnection);

    return () => {
      // Don't disconnect on cleanup - keep connection alive
      // The service manages its own lifecycle
    };
  }, [userEmail, userRole]);

  // Setup message received callback
  useEffect(() => {
    if (!conversationId || !onMessageReceived) {
      return;
    }

    const handleMessage = (convId: string, message: ChatMessage) => {
      if (convId === conversationId) {
        onMessageReceived(message);
      }
    };

    realtimeChatService.onMessage(handleMessage);

    return () => {
      // Callback is managed by the service singleton
    };
  }, [conversationId, onMessageReceived]);

  // Setup typing status callback
  useEffect(() => {
    if (!conversationId || !onTypingStatusChanged || !userRole) {
      return;
    }

    const handleTyping = (status: { conversationId: string; userRole: 'customer' | 'seller'; isTyping: boolean }) => {
      if (status.conversationId === conversationId && status.userRole !== userRole) {
        onTypingStatusChanged(status.isTyping, status.userRole);
      }
    };

    realtimeChatService.onTyping(handleTyping);

    return () => {
      // Callback is managed by the service singleton
    };
  }, [conversationId, onTypingStatusChanged, userRole]);

  // Join conversation room when conversationId changes
  useEffect(() => {
    if (conversationId) {
      realtimeChatService.joinConversation(conversationId);
    }

    return () => {
      if (conversationId) {
        realtimeChatService.leaveConversation(conversationId);
      }
    };
  }, [conversationId]);

  // Send message function
  const sendMessage = useCallback(async (message: string): Promise<{ success: boolean; error?: string }> => {
    if (!conversationId || !userEmail || !userRole) {
      return { success: false, error: 'Missing required parameters' };
    }

    const messageId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const chatMessage: ChatMessage = {
      id: messageId,
      sender: userRole === 'seller' ? 'seller' : 'user',
      text: message,
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'text'
    };

    return await realtimeChatService.sendMessage(conversationId, chatMessage, userEmail, userRole);
  }, [conversationId, userEmail, userRole]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!conversationId || !userRole) {
      return;
    }
    realtimeChatService.sendTypingIndicator(conversationId, userRole, isTyping);
  }, [conversationId, userRole]);

  // Mark messages as read
  const markAsRead = useCallback(async (messageIds: (number | string)[]) => {
    if (!conversationId || !userRole) {
      return;
    }
    await realtimeChatService.markAsRead(conversationId, messageIds, userRole);
  }, [conversationId, userRole]);

  // Join conversation
  const joinConversation = useCallback(() => {
    if (conversationId) {
      realtimeChatService.joinConversation(conversationId);
    }
  }, [conversationId]);

  // Leave conversation
  const leaveConversation = useCallback(() => {
    if (conversationId) {
      realtimeChatService.leaveConversation(conversationId);
    }
  }, [conversationId]);

  return {
    isConnected,
    sendMessage,
    sendTypingIndicator,
    markAsRead,
    joinConversation,
    leaveConversation
  };
}





