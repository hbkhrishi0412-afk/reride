import React from 'react';
import Toast from './Toast.js';
import type { Toast as ToastType } from '../types.js';

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed z-toast inset-x-4 bottom-20 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto w-auto sm:max-w-sm space-y-2"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

export default ToastContainer;
