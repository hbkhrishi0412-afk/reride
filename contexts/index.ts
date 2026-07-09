/**
 * contexts/index.ts — Barrel exports for all context providers
 *
 * Import from here for clean imports:
 *   import { useAuth, useToast } from '../contexts';
 */

export { AuthProvider, useAuth } from './AuthContext';
export { ToastProvider, useToast } from './ToastContext';
export { CatalogProvider, useCatalog } from './CatalogContext';
export { ChatProvider, useChat } from './ChatContext';

