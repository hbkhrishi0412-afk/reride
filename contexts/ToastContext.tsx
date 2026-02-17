/**
 * contexts/ToastContext.tsx — Toast notification state management
 *
 * Manages toast messages (success, error, info, warning) with auto-dismiss.
 *
 * Usage:
 *   const { addToast, removeToast, toasts } = useToast();
 *   addToast('Saved successfully', 'success');
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
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

  const addToast = useCallback((message: string, type: Toast['type']) => {
    counterRef.current += 1;
    const id = counterRef.current;

    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after timeout
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextType = { toasts, setToasts, addToast, removeToast };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

