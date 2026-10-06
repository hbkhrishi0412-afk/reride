import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { ChatMessage, Conversation, Toast, User } from '../types';
import { saveConversations } from '../services/chatService';
import { addMessageWithSync } from '../services/syncService';
import { realtimeChatService } from '../services/realtimeChatService';
import { logBackgroundSyncFailure } from '../utils/toastPolicy.js';
import { logError, logInfo, logWarn } from '../utils/logger';
import { randomIntBelow } from '../utils/secureRandom.js';
import type { AppContextType } from '../types/appContext';

export type UseAppMessagingActionsArgs = {
  currentUser: User | null;
  conversations: Conversation[];
  activeChat: Conversation | null;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setActiveChat: Dispatch<SetStateAction<Conversation | null>>;
  addToast: (message: string, type: Toast['type']) => void;
  t: TFunction;
};

/**
 * Chat / messaging actions (extracted from AppProvider contextValue).
 */
export function useAppMessagingActions(args: UseAppMessagingActionsArgs) {
  const {
    currentUser,
    conversations,
    activeChat,
    setConversations,
    setActiveChat,
    addToast,
    t,
  } = args;

  return useMemo(() => {
    const inboxMarkRead: { fn?: AppContextType['markAsRead'] } = {};
    return {
    sendMessage: async (conversationId: string, message: string) => {
      logInfo('🔧 sendMessage called:', { conversationId, message, currentUser: currentUser?.email });
      
      if (!currentUser) {
        logWarn('⚠️ Cannot send message: no current user');
        addToast(t('toast.loginRequiredMessages'), 'error');
        return;
      }

      try {
        // Socket.io room join is instant when a dev socket exists; production uses Supabase Realtime (no wait).
        await realtimeChatService.joinConversation(conversationId);

        // Find conversation BEFORE updating state to avoid stale state issues
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (!conversation) {
          logWarn('⚠️ Conversation not found:', conversationId);
          addToast(t('toast.conversationNotFoundRefresh'), 'error');
          return;
        }

        // Generate a more unique message ID to prevent collisions
        const messageId = Date.now() * 1000 + randomIntBelow(1000);

        // CRITICAL FIX: Normalize user email before creating message
        const normalizedUserEmail = (currentUser.email || '').toLowerCase().trim();
        
        const newMessage: ChatMessage = {
          id: messageId,
          sender: (currentUser.role === 'seller' ? 'seller' : 'user') as 'seller' | 'user',
          text: message,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'text'
        };

        // Update conversations and save to localStorage immediately for instant UI update
        setConversations(prev => {
          const updated = Array.isArray(prev) ? prev.map(conv => 
            conv && conv.id === conversationId ? {
              ...conv,
              messages: Array.isArray(conv.messages) ? [...conv.messages, newMessage] : [newMessage],
              lastMessageAt: newMessage.timestamp,
              isReadBySeller: currentUser.role === 'seller' ? true : (currentUser.role === 'customer' ? false : conv.isReadBySeller),
              isReadByCustomer: currentUser.role === 'customer' ? true : (currentUser.role === 'seller' ? false : conv.isReadByCustomer)
            } : conv
          ) : [];
          
          // Save to localStorage immediately
          try {
            saveConversations(updated);
          } catch (error) {
            logError('Failed to save conversations to localStorage:', error);
          }
          
          // Update activeChat immediately for instant UI feedback
          const updatedConversation = updated.find(conv => conv.id === conversationId);
          if (updatedConversation && activeChat?.id === conversationId) {
            setActiveChat(updatedConversation);
          }
          
          return updated;
        });

        // Send message via real-time chat service (handles WebSocket + Supabase sync)
        // CRITICAL FIX: Use normalized email
        const userEmail = normalizedUserEmail;
        const userRole = currentUser.role as 'customer' | 'seller';
        
        logInfo('🔧 AppProvider: Sending message via realtimeChatService', { 
          conversationId, 
          messageId: newMessage.id, 
          userEmail, 
          userRole,
          isConnected: realtimeChatService.isConnected()
        });
        
        const sendResult = await realtimeChatService.sendMessage(conversationId, newMessage, userEmail, userRole);

        if (!sendResult.success || !sendResult.persisted) {
          const retry = await addMessageWithSync(conversationId, newMessage);
          if (!retry.synced && !retry.queued) {
            logError('❌ Failed to send message:', sendResult.error);
            addToast(t('toast.failedSendMessageGeneric'), 'error');
          } else if (!retry.synced && retry.queued) {
            logBackgroundSyncFailure('Message send — queued for retry', sendResult.error);
          }
        }

        // Recipient notifications are created server-side in PUT /api/conversations (see api/main.ts).
        // POST /api/notifications only allows creating rows for the authenticated user — do not duplicate here.
      } catch (error) {
        logError('Error in sendMessage:', error);
      }
    },
    sendMessageWithType: async (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: ChatMessage['payload']): Promise<boolean> => {
      logInfo('🔧 sendMessageWithType called:', { conversationId, messageText, type, payload, currentUser: currentUser?.email });
      
      if (!currentUser) {
        logWarn('⚠️ Cannot send message: no current user');
        addToast(t('toast.loginRequiredMessages'), 'error');
        return false;
      }

      try {
        await realtimeChatService.joinConversation(conversationId);

        const conversation = conversations.find(
          (conv) => conv && String(conv.id) === String(conversationId)
        );
        if (!conversation) {
          logWarn('⚠️ Conversation not found:', conversationId);
          addToast(t('toast.conversationNotFoundRefresh'), 'error');
          return false;
        }

        const messageId = Date.now() * 1000 + randomIntBelow(1000);
        const resolvedType = type || 'text';
        const displayText =
          resolvedType === 'image'
            ? (messageText?.trim() || '📷 Photo')
            : resolvedType === 'voice'
              ? (messageText?.trim() || '🎤 Voice message')
              : messageText;

        const newMessage: ChatMessage = {
          id: messageId,
          sender: (currentUser.role === 'seller' ? 'seller' : 'user') as 'seller' | 'user',
          text: displayText,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: resolvedType,
          ...(payload ? { payload } : {}),
        };

        const normalizedUserEmail = (currentUser.email || '').toLowerCase().trim();
        const userRole = currentUser.role as 'customer' | 'seller';

        setConversations((prev) => {
          const updated = Array.isArray(prev)
            ? prev.map((conv) =>
                conv && String(conv.id) === String(conversationId)
                  ? {
                      ...conv,
                      messages: Array.isArray(conv.messages) ? [...conv.messages, newMessage] : [newMessage],
                      lastMessageAt: newMessage.timestamp,
                      isReadBySeller:
                        currentUser.role === 'seller'
                          ? true
                          : currentUser.role === 'customer'
                            ? false
                            : conv.isReadBySeller,
                      isReadByCustomer:
                        currentUser.role === 'customer'
                          ? true
                          : currentUser.role === 'seller'
                            ? false
                            : conv.isReadByCustomer,
                    }
                  : conv,
              )
            : [];
          try {
            saveConversations(updated);
          } catch (error) {
            logError('Failed to save conversations to localStorage:', error);
          }
          const updatedConversation = updated.find((conv) => String(conv.id) === String(conversationId));
          if (updatedConversation && activeChat && String(activeChat.id) === String(conversationId)) {
            setActiveChat(updatedConversation);
          }
          return updated;
        });

        const sendResult = await realtimeChatService.sendMessage(
          conversationId,
          newMessage,
          normalizedUserEmail,
          userRole,
        );
        if (!sendResult.success || !sendResult.persisted) {
          const retry = await addMessageWithSync(conversationId, newMessage);
          if (!retry.synced && !retry.queued) {
            logError('❌ Failed to send message:', sendResult.error);
            addToast(t('toast.failedSendMessageGeneric'), 'error');
            return false;
          }
          if (!retry.synced && retry.queued) {
            logBackgroundSyncFailure('Message send — queued for retry', sendResult.error);
          }
        }
        return true;
      } catch (error) {
        logError('Error in sendMessageWithType:', error);
        return false;
      }
    },
    markAsRead: (inboxMarkRead.fn = async (
      conversationId: string,
      options?: { readerRole?: 'customer' | 'seller'; forceReadState?: boolean },
    ) => {
      if (!currentUser) return;

      const conversation = conversations.find(
        (conv) => conv && String(conv.id) === String(conversationId),
      );
      if (!conversation) return;

      const readerRole = options?.readerRole ?? (currentUser.role as 'customer' | 'seller');
      const otherSender: 'user' | 'seller' = readerRole === 'customer' ? 'seller' : 'user';
      const msgs = Array.isArray(conversation.messages) ? conversation.messages : [];
      const unreadMessageIds = msgs
        .filter((msg) => msg.sender === otherSender && !msg.isRead)
        .map((msg) => msg.id);
      const forceReadState = Boolean(options?.forceReadState);
      if (unreadMessageIds.length === 0 && !forceReadState) return;

      const threadAlreadyRead =
        readerRole === 'customer' ? conversation.isReadByCustomer : conversation.isReadBySeller;
      if (unreadMessageIds.length === 0 && forceReadState && threadAlreadyRead) {
        return;
      }

      setConversations((prev) =>
        Array.isArray(prev)
          ? prev.map((conv) =>
              conv && String(conv.id) === String(conversationId)
                ? {
                    ...conv,
                    messages: Array.isArray(conv.messages)
                      ? conv.messages.map((msg) =>
                          msg.sender === otherSender && !msg.isRead ? { ...msg, isRead: true } : msg,
                        )
                      : [],
                    isReadBySeller: readerRole === 'seller' ? true : conv.isReadBySeller,
                    isReadByCustomer: readerRole === 'customer' ? true : conv.isReadByCustomer,
                  }
                : conv,
            )
          : [],
      );

      if (unreadMessageIds.length > 0) {
        await realtimeChatService.markAsRead(conversationId, unreadMessageIds, readerRole);
      }

      import('../services/conversationService')
        .then(({ patchConversationMarkRead, patchConversationSetThreadReadState }) =>
          unreadMessageIds.length > 0
            ? patchConversationMarkRead(conversationId, unreadMessageIds)
            : patchConversationSetThreadReadState(conversationId, readerRole, true),
        )
        .then((res) => {
          if (!res?.success) {
            logBackgroundSyncFailure('Persist mark-read', res?.error);
          }
        })
        .catch((err) => {
          logBackgroundSyncFailure('Persist mark-read', err);
        });
    }),
    setConversationReadState: async (
      conversationId: string,
      readerRole: 'customer' | 'seller',
      isRead: boolean,
    ) => {
      if (!currentUser) return;
      if (isRead) {
        await inboxMarkRead.fn?.(conversationId, { readerRole, forceReadState: true });
        return;
      }

      const previousConversation = conversations.find((c) => c && String(c.id) === String(conversationId)) || null;
      setConversations((prev) =>
        Array.isArray(prev)
          ? prev.map((conv) =>
              conv && String(conv.id) === String(conversationId)
                ? {
                    ...conv,
                    isReadBySeller: readerRole === 'seller' ? false : conv.isReadBySeller,
                    isReadByCustomer: readerRole === 'customer' ? false : conv.isReadByCustomer,
                  }
                : conv,
            )
          : [],
      );

      import('../services/conversationService')
        .then(({ patchConversationSetThreadReadState }) =>
          patchConversationSetThreadReadState(conversationId, readerRole, false),
        )
        .then((res) => {
          if (!res?.success) {
            logBackgroundSyncFailure('Persist unread-state', res?.error);
            if (previousConversation) {
              setConversations((prev) =>
                Array.isArray(prev)
                  ? prev.map((conv) =>
                      conv && String(conv.id) === String(conversationId) ? previousConversation : conv,
                    )
                  : [],
              );
            }
          }
        })
        .catch((err) => {
          logBackgroundSyncFailure('Persist unread-state', err);
          if (previousConversation) {
            setConversations((prev) =>
              Array.isArray(prev)
                ? prev.map((conv) =>
                    conv && String(conv.id) === String(conversationId) ? previousConversation : conv,
                  )
                : [],
            );
          }
        });
    },
    clearConversationMessages: async (conversationId: string) => {
      if (!currentUser) return;
      try {
        const { patchConversationClearMessages } = await import('../services/conversationService');
        const res = await patchConversationClearMessages(conversationId);
        if (!res.success) {
          addToast(res.error || t('toast.failedSendMessageGeneric'), 'error');
          return;
        }
        const server = res.data;
        if (!server) {
          addToast(res.error || t('toast.failedSendMessageGeneric'), 'error');
          return;
        }
        setConversations((prev) => {
          const next = Array.isArray(prev)
            ? prev.map((c) =>
                String(c.id) === String(conversationId)
                  ? {
                      ...c,
                      ...server,
                      messages: Array.isArray(server.messages) ? server.messages : c.messages,
                      customerHistoryClearedAt: server.customerHistoryClearedAt ?? c.customerHistoryClearedAt,
                      sellerHistoryClearedAt: server.sellerHistoryClearedAt ?? c.sellerHistoryClearedAt,
                    }
                  : c,
              )
            : [];
          try {
            saveConversations(next);
          } catch (e) {
            logError('saveConversations after clear failed', e);
          }
          return next;
        });
        setActiveChat((prev) => {
          if (!prev || String(prev.id) !== String(conversationId)) return prev;
          return {
            ...prev,
            ...server,
            messages: Array.isArray(server.messages) ? server.messages : prev.messages,
            customerHistoryClearedAt: server.customerHistoryClearedAt ?? prev.customerHistoryClearedAt,
            sellerHistoryClearedAt: server.sellerHistoryClearedAt ?? prev.sellerHistoryClearedAt,
          };
        });
        addToast(
          'Chat cleared for you. The other person still sees the full history until they clear it.',
          'success',
        );
      } catch (error) {
        logError('clearConversationMessages:', error);
        addToast(t('toast.failedSendMessageGeneric'), 'error');
      }
    },
    deleteConversation: async (conversationId: string) => {
      if (!currentUser) return;
      try {
        const { deleteConversationById } = await import('../services/conversationService');
        const res = await deleteConversationById(String(conversationId));
        if (!res.success) {
          if (res.reason === 'deal_exists' || res.action === 'archive') {
            addToast(
              'This conversation is linked to a deal and cannot be deleted. Use Archive to hide it from your inbox.',
              'warning',
            );
            return;
          }
          addToast(res.error || t('toast.failedSendMessageGeneric'), 'error');
          return;
        }
        setConversations((prev) => {
          const next = Array.isArray(prev)
            ? prev.filter((c) => c && String(c.id) !== String(conversationId))
            : [];
          try {
            saveConversations(next);
          } catch {
            /* ignore */
          }
          return next;
        });
        setActiveChat((prev) => (prev && String(prev.id) === String(conversationId) ? null : prev));
        addToast('Conversation deleted successfully.', 'success');
      } catch (error) {
        logError('deleteConversation:', error);
        addToast(t('toast.failedSendMessageGeneric'), 'error');
      }
    },
    archiveConversation: async (conversationId: string, archived = true) => {
      if (!currentUser) return;
      const role: 'customer' | 'seller' = currentUser.role === 'seller' ? 'seller' : 'customer';
      try {
        const { patchConversationArchive } = await import('../services/conversationService');
        const res = await patchConversationArchive(String(conversationId), archived);
        if (!res.success) {
          addToast(res.error || t('toast.failedSendMessageGeneric'), 'error');
          return;
        }
        const server = res.data;
        const archivedAt = archived ? new Date().toISOString() : undefined;
        const patchArchived = (c: Conversation): Conversation => {
          if (!server) {
            return role === 'customer'
              ? { ...c, customerArchivedAt: archivedAt }
              : { ...c, sellerArchivedAt: archivedAt };
          }
          return {
            ...c,
            ...server,
            customerArchivedAt: server.customerArchivedAt ?? c.customerArchivedAt,
            sellerArchivedAt: server.sellerArchivedAt ?? c.sellerArchivedAt,
          };
        };
        setConversations((prev) => {
          const next = Array.isArray(prev)
            ? prev.map((c) =>
                c && String(c.id) === String(conversationId) ? patchArchived(c) : c,
              )
            : [];
          try {
            saveConversations(next);
          } catch {
            /* ignore */
          }
          return next;
        });
        setActiveChat((prev) => {
          if (!prev || String(prev.id) !== String(conversationId)) return prev;
          if (archived) return null;
          return patchArchived(prev);
        });
        addToast(
          archived
            ? 'Conversation archived. Deal and message history are preserved.'
            : 'Conversation restored to your inbox.',
          'success',
        );
      } catch (error) {
        logError('archiveConversation:', error);
        addToast(t('toast.failedSendMessageGeneric'), 'error');
      }
    },
    toggleTyping: (conversationId: string, isTyping: boolean) => {
      if (!currentUser) return;
      if (currentUser.role !== 'seller' && currentUser.role !== 'customer') return;

      const userRole = (currentUser.role === 'seller' ? 'seller' : 'customer') as 'customer' | 'seller';

      // Remote typing state comes only from Socket.io / Supabase broadcast (see onTyping).
      realtimeChatService.sendTypingIndicator(conversationId, userRole, isTyping);
    },
    };
  }, [
    currentUser,
    conversations,
    activeChat,
    setConversations,
    setActiveChat,
    addToast,
    t,
  ]);
}
