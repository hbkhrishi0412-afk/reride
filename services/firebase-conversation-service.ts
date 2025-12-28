import { 
  create, 
  read, 
  readAll, 
  updateData, 
  deleteData, 
  queryByField,
  snapshotToArray,
  DB_PATHS 
} from '../lib/firebase-db.js';

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

// Conversation service for Firebase Realtime Database
export const firebaseConversationService = {
  // Create a new conversation
  async create(conversationData: Omit<Conversation, 'id'>): Promise<Conversation> {
    const id = `${conversationData.customerId}_${conversationData.vehicleId}`;
    await create(DB_PATHS.CONVERSATIONS, conversationData, id);
    
    return {
      id,
      ...conversationData,
    };
  },

  // Find conversation by ID
  async findById(id: string): Promise<Conversation | null> {
    const conversation = await read<Conversation>(DB_PATHS.CONVERSATIONS, id);
    return conversation ? { ...conversation, id } : null;
  },

  // Get all conversations
  async findAll(): Promise<Conversation[]> {
    const conversations = await readAll<Conversation>(DB_PATHS.CONVERSATIONS);
    return snapshotToArray(conversations);
  },

  // Update conversation
  async update(id: string, updates: Partial<Conversation>): Promise<void> {
    await updateData(DB_PATHS.CONVERSATIONS, id, updates);
  },

  // Delete conversation
  async delete(id: string): Promise<void> {
    await deleteData(DB_PATHS.CONVERSATIONS, id);
  },

  // Find conversations by customer ID
  async findByCustomerId(customerId: string): Promise<Conversation[]> {
    const conversations = await queryByField<Conversation>(DB_PATHS.CONVERSATIONS, 'customerId', customerId);
    return snapshotToArray(conversations);
  },

  // Find conversations by seller ID
  async findBySellerId(sellerId: string): Promise<Conversation[]> {
    const conversations = await queryByField<Conversation>(DB_PATHS.CONVERSATIONS, 'sellerId', sellerId);
    return snapshotToArray(conversations);
  },

  // Find conversation by vehicle ID and customer ID
  async findByVehicleAndCustomer(vehicleId: number, customerId: string): Promise<Conversation | null> {
    const conversations = await queryByField<Conversation>(DB_PATHS.CONVERSATIONS, 'vehicleId', vehicleId);
    const results = snapshotToArray(conversations);
    return results.find(c => c.customerId === customerId) || null;
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
    });
  },
};


