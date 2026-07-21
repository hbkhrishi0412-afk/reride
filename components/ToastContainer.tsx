import React from 'react';
import Toast from './Toast.js';
import { useToast } from '../contexts/ToastContext.js';

/**
 * Reads toast state from ToastContext directly so toast updates do not
 * invalidate AppContext and re-render the entire tree.
 */
const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed z-toast inset-x-4 bottom-20 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto w-auto sm:max-w-sm space-y-2"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;
