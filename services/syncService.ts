import type { Conversation, Notification } from '../types';
import { saveConversationToMongoDB, addMessageToConversation } from './conversationService';
import { saveNotificationToMongoDB, updateNotificationInMongoDB } from './notificationService';

interface SyncQueueItem {
  id: string;
  type: 'conversation' | 'notification' | 'message';
  data: any;
  retries: number;
  timestamp: number;
}

const SYNC_QUEUE_KEY = 'reRideSyncQueue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Get sync queue from localStorage
 */
function getSyncQueue(): SyncQueueItem[] {
  try {
    const queueJson = localStorage.getItem(SYNC_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch {
    return [];
  }
}

/**
 * Save sync queue to localStorage
 */
function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to save sync queue:', error);
  }
}

/**
 * Add item to sync queue
 */
function addToSyncQueue(item: Omit<SyncQueueItem, 'retries' | 'timestamp'>): void {
  const queue = getSyncQueue();
  queue.push({
    ...item,
    retries: 0,
    timestamp: Date.now()
  });
  saveSyncQueue(queue);
}

/**
 * Remove item from sync queue
 */
function removeFromSyncQueue(itemId: string): void {
  const queue = getSyncQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  saveSyncQueue(filtered);
}

/**
 * Process sync queue - retry failed syncs
 */
export async function processSyncQueue(): Promise<{ success: number; failed: number }> {
  const queue = getSyncQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;
  const toRemove: string[] = [];
  const toRetry: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      let syncSuccess = false;

      switch (item.type) {
        case 'conversation':
          const convResult = await saveConversationToMongoDB(item.data);
          syncSuccess = convResult.success;
          break;
        case 'message':
          const msgResult = await addMessageToConversation(item.data.conversationId, item.data.message);
          syncSuccess = msgResult.success;
          break;
        case 'notification':
          if (item.data.updates) {
            // Update notification
            const updateResult = await updateNotificationInMongoDB(item.data.notificationId, item.data.updates);
            syncSuccess = updateResult.success;
          } else {
            // Create notification
            const notifResult = await saveNotificationToMongoDB(item.data);
            syncSuccess = notifResult.success;
          }
          break;
      }

      if (syncSuccess) {
        success++;
        toRemove.push(item.id);
        console.log(`✅ Successfully synced ${item.type}:`, item.id);
      } else {
        // Retry logic
        if (item.retries < MAX_RETRIES) {
          item.retries++;
          toRetry.push(item);
          console.log(`⚠️ Retrying sync for ${item.type} (attempt ${item.retries}/${MAX_RETRIES}):`, item.id);
        } else {
          failed++;
          toRemove.push(item.id);
          console.error(`❌ Failed to sync ${item.type} after ${MAX_RETRIES} retries:`, item.id);
        }
      }
    } catch (error) {
      console.error(`Error processing sync queue item:`, error);
      if (item.retries < MAX_RETRIES) {
        item.retries++;
        toRetry.push(item);
      } else {
        failed++;
        toRemove.push(item.id);
      }
    }
  }

  // Update queue
  let updatedQueue = getSyncQueue();
  updatedQueue = updatedQueue.filter(item => !toRemove.includes(item.id));
  // Update retry counts
  toRetry.forEach(retryItem => {
    const index = updatedQueue.findIndex(item => item.id === retryItem.id);
    if (index !== -1) {
      updatedQueue[index] = retryItem;
    }
  });
  saveSyncQueue(updatedQueue);

  return { success, failed };
}

/**
 * Save conversation with sync queue fallback
 */
export async function saveConversationWithSync(conversation: Conversation): Promise<{ synced: boolean; queued: boolean }> {
  try {
    const result = await saveConversationToMongoDB(conversation);
    if (result.success) {
      return { synced: true, queued: false };
    }
  } catch (error) {
    console.warn('Failed to save conversation to MongoDB:', error);
  }

  // Add to sync queue
  addToSyncQueue({
    id: `conv_${conversation.id}_${Date.now()}`,
    type: 'conversation',
    data: conversation
  });

  return { synced: false, queued: true };
}

/**
 * Add message with sync queue fallback
 */
export async function addMessageWithSync(conversationId: string, message: any): Promise<{ synced: boolean; queued: boolean }> {
  try {
    const result = await addMessageToConversation(conversationId, message);
    if (result.success) {
      return { synced: true, queued: false };
    }
  } catch (error) {
    console.warn('Failed to add message to MongoDB:', error);
  }

  // Add to sync queue
  addToSyncQueue({
    id: `msg_${conversationId}_${message.id}_${Date.now()}`,
    type: 'message',
    data: { conversationId, message }
  });

  return { synced: false, queued: true };
}

/**
 * Save notification with sync queue fallback
 */
export async function saveNotificationWithSync(notification: Notification): Promise<{ synced: boolean; queued: boolean }> {
  try {
    const result = await saveNotificationToMongoDB(notification);
    if (result.success) {
      return { synced: true, queued: false };
    }
  } catch (error) {
    console.warn('Failed to save notification to MongoDB:', error);
  }

  // Add to sync queue
  addToSyncQueue({
    id: `notif_${notification.id}_${Date.now()}`,
    type: 'notification',
    data: notification
  });

  return { synced: false, queued: true };
}

/**
 * Update notification with sync queue fallback
 */
export async function updateNotificationWithSync(notificationId: number, updates: Partial<Notification>): Promise<{ synced: boolean; queued: boolean }> {
  try {
    const result = await updateNotificationInMongoDB(notificationId, updates);
    if (result.success) {
      return { synced: true, queued: false };
    }
  } catch (error) {
    console.warn('Failed to update notification in MongoDB:', error);
  }

  // Add to sync queue
  addToSyncQueue({
    id: `notif_update_${notificationId}_${Date.now()}`,
    type: 'notification',
    data: { notificationId, updates }
  });

  return { synced: false, queued: true };
}

/**
 * Get sync queue status
 */
export function getSyncQueueStatus(): { pending: number; items: SyncQueueItem[] } {
  const queue = getSyncQueue();
  return {
    pending: queue.length,
    items: queue
  };
}

/**
 * Clear sync queue (for admin/testing)
 */
export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}
