/**
 * contexts/index.ts — Barrel exports for all context providers
 *
 * Import from here for clean imports:
 *   import { useAuth, useToast, useNavigation } from '../contexts';
 */

export { AuthProvider, useAuth } from './AuthContext';
export { ToastProvider, useToast } from './ToastContext';
export { NavigationProvider, useNavigation, pathToView, viewToPath } from './NavigationContext';

