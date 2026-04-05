import type { Conversation } from '../types';

/**
 * Unread **threads** (conversations) for the current user — used for header / tab badges.
 */
export function countUnreadMessageThreads(
  conversations: Conversation[] | undefined,
  role: string | undefined,
  email: string | undefined
): number {
  if (!email || !Array.isArray(conversations)) return 0;
  const n = email.toLowerCase().trim();
  if (role === 'customer') {
    return conversations.filter(
      (c) =>
        c &&
        c.customerId?.toLowerCase().trim() === n &&
        c.isReadByCustomer === false
    ).length;
  }
  if (role === 'seller') {
    return conversations.filter(
      (c) =>
        c &&
        c.sellerId?.toLowerCase().trim() === n &&
        c.isReadBySeller === false
    ).length;
  }
  return 0;
}
