/**
 * contexts/ToastContext.tsx — Toast notification state management
 *
 * Manages toast messages (success, error, info, warning) with auto-dismiss
 * and duplicate suppression (same message within 3s).
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { Toast } from '../types';
import { logDebug, logError, logWarn } from '../utils/logger';

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

const AUTO_DISMISS_MS = 5000;
const DUPLICATE_WINDOW_MS = 3000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);
  const timestampsRef = useRef<Map<number, number>>(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => {
      const filtered = prev.filter((toast) => toast.id !== id);
      if (filtered.length < prev.length) {
        timestampsRef.current.delete(id);
      }
      return filtered;
    });
  }, []);

  const addToast = useCallback((message: string, type: Toast['type']) => {
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
      const now = Date.now();
      const id = counterRef.current;
      counterRef.current += 1;
      timestampsRef.current.set(id, now);

      setToasts((prev) => {
        const recentDuplicate = prev.find((toast) => {
          if (toast.message !== trimmedMessage || toast.type !== type) return false;
          const toastTimestamp = timestampsRef.current.get(toast.id);
          if (toastTimestamp === undefined) return false;
          return now - toastTimestamp < DUPLICATE_WINDOW_MS;
        });

        if (recentDuplicate) {
          logDebug('Skipping duplicate toast:', trimmedMessage);
          timestampsRef.current.delete(id);
          return prev;
        }

        const toastId = id;
        setTimeout(() => {
          setToasts((prevToasts) => {
            const filtered = prevToasts.filter((t) => t.id !== toastId);
            if (filtered.length < prevToasts.length) {
              timestampsRef.current.delete(toastId);
            }
            return filtered;
          });
        }, AUTO_DISMISS_MS);

        return [...prev, { id, message: trimmedMessage, type }];
      });
    } catch (error) {
      logError('Error adding toast:', error);
    }
  }, []);

  const value: ToastContextType = { toasts, setToasts, addToast, removeToast };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};
