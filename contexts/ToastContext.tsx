/**
 * contexts/ToastContext.tsx — Toast notification state management
 *
 * Fast, deduplicated toasts with a capped stack (like Airbnb / Stripe patterns).
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { Toast } from '../types';
import { logDebug, logError, logWarn } from '../utils/logger';
import {
  DUPLICATE_WINDOW_MS,
  MAX_VISIBLE_TOASTS,
  TOAST_DURATION_MS,
  normalizeToastDedupeKey,
  type ToastKind,
} from '../utils/toastPolicy';

interface ToastContextType {
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);
  const dismissTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const recentKeysRef = useRef<Map<string, number>>(new Map());

  const clearDismissTimer = useCallback((id: number) => {
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback(
    (id: number) => {
      clearDismissTimer(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    },
    [clearDismissTimer],
  );

  const scheduleDismiss = useCallback(
    (id: number, type: ToastKind) => {
      clearDismissTimer(id);
      const timer = setTimeout(() => {
        dismissTimersRef.current.delete(id);
        removeToast(id);
      }, TOAST_DURATION_MS[type]);
      dismissTimersRef.current.set(id, timer);
    },
    [clearDismissTimer, removeToast],
  );

  const addToast = useCallback(
    (message: string, type: Toast['type']) => {
      try {
        if (!message || typeof message !== 'string' || message.trim() === '') {
          logWarn('Invalid toast message provided');
          return;
        }
        if (!['success', 'error', 'warning', 'info'].includes(type)) {
          logWarn('Invalid toast type provided:', type);
          return;
        }

        const trimmedMessage = message.trim();
        const toastType = type as ToastKind;
        const dedupeKey = normalizeToastDedupeKey(trimmedMessage, toastType);
        const now = Date.now();
        const lastShown = recentKeysRef.current.get(dedupeKey);
        if (lastShown !== undefined && now - lastShown < DUPLICATE_WINDOW_MS) {
          logDebug('Skipping duplicate toast:', trimmedMessage);
          return;
        }
        recentKeysRef.current.set(dedupeKey, now);

        // Prune stale dedupe keys
        if (recentKeysRef.current.size > 40) {
          for (const [key, ts] of recentKeysRef.current.entries()) {
            if (now - ts > DUPLICATE_WINDOW_MS * 4) {
              recentKeysRef.current.delete(key);
            }
          }
        }

        const id = counterRef.current;
        counterRef.current += 1;

        setToasts((prev) => {
          const next = [...prev, { id, message: trimmedMessage, type: toastType }];
          if (next.length > MAX_VISIBLE_TOASTS) {
            const overflow = next.length - MAX_VISIBLE_TOASTS;
            const dropped = next.slice(0, overflow);
            dropped.forEach((t) => clearDismissTimer(t.id));
            return next.slice(overflow);
          }
          return next;
        });

        scheduleDismiss(id, toastType);
      } catch (error) {
        logError('Error adding toast:', error);
      }
    },
    [clearDismissTimer, scheduleDismiss],
  );

  const value: ToastContextType = { toasts, setToasts, addToast, removeToast };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};
