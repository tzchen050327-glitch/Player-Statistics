const CACHE_NAME = 'baseball-player-card-pwa-v243-stable-1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=v2.43-ui1',
  './app.js?v=v2.43',
  './game-detail-enhancement.css?v=v2.43-ui1',
  './game-detail-enhancement.js?v=v2.43-ui1',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async url => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response.clone());
      } catch {}
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL('./index.html?v=v2.43', self.registration.scope).href;
    await Promise.allSettled(clients.map(client => {
      try {
        const current = new URL(client.url);
        if (current.origin === self.location.origin && !current.searchParams.has('__v243')) {
          const next = new URL(target);
          next.searchParams.set('__v243', Date.now().toString());
          return client.navigate(next.href);
        }
      } catch {}
      return Promise.resolve();
    }));
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);
  const isCore = request.mode === 'navigate'
    || request.destination === 'document'
    || url.pathname.endsWith('/index.html')
    || url.pathname.endsWith('/app.js')
    || url.pathname.endsWith('/styles.css')
    || url.pathname.endsWith('/game-detail-enhancement.js')
    || url.pathname.endsWith('/game-detail-enhancement.css');

  if (isCore) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response?.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        return await caches.match(request, { ignoreSearch: true })
          || await caches.match('./index.html')
          || Response.error();
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
