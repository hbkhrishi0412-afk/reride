/**
 * Runs before the Vite/React bundle so every fetch() hits https://www.reride.co.in for /api/*
 * (never apex reride.co.in). Apex redirects break CORS preflight (OPTIONS) in Android WebView
 * (https://appassets.androidplatform.net).
 */
(function () {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

  var API_ORIGIN = 'https://www.reride.co.in';

  function isPackagedWebShell() {
    try {
      var h = (location.hostname || '').toLowerCase();
      var p = location.protocol;
      var port = location.port || '';
      var devPorts = { '5173': 1, '4173': 1, '3000': 1, '8080': 1 };
      if (h === 'appassets.androidplatform.net' || h.indexOf('appassets.androidplatform.net') !== -1) {
        return true;
      }
      try {
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
          return true;
        }
      } catch (e) {}
      var loopback = h === 'localhost' || h === '127.0.0.1';
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

  var nativeFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    try {
      if (typeof input === 'string') {
        var s = normalizeApex(input);
        if (s.indexOf('/api/') === 0) s = resolveApiPath(s);
        return nativeFetch(s, init);
      }
      if (typeof URL !== 'undefined' && input instanceof URL) {
        var uh = normalizeApex(input.href);
        return nativeFetch(uh !== input.href ? uh : input, init);
      }
      if (typeof Request !== 'undefined' && input instanceof Request) {
        var url = input.url;
        try {
          var parsed = new URL(url);
          var pathOnly = parsed.pathname + parsed.search + parsed.hash;
          if (parsed.pathname.indexOf('/api/') === 0) {
            var resolved = resolveApiPath(pathOnly);
            if (resolved.indexOf('http') === 0) {
              return nativeFetch(new Request(resolved, input), init);
            }
          }
          var n = normalizeApex(url);
          if (n !== url) return nativeFetch(new Request(n, input), init);
        } catch (e3) {
          if (typeof url === 'string' && url.indexOf('/api/') === 0) {
            var r = resolveApiPath(url);
            if (r.indexOf('http') === 0) return nativeFetch(new Request(r, input), init);
          }
        }
      }
    } catch (e4) {}
    return nativeFetch(input, init);
  };

  window.__RERIDE_FETCH_BOOT__ = true;
})();
