import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage, Conversation, DealLead, User } from '../../types';
import DealStageChip from '../DealStageChip';
import DealTimelinePanel from '../DealTimelinePanel';

export type DealRoomSectionProps = {
  conversation: Conversation;
  dealLead: DealLead | null;
  dealLeadLoading: boolean;
  dealPanelOpen: boolean;
  onTogglePanel: () => void;
  onDealLeadUpdated: (lead: DealLead) => void;
  currentUserRole: 'customer' | 'seller';
  currentUser: User;
  onSendPipelineMessage: (
    messageText: string,
    type?: ChatMessage['type'],
    payload?: Record<string, unknown>,
  ) => void;
  onStartDealRoom?: () => void;
  /** Max-height class for the scrollable timeline panel */
  panelMaxHeightClass?: string;
  toggleAccentClass?: string;
  showOpenDealRoomCta?: boolean;
};

/**
 * Shared Deal Room chrome used by inbox, inline chat, and floating widget.
 */
export const DealRoomSection: React.FC<DealRoomSectionProps> = ({
  conversation,
  dealLead,
  dealLeadLoading,
  dealPanelOpen,
  onTogglePanel,
  onDealLeadUpdated,
  currentUserRole,
  currentUser,
  onSendPipelineMessage,
  onStartDealRoom,
  panelMaxHeightClass = 'max-h-80',
  toggleAccentClass = 'text-reride-orange',
  showOpenDealRoomCta = true,
}) => {
  const { t } = useTranslation();

  if (!dealLead && currentUserRole === 'customer' && conversation.vehicleId && showOpenDealRoomCta && onStartDealRoom) {
    return (
      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={() => void onStartDealRoom()}
          disabled={dealLeadLoading}
          className="w-full px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
          data-testid="open-deal-room"
        >
          {dealLeadLoading
            ? t('deal.openingDealRoom', { defaultValue: 'Opening Deal Room…' })
            : t('deal.openDealRoom', { defaultValue: 'Open Deal Room' })}
        </button>
      </div>
    );
  }

  if (!dealLead || !currentUser.email) {
    return null;
  }

  const sellerNeedsAccept = currentUserRole === 'seller' && dealLead.chatStatus === 'pending';

  return (
    <div
      id={`deal-room-${conversation.id}`}
      className="shrink-0 border-b border-gray-200 bg-white"
      data-testid="deal-room-section"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-reride-orange">
            {t('deal.dealRoom', { defaultValue: 'Deal Room' })}
          </span>
          <DealStageChip lead={dealLead} />
        </div>
        <button
          type="button"
          onClick={onTogglePanel}
          className={`shrink-0 text-xs font-semibold ${toggleAccentClass}`}
          aria-expanded={dealPanelOpen}
        >
          {dealPanelOpen
            ? t('deal.hideTimeline', { defaultValue: 'Hide deal' })
            : sellerNeedsAccept
              ? t('deal.showTimelineAccept', { defaultValue: 'Accept chat' })
              : t('deal.showTimeline', { defaultValue: 'Show deal' })}
        </button>
      </div>

      {/* One short cue when collapsed — chip already carries status while open */}
      {!dealPanelOpen && sellerNeedsAccept ? (
        <p className="px-3 pb-2 text-[11px] text-amber-800">
          {t('deal.sellerAcceptChatShort', {
            defaultValue: 'Buyer is waiting — open Deal Room to accept chat.',
          })}
        </p>
      ) : null}

      {dealPanelOpen ? (
        <div className={`px-3 pb-2 overflow-y-auto ${panelMaxHeightClass}`}>
          <DealTimelinePanel
            lead={dealLead}
            currentUser={currentUser}
            currentUserRole={currentUserRole}
            conversationId={conversation.id}
            onLeadUpdated={onDealLeadUpdated}
            onSendPipelineMessage={onSendPipelineMessage}
          />
        </div>
      ) : null}
    </div>
  );
};

export default DealRoomSection;
