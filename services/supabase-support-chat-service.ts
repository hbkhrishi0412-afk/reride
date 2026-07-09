import { getSupabaseAdminClient } from '../lib/supabase-admin.js';

export interface SupportChatMessageRow {
  id: string;
  session_id: string;
  user_id?: string | null;
  user_name?: string | null;
  message: string;
  sender: 'user' | 'bot' | 'admin';
  is_read: boolean;
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
    userId?: string;
    userName?: string;
    message: string;
    sender: 'user' | 'bot' | 'admin';
    metadata?: Record<string, unknown>;
  }): Promise<SupportChatMessageRow> {
    const supabase = requireAdmin();
    const { data, error } = await supabase
      .from('support_chat_messages')
      .insert({
        session_id: input.sessionId,
        user_id: input.userId ?? null,
        user_name: input.userName ?? null,
        message: input.message,
        sender: input.sender,
        is_read: false,
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
    const { data, error } = await supabase
      .from('support_chat_messages')
      .select('*')
      .eq('user_id', userId)
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
