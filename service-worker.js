const CACHE_NAME = 'baseball-player-card-pwa-v157';
const APP_VERSION = 'v2.40';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=v2.40',
  './game-detail-enhancement.css?v=v2.40',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

function enhanceHtml(text) {
  let html = String(text || '');
  html = html.replace(/<meta\s+name=["']app-version["']\s+content=["'][^"']*["']\s*\/?\s*>/i, `<meta name="app-version" content="${APP_VERSION}" />`);
  html = html.replace(/app\.js\?v=v[\d.]+/g, `app.js?v=${APP_VERSION}`);
  html = html.replace(/styles\.css\?v=v[\d.]+/g, `styles.css?v=${APP_VERSION}`);
  html = html.replace(/game-detail-enhancement\.css\?v=v[\d.]+/g, `game-detail-enhancement.css?v=${APP_VERSION}`);
  html = html.replace(/game-detail-enhancement\.js\?v=v[\d.]+/g, `game-detail-enhancement.js?v=${APP_VERSION}`);
  html = html.replace(/(<button[^>]+id=["']appVersionBadge["'][^>]*>)[^<]*(<\/button>)/i, `$1${APP_VERSION}$2`);
  if (!html.includes('game-detail-enhancement.css')) {
    html = html.replace('</head>', `  <link rel="stylesheet" href="./game-detail-enhancement.css?v=${APP_VERSION}" />\n</head>`);
  }
  if (!html.includes('game-detail-enhancement.js')) {
    html = html.replace('</body>', `  <script src="./game-detail-enhancement.js?v=${APP_VERSION}"></script>\n</body>`);
  }
  return html;
}

function enhanceAppJs(text) {
  let js = String(text || '');
  js = js.replace(/const APP_VERSION = 'v[\d.]+';/, `const APP_VERSION = '${APP_VERSION}';`);
  js = js.replace(/default-hitter\.jpg\?v=v[\d.]+/g, `default-hitter.jpg?v=${APP_VERSION}`);
  js = js.replace(/default-pitcher\.jpg\?v=v[\d.]+/g, `default-pitcher.jpg?v=${APP_VERSION}`);
  return js;
}

function enhanceDetailJs(text) {
  let js = String(text || '');
  js = js.replace(
    "if (badge) badge.textContent = UI_VERSION;",
    "if (badge && badge.textContent !== UI_VERSION) badge.textContent = UI_VERSION;"
  );
  js = js.replace(
    "if (splash) splash.textContent = `VERSION ${UI_VERSION}`;",
    "const splashVersion = `VERSION ${UI_VERSION}`;\n    if (splash && splash.textContent !== splashVersion) splash.textContent = splashVersion;"
  );
  js = js.replace(
    "if (meta) meta.setAttribute('content', UI_VERSION);",
    "if (meta && meta.getAttribute('content') !== UI_VERSION) meta.setAttribute('content', UI_VERSION);"
  );
  js = js.replace(
    /new MutationObserver\(\(\) => \{\s*applyVersionLabel\(\);\s*scheduleEnhance\(\);\s*\}\)\.observe/,
    "new MutationObserver(() => {\n    scheduleEnhance();\n  }).observe"
  );
  return js;
}

async function rewriteResponse(response, transform, contentType) {
  if (!response || response.status !== 200 || response.type === 'opaque') return response;
  const text = transform(await response.clone().text());
  const headers = new Headers(response.headers);
  headers.set('content-type', contentType);
  headers.set('cache-control', 'no-store, max-age=0');
  headers.delete('content-length');
  return new Response(text, { status: response.status, statusText: response.statusText, headers });
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
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: 'V240_SW_ACTIVE' });
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
  const isAppJs = url.pathname.endsWith('/app.js');
  const isDetailJs = url.pathname.endsWith('/game-detail-enhancement.js');

  if (isNavigation || isHtml) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        const rewritten = await rewriteResponse(response, enhanceHtml, 'text/html; charset=utf-8');
        if (rewritten?.ok) caches.open(CACHE_NAME).then(cache => cache.put('./index.html', rewritten.clone()));
        return rewritten;
      } catch {
        const cached = await caches.match('./index.html') || await caches.match('./');
        if (!cached) return Response.error();
        return rewriteResponse(cached, enhanceHtml, 'text/html; charset=utf-8');
      }
    })());
    return;
  }

  if (isAppJs) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        return rewriteResponse(response, enhanceAppJs, 'application/javascript; charset=utf-8');
      } catch {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (!cached) return Response.error();
        return rewriteResponse(cached, enhanceAppJs, 'application/javascript; charset=utf-8');
      }
    })());
    return;
  }

  if (isDetailJs) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        return rewriteResponse(response, enhanceDetailJs, 'application/javascript; charset=utf-8');
      } catch {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (!cached) return Response.error();
        return rewriteResponse(cached, enhanceDetailJs, 'application/javascript; charset=utf-8');
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
