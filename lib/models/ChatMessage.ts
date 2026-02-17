// TypeScript interface for ChatMessage (Supabase-compatible)
// Note: This file no longer uses Mongoose since the project uses Supabase
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

// Export interface as ChatMessage for backward compatibility
// Note: If you need to use this with Supabase, you'll need to create a service similar to supabase-conversation-service.ts
export type ChatMessage = IChatMessage;





























