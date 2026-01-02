// Chat API endpoints and WebSocket handler
import express from 'express';
import { ensureConnection } from '../lib/db.js';
import { ChatMessage } from '../lib/models/ChatMessage.js';
import { ChatSession } from '../lib/models/ChatSession.js';

const router = express.Router();

// Import generateBotResponse from websocket file
import { generateBotResponse } from './chat-websocket.js';

// POST /api/chat - Send a message
router.post('/', async (req, res) => {
  try {
    await ensureConnection();
    
    const { message, userId, userName, sessionId } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Generate or use existing session ID
    let finalSessionId = sessionId;
    if (!finalSessionId) {
      finalSessionId = userId 
        ? `user_${userId}_${Date.now()}`
        : `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const finalUserName = userName || 'Guest';
    const finalUserId = userId || undefined;

    // Save user message
    const userMessage = new ChatMessage({
      sessionId: finalSessionId,
      userId: finalUserId,
      userName: finalUserName,
      message: message.trim(),
      sender: 'user',
      timestamp: new Date(),
      isRead: false,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    });
    await userMessage.save();

    // Update or create session
    await ChatSession.findOneAndUpdate(
      { sessionId: finalSessionId },
      {
        sessionId: finalSessionId,
        userId: finalUserId,
        userName: finalUserName,
        status: 'active',
        lastMessageAt: new Date(),
        $inc: { messageCount: 1 },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      },
      { upsert: true, new: true }
    );

    // Generate bot response
    const botResponseText = await generateBotResponse(message, finalUserName);

    // Save bot response
    const botMessage = new ChatMessage({
      sessionId: finalSessionId,
      userId: finalUserId,
      userName: 'Support Bot',
      message: botResponseText,
      sender: 'bot',
      timestamp: new Date(),
      isRead: false
    });
    await botMessage.save();

    res.json({
      success: true,
      response: botResponseText,
      sessionId: finalSessionId,
      messageId: botMessage._id.toString()
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
});

// GET /api/chat/history - Get chat history
router.get('/history', async (req, res) => {
  try {
    await ensureConnection();
    
    const { userId, sessionId } = req.query;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'userId or sessionId is required'
      });
    }

    const query = userId ? { userId } : { sessionId };
    
    const messages = await ChatMessage.find(query)
      .sort({ timestamp: 1 })
      .limit(100)
      .lean();

    // Format messages for frontend
    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      text: msg.message,
      sender: msg.sender,
      timestamp: msg.timestamp.toISOString(),
      isRead: msg.isRead || false
    }));

    res.json({
      success: true,
      messages: formattedMessages,
      count: formattedMessages.length
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
});

// GET /api/chat/sessions - Get user sessions (for admin)
router.get('/sessions', async (req, res) => {
  try {
    await ensureConnection();
    
    const { userId, status = 'active', limit = 50 } = req.query;
    
    const query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;

    const sessions = await ChatSession.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
});

export default router;

