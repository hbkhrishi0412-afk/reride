(function () {
  // Capacitor WebView: unregister stale service workers and clear caches.
  // The PWA service worker is disabled for Capacitor builds, but a previously
  // installed SW can persist across APK updates and serve stale chunks.
  try {
    var h0 = location.hostname;
    var p0 = location.protocol;
    var port0 = location.port || '';
    var devPorts0 = ['5173', '4173', '3000', '8080'];
    var isCap =
      (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
      h0 === 'appassets.androidplatform.net' ||
      (typeof h0 === 'string' && h0.endsWith('.appassets.androidplatform.net')) ||
      (h0 === 'localhost' && (p0 === 'capacitor:' || p0 === 'ionic:' || (p0 === 'https:' && devPorts0.indexOf(port0) === -1)));

    if (isCap && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        var hadSW = false;
        regs.forEach(function (r) { hadSW = true; r.unregister(); });
        if (typeof caches !== 'undefined' && caches.keys) {
          caches.keys().then(function (names) {
            names.forEach(function (n) { caches.delete(n); });
            if (hadSW) location.reload();
          });
        } else if (hadSW) {
          location.reload();
        }
      });
    }
  } catch (eSw) {}

  // OAuth PKCE verifier is stored per-origin. Never redirect apex->www on ?code= or ?error=.
  try {
    var h = (location.hostname || '').toLowerCase();
    if (h === 'reride.co.in') {
      var sp = new URLSearchParams(location.search || '');
      if (!sp.has('code') && !sp.has('error')) {
        var role = null;
        try {
          role = sessionStorage.getItem('reride_oauth_role') || localStorage.getItem('reride_oauth_role');
        } catch (e) {}
        var roleOk = { customer: 1, seller: 1, service_provider: 1, admin: 1 };
        if (role && roleOk[role] && !sp.has('_oa_role')) sp.set('_oa_role', role);
        var q = sp.toString();
        location.replace('https://www.reride.co.in' + location.pathname + (q ? '?' + q : '') + (location.hash || ''));
      }
    }
  } catch (e0) {}

  // Force apex host -> www in fetch requests (307 redirect avoidance for CORS preflight).
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      var downstream = window.fetch.bind(window);
      function apexToWww(str) {
        return str.replace(/(https?:\/\/)reride\.co\.in(?=[:/?#]|$)/gi, '$1www.reride.co.in');
      }
      window.fetch = function (input, init) {
        try {
          if (typeof input === 'string') return downstream(apexToWww(input), init);
          if (typeof URL !== 'undefined' && input instanceof URL) {
            var href = apexToWww(input.href);
            return downstream(href !== input.href ? href : input, init);
          }
          if (typeof Request !== 'undefined' && input instanceof Request) {
            var parsed = new URL(input.url);
            if (parsed.hostname === 'reride.co.in') {
              parsed.hostname = 'www.reride.co.in';
              return downstream(new Request(parsed.toString(), input), init);
            }
          }
        } catch (e1) {}
        return downstream(input, init);
      };
    }
  } catch (e2) {}

// Packaged Capacitor / WebView: use bundled fonts (same Poppins + Nunito Sans as website).
  try {
    var host = location.hostname;
    var protocol = location.protocol;
    var port = location.port || '';
    var devPorts = ['5173', '4173', '3000', '8080'];
    window.__RERIDE_SKIP_REMOTE_FONTS__ =
      host === 'appassets.androidplatform.net' ||
      (typeof host === 'string' && host.endsWith('.appassets.androidplatform.net')) ||
      (host === 'localhost' && (protocol === 'capacitor:' || protocol === 'ionic:')) ||
      (host === 'localhost' && protocol === 'https:' && devPorts.indexOf(port) === -1);
  } catch (e3) {}

  // Packaged WebView: force API + apex -> www before bundle loads.
  try {
    var h2 = (location.hostname || '').toLowerCase();
    var isAppAssets = h2 === 'appassets.androidplatform.net' || h2.endsWith('.appassets.androidplatform.net');
    if (isAppAssets && typeof window.fetch === 'function') {
      var base = 'https://www.reride.co.in';
      function normalizeApexStr(u) {
        if (typeof u !== 'string') return u;
        return u.replace(/(https?:\/\/)reride\.co\.in(?=[:/?#]|$)/gi, '$1www.reride.co.in');
      }
      var orig = window.fetch.bind(window);
      window.fetch = function (input, init) {
        try {
          if (typeof input === 'string') {
            var s = normalizeApexStr(input);
            if (s.indexOf('/api/') === 0) s = base + s;
            return orig(s, init);
          }
          if (typeof URL !== 'undefined' && input instanceof URL) {
            var uh = normalizeApexStr(input.href);
            return orig(uh !== input.href ? uh : input, init);
          }
          if (typeof Request !== 'undefined' && input instanceof Request) {
            var ru = input.url;
            var parsed2;
            try {
              parsed2 = new URL(ru);
            } catch (e4) {
              return orig(input, init);
            }
            if (parsed2.hostname === 'reride.co.in') {
              parsed2.hostname = 'www.reride.co.in';
              return orig(new Request(parsed2.toString(), input), init);
            }
            if (parsed2.pathname.indexOf('/api/') === 0) {
              var full = base + parsed2.pathname + parsed2.search + parsed2.hash;
              return orig(new Request(full, input), init);
            }
            var n = normalizeApexStr(ru);
            if (n !== ru) return orig(new Request(n, input), init);
          }
        } catch (e5) {}
        return orig(input, init);
      };
    }
  } catch (e6) {}

  // Fonts and DNS hints.
  try {
    if (window.__RERIDE_SKIP_REMOTE_FONTS__) {
      // Packaged Capacitor / WebView: load bundled Poppins + Nunito Sans (same as website).
      var bundledFonts = document.createElement('link');
      bundledFonts.id = 'reride-bundled-fonts';
      bundledFonts.rel = 'stylesheet';
      bundledFonts.href = './fonts/reride-fonts.css';
      document.head.appendChild(bundledFonts);
    } else {
      var p1 = document.createElement('link');
      p1.rel = 'preconnect';
      p1.href = 'https://fonts.googleapis.com';
      document.head.appendChild(p1);

      var p2 = document.createElement('link');
      p2.rel = 'preconnect';
      p2.href = 'https://fonts.gstatic.com';
      p2.crossOrigin = 'anonymous';
      document.head.appendChild(p2);

      var dns1 = document.createElement('link');
      dns1.rel = 'dns-prefetch';
      dns1.href = 'https://nominatim.openstreetmap.org';
      document.head.appendChild(dns1);

      var dns2 = document.createElement('link');
      dns2.rel = 'dns-prefetch';
      dns2.href = 'https://i.pravatar.cc';
      document.head.appendChild(dns2);

      var font = document.createElement('link');
      font.rel = 'preload';
      font.as = 'style';
      font.href =
        'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Nunito+Sans:wght@600;700;800&display=swap';
      font.onload = function () {
        this.onload = null;
        this.rel = 'stylesheet';
      };
      document.head.appendChild(font);
    }
  } catch (e7) {}

  // Polyfill process.emitWarning before module entry.
  try {
    if (typeof window !== 'undefined') {
      if (typeof process === 'undefined') window.process = { env: {} };
      if (!window.process.emitWarning) {
        window.process.emitWarning = function (msg) {
          if (typeof console !== 'undefined' && console.warn) console.warn('[process.emitWarning]', msg);
        };
      }
      if (typeof globalThis !== 'undefined') globalThis.process = window.process;
    }
  } catch (e8) {}

  // Start vehicle catalog fetch immediately (before React bundle) so first-time visitors
  // see listings faster. dataService consumes window.__RERIDE_EARLY_VEHICLES__ on init.
  try {
    var h3 = window.location.hostname || '';
    var hl = h3.toLowerCase();
    var isLocalhost = h3 === 'localhost' || h3 === '127.0.0.1' || h3.indexOf('localhost') !== -1;
    if (!isLocalhost) {
      var firstPageUrl = '/api/vehicles?limit=30&page=1&skipExpiryCheck=true';
      window.__RERIDE_EARLY_VEHICLES__ = fetch(firstPageUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'default',
      })
        .then(function (response) {
          if (!response.ok) return null;
          return response.json();
        })
        .catch(function () {
          return null;
        });
    }
  } catch (e9) {}

  // Viewport normalization and zoom reset.
  try {
    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.getElementsByTagName('head')[0].appendChild(viewport);
    }
    viewport.content =
      'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover, shrink-to-fit=no';

    if (document.documentElement) document.documentElement.style.zoom = '1';
    if (document.body) {
      document.body.style.zoom = '1';
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        if (document.body) document.body.style.zoom = '1';
      });
    }
    if (document.documentElement && 'textSizeAdjust' in document.documentElement.style) {
      document.documentElement.style.textSizeAdjust = '100%';
    }
  } catch (e10) {}
})();
