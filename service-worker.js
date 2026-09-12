const CACHE_NAME = 'baseball-player-card-pwa-v160';

// Emergency recovery worker: clear every old cache and unregister itself.
// This intentionally disables SW interception so the installed PWA loads files directly.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch {}
    try {
      await self.registration.unregister();
    } catch {}
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
