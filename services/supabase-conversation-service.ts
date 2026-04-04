import { getSupabaseClient, getSupabaseAdminClient } from '../lib/supabase.js';

function newConversationDbId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  throw new Error('crypto.randomUUID is not available in this environment');
}

/** True if value is a UUID-shaped string (avoids invalid uuid casts on Postgres uuid columns). */
export function isConversationUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'seller' | 'system';
  text: string;
  timestamp: string;
  isRead: boolean;
  type?: 'text' | 'test_drive_request' | 'offer';
  payload?: {
    date?: string;
    time?: string;
    offerPrice?: number;
    counterPrice?: number;
    status?: 'pending' | 'accepted' | 'rejected' | 'countered' | 'confirmed';
  };
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  sellerName?: string;
  vehicleId: number;
  vehicleName: string;
  vehiclePrice?: number;
  messages: ChatMessage[];
  lastMessage?: string;
  lastMessageAt: string;
  isReadBySeller: boolean;
  isReadByCustomer: boolean;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

// Helper to convert Supabase row to Conversation type
export function supabaseRowToConversation(row: any): Conversation {
  return {
    id: row.id,
    customerId: row.customer_id || '',
    customerName: row.customer_name || '',
    sellerId: row.seller_id || '',
    sellerName: row.seller_name || undefined,
    vehicleId: row.vehicle_id != null ? Number(row.vehicle_id) : 0,
    vehicleName: row.vehicle_name || '',
    vehiclePrice: row.vehicle_price ? Number(row.vehicle_price) : undefined,
    messages: (row.metadata?.messages || []) as ChatMessage[],
    lastMessage: row.last_message || undefined,
    lastMessageAt: row.last_message_at || row.lastMessageAt || new Date().toISOString(),
    isReadBySeller: row.is_read_by_seller || false,
    isReadByCustomer: row.is_read_by_customer !== undefined ? row.is_read_by_customer : true,
    isFlagged: row.is_flagged || false,
    flagReason: row.flag_reason || undefined,
    flaggedAt: row.flagged_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// Helper to convert Conversation type to Supabase row
// isUpdate: if true, don't set created_at (preserve original), always set updated_at
function conversationToSupabaseRow(conversation: Partial<Conversation>, isUpdate: boolean = false): any {
  // CRITICAL: Normalize sellerId and customerId before saving to ensure consistent matching
  const normalizedSellerId = conversation.sellerId ? conversation.sellerId.toLowerCase().trim() : null;
  const normalizedCustomerId = conversation.customerId ? conversation.customerId.toLowerCase().trim() : null;
  
  const row: any = {
    id: conversation.id,
    customer_id: normalizedCustomerId,
    seller_id: normalizedSellerId,
    vehicle_id: conversation.vehicleId?.toString() || null,
    customer_name: conversation.customerName || null,
    seller_name: conversation.sellerName || null,
    vehicle_name: conversation.vehicleName || null,
    vehicle_price: conversation.vehiclePrice || null,
    last_message: conversation.lastMessage || null,
    last_message_at: conversation.lastMessageAt || null,
    is_read_by_seller: conversation.isReadBySeller !== undefined ? conversation.isReadBySeller : false,
    is_read_by_customer: conversation.isReadByCustomer !== undefined ? conversation.isReadByCustomer : true,
    is_flagged: conversation.isFlagged || false,
    flag_reason: conversation.flagReason || null,
    flagged_at: conversation.flaggedAt || null,
  };
  
  // Only set created_at on create, not on update (preserve original timestamp)
  if (!isUpdate) {
    row.created_at = conversation.createdAt || new Date().toISOString();
  }
  
  // Always set updated_at to current time on updates, or use provided value
  if (isUpdate) {
    row.updated_at = new Date().toISOString();
  } else {
    row.updated_at = conversation.updatedAt || new Date().toISOString();
  }
  
  // Only include metadata if messages are provided
  if (conversation.messages !== undefined) {
    row.metadata = {
      messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    };
  }
  
  return row;
}

// Conversation service for Supabase
export const supabaseConversationService = {
  // Create a new conversation
  async create(conversationData: Conversation): Promise<Conversation> {
    const clientProvidedId = conversationData.id?.trim() || '';
    const dbId = newConversationDbId();

    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = conversationToSupabaseRow({ ...conversationData, id: dbId }, false); // false = create operation

    // Client uses stable string ids (e.g. conv_*); DB often uses uuid — keep alias for lookups.
    row.metadata = {
      ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      messages: Array.isArray(row.metadata?.messages) ? row.metadata.messages : [],
    };
    if (clientProvidedId && clientProvidedId !== dbId) {
      (row.metadata as Record<string, unknown>).client_conversation_id = clientProvidedId;
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert(row)
      .select()
      .single();
    
    if (error) {
      // Check for connection/network errors
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
      }
      // Check for duplicate key errors
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        throw new Error(`Conversation already exists: ${dbId}`);
      }
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
    
    if (!data) {
      throw new Error(`Failed to create conversation: No data returned from insert operation.`);
    }
    
    return supabaseRowToConversation(data);
  },

  // Find conversation by ID
  async findById(id: string): Promise<Conversation | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const trimmed = id.trim();

    if (isConversationUuid(trimmed)) {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', trimmed)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
          throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
        }
        console.error('Error fetching conversation:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return supabaseRowToConversation(data);
    }

    // Non-uuid ids (conv_*, legacy composite keys) — resolve via metadata alias
    const { data: aliasRows, error: aliasError } = await supabase
      .from('conversations')
      .select('*')
      .contains('metadata', { client_conversation_id: trimmed })
      .limit(1);

    if (aliasError) {
      if (aliasError.message.includes('fetch') || aliasError.message.includes('network') || aliasError.message.includes('ECONNREFUSED') || aliasError.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${aliasError.message}. Please check your network connection and Supabase configuration.`);
      }
      console.error('Error fetching conversation:', aliasError.message);
      return null;
    }

    const row = aliasRows?.[0];
    if (!row) {
      return null;
    }

    return supabaseRowToConversation(row);
  },

  // Get all conversations (used by admin; limit to avoid slow loads)
  async findAll(limitCount: number = 1000): Promise<Conversation[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(Math.max(1, Math.min(limitCount, 5000)));
    
    if (error) {
      // Check for connection/network errors
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
      }
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToConversation);
  },

  // Update conversation
  async update(id: string, updates: Partial<Conversation>): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    let canonicalId = id.trim();
    if (!isConversationUuid(canonicalId)) {
      const resolved = await this.findById(canonicalId);
      if (!resolved) {
        throw new Error(`Conversation not found: ${id}`);
      }
      canonicalId = resolved.id;
    }
    
    // Load full row — partial updates (e.g. addMessage) must merge with existing data.
    // conversationToSupabaseRow() defaults missing fields to null/false; writing that row would
    // wipe seller_id/customer_id and break seller inbox + notifications.
    const { data: existingRow, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', canonicalId)
      .single();
    
    // Check if conversation exists
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Conversation not found
        throw new Error(`Conversation not found: ${canonicalId}`);
      }
      // Other errors (connection issues, etc.)
      throw new Error(`Failed to fetch existing conversation: ${fetchError.message}`);
    }
    
    if (!existingRow) {
      throw new Error(`Conversation not found: ${canonicalId}`);
    }

    const existingConv = supabaseRowToConversation(existingRow);
    const merged: Conversation = {
      ...existingConv,
      ...updates,
      id: canonicalId,
      messages:
        updates.messages !== undefined
          ? (Array.isArray(updates.messages) ? updates.messages : [])
          : existingConv.messages,
    };
    
    // Convert merged conversation to row format (isUpdate=true to preserve created_at and set updated_at)
    const row = conversationToSupabaseRow(merged, true); // true = update operation
    
    // Remove id from updates (don't update the id field)
    delete row.id;
    
    // Remove created_at from updates (preserve original creation timestamp)
    delete row.created_at;

    // Preserve extra metadata keys not modeled on Conversation (e.g. future fields)
    const existingMeta = (existingRow as { metadata?: Record<string, unknown> }).metadata || {};
    row.metadata = {
      ...existingMeta,
      ...(row.metadata || {}),
      messages: merged.messages,
    };
    const clientAlias = updates.id && !isConversationUuid(String(updates.id)) ? String(updates.id).trim() : '';
    if (clientAlias && clientAlias !== canonicalId) {
      (row.metadata as Record<string, unknown>).client_conversation_id = clientAlias;
    }
    
    // Always ensure messages array exists (even if empty)
    if (row.metadata && !row.metadata.messages) {
      row.metadata.messages = [];
    }
    
    // Only include metadata if it has at least the messages field
    if (row.metadata && (!row.metadata.messages || Object.keys(row.metadata).length === 0)) {
      // If metadata is empty or has no messages, ensure messages array exists
      row.metadata.messages = row.metadata.messages || [];
    }
    
    // Update and verify that rows were actually updated
    const { error, data: updateData } = await supabase
      .from('conversations')
      .update(row)
      .eq('id', canonicalId)
      .select();
    
    if (error) {
      // Check for connection/network errors
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
      }
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
    
    // Verify that the update actually affected a row
    if (!updateData || updateData.length === 0) {
      throw new Error(`Conversation update failed: No rows were updated. Conversation may not exist or identifier mismatch.`);
    }
  },

  // Delete conversation
  async delete(id: string): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    let canonicalId = id.trim();
    if (!isConversationUuid(canonicalId)) {
      const resolved = await this.findById(canonicalId);
      if (!resolved) {
        throw new Error(`Conversation delete failed: Conversation not found.`);
      }
      canonicalId = resolved.id;
    }
    
    const { error, data: deleteData } = await supabase
      .from('conversations')
      .delete()
      .eq('id', canonicalId)
      .select();
    
    if (error) {
      // Check for connection/network errors
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
      }
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
    
    // Verify that the delete actually affected a row
    if (!deleteData || deleteData.length === 0) {
      throw new Error(`Conversation delete failed: No rows were deleted. Conversation may not exist.`);
    }
  },

  // Find conversations by customer ID
  async findByCustomerId(customerId: string): Promise<Conversation[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // CRITICAL: Normalize customerId for case-insensitive matching
    const normalizedCustomerId = customerId ? customerId.toLowerCase().trim() : '';
    
    // Try exact match first (in case data is already normalized)
    let { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('customer_id', normalizedCustomerId);
    
    // If no results with normalized, try with original (case-sensitive) as fallback
    if (!error && (!data || data.length === 0)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', customerId);
      
      if (!fallbackError && fallbackData && fallbackData.length > 0) {
        data = fallbackData;
        error = null;
      }
    }
    
    // PERFORMANCE: Removed "fetch all and filter in memory" fallback - it caused very slow
    // page loads when the first two queries returned no rows. Return empty if no match.
    
    if (error) {
      // Check for connection/network errors
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
      }
      throw new Error(`Failed to fetch conversations by customer: ${error.message}`);
    }
    
    // Normalize customerId and sellerId in returned conversations to ensure consistency
    return (data || []).map(row => {
      const conv = supabaseRowToConversation(row);
      return {
        ...conv,
        sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
        customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId
      };
    });
  },

  // Find conversations by seller ID
  async findBySellerId(sellerId: string): Promise<Conversation[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // CRITICAL: Normalize sellerId for case-insensitive matching
    const normalizedSellerId = sellerId ? sellerId.toLowerCase().trim() : '';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 findBySellerId called:', {
        originalSellerId: sellerId,
        normalizedSellerId,
        isServerSide
      });
    }
    
    // Try exact match first (in case data is already normalized)
    let { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('seller_id', normalizedSellerId);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Supabase query result (normalized):', {
        found: data?.length || 0,
        error: error?.message,
        sampleSellerIds: data?.slice(0, 3).map((row: any) => row.seller_id)
      });
    }
    
    // If no results with normalized, try with original (case-sensitive) as fallback
    if (!error && (!data || data.length === 0)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('conversations')
        .select('*')
        .eq('seller_id', sellerId);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Supabase query result (original case):', {
          found: fallbackData?.length || 0,
          error: fallbackError?.message
        });
      }
      
      if (!fallbackError && fallbackData && fallbackData.length > 0) {
        data = fallbackData;
        error = null;
      }
    }
    
    // PERFORMANCE: Removed "fetch all and filter in memory" fallback - it caused very slow
    // page loads when the first two queries returned no rows. Return empty if no match.
    
    if (error) {
      // Check for connection/network errors
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
      }
      throw new Error(`Failed to fetch conversations by seller: ${error.message}`);
    }
    
    // Normalize sellerId in returned conversations to ensure consistency
    return (data || []).map(row => {
      const conv = supabaseRowToConversation(row);
      return {
        ...conv,
        sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
        customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId
      };
    });
  },

  // Find conversation by vehicle ID and customer ID
  async findByVehicleAndCustomer(vehicleId: number, customerId: string): Promise<Conversation | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const normalizedCustomerId = customerId ? customerId.toLowerCase().trim() : '';

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('vehicle_id', vehicleId.toString())
      .eq('customer_id', normalizedCustomerId)
      .single();
    
    // PGRST116 = not found (expected when conversation doesn't exist)
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      // For connection errors, throw to allow caller to handle
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        throw new Error(`Supabase connection failed: ${error.message}. Please check your network connection and Supabase configuration.`);
      }
      // For other errors, log and return null (permission issues, etc.)
      console.error('Error fetching conversation by vehicle and customer:', error.message);
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    return supabaseRowToConversation(data);
  },

  // Add message to conversation
  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    console.log('💾 Supabase: Adding message to conversation:', { conversationId, messageId: message.id });
    
    const conversation = await this.findById(conversationId);
    if (!conversation) {
      console.error('❌ Supabase: Conversation not found:', conversationId);
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    console.log('📋 Supabase: Current conversation has', conversation.messages?.length || 0, 'messages');
    
    const updatedMessages = [...(conversation.messages || []), message];
    console.log('💾 Supabase: Updating conversation with', updatedMessages.length, 'messages');

    const readPatch: Partial<Conversation> = {};
    if (message.sender === 'seller') {
      readPatch.isReadBySeller = true;
      readPatch.isReadByCustomer = false;
    } else if (message.sender === 'user') {
      readPatch.isReadBySeller = false;
      readPatch.isReadByCustomer = true;
    }
    
    try {
      await this.update(conversation.id, {
        messages: updatedMessages,
        lastMessageAt: message.timestamp,
        lastMessage: message.text,
        ...readPatch,
      });
      console.log('✅ Supabase: Message added successfully');
    } catch (error) {
      console.error('❌ Supabase: Error updating conversation:', {
        conversationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },
};


