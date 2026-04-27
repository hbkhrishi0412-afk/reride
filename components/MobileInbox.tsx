import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation, User, ChatMessage, Vehicle } from '../types';
import { findUserByParticipantId, resolveSellerPhoneFromProfileOrListing } from '../utils/chatContact';
import { telHrefFromRawPhone, phoneDisplayCompact } from '../utils/numberUtils';
import { View as ViewEnum } from '../types';
import { useConversationList } from '../hooks/useConversationList';
import { formatRelativeTime } from '../utils/date';
import { getThreadLastMessagePreview } from '../utils/messagePreview';
import { filterMessagesForViewer, getLastVisibleMessageForViewer } from '../utils/conversationView';
import { isOfferChatMessage } from '../utils/isOfferChatMessage';
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
  /** Permanently delete the conversation (API + state). Swipe left to reveal. */
  onDeleteConversation?: (conversationId: string) => void | Promise<void>;
  /** Counterpart online per conversation id (Supabase presence / Socket.io). */
  chatPeerOnlineByConversationId?: Record<string, boolean>;
  /** Optional manual read/unread toggle for thread rows. */
  onSetConversationReadState?: (conversationId: string, isRead: boolean) => void;
  onMarkAllAsRead?: (role: 'customer' | 'seller') => void;
  /**
   * When set (e.g. seller on mobile), tapping a thread opens the global floating ChatWidget
   * instead of the built-in full-screen thread (same pattern as the website dashboard).
   */
  openThreadInFloatingChat?: (conversation: Conversation) => void;
}

/**
 * Mobile-Optimized Inbox Component
 * Features:
 * - Swipe actions: right → report (left panel), left → delete (right panel)
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
  onDeleteConversation,
  chatPeerOnlineByConversationId,
  onSetConversationReadState,
  onMarkAllAsRead,
  openThreadInFloatingChat,
}) => {
  const { t } = useTranslation();
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'read'>('all');
  /** Swipe right → report (left panel); swipe left → delete (right panel). */
  const [swipeOpen, setSwipeOpen] = useState<{ id: string; side: 'report' | 'delete' } | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const voiceRecorder = useVoiceRecorder();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
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
    filterMode,
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
      if (openThreadInFloatingChat) {
        openThreadInFloatingChat(conv);
        return;
      }
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
    [inboxRole, onMarkAsRead, onMarkMessagesAsRead, openThreadInFloatingChat]
  );

  const handleSwipeStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    touchStartX.current = x;
    touchEndX.current = x;
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleSwipeEnd = (convId: string) => {
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 56;

    if (Math.abs(distance) < minSwipeDistance) {
      return;
    }
    if (distance > 0) {
      // Finger moved left → reveal delete on the right
      setSwipeOpen({ id: convId, side: 'delete' });
    } else {
      // Finger moved right → reveal report on the left
      setSwipeOpen({ id: convId, side: 'report' });
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

  useEffect(() => {
    if (!selectedConv) return;
    const still = conversations.some((c) => c && String(c.id) === String(selectedConv.id));
    if (!still) setSelectedConv(null);
  }, [conversations, selectedConv]);

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
    firstUnreadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!firstUnreadRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [
    selectedConv?.id,
    selectedConv?.messages,
    selectedConv?.customerHistoryClearedAt,
    selectedConv?.sellerHistoryClearedAt,
    inboxRole,
    typingStatus,
  ]);

  const firstUnreadMessageId = useMemo(() => {
    if (!selectedConv) return null;
    const otherSender = inboxRole === 'seller' ? 'user' : 'seller';
    const first = visibleThreadMessages.find((m) => m.sender === otherSender && !m.isRead);
    return first ? String(first.id) : null;
  }, [selectedConv, visibleThreadMessages, inboxRole]);

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
    // List-first: stay on inbox until the user opens a thread (no auto-open).
  }, [sortedConversations, initialOpenConversationId, onConsumedInitialConversation, handleSelectConversation]);

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
                  {onSetConversationReadState && (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-[15px] text-gray-900 active:bg-black/5"
                      onClick={() => {
                        setThreadMenuOpen(false);
                        const isUnreadNow =
                          inboxRole === 'customer'
                            ? !selectedConv.isReadByCustomer
                            : !selectedConv.isReadBySeller;
                        onSetConversationReadState(selectedConv.id, isUnreadNow);
                      }}
                    >
                      {inboxRole === 'customer'
                        ? selectedConv.isReadByCustomer
                          ? 'Mark unread'
                          : 'Mark read'
                        : selectedConv.isReadBySeller
                          ? 'Mark unread'
                          : 'Mark read'}
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
            const isOffer = isOfferChatMessage(msg);
            const isImage = msg.type === 'image' && Boolean(msg.payload?.imageUrl);
            const isVoice = msg.type === 'voice' && Boolean(msg.payload?.audioUrl);

            return (
              <div
                key={msg.id ?? idx}
                ref={firstUnreadMessageId && String(msg.id) === firstUnreadMessageId ? firstUnreadRef : null}
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
                      <p className="text-[13px] font-semibold">
                        Offer: ₹
                        {(msg.payload?.offerPrice ?? msg.payload?.price ?? 0).toLocaleString('en-IN')}
                      </p>
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
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)' }}>
      {/* Premium obsidian header */}
      <div
        className="px-5 sticky top-0 z-30 relative overflow-hidden"
        style={{
          paddingTop: 'max(1.1rem, env(safe-area-inset-top, 0px))',
          paddingBottom: '1.25rem',
          background: 'linear-gradient(180deg, #0B0B0F 0%, #16161D 70%, #1C1C24 100%)',
          boxShadow: '0 10px 30px -12px rgba(0,0,0,0.55)',
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.18), transparent 70%)' }} />
          <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(168,135,255,0.10), transparent 70%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
        </div>

        <div className="relative z-10 flex items-center gap-2 mb-3">
          <span className="text-[10.5px] uppercase tracking-[0.22em] text-white/45 font-semibold">
            {inboxRole === 'seller' ? 'Seller inbox' : 'Inbox'}
          </span>
        </div>

        <div className="relative z-10 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-white font-semibold tracking-tight" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              {t('mobileInbox.title')}
              <span className="text-white/40 font-light">.</span>
            </h1>
            <p className="mt-1.5 text-[12px] text-white/55 font-medium truncate max-w-[80vw]">
              {conversations.length > 0 ? (
                <>
                  {inboxRole === 'seller'
                    ? t('mobileInbox.sellerThreadSummary', { count: conversations.length })
                    : t('mobileInbox.buyerThreadSummary', { count: conversations.length })}
                  {unreadCount > 0
                    ? ` · ${t('mobileInbox.unreadLine', { count: unreadCount })}`
                    : ''}
                </>
              ) : (
                t('mobileInbox.emptySubtitle')
              )}
            </p>
            {openThreadInFloatingChat && inboxRole === 'seller' && conversations.length > 0 && (
              <p className="text-[10.5px] text-white/40 mt-1 font-medium">{t('mobileInbox.sellerTapForFloatingChat')}</p>
            )}
          </div>
          {unreadCount > 0 && (
            <span
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF8456, #FF6B35)', boxShadow: '0 8px 18px -8px rgba(255,107,53,0.55)' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount} new
            </span>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <div
        className="px-4 py-3 sticky z-20"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 96px)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'saturate(180%) blur(14px)',
          WebkitBackdropFilter: 'saturate(180%) blur(14px)',
          borderBottom: '1px solid rgba(15, 23, 42, 0.06)'
        }}
      >
        <div className="relative mb-2.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-10 pr-3 py-2.5 rounded-full text-[13px] font-medium text-slate-900 outline-none"
            style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {(([
            { key: 'all', label: 'All', count: conversations.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read', label: 'Read', count: undefined }
          ]) as { key: 'all' | 'unread' | 'read'; label: string; count?: number }[]).map((f) => {
            const active = filterMode === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterMode(f.key)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                style={{
                  background: active ? '#0B0B0F' : 'rgba(15,23,42,0.04)',
                  color: active ? '#FFFFFF' : '#475569',
                  border: active ? '1px solid #0B0B0F' : '1px solid rgba(15,23,42,0.06)'
                }}
                aria-label={`Show ${f.label.toLowerCase()} conversations`}
              >
                {f.label}
                {typeof f.count === 'number' && f.count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
                    style={{ background: active ? 'rgba(255,255,255,0.18)' : '#FF6B35', color: '#FFFFFF' }}
                  >
                    {f.count > 99 ? '99+' : f.count}
                  </span>
                )}
              </button>
            );
          })}
          {onMarkAllAsRead && unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void onMarkAllAsRead(inboxRole)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold active:scale-95 transition-transform"
              style={{ background: 'rgba(37,99,235,0.10)', color: '#1D4ED8' }}
              aria-label="Mark all conversations as read"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div>
        {filteredConversations.length === 0 ? (
          <div className="px-4 pt-6">
            <div
              className="rounded-3xl px-6 py-12 text-center"
              style={{ background: 'linear-gradient(180deg, #FFFFFF, #FAFAFC)', border: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)' }}
            >
              <div
                className="w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(5,150,105,0.18))', color: '#047857' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h4 className="text-[16px] font-semibold text-slate-900 mb-1 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                No conversations
              </h4>
              <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
                {searchQuery ? 'Try a different search.' : 'New chats will appear here.'}
              </p>
            </div>
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
            const isOpen = swipeOpen?.id === conv.id;
            const openSide = isOpen ? swipeOpen.side : null;
            const initials = (counterpart || 'C').split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
            const peerOnline = chatPeerOnlineByConversationId?.[conv.id];

            return (
              <div
                key={conv.id}
                className="relative overflow-hidden"
                style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(15,23,42,0.05)' }}
                onTouchStart={handleSwipeStart}
                onTouchMove={handleSwipeMove}
                onTouchEnd={() => handleSwipeEnd(conv.id)}
                onClick={() => {
                  if (isOpen) {
                    setSwipeOpen(null);
                    return;
                  }
                  handleSelectConversation(conv);
                }}
              >
                {/* Swipe right → report (panel on the left) */}
                <div
                  className={`absolute left-0 top-0 bottom-0 z-0 flex w-28 items-stretch transition-transform duration-200 ease-out ${
                    openSide === 'report' ? 'translate-x-0' : '-translate-x-full'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFlagContent('conversation', conv.id, 'User reported from inbox swipe');
                      setSwipeOpen(null);
                    }}
                    className="h-full w-28 flex-1 text-white flex items-center justify-center gap-1.5 text-[12px] font-semibold px-1"
                    style={{ background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)' }}
                    aria-label="Report conversation"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 21V4M4 14h12l-2-3 2-3H4" />
                    </svg>
                    Report
                  </button>
                </div>

                {isUnread && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r-full z-20 pointer-events-none"
                    style={{ background: 'linear-gradient(180deg, #FF8456, #FF6B35)' }}
                  />
                )}
                <div
                  className={`relative z-10 flex items-start gap-3 px-4 py-3.5 bg-white transition-transform duration-200 ease-out ${
                    openSide === 'delete' ? '-translate-x-28' : openSide === 'report' ? 'translate-x-28' : 'translate-x-0'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-11 h-11 rounded-xl grid place-items-center text-white font-bold text-[13px] tracking-tight"
                      style={{
                        background: 'linear-gradient(160deg, #1F1F28 0%, #0E0E13 100%)',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      {initials}
                    </div>
                    {peerOnline && (
                      <span
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                        style={{ background: '#10B981', boxShadow: '0 0 0 2px #FFFFFF' }}
                      />
                    )}
                    {!peerOnline && isUnread && (
                      <span
                        aria-hidden
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                        style={{ background: '#FF6B35', boxShadow: '0 0 0 2px #FFFFFF' }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className={`truncate text-[14px] tracking-tight ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`} style={{ letterSpacing: '-0.01em' }}>
                        {counterpart}
                      </h3>
                      <span className="text-[10.5px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">{conv.vehicleName}</p>
                    <p className={`text-[12.5px] truncate mt-1 ${isUnread ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>
                      {preview.prefix && <span className="text-slate-400 font-normal">{preview.prefix}</span>}
                      {preview.text}
                    </p>
                    {inboxRole === 'seller' && onSetConversationReadState && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetConversationReadState(conv.id, isUnread);
                          }}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold active:scale-95 transition-transform"
                          style={{
                            background: isUnread ? 'rgba(37,99,235,0.08)' : 'rgba(71,85,105,0.06)',
                            color: isUnread ? '#1D4ED8' : '#475569'
                          }}
                          aria-label={isUnread ? 'Mark conversation as read' : 'Mark conversation as unread'}
                        >
                          {isUnread ? 'Mark read' : 'Mark unread'}
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-slate-300 mt-1 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </div>

                {/* Swipe left → delete (panel on the right) */}
                <div
                  className={`absolute right-0 top-0 bottom-0 z-0 flex w-28 items-stretch transition-transform duration-200 ease-out ${
                    openSide === 'delete' ? 'translate-x-0' : 'translate-x-full'
                  }`}
                >
                  {onDeleteConversation ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof window !== 'undefined' && !window.confirm('Delete this conversation? This cannot be undone.')) {
                          return;
                        }
                        void Promise.resolve(onDeleteConversation(conv.id)).then(() => {
                          setSwipeOpen(null);
                        });
                      }}
                      className="h-full w-28 flex-1 text-white flex items-center justify-center gap-1.5 text-[12px] font-semibold px-1"
                      style={{ background: 'linear-gradient(135deg, #64748B 0%, #1E293B 100%)' }}
                      aria-label="Delete conversation"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Delete
                    </button>
                  ) : (
                    <div className="h-full w-28 bg-slate-200" aria-hidden />
                  )}
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
