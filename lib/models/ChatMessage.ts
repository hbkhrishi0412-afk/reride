import mongoose from 'mongoose';

export interface IChatMessage {
  _id?: string;
  sessionId: string;
  userId?: string; // Optional - for logged-in users
  userName: string;
  message: string;
  sender: 'user' | 'bot' | 'admin';
  timestamp: Date;
  isRead: boolean;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    role?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const ChatMessageSchema = new mongoose.Schema<IChatMessage>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      index: true,
      sparse: true // Allow null values but index them
    },
    userName: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    sender: {
      type: String,
      enum: ['user', 'bot', 'admin'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      role: String
    }
  },
  {
    timestamps: true,
    collection: 'chatmessages'
  }
);

// Compound index for efficient queries
ChatMessageSchema.index({ sessionId: 1, timestamp: 1 });
ChatMessageSchema.index({ userId: 1, timestamp: 1 });

export const ChatMessage = mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

















