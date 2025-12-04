import React, { useEffect, useState, useRef } from 'react';
import type { Toast as ToastType } from '../types';

interface ToastProps {
  toast: ToastType;
  onRemove: (id: number) => void;
}

const ICONS = {
    success: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    error: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    info: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    warning: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
    ),
};

const BG_COLORS = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-gradient-primary',
    warning: 'bg-yellow-500',
};

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);
    const removeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        autoDismissTimerRef.current = setTimeout(() => {
            handleClose();
        }, 4000); // Auto-dismiss after 4 seconds

        return () => {
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
            }
            if (removeTimeoutRef.current) {
                clearTimeout(removeTimeoutRef.current);
            }
        };
    }, []);

    const handleClose = () => {
        setIsExiting(true);
        // Clear any existing timeout before setting a new one
        if (removeTimeoutRef.current) {
            clearTimeout(removeTimeoutRef.current);
        }
        removeTimeoutRef.current = setTimeout(() => onRemove(toast.id), 500); // Wait for animation to finish
    };

    return (
        <div 
            role="alert"
            className={`flex items-center p-4 mb-4 text-white rounded-lg shadow-lg ${BG_COLORS[toast.type]} ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}`}
        >
            <div className="flex-shrink-0">{ICONS[toast.type]}</div>
            <div className="ml-3 text-sm font-medium">{toast.message}</div>
            <button
                type="button"
                className="ml-auto -mx-1.5 -my-1.5 p-1.5 inline-flex h-8 w-8 rounded-lg hover:bg-white/20 focus:ring-2 focus:ring-white/50"
                onClick={handleClose}
                aria-label="Close"
            >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
        </div>
    );
};

export default Toast;
