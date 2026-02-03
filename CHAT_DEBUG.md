# Real-Time Chat Debugging Guide

## Issues Fixed

1. **Sellers not joining conversation rooms** - Fixed by auto-joining all conversation rooms when user connects
2. **Scope issues in joinAllConversations** - Fixed by using currentUser directly instead of stale variables
3. **Connection timing** - Added delay to ensure connection is established before joining rooms
4. **Backend fallback** - Enhanced fallback mechanism to ensure message delivery even if room joining fails

## How to Test

### 1. Start the Development Server
```bash
npm run dev:api  # Terminal 1 - Start API server on port 3001
npm run dev      # Terminal 2 - Start frontend on port 5173
```

### 2. Check WebSocket Connection
Open browser console and look for:
- `🔧 Real-time chat connected` - Connection successful
- `🔧 Joined conversation room: <conversationId>` - Room joining successful
- `⚠️ Cannot join conversations - WebSocket not connected` - Connection issue

### 3. Test Message Flow

**As Customer:**
1. Login as customer
2. Open a vehicle detail page
3. Click "Chat with Seller"
4. Send a message
5. Check console for: `🔧 sendMessage called`

**As Seller:**
1. Login as seller in another browser/incognito
2. Go to Dashboard > Inquiries
3. Check console for: `🔧 Joined conversation room: <conversationId>`
4. When customer sends message, you should see: `🔧 Received real-time message`

### 4. Backend Logs (Terminal 1)
Look for:
- `🔌 Client connected: <socketId> (<email>, <role>)` - User connected
- `🔧 Socket <socketId> joined conversation: <conversationId>` - Room joined
- `🔧 Broadcasting to room "conversation:<id>" (<count> clients)` - Message broadcast
- `🔧 Real-time message broadcast: { conversationId, messageId }` - Message sent

### 5. Common Issues

**Messages not delivered:**
- Check if both users are connected: Look for "Client connected" in backend logs
- Check if seller joined the room: Look for "joined conversation" in backend logs
- Check room size: Should show > 0 clients in "Broadcasting to room" log

**Connection fails:**
- Ensure API server is running on port 3001
- Check browser console for connection errors
- Verify WebSocket URL is correct (ws://localhost:3001)

**Room joining fails:**
- Check if conversations are loaded before joining
- Verify user email matches conversation participant
- Check for scope issues in joinAllConversations function

## Debug Commands

### Check WebSocket Connection Status
In browser console:
```javascript
// Check if connected
window.realtimeChatService?.isConnected()

// Check socket ID
window.realtimeChatService?.socket?.id
```

### Force Reconnect
```javascript
window.realtimeChatService?.disconnect()
window.realtimeChatService?.connect('user@example.com', 'customer')
```

### Check Room Membership
In backend logs, look for:
- `🔧 Socket <id> joined conversation: <convId>`
- Room size in broadcast logs

## Expected Behavior

1. **On Login:**
   - User connects to WebSocket
   - User joins all their conversation rooms
   - Console shows: "Joined conversation room" for each conversation

2. **On Message Send:**
   - Message saved to Supabase
   - Message sent via WebSocket
   - Backend broadcasts to room
   - Recipient receives message instantly

3. **On Message Receive:**
   - WebSocket receives message
   - Conversation state updates
   - UI updates automatically
   - Message appears in chat widget

## Troubleshooting

If messages still don't work:

1. **Check WebSocket connection:**
   - Open browser DevTools > Network > WS
   - Look for WebSocket connection to localhost:3001
   - Status should be "101 Switching Protocols"

2. **Check room membership:**
   - Backend logs should show room size > 0
   - If room size is 0, seller hasn't joined the room

3. **Check message flow:**
   - Customer sends → Backend receives → Backend broadcasts → Seller receives
   - Each step should have a console log

4. **Verify conversation data:**
   - Check if conversationId matches
   - Check if sellerId/customerId match user emails
   - Check email normalization (lowercase, trimmed)


