(() => {
  // Independent CPBL single-game Realtime channel. This intentionally does not share
  // the homepage day channel/client lifecycle, so a day subscription cannot tear down
  // the open game's live subscription.
  const VERSION = 'cpbl-realtime-rescue-v1';
  const SUPABASE_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
  const SIGNAL_TABLE = 'cpbl_live_revision_signal';

  let loader = null;
  let client = null;
  let channel = null;
  let target = null;
  let retryTimer = 0;
  let connected = false;
  let lastRevision = -1;
  let serial = 0;

  function emit(yes, reason='') {
    connected = Boolean(yes);
    window.__cpblRealtimeConnected = connected;
    window.dispatchEvent(new CustomEvent('cpbl-live-realtime-status', {
      detail:{ connected, reason, version:VERSION }
    }));
  }

  function sdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('realtime sdk timeout')), 10000);
      s.onload = () => {
        clearTimeout(timer);
        if (window.supabase?.createClient) resolve(window.supabase);
        else reject(new Error('realtime sdk unavailable'));
      };
      s.onerror = () => { clearTimeout(timer); reject(new Error('realtime sdk failed')); };
      document.head.appendChild(s);
    }).catch(error => { loader = null; throw error; });
    return loader;
  }

  async function getClient() {
    if (client) return client;
    const lib = await sdk();
    client = lib.createClient(SUPABASE_URL, CPBL_ANON_KEY, {
      auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      realtime:{ params:{ eventsPerSecond:10 } }
    });
    return client;
  }

  function sameTarget(row, t=target) {
    return !!t && !!row
      && String(row.game_id || '') === t.gameId
      && String(row.game_date || '') === t.date
      && String(row.kind_code || 'A').toUpperCase() === t.kindCode;
  }

  async function pull(revision = null) {
    const t = target ? { ...target } : null;
    if (!t) return;
    const read = window.__cpblRealtimeReadPublished;
    if (typeof read !== 'function') return;
    try {
      const result = await read(t.date, t.gameId, t.kindCode);
      if (!target || target.key !== t.key) return;
      const row = result?.row || null;
      const detail = result?.detail || null;
      if (!row || !detail?.game || !sameTarget(row,t)) return;
      const rev = Number(row.published_revision ?? revision ?? -1);
      if (Number.isFinite(rev) && rev <= lastRevision) return;
      if (Number.isFinite(rev)) lastRevision = rev;
      window.dispatchEvent(new CustomEvent('cpbl-live-cache-update', {
        detail:{ row, detail, version:VERSION }
      }));
      if (['final','cancelled','postponed'].includes(String(detail?.status || row?.status || '').toLowerCase())) {
        void stop(false);
      }
    } catch {}
  }

  function scheduleRetry() {
    if (retryTimer || !target) return;
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      if (target && document.visibilityState === 'visible') void subscribe({ ...target });
    }, 5000);
  }

  async function stop(clearTarget = true) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = 0;
    serial += 1;
    const old = channel;
    channel = null;
    connected = false;
    if (old && client) {
      try { await client.removeChannel(old); } catch {}
    }
    if (clearTarget) target = null;
  }

  async function subscribe(input = {}) {
    const date = String(input.date || '').trim();
    const gameId = String(input.gameId || '').trim();
    const kindCode = String(input.kindCode || 'A').trim().toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !gameId) return;
    const next = { date, gameId, kindCode, key:`${date}|${kindCode}|${gameId}` };
    if (target?.key === next.key && channel && connected) return;
    await stop(false);
    target = next;
    lastRevision = -1;
    const mine = ++serial;
    try {
      const sb = await getClient();
      if (!target || target.key !== next.key || mine !== serial) return;
      channel = sb.channel(`cpbl-rescue-${kindCode}-${date}-${gameId}-${Math.random().toString(36).slice(2,8)}`)
        .on('postgres_changes', {
          event:'*', schema:'public', table:SIGNAL_TABLE, filter:`game_id=eq.${gameId}`
        }, payload => {
          const row = payload?.new;
          if (!sameTarget(row)) return;
          const rev = Number(row?.published_revision ?? -1);
          if (Number.isFinite(rev) && rev <= lastRevision) return;
          void pull(rev);
        })
        .subscribe(status => {
          if (!target || target.key !== next.key) return;
          if (status === 'SUBSCRIBED') {
            emit(true,'rescue-subscribed');
            void pull();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            emit(false,status);
            scheduleRetry();
          }
        });
    } catch (error) {
      emit(false,error?.message || String(error));
      scheduleRetry();
    }
  }

  window.addEventListener('cpbl-live-watch', event => { void subscribe(event?.detail || {}); });
  window.addEventListener('cpbl-live-unwatch', () => { void stop(true); });

  // If the legacy CPBL channel reports false while the independent channel is already
  // subscribed, preserve the actual connected state rather than letting the old channel
  // overwrite the shared indicator.
  window.addEventListener('cpbl-live-realtime-status', event => {
    if (event?.detail?.version === VERSION) return;
    if (connected) queueMicrotask(() => emit(true,'rescue-subscribed'));
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && target) {
      void pull();
      if (!connected) void subscribe({ ...target });
    }
  });
  window.addEventListener('focus', () => {
    if (target) {
      void pull();
      if (!connected) void subscribe({ ...target });
    }
  });
})();
