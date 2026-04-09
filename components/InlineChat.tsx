import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import type { Conversation, ChatMessage } from '../types.js';
import ReadReceiptIcon, { OfferMessage, OfferModal } from './ReadReceiptIcon.js';
import { phoneDisplayCompact } from '../utils/numberUtils.js';
import { uploadImage, uploadChatAudio } from '../services/imageUploadService';
import { ChatMessageImage } from './ChatMessageImage';
import { ChatMessageVoice } from './ChatMessageVoice';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { filterMessagesForViewer } from '../utils/conversationView';
import { isOfferChatMessage } from '../utils/isOfferChatMessage';

interface InlineChatProps {
  conversation: Conversation;
  currentUserRole: 'customer' | 'seller';
  otherUserName: string;
  onSendMessage: (messageText: string, type?: ChatMessage['type'], payload?: any) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onUserStoppedTyping?: (conversationId: string) => void;
  uploaderEmail?: string;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: number | string, reason: string) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  onClearChat?: (conversationId: string) => void | Promise<void>;
  onMakeOffer?: () => void;
  onStartCall?: (phone: string) => void;
  callTargetPhone?: string;
  callTargetName?: string;
  otherUserOnline?: boolean;
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
  onUserStoppedTyping,
  uploaderEmail,
  onMarkMessagesAsRead, 
  onFlagContent, 
  onOfferResponse,
  onClearChat,
  onMakeOffer,
  onStartCall,
  callTargetPhone,
  callTargetName,
  otherUserOnline,
  className = "",
  height = "h-96"
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const voiceRecorder = useVoiceRecorder();

  const visibleMessages = useMemo(
    () => filterMessagesForViewer(conversation, currentUserRole),
    [conversation, currentUserRole],
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstUnreadMessageId = useMemo(() => {
    const otherSender = currentUserRole === 'customer' ? 'seller' : 'user';
    const first = visibleMessages.find((m) => m.sender === otherSender && !m.isRead);
    return first ? String(first.id) : null;
  }, [visibleMessages, currentUserRole]);

  useEffect(() => {
    firstUnreadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!firstUnreadRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleMessages, typingStatus, firstUnreadMessageId]);
  
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
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 flex flex-col ${className}`} style={{ height }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div className="flex-grow min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{conversation.vehicleName}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-gray-600 truncate">Chat with {otherUserName}</p>
            {otherUserOnline !== undefined && (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${otherUserOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                title={otherUserOnline ? 'Online' : 'Offline'}
                aria-hidden
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {callTargetPhone && (
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={() => onStartCall ? onStartCall(callTargetPhone) : window.open(`tel:${callTargetPhone}`)}
                className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors shrink-0"
                aria-label={`Call ${callTargetName || 'contact'}`}
                title={`Call ${callTargetName || 'contact'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.003 5.884c-.005-1.054.917-1.93 1.97-1.823 1.022.105 1.936.563 2.654 1.282l1.12 1.12a1 1 0 01.106 1.31l-.723 1.085c-.195.293-.164.68.09.935l3.142 3.142a.75.75 0 00.935.09l1.085-.723a1 1 0 011.31.106l1.12 1.12a4.25 4.25 0 011.282 2.654c.107 1.053-.769 1.975-1.823 1.97-2.54-.012-5.02-.998-6.918-2.897-1.898-1.898-2.884-4.378-2.897-6.918z" clipRule="evenodd" />
                </svg>
              </button>
              {phoneDisplayCompact(callTargetPhone) ? (
                <span className="text-xs text-gray-600 tabular-nums truncate max-w-[7rem] sm:max-w-[10rem]" title={callTargetPhone}>
                  {phoneDisplayCompact(callTargetPhone)}
                </span>
              ) : null}
            </div>
          )}
          {onClearChat && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Clear chat history for you only? You will not see earlier messages here. The other person still sees the full chat until they clear it.',
                  )
                ) {
                  void onClearChat(conversation.id);
                }
              }}
              className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
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
        {visibleMessages.length === 0 ? (
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
            {visibleMessages.map((msg) => (
              <div
                key={msg.id}
                ref={firstUnreadMessageId && String(msg.id) === firstUnreadMessageId ? firstUnreadRef : null}
                className={`flex flex-col ${msg.sender === senderType ? 'items-end' : 'items-start'}`}
              >
                {msg.sender === 'system' && (
                  <div className="text-center text-xs text-gray-600 italic py-2 w-full">{msg.text}</div>
                )}
                {msg.sender !== 'system' && (
                  <>
                    <div className={`px-4 py-3 max-w-md ${msg.sender === senderType ? 'text-white rounded-l-xl rounded-t-xl' : 'bg-white text-gray-900 rounded-r-xl rounded-t-xl shadow-sm'}`} 
                         style={msg.sender === senderType ? { background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' } : undefined}>
                      {isOfferChatMessage(msg) ? (
                        <OfferMessage 
                          msg={msg} 
                          currentUserRole={currentUserRole} 
                          listingPrice={conversation.vehiclePrice} 
                          onRespond={(messageId, response, counterPrice) => onOfferResponse(conversation.id, messageId, response, counterPrice)} 
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
                    <div className="text-xs text-gray-400 mt-1 px-1 flex items-center">
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      {msg.sender === senderType && (
                        <ReadReceiptIcon isRead={msg.isRead} status={msg.status} />
                      )}
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
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handlePhotoChange}
        />
        {attachError && (
          <p className="text-xs text-red-600 mb-2" role="alert">
            {attachError}
          </p>
        )}
        {voiceRecorder.error && (
          <p className="text-xs text-red-600 mb-2" role="alert">
            {voiceRecorder.error}
          </p>
        )}
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
            onClick={() => attachmentInputRef.current?.click()}
            disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording || !uploaderEmail}
            className="p-2 text-gray-500 hover:text-orange-500 transition-colors disabled:opacity-40"
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
                : 'text-gray-500 hover:text-orange-500'
            }`}
            aria-label={voiceRecorder.isRecording ? 'Stop recording and send voice' : 'Record voice message'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
            </svg>
          </button>
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
            placeholder={
              voiceRecorder.isRecording
                ? 'Recording… tap mic to send'
                : isUploadingPhoto || isUploadingVoice
                  ? 'Uploading…'
                  : 'Type a message...'
            }
            disabled={isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
            className="flex-grow bg-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors border-0 disabled:opacity-60"
          />
          <button 
            type="submit" 
            disabled={!inputText.trim() || isUploadingPhoto || isUploadingVoice || voiceRecorder.isRecording}
            className="p-2 text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-40" 
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
