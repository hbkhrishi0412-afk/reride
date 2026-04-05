import type { Conversation } from '../types';
import {
  conversationBelongsToCustomer,
  conversationBelongsToSeller,
  normalizeInboxRole,
} from './conversationParticipants';

/**
 * Unread **threads** (conversations) for the current user — used for header / tab badges.
 * Uses the same participant matching as inbox filters (email, emailToKey, users.id).
 */
export function countUnreadMessageThreads(
  conversations: Conversation[] | undefined,
  role: string | undefined,
  email: string | undefined,
  userId?: string | null
): number {
  if (!email || !Array.isArray(conversations)) return 0;
  const inboxRole = normalizeInboxRole(role);
  if (!inboxRole) return 0;
  if (inboxRole === 'customer') {
    return conversations.filter(
      (c) =>
        c &&
        conversationBelongsToCustomer(c, email, userId) &&
        c.isReadByCustomer !== true
    ).length;
  }
  if (inboxRole === 'seller') {
    return conversations.filter(
      (c) =>
        c &&
        conversationBelongsToSeller(c, email, userId) &&
        c.isReadBySeller !== true
    ).length;
  }
  return 0;
}
