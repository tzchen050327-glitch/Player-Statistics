from pathlib import Path
import re

# Internal app version
p = Path('js/00-core-config.js')
s = p.read_text(encoding='utf-8')
s = s.replace("const APP_VERSION = 'v2.41';", "const APP_VERSION = 'v2.42';", 1)
s = s.replace("./assets/default-hitter.jpg?v=v2.41", "./assets/default-hitter.jpg?v=v2.42")
s = s.replace("./assets/default-pitcher.jpg?v=v2.41", "./assets/default-pitcher.jpg?v=v2.42")
p.write_text(s, encoding='utf-8')

# HTML-visible version + hard cache-bust asset URLs
p = Path('index.html')
s = p.read_text(encoding='utf-8')
s = s.replace('content="v2.41"', 'content="v2.42"', 1)
s = s.replace('>v2.41</button>', '>v2.42</button>', 1)
s = s.replace('v2.41-ui1', 'v2.42-ui1')
p.write_text(s, encoding='utf-8')

# PWA launch URL also carries the version so installed standalone launches do not keep an old document URL
p = Path('manifest.webmanifest')
s = p.read_text(encoding='utf-8')
s = s.replace('"start_url": "./index.html"', '"start_url": "./index.html?v=v2.42"')
p.write_text(s, encoding='utf-8')

# Service worker cache generation + forced client navigation after a newly activated worker takes control
p = Path('service-worker.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const CACHE_NAME = 'baseball-player-card-pwa-v\d+-stable-\d+';", "const CACHE_NAME = 'baseball-player-card-pwa-v242-stable-1';", s, count=1)
s = s.replace('v2.41-ui1', 'v2.42-ui1')
old = """    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();"""
new = """    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL('./index.html?v=v2.42', self.registration.scope).href;
    await Promise.allSettled(clients.map(client => {
      try {
        const current = new URL(client.url);
        if (current.origin === self.location.origin && !current.searchParams.has('__v242')) {
          const next = new URL(target);
          next.searchParams.set('__v242', Date.now().toString());
          return client.navigate(next.href);
        }
      } catch {}
      return Promise.resolve();
    }));"""
if old not in s:
    raise SystemExit('service worker activate anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Explicit no-cache version endpoint for future update checks.
Path('version.json').write_text('{"version":"v2.42"}\n', encoding='utf-8')

# Make new builds consult version.json before HTML; keep HTML fallback for compatibility.
p = Path('js/23-bootstrap.js')
s = p.read_text(encoding='utf-8')
anchor = """        // 直接向線上 index.html 比對版本。這不依賴 service worker 檔案本身有沒有改動，
        // 可避免「網站已部署新版，但舊頁面一直停在舊 APP_VERSION」。
        try {
          const versionUrl = new URL('./index.html', location.href);"""
replacement = """        // 先讀取獨立 version.json，再以 index.html 作相容 fallback。
        try {
          const markerUrl = new URL('./version.json', location.href);
          markerUrl.searchParams.set('__version_check', Date.now().toString());
          const markerResponse = await fetch(markerUrl.href, { cache: 'no-store' });
          if (markerResponse.ok) {
            const marker = await markerResponse.json().catch(() => ({}));
            const remoteVersion = String(marker?.version || '').trim();
            if (remoteVersion && remoteVersion !== APP_VERSION) {
              if (showProgress) setAppUpdateProgress(82, `找到新版 ${remoteVersion}，正在重新載入…`);
              if (manual) setStatus(`找到新版 ${remoteVersion}，正在重新載入…`);
              appRefreshing = true;
              sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');
              const reloadUrl = new URL('./index.html', location.href);
              reloadUrl.searchParams.set('v', remoteVersion);
              reloadUrl.searchParams.set('__app_version', remoteVersion);
              setTimeout(() => location.replace(reloadUrl.href), 120);
              return { activated:true, remoteVersion };
            }
          }
        } catch (markerError) {
          console.warn('版本標記讀取失敗：', markerError);
        }

        // 再向線上 index.html 比對版本，避免舊部署沒有 version.json 時失去更新能力。
        try {
          const versionUrl = new URL('./index.html', location.href);"""
if anchor not in s:
    raise SystemExit('bootstrap version anchor not found')
s = s.replace(anchor, replacement, 1)
p.write_text(s, encoding='utf-8')
