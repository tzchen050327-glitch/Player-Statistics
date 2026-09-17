(() => {
  const INTERVAL = 45 * 1000;
  let timer = 0;
  let countdown = 0;
  let latest = null;
  let lastRevision = -1;

  function stop() {
    if (timer) clearInterval(timer);
    if (countdown) clearInterval(countdown);
    timer = 0;
    countdown = 0;
  }

  function updateLabel(nextAt) {
    const el = document.getElementById('homeGameDetailRefreshCountdown');
    if (!el || window.__cpblRealtimeConnected) return;
    const sec = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
    el.textContent = `${sec}秒後更新`;
  }

  async function poll() {
    if (!latest || document.visibilityState !== 'visible' || window.__cpblRealtimeConnected) return;
    const read = window.__cpblRealtimeReadPublished;
    if (typeof read !== 'function') return;
    try {
      const result = await read(latest.date, latest.gameId, latest.kindCode || 'A');
      const row = result?.row || null;
      const detail = result?.detail || null;
      const rev = Number(row?.published_revision ?? -1);
      if (!detail?.game || !Number.isFinite(rev) || rev <= lastRevision) return;
      lastRevision = rev;
      window.dispatchEvent(new CustomEvent('cpbl-live-cache-update', {
        detail:{ row, detail, version:'v3.68-fallback45' }
      }));
    } catch {}
  }

  function start() {
    stop();
    if (!latest || window.__cpblRealtimeConnected) return;
    let nextAt = Date.now() + INTERVAL;
    updateLabel(nextAt);
    countdown = setInterval(() => updateLabel(nextAt), 1000);
    timer = setInterval(async () => {
      await poll();
      nextAt = Date.now() + INTERVAL;
      updateLabel(nextAt);
    }, INTERVAL);
    void poll();
  }

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
    if (event?.detail?.connected) stop();
    else start();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') start();
    else stop();
  });
})();
