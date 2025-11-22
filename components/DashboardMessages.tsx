import React, { memo, useState } from 'react';
import type { Conversation } from '../types';
import { ChatWidget } from './ChatWidget';
import InlineChat from './InlineChat';

interface DashboardMessagesProps {
  conversations: Conversation[];
  onSellerSendMessage: (conversationId: string, messageText: string, type?: any, payload?: any) => void;
  onMarkConversationAsReadBySeller: (conversationId: string) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
}

const DashboardMessages: React.FC<DashboardMessagesProps> = memo(({
  conversations,
  onSellerSendMessage,
  onMarkConversationAsReadBySeller,
  typingStatus,
  onUserTyping,
  onMarkMessagesAsRead,
  onOfferResponse
}) => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Safety check
  const safeConversations = conversations || [];

  const filteredConversations = safeConversations.filter(conv => {
    if (!conv) return false;
    if (filter === 'unread') {
      return !conv.isReadBySeller;
    }
    return true;
  });

  const unreadCount = safeConversations.filter(conv => conv && !conv.isReadBySeller).length;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  const getLastMessage = (conversation: Conversation) => {
    if (!conversation || !conversation.messages || conversation.messages.length === 0) return 'No messages';
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return lastMessage?.text || 'Media message';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark">
          Messages ({safeConversations.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm ${
              filter === 'all' 
                ? 'bg-spinny-orange text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-full text-sm ${
              filter === 'unread' 
                ? 'bg-spinny-orange text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-spinny-text-dark dark:text-spinny-text-dark">
                Conversations
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <p>No conversations found</p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => {
                      setSelectedConversation(conversation);
                      onMarkConversationAsReadBySeller(conversation.id);
                    }}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !conversation.isReadBySeller ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-spinny-text-dark dark:text-spinny-text-dark truncate">
                          {conversation.customerName}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          {conversation.vehicleName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {getLastMessage(conversation)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end ml-2">
                        <span className="text-xs text-gray-500">
                          {formatTime(conversation.lastMessageAt)}
                        </span>
                        {!conversation.isReadBySeller && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Chat Widget */}
        <div className="lg:col-span-2">
          {selectedConversation ? (
            <InlineChat
              conversation={selectedConversation}
              currentUserRole="seller"
              otherUserName={selectedConversation.customerName}
              onSendMessage={onSellerSendMessage}
              typingStatus={typingStatus}
              onUserTyping={onUserTyping}
              onMarkMessagesAsRead={onMarkMessagesAsRead}
              onFlagContent={() => {}}
              onOfferResponse={onOfferResponse}
              height="h-96"
            />
          ) : (
            <div className="bg-white rounded-lg shadow-md h-96 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DashboardMessages.displayName = 'DashboardMessages';

export default DashboardMessages;
