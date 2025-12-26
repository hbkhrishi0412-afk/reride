/**
 * React Hooks for Mobile Features
 */

import { useState, useEffect, useCallback } from 'react';
import {
  requestNotificationPermission,
  showNotification,
  subscribeToPushNotifications,
  getPushSubscription,
  unsubscribeFromPushNotifications,
  capturePhoto,
  capturePhotos,
  compressImage,
  getCurrentLocation,
  watchLocation,
  clearLocationWatch,
  setAppBadge,
  clearAppBadge,
  shareContent,
  shareVehicle,
  createDeepLink,
  parseDeepLink,
  onOnlineStatusChange,
  queueOfflineAction,
  type LocationCoordinates,
  type PushNotificationOptions,
  type CameraOptions,
  type ShareData
} from '../utils/mobileFeatures';

// ============================================
// PUSH NOTIFICATIONS HOOK
// ============================================

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    checkPermission();
    checkSubscription();
  }, []);

  const checkPermission = async () => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  };

  const checkSubscription = async () => {
    const sub = await getPushSubscription();
    setSubscription(sub);
    setIsSubscribed(!!sub);
  };

  const requestPermission = useCallback(async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    return perm;
  }, []);

  const subscribe = useCallback(async () => {
    const sub = await subscribeToPushNotifications();
    setSubscription(sub);
    setIsSubscribed(!!sub);
    return sub;
  }, []);

  const unsubscribe = useCallback(async () => {
    const success = await unsubscribeFromPushNotifications();
    if (success) {
      setSubscription(null);
      setIsSubscribed(false);
    }
    return success;
  }, []);

  const notify = useCallback(async (options: PushNotificationOptions) => {
    await showNotification(options);
  }, []);

  return {
    permission,
    subscription,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
    notify
  };
}

// ============================================
// CAMERA HOOK
// ============================================

export function useCamera() {
  const [isCapturing, setIsCapturing] = useState(false);

  const capture = useCallback(async (options: CameraOptions = {}) => {
    setIsCapturing(true);
    try {
      const photo = await capturePhoto(options);
      return photo;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const captureMultiple = useCallback(async (count: number = 5, options: CameraOptions = {}) => {
    setIsCapturing(true);
    try {
      const photos = await capturePhotos(count, options);
      return photos;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const compress = useCallback(async (
    dataUrl: string,
    maxWidth: number = 1920,
    maxHeight: number = 1920,
    quality: number = 0.8
  ) => {
    return compressImage(dataUrl, maxWidth, maxHeight, quality);
  }, []);

  return {
    isCapturing,
    capture,
    captureMultiple,
    compress
  };
}

// ============================================
// LOCATION HOOK
// ============================================

export function useLocation() {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  const getLocation = useCallback(async (enableHighAccuracy: boolean = true) => {
    setIsLoading(true);
    setError(null);
    try {
      const loc = await getCurrentLocation({ enableHighAccuracy });
      setLocation(loc);
      return loc;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to get location';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startWatching = useCallback((enableHighAccuracy: boolean = true) => {
    if (watchId !== null) {
      clearLocationWatch(watchId);
    }

    const id = watchLocation(
      (loc) => setLocation(loc),
      { enableHighAccuracy }
    );

    if (id !== null) {
      setWatchId(id);
    }
  }, [watchId]);

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      clearLocationWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        clearLocationWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    location,
    isLoading,
    error,
    getLocation,
    startWatching,
    stopWatching,
    isWatching: watchId !== null
  };
}

// ============================================
// APP BADGE HOOK
// ============================================

export function useAppBadge() {
  const [count, setCount] = useState<number>(0);

  const updateBadge = useCallback(async (newCount: number) => {
    if (newCount > 0) {
      await setAppBadge(newCount);
    } else {
      await clearAppBadge();
    }
    setCount(newCount);
  }, []);

  const clear = useCallback(async () => {
    await clearAppBadge();
    setCount(0);
  }, []);

  return {
    count,
    updateBadge,
    clear
  };
}

// ============================================
// SHARE HOOK
// ============================================

export function useShare() {
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(async (data: ShareData) => {
    setIsSharing(true);
    try {
      const success = await shareContent(data);
      return success;
    } finally {
      setIsSharing(false);
    }
  }, []);

  const shareVehicleListing = useCallback(async (vehicle: {
    id: number;
    make: string;
    model: string;
    year: number;
    price: number;
    images?: string[];
  }) => {
    setIsSharing(true);
    try {
      const success = await shareVehicle(vehicle);
      return success;
    } finally {
      setIsSharing(false);
    }
  }, []);

  return {
    isSharing,
    share,
    shareVehicleListing
  };
}

// ============================================
// DEEP LINKING HOOK
// ============================================

export function useDeepLinking() {
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const parsed = parseDeepLink();
    // Convert DeepLinkParams to Record<string, string> (URL params are always strings)
    const stringParams: Record<string, string> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (value !== undefined) {
        stringParams[key] = String(value);
      }
    });
    setParams(stringParams);
  }, []);

  const createLink = useCallback((params: Record<string, string | number>) => {
    return createDeepLink(params);
  }, []);

  const getParams = useCallback(() => {
    return parseDeepLink();
  }, []);

  return {
    params,
    createLink,
    getParams
  };
}

// ============================================
// OFFLINE MODE HOOK
// ============================================

export function useOfflineMode() {
  const [isOnline, setIsOnlineState] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOnlineState(online);
    });

    return unsubscribe;
  }, []);

  const queueAction = useCallback(async (action: {
    type: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  }) => {
    await queueOfflineAction(action);
    setPendingActions(prev => [...prev, action]);
  }, []);

  return {
    isOnline,
    pendingActions,
    queueAction
  };
}



