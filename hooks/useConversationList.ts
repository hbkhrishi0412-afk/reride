import { useMemo } from 'react';
import type { Conversation } from '../types';
import { filterMessagesForViewer } from '../utils/conversationView';
import { filterConversationsForInboxView, type InboxViewerRole } from '../utils/conversationInbox';

export type { InboxViewerRole };

export interface UseConversationListConfig {
  viewerRole: InboxViewerRole;
  /** Used for search matching (seller name for customers, buyer name for sellers). */
  getCounterpartLabel: (conv: Conversation) => string;
  /** Active inbox vs archived (hidden) threads. */
  inboxView?: 'active' | 'archived';
}

/**
 * Shared hook to sort/filter conversations and compute unread counts.
 * Keeps inbox components in sync and avoids duplicate logic.
 */
export const useConversationList = (
  conversations: Conversation[],
  searchQuery: string,
  filterMode: 'all' | 'unread' | 'read',
  config: UseConversationListConfig
) => {
  const { viewerRole, getCounterpartLabel, inboxView = 'active' } = config;

  const inboxScopedConversations = useMemo(
    () => filterConversationsForInboxView(conversations, viewerRole, inboxView),
    [conversations, viewerRole, inboxView],
  );

  const sortedConversations = useMemo(() => {
    return [...inboxScopedConversations].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [inboxScopedConversations]);

  const filteredConversations = useMemo(() => {
    let filtered = sortedConversations;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((conv) => {
        const matchesVehicle = conv.vehicleName.toLowerCase().includes(query);
        const counterpart = getCounterpartLabel(conv)?.toLowerCase() ?? '';
        const matchesCounterpart = counterpart.includes(query);
        const matchesMessage = filterMessagesForViewer(conv, viewerRole).some((msg) =>
          msg.text?.toLowerCase().includes(query),
        );
        return matchesVehicle || matchesCounterpart || matchesMessage;
      });
    }

    if (filterMode === 'unread') {
      filtered = filtered.filter((c) => (viewerRole === 'customer' ? !c.isReadByCustomer : !c.isReadBySeller));
    } else if (filterMode === 'read') {
      filtered = filtered.filter((c) => (viewerRole === 'customer' ? c.isReadByCustomer : c.isReadBySeller));
    }

    return filtered;
  }, [sortedConversations, searchQuery, filterMode, getCounterpartLabel, viewerRole]);

  const unreadCount = useMemo(() => {
    return inboxScopedConversations.filter((c) =>
      viewerRole === 'customer' ? !c.isReadByCustomer : !c.isReadBySeller
    ).length;
  }, [inboxScopedConversations, viewerRole]);

  const archivedCount = useMemo(() => {
    return filterConversationsForInboxView(conversations, viewerRole, 'archived').length;
  }, [conversations, viewerRole]);

  return { sortedConversations, filteredConversations, unreadCount, archivedCount };
};
