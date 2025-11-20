import React from 'react';
import Toast from './Toast.js';
import type { Toast as ToastType } from '../types.js';

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-5 right-5 z-[100] w-full max-w-xs space-y-4">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

export default ToastContainer;
