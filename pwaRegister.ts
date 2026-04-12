import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent('sw-update-available', {
        detail: {
          message: 'A new version is available.',
          action: () => window.location.reload(),
        },
      }),
    );
  },
});
