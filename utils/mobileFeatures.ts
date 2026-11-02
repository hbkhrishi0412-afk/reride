import { logInfo } from '../utils/logger.js';
/**
 * Mobile Features Utilities
 * Provides hooks and utilities for native mobile features
 */

import { randomAlphanumeric } from './secureRandom.js';
import { getPublicWebOriginForShareLinks } from './apiConfig.js';

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
  if (typeof Notification === 'undefined' || !('Notification' in window)) {
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
 * `serviceWorker.ready` never settles when nothing is registered. Capacitor
 * skips the service worker, and Chromium still exposes the API, so waiting
 * here hangs in-app alerts. Prefer a registration (first visit before control)
 * over requiring controller.
 */
const SW_READY_MS = 1500;

function serviceWorkerApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

async function activeServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!serviceWorkerApiAvailable()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), SW_READY_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function showPageNotification(options: PushNotificationOptions): void {
  if (typeof Notification === 'undefined') return;
  new Notification(options.title, {
    body: options.body,
    icon: options.icon || '/icon-192.png',
    tag: options.tag,
    data: options.data,
  });
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

  const registration = await activeServiceWorker();
  if (registration) {
    try {
      const notificationOptions: NotificationOptions & { vibrate?: number[]; actions?: Array<{ action: string; title: string; icon?: string }> } = {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        badge: options.badge || '/icon-192.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false
      };
      // vibrate and actions are supported in service worker notifications but not in base NotificationOptions type
      if (options.vibrate) {
        notificationOptions.vibrate = options.vibrate;
      }
      if (options.actions) {
        notificationOptions.actions = options.actions;
      }
      await registration.showNotification(options.title, notificationOptions);
    } catch (error) {
      console.error('Failed to show notification via service worker:', error);
      showPageNotification(options);
    }
    return;
  }
  showPageNotification(options);
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!serviceWorkerApiAvailable() || !('PushManager' in window)) {
    console.warn('Push notifications are not supported');
    return null;
  }

  try {
    const registration = await activeServiceWorker();
    if (!registration) return null;
    const vapidKey = getVapidPublicKey();
    if (!vapidKey) {
      console.warn('VAPID public key not configured');
      return null;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
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
  if (!serviceWorkerApiAvailable() || !('PushManager' in window)) {
    return null;
  }

  try {
    const registration = await activeServiceWorker();
    if (!registration) return null;
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

// Get VAPID public key for web push (required for push notifications to work)
function getVapidPublicKey(): string {
  // Vite replaces `import.meta.env.VITE_*` at build time for browser bundles.
  // `process.env.VITE_*` is NOT replaced in client code and returns undefined.
  // Falling back to process.env keeps Node tooling / tests happy.
  const fromImportMeta =
    typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ? (import.meta as unknown as { env: Record<string, string | undefined> }).env
          .VITE_VAPID_PUBLIC_KEY
      : undefined;
  const fromProcessEnv =
    typeof process !== 'undefined' && process.env
      ? process.env.VITE_VAPID_PUBLIC_KEY
      : undefined;
  return (fromImportMeta || fromProcessEnv || '').trim();
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

async function webPathToDataUrl(webPath: string): Promise<string | null> {
  try {
    const response = await fetch(webPath);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function nativeCameraSource(sourceType?: CameraOptions['sourceType']) {
  if (sourceType === 'library') return 'Photos' as const;
  if (sourceType === 'camera') return 'Camera' as const;
  return 'Prompt' as const;
}

/**
 * Capture photo from camera or select from library
 */
export async function capturePhoto(options: CameraOptions = {}): Promise<string | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const sourceKey = nativeCameraSource(options.sourceType);
      const source =
        sourceKey === 'Photos'
          ? CameraSource.Photos
          : sourceKey === 'Camera'
            ? CameraSource.Camera
            : CameraSource.Prompt;
      const photo = await Camera.getPhoto({
        quality: Math.round((options.quality ?? 0.85) * 100),
        allowEditing: options.allowEdit ?? false,
        resultType: CameraResultType.Base64,
        source,
      });
      const base64 = photo.base64String;
      if (base64) {
        const mime = photo.format === 'jpeg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${base64}`;
      }
    }
  } catch (e) {
    console.warn('[ReRide] Native camera unavailable, using file picker:', e);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (options.sourceType === 'camera') {
      input.capture = 'environment';
    }
    
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
 * Capture multiple photos (native gallery picker on Capacitor, file input elsewhere).
 */
export async function capturePhotos(count: number = 5, options: CameraOptions = {}): Promise<string[]> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform() && options.sourceType !== 'camera') {
      const { Camera } = await import('@capacitor/camera');
      const { photos } = await Camera.pickImages({
        quality: Math.round((options.quality ?? 0.85) * 100),
        limit: Math.max(1, count),
      });
      const dataUrls: string[] = [];
      for (const photo of photos.slice(0, count)) {
        const path = photo.webPath || (photo.path ? Capacitor.convertFileSrc(photo.path) : '');
        if (!path) continue;
        const dataUrl = await webPathToDataUrl(path);
        if (dataUrl) dataUrls.push(dataUrl);
      }
      if (dataUrls.length > 0) return dataUrls;
    }
  } catch (e) {
    console.warn('[ReRide] Native pickImages unavailable, using file picker:', e);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    if (options.sourceType === 'camera') {
      input.capture = 'environment';
    }
    
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
 * Get current location with native GPS (Capacitor) or browser fallback.
 */
export async function getCurrentLocation(
  options: LocationOptions = {}
): Promise<LocationCoordinates | null> {
  try {
    const { getCurrentPositionUnified } = await import('./getCurrentPositionUnified.js');
    const position = await getCurrentPositionUnified();
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? undefined,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
    };
  } catch (error) {
    console.error('Geolocation error:', error);
    return null;
  }
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
  if (typeof navigator === 'undefined' || !navigator.share) {
    if (data.text || data.url) {
      const text = `${data.title || ''}\n${data.text || ''}\n${data.url || ''}`.trim();
      try { await navigator.clipboard?.writeText(text); } catch { /* clipboard unavailable */ }
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
  const origin = getPublicWebOriginForShareLinks();
  const url = `${origin}/?view=detail&id=${vehicle.id}`;
  const text = `Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model} for ₹${vehicle.price.toLocaleString('en-IN')} on ReRide!`;
  
  return shareContent({
    title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    text,
    url
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
  const url = new URL(getPublicWebOriginForShareLinks());
  
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
function assignSearchParams(params: DeepLinkParams, search: string): void {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (!query) return;
  new URLSearchParams(query).forEach((value, key) => {
    params[key] = value;
  });
}

/**
 * Query params from the real URL and from the hash.
 * Capacitor uses HashRouter, so `/?view=detail&id=` arrives as `#/?view=detail&id=`
 * and `window.location.search` is empty.
 */
export function parseDeepLink(): DeepLinkParams {
  const params: DeepLinkParams = {};
  if (typeof window === 'undefined') return params;
  assignSearchParams(params, window.location.search);
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const q = hash.indexOf('?');
  if (q >= 0) assignSearchParams(params, hash.slice(q + 1));
  return params;
}

const CONSUMED_DEEP_LINK_KEYS = ['view', 'id'] as const;

function stripKeysFromSearch(search: string, keys: readonly string[]): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (!query) return '';
  const params = new URLSearchParams(query);
  let changed = false;
  for (const key of keys) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (!changed) return search.startsWith('?') ? search : search ? `?${search}` : '';
  const next = params.toString();
  return next ? `?${next}` : '';
}

/**
 * Drop legacy `view` / `id` query keys from document search and the hash query
 * so a later catalog refresh cannot re-apply the same deep link.
 */
export function consumeDeepLinkParams(keys: readonly string[] = CONSUMED_DEEP_LINK_KEYS): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const nextSearch = stripKeysFromSearch(url.search, keys);
    const hashBody = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const q = hashBody.indexOf('?');
    let nextHash = url.hash;
    if (q >= 0) {
      const pathPart = hashBody.slice(0, q);
      const stripped = stripKeysFromSearch(hashBody.slice(q), keys);
      nextHash = `#${pathPart}${stripped}`;
    }
    if (nextSearch === url.search && nextHash === url.hash) return;
    url.search = nextSearch;
    url.hash = nextHash;
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

const PENDING_DEEP_LINK_VEHICLE_KEY = 'reride_pending_deeplink_vehicle';

/** Stash listing id while URL `view`/`id` are stripped and the catalog loads. */
export function setPendingDeepLinkVehicleId(id: number | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (id == null) sessionStorage.removeItem(PENDING_DEEP_LINK_VEHICLE_KEY);
    else sessionStorage.setItem(PENDING_DEEP_LINK_VEHICLE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export function getPendingDeepLinkVehicleId(): number | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_DEEP_LINK_VEHICLE_KEY);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Share links use `view=detail`; the View enum value is `DETAIL`. */
export function matchDeepLinkView<T extends string>(
  raw: string | undefined,
  views: readonly T[],
): T | undefined {
  if (!raw) return undefined;
  const needle = raw.toLowerCase();
  return views.find((v) => String(v).toLowerCase() === needle);
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
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
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
      logInfo('Online request failed, queuing for offline sync:', error);
    }
  }

  // Always persist; background sync is best-effort once a worker exists.
  try {
    const db = await openIndexedDB();
    const actionId = `action_${Date.now()}_${randomAlphanumeric(9)}`;
    await saveToIndexedDB(db, 'pendingActions', {
      id: actionId,
      ...action,
      timestamp: Date.now(),
    });

    if ('sync' in (ServiceWorkerRegistration.prototype as any)) {
      const registration = await activeServiceWorker();
      if (registration) {
        await (registration as any).sync.register('sync-vehicle-actions');
      }
    }
  } catch (error) {
    console.error('Failed to queue offline action:', error);
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



