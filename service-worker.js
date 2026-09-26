const CACHE_NAME = 'baseball-player-card-pwa-v679-auto';
const CACHE_VERSION = 'v6.79';
// Runtime and app-shell versions are kept in lockstep by auto-version-bump.yml.
const MODULE_ORDER_URL = './js/module-order.txt';
const VERSIONED_MODULE_ORDER_URL = `${MODULE_ORDER_URL}?v=${encodeURIComponent(CACHE_VERSION)}`;
const APP_CACHE_PREFIX = 'baseball-player-card-pwa-v';

function parseAppVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
}

function compareAppVersions(a, b) {
  const left = Array.isArray(a) ? a : parseAppVersion(a);
  const right = Array.isArray(b) ? b : parseAppVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

function cacheVersionFromName(name) {
  const match = String(name || '').match(/^baseball-player-card-pwa-v(\d+)(\d{2})-auto$/i);
  return match ? [Number(match[1]), Number(match[2]), 0] : null;
}

async function assertNoNewerInstalledCache() {
  const current = parseAppVersion(CACHE_VERSION);
  const keys = await caches.keys();
  const newer = keys
    .map(name => ({ name, version:cacheVersionFromName(name) }))
    .find(item => item.version && compareAppVersions(item.version, current) > 0);
  if (newer) {
    throw new Error(`Refusing Service Worker downgrade ${CACHE_VERSION}; newer cache ${newer.name} already exists`);
  }
}

async function responseAppVersion(response) {
  try {
    const html = await response.clone().text();
    return (html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i) || [])[1] || '';
  } catch {
    return '';
  }
}

async function assertInstallDocumentVersion(response, url) {
  const remoteVersion = await responseAppVersion(response);
  if (!remoteVersion || compareAppVersions(remoteVersion, CACHE_VERSION) !== 0) {
    throw new Error(`App shell version mismatch for ${url}: expected ${CACHE_VERSION}, received ${remoteVersion || 'unknown'}`);
  }
}

const APP_SHELL = [
  './',
  './index.html',
  './diagnostics.html',
  './styles.css?v=v6.79',
  './dark-theme-overrides.css?v=v6.79',
  './diagnostic-runtime.js?v=v6.79',
  './live-static-update.js?v=v6.79',
  './cpbl-realtime.js?v=v6.79',
  './npb-realtime.js?v=v6.79',
  './postseason-history.css?v=v6.79',
  './js/module-loader.js?v=v6.79',
  MODULE_ORDER_URL,
  VERSIONED_MODULE_ORDER_URL,
  './postseason-history.js?v=v6.79',
  './cpbl-cache-router.js?v=v6.79',
  './game-detail-enhancement.css?v=v6.79',
  './report-layout.css?v=v6.79',
  './landscape-state.css?v=v6.79',
  './game-detail-enhancement.js?v=v6.79',
  './report-layout.js?v=v6.79',
  './manifest.webmanifest?v=v6.79',
  './icon-192.png?v=v6.79',
  './icon-512.png?v=v6.79',
  './favicon-32.png?v=v6.79',
  './favicon-16.png?v=v6.79'
];

async function getModuleShell() {
  const response = await fetch(MODULE_ORDER_URL, { cache: 'reload' });
  if (!response.ok) throw new Error(`Module order fetch failed (${response.status})`);
  const text = await response.text();
  const modules = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(name => `./js/${name}?v=${encodeURIComponent(CACHE_VERSION)}`);
  if (!modules.length) throw new Error('Module order is empty');
  return modules;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // A stale CDN/Pages response must never replace a newer worker already
    // installed on this device.
    await assertNoNewerInstalledCache();

    const cache = await caches.open(CACHE_NAME);
    const moduleShell = await getModuleShell();
    const shell = [...APP_SHELL, ...moduleShell];
    // Do not activate a half-populated or mixed-version shell. If GitHub Pages
    // is between deployments, keep the currently working worker instead.
    await Promise.all(shell.map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`App shell fetch failed: ${url} (${response.status})`);
      if (url === './' || url === './index.html') {
        await assertInstallDocumentVersion(response, url);
      }
      await cache.put(url, response.clone());
    }));

    // Only take over after the entire same-version shell has been verified.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Installation above guarantees the new shell is complete before old
    // caches are removed.
    const current = parseAppVersion(CACHE_VERSION);
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => {
        if (key === CACHE_NAME || !key.startsWith(APP_CACHE_PREFIX)) return false;
        const version = cacheVersionFromName(key);
        // Never let an older worker erase a cache belonging to a newer release.
        return version ? compareAppVersions(version, current) <= 0 : true;
      })
      .map(key => caches.delete(key)));
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
      const cache = await caches.open(CACHE_NAME);
      const scopePath = new URL(self.registration.scope).pathname;
      const isAppEntry = url.pathname === scopePath || url.pathname === `${scopePath}index.html`;

      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response?.ok) {
          if (isAppEntry) {
            const remoteVersion = await responseAppVersion(response);
            const comparison = compareAppVersions(remoteVersion, CACHE_VERSION);
            if (!remoteVersion || comparison === null || comparison < 0) {
              throw new Error(`Refusing document downgrade: worker ${CACHE_VERSION}, network ${remoteVersion || 'unknown'}`);
            }
            // Keep this cache internally consistent. A newer document may be
            // shown while its worker installs, but it must not overwrite the
            // current worker's offline shell.
            if (comparison === 0) {
              cache.put(request, response.clone()).catch(() => {});
            }
          } else {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        }
        throw new Error(`Network ${response?.status || 0}`);
      } catch {
        // Fallback is deliberately restricted to this worker's own cache.
        // Global caches.match() could resurrect an old v6.55 app shell.
        return await cache.match('./index.html', { ignoreSearch: true }) || Response.error();
      }
    })());
    return;
  }

  if (isCoreAsset) {
    event.respondWith((async () => {
      const requestedVersion = String(url.searchParams.get('v') || '').trim();
      const cache = await caches.open(CACHE_NAME);

      // Versioned core assets must be network-first.
      // Never let an unversioned/stale cached module satisfy a newer ?v= request.
      if (requestedVersion) {
        try {
          const response = await fetch(request, { cache:'no-store' });
          if (response?.ok) {
            cache.put(request, response.clone()).catch(() => {});
            return response;
          }
        } catch {}
        const exact = await cache.match(request);
        if (exact) return exact;
        return Response.error();
      }

      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request, { cache:'no-store' });
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


self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title:'棒球通知', body:event.data ? event.data.text() : '' };
  }

  const title = String(payload?.title || '棒球通知');
  const options = {
    body:String(payload?.body || ''),
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    tag:String(payload?.tag || 'baseball-player-notification'),
    renotify:Boolean(payload?.renotify),
    data:payload?.data && typeof payload.data === 'object' ? payload.data : {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const relativeUrl = String(event.notification?.data?.url || './');
  const targetUrl = new URL(relativeUrl, self.registration.scope).href;

  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of list) {
      try {
        if (new URL(client.url).origin !== new URL(targetUrl).origin) continue;
        if ('navigate' in client && client.url !== targetUrl) await client.navigate(targetUrl);
        if ('focus' in client) return await client.focus();
      } catch {}
    }
    if (self.clients.openWindow) return await self.clients.openWindow(targetUrl);
    return null;
  })());
});
