(() => {
  const VERSION = 'v2.58';
  const SUPABASE_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqbmRuc3p0YmNwbWtoaWN0amtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDgxMDcsImV4cCI6MjEwMzU4NDEwN30.oB0Qq2eF3Tnrhg209rzPMNUhQPPEREmJwWxMFxCZLYU';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';

  let client = null;
  let channel = null;
  let watch = null;
  let lastRevision = -1;
  let dayChannel = null;
  let dayWatch = '';
  const dayRevisions = new Map();
  let loader = null;

  window.__cpblRealtimeConnected = false;
  window.__cpblDayRealtimeConnected = false;

  function emitStatus(connected, reason = '') {
    window.__cpblRealtimeConnected = Boolean(connected);
    window.dispatchEvent(new CustomEvent('cpbl-live-realtime-status', {
      detail: { connected:Boolean(connected), reason, version:VERSION }
    }));
  }

  function emitDayStatus(connected, reason = '') {
    window.__cpblDayRealtimeConnected = Boolean(connected);
    window.dispatchEvent(new CustomEvent('cpbl-live-day-realtime-status', {
      detail: { connected:Boolean(connected), reason, date:dayWatch, version:VERSION }
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
      emitDayStatus(false, error?.message || String(error));
      throw error;
    });
    return loader;
  }

  async function getClient() {
    if (client) return client;
    const sdk = await loadSupabase();
    client = sdk.createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      realtime: { params:{ eventsPerSecond:10 } }
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
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cpbl_live_game_cache?${query}`, {
      headers: { apikey:ANON_KEY, authorization:`Bearer ${ANON_KEY}` },
      cache:'no-store'
    });
    if (!response.ok) return { ok:false, detail:null, row:null, status:response.status };
    const rows = await response.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    const detail = publishedDetail(row);
    return { ok:Boolean(detail), detail, row };
  }
  window.__cpblRealtimeReadPublished = readPublished;

  function acceptRow(row) {
    if (!watch || !row) return;
    if (String(row.game_id || '') !== watch.gameId || String(row.game_date || '') !== watch.date) return;
    const detail = publishedDetail(row);
    if (!detail) return;
    const revision = Number(row.published_revision ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= lastRevision) return;
    if (Number.isFinite(revision) && revision >= 0) lastRevision = revision;
    window.dispatchEvent(new CustomEvent('cpbl-live-cache-update', { detail:{ row, detail, version:VERSION } }));
    const status = String(detail?.status || row?.status || '').toLowerCase();
    if (['final','cancelled','postponed'].includes(status)) stopWatch(false);
  }

  function acceptDayRow(row) {
    if (!dayWatch || !row || String(row.game_date || '') !== dayWatch) return;
    const detail = publishedDetail(row);
    if (!detail) return;
    const gameId = String(row.game_id || detail?.game?.id || '');
    if (!gameId) return;
    const revision = Number(row.published_revision ?? -1);
    const prev = Number(dayRevisions.get(gameId) ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= prev) return;
    if (Number.isFinite(revision) && revision >= 0) dayRevisions.set(gameId, revision);
    window.dispatchEvent(new CustomEvent('cpbl-live-day-update', { detail:{ row, detail, version:VERSION } }));
  }

  async function stopWatch(emit = true) {
    const old = channel;
    channel = null;
    watch = null;
    lastRevision = -1;
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
      channel = sb.channel(`cpbl-live-${date}-${gameId}-${Math.random().toString(36).slice(2,8)}`)
        .on('postgres_changes', {
          event:'*', schema:'public', table:'cpbl_live_game_cache', filter:`game_id=eq.${gameId}`
        }, payload => acceptRow(payload?.new))
        .subscribe(status => {
          if (status === 'SUBSCRIBED') emitStatus(true, 'subscribed');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') emitStatus(false, status);
        });
      const initial = await readPublished(date, gameId);
      if (initial?.row) acceptRow(initial.row);
    } catch (error) {
      emitStatus(false, error?.message || String(error));
    }
  }

  async function stopDayWatch(emit = true) {
    const old = dayChannel;
    dayChannel = null;
    dayWatch = '';
    dayRevisions.clear();
    if (old && client) {
      try { await client.removeChannel(old); } catch {}
    }
    if (emit) emitDayStatus(false, 'unwatched');
  }

  async function startDayWatch(input = {}) {
    const date = String(input.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (dayWatch === date && dayChannel) return;
    await stopDayWatch(false);
    dayWatch = date;
    try {
      const sb = await getClient();
      if (dayWatch !== date) return;
      dayChannel = sb.channel(`cpbl-day-${date}-${Math.random().toString(36).slice(2,8)}`)
        .on('postgres_changes', {
          event:'*', schema:'public', table:'cpbl_live_game_cache', filter:`game_date=eq.${date}`
        }, payload => acceptDayRow(payload?.new))
        .subscribe(status => {
          if (status === 'SUBSCRIBED') emitDayStatus(true, 'subscribed');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') emitDayStatus(false, status);
        });
    } catch (error) {
      emitDayStatus(false, error?.message || String(error));
    }
  }

  window.addEventListener('cpbl-live-watch', event => startWatch(event?.detail || {}));
  window.addEventListener('cpbl-live-unwatch', () => stopWatch());
  window.addEventListener('cpbl-live-watch-day', event => startDayWatch(event?.detail || {}));
  window.addEventListener('cpbl-live-unwatch-day', () => stopDayWatch());
})();
