import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, DealLead } from '../types';
import { createDealLead, getDealLead, resolveDealLeadForConversation } from '../services/dealService';

type UseDealRoomOptions = {
  initialDealLead?: DealLead | null;
  currentUserRole: 'customer' | 'seller';
};

// ponytail: unbounded in-memory cache for the session; fine for a user's handful of threads.
const dealLeadCache = new Map<string, DealLead>();

export function useDealRoomForConversation(
  conversation: Conversation,
  { initialDealLead = null, currentUserRole }: UseDealRoomOptions,
) {
  const [dealLead, setDealLead] = useState<DealLead | null>(
    initialDealLead ?? dealLeadCache.get(conversation.id) ?? null,
  );
  const [dealLeadLoading, setDealLeadLoading] = useState(false);
  // Buyer waiting on accept: keep chat primary. Seller / active deal: open for actions.
  const [dealPanelOpen, setDealPanelOpen] = useState(() => {
    const lead = initialDealLead ?? dealLeadCache.get(conversation.id) ?? null;
    if (lead && currentUserRole === 'customer' && lead.chatStatus === 'pending') return false;
    return true;
  });
  const [dealRoomError, setDealRoomError] = useState<string | null>(null);
  const panelDefaultedForLead = useRef<string | null>(
    (initialDealLead ?? dealLeadCache.get(conversation.id))?.id ?? null,
  );

  const chatBlockedByDeal =
    dealLead?.chatStatus === 'pending' && currentUserRole === 'customer';

  useEffect(() => {
    setDealLead(initialDealLead ?? dealLeadCache.get(conversation.id) ?? null);
  }, [initialDealLead, conversation.id]);

  useEffect(() => {
    panelDefaultedForLead.current = null;
  }, [conversation.id]);

  // Once per lead: collapse when buyer has nothing to do yet (skip if already claimed, e.g. after Open Deal Room)
  useEffect(() => {
    if (!dealLead || panelDefaultedForLead.current === dealLead.id) return;
    panelDefaultedForLead.current = dealLead.id;
    if (currentUserRole === 'customer' && dealLead.chatStatus === 'pending') {
      setDealPanelOpen(false);
    }
  }, [dealLead, currentUserRole]);

  useEffect(() => {
    if (dealLead && dealLead.conversationId === conversation.id) dealLeadCache.set(conversation.id, dealLead);
  }, [dealLead, conversation.id]);

  useEffect(() => {
    const onLeadUpdated = (e: Event) => {
      const lead = (e as CustomEvent<DealLead>).detail;
      if (lead?.conversationId === conversation.id) setDealLead(lead);
    };
    window.addEventListener('reride:deal-lead-updated', onLeadUpdated);
    return () => window.removeEventListener('reride:deal-lead-updated', onLeadUpdated);
  }, [conversation.id]);

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

  const messageCount = conversation.messages?.length ?? 0;
  const leadId = dealLead?.id;
  const seenMessageCount = useRef(messageCount);
  useEffect(() => {
    const grew = messageCount > seenMessageCount.current;
    seenMessageCount.current = messageCount;
    if (!leadId || !grew) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void getDealLead({ leadId })
        .then((lead) => {
          if (!cancelled && lead) setDealLead(lead);
        })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [leadId, messageCount]);

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
      panelDefaultedForLead.current = lead.id;
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
