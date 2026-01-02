// WebSocket handler for real-time chat
// Supports both Socket.io and native WebSocket
import { ensureConnection } from '../lib/db.js';
import { ChatMessage } from '../lib/models/ChatMessage.js';
import { ChatSession } from '../lib/models/ChatSession.js';

// Simple AI response generator (same as REST API)
export const generateBotResponse = async (userMessage, userName) => {
  const message = userMessage.toLowerCase();
  
  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    return `Hello ${userName}! 👋 How can I help you today?`;
  }
  
  if (message.includes('price') || message.includes('cost')) {
    return 'Our prices vary based on the vehicle. Could you tell me which vehicle you\'re interested in?';
  }
  
  if (message.includes('contact') || message.includes('phone') || message.includes('email')) {
    return 'You can reach us at support@reride.com or call us at +91-XXXXX-XXXXX. Our support team is available 24/7!';
  }
  
  if (message.includes('help') || message.includes('support')) {
    return 'I\'m here to help! You can ask me about vehicles, pricing, registration, or any other questions. What would you like to know?';
  }
  
  if (message.includes('thank')) {
    return 'You\'re welcome! Is there anything else I can help you with?';
  }
  
  return `Thank you for your message, ${userName}! Our support team will get back to you shortly. In the meantime, feel free to ask me any questions about our vehicles or services.`;
};

// Setup for Socket.io
export function setupChatWebSocket(io) {
  if (!io) return;
  
  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    let currentSessionId = null;
    let currentUserId = null;
    let currentUserName = 'Guest';

    // Handle session initialization
    socket.on('init', async (data) => {
      try {
        await ensureConnection();
        
        currentUserId = data.userId || undefined;
        currentUserName = data.userName || 'Guest';
        
        // Generate or use existing session ID
        if (data.sessionId) {
          currentSessionId = data.sessionId;
        } else if (currentUserId) {
          currentSessionId = `user_${currentUserId}_${Date.now()}`;
        } else {
          currentSessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        // Create or update session
        await ChatSession.findOneAndUpdate(
          { sessionId: currentSessionId },
          {
            sessionId: currentSessionId,
            userId: currentUserId,
            userName: currentUserName,
            status: 'active',
            lastMessageAt: new Date(),
            metadata: {
              role: data.role
            }
          },
          { upsert: true, new: true }
        );

        // Load and send chat history
        const messages = await ChatMessage.find({ sessionId: currentSessionId })
          .sort({ timestamp: 1 })
          .limit(100)
          .lean();

        const formattedMessages = messages.map(msg => ({
          id: msg._id.toString(),
          text: msg.message,
          sender: msg.sender,
          timestamp: msg.timestamp.toISOString(),
          isRead: msg.isRead || false
        }));

        socket.emit('history', { messages: formattedMessages });
        socket.emit('session', { sessionId: currentSessionId });

        console.log(`✅ Session initialized: ${currentSessionId}`);
      } catch (error) {
        console.error('Error initializing session:', error);
        socket.emit('error', { message: 'Failed to initialize session' });
      }
    });

    // Handle incoming messages
    socket.on('message', async (data) => {
      try {
        if (!currentSessionId) {
          socket.emit('error', { message: 'Session not initialized' });
          return;
        }

        await ensureConnection();

        const { text } = data;
        if (!text || !text.trim()) {
          return;
        }

        // Save user message
        const userMessage = new ChatMessage({
          sessionId: currentSessionId,
          userId: currentUserId,
          userName: currentUserName,
          message: text.trim(),
          sender: 'user',
          timestamp: new Date(),
          isRead: false
        });
        await userMessage.save();

        // Update session
        await ChatSession.findOneAndUpdate(
          { sessionId: currentSessionId },
          {
            lastMessageAt: new Date(),
            $inc: { messageCount: 1 }
          }
        );

        // Send user message back for confirmation
        socket.emit('message', {
          id: userMessage._id.toString(),
          text: userMessage.message,
          sender: 'user',
          timestamp: userMessage.timestamp.toISOString()
        });

        // Show typing indicator
        socket.emit('typing', { isTyping: true });

        // Simulate bot thinking time (1-2 seconds)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

        // Generate bot response
        const botResponseText = await generateBotResponse(text, currentUserName);

        // Save bot response
        const botMessage = new ChatMessage({
          sessionId: currentSessionId,
          userId: currentUserId,
          userName: 'Support Bot',
          message: botResponseText,
          sender: 'bot',
          timestamp: new Date(),
          isRead: false
        });
        await botMessage.save();

        // Hide typing indicator and send response
        socket.emit('typing', { isTyping: false });
        socket.emit('message', {
          id: botMessage._id.toString(),
          text: botMessage.message,
          sender: 'bot',
          timestamp: botMessage.timestamp.toISOString()
        });

        console.log(`💬 Message processed: ${currentSessionId}`);
      } catch (error) {
        console.error('Error processing message:', error);
        socket.emit('typing', { isTyping: false });
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });
}

