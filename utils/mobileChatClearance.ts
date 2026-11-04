import { View } from '../types.js';

/**
 * Bottom offset (px) for the floating chat control on the phone shell.
 * Detail uses the sticky contact bar (no tab bar); notifications have neither.
 */
export function mobileChatBottomClearancePx(
  isMobile: boolean,
  isMobileApp: boolean,
  currentView: View,
): number {
  if (!isMobile || !isMobileApp) return 0;
  if (currentView === View.DETAIL) return 88;
  if (currentView === View.NOTIFICATIONS_CENTER) return 0;
  return 56;
}
