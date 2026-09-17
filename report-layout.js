(() => {
  const REPORT_LAYOUT_VERSION = 'v2.79';

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

// Viewer heartbeat + per-league homepage refresh cooldown.
(() => {
  const HEARTBEAT_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-live-heartbeat';
  const HEARTBEAT_MS = 60_000;
  const LIVE_SCOREBOARD_COOLDOWN = {
    CPBL:45_000,
    NPB:45_000,
    KBO:60_000,
    MLB:60_000
  };
  const TERMINAL_STATUSES = new Set(['final','cancelled','postponed']);
  const requestCache = new Map();
  let lastHeartbeatKey = '';
  let lastHeartbeatAt = 0;

  function allTerminal(games) {
    return Array.isArray(games)
      && games.length > 0
      && games.every(game => TERMINAL_STATUSES.has(String(game?.status || '').toLowerCase()));
  }

  function requestCooldownMs(league, date, games = []) {
    const lg = String(league || '').toUpperCase();
    const liveCooldown = Number(LIVE_SCOREBOARD_COOLDOWN[lg] || 0);
    const list = Array.isArray(games) ? games : [];
    if (!list.length) return liveCooldown;
    if (allTerminal(list)) return Infinity;
    if (list.some(game => ['live','suspended'].includes(String(game?.status || '').toLowerCase()))) {
      return liveCooldown;
    }
    if (list.some(game => String(game?.status || '').toLowerCase() === 'scheduled')
        && typeof homeDailyGamesRefreshDelay === 'function') {
      const delay = Number(homeDailyGamesRefreshDelay(lg, date, list));
      if (Number.isFinite(delay) && delay > 0) return delay;
    }
    return liveCooldown;
  }

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
    if (requestCache.get(key)?.terminal) return;
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

  // Live games keep the short per-league lock. Before first pitch, the browser
  // lock follows the exact same delay as the existing pregame auto-refresh rule.
  // NPB/KBO/MLB share the persistent league_schedule_cache; completed days stay frozen.
  if (typeof leagueDailyGamesRequest === 'function' && typeof LEAGUE_GAMES_API_URL !== 'undefined') {
    const originalDailyRequest = leagueDailyGamesRequest;
    leagueDailyGamesRequest = async function(league, date) {
      const lg = String(league || '').toUpperCase();
      const baseCooldown = Number(LIVE_SCOREBOARD_COOLDOWN[lg] || 0);
      if (!baseCooldown) return originalDailyRequest(league, date);

      const key = `${lg}|${date}`;
      const now = Date.now();
      const cached = requestCache.get(key);
      const cooldown = requestCooldownMs(lg, date, cached?.games || []);
      if (cached?.terminal && cached?.games) return cached.games;
      if (cached?.games && now - Number(cached.at || 0) < cooldown) return cached.games;
      if (cached?.promise) return cached.promise;

      const promise = (async () => {
        let games;
        if (lg === 'MLB' || lg === 'KBO' || lg === 'NPB') {
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
          games = Array.isArray(json.games) ? json.games : [];
        } else {
          games = await originalDailyRequest(league, date);
        }
        const normalized = Array.isArray(games) ? games : [];
        requestCache.set(key, { at:Date.now(), games:normalized, terminal:allTerminal(normalized) });
        return normalized;
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

  // MLB/KBO visible-home live scoreboards refresh once per minute.
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

// Pregame rule: once the next scheduled game is more than one hour away,
// both auto-refresh and switch-back cooldown become exactly one hour.
(() => {
  if (typeof homeDailyGamesRefreshDelay !== 'function' || typeof homeDailyGamesStartMs !== 'function') return;
  const previousRefreshDelay = homeDailyGamesRefreshDelay;
  homeDailyGamesRefreshDelay = function(league, date, games = []) {
    const list = Array.isArray(games) ? games : [];
    const hasLive = list.some(game => ['live','suspended'].includes(String(game?.status || '').toLowerCase()));
    if (!hasLive) {
      const starts = list
        .filter(game => String(game?.status || '').toLowerCase() === 'scheduled')
        .map(game => homeDailyGamesStartMs(league, date, game?.time))
        .filter(Number.isFinite);
      if (starts.length && Math.min(...starts) - Date.now() > 60 * 60 * 1000) {
        return 60 * 60 * 1000;
      }
    }
    return previousRefreshDelay(league, date, games);
  };
})();

// Preserve the user's exact homepage game-list position across automatic rerenders.
// Applies to CPBL / NPB / KBO / MLB and keeps separate state for each league + date.
(() => {
  if (typeof renderHomeDailyGames !== 'function') return;

  const originalRenderHomeDailyGames = renderHomeDailyGames;
  const positions = new Map();
  let renderedKey = '';

  function currentKey() {
    try {
      const league = typeof homeDailyGamesLeague === 'function' ? String(homeDailyGamesLeague() || '').toUpperCase() : '';
      const date = String((typeof els !== 'undefined' && els?.gameDate?.value) || (typeof localISODate === 'function' ? localISODate() : '') || '');
      if (!['CPBL','NPB','KBO','MLB'].includes(league) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
      return `${league}|${date}`;
    } catch {
      return '';
    }
  }

  function signature(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${el.id}`;
    const tag = String(el.tagName || '').toLowerCase();
    const classes = [...(el.classList || [])].sort().join('.');
    return `${tag}${classes ? '.' + classes : ''}`;
  }

  function scrollableEntries(host) {
    if (!host) return [];
    const all = [host, ...host.querySelectorAll('*')];
    const counts = new Map();
    const out = [];
    for (const el of all) {
      const horizontal = Number(el.scrollWidth) > Number(el.clientWidth) + 1;
      const vertical = Number(el.scrollHeight) > Number(el.clientHeight) + 1;
      if (!horizontal && !vertical && !el.scrollLeft && !el.scrollTop) continue;
      const sig = signature(el);
      if (!sig) continue;
      const index = counts.get(sig) || 0;
      counts.set(sig, index + 1);
      out.push({ sig, index, left:Number(el.scrollLeft) || 0, top:Number(el.scrollTop) || 0 });
    }
    return out;
  }

  function save(key) {
    if (!key) return;
    const host = (typeof els !== 'undefined' && els?.homeDailyGames) || document.getElementById('homeDailyGames');
    if (!host) return;
    const scrollers = scrollableEntries(host);
    // During an intermediate loading frame the list can temporarily have no
    // scrollable children. Do not overwrite a valid saved position with that.
    const previous = positions.get(key);
    positions.set(key, {
      scrollers: scrollers.length ? scrollers : (previous?.scrollers || []),
      windowX: window.scrollX || 0,
      windowY: window.scrollY || 0
    });
  }

  function restore(key) {
    if (!key) return;
    const state = positions.get(key);
    if (!state) return;
    const host = (typeof els !== 'undefined' && els?.homeDailyGames) || document.getElementById('homeDailyGames');
    if (!host) return;

    const all = [host, ...host.querySelectorAll('*')];
    const grouped = new Map();
    for (const el of all) {
      const sig = signature(el);
      if (!sig) continue;
      if (!grouped.has(sig)) grouped.set(sig, []);
      grouped.get(sig).push(el);
    }

    for (const item of state.scrollers || []) {
      const el = grouped.get(item.sig)?.[item.index];
      if (!el) continue;
      const maxLeft = Math.max(0, Number(el.scrollWidth) - Number(el.clientWidth));
      const maxTop = Math.max(0, Number(el.scrollHeight) - Number(el.clientHeight));
      el.scrollLeft = Math.min(Math.max(0, Number(item.left) || 0), maxLeft);
      el.scrollTop = Math.min(Math.max(0, Number(item.top) || 0), maxTop);
    }

    window.scrollTo({ left:Number(state.windowX) || 0, top:Number(state.windowY) || 0, behavior:'auto' });
  }

  renderedKey = currentKey();

  renderHomeDailyGames = function(...args) {
    // renderedKey describes the DOM that is currently on screen. This matters
    // when the user intentionally switches league/date before the next render.
    if (renderedKey) save(renderedKey);

    const result = originalRenderHomeDailyGames.apply(this, args);
    const nextKey = currentKey();
    renderedKey = nextKey;

    // innerHTML replacement is synchronous, but one animation frame lets layout
    // recalculate scrollWidth/clientWidth before clamping the saved position.
    requestAnimationFrame(() => {
      if (currentKey() === nextKey) restore(nextKey);
    });
    return result;
  };
})();
