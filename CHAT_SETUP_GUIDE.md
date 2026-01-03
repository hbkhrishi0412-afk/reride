# Chat Box Setup Guide

Complete guide for setting up and deploying the Support Chat Widget.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Installation](#installation)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [WebSocket Setup](#websocket-setup)
7. [Integration](#integration)
8. [Deployment](#deployment)
9. [Testing](#testing)

## 🎯 Overview

The Support Chat Widget is a floating chatbox that appears in the bottom-right corner of your site. It supports:
- Real-time messaging via WebSocket (Socket.io)
- REST API fallback
- Chat history persistence
- Anonymous and authenticated users
- Typing indicators
- Responsive design

## ✨ Features

### Frontend
- ✅ Floating chat button (bottom-right corner)
- ✅ Toggle open/close functionality
- ✅ Scrollable message area
- ✅ User messages on right, bot/admin on left
- ✅ Text input with Send button
- ✅ Typing indicators
- ✅ Connection status indicator
- ✅ Responsive for desktop and mobile
- ✅ Auto-scroll to latest message
- ✅ Chat history loading

### Backend
- ✅ REST API endpoints (`/api/chat`)
- ✅ WebSocket server (Socket.io)
- ✅ MongoDB persistence
- ✅ Session management
- ✅ Message history
- ✅ Simple AI bot responses (can be replaced with Gemini/AI service)

## 📦 Installation

### 1. Install Dependencies

```bash
npm install socket.io socket.io-client
```

### 2. Database Models

The chat system uses two MongoDB collections:

#### ChatMessage Schema
```typescript
{
  sessionId: string;      // Unique session identifier
  userId?: string;        // Optional - for logged-in users
  userName: string;       // Display name
  message: string;        // Message content
  sender: 'user' | 'bot' | 'admin';
  timestamp: Date;
  isRead: boolean;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    role?: string;
  };
}
```

#### ChatSession Schema
```typescript
{
  sessionId: string;      // Unique session ID
  userId?: string;         // Optional - for logged-in users
  userName: string;       // Display name
  status: 'active' | 'closed' | 'archived';
  lastMessageAt: Date;
  messageCount: number;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    role?: string;
    referrer?: string;
  };
}
```

### 3. Files Created

- `components/SupportChatWidget.tsx` - Frontend chat widget
- `lib/models/ChatMessage.ts` - Message database model
- `lib/models/ChatSession.ts` - Session database model
- `api/chat.js` - REST API endpoints
- `api/chat-websocket.js` - WebSocket handler

## 🔌 API Endpoints

### POST `/api/chat`
Send a chat message (REST fallback).

**Request:**
```json
{
  "message": "Hello, I need help",
  "userId": "user@example.com",  // Optional
  "userName": "John Doe",         // Optional
  "sessionId": "session_123"      // Optional
}
```

**Response:**
```json
{
  "success": true,
  "response": "Hello John! How can I help you?",
  "sessionId": "session_123",
  "messageId": "msg_456"
}
```

### GET `/api/chat/history`
Get chat history for a user or session.

**Query Parameters:**
- `userId` (optional) - User email
- `sessionId` (optional) - Session ID

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg_123",
      "text": "Hello",
      "sender": "user",
      "timestamp": "2024-01-01T12:00:00Z",
      "isRead": true
    }
  ],
  "count": 1
}
```

### GET `/api/chat/sessions`
Get all chat sessions (admin endpoint).

**Query Parameters:**
- `userId` (optional) - Filter by user
- `status` (optional) - Filter by status (active/closed/archived)
- `limit` (optional) - Limit results (default: 50)

## 🔌 WebSocket Setup

### Server Configuration

The WebSocket server is integrated into `dev-api-server.js`:

```javascript
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupChatWebSocket } from './api/chat-websocket.js';

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

setupChatWebSocket(io);
```

### Client Connection

The `SupportChatWidget` automatically connects to the WebSocket server when opened.

**Connection URL:**
- Development: `ws://localhost:3001`
- Production: `wss://your-domain.com`

### WebSocket Events

#### Client → Server

**`init`** - Initialize session
```json
{
  "type": "init",
  "userId": "user@example.com",  // Optional
  "userName": "John Doe",         // Optional
  "role": "customer",             // Optional
  "sessionId": "session_123"      // Optional
}
```

**`message`** - Send message
```json
{
  "type": "message",
  "text": "Hello",
  "userId": "user@example.com",
  "userName": "John Doe"
}
```

#### Server → Client

**`history`** - Chat history
```json
{
  "type": "history",
  "messages": [...]
}
```

**`message`** - New message
```json
{
  "type": "message",
  "id": "msg_123",
  "text": "Hello!",
  "sender": "bot",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**`typing`** - Typing indicator
```json
{
  "type": "typing",
  "isTyping": true
}
```

**`session`** - Session ID
```json
{
  "type": "session",
  "sessionId": "session_123"
}
```

## 🔗 Integration

### App.tsx Integration

The `SupportChatWidget` is already integrated into `App.tsx`:

```tsx
import SupportChatWidget from './components/SupportChatWidget';

// In render:
<SupportChatWidget
  currentUser={currentUser}
  onLoginRequired={() => {
    addToast('Please login to continue chatting', 'info');
    navigate(ViewEnum.LOGIN_PORTAL);
  }}
/>
```

The widget is rendered in both:
- Desktop layout (after CommandPalette)
- Mobile layout (after ChatWidget)

## 🚀 Deployment

### Environment Variables

Ensure these are set in production:

```env
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=production
```

### Vercel Deployment

1. **Update `vercel.json`** to handle WebSocket:

```json
{
  "rewrites": [
    {
      "source": "/api/chat",
      "destination": "/api/chat"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "/api/chat-websocket/:path*"
    }
  ]
}
```

2. **For WebSocket on Vercel**, consider using:
   - Vercel Serverless Functions (with limitations)
   - Separate WebSocket server (Railway, Render, etc.)
   - Pusher/Ably for WebSocket as a service

### Alternative: Separate WebSocket Server

For production, you may want to run WebSocket on a separate server:

1. **Deploy WebSocket server** (Railway, Render, Heroku):
```javascript
// websocket-server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupChatWebSocket } from './api/chat-websocket.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

setupChatWebSocket(io);

server.listen(3001, () => {
  console.log('WebSocket server running on port 3001');
});
```

2. **Update frontend** to connect to WebSocket server:
```typescript
const wsUrl = process.env.NODE_ENV === 'production'
  ? 'wss://your-websocket-server.com'
  : 'ws://localhost:3001';
```

### MongoDB Atlas Setup

1. Create a MongoDB Atlas cluster
2. Get connection string
3. Add to `.env.local`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/reride
```

4. The chat collections will be created automatically on first use

## 🧪 Testing

### Manual Testing

1. **Start development server:**
```bash
npm run dev
```

2. **Start API server:**
```bash
node dev-api-server.js
```

3. **Test REST API:**
```bash
# Send message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "userName": "Test User"}'

# Get history
curl http://localhost:3001/api/chat/history?sessionId=test_session
```

4. **Test WebSocket:**
   - Open browser console
   - Open chat widget
   - Send a message
   - Check console for WebSocket connection logs

### Test Scenarios

- ✅ Anonymous user can chat
- ✅ Logged-in user can chat
- ✅ Chat history loads on reconnect
- ✅ Typing indicator shows
- ✅ Messages persist in database
- ✅ Mobile responsive design
- ✅ Connection status indicator

## 🔧 Customization

### Replace Bot with AI Service

In `api/chat.js` and `api/chat-websocket.js`, replace `generateBotResponse`:

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateBotResponse = async (userMessage, userName) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const prompt = `You are a helpful support assistant for a car marketplace. 
    User: ${userName}
    Message: ${userMessage}
    Respond helpfully:`;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
};
```

### Customize UI

Edit `components/SupportChatWidget.tsx`:
- Colors: Change gradient colors in button style
- Size: Adjust `width` and `height` in chatWindow style
- Position: Change `bottom` and `right` values

### Add Admin Dashboard

Create an admin view to see all chat sessions:

```typescript
// components/AdminChatDashboard.tsx
const AdminChatDashboard = () => {
  const [sessions, setSessions] = useState([]);
  
  useEffect(() => {
    fetch('/api/chat/sessions?status=active')
      .then(res => res.json())
      .then(data => setSessions(data.sessions));
  }, []);
  
  // Render sessions list...
};
```

## 📝 Notes

- WebSocket requires a persistent connection, which may not work with serverless functions
- For production, consider using a WebSocket service (Pusher, Ably) or a dedicated server
- Chat history is limited to 100 messages per session (configurable)
- Sessions expire after 30 days of inactivity (configurable)

## 🐛 Troubleshooting

### WebSocket not connecting
- Check CORS settings in `dev-api-server.js`
- Verify WebSocket server is running
- Check browser console for connection errors

### Messages not saving
- Verify MongoDB connection
- Check database logs
- Ensure `ensureConnection()` is called

### Chat widget not appearing
- Check browser console for errors
- Verify `portalTarget` is set (should be `document.body`)
- Check z-index conflicts

## 📚 Additional Resources

- [Socket.io Documentation](https://socket.io/docs/)
- [MongoDB Mongoose Guide](https://mongoosejs.com/docs/)
- [React Portals](https://react.dev/reference/react-dom/createPortal)





