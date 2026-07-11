import { randomUUID } from 'crypto';
import { getSupabaseAdminClient } from '../lib/supabase-admin.js';

export type SupportChatSender = 'user' | 'bot' | 'admin';

export interface SupportChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface SupportChatSessionRow {
  session_id: string;
  user_id?: string | null;
  user_name: string;
  status: string;
  message_count: number;
  last_message_at: string;
  metadata?: Record<string, unknown>;
}

function requireAdmin() {
  return getSupabaseAdminClient();
}

function senderToRole(sender: SupportChatSender): SupportChatMessageRow['role'] {
  if (sender === 'bot') return 'assistant';
  if (sender === 'admin') return 'system';
  return 'user';
}

export function roleToSender(role: string): SupportChatSender {
  if (role === 'assistant') return 'bot';
  if (role === 'system') return 'admin';
  return 'user';
}

export const supabaseSupportChatService = {
  async upsertSession(input: {
    sessionId: string;
    userId?: string;
    userName: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const supabase = requireAdmin();
    const now = new Date().toISOString();
    const { error } = await supabase.from('support_chat_sessions').upsert(
      {
        session_id: input.sessionId,
        user_id: input.userId ?? null,
        user_name: input.userName,
        status: 'active',
        last_message_at: now,
        updated_at: now,
        metadata: input.metadata ?? {},
      },
      { onConflict: 'session_id' },
    );
    if (error) throw new Error(error.message);
  },

  async incrementSessionMessageCount(sessionId: string, delta = 1): Promise<void> {
    const supabase = requireAdmin();
    const { data, error: fetchErr } = await supabase
      .from('support_chat_sessions')
      .select('message_count')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    const next = (data?.message_count ?? 0) + delta;
    const { error } = await supabase
      .from('support_chat_sessions')
      .update({
        message_count: next,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);
    if (error) throw new Error(error.message);
  },

  async addMessage(input: {
    sessionId: string;
    message: string;
    sender: SupportChatSender;
    metadata?: Record<string, unknown>;
  }): Promise<SupportChatMessageRow> {
    const supabase = requireAdmin();
    const { data, error } = await supabase
      .from('support_chat_messages')
      .insert({
        id: randomUUID(),
        session_id: input.sessionId,
        role: senderToRole(input.sender),
        content: input.message,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to insert support message');
    await this.incrementSessionMessageCount(input.sessionId, 1);
    return data as SupportChatMessageRow;
  },

  async getSession(sessionId: string): Promise<SupportChatSessionRow | null> {
    const supabase = requireAdmin();
    const { data, error } = await supabase
      .from('support_chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as SupportChatSessionRow | null) ?? null;
  },

  async getMessagesBySession(sessionId: string, limit = 100): Promise<SupportChatMessageRow[]> {
    const supabase = requireAdmin();
    const { data, error } = await supabase
      .from('support_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SupportChatMessageRow[];
  },

  async getMessagesByUserId(userId: string, limit = 100): Promise<SupportChatMessageRow[]> {
    const supabase = requireAdmin();
    const { data: sessions, error: sessionErr } = await supabase
      .from('support_chat_sessions')
      .select('session_id')
      .eq('user_id', userId);
    if (sessionErr) throw new Error(sessionErr.message);
    const sessionIds = (sessions ?? []).map((s) => s.session_id);
    if (sessionIds.length === 0) return [];

    const { data, error } = await supabase
      .from('support_chat_messages')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SupportChatMessageRow[];
  },

  async listSessions(filters: {
    userId?: string;
    status?: string;
    limit?: number;
  }): Promise<SupportChatSessionRow[]> {
    const supabase = requireAdmin();
    let query = supabase.from('support_chat_sessions').select('*').order('last_message_at', { ascending: false });
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.status) query = query.eq('status', filters.status);
    query = query.limit(filters.limit ?? 50);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as SupportChatSessionRow[];
  },
};
