import { getSupabaseClient, getSupabaseAdminClient } from '../lib/supabase.js';

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
  vehicleId: number;
  vehicleName: string;
  vehiclePrice?: number;
  messages: ChatMessage[];
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
function supabaseRowToConversation(row: any): Conversation {
  return {
    id: row.id,
    customerId: row.customer_id || '',
    customerName: row.customer_name || '',
    sellerId: row.seller_id || '',
    vehicleId: Number(row.vehicle_id) || 0,
    vehicleName: row.vehicle_name || '',
    vehiclePrice: row.vehicle_price ? Number(row.vehicle_price) : undefined,
    messages: (row.metadata?.messages || []) as ChatMessage[],
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
function conversationToSupabaseRow(conversation: Partial<Conversation>): any {
  return {
    id: conversation.id,
    customer_id: conversation.customerId || null,
    seller_id: conversation.sellerId || null,
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
    created_at: conversation.createdAt || new Date().toISOString(),
    updated_at: conversation.updatedAt || new Date().toISOString(),
    metadata: {
      messages: conversation.messages || [],
    },
  };
}

// Conversation service for Supabase
export const supabaseConversationService = {
  // Create a new conversation
  async create(conversationData: Omit<Conversation, 'id'>): Promise<Conversation> {
    const id = `${conversationData.customerId}_${conversationData.vehicleId}`;
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = conversationToSupabaseRow({ ...conversationData, id });
    
    const { data, error } = await supabase
      .from('conversations')
      .insert(row)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
    
    return supabaseRowToConversation(data);
  },

  // Find conversation by ID
  async findById(id: string): Promise<Conversation | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return supabaseRowToConversation(data);
  },

  // Get all conversations
  async findAll(): Promise<Conversation[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToConversation);
  },

  // Update conversation
  async update(id: string, updates: Partial<Conversation>): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = conversationToSupabaseRow(updates);
    
    // Remove id from updates
    delete row.id;
    
    const { error } = await supabase
      .from('conversations')
      .update(row)
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  },

  // Delete conversation
  async delete(id: string): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  },

  // Find conversations by customer ID
  async findByCustomerId(customerId: string): Promise<Conversation[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('customer_id', customerId);
    
    if (error) {
      throw new Error(`Failed to fetch conversations by customer: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToConversation);
  },

  // Find conversations by seller ID
  async findBySellerId(sellerId: string): Promise<Conversation[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('seller_id', sellerId);
    
    if (error) {
      throw new Error(`Failed to fetch conversations by seller: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToConversation);
  },

  // Find conversation by vehicle ID and customer ID
  async findByVehicleAndCustomer(vehicleId: number, customerId: string): Promise<Conversation | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('vehicle_id', vehicleId.toString())
      .eq('customer_id', customerId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return supabaseRowToConversation(data);
  },

  // Add message to conversation
  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const conversation = await this.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    const updatedMessages = [...(conversation.messages || []), message];
    await this.update(conversationId, {
      messages: updatedMessages,
      lastMessageAt: message.timestamp,
      lastMessage: message.text,
    });
  },
};

