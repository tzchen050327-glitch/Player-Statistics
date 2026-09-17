(() => {
  const REPORT_LAYOUT_VERSION = 'v2.77';

  function ensureFieldOverlay(root = document) {
    const cards = root.querySelectorAll?.('.gdx-field-card') || [];
    for (const card of cards) {
      const shape = card.querySelector('.gdx-field-shape');
      if (!shape) continue;

      let layer = card.querySelector(':scope > .gdx-fielders-layer');
      const fielders = [...shape.querySelectorAll(':scope > .gdx-fielder')];
      if (!fielders.length) continue;

      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'gdx-fielders-layer';
        layer.dataset.reportLayoutVersion = REPORT_LAYOUT_VERSION;
        shape.insertAdjacentElement('afterend', layer);
      }

      for (const fielder of fielders) layer.appendChild(fielder);
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      ensureFieldOverlay(document);
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.('.gdx-field-card, .gdx-field-shape, .gdx-landscape-board') ||
            node.querySelector?.('.gdx-field-card, .gdx-field-shape, .gdx-landscape-board')) {
          schedule();
          return;
        }
      }
    }
  });

  function start() {
    ensureFieldOverlay(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

// Homepage live-game badge: prefer the current inning/half over the generic "比賽中" label.
(() => {
  if (typeof homeDailyGameStatusLabel !== 'function') return;
  const fallbackStatusLabel = homeDailyGameStatusLabel;

  function normalizeInningLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(上|表|초|top)$/i);
    if (m) return `${m[1]}局上`;
    m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(下|裏|말|bottom)$/i);
    if (m) return `${m[1]}局下`;
    m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(?:上半|top\s*half)$/i);
    if (m) return `${m[1]}局上`;
    m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(?:下半|bottom\s*half)$/i);
    if (m) return `${m[1]}局下`;
    return raw;
  }

  homeDailyGameStatusLabel = function(game) {
    const status = String(game?.status || '').toLowerCase();
    if (status === 'live') {
      const inning = normalizeInningLabel(game?.inningLabel);
      if (inning) return inning;
    }
    return fallbackStatusLabel(game);
  };

  if (typeof renderHomeDailyGames === 'function') {
    queueMicrotask(() => {
      try { renderHomeDailyGames({ force:false }); } catch {}
    });
  }
})();

// Viewer heartbeat + shared MLB/KBO one-minute refresh policy.
(() => {
  const HEARTBEAT_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-live-heartbeat';
  const HEARTBEAT_MS = 60_000;
  const SCOREBOARD_COOLDOWN_MS = 60_000;
  const requestCache = new Map();
  let lastHeartbeatKey = '';
  let lastHeartbeatAt = 0;

  function currentLeagueAndDate() {
    try {
      if (document.hidden) return null;
      if (typeof currentPage !== 'undefined' && currentPage !== 'home') return null;
      if (typeof homeDailyGamesLeague !== 'function') return null;
      const league = String(homeDailyGamesLeague() || '').toUpperCase();
      if (!['CPBL','NPB','KBO','MLB'].includes(league)) return null;
      const date = String((typeof els !== 'undefined' && els?.gameDate?.value) || (typeof localISODate === 'function' ? localISODate() : '') || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { league, date };
    } catch {
      return null;
    }
  }

  async function sendHeartbeat({ force = false } = {}) {
    const current = currentLeagueAndDate();
    if (!current) return;
    const key = `${current.league}|${current.date}`;
    const now = Date.now();
    if (!force && key === lastHeartbeatKey && now - lastHeartbeatAt < 50_000) return;
    lastHeartbeatKey = key;
    lastHeartbeatAt = now;
    try {
      await fetch(HEARTBEAT_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey: typeof CPBL_APP_KEY !== 'undefined' ? CPBL_APP_KEY : '',
          action:'heartbeat',
          league:current.league,
          date:current.date
        }),
        keepalive:true
      });
    } catch {}
  }

  // MLB/KBO homepage requests share the persistent backend cache and a browser-side
  // 60-second cooldown. Rapid KR/US switching cannot cause repeated refreshes.
  if (typeof leagueDailyGamesRequest === 'function' && typeof LEAGUE_GAMES_API_URL !== 'undefined') {
    const originalDailyRequest = leagueDailyGamesRequest;
    leagueDailyGamesRequest = async function(league, date) {
      const lg = String(league || '').toUpperCase();
      if (!['MLB','KBO'].includes(lg)) return originalDailyRequest(league, date);

      const key = `${lg}|${date}`;
      const now = Date.now();
      const cached = requestCache.get(key);
      if (cached?.games && now - Number(cached.at || 0) < SCOREBOARD_COOLDOWN_MS) return cached.games;
      if (cached?.promise) return cached.promise;

      const promise = (async () => {
        const response = await fetch(LEAGUE_GAMES_API_URL, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body:JSON.stringify({
            appKey: typeof CPBL_APP_KEY !== 'undefined' ? CPBL_APP_KEY : '',
            action:'daily-games',
            league:lg,
            date
          })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.ok) throw new Error(json?.error || `daily games ${response.status}`);
        const games = Array.isArray(json.games) ? json.games : [];
        requestCache.set(key, { at:Date.now(), games });
        return games;
      })();

      requestCache.set(key, { ...(cached || {}), promise });
      try {
        return await promise;
      } finally {
        const latest = requestCache.get(key);
        if (latest?.promise === promise) delete latest.promise;
      }
    };
  }

  // Keep MLB/KBO visible-home refresh at one minute while a game is live.
  if (typeof homeDailyGamesRefreshDelay === 'function') {
    const originalRefreshDelay = homeDailyGamesRefreshDelay;
    homeDailyGamesRefreshDelay = function(league, date, games = []) {
      const lg = String(league || '').toUpperCase();
      const hasLive = Array.isArray(games) && games.some(g => ['live','suspended'].includes(String(g?.status || '').toLowerCase()));
      if (hasLive && ['MLB','KBO'].includes(lg)) return 60_000;
      return originalRefreshDelay(league, date, games);
    };
  }

  function scheduleImmediateHeartbeat() {
    setTimeout(() => { void sendHeartbeat({ force:true }); }, 0);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleImmediateHeartbeat();
  });
  document.addEventListener('click', event => {
    const target = event.target?.closest?.('[data-pro-country], [data-home-root], [data-us-league]');
    if (target) scheduleImmediateHeartbeat();
  });
  document.addEventListener('change', event => {
    if (event.target?.id === 'gameDate') scheduleImmediateHeartbeat();
  });

  setInterval(() => { void sendHeartbeat(); }, HEARTBEAT_MS);
  scheduleImmediateHeartbeat();
})();
