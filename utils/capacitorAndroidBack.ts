/**
 * Android hardware back: delegate to React navigation (goBack) when the app sets a handler.
 * Initialized from capacitorInit; handler registered from App when mounted.
 */
type BackHandler = () => void;

let handler: BackHandler | null = null;

export function setCapacitorAndroidBackHandler(fn: BackHandler | null): void {
  handler = fn;
}

let listenerInstalled = false;

export function initCapacitorAndroidBack(): void {
  if (typeof window === 'undefined' || listenerInstalled) return;
  listenerInstalled = true;

  void import('@capacitor/core')
    .then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return;
      }
      return import('@capacitor/app');
    })
    .then((appMod) => {
      if (!appMod) return;
      const { App } = appMod;
      void App.addListener('backButton', () => {
        if (handler) {
          handler();
          return;
        }
        void App.exitApp();
      });
    })
    .catch(() => {
      /* Capacitor not available */
    });
}
