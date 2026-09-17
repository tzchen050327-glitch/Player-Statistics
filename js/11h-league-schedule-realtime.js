(() => {
  // KBO / MLB homepage updates are driven by a lightweight revision signal.
  // The browser never refreshes the official source itself; after a signal it
  // clears only its in-memory daily-games entry and re-reads the shared cache.
  const VERSION = 'league-schedule-signal-v1';
  const SUPABASE_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co';
  const ANON_KEY = CPBL_ANON_KEY;
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
  const SIGNAL_TABLE = 'league_schedule_revision_signal';

  let client = null;
  let loader = null;
  let channel = null;
  let watching = null;
  let serial = 0;
  const revisions = new Map();

  async function sdk() {
    if (window.supabase?.createClient) return window.supabase;
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('schedule realtime sdk timeout')), 10000);
      s.onload = () => {
        clearTimeout(timer);
        if (window.supabase?.createClient) resolve(window.supabase);
        else reject(new Error('schedule realtime sdk unavailable'));
      };
      s.onerror = () => { clearTimeout(timer); reject(new Error('schedule realtime sdk failed')); };
      document.head.appendChild(s);
    }).catch(error => { loader = null; throw error; });
    return loader;
  }

  async function getClient() {
    if (client) return client;
    const lib = await sdk();
    client = lib.createClient(SUPABASE_URL, ANON_KEY, {
      auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      realtime:{ params:{ eventsPerSecond:10 } }
    });
    return client;
  }

  function currentTarget() {
    if (currentPage !== 'home' || homeRootSection === 'international') return null;
    const league = homeDailyGamesLeague();
    if (!['KBO','MLB'].includes(league)) return null;
    const date = String(els.gameDate?.value || localISODate());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return { league, date, key:`${league}|${date}`, signalKey:`${league}|${date}` };
  }

  async function stop() {
    const old = channel;
    channel = null;
    watching = null;
    serial += 1;
    if (old && client) {
      try { await client.removeChannel(old); } catch {}
    }
  }

  function applySignal(row) {
    const target = watching ? { ...watching } : null;
    if (!target || !row) return;
    if (String(row.league || '').toUpperCase() !== target.league || String(row.game_date || '') !== target.date) return;
    const rev = Number(row.revision ?? -1);
    const prev = Number(revisions.get(target.signalKey) ?? -1);
    if (!Number.isFinite(rev) || rev <= prev) return;
    revisions.set(target.signalKey, rev);

    // Drop only the browser memory copy. loadHomeDailyGames() then reads the
    // already-refreshed persistent backend cache, not the official league site.
    homeDailyGamesCache.delete(target.key);
    if (currentPage === 'home' && homeDailyGamesLeague() === target.league && String(els.gameDate?.value || '') === target.date) {
      renderHomeDailyGames();
    }
  }

  async function start(target) {
    if (!target) return stop();
    if (watching?.signalKey === target.signalKey && channel) return;
    await stop();
    watching = target;
    const mine = ++serial;
    try {
      const sb = await getClient();
      if (mine !== serial || !watching) return;
      channel = sb.channel(`league-schedule-${target.league}-${target.date}-${Math.random().toString(36).slice(2,8)}`)
        .on('postgres_changes', {
          event:'*', schema:'public', table:SIGNAL_TABLE, filter:`signal_key=eq.${target.signalKey}`
        }, payload => applySignal(payload?.new))
        .subscribe();
    } catch {}
  }

  function ensure() { void start(currentTarget()); }

  const renderHomeDailyGamesBeforeLeagueSignal = renderHomeDailyGames;
  renderHomeDailyGames = function renderHomeDailyGamesWithLeagueSignal(options = {}) {
    const result = renderHomeDailyGamesBeforeLeagueSignal(options);
    queueMicrotask(ensure);
    return result;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ensure();
  });
  window.addEventListener('focus', ensure);
  void VERSION;
})();
