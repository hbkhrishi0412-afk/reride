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

// Removed unused TypingIndicator and TestDriveRequestMessage components

const CustomerInbox: React.FC<CustomerInboxProps> = ({ conversations, onSendMessage, onMarkAsRead, users, typingStatus, onUserTyping, onMarkMessagesAsRead, onFlagContent, onOfferResponse }) => {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState("");

  const getSellerName = (sellerId: string) => {
    const seller = users.find(u => u.email === sellerId);
    return seller?.name || seller?.dealershipName || 'Seller';
  };
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
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
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6 border-b border-gray-200 pb-4">My Inbox</h1>
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 bg-white rounded-xl shadow-lg h-[75vh]">
          {/* Conversation List */}
          <aside className="border-r border-gray-200-200 dark:border-gray-200-200 flex flex-col">
            <div className="p-4 border-b border-gray-200-200 dark:border-gray-200-200">
                  <h2 className="text-lg font-bold text-spinny-text-dark dark:text-spinny-text-dark">Conversations</h2>
            </div>
            <div className="overflow-y-auto">
                  {sortedConversations.length > 0 ? (
                      <ul>
                          {sortedConversations.map(conv => {
                              const lastMessage = conv.messages[conv.messages.length - 1];
                              const messageText = lastMessage?.type === 'offer'
                                  ? `Offer: ${lastMessage.payload?.offerPrice}`
                                  : lastMessage?.text || 'No messages yet.';
                              return (
                                  <li key={conv.id}>
                                      <button
                                          onClick={() => handleSelectConversation(conv)}
                                          className={`w-full text-left p-4 border-l-4 transition-colors ${selectedConv?.id === conv.id ? 'bg-spinny-off-white dark:bg-white' : 'border-transparent hover:bg-spinny-off-white dark:hover:bg-brand-gray-700'}`} style={selectedConv?.id === conv.id ? { borderColor: '#FF6B35' } : undefined}
                                      >
                                          <div className="flex justify-between items-center mb-1">
                                              <p className="font-bold text-spinny-text-dark dark:text-spinny-text-dark truncate">{conv.vehicleName}</p>
                                              {!conv.isReadByCustomer && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ml-2" style={{ backgroundColor: '#FF6B35' }}></div>}
                                          </div>
                                          <p className="text-sm text-brand-gray-600 dark:text-spinny-text-dark">With {getSellerName(conv.sellerId)}</p>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                                              {lastMessage && (
                                                  lastMessage.sender === 'user' ? (
                                                      <span><span className="font-semibold">You: </span>{lastMessage.type === 'test_drive_request' ? 'Test Drive Request' : messageText}</span>
                                                  ) : lastMessage.sender === 'seller' ? (
                                                      <span><span className="font-semibold">{getSellerName(conv.sellerId)}: </span>{messageText}</span>
                                                  ) : (
                                                      <em>{lastMessage.text}</em>
                                                  )
                                              )}
                                          </p>
                                      </button>
                                  </li>
                              );
                          })}
                      </ul>
                  ) : (
                      <p className="p-4 text-center text-gray-600 dark:text-gray-400">You have no messages yet. Inquire about a vehicle to start a conversation.</p>
                  )}
            </div>
          </aside>

          {/* Chat View */}
          <main className="flex flex-col">
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
                      height="h-96"
                  />
              ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-center p-8 bg-white rounded-lg shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <h3 className="mt-4 text-xl font-semibold text-gray-900">Select a Conversation</h3>
                      <p className="text-gray-600 mt-1">Choose a conversation from the left to view messages.</p>
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