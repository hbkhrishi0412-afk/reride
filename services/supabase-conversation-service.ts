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
function supabaseRowToConversation(row: any): Conversation {
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
  async create(conversationData: Omit<Conversation, 'id'>): Promise<Conversation> {
    const id = `${conversationData.customerId}_${conversationData.vehicleId}`;
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = conversationToSupabaseRow({ ...conversationData, id }, false); // false = create operation
    
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
        throw new Error(`Conversation already exists: ${id}`);
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
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
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
      console.error('Error fetching conversation:', error.message);
      return null;
    }
    
    if (!data) {
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
    
    // First, get existing conversation to merge metadata (messages) properly
    const { data: existingConversation, error: fetchError } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', id)
      .single();
    
    // Check if conversation exists
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Conversation not found
        throw new Error(`Conversation not found: ${id}`);
      }
      // Other errors (connection issues, etc.)
      throw new Error(`Failed to fetch existing conversation: ${fetchError.message}`);
    }
    
    if (!existingConversation) {
      throw new Error(`Conversation not found: ${id}`);
    }
    
    // Convert updates to row format (isUpdate=true to preserve created_at and set updated_at)
    const row = conversationToSupabaseRow(updates, true); // true = update operation
    
    // Remove id from updates (don't update the id field)
    delete row.id;
    
    // Remove created_at from updates (preserve original creation timestamp)
    delete row.created_at;
    
    // CRITICAL: Merge metadata (messages) instead of replacing it
    // This preserves existing messages when updating other conversation fields
    const existingMessages = existingConversation?.metadata?.messages || [];
    
    if (updates.messages !== undefined) {
      // Messages are being updated - use the provided messages array
      // This handles both adding new messages and replacing the entire array
      if (!row.metadata) {
        row.metadata = {};
      }
      row.metadata.messages = Array.isArray(updates.messages) ? updates.messages : [];
    } else {
      // No messages in updates - preserve existing messages
      // Ensure metadata object exists to store messages
      if (!row.metadata) {
        row.metadata = {};
      }
      // Preserve existing messages
      row.metadata.messages = existingMessages;
      
      // Preserve any other metadata fields that might exist
      if (existingConversation?.metadata) {
        Object.keys(existingConversation.metadata).forEach(key => {
          if (key !== 'messages' && !row.metadata![key]) {
            row.metadata![key] = existingConversation.metadata![key];
          }
        });
      }
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
      .eq('id', id)
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
    
    const { error, data: deleteData } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
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
    
    // If still no results, try case-insensitive search by fetching all and filtering
    if (!error && (!data || data.length === 0)) {
      const { data: allData, error: allError } = await supabase
        .from('conversations')
        .select('*');
      
      if (!allError && allData) {
        // Filter in memory with case-insensitive matching
        data = allData.filter((row: any) => {
          const rowCustomerId = row.customer_id || row.customerId || '';
          return rowCustomerId.toLowerCase().trim() === normalizedCustomerId;
        });
      }
    }
    
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
    
    // If still no results, try case-insensitive search by fetching all and filtering
    // This is a fallback for databases that don't support case-insensitive queries
    if (!error && (!data || data.length === 0)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Trying fallback: fetch all and filter in memory');
      }
      
      const { data: allData, error: allError } = await supabase
        .from('conversations')
        .select('*');
      
      if (!allError && allData) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Fetched all conversations:', {
            totalCount: allData.length,
            uniqueSellerIds: [...new Set(allData.map((row: any) => row.seller_id))].slice(0, 5)
          });
        }
        
        // Filter in memory with case-insensitive matching
        data = allData.filter((row: any) => {
          const rowSellerId = row.seller_id || row.sellerId || '';
          const matches = rowSellerId.toLowerCase().trim() === normalizedSellerId;
          
          if (process.env.NODE_ENV === 'development' && matches) {
            console.log('✅ Found matching conversation:', {
              id: row.id,
              sellerId: row.seller_id,
              normalized: rowSellerId.toLowerCase().trim(),
              target: normalizedSellerId
            });
          }
          
          return matches;
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Filtered results:', {
            matchedCount: data.length
          });
        }
      }
    }
    
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
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('vehicle_id', vehicleId.toString())
      .eq('customer_id', customerId)
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
    
    try {
      await this.update(conversationId, {
        messages: updatedMessages,
        lastMessageAt: message.timestamp,
        lastMessage: message.text,
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


