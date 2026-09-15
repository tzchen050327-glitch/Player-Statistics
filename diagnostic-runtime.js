// Site-wide runtime diagnostics recorder.
// PWA controller handoff is interpreted separately by diagnostics.html to avoid transient false warnings.
(() => {
  'use strict';

  const FLAG = '__baseballSiteDiagnosticsInstalledV1';
  const STORAGE_KEY = 'baseball-site-diagnostics-runtime-v1';
  const MAX_ENTRIES = 120;
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  if (window[FLAG]) return;
  window[FLAG] = true;

  function cleanUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      return `${url.origin}${url.pathname}`;
    } catch {
      return String(value || '').slice(0, 300);
    }
  }

  function safeText(value) {
    if (value == null) return '';
    if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`.slice(0, 2000);
    if (typeof value === 'string') return value.slice(0, 2000);
    try { return JSON.stringify(value).slice(0, 2000); } catch { return String(value).slice(0, 2000); }
  }

  function readEntries() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeEntries(entries) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  }

  function log(kind, detail = {}, level = 'error') {
    const now = Date.now();
    const entry = {
      at: now,
      level: level === 'warning' ? 'warning' : 'error',
      kind: String(kind || 'unknown').slice(0, 80),
      page: `${location.pathname}${location.search}`.slice(0, 500),
      message: safeText(detail.message || detail.error || ''),
      url: cleanUrl(detail.url || detail.source || ''),
      status: Number(detail.status) || 0,
      method: String(detail.method || '').slice(0, 16),
      line: Number(detail.line) || 0,
      column: Number(detail.column) || 0,
      durationMs: Number(detail.durationMs) || 0,
      extra: safeText(detail.extra || '')
    };
    let entries = readEntries().filter(item => now - Number(item?.at || 0) <= MAX_AGE_MS);
    const duplicate = entries[entries.length - 1];
    if (duplicate && now - Number(duplicate.at || 0) < 10000 && duplicate.kind === entry.kind && duplicate.message === entry.message && duplicate.url === entry.url) {
      duplicate.at = now;
      duplicate.count = Number(duplicate.count || 1) + 1;
    } else {
      entries.push(entry);
    }
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    writeEntries(entries);
  }

  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      log('resource-load-error', {
        message: `${target.tagName || 'RESOURCE'} 載入失敗`,
        url: target.src || target.href,
        extra: target.rel || target.type || ''
      });
      return;
    }
    log('javascript-error', {
      message: event.message || event.error || 'JavaScript error',
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      extra: event.error?.stack || ''
    });
  }, true);

  window.addEventListener('unhandledrejection', event => {
    log('unhandled-rejection', { message: event.reason || 'Unhandled promise rejection' });
  });

  window.addEventListener('securitypolicyviolation', event => {
    log('security-policy-violation', {
      message: `${event.violatedDirective || 'CSP'}：${event.blockedURI || ''}`,
      url: event.blockedURI,
      extra: event.originalPolicy || ''
    });
  });

  window.addEventListener('offline', () => log('browser-offline', { message: '瀏覽器進入離線狀態' }, 'warning'));

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
      const method = String(init.method || input?.method || 'GET').toUpperCase();
      const started = performance.now();
      try {
        const response = await originalFetch(...args);
        const durationMs = Math.round(performance.now() - started);
        const localAsset = (() => {
          try {
            const u = new URL(url, location.href);
            return u.origin === location.origin && /\.(?:js|css|html|json|webmanifest)$/i.test(u.pathname);
          } catch { return false; }
        })();
        if (response.status >= 500 || (localAsset && response.status >= 400)) {
          log('fetch-http-error', { message: `HTTP ${response.status}`, url, method, status: response.status, durationMs });
        }
        return response;
      } catch (error) {
        log('fetch-network-error', {
          message: error,
          url,
          method,
          durationMs: Math.round(performance.now() - started)
        });
        throw error;
      }
    };
  }

  window.__siteDiagnostics = {
    storageKey: STORAGE_KEY,
    read: readEntries,
    clear() { try { localStorage.removeItem(STORAGE_KEY); } catch {} },
    log
  };
})();
