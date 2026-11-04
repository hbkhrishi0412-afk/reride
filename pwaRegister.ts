import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Toast-only updates left buyers on a stale VDP shell (disclosure stuck in Overview).
    // Reload as soon as the new SW is ready so hashed chunks (Seller Disclosure tab) load.
    void updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Hourly + on tab focus: otherwise a long-lived VDP tab never picks up deploys.
    const check = () => {
      void registration.update();
    };
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  },
});
