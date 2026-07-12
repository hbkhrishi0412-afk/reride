import type { ChatMessage, Conversation } from '../types.js';

/**
 * Messages hidden for one party after "Clear history" until they send/receive new ones.
 * Full thread remains in storage for the other participant.
 */
export function filterMessagesForViewer(
  conversation: Conversation | null | undefined,
  viewerRole: 'customer' | 'seller',
): ChatMessage[] {
  const raw = conversation?.messages || [];
  const clearedAt =
    viewerRole === 'customer'
      ? conversation?.customerHistoryClearedAt
      : conversation?.sellerHistoryClearedAt;
  if (!clearedAt) {
    return raw;
  }
  const clearMs = new Date(clearedAt).getTime();
  if (Number.isNaN(clearMs)) {
    return raw;
  }
  return raw.filter((m) => new Date(m.timestamp).getTime() > clearMs);
}

export function getLastVisibleMessageForViewer(
  conversation: Conversation | null | undefined,
  viewerRole: 'customer' | 'seller',
): ChatMessage | undefined {
  const msgs = filterMessagesForViewer(conversation, viewerRole);
  return msgs.length ? msgs[msgs.length - 1] : undefined;
}

/** True when the seller sent at least one message directly after a buyer message. */
export function sellerRepliedInConversation(
  conversation: Conversation | null | undefined,
): boolean {
  const messages = filterMessagesForViewer(conversation, 'seller');
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].sender === 'user' && messages[i + 1].sender === 'seller') {
      return true;
    }
  }
  return false;
}
