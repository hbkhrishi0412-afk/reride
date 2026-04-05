import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Conversation, User, ChatMessage, Vehicle } from '../types';
import { findUserByParticipantId, resolveSellerPhoneFromProfileOrListing } from '../utils/chatContact';
import { telHrefFromRawPhone, phoneDisplayCompact } from '../utils/numberUtils';
import { View as ViewEnum } from '../types';
import { useConversationList } from '../hooks/useConversationList';
import { formatRelativeTime } from '../utils/date';
import { getThreadLastMessagePreview } from '../utils/messagePreview';

interface MobileInboxProps {
  conversations: Conversation[];
  /** Pass conversation id (string) so seller and customer threads resolve reliably. */
  onSendMessage: (
    conversationId: string,
    messageText: string,
    type?: ChatMessage['type'],
    payload?: any
  ) => void;
  onMarkAsRead: (conversationId: string) => void;
  users: User[];
  vehicles?: Vehicle[];
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  currentUser: User | null;
  /** Customer inbox vs seller inbox (buyer threads). */
  inboxRole?: 'customer' | 'seller';
  onNavigate?: (view: ViewEnum) => void;
  initialOpenConversationId?: string | null;
  onConsumedInitialConversation?: () => void;
}

/**
 * Mobile-Optimized Inbox Component
 * Features:
 * - Swipe actions (delete, archive)
 * - Pull-to-refresh
 * - Mobile-friendly message bubbles
 * - Full-screen chat view
 */
export const MobileInbox: React.FC<MobileInboxProps> = ({
  conversations,
  onSendMessage,
  onMarkAsRead,
  users,
  vehicles,
  typingStatus,
  onUserTyping,
  onMarkMessagesAsRead,
  onFlagContent,
  onOfferResponse,
  currentUser,
  inboxRole = 'customer',
  onNavigate,
  initialOpenConversationId = null,
  onConsumedInitialConversation,
}) => {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const getSellerName = useCallback((sellerId: string) => {
    const seller = findUserByParticipantId(users, sellerId);
    return seller?.name || seller?.dealershipName || 'Seller';
  }, [users]);

  const getSellerPhone = (sellerId: string, vehicleId: number) =>
    resolveSellerPhoneFromProfileOrListing(users, vehicles, sellerId, vehicleId);

  const getCounterpartLabel = useCallback(
    (c: Conversation) => {
      if (inboxRole === 'seller') {
        return (
          c.customerName?.trim() ||
          findUserByParticipantId(users, c.customerId)?.name ||
          'Customer'
        );
      }
      return getSellerName(c.sellerId);
    },
    [inboxRole, users, getSellerName]
  );

  const { sortedConversations, filteredConversations, unreadCount } = useConversationList(
    conversations,
    searchQuery,
    filterUnread,
    {
      viewerRole: inboxRole,
      getCounterpartLabel,
    }
  );

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      setSelectedConv(conv);
      if (inboxRole === 'customer') {
        if (!conv.isReadByCustomer) {
          onMarkAsRead(conv.id);
          onMarkMessagesAsRead(conv.id, 'customer');
        }
      } else if (!conv.isReadBySeller) {
        onMarkAsRead(conv.id);
        onMarkMessagesAsRead(conv.id, 'seller');
      }
    },
    [inboxRole, onMarkAsRead, onMarkMessagesAsRead]
  );

  const handleSwipeStart = (e: React.TouchEvent, convId: string) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleSwipeEnd = (convId: string) => {
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 100;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Swipe left - show actions
        setSwipedId(convId);
      } else {
        // Swipe right - hide actions
        setSwipedId(null);
      }
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConv) return;
    
    onSendMessage(selectedConv.id, messageText.trim());
    setMessageText('');
    
    // Focus back on input
    setTimeout(() => {
      const input = document.getElementById('message-input');
      if (input) input.focus();
    }, 100);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages, typingStatus]);

  useEffect(() => {
    if (initialOpenConversationId) {
      const want = String(initialOpenConversationId);
      const match = sortedConversations.find((c) => String(c.id) === want);
      if (match) {
        handleSelectConversation(match);
        onConsumedInitialConversation?.();
        return;
      }
    }
    if (!selectedConv && sortedConversations.length > 0) {
      handleSelectConversation(sortedConversations[0]);
    }
  }, [
    sortedConversations,
    selectedConv,
    initialOpenConversationId,
    onConsumedInitialConversation,
    handleSelectConversation,
  ]);

  // Show chat view if conversation is selected
  if (selectedConv) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedConv(null)}
            className="p-2 -ml-2"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">{getCounterpartLabel(selectedConv)}</h2>
            <p className="text-sm text-gray-600">{selectedConv.vehicleName}</p>
          </div>
          <button
            onClick={() => {
              if (onNavigate) onNavigate(ViewEnum.DETAIL);
            }}
            className="p-2"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {(() => {
          const raw =
            inboxRole === 'customer'
              ? getSellerPhone(selectedConv.sellerId, selectedConv.vehicleId)
              : findUserByParticipantId(users, selectedConv.customerId)?.mobile || '';
          const href = telHrefFromRawPhone(raw);
          const label = phoneDisplayCompact(raw) || raw;
          if (!href || !raw) return null;
          return (
            <a
              href={href}
              className="flex items-center justify-center gap-2 border-b border-gray-200 bg-gray-100 py-3 text-gray-800 active:bg-gray-200"
            >
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <span className="text-sm font-semibold tabular-nums">
                Call <span className="text-gray-600 font-medium">{label}</span>
              </span>
            </a>
          );
        })()}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedConv.messages.map((msg, idx) => {
            const isUser =
              inboxRole === 'customer' ? msg.sender === 'user' : msg.sender === 'seller';
            const isOffer = msg.type === 'offer';
            
            return (
              <div
                key={idx}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isUser
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {isOffer && (
                    <div className="mb-2 p-2 bg-white/10 rounded-lg">
                      <p className="text-xs font-semibold">Offer: ₹{msg.payload?.price?.toLocaleString()}</p>
                      {msg.payload?.message && (
                        <p className="text-xs mt-1">{msg.payload.message}</p>
                      )}
                    </div>
                  )}
                  {msg.text && <p className="text-sm">{msg.text}</p>}
                  <p className={`text-xs mt-1 ${isUser ? 'text-white/70' : 'text-gray-500'}`}>
                    {formatRelativeTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
          
          {typingStatus && typingStatus.conversationId === selectedConv.id && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4 safe-bottom">
          <div className="flex gap-2">
            <input
              id="message-input"
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim()}
              className="p-3 bg-orange-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show conversation list
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full px-4 py-3 pl-10 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              filterUnread
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="divide-y divide-gray-200">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500">No conversations found</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const lastMessage =
              conv.messages?.length > 0 ? conv.messages[conv.messages.length - 1] : undefined;
            const counterpart = getCounterpartLabel(conv);
            const preview = getThreadLastMessagePreview(lastMessage, {
              otherLabel: counterpart,
              viewer: inboxRole,
            });
            const isUnread =
              inboxRole === 'customer' ? !conv.isReadByCustomer : !conv.isReadBySeller;
            const isSwiped = swipedId === conv.id;

            return (
              <div
                key={conv.id}
                className="relative bg-white overflow-hidden"
                onTouchStart={(e) => handleSwipeStart(e, conv.id)}
                onTouchMove={handleSwipeMove}
                onTouchEnd={() => handleSwipeEnd(conv.id)}
                onClick={() => !isSwiped && handleSelectConversation(conv)}
              >
                <div
                  className={`flex items-center gap-4 p-4 transition-transform ${
                    isSwiped ? '-translate-x-24' : 'translate-x-0'
                  }`}
                >
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {counterpart.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {counterpart}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mb-1">
                      {conv.vehicleName}
                    </p>
                    {lastMessage && (
                      <p className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                        {preview.prefix && <span className="text-gray-400 font-normal">{preview.prefix}</span>}
                        {preview.text}
                      </p>
                    )}
                  </div>
                  {isUnread && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                  )}
                </div>

                {/* Swipe Actions */}
                <div
                  className={`absolute right-0 top-0 bottom-0 flex items-center transition-transform ${
                    isSwiped ? 'translate-x-0' : 'translate-x-full'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFlagContent('conversation', conv.id, 'User reported');
                      setSwipedId(null);
                    }}
                    className="h-full px-6 bg-red-500 text-white flex items-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MobileInbox;
