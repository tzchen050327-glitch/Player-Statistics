const CACHE_NAME = 'baseball-player-card-pwa-v430-auto';
const CACHE_VERSION = 'v4.30';
// Runtime and app-shell versions are kept in lockstep by auto-version-bump.yml.
const MODULE_ORDER_URL = './js/module-order.txt';
const APP_SHELL = [
  './',
  './index.html',
  './diagnostics.html',
  './styles.css?v=v4.30',
  './dark-theme-overrides.css?v=v4.30',
  './diagnostic-runtime.js?v=v4.30',
  './live-static-update.js?v=v4.30',
  './cpbl-realtime.js?v=v4.30',
  './npb-realtime.js?v=v4.30',
  './postseason-history.css?v=v4.30',
  './js/module-loader.js?v=v4.30',
  MODULE_ORDER_URL,
  './postseason-history.js?v=v4.30',
  './cpbl-cache-router.js?v=v4.30',
  './game-detail-enhancement.css?v=v4.30',
  './report-layout.css?v=v4.30',
  './landscape-state.css?v=v4.30',
  './game-detail-enhancement.js?v=v4.30',
  './report-layout.js?v=v4.30',
  './manifest.webmanifest?v=v4.30',
  './icon-192.png?v=v4.30',
  './icon-512.png?v=v4.30',
  './favicon-32.png?v=v4.30',
  './favicon-16.png?v=v4.30'
];

async function getModuleShell() {
  const response = await fetch(MODULE_ORDER_URL, { cache: 'reload' });
  if (!response.ok) throw new Error(`Module order fetch failed (${response.status})`);
  const text = await response.text();
  const modules = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(name => `./js/${name}`);
  if (!modules.length) throw new Error('Module order is empty');
  return modules;
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const moduleShell = await getModuleShell();
    const shell = [...APP_SHELL, ...moduleShell];
    // Do not activate a half-populated shell. If GitHub Pages is between
    // deployments, keep the currently working worker instead of caching gaps.
    await Promise.all(shell.map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`App shell fetch failed: ${url} (${response.status})`);
      await cache.put(url, response.clone());
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Installation above guarantees the new shell is complete before old
    // caches are removed.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    // Do not navigate/reload clients here. The modular app runtime owns the
    // update/reload flow; having both layers navigate caused startup races.
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);
  const isDocument = request.mode === 'navigate'
    || request.destination === 'document'
    || url.pathname.endsWith('/index.html');
  const isModuleAsset = url.pathname.includes('/js/');
  const isCoreAsset = isModuleAsset
    || url.pathname.endsWith('/diagnostics.html')
    || url.pathname.endsWith('/diagnostic-runtime.js')
    || url.pathname.endsWith('/cpbl-realtime.js')
    || url.pathname.endsWith('/live-static-update.js')
    || url.pathname.endsWith('/cpbl-cache-router.js')
    || url.pathname.endsWith('/styles.css')
    || url.pathname.endsWith('/dark-theme-overrides.css')
    || url.pathname.endsWith('/postseason-history.js')
    || url.pathname.endsWith('/postseason-history.css')
    || url.pathname.endsWith('/game-detail-enhancement.js')
    || url.pathname.endsWith('/game-detail-enhancement.css')
    || url.pathname.endsWith('/report-layout.css')
    || url.pathname.endsWith('/report-layout.js')
    || url.pathname.endsWith('/landscape-state.css');

  if (isDocument) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response?.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
          return response;
        }
        throw new Error(`Network ${response?.status || 0}`);
      } catch {
        return await caches.match('./index.html', { ignoreSearch: true }) || Response.error();
      }
    })());
    return;
  }

  if (isCoreAsset) {
    event.respondWith((async () => {
      const requestedVersion = String(url.searchParams.get('v') || '').trim();
      const versionMismatch = Boolean(requestedVersion && requestedVersion !== CACHE_VERSION);

      // A new index.html can be controlled briefly by the previous Service Worker.
      // Never let an older worker satisfy a newer ?v= request from its stale cache.
      if (versionMismatch) {
        try {
          return await fetch(request, { cache:'no-store' });
        } catch {
          return Response.error();
        }
      }

      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch:true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response?.ok) {
          cache.put(request, response.clone()).catch(() => {});
          return response;
        }
        return Response.error();
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response?.ok && response.type !== 'opaque') {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
