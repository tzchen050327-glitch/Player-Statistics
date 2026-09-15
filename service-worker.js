const CACHE_NAME = 'baseball-player-card-pwa-v327-auto';
// Runtime and app-shell versions are kept in lockstep by auto-version-bump.yml.
const APP_SHELL = [
  './',
  './index.html',
  './diagnostics.html',
  './styles.css?v=v3.27',
  './diagnostic-runtime.js?v=v3.27',
  './live-static-update.js?v=v3.27',
  './cpbl-realtime.js?v=v3.27',
  './npb-realtime.js?v=v3.27',
  './postseason-history.css?v=v3.27',
  './app.js?v=v3.27',
  './postseason-history.js?v=v3.27',
  './cpbl-cache-router.js?v=v3.27',
  './game-detail-enhancement.css?v=v3.27',
  './report-layout.css?v=v3.27',
  './landscape-state.css?v=v3.27',
  './game-detail-enhancement.js?v=v3.27',
  './report-layout.js?v=v3.27',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Do not activate a half-populated shell. If GitHub Pages is between
    // deployments, keep the currently working worker instead of caching gaps.
    await Promise.all(APP_SHELL.map(async url => {
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
    // Do not navigate/reload clients here. app.js owns update/reload flow;
    // having both layers navigate caused startup races and 0% splash stalls.
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
  const isCoreAsset = url.pathname.endsWith('/diagnostics.html')
    || url.pathname.endsWith('/diagnostic-runtime.js')
    || url.pathname.endsWith('/cpbl-realtime.js')
    || url.pathname.endsWith('/live-static-update.js')
    || url.pathname.endsWith('/app.js')
    || url.pathname.endsWith('/cpbl-cache-router.js')
    || url.pathname.endsWith('/styles.css')
    || url.pathname.endsWith('/postseason-history.js')
    || url.pathname.endsWith('/postseason-history.css')
    || url.pathname.endsWith('/game-detail-enhancement.js')
    || url.pathname.endsWith('/game-detail-enhancement.css')
    || url.pathname.endsWith('/report-layout.css')
    || url.pathname.endsWith('/report-layout.js')
    || url.pathname.endsWith('/landscape-state.css');

  if (isDocument || isCoreAsset) {
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
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // HTML may fall back to the cached app shell. JS/CSS must NEVER receive
        // index.html, otherwise the browser parses HTML as JavaScript and boot
        // stops at the 0% splash screen.
        if (isDocument) {
          return await caches.match('./index.html', { ignoreSearch: true }) || Response.error();
        }
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
