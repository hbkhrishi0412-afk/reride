
import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, ChatMessage } from '../types';
import ReadReceiptIcon, { OfferMessage, OfferModal } from './ReadReceiptIcon';
import { telHrefFromRawPhone, phoneDisplayCompact } from '../utils/numberUtils';
import { uploadImage, uploadChatAudio } from '../services/imageUploadService';
import { ChatMessageImage } from './ChatMessageImage';
import { ChatMessageVoice } from './ChatMessageVoice';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

interface ChatWidgetProps {
  conversation: Conversation;
  currentUserRole: 'customer' | 'seller';
  otherUserName: string;
  onClose: () => void;
  onSendMessage: (messageText: string, type?: ChatMessage['type'], payload?: any) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onUserStoppedTyping?: (conversationId: string) => void;
  uploaderEmail?: string;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  onClearChat?: (conversationId: string) => void | Promise<void>;
  onMakeOffer?: () => void; // For seller dashboard
  onStartCall?: (phone: string) => void;
  callTargetPhone?: string;
  callTargetName?: string;
  isInlineLaunch?: boolean;
  otherUserOnline?: boolean; // Online/offline status
}

const EMOJIS = ['😀', '😂', '👍', '❤️', '🙏', '😊', '🔥', '🎉', '🚗', '🤔', '👋', '👀'];

const TypingIndicator: React.FC<{ name: string }> = ({ name }) => (
    <div className="flex items-start">
        <div className="rounded-xl px-4 py-3 max-w-lg bg-reride-light-gray dark:bg-brand-gray-700 text-reride-text-dark dark:text-brand-gray-200 flex items-center space-x-2">
            <span className="text-sm font-medium">{name} is typing</span>
            <div className="w-1.5 h-1.5 bg-brand-gray-500 dark:bg-brand-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-brand-gray-500 dark:bg-brand-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-brand-gray-500 dark:bg-brand-gray-400 rounded-full animate-bounce"></div>
        </div>
    </div>
);

export const ChatWidget: React.FC<ChatWidgetProps> = memo(
  ({
    conversation,
    currentUserRole,
    otherUserName,
    onClose,
    onSendMessage,
    typingStatus,
    onUserTyping,
    onUserStoppedTyping,
    onMarkMessagesAsRead,
    onFlagContent,
    onOfferResponse,
    onClearChat,
    onMakeOffer,
    onStartCall,
    callTargetPhone,
    callTargetName,
    isInlineLaunch,
    otherUserOnline,
    uploaderEmail,
  }) => {
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(!isInlineLaunch); // Inline launches (CTA click) start opened
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [userManuallyClosed, setUserManuallyClosed] = useState(false); // Track if user explicitly closed
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const voiceRecorder = useVoiceRecorder();

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Auto-open chat when conversation starts (even with no messages) or has new messages
  // BUT only if user hasn't manually closed it
  useEffect(() => {
    // Don't auto-open if user has manually closed the chat or if exiting
    if (userManuallyClosed || isExiting) {
      return;
    }
    
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
    } else if (conversation.messages.length > 0 && isMinimized && !userManuallyClosed && !isExiting) {
      // Also auto-open if new messages arrive while minimized (only if not manually closed and not exiting)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Auto-opening chat - new messages received');
      }
      setIsMinimized(false);
    }
  }, [conversation.id, conversation.messages.length, hasOpenedOnce, isMinimized, userManuallyClosed, isExiting]);
  
  // Reset states when conversation changes
  useEffect(() => {
    setHasOpenedOnce(false);
    setUserManuallyClosed(false); // Reset manual close flag for new conversation
    lastMarkReadSignatureRef.current = '';
  }, [conversation.id]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkReadSignatureRef = useRef<string>('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages, typingStatus]);

  const lastMessageId =
    conversation.messages?.length && conversation.messages.length > 0
      ? conversation.messages[conversation.messages.length - 1]?.id
      : undefined;

  useEffect(() => {
    const sig = `${conversation.id}:${String(lastMessageId ?? '')}:${currentUserRole}`;
    if (lastMarkReadSignatureRef.current === sig) return;
    lastMarkReadSignatureRef.current = sig;
    onMarkMessagesAsRead(conversation.id, currentUserRole);
  }, [conversation.id, currentUserRole, lastMessageId, onMarkMessagesAsRead]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
            setShowEmojiPicker(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scheduleTypingStop = () => {
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      onUserStoppedTyping?.(conversation.id);
      typingStopTimerRef.current = null;
    }, 1500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputText(v);
    setAttachError(null);
    if (v.trim()) {
      onUserTyping(conversation.id, currentUserRole);
      scheduleTypingStop();
    } else {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      onUserStoppedTyping?.(conversation.id);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    onUserStoppedTyping?.(conversation.id);
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ChatWidget sending message:', inputText);
    }
    onSendMessage(inputText);
    setInputText('');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploaderEmail) {
      if (!uploaderEmail) setAttachError('Sign in to send photos.');
      return;
    }
    setIsUploadingPhoto(true);
    setAttachError(null);
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    onUserStoppedTyping?.(conversation.id);
    try {
      const result = await uploadImage(file, 'chat-messages', uploaderEmail);
      if (!result.success || !result.url) {
        setAttachError(result.error || 'Upload failed');
        return;
      }
      const cap = inputText.trim();
      onSendMessage(cap || '📷 Photo', 'image', { imageUrl: result.url });
      setInputText('');
    } catch {
      setAttachError('Upload failed. Try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleVoiceTap = async () => {
    if (!uploaderEmail) {
      setAttachError('Sign in to send voice notes.');
      return;
    }
    setAttachError(null);
    if (voiceRecorder.isRecording) {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      onUserStoppedTyping?.(conversation.id);
      const r = await voiceRecorder.stopRecording();
      if (!r) return;
      setIsUploadingVoice(true);
      try {
        const ext = r.mimeType.includes('webm') ? 'webm' : r.mimeType.includes('mp4') ? 'm4a' : 'webm';
        const result = await uploadChatAudio(r.blob, `voice_${Date.now()}.${ext}`, r.mimeType);
        if (!result.success || !result.url) {
          setAttachError(result.error || 'Voice upload failed');
          return;
        }
        onSendMessage('🎤 Voice message', 'voice', {
          audioUrl: result.url,
          durationSeconds: r.durationSeconds,
        });
      } finally {
        setIsUploadingVoice(false);
      }
    } else {
      voiceRecorder.clearError();
      await voiceRecorder.startRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    };
  }, []);

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ChatWidget: handleClose called', { 
        isExiting, 
        isMinimized,
        conversationId: conversation.id 
      });
    }
    
    // Prevent multiple close calls
    if (isExiting) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 ChatWidget: Already closing, ignoring duplicate close call');
      }
      return;
    }
    
    // Set states immediately
    setUserManuallyClosed(true); // Mark that user explicitly closed
    setIsExiting(true);
    setIsMinimized(true); // Ensure it's minimized before closing
    setIsOfferModalOpen(false); // Close any open modals
    setShowEmojiPicker(false); // Close emoji picker if open
    
    // Close immediately - call onClose directly
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 ChatWidget: Calling onClose callback immediately');
      }
      // Call onClose directly - no delays
      onClose();
    } catch (error) {
      console.error('❌ Error closing chat:', error);
      // Fallback: try again after a very short delay
      setTimeout(() => {
        try {
          onClose();
        } catch (fallbackError) {
          console.error('❌ Fallback close also failed:', fallbackError);
        }
      }, 50);
    }
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

  const mobileCallHref = callTargetPhone ? telHrefFromRawPhone(callTargetPhone) : null;
  const mobileCallLabel = callTargetPhone ? phoneDisplayCompact(callTargetPhone) : '';

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
      setUserManuallyClosed(false); // Reset manual close flag when user manually opens
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
    // Try to get document.body synchronously on initial render
    if (typeof document !== 'undefined' && document.body) {
      return document.body;
    }
    return null;
  });
  
  // Ensure document.body is available before setting portal target
  useEffect(() => {
    if (!portalTarget && typeof document !== 'undefined') {
      // If body isn't ready, try again after a short delay
      const checkBody = () => {
        if (document.body) {
          setPortalTarget(document.body);
          if (process.env.NODE_ENV === 'development') {
            console.log('🔧 ChatWidget: Portal target set to document.body');
          }
        } else {
          // Retry after a short delay
          setTimeout(checkBody, 50);
        }
      };
      checkBody();
    } else if (portalTarget && process.env.NODE_ENV === 'development') {
      console.log('🔧 ChatWidget: Portal target already set');
    }
  }, [portalTarget]);

  // Use a very high z-index so chat floats over any page content/banners/footers
  const FLOATING_Z_INDEX = 2147482000; // near max, safely above other overlays

  // Floating chat button - ALWAYS visible
  const chatButton = (
    <div 
      style={{ 
        position: 'fixed',
        bottom: isMobile ? '20px' : '24px',
        right: isMobile ? '20px' : '24px',
        zIndex: FLOATING_Z_INDEX,
        pointerEvents: 'auto',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
        transform: isMinimized ? 'scale(1)' : 'scale(0.92)',
        opacity: isMinimized ? 1 : 0.85,
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
            className="relative w-16 h-14 rounded-full text-white shadow-2xl flex items-center justify-center font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ 
              background: 'linear-gradient(135deg, #5f48ff 0%, #7b5bff 100%)',
              boxShadow: '0 8px 24px rgba(95,72,255,0.35), 0 0 0 1px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              border: 'none',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              paddingLeft: isMinimized ? '10px' : '0px',
              paddingRight: isMinimized ? '12px' : '0px',
              gap: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label={isMinimized ? "Open chat" : "Minimize chat"}
        >
            {isMinimized ? (
              <>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                  {otherUserName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-white truncate max-w-[90px]">{otherUserName}</span>
              </>
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
      className="flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={{ 
        position: 'fixed',
        bottom: isMobile ? '16px' : '20px',
        right: isMobile ? '16px' : '20px',
        width: isMobile ? 'calc(100vw - 32px)' : '360px',
        maxWidth: 'calc(100vw - 32px)',
        height: isMobile ? 'calc(100vh - 80px)' : '460px',
        maxHeight: 'calc(100vh - 80px)',
        zIndex: FLOATING_Z_INDEX,
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
        opacity: isExiting || isAnimating ? 0 : 1,
        transform: isExiting || isAnimating ? 'translateY(calc(100% + 20px))' : 'translateY(0)',
        pointerEvents: isExiting ? 'none' : 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
        borderRadius: '16px'
      }}
      onClick={(e) => {
        // Prevent clicks inside chat from closing it
        e.stopPropagation();
      }}
    >
        {/* Header - Compact bar */}
        <div 
          className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center flex-shrink-0 shadow-inner">
                    <span className="font-semibold text-sm">
                        {otherUserName.charAt(0).toUpperCase()}
                    </span>
                </div>
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{otherUserName}</h3>
                        {/* Online/offline indicator */}
                        {otherUserOnline !== undefined && (
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${otherUserOnline ? 'bg-green-500' : 'bg-gray-400'}`} 
                                  title={otherUserOnline ? 'Online' : 'Offline'} />
                        )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{conversation.vehicleName}</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                {callTargetPhone && (!isMobile || !mobileCallHref) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStartCall ? onStartCall(callTargetPhone) : window.open(`tel:${callTargetPhone}`); }}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label={`Call ${callTargetName || 'contact'}`}
                    title={`Call ${callTargetName || 'contact'}${mobileCallLabel ? ` · ${mobileCallLabel}` : ''}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.003 5.884c-.005-1.054.917-1.93 1.97-1.823 1.022.105 1.936.563 2.654 1.282l1.12 1.12a1 1 0 01.106 1.31l-.723 1.085c-.195.293-.164.68.09.935l3.142 3.142a.75.75 0 00.935.09l1.085-.723a1 1 0 011.31.106l1.12 1.12a4.25 4.25 0 011.282 2.654c.107 1.053-.769 1.975-1.823 1.97-2.54-.012-5.02-.998-6.918-2.897-1.898-1.898-2.884-4.378-2.897-6.918z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                {onClearChat && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          'Clear all messages in this chat? The conversation will stay open.',
                        )
                      ) {
                        void onClearChat(conversation.id);
                      }
                    }}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Clear chat history"
                    title="Clear chat history"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
                <button onClick={handleFlagClick} disabled={conversation.isFlagged} className="disabled:opacity-50 p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" aria-label="Report conversation" title={conversation.isFlagged ? "This conversation has been reported" : "Report conversation"}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 01-1-1V6z" clipRule="evenodd" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleToggleMinimize(); }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" aria-label="Minimize chat">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (process.env.NODE_ENV === 'development') {
                      console.log('🔧 Close button clicked - calling handleClose');
                    }
                    // Call handleClose directly without delay
                    if (!isExiting) {
                      handleClose(e);
                    }
                  }}
                  onMouseDown={(e) => {
                    // Prevent event bubbling but don't close here (let onClick handle it)
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors active:opacity-70 active:bg-gray-200" 
                  aria-label="Close chat"
                  type="button"
                  style={{
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    userSelect: 'none',
                    zIndex: 1000 // Ensure button is clickable
                  }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>

        {isMobile && mobileCallHref && callTargetPhone && (
          <a
            href={mobileCallHref}
            onClick={(e) => {
              e.stopPropagation();
              if (onStartCall) {
                e.preventDefault();
                onStartCall(callTargetPhone);
              }
            }}
            className="flex w-full items-center justify-center gap-2 border-b border-gray-200 bg-gray-100 py-3 text-gray-800 active:bg-gray-200"
            aria-label={`Call ${callTargetName || 'contact'} ${mobileCallLabel}`.trim()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-gray-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M2.003 5.884c-.005-1.054.917-1.93 1.97-1.823 1.022.105 1.936.563 2.654 1.282l1.12 1.12a1 1 0 01.106 1.31l-.723 1.085c-.195.293-.164.68.09.935l3.142 3.142a.75.75 0 00.935.09l1.085-.723a1 1 0 011.31.106l1.12 1.12a4.25 4.25 0 011.282 2.654c.107 1.053-.769 1.975-1.823 1.97-2.54-.012-5.02-.998-6.918-2.897-1.898-1.898-2.884-4.378-2.897-6.918z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold tabular-nums">
              Call <span className="text-gray-600 font-medium">{mobileCallLabel || callTargetPhone.trim()}</span>
            </span>
          </a>
        )}

        {/* Messages - compact list */}
        <div className="flex-grow p-3 overflow-y-auto bg-gray-50 space-y-3 relative" style={{ backgroundColor: '#F7F7F9' }}>
            {conversation.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="text-center mb-6">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-gray-600 mb-2">No messages yet. Start the conversation!</p>
                </div>
                {/* Make an Offer Button - Prominent in empty state */}
                {currentUserRole === 'customer' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (process.env.NODE_ENV === 'development') {
                        console.log('🔧 Make Offer button clicked (empty state), opening modal');
                      }
                      setIsOfferModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                      boxShadow: '0 4px 12px rgba(255, 107, 53, 0.4)',
                      pointerEvents: 'auto',
                      zIndex: 10
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" />
                    </svg>
                    <span>Make an Offer</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {conversation.messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender === senderType ? 'items-end' : 'items-start'}`}>
                      {msg.sender === 'system' && <div className="text-center text-xs text-gray-600 dark:text-gray-400 italic py-2 w-full">{msg.text}</div>}
                      {msg.sender !== 'system' && (
                          <>
                              <div className={`px-3 py-2 max-w-xs text-sm leading-5 ${ msg.sender === senderType ? 'text-white rounded-2xl rounded-tr-sm' : 'bg-white text-gray-900 rounded-2xl rounded-tl-sm'}`} style={msg.sender === senderType ? { background: 'linear-gradient(135deg, #5f48ff 0%, #7b5bff 100%)' } : { backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)' }}>
                                  {msg.type === 'offer' ? (
                                    <OfferMessage
                                      msg={msg}
                                      currentUserRole={currentUserRole}
                                      listingPrice={conversation.vehiclePrice}
                                      onRespond={(messageId, response, counterPrice) =>
                                        onOfferResponse(conversation.id, messageId, response, counterPrice)
                                      }
                                    />
                                  ) : msg.type === 'image' && msg.payload?.imageUrl ? (
                                    <div className="space-y-2">
                                      <ChatMessageImage src={msg.payload.imageUrl} />
                                      {msg.text?.trim() && msg.text.trim() !== '📷 Photo' && (
                                        <p className="text-sm break-words">{msg.text}</p>
                                      )}
                                    </div>
                                  ) : msg.type === 'voice' && msg.payload?.audioUrl ? (
                                    <div className="space-y-2">
                                      <ChatMessageVoice
                                        src={msg.payload.audioUrl}
                                        durationSeconds={msg.payload.durationSeconds}
                                      />
                                      {msg.text?.trim() && msg.text.trim() !== '🎤 Voice message' && (
                                        <p className="text-sm break-words">{msg.text}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm break-words">{msg.text}</p>
                                  )}
                              </div>
                              <div className="text-[11px] text-gray-400 mt-1 px-1 flex items-center gap-1">
                                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  {msg.sender === senderType && <ReadReceiptIcon isRead={msg.isRead} status={msg.status} />}
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
        
        {/* Make an Offer Button - Fixed at bottom when messages exist (outside scrollable area) */}
        {conversation.messages.length > 0 && currentUserRole === 'customer' && (
          <div 
            className="px-3 pt-2 pb-1 bg-white border-t border-gray-100"
            style={{
              position: 'relative',
              zIndex: 20,
              pointerEvents: 'auto'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔧 Make Offer button clicked (with messages), opening modal');
                }
                setIsOfferModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 text-sm"
              style={{
                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
                pointerEvents: 'auto',
                zIndex: 21
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" />
              </svg>
              <span>Make an Offer</span>
            </button>
          </div>
        )}

        {/* Input - Facebook Messenger style */}
        <div className="p-3 border-t border-gray-200 bg-white relative">
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {attachError && (
              <p className="text-xs text-red-600 mb-2 px-1" role="alert">
                {attachError}
              </p>
            )}
            {voiceRecorder.error && (
              <p className="text-xs text-red-600 mb-2 px-1" role="alert">
                {voiceRecorder.error}
              </p>
            )}
            {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-full mb-2 w-full bg-white dark:bg-brand-gray-700 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-2">
                    {EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="text-2xl hover:bg-reride-light-gray dark:hover:bg-brand-gray-600 rounded-md p-1">
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-1 items-center">
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording || !uploaderEmail}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-full transition-colors disabled:opacity-40"
                  aria-label="Send a photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void handleVoiceTap()}
                  disabled={isUploadingPhoto || isUploadingVoice || !uploaderEmail}
                  className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
                    voiceRecorder.isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-label={voiceRecorder.isRecording ? 'Stop recording and send voice' : 'Record voice message'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                  </svg>
                </button>
                <button type="button" onClick={() => setShowEmojiPicker(prev => !prev)} className="p-2 text-gray-500 hover:text-gray-700 rounded-full transition-colors" aria-label="Add emoji">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                {currentUserRole === 'customer' ? (
                     <button 
                       type="button" 
                       onClick={(e) => {
                         e.stopPropagation();
                         e.preventDefault();
                         if (process.env.NODE_ENV === 'development') {
                           console.log('🔧 Make Offer button clicked (input area), opening modal');
                         }
                         setIsOfferModalOpen(true);
                       }} 
                       className="p-2 rounded-full transition-colors active:scale-95" 
                       aria-label="Make an offer"
                       style={{
                         color: '#F97316',
                         pointerEvents: 'auto',
                         zIndex: 10
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.1)';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.backgroundColor = 'transparent';
                       }}
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" /></svg>
                    </button>
                ) : ( onMakeOffer && 
                     <button 
                       type="button" 
                       onClick={(e) => {
                         e.stopPropagation();
                         e.preventDefault();
                         onMakeOffer();
                       }} 
                       className="p-2 text-gray-500 hover:text-gray-700 rounded-full transition-colors active:scale-95" 
                       aria-label="Make an offer"
                       style={{
                         pointerEvents: 'auto',
                         zIndex: 10
                       }}
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.22.07.412.164.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 01-1.134 0V7.151c.22.07.412.164.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.662C6.168 6.23 5.5 7.085 5.5 8.003v.486c0 .918.668 1.773 1.624 2.214.509.232.957.488 1.376.786V12.5a.5.5 0 01.5.5h1a.5.5 0 01.5-.5v-1.214c.419-.298.867-.554 1.376-.786C14.332 10.26 15 9.405 15 8.489v-.486c0-.918-.668-1.773-1.624-2.214A4.5 4.5 0 0011 5.092V5z" clipRule="evenodd" /></svg>
                    </button>
                )}
                <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder={
                      voiceRecorder.isRecording
                        ? 'Recording… tap mic to send'
                        : isUploadingPhoto || isUploadingVoice
                          ? 'Uploading…'
                          : 'Type a message...'
                    }
                    disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
                    className="flex-grow bg-gray-100 rounded-full px-4 py-2 focus:outline-none border border-transparent text-sm transition-colors disabled:opacity-60"
                    style={{ 
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none'
                    }}
                    onFocus={(e) => { 
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.border = '1px solid rgba(95,72,255,0.35)';
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(95,72,255,0.12)';
                    }} 
                    onBlur={(e) => { 
                        e.currentTarget.style.backgroundColor = '#F3F4F6';
                        e.currentTarget.style.border = '1px solid transparent';
                        e.currentTarget.style.boxShadow = ''; 
                    }}
                />
                <button type="submit" disabled={!inputText.trim() || isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording} className="p-2 transition-colors rounded-full hover:bg-gray-100 disabled:opacity-40" aria-label="Send message" style={{ color: '#0084FF' }} onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#0066CC'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#0084FF'; }}>
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
      {/* Render Offer Modal in portal to ensure proper z-index and positioning */}
      {isOfferModalOpen && portalTarget && (() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 Rendering Offer Modal in portal', { 
            isOfferModalOpen, 
            hasPortalTarget: !!portalTarget,
            conversationId: conversation.id 
          });
        }
        return createPortal(
          <OfferModal
            title="Make an Offer"
            listingPrice={conversation.vehiclePrice}
            onSubmit={handleSendOffer}
            onClose={() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('🔧 Closing Offer Modal');
              }
              setIsOfferModalOpen(false);
            }}
          />,
          portalTarget
        );
      })()}
    </>
  );
});
