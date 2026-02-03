# Chat Troubleshooting Guide

## Quick Checks

### 1. Is the API Server Running?
```bash
# Terminal 1 - Start API server
npm run dev:api

# Should see:
# Server running on http://localhost:3001
# 🔌 Socket.io server ready
```

### 2. Check Browser Console
Open browser DevTools (F12) and look for:
- ✅ `Real-time chat service connected successfully` - Connection OK
- ❌ `Failed to connect to real-time chat service` - Connection failed
- ❌ `WebSocket not connected, queueing message` - Not connected when sending

### 3. Check Backend Console (Terminal 1)
Look for:
- `🔌 Client connected: <socketId> (<email>, <role>)` - User connected
- `📨 Received message from client` - Message received
- `📤 Broadcasting to room` - Message being broadcast
- `✅ Message broadcasted to room` - Message sent

## Common Issues

### Issue 1: "WebSocket not connected"
**Symptoms:** Messages show "sending" status but never deliver

**Fix:**
1. Check if API server is running: `npm run dev:api`
2. Check browser console for connection errors
3. Verify WebSocket URL: Should be `ws://localhost:3001` (or `wss://` for HTTPS)

### Issue 2: "Room size is 0"
**Symptoms:** Backend shows "Broadcasting to room (0 clients)"

**Fix:**
1. Check if seller joined the room - Look for "joined conversation" in backend logs
2. Verify both users are connected - Check "Client connected" logs
3. Check email matching - Seller email must match conversation.sellerId

### Issue 3: Messages not appearing
**Symptoms:** Message sent but recipient doesn't see it

**Fix:**
1. Check if message was received by backend - Look for "Received message from client"
2. Check if message was broadcast - Look for "Broadcasting to room"
3. Check recipient's browser console - Look for "Received real-time message"
4. Verify recipient is in the conversation room

## Debug Steps

### Step 1: Verify Connection
```javascript
// In browser console:
window.realtimeChatService?.isConnected()
// Should return: true
```

### Step 2: Check Room Membership
Look in backend logs for:
```
🔧 Socket <id> joined conversation: <conversationId>
```

### Step 3: Test Message Flow
1. Customer sends message
2. Check backend: Should see "Received message from client"
3. Check backend: Should see "Broadcasting to room (X clients)" where X > 0
4. Check seller's browser: Should see "Received real-time message"

## Expected Console Output

### When Customer Sends Message:
**Customer Browser:**
```
🔧 AppProvider: Sending message via realtimeChatService
🔧 Sending message via WebSocket
✅ Message emitted to WebSocket
✅ Message sent successfully via real-time service
```

**Backend (Terminal 1):**
```
📨 Received message from client: { conversationId: '...', messageId: ... }
✅ Processing message: { conversationId: '...', messageId: ... }
📤 Broadcasting to room "conversation:..." (2 clients)
✅ Message broadcasted to room
```

**Seller Browser:**
```
📨 AppProvider: Received real-time message: { conversationId: '...', messageId: ... }
```

## Still Not Working?

1. **Check Network Tab:** Look for WebSocket connection to `localhost:3001`
2. **Check Backend Logs:** Ensure server is receiving connections
3. **Check Room Size:** Should be > 0 when broadcasting
4. **Verify Emails:** Customer and seller emails must match conversation participants
5. **Restart Servers:** Sometimes a restart fixes connection issues


