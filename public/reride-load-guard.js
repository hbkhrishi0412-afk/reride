window.__RERIDE_ERRORS__ = [];

window.addEventListener('error', function (e) {
  var msg = (e.message || '') + ' at ' + (e.filename || '?') + ':' + (e.lineno || '?');
  window.__RERIDE_ERRORS__.push(msg);
  var src = (e.target && e.target.src) || '';
  if (e.target && e.target.tagName === 'SCRIPT' && isEntryScript(src)) {
    showLoadError('Script failed to load: ' + (src || 'unknown'));
  }
}, true);

window.addEventListener('unhandledrejection', function (e) {
  var reason = e.reason;
  var msg = (reason instanceof Error) ? reason.message + '\n' + (reason.stack || '') : String(reason);
  window.__RERIDE_ERRORS__.push('Promise: ' + msg);
});

function isEntryScript(src) {
  return src.indexOf('/index.tsx') !== -1
    || src.indexOf('/assets/index') !== -1
    || src.indexOf('./assets/index') !== -1;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showLoadError(detail) {
  if (window.__APP_SCRIPT_LOAD_FAILED__) return;
  window.__APP_SCRIPT_LOAD_FAILED__ = true;
  var root = document.getElementById('root');
  if (!root) return;
  var rawErrors = window.__RERIDE_ERRORS__ || [];
  var errors = rawErrors.map(escapeHtml).join('<br><br>');
  var extra = detail
    ? '<p class="reride-load-detail">' + escapeHtml(detail) + '</p>'
    : '';
  var errBlock = errors
    ? '<details class="reride-load-details"><summary>Error details</summary><pre>' + errors + '</pre></details>'
    : '';
  root.innerHTML =
    '<div class="reride-load-wrap"><div class="reride-load-card"><img src="/icon-192.png" alt="ReRide" /><h1>Something went wrong</h1><p>The app could not load. This is usually a network issue.</p><div class="reride-load-actions"><button type="button" id="reride-reload">Try Again</button><a href="https://status.reride.co.in">Check Status</a><a href="tel:+910000000000">Call Support</a></div>' +
    extra +
    errBlock +
    '</div></div>';
  var reload = document.getElementById('reride-reload');
  if (reload) reload.addEventListener('click', function () { window.location.reload(); });
}

function attachEntryScriptError() {
  var scriptEl = document.querySelector('script[src="/index.tsx"], script[src^="/assets/index"], script[src^="./assets/index"]');
  if (scriptEl && !scriptEl.__rerideEntryWatch) {
    scriptEl.__rerideEntryWatch = true;
    scriptEl.addEventListener('error', function () { showLoadError('Entry script load failed'); });
  }
}

attachEntryScriptError();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachEntryScriptError);
}

(function () {
  var timeoutId;
  var checkInterval;
  var reactMounted = false;
  var h = location.hostname;
  var p = location.protocol;
  var port = location.port || '';
  var devPorts = ['5173', '4173', '3000', '8080'];
  var isCapacitorLike =
    (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
    h === 'appassets.androidplatform.net' ||
    (typeof h === 'string' && h.endsWith('.appassets.androidplatform.net')) ||
    (h === 'localhost' && (p === 'capacitor:' || p === 'ionic:' || (p === 'https:' && devPorts.indexOf(port) === -1)));
  var TIMEOUT_MS = isCapacitorLike ? 60000 : 30000;

  var checkReactMounted = function () {
    if (window.__RERIDE_MOUNTED__) return true;
    var root = document.getElementById('root');
    if (!root) return false;
    if (!root.innerHTML.includes('Loading ReRide')) return true;
    return false;
  };

  var clearMountTimeout = function () {
    reactMounted = true;
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  };

  timeoutId = setTimeout(function () {
    if (!reactMounted) {
      var root = document.getElementById('root');
      if (root && !checkReactMounted()) {
        showLoadError('React did not mount within ' + (TIMEOUT_MS / 1000) + 's');
      }
    }
  }, TIMEOUT_MS);

  var startChecking = function () {
    checkInterval = setInterval(function () {
      if (checkReactMounted()) {
        clearMountTimeout();
      }
    }, 500);

    setTimeout(function () {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }, TIMEOUT_MS + 5000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startChecking);
  } else {
    startChecking();
  }
})();
