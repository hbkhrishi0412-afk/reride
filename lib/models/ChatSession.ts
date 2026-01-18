import mongoose from 'mongoose';

export interface IChatSession {
  _id?: string;
  sessionId: string;
  userId?: string; // Optional - for logged-in users
  userName: string;
  status: 'active' | 'closed' | 'archived';
  lastMessageAt: Date;
  messageCount: number;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    role?: string;
    referrer?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const ChatSessionSchema = new mongoose.Schema<IChatSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      index: true,
      sparse: true
    },
    userName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'archived'],
      default: 'active',
      index: true
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    messageCount: {
      type: Number,
      default: 0
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      role: String,
      referrer: String
    }
  },
  {
    timestamps: true,
    collection: 'chatsessions'
  }
);

// Index for efficient queries
ChatSessionSchema.index({ userId: 1, status: 1 });
ChatSessionSchema.index({ lastMessageAt: -1 });

export const ChatSession = mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);












