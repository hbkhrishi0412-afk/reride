/**
 * Conversation deletion / archive policy helpers.
 */
import { getSupabaseAdminClient } from '../handler-shared.js';
import type { Conversation } from '../../types.js';

export interface ConversationDealInfo {
  id: string;
  status: 'active' | 'completed' | 'cancelled';
}

/** Resolve deal linked to a conversation (UUID or client alias). */
export async function getDealForConversation(conversationId: string): Promise<ConversationDealInfo | null> {
  const supabase = getSupabaseAdminClient();
  const trimmed = String(conversationId || '').trim();
  if (!trimmed) return null;

  const ids = new Set<string>([trimmed]);

  const { data: byUuid } = await supabase
    .from('deal_leads')
    .select('id, status, conversation_id')
    .eq('conversation_id', trimmed)
    .maybeSingle();
  if (byUuid?.id) {
    return {
      id: String(byUuid.id),
      status: byUuid.status as ConversationDealInfo['status'],
    };
  }

  const { data: convRow } = await supabase
    .from('conversations')
    .select('id, metadata')
    .eq('id', trimmed)
    .maybeSingle();
  if (convRow?.id) {
    ids.add(String(convRow.id));
    const meta = convRow.metadata as { client_conversation_id?: string } | null;
    if (meta?.client_conversation_id) {
      ids.add(String(meta.client_conversation_id));
    }
  } else {
    const { data: aliasRows } = await supabase
      .from('conversations')
      .select('id, metadata')
      .contains('metadata', { client_conversation_id: trimmed })
      .limit(1);
    const aliasRow = aliasRows?.[0];
    if (aliasRow?.id) {
      ids.add(String(aliasRow.id));
    }
  }

  const idList = [...ids];
  const { data: deals } = await supabase
    .from('deal_leads')
    .select('id, status, conversation_id')
    .in('conversation_id', idList)
    .limit(1);

  const deal = deals?.[0];
  if (!deal?.id) return null;
  return {
    id: String(deal.id),
    status: deal.status as ConversationDealInfo['status'],
  };
}

/** Whether hard-delete is allowed (no linked deal). */
export async function canDeleteConversation(conversationId: string): Promise<boolean> {
  const deal = await getDealForConversation(conversationId);
  return !deal;
}

/** Annotate inbox rows with hasDeal for UI (delete vs archive). */
export async function enrichConversationsWithDealFlags(
  conversations: Conversation[],
): Promise<Conversation[]> {
  if (!conversations.length) return conversations;

  const supabase = getSupabaseAdminClient();
  const ids = [...new Set(conversations.map((c) => String(c.id)).filter(Boolean))];
  if (!ids.length) return conversations;

  const { data: deals } = await supabase
    .from('deal_leads')
    .select('conversation_id')
    .in('conversation_id', ids);

  const dealConvIds = new Set(
    (deals || []).map((d) => String(d.conversation_id || '')).filter(Boolean),
  );

  return conversations.map((c) => ({
    ...c,
    hasDeal: dealConvIds.has(String(c.id)),
  }));
}
