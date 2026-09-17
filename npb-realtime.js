(() => {
  const VERSION = 'v3.11';
  const SUPABASE_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImtqbmRuc3p0YmNwbWtoaWN0amtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDgxMDcsImV4cCI6MjEwMzU4NDEwN30.oB0Qq2eF3Tnrhg209rzPMNUhQPPEREmJwWxMFxCZLYU';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
  const SIGNAL_TABLE = 'npb_live_revision_signal';

  let client = null;
  let channel = null;
  let watch = null;
  let lastRevision = -1;
  let loader = null;
  let watchdogTimer = 0;
  let signalSerial = 0;
  const inflightPublished = new Map();

  window.__npbRealtimeConnected = false;

  const liveStatus = value => ['live','suspended'].includes(String(value || '').toLowerCase());
  const terminalStatus = value => ['final','cancelled','postponed'].includes(String(value || '').toLowerCase());

  function emitStatus(connected, reason = '') {
    window.__npbRealtimeConnected = Boolean(connected);
    window.dispatchEvent(new CustomEvent('npb-live-realtime-status', {
      detail:{ connected:Boolean(connected), reason, version:VERSION }
    }));
  }

  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CDN;
      script.async = true;
      script.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('Supabase Realtime 載入逾時')), 10000);
      script.onload = () => {
        clearTimeout(timer);
        if (window.supabase?.createClient) resolve(window.supabase);
        else reject(new Error('Supabase Realtime SDK 無法使用'));
      };
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Supabase Realtime SDK 載入失敗'));
      };
      document.head.appendChild(script);
    }).catch(error => {
      loader = null;
      emitStatus(false, error?.message || String(error));
      throw error;
    });
    return loader;
  }

  async function getClient() {
    if (client) return client;
    const sdk = await loadSupabase();
    client = sdk.createClient(SUPABASE_URL, ANON_KEY, {
      auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      realtime:{ params:{ eventsPerSecond:10 } }
    });
    return client;
  }

  function publishedDetail(row) {
    if (Number(row?.published_revision || 0) <= 0) return null;
    const detail = row?.published_payload;
    return detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : null;
  }

  async function readPublished(date, gameId) {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !id) return { ok:false, detail:null, row:null };
    const query = new URLSearchParams({
      game_date:`eq.${d}`,
      game_id:`eq.${id}`,
      select:'game_date,game_id,status,published_payload,published_revision,published_at',
      limit:'1'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/npb_live_game_cache?${query}`, {
      headers:{ apikey:ANON_KEY, authorization:`Bearer ${ANON_KEY}` },
      cache:'no-store'
    });
    if (!response.ok) return { ok:false, detail:null, row:null, status:response.status };
    const rows = await response.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    const detail = publishedDetail(row);
    const status = String(detail?.status || row?.status || '').toLowerCase();
    return { ok:Boolean(detail), detail, row, gameStatus:status };
  }
  window.__npbRealtimeReadPublished = readPublished;

  async function readRevision(date, gameId) {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !id) return null;
    const query = new URLSearchParams({
      game_date:`eq.${d}`,
      game_id:`eq.${id}`,
      select:'game_date,game_id,status,published_revision,published_at,changed_at',
      limit:'1'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}?${query}`, {
      headers:{ apikey:ANON_KEY, authorization:`Bearer ${ANON_KEY}` },
      cache:'no-store'
    });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  function publishedKey(date, gameId, revision) {
    return `${date}|${gameId}|${Number(revision ?? -1)}`;
  }

  async function readPublishedForRevision(date, gameId, revision) {
    const key = publishedKey(date, gameId, revision);
    if (inflightPublished.has(key)) return inflightPublished.get(key);
    const task = readPublished(date, gameId).finally(() => inflightPublished.delete(key));
    inflightPublished.set(key, task);
    return task;
  }

  function stopWatchdog() {
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = 0;
  }

  function startWatchdog() {
    stopWatchdog();
    watchdogTimer = setInterval(async () => {
      const current = watch ? { ...watch } : null;
      if (!current || document.visibilityState !== 'visible') return;
      try {
        const meta = await readRevision(current.date, current.gameId);
        if (!meta || !watch || watch.date !== current.date || watch.gameId !== current.gameId) return;
        const revision = Number(meta.published_revision ?? -1);
        if (!Number.isFinite(revision) || revision <= lastRevision) return;
        const published = await readPublishedForRevision(current.date, current.gameId, revision);
        if (published?.row && watch && watch.date === current.date && watch.gameId === current.gameId) acceptRow(published.row);
      } catch {}
    }, 12000);
  }

  function acceptRow(row) {
    if (!watch || !row) return;
    if (String(row.game_id || '') !== watch.gameId || String(row.game_date || '') !== watch.date) return;
    const detail = publishedDetail(row);
    if (!detail) return;
    const revision = Number(row.published_revision ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= lastRevision) return;
    if (Number.isFinite(revision) && revision >= 0) lastRevision = revision;
    const status = String(detail?.status || row?.status || '').toLowerCase();
    if (!liveStatus(status) && !terminalStatus(status)) return;
    window.dispatchEvent(new CustomEvent('npb-live-cache-update', { detail:{ row, detail, version:VERSION } }));
    if (terminalStatus(status)) stopWatch(false);
  }

  async function acceptSignal(signal) {
    const current = watch ? { ...watch } : null;
    if (!current || !signal) return;
    if (String(signal.game_id || '') !== current.gameId || String(signal.game_date || '') !== current.date) return;
    const revision = Number(signal.published_revision ?? -1);
    if (!Number.isFinite(revision) || revision <= lastRevision) return;
    const serial = ++signalSerial;
    try {
      const published = await readPublishedForRevision(current.date, current.gameId, revision);
      if (serial !== signalSerial || !watch) return;
      if (watch.date !== current.date || watch.gameId !== current.gameId) return;
      if (published?.row) acceptRow(published.row);
    } catch {}
  }

  async function stopWatch(emit = true) {
    stopWatchdog();
    const old = channel;
    channel = null;
    watch = null;
    lastRevision = -1;
    signalSerial += 1;
    if (old && client) {
      try { await client.removeChannel(old); } catch {}
    }
    if (emit) emitStatus(false, 'unwatched');
  }

  async function startWatch(input = {}) {
    const date = String(input.date || '').trim();
    const gameId = String(input.gameId || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !gameId) return;
    if (watch?.date === date && watch?.gameId === gameId && channel) return;
    await stopWatch(false);
    watch = { date, gameId };
    try {
      const sb = await getClient();
      if (!watch || watch.date !== date || watch.gameId !== gameId) return;
      channel = sb.channel(`npb-live-signal-${date}-${gameId}-${Math.random().toString(36).slice(2,8)}`)
        .on('postgres_changes', {
          event:'*', schema:'public', table:SIGNAL_TABLE, filter:`game_id=eq.${gameId}`
        }, payload => { void acceptSignal(payload?.new); })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') emitStatus(true, 'subscribed');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') emitStatus(false, status);
        });
      const initial = await readPublished(date, gameId);
      if (initial?.row) acceptRow(initial.row);
      if (watch) startWatchdog();
    } catch (error) {
      emitStatus(false, error?.message || String(error));
    }
  }

  window.addEventListener('npb-live-watch', event => startWatch(event?.detail || {}));
  window.addEventListener('npb-live-unwatch', () => stopWatch());
})();
