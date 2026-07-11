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
          className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-60"
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

  return (
    <div
      id={`deal-room-${conversation.id}`}
      className="shrink-0 border-b border-gray-200 bg-white"
      data-testid="deal-room-section"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <DealStageChip lead={dealLead} />
        <button
          type="button"
          onClick={onTogglePanel}
          className={`text-xs font-semibold ${toggleAccentClass}`}
          aria-expanded={dealPanelOpen}
        >
          {dealPanelOpen
            ? t('deal.hideTimeline', { defaultValue: 'Hide deal' })
            : t('deal.showTimeline', { defaultValue: 'Show deal' })}
        </button>
      </div>

      {currentUserRole === 'customer' && dealLead.chatStatus === 'pending' ? (
        <p className="mx-3 mb-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          {t('deal.awaitingSellerChat', {
            defaultValue:
              'Your tracked deal is active. The seller must accept chat before you can message — track progress below.',
          })}
        </p>
      ) : null}

      {currentUserRole === 'seller' && dealLead.chatStatus === 'pending' ? (
        <p className="mx-3 mb-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          {t('deal.sellerAcceptChat', {
            defaultValue:
              'A buyer started a tracked deal. Accept chat in the Deal Room below to unlock messaging.',
          })}
        </p>
      ) : null}

      {currentUserRole === 'seller' && dealLead.chatStatus !== 'pending' ? (
        <p className="mx-3 mb-2 text-xs text-slate-600">
          {t('deal.sellerUseDealRoom', {
            defaultValue: 'Use the Deal Room below to manage offers, milestones, and RC transfer.',
          })}
        </p>
      ) : null}

      {dealPanelOpen ? (
        <div className={`px-2 pb-2 overflow-y-auto ${panelMaxHeightClass}`}>
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
