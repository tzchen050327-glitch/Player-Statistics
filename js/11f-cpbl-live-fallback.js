(() => {
  const INTERVAL = 45 * 1000;
  let timer = 0;
  let countdown = 0;
  let latest = null;
  let nextAt = 0;
  const lastRevisionByGame = new Map();

  const keyOf = value => value
    ? `${String(value.date || '')}|${String(value.kindCode || 'A').toUpperCase()}|${String(value.gameId || '')}`
    : '';

  function stop() {
    if (timer) clearInterval(timer);
    if (countdown) clearInterval(countdown);
    timer = 0;
    countdown = 0;
    nextAt = 0;
  }

  function updateLabel(at = nextAt) {
    const el = document.getElementById('homeGameDetailRefreshCountdown');
    if (!el || !latest || window.__cpblRealtimeConnected || !at) return;
    const sec = Math.max(0, Math.min(45, Math.ceil((at - Date.now()) / 1000)));
    const text = `${sec}秒後更新`;
    if (el.textContent !== text) el.textContent = text;
  }

  async function poll(forceApply = false) {
    if (!latest || document.visibilityState !== 'visible') return;
    if (window.__cpblRealtimeConnected && !forceApply) return;
    const read = window.__cpblRealtimeReadPublished;
    if (typeof read !== 'function') return;

    const target = { ...latest };
    const key = keyOf(target);
    try {
      const result = await read(target.date, target.gameId, target.kindCode || 'A');
      if (!latest || keyOf(latest) !== key) return;
      const row = result?.row || null;
      const detail = result?.detail || null;
      const rev = Number(row?.published_revision ?? -1);
      if (!detail?.game || !Number.isFinite(rev)) return;

      const previous = Number(lastRevisionByGame.get(key) ?? -1);
      if (!forceApply && rev <= previous) return;
      if (rev > previous) lastRevisionByGame.set(key, rev);

      window.dispatchEvent(new CustomEvent('cpbl-live-cache-update', {
        detail:{ row, detail, version:'v3.75-fallback45' }
      }));
    } catch {}
  }

  function start() {
    stop();
    if (!latest || window.__cpblRealtimeConnected) return;
    nextAt = Date.now() + INTERVAL;
    updateLabel();
    countdown = setInterval(() => updateLabel(), 1000);
    timer = setInterval(async () => {
      await poll(false);
      nextAt = Date.now() + INTERVAL;
      updateLabel();
    }, INTERVAL);
    void poll(false);
  }

  // The legacy detail scheduler still owns a five-minute fallback timer. Keep its
  // text from overwriting the real 45-second REST fallback while Realtime is down.
  const observer = new MutationObserver(mutations => {
    if (!latest || window.__cpblRealtimeConnected || !nextAt) return;
    for (const mutation of mutations) {
      const node = mutation.target?.nodeType === 3 ? mutation.target.parentElement : mutation.target;
      if (node?.id === 'homeGameDetailRefreshCountdown' || node?.querySelector?.('#homeGameDetailRefreshCountdown')) {
        queueMicrotask(() => updateLabel());
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
    latest = { date, gameId, kindCode:String(detail?.kindCode || detail?.game?.kindCode || 'A') };
    start();
  });

  window.addEventListener('cpbl-live-realtime-status', event => {
    if (event?.detail?.connected) {
      stop();
      // Reconcile once on (re)connect in case a mobile browser slept through updates.
      void poll(true);
    } else {
      start();
    }
  });

  function reconcileVisiblePage() {
    if (!latest || document.visibilityState !== 'visible') return;
    // Mobile browsers can keep a stale "connected" flag after backgrounding.
    // Always compare with the published cache immediately when the page wakes.
    void poll(true);
    if (!window.__cpblRealtimeConnected) start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reconcileVisiblePage();
    else stop();
  });
  window.addEventListener('focus', reconcileVisiblePage);
  window.addEventListener('pageshow', reconcileVisiblePage);
})();
