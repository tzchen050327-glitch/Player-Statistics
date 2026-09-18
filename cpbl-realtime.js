(() => {
  const VERSION = 'v3.44';
  const SUPABASE_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImtqbmRuc3p0YmNwbWtoaWN0amtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDgxMDcsImV4cCI6MjEwMzU4NDEwN30.oB0Qq2eF3Tnrhg209rzPMNUhQPPEREmJwWxMFxCZLYU';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
  const SIGNAL_TABLE = 'cpbl_live_revision_signal';

  let client = null;
  let loader = null;
  let channel = null;
  let watch = null;
  let lastRevision = -1;
  let watchdogTimer = 0;
  let realtimeSignalSerial = 0;
  let dayChannel = null;
  let dayWatch = '';
  const dayRevisions = new Map();
  const inflightPublished = new Map();

  window.__cpblRealtimeConnected = false;
  window.__cpblDayRealtimeConnected = false;

  const isLiveStatus = value => ['live','suspended'].includes(String(value || '').toLowerCase());
  const isTerminalStatus = value => ['final','cancelled','postponed'].includes(String(value || '').toLowerCase());

  function emitStatus(connected, reason = '') {
    window.__cpblRealtimeConnected = Boolean(connected);
    window.dispatchEvent(new CustomEvent('cpbl-live-realtime-status', {
      detail:{ connected:Boolean(connected), reason, version:VERSION }
    }));
  }

  function emitDayStatus(connected, reason = '') {
    window.__cpblDayRealtimeConnected = Boolean(connected);
    window.dispatchEvent(new CustomEvent('cpbl-live-day-realtime-status', {
      detail:{ connected:Boolean(connected), reason, date:dayWatch, version:VERSION }
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

  async function readPublished(date, gameId, kindCode = 'A') {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    const kind = String(kindCode || 'A').trim().toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !id) return { ok:false, detail:null, row:null };
    const query = new URLSearchParams({
      game_date:`eq.${d}`,
      game_id:`eq.${id}`,
      kind_code:`eq.${kind}`,
      select:'game_date,game_id,kind_code,status,published_payload,published_revision,published_at',
      limit:'1'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cpbl_live_game_cache?${query}`, {
      headers:{ apikey:ANON_KEY, authorization:`Bearer ${ANON_KEY}` },
      cache:'no-store'
    });
    if (!response.ok) return { ok:false, detail:null, row:null, status:response.status };
    const rows = await response.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    const detail = publishedDetail(row);
    const status = String(detail?.status || row?.status || '').toLowerCase();
    return { ok:Boolean(detail), detail, row, gameStatus:status, isLive:isLiveStatus(status) };
  }
  window.__cpblRealtimeReadPublished = readPublished;

  function publishedFetchKey(date, gameId, kindCode, revision) {
    return `${date}|${kindCode}|${gameId}|${Number(revision ?? -1)}`;
  }

  async function readPublishedForRevision(date, gameId, kindCode, revision) {
    const key = publishedFetchKey(date, gameId, kindCode, revision);
    if (inflightPublished.has(key)) return inflightPublished.get(key);
    const task = readPublished(date, gameId, kindCode).finally(() => inflightPublished.delete(key));
    inflightPublished.set(key, task);
    return task;
  }

  async function readRevision(date, gameId, kindCode = 'A') {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    const kind = String(kindCode || 'A').trim().toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !id) return null;
    const query = new URLSearchParams({
      cache_key:`eq.CPBL|${kind}|${d}|${id}`,
      select:'cache_key,game_date,game_id,kind_code,status,published_revision,published_at,changed_at',
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
        const meta = await readRevision(current.date, current.gameId, current.kindCode);
        if (!meta || !watch || watch.date !== current.date || watch.gameId !== current.gameId || watch.kindCode !== current.kindCode) return;
        const revision = Number(meta.published_revision ?? -1);
        if (!Number.isFinite(revision) || revision <= lastRevision) return;
        const published = await readPublishedForRevision(current.date, current.gameId, current.kindCode, revision);
        if (published?.row && watch && watch.date === current.date && watch.gameId === current.gameId && watch.kindCode === current.kindCode) acceptRow(published.row);
      } catch {}
    }, 12000);
  }

  function acceptRow(row) {
    if (!watch || !row) return;
    if (String(row.game_id || '') !== watch.gameId || String(row.game_date || '') !== watch.date) return;
    if (String(row.kind_code || 'A').toUpperCase() !== watch.kindCode) return;
    const detail = publishedDetail(row);
    const status = String(detail?.status || row?.status || '').toLowerCase();
    if (isTerminalStatus(status)) {
      stopWatch(false, true);
      return;
    }
    if (!isLiveStatus(status) || !detail) return;
    const revision = Number(row.published_revision ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= lastRevision) return;
    if (Number.isFinite(revision) && revision >= 0) lastRevision = revision;
    window.dispatchEvent(new CustomEvent('cpbl-live-cache-update', { detail:{ row, detail, version:VERSION } }));
  }

  async function refreshFromRealtimeSignal(signal) {
    const current = watch ? { ...watch } : null;
    if (!current || !signal) return;
    if (String(signal.game_id || '') !== current.gameId || String(signal.game_date || '') !== current.date) return;
    if (String(signal.kind_code || 'A').toUpperCase() !== current.kindCode) return;
    const revision = Number(signal.published_revision ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= lastRevision) return;
    const serial = ++realtimeSignalSerial;
    try {
      const published = await readPublishedForRevision(current.date, current.gameId, current.kindCode, revision);
      if (serial !== realtimeSignalSerial || !watch) return;
      if (watch.date !== current.date || watch.gameId !== current.gameId || watch.kindCode !== current.kindCode) return;
      if (published?.row) acceptRow(published.row);
    } catch {}
  }

  function compactDayDetail(signal) {
    const kindCode = String(signal?.kind_code || 'A').toUpperCase();
    const game = { id:String(signal?.game_id || ''), kindCode };
    if (signal?.away_name) game.away = String(signal.away_name);
    if (signal?.home_name) game.home = String(signal.home_name);
    if (String(signal?.away_score ?? '').trim() !== '') game.awayScore = Number(signal.away_score);
    if (String(signal?.home_score ?? '').trim() !== '') game.homeScore = Number(signal.home_score);
    if (signal?.inning_label) game.inningLabel = String(signal.inning_label);
    return {
      status:String(signal?.status || '').toLowerCase(),
      date:String(signal?.game_date || ''),
      kindCode,
      game
    };
  }

  function acceptDaySignal(signal) {
    if (!dayWatch || !signal || String(signal.game_date || '') !== dayWatch || watch) return;
    const kindCode = String(signal.kind_code || 'A').toUpperCase();
    if (kindCode !== 'A') return;
    const gameId = String(signal.game_id || '');
    if (!gameId) return;
    const revisionKey = `${kindCode}|${gameId}`;
    const revision = Number(signal.published_revision ?? -1);
    const prev = Number(dayRevisions.get(revisionKey) ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= prev) return;
    if (Number.isFinite(revision) && revision >= 0) dayRevisions.set(revisionKey, revision);
    const detail = compactDayDetail(signal);
    window.dispatchEvent(new CustomEvent('cpbl-live-day-update', { detail:{ row:signal, detail, version:VERSION } }));
  }

  function refreshDayFromRealtimeSignal(signal) {
    acceptDaySignal(signal);
  }

  async function pauseDayChannel(reason = 'paused-for-game') {
    const old = dayChannel;
    dayChannel = null;
    if (old && client) {
      try { await client.removeChannel(old); } catch {}
    }
    if (dayWatch) emitDayStatus(false, reason);
  }

  async function subscribeDay(date) {
    if (!date || watch) return;
    const sb = await getClient();
    if (dayWatch !== date || watch) return;
    const key = `${date}|A`;
    dayChannel = sb.channel(`cpbl-day-signal-${date}-${Math.random().toString(36).slice(2,8)}`)
      .on('postgres_changes', {
        event:'*', schema:'public', table:SIGNAL_TABLE, filter:`day_kind_key=eq.${key}`
      }, payload => refreshDayFromRealtimeSignal(payload?.new))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') emitDayStatus(true, 'subscribed');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') emitDayStatus(false, status);
      });
  }

  async function stopWatch(emit = true, resumeDay = true) {
    stopWatchdog();
    const old = channel;
    channel = null;
    watch = null;
    lastRevision = -1;
    realtimeSignalSerial += 1;
    if (old && client) {
      try { await client.removeChannel(old); } catch {}
    }
    if (emit) emitStatus(false, 'unwatched');
    if (resumeDay && dayWatch && !dayChannel) {
      try { await subscribeDay(dayWatch); } catch (error) { emitDayStatus(false, error?.message || String(error)); }
    }
  }

  async function startWatch(input = {}) {
    const date = String(input.date || '').trim();
    const gameId = String(input.gameId || '').trim();
    const kindCode = String(input.kindCode || 'A').trim().toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !gameId) return;
    if (watch?.date === date && watch?.gameId === gameId && watch?.kindCode === kindCode && channel) return;
    await stopWatch(false, false);
    await pauseDayChannel();
    watch = { date, gameId, kindCode };
    try {
      const sb = await getClient();
      if (!watch || watch.date !== date || watch.gameId !== gameId || watch.kindCode !== kindCode) return;
      channel = sb.channel(`cpbl-live-signal-${kindCode}-${date}-${gameId}-${Math.random().toString(36).slice(2,8)}`)
        .on('postgres_changes', {
          event:'*', schema:'public', table:SIGNAL_TABLE, filter:`game_id=eq.${gameId}`
        }, payload => { void refreshFromRealtimeSignal(payload?.new); })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') emitStatus(true, 'subscribed');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') emitStatus(false, status);
        });
      const initial = await readPublished(date, gameId, kindCode);
      if (initial?.row) acceptRow(initial.row);
      if (watch) startWatchdog();
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
    if (watch) {
      emitDayStatus(false, 'deferred-while-game');
      return;
    }
    try {
      await subscribeDay(date);
    } catch (error) {
      emitDayStatus(false, error?.message || String(error));
    }
  }

  window.addEventListener('cpbl-live-watch', event => startWatch(event?.detail || {}));
  window.addEventListener('cpbl-live-unwatch', () => stopWatch());
  window.addEventListener('cpbl-live-watch-day', event => startDayWatch(event?.detail || {}));
  window.addEventListener('cpbl-live-unwatch-day', () => stopDayWatch());
})();
