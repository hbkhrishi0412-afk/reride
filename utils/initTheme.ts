/**
 * ReRide ships a light UI (white cards / pages). Incomplete `dark:` variants
 * paint light text on those surfaces when `<html class="dark">` is set, so we
 * always force light — no theme toggle exists yet.
 */
export function initThemeFromPreference(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark');
  root.style.colorScheme = 'light';
  try {
    localStorage.setItem('reride-theme', 'light');
  } catch {
    /* private mode / quota — class removal above is enough */
  }
}
