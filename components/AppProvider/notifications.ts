/**
 * Phase-2 split target: move notification state out of AppProviderCore.
 * Today AppProvider still calls useNotificationRuntime directly; child trees can
 * use NotificationProvider + useNotifications() where a smaller boundary helps.
 */
export { NotificationProvider, NotificationContextBridge, useNotifications } from '../../contexts/NotificationContext';
