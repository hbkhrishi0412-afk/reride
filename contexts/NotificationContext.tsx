/**
 * Notification list state — extracted from AppProvider for smaller re-render surface.
 */
import React, { createContext, useContext } from 'react';
import type { Notification } from '../types';
import { useNotificationRuntime } from '../hooks/useNotificationRuntime';

type NotificationContextType = {
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}

type NotificationProviderProps = {
  children: React.ReactNode;
  userEmail?: string;
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  userEmail,
}) => {
  const { notifications, setNotifications } = useNotificationRuntime(userEmail);

  return (
    <NotificationContext.Provider value={{ notifications, setNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

/** Bridge existing notification state into context (AppProvider phase-1 split). */
export const NotificationContextBridge: React.FC<{
  children: React.ReactNode;
  value: NotificationContextType;
}> = ({ children, value }) => (
  <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
);
