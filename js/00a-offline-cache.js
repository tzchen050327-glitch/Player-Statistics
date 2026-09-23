(() => {
  'use strict';
  if (window.__DIAMONDSCOPE_OFFLINE_CACHE__) return;
  window.__DIAMONDSCOPE_OFFLINE_CACHE__ = true;

  const nativeFetch = window.fetch.bind(window);
  const DAY = 86400000;
  const DB_NAME = 'diamondscope-offline-v1';
  const STORE = 'responses';
  const MAX_BYTES = 2500000;
  const rules = [
    ['/league-standings-state', 'standings', 120000, 7 * DAY],
    ['/league-daily-games', 'daily', 60000, 14 * DAY],
    ['/cpbl-daily-cache', 'daily', 60000, 14 * DAY],
    ['/npb-live-games', 'daily', 30000, 7 * DAY],
    ['/kbo-live-games', 'daily', 30000, 7 * DAY],
    ['/cpbl-postseason-daily', 'daily', 60000, 14 * DAY],
    ['/league-game-detail', 'detail', 0, 30 * DAY],
    ['/cpbl-game-detail', 'detail', 0, 30 * DAY],
    ['/npb-game-detail', 'detail', 0, 30 * DAY],
    ['/cpbl-minor-game-detail-cache', 'detail', 0, 30 * DAY],
    ['/cpbl-postseason-detail', 'detail', 0, 30 * DAY],
    ['/league-pregame-center', 'pregame', 300000, 3 * DAY],
    ['/league-bullpen-status', 'bullpen', 180000, 2 * DAY],
    ['/league-team-detail', 'team', 600000, 7 * DAY],
    ['/npb-pregame-starters', 'pregame', 300000, 3 * DAY]
  ];

  let dbPromise;
  let badge;
  let lastHit = 0;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath:'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function getEntry(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch { return null; }
  }

  async function putEntry(entry) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(entry);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
  }

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0).toString(36);
  }

  function ruleFor(url) {
    if (!/\.supabase\.co$/i.test(url.hostname)) return null;
    const item = rules.find((rule) => url.pathname.endsWith(rule[0]));
    return item ? { kind:item[1], fresh:item[2], stale:item[3] } : null;
  }

  async function bodyText(input, init) {
    try {
      if (init && Object.prototype.hasOwnProperty.call(init, 'body')) {
        const body = init.body;
        if (body == null) return '';
        if (typeof body === 'string') return body;
        if (body instanceof URLSearchParams) return body.toString();
        if (body instanceof Blob) return await body.text();
        return '';
      }
      if (input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD') return await input.clone().text();
    } catch {}
    return '';
  }

  function requestedDate(text) {
    try {
      const data = JSON.parse(text || '{}');
      const raw = data.date || data.gameDate || data.targetDate || data.day || '';
      const match = String(raw).match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    } catch {
      const match = String(text || '').match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    }
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function classify(rule, text, requestText) {
    const final = /"(?:status|gameStatus|state)"\s*:\s*"(?:final|finished|completed|complete|game[_ -]?over|ended|closed|比賽結束|結束)"/i.test(text);
    const live = !final && /"(?:status|gameStatus|state)"\s*:\s*"(?:live|in[_ -]?progress|playing|game[_ -]?in[_ -]?progress|delay|delayed|suspended|比賽中|進行中)"/i.test(text);
    const date = requestedDate(requestText);
    const historical = Boolean(date && date < today());
    let fresh = rule.fresh;
    if (rule.kind === 'detail') fresh = live ? 0 : (final ? 30 * DAY : 120000);
    if (rule.kind === 'daily') fresh = live ? 0 : (historical ? 7 * DAY : rule.fresh);
    return { final, live, historical, fresh };
  }

  function fromCache(entry) {
    const headers = new Headers(entry.headers || []);
    headers.set('x-diamonds-cache', 'hit');
    return new Response(entry.body || '', { status:entry.status || 200, statusText:entry.statusText || '', headers });
  }

  async function save(key, rule, response, requestText) {
    try {
      if (!response.ok || response.type === 'opaque') return;
      const text = await response.clone().text();
      if (!text || text.length > MAX_BYTES) return;
      const meta = classify(rule, text, requestText);
      const now = Date.now();
      await putEntry({
        key,
        body:text,
        status:response.status,
        statusText:response.statusText,
        headers:[...response.headers.entries()].filter(([name]) => !['content-length','content-encoding'].includes(name.toLowerCase())),
        savedAt:now,
        freshUntil:now + meta.fresh,
        staleUntil:now + Math.max(rule.stale, meta.fresh),
        live:meta.live,
        final:meta.final,
        historical:meta.historical,
        kind:rule.kind
      });
    } catch {}
  }

  function usable(entry) { return Boolean(entry && Date.now() <= Number(entry.staleUntil || 0)); }
  function fresh(entry) { return Boolean(entry && !entry.live && Date.now() <= Number(entry.freshUntil || 0)); }

  function ensureBadge() {
    if (badge && badge.isConnected) return badge;
    badge = document.createElement('div');
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    Object.assign(badge.style, {
      position:'fixed', left:'12px', bottom:'12px', zIndex:'2147483000', display:'none',
      padding:'8px 11px', borderRadius:'999px', fontSize:'12px', fontWeight:'700', lineHeight:'1.2',
      color:'#fff', background:'rgba(24,31,42,.92)', boxShadow:'0 6px 20px rgba(0,0,0,.22)',
      maxWidth:'calc(100vw - 24px)', pointerEvents:'none'
    });
    (document.body || document.documentElement).appendChild(badge);
    return badge;
  }

  function timeText(ts) {
    try { return new Intl.DateTimeFormat('zh-TW', { hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(ts)); }
    catch { return ''; }
  }

  function showStatus(mode, savedAt) {
    const el = ensureBadge();
    if (mode === 'online') { el.style.display = 'none'; return; }
    if (mode === 'offline') el.textContent = savedAt ? '離線模式 · 快取 ' + timeText(savedAt) : '離線模式 · 顯示本機快取';
    else el.textContent = savedAt ? '快取資料 · ' + timeText(savedAt) : '快取資料';
    el.style.display = 'block';
    if (mode === 'cache') setTimeout(() => { if (navigator.onLine && Date.now() - lastHit > 1400) showStatus('online'); }, 1600);
  }

  function hit(entry) {
    lastHit = Date.now();
    showStatus(navigator.onLine ? 'cache' : 'offline', Number(entry && entry.savedAt || 0));
  }

  window.addEventListener('offline', () => showStatus('offline'));
  window.addEventListener('online', () => showStatus('online'));
  document.addEventListener('DOMContentLoaded', () => { if (!navigator.onLine) showStatus('offline'); }, { once:true });

  window.fetch = async function(input, init) {
    const method = String(init && init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'POST') return nativeFetch(input, init);

    let url;
    try { url = new URL(input instanceof Request ? input.url : String(input), location.href); }
    catch { return nativeFetch(input, init); }

    const rule = ruleFor(url);
    if (!rule) return nativeFetch(input, init);

    const requestText = await bodyText(input, init);
    const key = method + ':' + url.toString() + ':' + hash(requestText);
    const cached = await getEntry(key);

    if (!navigator.onLine && usable(cached)) { hit(cached); return fromCache(cached); }
    if (navigator.onLine && fresh(cached)) { hit(cached); return fromCache(cached); }

    try {
      const response = await nativeFetch(input, init);
      if (response.ok) { await save(key, rule, response, requestText); return response; }
      if (response.status >= 500 && usable(cached)) { hit(cached); return fromCache(cached); }
      return response;
    } catch (error) {
      if (usable(cached)) { hit(cached); return fromCache(cached); }
      throw error;
    }
  };

  window.DiamondScopeOfflineCache = {
    async stats() {
      try {
        const db = await openDb();
        const rows = await new Promise((resolve, reject) => {
          const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        return { entries:rows.length, live:rows.filter((x) => x.live).length, final:rows.filter((x) => x.final).length };
      } catch { return { entries:0, live:0, final:0 }; }
    }
  };
})();