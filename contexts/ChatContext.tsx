/**
 * Chat / inbox state — conversations, active thread, typing and presence.
 * Message handlers remain in AppProvider until a later extraction phase.
 */

import React, { createContext, useContext, useState } from 'react';
import type { Conversation } from '../types';

export interface ChatContextType {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  activeChat: Conversation | null;
  setActiveChat: React.Dispatch<React.SetStateAction<Conversation | null>>;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  setTypingStatus: React.Dispatch<
    React.SetStateAction<{ conversationId: string; userRole: 'customer' | 'seller' } | null>
  >;
  chatPeerOnlineByConversationId: Record<string, boolean>;
  setChatPeerOnlineByConversationId: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChat(): ChatContextType {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [typingStatus, setTypingStatus] = useState<{
    conversationId: string;
    userRole: 'customer' | 'seller';
  } | null>(null);
  const [chatPeerOnlineByConversationId, setChatPeerOnlineByConversationId] = useState<
    Record<string, boolean>
  >({});

  const value: ChatContextType = {
    conversations,
    setConversations,
    activeChat,
    setActiveChat,
    typingStatus,
    setTypingStatus,
    chatPeerOnlineByConversationId,
    setChatPeerOnlineByConversationId,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
