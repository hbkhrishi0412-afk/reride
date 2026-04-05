import { useMemo } from 'react';
import type { Conversation } from '../types';

export type InboxViewerRole = 'customer' | 'seller';

export interface UseConversationListConfig {
  viewerRole: InboxViewerRole;
  /** Used for search matching (seller name for customers, buyer name for sellers). */
  getCounterpartLabel: (conv: Conversation) => string;
}

/**
 * Shared hook to sort/filter conversations and compute unread counts.
 * Keeps inbox components in sync and avoids duplicate logic.
 */
export const useConversationList = (
  conversations: Conversation[],
  searchQuery: string,
  filterUnread: boolean,
  config: UseConversationListConfig
) => {
  const { viewerRole, getCounterpartLabel } = config;

  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let filtered = sortedConversations;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((conv) => {
        const matchesVehicle = conv.vehicleName.toLowerCase().includes(query);
        const counterpart = getCounterpartLabel(conv)?.toLowerCase() ?? '';
        const matchesCounterpart = counterpart.includes(query);
        const matchesMessage = conv.messages.some((msg) => msg.text?.toLowerCase().includes(query));
        return matchesVehicle || matchesCounterpart || matchesMessage;
      });
    }

    if (filterUnread) {
      filtered = filtered.filter((c) =>
        viewerRole === 'customer' ? !c.isReadByCustomer : !c.isReadBySeller
      );
    }

    return filtered;
  }, [sortedConversations, searchQuery, filterUnread, getCounterpartLabel, viewerRole]);

  const unreadCount = useMemo(() => {
    return conversations.filter((c) =>
      viewerRole === 'customer' ? !c.isReadByCustomer : !c.isReadBySeller
    ).length;
  }, [conversations, viewerRole]);

  return { sortedConversations, filteredConversations, unreadCount };
};
