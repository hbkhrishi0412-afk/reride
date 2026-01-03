# Chat Box Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
npm install socket.io socket.io-client ws
```

### 2. Start the Server

```bash
# Terminal 1: Start API server with WebSocket
node dev-api-server.js

# Terminal 2: Start frontend
npm run dev
```

### 3. Test the Chat

1. Open `http://localhost:5173` in your browser
2. Look for the blue chat button in the bottom-right corner
3. Click it to open the chat widget
4. Send a message!

## 📁 Files Created

- ✅ `components/SupportChatWidget.tsx` - Frontend widget
- ✅ `lib/models/ChatMessage.ts` - Message model
- ✅ `lib/models/ChatSession.ts` - Session model  
- ✅ `api/chat.js` - REST API endpoints
- ✅ `api/chat-websocket.js` - WebSocket handler
- ✅ Integrated into `App.tsx`

## 🔧 Configuration

### Environment Variables

Add to `.env.local`:
```env
MONGODB_URI=your_mongodb_connection_string
```

### WebSocket URL

The widget automatically connects to:
- Development: `ws://localhost:3001/chat`
- Production: Update in `SupportChatWidget.tsx` line ~60

## 🎨 Customization

### Change Bot Responses

Edit `api/chat-websocket.js` - `generateBotResponse()` function

### Replace with AI

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateBotResponse = async (userMessage, userName) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(`User: ${userName}\nMessage: ${userMessage}\nRespond helpfully:`);
  return result.response.text();
};
```

## 🐛 Troubleshooting

**Chat button not appearing?**
- Check browser console for errors
- Verify `portalTarget` is set (should be `document.body`)
- Check z-index conflicts

**WebSocket not connecting?**
- Verify server is running on port 3001
- Check CORS settings
- Try REST API fallback (works without WebSocket)

**Messages not saving?**
- Verify MongoDB connection
- Check `MONGODB_URI` in `.env.local`
- Check server logs

## 📚 Full Documentation

See `CHAT_SETUP_GUIDE.md` for complete documentation.

## ✅ Features

- ✅ Floating chat button
- ✅ Real-time messaging (WebSocket)
- ✅ REST API fallback
- ✅ Chat history persistence
- ✅ Typing indicators
- ✅ Anonymous & authenticated users
- ✅ Responsive design
- ✅ Connection status

Enjoy your new chat widget! 🎉





