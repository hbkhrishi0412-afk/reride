import { useMemo } from 'react';
import type { Conversation } from '../types';

type SellerNameResolver = (sellerId: string) => string;

/**
 * Shared hook to sort/filter conversations and compute unread counts.
 * Keeps inbox components in sync and avoids duplicate logic.
 */
export const useConversationList = (
  conversations: Conversation[],
  searchQuery: string,
  filterUnread: boolean,
  getSellerName?: SellerNameResolver
) => {
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
        const matchesSeller =
          getSellerName?.(conv.sellerId)?.toLowerCase().includes(query) ?? false;
        const matchesMessage = conv.messages.some((msg) => msg.text?.toLowerCase().includes(query));
        return matchesVehicle || matchesSeller || matchesMessage;
      });
    }

    if (filterUnread) {
      filtered = filtered.filter((conv) => !conv.isReadByCustomer);
    }

    return filtered;
  }, [sortedConversations, searchQuery, filterUnread, getSellerName]);

  const unreadCount = useMemo(() => {
    return conversations.filter((c) => !c.isReadByCustomer).length;
  }, [conversations]);

  return { sortedConversations, filteredConversations, unreadCount };
};








