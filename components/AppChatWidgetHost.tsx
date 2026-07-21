import React, { Suspense, lazy, useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useApp } from './AppProvider';
import { resolveChatCallPhone, resolveChatOtherPartyName } from '../utils/chatContact';

const ChatWidget = lazy(() =>
  import('./ChatWidget').then((module) => ({ default: module.ChatWidget })),
);

type AppChatWidgetHostProps = {
  chatInlineLaunch: boolean;
  onClose: () => void;
  onTestDriveResponse?: (
    conversationId: string,
    messageId: number,
    newStatus: 'confirmed' | 'rejected',
  ) => void;
  ChatErrorBoundary: React.ComponentType<{ children: React.ReactNode }>;
};

const MinimalLoader: React.FC = () => null;

/**
 * Subscribes to useChat() so typing/presence (and activeChat open/close) stay
 * off the AppContext invalidation path for the rest of the tree.
 */
const AppChatWidgetHost: React.FC<AppChatWidgetHostProps> = ({
  chatInlineLaunch,
  onClose,
  onTestDriveResponse,
  ChatErrorBoundary,
}) => {
  const { activeChat, typingStatus, chatPeerOnlineByConversationId } = useChat();
  const {
    currentUser,
    users,
    vehicles,
    sendMessage,
    sendMessageWithType,
    toggleTyping,
    markAsRead,
    flagContent,
    onOfferResponse,
    clearConversationMessages,
    archiveConversation,
    deleteConversation,
    setConversationReadState,
  } = useApp();

  const handleSend = useCallback(
    (messageText: string, type?: Parameters<typeof sendMessageWithType>[2], payload?: unknown) => {
      if (!activeChat) return;
      if (type || payload) {
        sendMessageWithType(activeChat.id, messageText, type, payload as any);
      } else {
        sendMessage(activeChat.id, messageText);
      }
    },
    [activeChat, sendMessage, sendMessageWithType],
  );

  if (!currentUser || !activeChat) return null;

  const role = currentUser.role === 'seller' ? 'seller' : 'customer';

  return (
    <ChatErrorBoundary>
      <Suspense fallback={<MinimalLoader />}>
        <ChatWidget
          conversation={activeChat}
          currentUserRole={role}
          currentUserEmail={currentUser.email}
          otherUserName={resolveChatOtherPartyName(users, activeChat, role)}
          otherUserOnline={chatPeerOnlineByConversationId[String(activeChat.id)]}
          callTargetPhone={resolveChatCallPhone(users, vehicles, activeChat, role)}
          callTargetName={resolveChatOtherPartyName(users, activeChat, role)}
          isInlineLaunch={chatInlineLaunch}
          onStartCall={(phone) => {
            if (!phone) return;
            window.open(`tel:${phone}`);
          }}
          onClose={onClose}
          onSendMessage={handleSend}
          typingStatus={typingStatus}
          onUserTyping={(conversationId) => {
            toggleTyping(conversationId, true);
          }}
          onUserStoppedTyping={(conversationId) => toggleTyping(conversationId, false)}
          uploaderEmail={currentUser.email}
          onMarkMessagesAsRead={(conversationId, readerRole) => {
            markAsRead(conversationId, { readerRole, forceReadState: true });
          }}
          onFlagContent={(type, id, _reason) => {
            flagContent(type, id);
          }}
          onOfferResponse={(conversationId, messageId, response, counterPrice) => {
            onOfferResponse(conversationId, messageId, response, counterPrice);
          }}
          onTestDriveResponse={onTestDriveResponse}
          onClearChat={clearConversationMessages}
          onArchiveConversation={archiveConversation}
          onDeleteConversation={deleteConversation}
          onSetConversationReadState={(conversationId, isRead) =>
            setConversationReadState(conversationId, role, isRead)
          }
        />
      </Suspense>
    </ChatErrorBoundary>
  );
};

export default AppChatWidgetHost;
