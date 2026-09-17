(() => {
  // CPBL front-end safety net. The official CPBL source is still fetched only by
  // the backend fixed scheduler (45s while live). This module never touches CPBL.
  // It polls only the tiny Supabase revision signal so a mobile browser that lost
  // its websocket does not wait another 45 seconds after the backend has published.
  const SIGNAL_INTERVAL = 5 * 1000;
  const FULL_RECONCILE_INTERVAL = 45 * 1000;
  const SIGNAL_TABLE = 'cpbl_live_revision_signal';
  const SUPABASE_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co';
  const VERSION = 'cpbl-signal-watchdog-v4';

  let signalTimer = 0;
  let fullTimer = 0;
  let latest = null;
  let pollSerial = 0;
  const lastRevisionByGame = new Map();

  const keyOf = value => value
    ? `${String(value.date || '')}|${String(value.kindCode || 'A').toUpperCase()}|${String(value.gameId || '')}`
    : '';

  function stop() {
    if (signalTimer) clearInterval(signalTimer);
    if (fullTimer) clearInterval(fullTimer);
    signalTimer = 0;
    fullTimer = 0;
    pollSerial += 1;
  }

  function updateLabel() {
    const el = document.getElementById('homeGameDetailRefreshCountdown');
    if (!el || !latest) return;
    const text = window.__cpblRealtimeConnected ? '即時推送' : '同步監看';
    if (el.textContent !== text) el.textContent = text;
  }

  async function readSignal(target) {
    const kind = String(target?.kindCode || 'A').toUpperCase();
    const cacheKey = `CPBL|${kind}|${target?.date || ''}|${target?.gameId || ''}`;
    const query = new URLSearchParams({
      cache_key:`eq.${cacheKey}`,
      select:'cache_key,game_date,game_id,kind_code,status,published_revision,published_at,changed_at',
      limit:'1'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}?${query}`, {
      headers:{ apikey:CPBL_ANON_KEY, authorization:`Bearer ${CPBL_ANON_KEY}` },
      cache:'no-store'
    });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  async function applyPublished(target, force = false) {
    const read = window.__cpblRealtimeReadPublished;
    if (typeof read !== 'function') return false;
    const key = keyOf(target);
    const result = await read(target.date, target.gameId, target.kindCode || 'A');
    if (!latest || keyOf(latest) !== key) return false;
    const row = result?.row || null;
    const detail = result?.detail || null;
    const rev = Number(row?.published_revision ?? -1);
    if (!detail?.game || !Number.isFinite(rev)) return false;

    const previous = Number(lastRevisionByGame.get(key) ?? -1);
    if (!force && rev <= previous) return false;
    if (rev >= 0) lastRevisionByGame.set(key, rev);

    window.dispatchEvent(new CustomEvent('cpbl-live-cache-update', {
      detail:{ row, detail, version:VERSION }
    }));
    return true;
  }

  async function pollSignal(force = false) {
    if (!latest || document.visibilityState !== 'visible') return;
    const target = { ...latest };
    const key = keyOf(target);
    const mine = ++pollSerial;
    try {
      const signal = await readSignal(target);
      if (mine !== pollSerial || !latest || keyOf(latest) !== key || !signal) return;
      const rev = Number(signal.published_revision ?? -1);
      if (!Number.isFinite(rev)) return;
      const previous = Number(lastRevisionByGame.get(key) ?? -1);
      if (!force && rev <= previous) return;
      await applyPublished(target, true);
    } catch {}
  }

  function start() {
    stop();
    if (!latest) return;
    updateLabel();

    // Reconcile immediately when entering/waking the detail page, then keep a
    // lightweight 5-second revision watchdog even while Realtime says connected.
    void pollSignal(true);
    signalTimer = setInterval(() => { void pollSignal(false); }, SIGNAL_INTERVAL);
    fullTimer = setInterval(() => {
      if (!latest || document.visibilityState !== 'visible') return;
      void applyPublished({ ...latest }, false).catch(() => {});
    }, FULL_RECONCILE_INTERVAL);
  }

  // Keep legacy countdown writers from replacing the truthful connection label.
  const observer = new MutationObserver(mutations => {
    if (!latest) return;
    for (const mutation of mutations) {
      const node = mutation.target?.nodeType === 3 ? mutation.target.parentElement : mutation.target;
      if (node?.id === 'homeGameDetailRefreshCountdown' || node?.querySelector?.('#homeGameDetailRefreshCountdown')) {
        queueMicrotask(updateLabel);
        break;
      }
    }
  });
  const observeRoot = () => {
    if (document.body) observer.observe(document.body, { subtree:true, childList:true, characterData:true });
    else setTimeout(observeRoot, 50);
  };
  observeRoot();

  window.addEventListener('home-game-detail-state', event => {
    const detail = event?.detail?.detail || null;
    const league = String(event?.detail?.league || detail?.league || '').toUpperCase();
    const date = String(event?.detail?.date || detail?.date || '');
    const gameId = String(detail?.game?.id || detail?.gameId || '');
    if (league !== 'CPBL' || !date || !gameId || String(detail?.status || '').toLowerCase() !== 'live') {
      latest = null;
      stop();
      return;
    }
    const next = { date, gameId, kindCode:String(detail?.kindCode || detail?.game?.kindCode || 'A') };
    const changed = keyOf(next) !== keyOf(latest);
    latest = next;
    if (changed || !signalTimer) start();
    else updateLabel();
  });

  window.addEventListener('cpbl-live-cache-update', event => {
    if (!latest) return;
    const row = event?.detail?.row || null;
    const key = keyOf(latest);
    const rowKey = row
      ? `${String(row.game_date || '')}|${String(row.kind_code || 'A').toUpperCase()}|${String(row.game_id || '')}`
      : '';
    if (rowKey && rowKey !== key) return;
    const rev = Number(row?.published_revision ?? -1);
    if (Number.isFinite(rev) && rev >= 0) lastRevisionByGame.set(key, rev);
    updateLabel();
  });

  window.addEventListener('cpbl-live-realtime-status', () => {
    updateLabel();
    if (latest && !signalTimer) start();
    else if (latest) void pollSignal(true);
  });

  function reconcileVisiblePage() {
    if (!latest || document.visibilityState !== 'visible') return;
    if (!signalTimer) start();
    else void pollSignal(true);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reconcileVisiblePage();
    else stop();
  });
  window.addEventListener('focus', reconcileVisiblePage);
  window.addEventListener('pageshow', reconcileVisiblePage);
})();
