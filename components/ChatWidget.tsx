import { logInfo } from '../utils/logger.js';

import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, ChatMessage, DealLead } from '../types';
import ReadReceiptIcon, { OfferMessage, TestDriveMessage } from './ReadReceiptIcon';
import { telHrefFromRawPhone, phoneDisplayCompact } from '../utils/numberUtils';
import { uploadImage, uploadChatAudio } from '../services/imageUploadService';
import { ChatMessageImage } from './ChatMessageImage';
import { ChatMessageVoice } from './ChatMessageVoice';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { filterMessagesForViewer } from '../utils/conversationView';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';
import { isOfferChatMessage } from '../utils/isOfferChatMessage';
import { useVisualViewportBottomInset } from '../hooks/useVisualViewportBottomInset';
import {
  scrollContainerToBottom,
  scrollContainerToShowElement,
} from '../utils/scrollWithinContainer.js';
import DealTimelinePanel from './DealTimelinePanel';
import DealStageChip from './DealStageChip';
import { getDealLead } from '../services/dealService';
import { useApp } from './AppProvider';

interface ChatWidgetProps {
  conversation: Conversation;
  currentUserRole: 'customer' | 'seller';
  currentUserEmail?: string;
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
  onTestDriveResponse?: (
    conversationId: string,
    messageId: number,
    newStatus: 'confirmed' | 'rejected',
  ) => void;
  onClearChat?: (conversationId: string) => void | Promise<void>;
  onStartCall?: (phone: string) => void;
  callTargetPhone?: string;
  callTargetName?: string;
  isInlineLaunch?: boolean;
  otherUserOnline?: boolean; // Online/offline status
  /** Toggle thread-level read state (list + badges); optional. */
  onSetConversationReadState?: (conversationId: string, isRead: boolean) => void;
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
    currentUserEmail,
    otherUserName,
    onClose,
    onSendMessage,
    typingStatus,
    onUserTyping,
    onUserStoppedTyping,
    onMarkMessagesAsRead,
    onFlagContent,
    onOfferResponse,
    onTestDriveResponse,
    onClearChat,
    onStartCall,
    callTargetPhone,
    callTargetName,
    isInlineLaunch,
    otherUserOnline,
    uploaderEmail,
    onSetConversationReadState,
  }) => {
  const { runIfConfirmed } = useApp();
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(!isInlineLaunch); // Inline launches (CTA click) start opened
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [userManuallyClosed, setUserManuallyClosed] = useState(false); // Track if user explicitly closed
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dealLead, setDealLead] = useState<DealLead | null>(null);
  const voiceRecorder = useVoiceRecorder();

  useEffect(() => {
    if (userManuallyClosed || isExiting) return;
    setIsMinimized(!isInlineLaunch);
    if (isInlineLaunch) setHasOpenedOnce(true);
  }, [isInlineLaunch, conversation.id, userManuallyClosed, isExiting]);

  const chatBlockedByDeal = dealLead?.chatStatus === 'pending' && currentUserRole === 'customer';
  const focusDealRoom = () => {
    const room = document.getElementById(`deal-room-${conversation.id}`);
    room?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!conversation.id) return;
    getDealLead({ conversationId: conversation.id })
      .then(setDealLead)
      .catch(() => setDealLead(null));
  }, [conversation.id]);

  const visibleMessages = useMemo(
    () => filterMessagesForViewer(conversation, currentUserRole),
    [conversation, currentUserRole],
  );

  const firstUnreadMessageId = useMemo(() => {
    const otherSender = currentUserRole === 'customer' ? 'seller' : 'user';
    const first = visibleMessages.find((m) => m.sender === otherSender && !m.isRead);
    return first ? String(first.id) : null;
  }, [visibleMessages, currentUserRole]);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /** Capacitor: sit above tab row (56px) + same safe-area as MobileBottomNav (env added in calc). */
  const bottomTabBarRowPx = isMobile && isCapacitorNativeApp() ? 56 : 0;
  const keyboardInset = useVisualViewportBottomInset();
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
        logInfo('🔧 Auto-opening chat - conversation initialized', { 
          conversationId: conversation.id,
          hasMessages: visibleMessages.length > 0
        });
      }
      setIsMinimized(false);
      setHasOpenedOnce(true);
    } else if (visibleMessages.length > 0 && isMinimized && !userManuallyClosed && !isExiting) {
      // Also auto-open if new messages arrive while minimized (only if not manually closed and not exiting)
      if (process.env.NODE_ENV === 'development') {
        logInfo('🔧 Auto-opening chat - new messages received');
      }
      setIsMinimized(false);
    }
  }, [conversation.id, visibleMessages.length, hasOpenedOnce, isMinimized, userManuallyClosed, isExiting]);
  
  // Reset states when conversation changes
  useEffect(() => {
    setHasOpenedOnce(false);
    setUserManuallyClosed(false); // Reset manual close flag for new conversation
    lastMarkReadSignatureRef.current = '';
  }, [conversation.id]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkReadSignatureRef = useRef<string>('');

  useEffect(() => {
    if (isMinimized) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    if (firstUnreadRef.current) {
      scrollContainerToShowElement(container, firstUnreadRef.current, {
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    scrollContainerToBottom(container, 'smooth');
  }, [visibleMessages, typingStatus, firstUnreadMessageId, isMinimized]);

  const lastMessageId =
    visibleMessages.length > 0
      ? visibleMessages[visibleMessages.length - 1]?.id
      : undefined;

  useEffect(() => {
    // Only mark as read when the chat window is actually open. Also debounce rapid
    // message bursts (e.g. several realtime events in quick succession) into a single
    // server call so we don't write-amplify the conversations table.
    if (isMinimized) return;
    const sig = `${conversation.id}:${String(lastMessageId ?? '')}:${currentUserRole}`;
    if (lastMarkReadSignatureRef.current === sig) return;
    const handle = setTimeout(() => {
      lastMarkReadSignatureRef.current = sig;
      onMarkMessagesAsRead(conversation.id, currentUserRole);
    }, 500);
    return () => clearTimeout(handle);
  }, [conversation.id, currentUserRole, lastMessageId, isMinimized, onMarkMessagesAsRead]);

  useEffect(() => {
    const closeIfOutside = (target: EventTarget | null) => {
      if (emojiPickerRef.current && target instanceof Node && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
    };
    const onMouseDown = (event: MouseEvent) => closeIfOutside(event.target);
    const onTouchStart = (event: TouchEvent) => closeIfOutside(event.targetTouches[0]?.target ?? null);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('touchstart', onTouchStart);
    };
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
      logInfo('🔧 ChatWidget sending message:', inputText);
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
      logInfo('🔧 ChatWidget: handleClose called', { 
        isExiting, 
        isMinimized,
        conversationId: conversation.id 
      });
    }
    
    // Prevent multiple close calls
    if (isExiting) {
      if (process.env.NODE_ENV === 'development') {
        logInfo('🔧 ChatWidget: Already closing, ignoring duplicate close call');
      }
      return;
    }
    
    // Set states immediately
    setUserManuallyClosed(true); // Mark that user explicitly closed
    setIsExiting(true);
    setIsMinimized(true); // Ensure it's minimized before closing
    setShowEmojiPicker(false); // Close emoji picker if open
    
    // Close immediately - call onClose directly
    try {
      if (process.env.NODE_ENV === 'development') {
        logInfo('🔧 ChatWidget: Calling onClose callback immediately');
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
        void runIfConfirmed('Are you sure you want to report this conversation for review?', () => {
            const reason = window.prompt("Please provide a reason for reporting this conversation (optional):");
            if (reason !== null) {
                onFlagContent('conversation', conversation.id, reason || "No reason provided");
            }
        });
    }
  };

  const senderType = currentUserRole === 'customer' ? 'user' : 'seller';
  const otherUserRole = currentUserRole === 'customer' ? 'seller' : 'customer';

  const mobileCallHref = callTargetPhone ? telHrefFromRawPhone(callTargetPhone) : null;
  const mobileCallLabel = callTargetPhone ? phoneDisplayCompact(callTargetPhone) : '';

  const threadIsRead =
    currentUserRole === 'seller' ? conversation.isReadBySeller : conversation.isReadByCustomer;

  // Handle minimize/maximize with animation
  const handleToggleMinimize = () => {
    if (!isMinimized) {
      setUserManuallyClosed(true);
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

  const unreadCount = visibleMessages.filter((msg) => {
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
            logInfo('🔧 ChatWidget: Portal target set to document.body');
          }
        } else {
          // Retry after a short delay
          setTimeout(checkBody, 50);
        }
      };
      checkBody();
    } else if (portalTarget && process.env.NODE_ENV === 'development') {
      logInfo('🔧 ChatWidget: Portal target already set');
    }
  }, [portalTarget]);

  // High z-index over mobile nav (z-40); avoid extreme values — some WebViews mishandle them.
  const FLOATING_Z_INDEX = 999999;

  // Floating chat button - ALWAYS visible
  const chatButton = (
    <div 
      style={{ 
        position: 'fixed',
        bottom: isMobile
          ? `calc(20px + ${bottomTabBarRowPx}px + env(safe-area-inset-bottom, 0px))`
          : '24px',
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
                logInfo('🔧 Chat button clicked, isMinimized:', isMinimized);
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
        bottom: isMobile
          ? `calc(16px + ${bottomTabBarRowPx}px + env(safe-area-inset-bottom, 0px))`
          : '20px',
        right: isMobile ? '16px' : '20px',
        width: isMobile ? 'calc(100vw - 32px)' : '360px',
        maxWidth: 'calc(100vw - 32px)',
        height: isMobile
          ? `calc(100vh - ${80 + bottomTabBarRowPx}px - env(safe-area-inset-bottom, 0px))`
          : '460px',
        maxHeight: isMobile
          ? `calc(100vh - ${80 + bottomTabBarRowPx}px - env(safe-area-inset-bottom, 0px))`
          : 'calc(100vh - 80px)',
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
                    {dealLead ? (
                      <div className="mt-1">
                        <DealStageChip lead={dealLead} />
                      </div>
                    ) : null}
                </div>
            </div>
            <div className="flex items-center gap-1">
                {onSetConversationReadState && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetConversationReadState(conversation.id, !threadIsRead);
                    }}
                    className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg"
                    aria-label={threadIsRead ? 'Mark conversation as unread' : 'Mark conversation as read'}
                  >
                    {threadIsRead ? 'Unread' : 'Read'}
                  </button>
                )}
                {callTargetPhone && (!isMobile || !mobileCallHref) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStartCall ? onStartCall(callTargetPhone) : window.open(`tel:${callTargetPhone}`); }}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label={`Call ${callTargetName || 'contact'}`}
                    title={`Call ${callTargetName || 'contact'}${mobileCallLabel ? ` · ${mobileCallLabel}` : ''}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.003 5.884c-.005-1.054.917-1.93 1.97-1.823 1.022.105 1.936.563 2.654 1.282l1.12 1.12a1 1 0 01.106 1.31l-.723 1.085c-.195.293-.164.68.09.935l3.142 3.142a.75 .75 0 00.935.09l1.085-.723a1 1 0 011.31.106l1.12 1.12a4.25 4.25 0 011.282 2.654c.107 1.053-.769 1.975-1.823 1.97-2.54-.012-5.02-.998-6.918-2.897-1.898-1.898-2.884-4.378-2.897-6.918z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                {onClearChat && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void runIfConfirmed(
                        'Clear chat history for you only? You will not see earlier messages here. The other person still sees the full chat until they clear it.',
                        () => {
                          void onClearChat(conversation.id);
                        },
                      );
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
                      logInfo('🔧 Close button clicked - calling handleClose');
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
              <path fillRule="evenodd" d="M2.003 5.884c-.005-1.054.917-1.93 1.97-1.823 1.022.105 1.936.563 2.654 1.282l1.12 1.12a1 1 0 01.106 1.31l-.723 1.085c-.195.293-.164.68.09.935l3.142 3.142a.75 .75 0 00.935.09l1.085-.723a1 1 0 011.31.106l1.12 1.12a4.25 4.25 0 011.282 2.654c.107 1.053-.769 1.975-1.823 1.97-2.54-.012-5.02-.998-6.918-2.897-1.898-1.898-2.884-4.378-2.897-6.918z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold tabular-nums">
              Call <span className="text-gray-600 font-medium">{mobileCallLabel || callTargetPhone.trim()}</span>
            </span>
          </a>
        )}

        {/* Messages - compact list */}
        <div
          ref={messagesContainerRef}
          className="flex-grow p-3 overflow-y-auto bg-gray-50 space-y-3 relative"
          style={{ backgroundColor: '#F7F7F9' }}
        >
            {dealLead && currentUserEmail && (
              <div id={`deal-room-${conversation.id}`}>
                <DealTimelinePanel
                  lead={dealLead}
                  currentUser={{ email: currentUserEmail, name: '', role: currentUserRole === 'seller' ? 'seller' : 'customer', mobile: '', location: '', status: 'active', createdAt: '' }}
                  currentUserRole={currentUserRole}
                  conversationId={conversation.id}
                  onLeadUpdated={setDealLead}
                  onSendPipelineMessage={(messageText, type, payload) =>
                    onSendMessage(messageText, type as ChatMessage['type'], payload)
                  }
                />
              </div>
            )}
            {chatBlockedByDeal && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center text-sm text-amber-800">
                Waiting for seller to accept chat.
              </div>
            )}
            {visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="text-center mb-6">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-gray-600 mb-2">No messages yet. Start the conversation!</p>
                </div>
                {currentUserRole === 'customer' && !chatBlockedByDeal && (
                  <p className="text-gray-600 text-sm">Use Deal Room pipeline to make or counter offers.</p>
                )}
              </div>
            ) : (
              <>
                {visibleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    ref={
                      firstUnreadMessageId && String(msg.id) === firstUnreadMessageId
                        ? firstUnreadRef
                        : null
                    }
                    className={`flex flex-col ${msg.sender === senderType ? 'items-end' : 'items-start'}`}
                  >
                      {msg.sender === 'system' && <div className="text-center text-xs text-gray-600 dark:text-gray-400 italic py-2 w-full">{msg.text}</div>}
                      {msg.sender !== 'system' && (
                          <>
                              <div className={`px-3 py-2 max-w-xs text-sm leading-5 ${ msg.sender === senderType ? 'text-white rounded-2xl rounded-tr-sm' : 'bg-white text-gray-900 rounded-2xl rounded-tl-sm'}`} style={msg.sender === senderType ? { background: 'linear-gradient(135deg, #5f48ff 0%, #7b5bff 100%)' } : { backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)' }}>
                                  {isOfferChatMessage(msg) ? (
                                    <OfferMessage
                                      msg={msg}
                                      currentUserRole={currentUserRole}
                                      listingPrice={conversation.vehiclePrice}
                                      onOpenDealRoom={dealLead ? focusDealRoom : undefined}
                                    />
                                  ) : msg.type === 'test_drive_request' ? (
                                    <TestDriveMessage
                                      msg={msg}
                                      currentUserRole={currentUserRole}
                                      onRespond={
                                        onTestDriveResponse
                                          ? (messageId, response) =>
                                              onTestDriveResponse(conversation.id, messageId, response)
                                          : undefined
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
        

        {/* Composer */}
        <div
          className={`bg-white relative shrink-0 ${
            isMobile
              ? 'border-t border-black/[0.08] px-2 pt-2'
              : 'p-3 border-t border-gray-200'
          }`}
          style={
            isMobile
              ? {
                  paddingBottom: `max(0.75rem, env(safe-area-inset-bottom, 0px), ${keyboardInset}px)`,
                }
              : undefined
          }
        >
            {chatBlockedByDeal ? (
              <p className="text-center text-sm text-slate-500 py-2">Messaging unlocks when seller accepts chat.</p>
            ) : (
            <>
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {attachError && (
              <div className="flex items-center justify-between gap-2 mb-2 px-1" role="alert">
                <p className="text-xs text-red-600 flex-1">{attachError}</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#0084FF] shrink-0"
                  onClick={() => {
                    setAttachError(null);
                    attachmentInputRef.current?.click();
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {voiceRecorder.error && (
              <p className="text-xs text-red-600 mb-2 px-1" role="alert">
                {voiceRecorder.error}
              </p>
            )}
            {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-full mb-2 left-2 right-2 bg-white dark:bg-brand-gray-700 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-2 z-30">
                    {EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="text-2xl hover:bg-reride-light-gray dark:hover:bg-brand-gray-600 rounded-md p-1">
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
            {isMobile ? (
            <form onSubmit={handleSendMessage} className="flex items-end gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording || !uploaderEmail}
                  className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full text-[#0084FF] active:bg-black/5 mb-0.5 disabled:opacity-40"
                  aria-label="Send a photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void handleVoiceTap()}
                  disabled={isUploadingPhoto || isUploadingVoice || !uploaderEmail}
                  className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-full mb-0.5 disabled:opacity-40 ${
                    voiceRecorder.isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-[#0084FF] active:bg-black/5'
                  }`}
                  aria-label={voiceRecorder.isRecording ? 'Stop recording and send voice' : 'Record voice message'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0 flex items-center rounded-[20px] bg-[#F0F2F5] px-3 py-1.5 min-h-[44px] border border-transparent focus-within:border-[#0084FF]/30 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#0084FF]/20">
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="on"
                    placeholder={
                      voiceRecorder.isRecording
                        ? 'Recording… tap mic to send'
                        : isUploadingPhoto || isUploadingVoice
                          ? 'Uploading…'
                          : 'Message…'
                    }
                    disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
                    className="flex-1 min-w-0 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-500 outline-none py-1.5 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(prev => !prev)}
                    className="shrink-0 p-1.5 rounded-full text-gray-500 active:bg-black/5"
                    aria-label="Add emoji"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!inputText.trim() || isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
                  className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-full mb-0.5 transition-all ${
                    inputText.trim()
                      ? 'bg-[#0084FF] text-white shadow-md active:scale-95'
                      : 'bg-[#E4E6EB] text-gray-400 cursor-not-allowed'
                  }`}
                  aria-label="Send message"
                >
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
            </form>
            ) : (
            <form onSubmit={handleSendMessage} className="flex gap-1.5 items-end">
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording || !uploaderEmail}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-full transition-colors disabled:opacity-40 shrink-0"
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
                  className={`p-2 rounded-full transition-colors disabled:opacity-40 shrink-0 ${
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
                <div className="flex-1 min-w-0 flex items-center rounded-full bg-gray-100 px-3 py-1.5 min-h-[40px] border border-transparent focus-within:border-[#0084FF]/30 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#0084FF]/20">
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="on"
                    placeholder={
                      voiceRecorder.isRecording
                        ? 'Recording… tap mic to send'
                        : isUploadingPhoto || isUploadingVoice
                          ? 'Uploading…'
                          : 'Type a message...'
                    }
                    disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 outline-none py-1 disabled:opacity-60"
                  />
                  <button type="button" onClick={() => setShowEmojiPicker(prev => !prev)} className="shrink-0 p-1 text-gray-500 hover:text-gray-700 rounded-full transition-colors" aria-label="Add emoji">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!inputText.trim() || isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
                  className={`p-2 transition-all rounded-full shrink-0 ${
                    inputText.trim()
                      ? 'text-[#0084FF] hover:bg-blue-50'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                  aria-label="Send message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
            </form>
            )}
            </>
            )}
        </div>
    </div>
  ) : null;

  // Render using Portal to ensure it's at document body level (bypasses any parent container positioning)
  // If portal is not available (SSR or initial render), return null
  // The useEffect will set portalTarget once document.body is ready
  if (!portalTarget) {
    if (process.env.NODE_ENV === 'development') {
      logInfo('🔧 ChatWidget: Waiting for portal target (document.body)');
    }
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    logInfo('🔧 ChatWidget: Rendering chat button and window', { 
      isMinimized, 
      hasMessages: visibleMessages.length > 0,
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
    </>
  );
});
