/**
 * Runs before the Vite/React bundle so every fetch() hits https://www.reride.co.in for /api/*
 * (never apex reride.co.in). Apex redirects break CORS preflight (OPTIONS) in Android WebView
 * (https://appassets.androidplatform.net).
 */
(function () {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

  const API_ORIGIN = 'https://www.reride.co.in';

  function isAndroidAppAssetsHost(hostname) {
    if (!hostname) return false;
    var h = String(hostname).toLowerCase();
    return h === 'appassets.androidplatform.net' || h.endsWith('.appassets.androidplatform.net');
  }

  function isPackagedWebShell() {
    try {
      const h = (location.hostname || '').toLowerCase();
      const p = location.protocol;
      const port = location.port || '';
      const devPorts = { '5173': 1, '4173': 1, '3000': 1, '8080': 1 };
      if (isAndroidAppAssetsHost(h)) {
        return true;
      }
      try {
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
          return true;
        }
      } catch (e) {}
      const loopback = h === 'localhost' || h === '127.0.0.1';
      if (loopback && (p === 'https:' || p === 'http:') && !devPorts[port]) return true;
      if (h === 'localhost' && (p === 'capacitor:' || p === 'ionic:')) return true;
      return false;
    } catch (e2) {
      return false;
    }
  }

  function normalizeApex(u) {
    if (typeof u !== 'string') return u;
    return u.replace(/(https?:\/\/)reride\.co\.in(?=[:/?#]|$)/gi, '$1www.reride.co.in');
  }

  function resolveApiPath(path) {
    if (typeof path !== 'string' || path.indexOf('/api/') !== 0) return path;
    if (!isPackagedWebShell()) {
      if ((location.hostname || '').toLowerCase() === 'reride.co.in') return API_ORIGIN + path;
      return path;
    }
    return API_ORIGIN + path;
  }

  const nativeFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    try {
      if (typeof input === 'string') {
        let s = normalizeApex(input);
        if (s.indexOf('/api/') === 0) s = resolveApiPath(s);
        return nativeFetch(s, init);
      }
      if (typeof URL !== 'undefined' && input instanceof URL) {
        const uh = normalizeApex(input.href);
        return nativeFetch(uh !== input.href ? uh : input, init);
      }
      if (typeof Request !== 'undefined' && input instanceof Request) {
        const url = input.url;
        try {
          const parsed = new URL(url);
          const pathOnly = parsed.pathname + parsed.search + parsed.hash;
          if (parsed.pathname.indexOf('/api/') === 0) {
            const resolved = resolveApiPath(pathOnly);
            if (resolved.indexOf('http') === 0) {
              return nativeFetch(new Request(resolved, input), init);
            }
          }
          const n = normalizeApex(url);
          if (n !== url) return nativeFetch(new Request(n, input), init);
        } catch (e3) {
          if (typeof url === 'string' && url.indexOf('/api/') === 0) {
            const r = resolveApiPath(url);
            if (r.indexOf('http') === 0) return nativeFetch(new Request(r, input), init);
          }
        }
      }
    } catch (e4) {}
    return nativeFetch(input, init);
  };

  window.__RERIDE_FETCH_BOOT__ = true;
})();
