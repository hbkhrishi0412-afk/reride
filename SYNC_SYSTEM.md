# MongoDB Sync System

## Overview

The application now includes a comprehensive sync system that ensures all messages and notifications are saved to MongoDB, with automatic retry logic for failed saves.

## How It Works

### 1. **Immediate Save Attempt**
When you send a message or create a notification:
- The data is **immediately saved to localStorage** (for offline support)
- The system **attempts to save to MongoDB immediately**
- The save operation is **awaited** to check if it succeeded

### 2. **Sync Queue for Failed Saves**
If the MongoDB save fails (network issue, server down, etc.):
- The data is added to a **sync queue** stored in localStorage
- The queue persists across page reloads
- Each item in the queue tracks:
  - The data to sync
  - Number of retry attempts
  - Timestamp when it was queued

### 3. **Automatic Retry Processing**
- **Every 30 seconds**, the system automatically processes the sync queue
- Failed saves are retried up to **3 times**
- If a retry succeeds, the item is removed from the queue
- If all retries fail, the item is removed but logged for debugging

### 4. **Console Logging**
You can see sync status in the browser console:
- `✅ Conversation synced to MongoDB:` - Immediate save succeeded
- `⏳ Conversation queued for sync (will retry):` - Added to queue for retry
- `🔄 Processing sync queue: X items pending` - Periodic sync running
- `✅ Successfully synced X items to MongoDB` - Items from queue synced

## When Sync Happens

### Immediate Sync (On Action)
- **Sending a message** → Tries to save conversation + message to MongoDB
- **Creating a notification** → Tries to save notification to MongoDB
- **Creating a new conversation** → Tries to save conversation to MongoDB

### Periodic Sync (Every 30 seconds)
- Processes the sync queue
- Retries failed saves
- Removes successfully synced items from the queue

## Verification

### Check Sync Status
1. Open browser console (F12)
2. Look for sync-related log messages
3. In development mode, you'll see toast notifications when items are synced

### Check Sync Queue
You can check the sync queue programmatically:
```javascript
// In browser console
const { getSyncQueueStatus } = require('./services/syncService');
console.log(getSyncQueueStatus());
```

## Benefits

1. **Reliability**: Data is never lost, even if MongoDB is temporarily unavailable
2. **Performance**: UI remains responsive - saves happen in background
3. **Offline Support**: Works offline, syncs when connection is restored
4. **Transparency**: Clear logging shows when sync happens

## Technical Details

### Files Involved
- `services/syncService.ts` - Core sync logic and queue management
- `services/conversationService.ts` - MongoDB conversation operations
- `services/notificationService.ts` - MongoDB notification operations
- `components/AppProvider.tsx` - Integration and periodic sync processor

### Queue Storage
- Queue is stored in localStorage with key: `reRideSyncQueue`
- Persists across page reloads
- Automatically cleaned up after successful sync

### Retry Logic
- Maximum 3 retry attempts per item
- Exponential backoff (via periodic processing)
- Items older than certain threshold can be manually cleared

