/**
 * contexts/ToastContext.tsx — Toast notification state management
 *
 * Manages toast messages (success, error, info, warning) with auto-dismiss.
 *
 * Usage:
 *   const { addToast, removeToast, toasts } = useToast();
 *   addToast('Saved successfully', 'success');
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Toast } from '../types';

// ── Context type ────────────────────────────────────────────────────────────

interface ToastContextType {
  toasts: Toast[];
  setToasts: (toasts: Toast[]) => void;
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 5000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    counterRef.current += 1;
    const id = counterRef.current;

    setToasts((prev) => [...prev, { id, message, type }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
  }, []);

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextType = { toasts, setToasts, addToast, removeToast };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

