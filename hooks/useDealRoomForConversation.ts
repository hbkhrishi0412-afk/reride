import { useCallback, useEffect, useState } from 'react';
import type { Conversation, DealLead } from '../types';
import { createDealLead, resolveDealLeadForConversation } from '../services/dealService';

type UseDealRoomOptions = {
  initialDealLead?: DealLead | null;
  currentUserRole: 'customer' | 'seller';
};

export function useDealRoomForConversation(
  conversation: Conversation,
  { initialDealLead = null, currentUserRole }: UseDealRoomOptions,
) {
  const [dealLead, setDealLead] = useState<DealLead | null>(initialDealLead);
  const [dealLeadLoading, setDealLeadLoading] = useState(false);
  const [dealPanelOpen, setDealPanelOpen] = useState(true);
  const [dealRoomError, setDealRoomError] = useState<string | null>(null);

  const chatBlockedByDeal =
    dealLead?.chatStatus === 'pending' && currentUserRole === 'customer';

  useEffect(() => {
    setDealLead(initialDealLead);
  }, [initialDealLead, conversation.id]);

  useEffect(() => {
    if (!conversation.id) return;
    let cancelled = false;
    void resolveDealLeadForConversation(conversation, {
      retryCount: conversation.hasDeal ? 6 : 2,
    })
      .then((lead) => {
        if (!cancelled) setDealLead(lead);
      })
      .catch(() => {
        if (!cancelled) setDealLead((prev) => prev ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation.id, conversation.vehicleId, conversation.hasDeal]);

  const focusDealRoom = useCallback(() => {
    setDealPanelOpen(true);
    requestAnimationFrame(() => {
      const room = document.getElementById(`deal-room-${conversation.id}`);
      room?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [conversation.id]);

  const handleStartDealRoom = useCallback(async () => {
    if (!conversation.vehicleId || dealLeadLoading) return;
    setDealLeadLoading(true);
    setDealRoomError(null);
    try {
      const { lead } = await createDealLead({
        vehicleId: conversation.vehicleId,
        conversationId: conversation.id,
        buyerName: conversation.customerName,
      });
      setDealLead(lead);
      setDealPanelOpen(true);
    } catch {
      setDealRoomError('Could not open Deal Room. Please try again.');
    } finally {
      setDealLeadLoading(false);
    }
  }, [conversation.vehicleId, conversation.id, conversation.customerName, dealLeadLoading]);

  return {
    dealLead,
    setDealLead,
    dealLeadLoading,
    dealPanelOpen,
    setDealPanelOpen,
    dealRoomError,
    setDealRoomError,
    chatBlockedByDeal,
    focusDealRoom,
    handleStartDealRoom,
  };
}
