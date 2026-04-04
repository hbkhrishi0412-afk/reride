/**
 * Scroll the visible app viewport to the top.
 * Capacitor / MobileLayout uses `#mobile-app-scroll-root`; desktop uses `window`.
 */
export function scrollAppToTop(): void {
  if (typeof window === 'undefined') return;
  try {
    const root = document.getElementById('mobile-app-scroll-root');
    if (root) root.scrollTop = 0;
  } catch {
    /* ignore */
  }
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch {
    window.scrollTo(0, 0);
  }
  try {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } catch {
    /* ignore */
  }
}
