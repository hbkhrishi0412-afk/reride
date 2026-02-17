// TypeScript interface for ChatSession (Supabase-compatible)
// Note: This file no longer uses Mongoose since the project uses Supabase
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

// Export interface as ChatSession for backward compatibility
// Note: If you need to use this with Supabase, you'll need to create a service similar to supabase-conversation-service.ts
export type ChatSession = IChatSession;





























