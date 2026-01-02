
import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, ChatMessage } from '../types';
import ReadReceiptIcon, { OfferMessage, OfferModal } from './ReadReceiptIcon';

interface ChatWidgetProps {
  conversation: Conversation;
  currentUserRole: 'customer' | 'seller';
  otherUserName: string;
  onClose: () => void;
  onSendMessage: (messageText: string, type?: ChatMessage['type'], payload?: any) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  onMakeOffer?: () => void; // For seller dashboard
}

const EMOJIS = ['😀', '😂', '👍', '❤️', '🙏', '😊', '🔥', '🎉', '🚗', '🤔', '👋', '👀'];

const TypingIndicator: React.FC<{ name: string }> = ({ name }) => (
    <div className="flex items-start">
        <div className="rounded-xl px-4 py-3 max-w-lg bg-spinny-light-gray dark:bg-brand-gray-700 text-spinny-text-dark dark:text-brand-gray-200 flex items-center space-x-2">
            <span className="text-sm font-medium">{name} is typing</span>
            <div className="w-1.5 h-1.5 bg-white0 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-white0 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-white0 rounded-full animate-bounce"></div>
        </div>
    </div>
);

export const ChatWidget: React.FC<ChatWidgetProps> = memo(({ conversation, currentUserRole, otherUserName, onClose, onSendMessage, typingStatus, onUserTyping, onMarkMessagesAsRead, onFlagContent, onOfferResponse, onMakeOffer }) => {
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(true); // Start minimized like Facebook Messenger
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  
  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Auto-open chat when conversation starts (even with no messages) or has new messages
  useEffect(() => {
    // Auto-open when conversation is first set (even with no messages)
    if (!hasOpenedOnce) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Auto-opening chat - conversation initialized', { 
          conversationId: conversation.id,
          hasMessages: conversation.messages.length > 0
        });
      }
      setIsMinimized(false);
      setHasOpenedOnce(true);
    } else if (conversation.messages.length > 0 && isMinimized) {
      // Also auto-open if new messages arrive while minimized
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Auto-opening chat - new messages received');
      }
      setIsMinimized(false);
    }
  }, [conversation.id, conversation.messages.length, hasOpenedOnce, isMinimized]);
  
  // Reset hasOpenedOnce when conversation changes
  useEffect(() => {
    setHasOpenedOnce(false);
  }, [conversation.id]);
  
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
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ChatWidget sending message:', inputText);
    }
    onSendMessage(inputText);
    setInputText('');
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 400); // Wait for animation
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

  // Handle minimize/maximize with animation
  const handleToggleMinimize = () => {
    if (!isMinimized) {
      setIsAnimating(true);
      setTimeout(() => {
        setIsMinimized(true);
        setIsAnimating(false);
      }, 300);
    } else {
      setIsMinimized(false);
    }
  };

  // Calculate unread messages count (messages from other user that are not read)
  const unreadCount = conversation.messages.filter(msg => {
    // Only count messages from the other user that haven't been read
    return msg.sender !== senderType && msg.sender !== 'system' && !msg.isRead;
  }).length;

  // Use React Portal to render at document body level (like Facebook Messenger)
  // This ensures fixed positioning works correctly regardless of parent containers
  // Try to get document.body immediately, fallback to useEffect if not available
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatWidget.tsx:169',message:'Portal target initial state',data:{hasDocument:typeof document !== 'undefined',hasBody:typeof document !== 'undefined' && !!document.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-3'})}).catch(()=>{});
    // #endregion
    // Try to get document.body synchronously on initial render
    if (typeof document !== 'undefined' && document.body) {
      return document.body;
    }
    return null;
  });
  
  // Ensure document.body is available before setting portal target
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatWidget.tsx:178',message:'Portal target useEffect',data:{hasPortalTarget:!!portalTarget,hasDocument:typeof document !== 'undefined',hasBody:typeof document !== 'undefined' && !!document.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-3'})}).catch(()=>{});
    // #endregion
    if (!portalTarget && typeof document !== 'undefined') {
      // If body isn't ready, try again after a short delay
      const checkBody = () => {
        if (document.body) {
          setPortalTarget(document.body);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatWidget.tsx:183',message:'Portal target set successfully',data:{hasBody:!!document.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-3'})}).catch(()=>{});
          // #endregion
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 ChatWidget: Portal target set to document.body');
          }
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatWidget.tsx:189',message:'Portal target retry - body not ready',data:{hasBody:!!document.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-3'})}).catch(()=>{});
          // #endregion
          // Retry after a short delay
          setTimeout(checkBody, 50);
        }
      };
      checkBody();
    } else if (portalTarget && process.env.NODE_ENV === 'development') {
      console.log('🔧 ChatWidget: Portal target already set');
    }
  }, [portalTarget]);

  // Floating chat button - ALWAYS visible (like Facebook Messenger)
  const chatButton = (
    <div 
      style={{ 
        position: 'fixed',
        bottom: isMobile ? '20px' : '24px',
        right: isMobile ? '20px' : '24px',
        zIndex: 999999, // Increased z-index to ensure it's above everything
        pointerEvents: 'auto',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
        transform: isMinimized ? 'scale(1)' : 'scale(0.85)',
        opacity: isMinimized ? 1 : 0.6,
        // Ensure it's always on top
        isolation: 'isolate',
        // Force visibility
        visibility: 'visible',
        display: 'block'
      }}
      onClick={(e) => {
        // Prevent event bubbling
        e.stopPropagation();
      }}
    >
        <button
            onClick={(e) => {
              e.stopPropagation();
              if (process.env.NODE_ENV === 'development') {
                console.log('🔧 Chat button clicked, isMinimized:', isMinimized);
              }
              handleToggleMinimize();
            }}
            className="relative w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center font-bold transition-all duration-300 hover:scale-110 active:scale-95"
            style={{ 
              background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)',
              boxShadow: '0 4px 16px rgba(0, 132, 255, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
              border: 'none',
              outline: 'none',
              // Ensure button is clickable
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none'
            }}
            aria-label={isMinimized ? "Open chat" : "Minimize chat"}
        >
            {isMinimized ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            )}
            {/* Notification badge if there are unread messages */}
            {unreadCount > 0 && isMinimized && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white px-1.5 animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    </div>
  );

  // Chat window - slides up from bottom (like Facebook Messenger)
  const chatWindow = !isMinimized ? (
    <div 
      className="flex flex-col bg-white rounded-t-2xl shadow-2xl overflow-hidden"
      style={{ 
        position: 'fixed',
        bottom: isMobile ? '80px' : '90px',
        right: isMobile ? '20px' : '24px',
        width: isMobile ? 'calc(100vw - 40px)' : '360px',
        maxWidth: 'calc(100vw - 48px)',
        height: isMobile ? 'calc(100vh - 100px)' : '500px',
        maxHeight: 'calc(100vh - 100px)',
        zIndex: 99998,
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
        opacity: isExiting || isAnimating ? 0 : 1,
        transform: isExiting || isAnimating ? 'translateY(calc(100% + 20px))' : 'translateY(0)',
        pointerEvents: isExiting ? 'none' : 'auto',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px'
      }}
      onClick={(e) => {
        // Prevent clicks inside chat from closing it
        e.stopPropagation();
      }}
    >
        {/* Header - Facebook Messenger style */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="flex items-center gap-3 flex-grow min-w-0">
                {/* Avatar circle */}
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                        {otherUserName.charAt(0).toUpperCase()}
                    </span>
                </div>
                <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{otherUserName}</h3>
                    <p className="text-xs text-white/90 truncate">{conversation.vehicleName}</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={handleFlagClick} disabled={conversation.isFlagged} className="disabled:opacity-50 p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Report conversation" title={conversation.isFlagged ? "This conversation has been reported" : "Report conversation"}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 01-1-1V6z" clipRule="evenodd" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleToggleMinimize(); }} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Minimize chat">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleClose(); }} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Close chat">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>

        {/* Messages - Facebook Messenger style */}
        <div className="flex-grow p-4 overflow-y-auto bg-gray-50 space-y-3" style={{ backgroundColor: '#F0F2F5' }}>
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
                      {msg.sender === 'system' && <div className="text-center text-xs text-gray-600 dark:text-gray-400 italic py-2 w-full">{msg.text}</div>}
                      {msg.sender !== 'system' && (
                          <>
                              <div className={`px-3 py-2 max-w-xs ${ msg.sender === senderType ? 'text-white rounded-2xl rounded-tr-sm' : 'bg-white text-gray-900 rounded-2xl rounded-tl-sm'}`} style={msg.sender === senderType ? { background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)' } : { backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)' }}>
                                  {msg.type === 'offer' ? <OfferMessage msg={msg} currentUserRole={currentUserRole} listingPrice={conversation.vehiclePrice} onRespond={(messageId, response, counterPrice) => onOfferResponse(conversation.id, messageId, response, counterPrice)} /> : <p className="text-sm break-words">{msg.text}</p>}
                              </div>
                              <div className="text-xs text-gray-400 mt-1 px-1 flex items-center">
                                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  {msg.sender === senderType && <ReadReceiptIcon isRead={msg.isRead} />}
                              </div>
                          </>
                      )}
                  </div>
                ))}
                {typingStatus?.conversationId === conversation.id && typingStatus?.userRole === otherUserRole && <TypingIndicator name={otherUserName} />}
                <div ref={chatEndRef} />
              </>
            )}
        </div>

        {/* Input - Facebook Messenger style */}
        <div className="p-3 border-t border-gray-200 bg-white relative">
            {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-full mb-2 w-full bg-white dark:bg-brand-gray-700 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-2">
                    {EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="text-2xl hover:bg-spinny-light-gray dark:hover:bg-brand-gray-600 rounded-md p-1">
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-1 items-center">
                <button type="button" onClick={() => setShowEmojiPicker(prev => !prev)} className="p-2 text-gray-500 hover:text-gray-700 rounded-full transition-colors" aria-label="Add emoji">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                {currentUserRole === 'customer' ? (
                     <button type="button" onClick={() => setIsOfferModalOpen(true)} className="p-2 text-gray-500 hover:text-gray-700 rounded-full transition-colors" aria-label="Make an offer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" /></svg>
                    </button>
                ) : ( onMakeOffer && 
                     <button type="button" onClick={onMakeOffer} className="p-2 text-gray-500 hover:text-gray-700 rounded-full transition-colors" aria-label="Make an offer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" /></svg>
                    </button>
                )}
                <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    className="flex-grow bg-gray-100 rounded-full px-4 py-2.5 focus:outline-none border-0 text-sm" 
                    style={{ 
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none',
                        backgroundColor: '#F0F2F5'
                    }}
                    onFocus={(e) => { 
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0, 132, 255, 0.2)'; 
                    }} 
                    onBlur={(e) => { 
                        e.currentTarget.style.backgroundColor = '#F0F2F5';
                        e.currentTarget.style.boxShadow = ''; 
                    }}
                />
                <button type="submit" className="p-2 transition-colors rounded-full hover:bg-gray-100" aria-label="Send message" style={{ color: '#0084FF' }} onMouseEnter={(e) => e.currentTarget.style.color = '#0066CC'} onMouseLeave={(e) => e.currentTarget.style.color = '#0084FF'}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
            </form>
        </div>
    </div>
  ) : null;

  // Render using Portal to ensure it's at document body level (bypasses any parent container positioning)
  // If portal is not available (SSR or initial render), return null
  // The useEffect will set portalTarget once document.body is ready
  if (!portalTarget) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ChatWidget: Waiting for portal target (document.body)');
    }
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 ChatWidget: Rendering chat button and window', { 
      isMinimized, 
      hasMessages: conversation.messages.length > 0,
      portalTarget: !!portalTarget,
      conversationId: conversation.id
    });
  }

  // Ensure button is always rendered
  return (
    <>
      {/* Always render button (like Facebook Messenger) - this should always be visible */}
      {portalTarget && createPortal(chatButton, portalTarget)}
      {/* Render chat window when not minimized */}
      {!isMinimized && createPortal(chatWindow, portalTarget)}
      {isOfferModalOpen && (
        <OfferModal
            title="Make an Offer"
            listingPrice={conversation.vehiclePrice}
            onSubmit={handleSendOffer}
            onClose={() => setIsOfferModalOpen(false)}
        />
      )}
    </>
  );
});
