/**
 * Mobile Features Utilities
 * Provides hooks and utilities for native mobile features
 */

// ============================================
// PUSH NOTIFICATIONS
// ============================================

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

/**
 * Request push notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications are not supported in this browser');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Show a local notification
 */
export async function showNotification(options: PushNotificationOptions): Promise<void> {
  const permission = await requestNotificationPermission();
  
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        badge: options.badge || '/icon-192.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        vibrate: options.vibrate || [200, 100, 200],
        actions: options.actions
      });
    } catch (error) {
      console.error('Failed to show notification via service worker:', error);
      // Fallback to regular notification
      new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        tag: options.tag,
        data: options.data
      });
    }
  } else {
    // Fallback for browsers without service worker
    new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/icon-192.png',
      tag: options.tag,
      data: options.data
    });
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey())
    });

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

/**
 * Get current push subscription
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Failed to get push subscription:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const subscription = await getPushSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Get VAPID public key (should be in environment or config)
function getVapidPublicKey(): string {
  // TODO: Replace with actual VAPID public key from your push service
  // For now, return a placeholder
  return process.env.VITE_VAPID_PUBLIC_KEY || '';
}

// ============================================
// CAMERA INTEGRATION
// ============================================

export interface CameraOptions {
  quality?: number; // 0-1
  allowEdit?: boolean;
  sourceType?: 'camera' | 'library' | 'both';
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Capture photo from camera or select from library
 */
export async function capturePhoto(options: CameraOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = options.sourceType === 'camera' ? 'environment' : undefined;
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Capture multiple photos
 */
export async function capturePhotos(count: number = 5, options: CameraOptions = {}): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.capture = options.sourceType === 'camera' ? 'environment' : undefined;
    
    const photos: string[] = [];
    let loaded = 0;

    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files || files.length === 0) {
        resolve([]);
        return;
      }

      const fileArray = Array.from(files).slice(0, count);
      
      fileArray.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          photos.push(result);
          loaded++;
          if (loaded === fileArray.length) {
            resolve(photos);
          }
        };
        reader.onerror = () => {
          loaded++;
          if (loaded === fileArray.length) {
            resolve(photos);
          }
        };
        reader.readAsDataURL(file);
      });
    };

    input.oncancel = () => resolve([]);
    input.click();
  });
}

/**
 * Compress image
 */
export function compressImage(
  dataUrl: string,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// ============================================
// GPS/LOCATION SERVICES
// ============================================

export interface LocationCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Get current location with native GPS
 */
export async function getCurrentLocation(
  options: LocationOptions = {}
): Promise<LocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        resolve(null);
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 10000,
        maximumAge: options.maximumAge ?? 60000
      }
    );
  });
}

/**
 * Watch location changes
 */
export function watchLocation(
  callback: (location: LocationCoordinates) => void,
  options: LocationOptions = {}
): number | null {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported');
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude || undefined,
        altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
        heading: position.coords.heading || undefined,
        speed: position.coords.speed || undefined
      });
    },
    (error) => {
      console.error('Geolocation watch error:', error);
    },
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 60000
    }
  );

  return watchId;
}

/**
 * Stop watching location
 */
export function clearLocationWatch(watchId: number): void {
  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

// ============================================
// APP BADGE API
// ============================================

/**
 * Set app badge count
 */
export async function setAppBadge(count: number): Promise<void> {
  if ('setAppBadge' in navigator) {
    try {
      await (navigator as any).setAppBadge(count);
    } catch (error) {
      console.error('Failed to set app badge:', error);
    }
  }
}

/**
 * Clear app badge
 */
export async function clearAppBadge(): Promise<void> {
  if ('clearAppBadge' in navigator) {
    try {
      await (navigator as any).clearAppBadge();
    } catch (error) {
      console.error('Failed to clear app badge:', error);
    }
  }
}

// ============================================
// SHARE INTENT
// ============================================

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

/**
 * Share content using Web Share API
 */
export async function shareContent(data: ShareData): Promise<boolean> {
  if (!navigator.share) {
    console.warn('Web Share API is not supported');
    // Fallback: copy to clipboard
    if (data.text || data.url) {
      const text = `${data.title || ''}\n${data.text || ''}\n${data.url || ''}`.trim();
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  try {
    await navigator.share(data);
    return true;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // User cancelled share
      return false;
    }
    console.error('Failed to share:', error);
    return false;
  }
}

/**
 * Share vehicle listing
 */
export async function shareVehicle(vehicle: {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  images?: string[];
}): Promise<boolean> {
  const url = `${window.location.origin}/?view=detail&id=${vehicle.id}`;
  const text = `Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model} for ₹${vehicle.price.toLocaleString('en-IN')} on ReRide!`;
  
  return shareContent({
    title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    text: text,
    url: url
  });
}

// ============================================
// DEEP LINKING
// ============================================

export interface DeepLinkParams {
  view?: string;
  id?: string | number;
  [key: string]: string | number | undefined;
}

/**
 * Create deep link URL
 */
export function createDeepLink(params: DeepLinkParams): string {
  const url = new URL(window.location.origin);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  
  return url.toString();
}

/**
 * Parse deep link parameters from URL
 */
export function parseDeepLink(): DeepLinkParams {
  const params: DeepLinkParams = {};
  const searchParams = new URLSearchParams(window.location.search);
  
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return params;
}

/**
 * Handle deep link navigation
 */
export function handleDeepLink(
  params: DeepLinkParams,
  navigate: (view: string, options?: any) => void
): void {
  if (params.view) {
    navigate(params.view, params);
  }
}

// ============================================
// OFFLINE MODE
// ============================================

/**
 * Check if app is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Listen to online/offline events
 */
export function onOnlineStatusChange(
  callback: (isOnline: boolean) => void
): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Queue action for offline sync
 */
export async function queueOfflineAction(
  action: {
    type: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  }
): Promise<void> {
  if (isOnline()) {
    // Try to execute immediately
    try {
      await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body ? JSON.stringify(action.body) : undefined
      });
      return;
    } catch (error) {
      console.log('Online request failed, queuing for offline sync:', error);
    }
  }

  // Queue for background sync
  if ('serviceWorker' in navigator && 'sync' in (ServiceWorkerRegistration.prototype as any)) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const db = await openIndexedDB();
      const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await saveToIndexedDB(db, 'pendingActions', {
        id: actionId,
        ...action,
        timestamp: Date.now()
      });
      
      await (registration as any).sync.register('sync-vehicle-actions');
    } catch (error) {
      console.error('Failed to queue offline action:', error);
    }
  }
}

// IndexedDB helpers
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('reride-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id' });
      }
    };
  });
}

function saveToIndexedDB(db: IDBDatabase, storeName: string, data: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}


