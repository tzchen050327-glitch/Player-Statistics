const CACHE_NAME = 'baseball-player-card-pwa-v152';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=v2.33',
  './app.js?v=v2.34',
  './game-detail-enhancement.css?v=v2.34',
  './game-detail-enhancement.js?v=v2.34',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './assets/default-hitter.jpg?v=v2.33',
  './assets/default-pitcher.jpg?v=v2.33'
];

function enhanceHtml(text) {
  let html = String(text || '');
  if (!html.includes('game-detail-enhancement.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="./game-detail-enhancement.css?v=v2.34" />\n</head>');
  }
  if (!html.includes('game-detail-enhancement.js')) {
    html = html.replace('</body>', '  <script src="./game-detail-enhancement.js?v=v2.34"></script>\n</body>');
  }
  return html;
}

async function enhancedHtmlResponse(response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return response;
  const html = enhanceHtml(await response.clone().text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const isNavigation = request.mode === 'navigate';
  const isHtml = request.destination === 'document'
    || new URL(request.url).pathname.endsWith('/index.html');

  // HTML / App 導覽：network-first，並在回應中掛上單場賽況增強模組。
  if (isNavigation || isHtml) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        const enhanced = await enhancedHtmlResponse(response);
        if (enhanced && enhanced.status === 200 && enhanced.type !== 'opaque') {
          const copy = enhanced.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
        }
        return enhanced;
      } catch {
        const cached = await caches.match('./index.html') || await caches.match('./');
        if (!cached) return Response.error();
        return enhancedHtmlResponse(cached);
      }
    })());
    return;
  }

  // 其他靜態資源維持 cache-first。
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});
