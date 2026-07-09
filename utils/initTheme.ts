/**
 * Apply Tailwind `dark` class from saved preference or system setting.
 */
export function initThemeFromPreference(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const stored = localStorage.getItem('reride-theme');
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = stored === 'dark' || (stored !== 'light' && prefersDark);
  root.classList.toggle('dark', useDark);
}
