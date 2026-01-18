import React, { useState, useRef, useEffect, memo } from 'react';
import type { Conversation, ChatMessage } from '../types.js';
import ReadReceiptIcon, { OfferMessage, OfferModal } from './ReadReceiptIcon.js';

interface InlineChatProps {
  conversation: Conversation;
  currentUserRole: 'customer' | 'seller';
  otherUserName: string;
  onSendMessage: (messageText: string, type?: ChatMessage['type'], payload?: any) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  onMakeOffer?: () => void;
  onStartCall?: (phone: string) => void;
  callTargetPhone?: string;
  callTargetName?: string;
  className?: string;
  height?: string;
}

const EMOJIS = ['😀', '😂', '👍', '❤️', '🙏', '😊', '🔥', '🎉', '🚗', '🤔', '👋', '👀'];

const TypingIndicator: React.FC<{ name: string }> = ({ name }) => (
    <div className="flex items-start">
        <div className="rounded-xl px-4 py-3 max-w-lg bg-gray-100 text-gray-700 flex items-center space-x-2">
            <span className="text-sm font-medium">{name} is typing</span>
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
        </div>
    </div>
);

export const InlineChat: React.FC<InlineChatProps> = memo(({ 
  conversation, 
  currentUserRole, 
  otherUserName, 
  onSendMessage, 
  typingStatus, 
  onUserTyping, 
  onMarkMessagesAsRead, 
  onFlagContent, 
  onOfferResponse, 
  onMakeOffer,
  onStartCall,
  callTargetPhone,
  callTargetName,
  className = "",
  height = "h-96"
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages, typingStatus]);
  
  useEffect(() => {
    onMarkMessagesAsRead(conversation.id, currentUserRole);
  }, [conversation, onMarkMessagesAsRead, currentUserRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
            setShowEmojiPicker(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onUserTyping(conversation.id, currentUserRole);
  };
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFlagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversation && !conversation.isFlagged) {
        if(window.confirm('Are you sure you want to report this conversation for review?')) {
            const reason = window.prompt("Please provide a reason for reporting this conversation (optional):");
            if (reason !== null) {
                onFlagContent('conversation', conversation.id, reason || "No reason provided");
            }
        }
    }
  };

  const handleSendOffer = (price: number) => {
    onSendMessage(`Offer: ${price}`, 'offer', {
      offerPrice: price,
      status: 'pending'
    });
    setIsOfferModalOpen(false);
  };

  const senderType = currentUserRole === 'customer' ? 'user' : 'seller';
  const otherUserRole = currentUserRole === 'customer' ? 'seller' : 'customer';

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 flex flex-col ${className}`} style={{ height: height }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div className="flex-grow">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{conversation.vehicleName}</h3>
          <p className="text-sm text-gray-600">Chat with {otherUserName}</p>
        </div>
        <div className="flex items-center gap-2">
          {callTargetPhone && (
            <button
              onClick={() => onStartCall ? onStartCall(callTargetPhone) : window.open(`tel:${callTargetPhone}`)}
              className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
              aria-label={`Call ${callTargetName || 'contact'}`}
              title={`Call ${callTargetName || 'contact'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2.003 5.884c-.005-1.054.917-1.93 1.97-1.823 1.022.105 1.936.563 2.654 1.282l1.12 1.12a1 1 0 01.106 1.31l-.723 1.085c-.195.293-.164.68.09.935l3.142 3.142a.75.75 0 00.935.09l1.085-.723a1 1 0 011.31.106l1.12 1.12a4.25 4.25 0 011.282 2.654c.107 1.053-.769 1.975-1.823 1.97-2.54-.012-5.02-.998-6.918-2.897-1.898-1.898-2.884-4.378-2.897-6.918z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <button 
            onClick={handleFlagClick} 
            disabled={conversation.isFlagged} 
            className="disabled:opacity-50 p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors" 
            aria-label="Report conversation" 
            title={conversation.isFlagged ? "This conversation has been reported" : "Report conversation"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${conversation.isFlagged ? 'text-red-500' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 01-1-1V6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-grow p-4 overflow-y-auto bg-gray-50 space-y-4 ${height}`}>
        {conversation.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {conversation.messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === senderType ? 'items-end' : 'items-start'}`}>
                {msg.sender === 'system' && (
                  <div className="text-center text-xs text-gray-600 italic py-2 w-full">{msg.text}</div>
                )}
                {msg.sender !== 'system' && (
                  <>
                    <div className={`px-4 py-3 max-w-md ${msg.sender === senderType ? 'text-white rounded-l-xl rounded-t-xl' : 'bg-white text-gray-900 rounded-r-xl rounded-t-xl shadow-sm'}`} 
                         style={msg.sender === senderType ? { background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' } : undefined}>
                      {msg.type === 'offer' ? (
                        <OfferMessage 
                          msg={msg} 
                          currentUserRole={currentUserRole} 
                          listingPrice={conversation.vehiclePrice} 
                          onRespond={(messageId, response, counterPrice) => onOfferResponse(conversation.id, messageId, response, counterPrice)} 
                        />
                      ) : (
                        <p className="text-sm break-words">{msg.text}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 px-1 flex items-center">
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      {msg.sender === senderType && <ReadReceiptIcon isRead={msg.isRead} />}
                    </div>
                  </>
                )}
              </div>
            ))}
            {typingStatus?.conversationId === conversation.id && typingStatus?.userRole === otherUserRole && (
              <TypingIndicator name={otherUserName} />
            )}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white relative rounded-b-lg">
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-full mb-2 w-full bg-white rounded-lg shadow-lg p-2 grid grid-cols-6 gap-2 border border-gray-200">
            {EMOJIS.map(emoji => (
              <button 
                key={emoji} 
                onClick={() => handleEmojiClick(emoji)} 
                className="text-2xl hover:bg-gray-100 rounded-md p-1 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <button 
            type="button" 
            onClick={() => setShowEmojiPicker(prev => !prev)} 
            className="p-2 text-gray-500 hover:text-orange-500 transition-colors" 
            aria-label="Add emoji"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          {currentUserRole === 'customer' ? (
            <button 
              type="button" 
              onClick={() => setIsOfferModalOpen(true)} 
              className="p-2 text-gray-500 hover:text-orange-500 transition-colors" 
              aria-label="Make an offer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" />
              </svg>
            </button>
          ) : ( 
            onMakeOffer && 
            <button 
              type="button" 
              onClick={onMakeOffer} 
              className="p-2 text-gray-500 hover:text-orange-500 transition-colors" 
              aria-label="Make an offer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-grow bg-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors border-0"
          />
          <button 
            type="submit" 
            className="p-2 text-orange-500 hover:text-orange-600 transition-colors" 
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      {/* Offer Modal */}
      {isOfferModalOpen && (
        <OfferModal
          title="Make an Offer"
          listingPrice={conversation.vehiclePrice}
          onSubmit={handleSendOffer}
          onClose={() => setIsOfferModalOpen(false)}
        />
      )}
    </div>
  );
});

InlineChat.displayName = 'InlineChat';

export default InlineChat;
