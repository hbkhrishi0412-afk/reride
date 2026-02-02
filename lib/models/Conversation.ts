import mongoose from 'mongoose';

export interface IConversation {
  _id?: string;
  id: string; // Frontend conversation ID
  customerId: string;
  customerName: string;
  sellerId: string;
  vehicleId: number;
  vehicleName: string;
  vehiclePrice: number;
  messages: Array<{
    id: number;
    sender: 'user' | 'seller' | 'system';
    text: string;
    timestamp: string;
    isRead: boolean;
    type?: 'text' | 'test_drive_request' | 'offer';
    payload?: {
      offerPrice?: number;
      status?: string;
      date?: string;
      time?: string;
    };
  }>;
  lastMessageAt: string;
  isReadBySeller: boolean;
  isReadByCustomer: boolean;
  isFlagged: boolean;
  flagReason?: string;
  flaggedAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ConversationSchema = new mongoose.Schema<IConversation>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    customerId: {
      type: String,
      required: true,
      index: true
    },
    customerName: {
      type: String,
      required: true
    },
    sellerId: {
      type: String,
      required: true,
      index: true
    },
    vehicleId: {
      type: Number,
      required: true,
      index: true
    },
    vehicleName: {
      type: String,
      required: true
    },
    vehiclePrice: {
      type: Number,
      required: true
    },
    messages: [{
      id: Number,
      sender: {
        type: String,
        enum: ['user', 'seller', 'system'],
        required: true
      },
      text: String,
      timestamp: String,
      isRead: {
        type: Boolean,
        default: false
      },
      type: {
        type: String,
        enum: ['text', 'test_drive_request', 'offer'],
        default: 'text'
      },
      payload: {
        offerPrice: Number,
        status: String,
        date: String,
        time: String
      }
    }],
    lastMessageAt: {
      type: String,
      required: true,
      index: true
    },
    isReadBySeller: {
      type: Boolean,
      default: false
    },
    isReadByCustomer: {
      type: Boolean,
      default: true
    },
    isFlagged: {
      type: Boolean,
      default: false
    },
    flagReason: String,
    flaggedAt: String
  },
  {
    timestamps: true,
    collection: 'conversations'
  }
);

// Compound indexes for efficient queries
ConversationSchema.index({ customerId: 1, lastMessageAt: -1 });
ConversationSchema.index({ sellerId: 1, lastMessageAt: -1 });
ConversationSchema.index({ vehicleId: 1, customerId: 1 });

export const Conversation = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
























