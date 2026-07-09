import type { Conversation } from '../types';

export type InboxViewerRole = 'customer' | 'seller';

export function isConversationArchivedForViewer(
  conv: Conversation,
  viewerRole: InboxViewerRole,
): boolean {
  if (viewerRole === 'customer') {
    return Boolean(conv.customerArchivedAt);
  }
  return Boolean(conv.sellerArchivedAt);
}

export function filterConversationsForInboxView(
  conversations: Conversation[],
  viewerRole: InboxViewerRole,
  inboxView: 'active' | 'archived',
): Conversation[] {
  return conversations.filter((conv) => {
    const archived = isConversationArchivedForViewer(conv, viewerRole);
    return inboxView === 'archived' ? archived : !archived;
  });
}
