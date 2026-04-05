import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Conversation, User, ChatMessage, Vehicle } from '../types';
import { findUserByParticipantId, resolveSellerPhoneFromProfileOrListing } from '../utils/chatContact';
import { telHrefFromRawPhone, phoneDisplayCompact } from '../utils/numberUtils';
import { View as ViewEnum } from '../types';
import { useConversationList } from '../hooks/useConversationList';
import { formatRelativeTime } from '../utils/date';
import { getThreadLastMessagePreview } from '../utils/messagePreview';
import { filterMessagesForViewer, getLastVisibleMessageForViewer } from '../utils/conversationView';
import { uploadImage, uploadChatAudio } from '../services/imageUploadService';
import { ChatMessageImage } from './ChatMessageImage';
import { ChatMessageVoice } from './ChatMessageVoice';
import ReadReceiptIcon from './ReadReceiptIcon';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

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
  /** @deprecated Prefer onTypingActivity for start/stop. */
  onUserTyping?: (conversationId: string, userRole: 'customer' | 'seller') => void;
  /** Fire true while typing, false when idle / sent (drives remote typing indicator). */
  onTypingActivity?: (conversationId: string, isTyping: boolean) => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  currentUser: User | null;
  /** Customer inbox vs seller inbox (buyer threads). */
  inboxRole?: 'customer' | 'seller';
  onNavigate?: (view: ViewEnum) => void;
  initialOpenConversationId?: string | null;
  onConsumedInitialConversation?: () => void;
  /** Clear message history for this thread (conversation row kept). */
  onClearChat?: (conversationId: string) => void | Promise<void>;
  /** Counterpart online per conversation id (Supabase presence / Socket.io). */
  chatPeerOnlineByConversationId?: Record<string, boolean>;
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
  onTypingActivity,
  onMarkMessagesAsRead,
  onFlagContent,
  onOfferResponse,
  currentUser,
  inboxRole = 'customer',
  onNavigate,
  initialOpenConversationId = null,
  onConsumedInitialConversation,
  onClearChat,
  chatPeerOnlineByConversationId,
}) => {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const voiceRecorder = useVoiceRecorder();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTypingIdleTimer = useCallback(() => {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
  }, []);

  const signalTyping = useCallback(
    (isTyping: boolean) => {
      if (!selectedConv) return;
      onTypingActivity?.(selectedConv.id, isTyping);
      if (isTyping) {
        onUserTyping?.(selectedConv.id, inboxRole);
      }
    },
    [selectedConv, onTypingActivity, onUserTyping, inboxRole]
  );

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

  const visibleThreadMessages = useMemo(
    () => (selectedConv ? filterMessagesForViewer(selectedConv, inboxRole) : []),
    [selectedConv, inboxRole],
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

    clearTypingIdleTimer();
    signalTyping(false);

    onSendMessage(selectedConv.id, messageText.trim());
    setMessageText('');

    setTimeout(() => {
      const input = document.getElementById('message-input');
      if (input) input.focus();
    }, 100);
  };

  const handleComposerChange = (value: string) => {
    setMessageText(value);
    setAttachError(null);
    if (!selectedConv) return;
    if (!value.trim()) {
      clearTypingIdleTimer();
      signalTyping(false);
      return;
    }
    signalTyping(true);
    clearTypingIdleTimer();
    typingIdleTimerRef.current = setTimeout(() => {
      signalTyping(false);
      typingIdleTimerRef.current = null;
    }, 1800);
  };

  const handleComposerBlur = () => {
    clearTypingIdleTimer();
    signalTyping(false);
  };

  const handlePickAttachment = () => {
    setAttachError(null);
    attachmentInputRef.current?.click();
  };

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedConv || !currentUser?.email) return;

    setIsUploadingPhoto(true);
    setAttachError(null);
    clearTypingIdleTimer();
    signalTyping(false);

    try {
      const result = await uploadImage(file, 'chat-messages', currentUser.email);
      if (!result.success || !result.url) {
        setAttachError(result.error || 'Could not upload photo');
        return;
      }
      const caption = messageText.trim();
      onSendMessage(selectedConv.id, caption || '📷 Photo', 'image', { imageUrl: result.url });
      setMessageText('');
    } catch {
      setAttachError('Upload failed. Try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleVoiceTap = async () => {
    if (!selectedConv || !currentUser?.email) return;
    setAttachError(null);
    if (voiceRecorder.isRecording) {
      clearTypingIdleTimer();
      signalTyping(false);
      const r = await voiceRecorder.stopRecording();
      if (!r) return;
      setIsUploadingVoice(true);
      try {
        const ext = r.mimeType.includes('webm') ? 'webm' : r.mimeType.includes('mp4') ? 'm4a' : 'webm';
        const result = await uploadChatAudio(r.blob, `voice_${Date.now()}.${ext}`, r.mimeType);
        if (!result.success || !result.url) {
          setAttachError(result.error || 'Could not upload voice note');
          return;
        }
        onSendMessage(selectedConv.id, '🎤 Voice message', 'voice', {
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
    return () => clearTypingIdleTimer();
  }, [clearTypingIdleTimer]);

  useEffect(() => {
    setThreadMenuOpen(false);
  }, [selectedConv?.id]);

  const prevOpenConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevOpenConvIdRef.current;
    const cur = selectedConv?.id ?? null;
    if (prev && prev !== cur) {
      onTypingActivity?.(prev, false);
    }
    prevOpenConvIdRef.current = cur;
  }, [selectedConv?.id, onTypingActivity]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    selectedConv?.id,
    selectedConv?.messages,
    selectedConv?.customerHistoryClearedAt,
    selectedConv?.sellerHistoryClearedAt,
    inboxRole,
    typingStatus,
  ]);

  useEffect(() => {
    if (initialOpenConversationId) {
      const want = String(initialOpenConversationId);
      const match = sortedConversations.find((c) => String(c.id) === want);
      if (match) {
        handleSelectConversation(match);
        onConsumedInitialConversation?.();
        return;
      }
      // Wait for this thread to appear — do not auto-open another conversation
      return;
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

  // Show chat view if conversation is selected (Facebook Messenger–style layout)
  if (selectedConv) {
    const counterpartName = getCounterpartLabel(selectedConv);
    const counterpartInitial = counterpartName.charAt(0).toUpperCase() || '?';
    const otherPartyRole: 'customer' | 'seller' = inboxRole === 'seller' ? 'customer' : 'seller';
    const peerOnline = chatPeerOnlineByConversationId?.[String(selectedConv.id)];

    return (
      <div className="flex flex-col h-screen bg-[#E5E5EA]">
        {/* Messenger-style header */}
        <header className="shrink-0 bg-white shadow-[0_1px_0_rgba(0,0,0,0.08)] z-10 safe-top">
          <div className="flex items-center gap-2 px-2 py-2 min-h-[56px]">
            <button
              type="button"
              onClick={() => setSelectedConv(null)}
              className="flex items-center justify-center rounded-full p-2.5 text-[#0084FF] active:bg-black/5"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Back to conversations"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-semibold shrink-0 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)',
              }}
              aria-hidden
            >
              {counterpartInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="font-bold text-[15px] text-gray-900 leading-tight truncate">{counterpartName}</h2>
                {peerOnline !== undefined && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${peerOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                    title={peerOnline ? 'Online' : 'Offline'}
                    aria-hidden
                  />
                )}
              </div>
              <p className="text-[13px] text-gray-500 truncate">{selectedConv.vehicleName}</p>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setThreadMenuOpen((o) => !o)}
                className="flex items-center justify-center rounded-full p-2.5 text-[#0084FF] active:bg-black/5"
                style={{ minWidth: 44, minHeight: 44 }}
                aria-expanded={threadMenuOpen}
                aria-haspopup="true"
                aria-label="Chat options"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
              {threadMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-black/[0.08] bg-white py-1 shadow-lg z-20"
                  role="menu"
                >
                  {onNavigate && (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-[15px] text-gray-900 active:bg-black/5"
                      onClick={() => {
                        setThreadMenuOpen(false);
                        onNavigate(ViewEnum.DETAIL);
                      }}
                    >
                      View listing
                    </button>
                  )}
                  {onClearChat && (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-[15px] text-red-600 active:bg-red-50"
                      onClick={() => {
                        setThreadMenuOpen(false);
                        if (
                          window.confirm(
                            'Clear chat history for you only? You will not see earlier messages here. The other person still sees the full chat until they clear it.',
                          )
                        ) {
                          void onClearChat(selectedConv.id);
                        }
                      }}
                    >
                      Clear chat
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

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
              className="shrink-0 flex items-center justify-center gap-2 bg-white/90 backdrop-blur-sm border-b border-black/[0.06] py-2.5 text-[#0084FF] active:bg-white"
            >
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <span className="text-[15px] font-semibold">
                Call <span className="text-gray-700 font-medium tabular-nums">{label}</span>
              </span>
            </a>
          );
        })()}

        {/* Message thread — Messenger bubble colors */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-1">
          {visibleThreadMessages.length === 0 &&
            !(typingStatus &&
              typingStatus.conversationId === selectedConv.id &&
              typingStatus.userRole === otherPartyRole) && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-gray-500 text-[15px]">
              No messages yet. Say hello!
            </div>
          )}
          {visibleThreadMessages.map((msg, idx) => {
            const isUser =
              inboxRole === 'customer' ? msg.sender === 'user' : msg.sender === 'seller';
            const isOffer = msg.type === 'offer';
            const isImage = msg.type === 'image' && Boolean(msg.payload?.imageUrl);
            const isVoice = msg.type === 'voice' && Boolean(msg.payload?.audioUrl);

            return (
              <div
                key={msg.id ?? idx}
                className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5 shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)',
                    }}
                    aria-hidden
                  >
                    {counterpartInitial}
                  </div>
                )}
                <div
                  className={`max-w-[min(78%,320px)] px-3.5 py-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.1)] ${
                    isUser
                      ? 'bg-[#0084FF] text-white rounded-[18px] rounded-br-[4px]'
                      : 'bg-[#E4E6EB] text-gray-900 rounded-[18px] rounded-bl-[4px]'
                  }`}
                >
                  {isOffer && (
                    <div
                      className={`mb-1.5 p-2 rounded-xl text-left ${
                        isUser ? 'bg-white/15' : 'bg-black/[0.06]'
                      }`}
                    >
                      <p className="text-[13px] font-semibold">Offer: ₹{msg.payload?.price?.toLocaleString()}</p>
                      {msg.payload?.message && (
                        <p className="text-[13px] mt-1 opacity-90">{msg.payload.message}</p>
                      )}
                    </div>
                  )}
                  {isImage && msg.payload?.imageUrl && (
                    <ChatMessageImage
                      src={msg.payload.imageUrl}
                      className={isUser ? 'ring-1 ring-white/20' : ''}
                    />
                  )}
                  {isVoice && msg.payload?.audioUrl && (
                    <ChatMessageVoice
                      src={msg.payload.audioUrl}
                      durationSeconds={msg.payload.durationSeconds}
                    />
                  )}
                  {msg.text &&
                    (!isImage || (msg.text.trim() && msg.text.trim() !== '📷 Photo')) &&
                    (!isVoice || (msg.text.trim() && msg.text.trim() !== '🎤 Voice message')) && (
                      <p
                        className={`text-[15px] leading-snug whitespace-pre-wrap break-words ${
                          isImage || isVoice ? 'mt-2' : ''
                        }`}
                      >
                        {msg.text}
                      </p>
                    )}
                  <div
                    className={`flex items-center gap-1 mt-1 ${
                      isUser ? 'justify-end text-white/65' : 'text-gray-500'
                    }`}
                  >
                    <span className="text-[11px] tabular-nums">{formatRelativeTime(msg.timestamp)}</span>
                    {isUser && (
                      <ReadReceiptIcon isRead={msg.isRead} status={msg.status} variant="onPrimary" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {typingStatus &&
            typingStatus.conversationId === selectedConv.id &&
            typingStatus.userRole === otherPartyRole && (
            <div className="flex items-end gap-2 justify-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5 shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)',
                }}
                aria-hidden
              >
                {counterpartInitial}
              </div>
              <div className="bg-[#E4E6EB] rounded-[18px] rounded-bl-[4px] px-4 py-3 shadow-[0_1px_0.5px_rgba(0,0,0,0.1)]">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} className="h-1" />
        </div>

        {/* Messenger-style composer */}
        <div className="shrink-0 bg-white border-t border-black/[0.08] px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] safe-bottom">
          <input
            ref={attachmentInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAttachmentSelected}
          />
          {attachError && (
            <p className="text-xs text-red-600 px-2 pb-1" role="alert">
              {attachError}
            </p>
          )}
          {voiceRecorder.error && (
            <p className="text-xs text-red-600 px-2 pb-1" role="alert">
              {voiceRecorder.error}
            </p>
          )}
          <div className="flex items-end gap-1.5 pb-1">
            <button
              type="button"
              className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full text-[#0084FF] active:bg-black/5 mb-0.5 disabled:opacity-40"
              aria-label="Send a photo"
              onClick={handlePickAttachment}
              disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording || !currentUser?.email}
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
              </svg>
            </button>
            <button
              type="button"
              className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-full mb-0.5 disabled:opacity-40 ${
                voiceRecorder.isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-[#0084FF] active:bg-black/5'
              }`}
              aria-label={voiceRecorder.isRecording ? 'Stop recording and send' : 'Record voice message'}
              onClick={() => void handleVoiceTap()}
              disabled={isUploadingPhoto || isUploadingVoice || !currentUser?.email}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
              </svg>
            </button>
            <div className="flex-1 min-w-0 flex items-center rounded-[20px] bg-[#F0F2F5] px-3 py-1.5 min-h-[40px] border border-transparent focus-within:border-[#0084FF]/30 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#0084FF]/20">
              <input
                id="message-input"
                type="text"
                value={messageText}
                onChange={(e) => handleComposerChange(e.target.value)}
                onBlur={handleComposerBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  voiceRecorder.isRecording
                    ? 'Recording… tap mic to send'
                    : isUploadingPhoto || isUploadingVoice
                      ? 'Uploading…'
                      : 'Message…'
                }
                disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
                className="w-full bg-transparent text-[15px] text-gray-900 placeholder:text-gray-500 outline-none py-1.5 disabled:opacity-60"
                autoComplete="off"
                autoCorrect="on"
              />
            </div>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
              className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-full mb-0.5 transition-opacity ${
                messageText.trim()
                  ? 'bg-[#0084FF] text-white shadow-md active:scale-95'
                  : 'bg-[#E4E6EB] text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send"
            >
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
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
            const lastMessage = getLastVisibleMessageForViewer(conv, inboxRole);
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
                    <p className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                      {preview.prefix && <span className="text-gray-400 font-normal">{preview.prefix}</span>}
                      {preview.text}
                    </p>
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
