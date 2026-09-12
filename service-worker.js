const CACHE_NAME = 'baseball-player-card-pwa-v158';

// 穩定版啟動策略：核心 app.js / index.html 保持原始版本，
// Service Worker 不再動態改寫 APP_VERSION，避免啟動檢查與 controllerchange 互相觸發。
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=v2.33',
  './app.js?v=v2.33',
  './game-detail-enhancement.css?v=v2.40',
  './game-detail-enhancement.js?v=v2.40',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

function enhanceHtml(text) {
  let html = String(text || '');
  html = html.replace(/game-detail-enhancement\.css\?v=v[\d.]+/g, 'game-detail-enhancement.css?v=v2.40');
  html = html.replace(/game-detail-enhancement\.js\?v=v[\d.]+/g, 'game-detail-enhancement.js?v=v2.40');

  if (!html.includes('game-detail-enhancement.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="./game-detail-enhancement.css?v=v2.40" />\n</head>');
  }
  if (!html.includes('game-detail-enhancement.js')) {
    html = html.replace('</body>', '  <script src="./game-detail-enhancement.js?v=v2.40"></script>\n</body>');
  }
  return html;
}

async function enhancedHtmlResponse(response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return response;
  const html = enhanceHtml(await response.clone().text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store, max-age=0');
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

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
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isHtml = request.destination === 'document' || url.pathname.endsWith('/index.html');

  if (isNavigation || isHtml) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        const enhanced = await enhancedHtmlResponse(response);
        if (enhanced?.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', enhanced.clone()));
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

  // 核心 JS 與 Service Worker 永遠優先抓線上原檔，不再做任何字串改寫。
  if (url.pathname.endsWith('/app.js') || url.pathname.endsWith('/service-worker.js')) {
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: 'no-store' });
      } catch {
        return await caches.match(request, { ignoreSearch: true }) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type !== 'opaque') {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
