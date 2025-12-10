import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Conversation, User, ChatMessage } from '../types.js';
import { OfferModal } from './ReadReceiptIcon.js';
import InlineChat from './InlineChat.js';

interface CustomerInboxProps {
  conversations: Conversation[];
  onSendMessage: (vehicleId: number, messageText: string, type?: ChatMessage['type'], payload?: any) => void;
  onMarkAsRead: (conversationId: string) => void;
  users: User[];
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
}

// Helper function to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper function to count unread messages
const countUnreadMessages = (conversation: Conversation, userRole: 'customer' | 'seller'): number => {
  if (userRole === 'customer') {
    return conversation.messages.filter(msg => msg.sender === 'seller' && !msg.isRead).length;
  }
  return conversation.messages.filter(msg => msg.sender === 'user' && !msg.isRead).length;
};

const CustomerInbox: React.FC<CustomerInboxProps> = ({ conversations, onSendMessage, onMarkAsRead, users, typingStatus, onUserTyping, onMarkMessagesAsRead, onFlagContent, onOfferResponse }) => {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  const getSellerName = useCallback((sellerId: string) => {
    const seller = users.find(u => u.email === sellerId);
    return seller?.name || seller?.dealershipName || 'Seller';
  }, [users]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let filtered = sortedConversations;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.vehicleName.toLowerCase().includes(query) ||
        getSellerName(conv.sellerId).toLowerCase().includes(query) ||
        conv.messages.some(msg => msg.text?.toLowerCase().includes(query))
      );
    }
    
    if (filterUnread) {
      filtered = filtered.filter(conv => !conv.isReadByCustomer);
    }
    
    return filtered;
  }, [sortedConversations, searchQuery, filterUnread, getSellerName]);

  const unreadCount = useMemo(() => {
    return conversations.filter(c => !c.isReadByCustomer).length;
  }, [conversations]);

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setSelectedConv(conv);
    if (conv.isReadByCustomer === false) {
      onMarkAsRead(conv.id);
      onMarkMessagesAsRead(conv.id, 'customer');
    }
  }, [onMarkAsRead, onMarkMessagesAsRead]);

  useEffect(() => {
    if (!selectedConv && sortedConversations.length > 0) {
      const firstConv = sortedConversations[0];
      handleSelectConversation(firstConv);
    }
    if (selectedConv && !conversations.find(c => c.id === selectedConv.id)) {
        setSelectedConv(null);
    }
  }, [conversations, sortedConversations, selectedConv, handleSelectConversation]);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView();
  }, [selectedConv?.messages, typingStatus]);

  useEffect(() => {
      if (selectedConv) {
          const updatedConversation = conversations.find(c => c.id === selectedConv.id);
          if (updatedConversation && (updatedConversation.messages.length !== selectedConv.messages.length || updatedConversation.isFlagged !== selectedConv.isFlagged)) {
              setSelectedConv(updatedConversation);
          }
      }
  }, [conversations, selectedConv]);

  // Removed unused handleInputChange function

  // Removed unused handleSendReply function
  
  // Removed unused handleFlagClick function

  const handleSendOffer = (price: number) => {
    if (selectedConv) {
        onSendMessage(selectedConv.vehicleId, `Offer: ${price}`, 'offer', {
            offerPrice: price,
            status: 'pending'
        });
        setIsOfferModalOpen(false);
    }
  };

  // Removed unused functions: handleInputChange, handleSendReply, handleFlagClick, formInputClass

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">My Inbox</h1>
            <p className="text-sm text-gray-600 mt-1">
              {conversations.length > 0 
                ? `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}${unreadCount > 0 ? ` • ${unreadCount} unread` : ''}`
                : 'Start a conversation with sellers'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 bg-white rounded-xl shadow-lg overflow-hidden h-[calc(100vh-220px)] min-h-[600px]">
          {/* Conversation List */}
          <aside className="border-r border-gray-200 flex flex-col bg-gray-50">
            {/* Search and Filter */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                />
              </div>
              {conversations.length > 0 && (
                <button
                  onClick={() => setFilterUnread(!filterUnread)}
                  className={`w-full px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    filterUnread 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {filterUnread ? 'Show All' : `Unread (${unreadCount})`}
                </button>
              )}
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {filteredConversations.map(conv => {
                    const lastMessage = conv.messages[conv.messages.length - 1];
                    const unreadCount = countUnreadMessages(conv, 'customer');
                    const messageText = lastMessage?.type === 'offer'
                      ? `💰 Offer: ₹${lastMessage.payload?.offerPrice?.toLocaleString('en-IN') || 'N/A'}`
                      : lastMessage?.type === 'test_drive_request'
                      ? '🚗 Test Drive Request'
                      : lastMessage?.text || 'No messages yet.';
                    
                    const isSelected = selectedConv?.id === conv.id;
                    const isUnread = !conv.isReadByCustomer;

                    return (
                      <li key={conv.id}>
                        <button
                          onClick={() => handleSelectConversation(conv)}
                          className={`w-full text-left p-4 border-l-4 transition-all duration-200 ${
                            isSelected 
                              ? 'bg-white border-orange-500 shadow-sm' 
                              : 'border-transparent hover:bg-white hover:border-gray-300'
                          } ${isUnread ? 'bg-orange-50/50' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`font-bold truncate ${isUnread ? 'text-gray-900' : 'text-gray-800'}`}>
                                  {conv.vehicleName}
                                </p>
                                {isUnread && (
                                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-orange-500"></span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 truncate">
                                With {getSellerName(conv.sellerId)}
                              </p>
                            </div>
                            <div className="flex-shrink-0 ml-2 flex flex-col items-end gap-1">
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {formatRelativeTime(conv.lastMessageAt)}
                              </span>
                              {unreadCount > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-orange-500 rounded-full">
                                  {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className={`text-sm truncate ${
                            isUnread ? 'text-gray-900 font-medium' : 'text-gray-600'
                          }`}>
                            {lastMessage && (
                              lastMessage.sender === 'user' ? (
                                <span>
                                  <span className="text-gray-500">You: </span>
                                  {messageText}
                                </span>
                              ) : lastMessage.sender === 'seller' ? (
                                <span>
                                  <span className="text-gray-500">{getSellerName(conv.sellerId)}: </span>
                                  {messageText}
                                </span>
                              ) : (
                                <em className="text-gray-500">{lastMessage.text}</em>
                              )
                            )}
                          </p>
                          {conv.vehiclePrice && (
                            <p className="text-xs text-gray-500 mt-1">
                              ₹{conv.vehiclePrice.toLocaleString('en-IN')}
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No conversations yet</h3>
                  <p className="text-sm text-gray-600 max-w-xs mb-4">
                    Start inquiring about vehicles to begin conversations with sellers.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Browse vehicles to get started</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No conversations found</h3>
                  <p className="text-sm text-gray-600">
                    Try adjusting your search or filter criteria.
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Chat View */}
          <main className="flex flex-col bg-white">
              {selectedConv ? (
                  <InlineChat
                      conversation={selectedConv}
                      currentUserRole="customer"
                      otherUserName={getSellerName(selectedConv.sellerId)}
                      onSendMessage={(messageText, type, payload) => {
                          if (type === 'offer' && payload) {
                              onSendMessage(selectedConv.vehicleId, messageText, type, payload);
                          } else {
                              onSendMessage(selectedConv.vehicleId, messageText);
                          }
                      }}
                      typingStatus={typingStatus}
                      onUserTyping={onUserTyping}
                      onMarkMessagesAsRead={onMarkMessagesAsRead}
                      onFlagContent={onFlagContent}
                      onOfferResponse={onOfferResponse}
                      height="h-full"
                  />
              ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gradient-to-br from-gray-50 to-white">
                      <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-16 h-16 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-semibold text-gray-900 mb-2">Select a Conversation</h3>
                      <p className="text-gray-600 max-w-md">
                        Choose a conversation from the left panel to view and send messages. Start chatting with sellers about vehicles you're interested in.
                      </p>
                  </div>
              )}
          </main>
      </div>
      {isOfferModalOpen && selectedConv && (
        <OfferModal
            title="Make an Offer"
            listingPrice={selectedConv.vehiclePrice}
            onSubmit={handleSendOffer}
            onClose={() => setIsOfferModalOpen(false)}
        />
      )}
    </div>
  );
};

export default CustomerInbox;