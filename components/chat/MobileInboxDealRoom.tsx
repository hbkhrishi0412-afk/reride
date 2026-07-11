import React from 'react';
import type { Conversation, ChatMessage, User } from '../../types';
import { DealRoomSection } from './DealRoomSection';
import { useDealRoomForConversation } from '../../hooks/useDealRoomForConversation';

type MobileInboxDealRoomProps = {
  conversation: Conversation;
  currentUser: User;
  inboxRole: 'customer' | 'seller';
  onSendMessage: (
    conversationId: string,
    messageText: string,
    type?: ChatMessage['type'],
    payload?: unknown,
  ) => void;
  onDealLeadChange?: (lead: ReturnType<typeof useDealRoomForConversation>['dealLead']) => void;
};

/** Deal Room strip for mobile inbox thread — shared hook + UI with widget/inline chat. */
export const MobileInboxDealRoom: React.FC<MobileInboxDealRoomProps> = ({
  conversation,
  currentUser,
  inboxRole,
  onSendMessage,
  onDealLeadChange,
}) => {
  const currentUserRole = inboxRole === 'seller' ? 'seller' : 'customer';
  const {
    dealLead,
    setDealLead,
    dealLeadLoading,
    dealPanelOpen,
    setDealPanelOpen,
    handleStartDealRoom,
  } = useDealRoomForConversation(conversation, { currentUserRole });

  React.useEffect(() => {
    onDealLeadChange?.(dealLead);
  }, [dealLead, onDealLeadChange]);

  return (
    <DealRoomSection
      conversation={conversation}
      dealLead={dealLead}
      dealLeadLoading={dealLeadLoading}
      dealPanelOpen={dealPanelOpen}
      onTogglePanel={() => setDealPanelOpen((o) => !o)}
      onDealLeadUpdated={setDealLead}
      currentUserRole={currentUserRole}
      currentUser={currentUser}
      onSendPipelineMessage={(messageText, type, payload) =>
        onSendMessage(conversation.id, messageText, type, payload)
      }
      onStartDealRoom={() => void handleStartDealRoom()}
      panelMaxHeightClass="max-h-[min(42vh,360px)]"
      toggleAccentClass="text-[#0084FF]"
    />
  );
};

export default MobileInboxDealRoom;
