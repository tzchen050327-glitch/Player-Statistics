(() => {
  // KBO / MLB homepage updates are driven by a lightweight revision signal.
  // The browser never refreshes the official source itself; after a signal it
  // clears only its in-memory daily-games entry and re-reads the shared cache.
  const VERSION = 'league-schedule-signal-v2';
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

  async function readSignal(target) {
    if (!target) return null;
    const query = new URLSearchParams({
      signal_key:`eq.${target.signalKey}`,
      select:'signal_key,league,game_date,revision,changed_at',
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

  async function stop() {
    const old = channel;
    channel = null;
    watching = null;
    serial += 1;
    if (old && client) {
      try { await client.removeChannel(old); } catch {}
    }
  }

  function applySignal(row, { force = false } = {}) {
    const target = watching ? { ...watching } : null;
    if (!target || !row) return;
    if (String(row.league || '').toUpperCase() !== target.league || String(row.game_date || '') !== target.date) return;
    const rev = Number(row.revision ?? -1);
    const prev = Number(revisions.get(target.signalKey) ?? -1);
    if (!Number.isFinite(rev) || rev < prev || (!force && rev === prev)) return;
    revisions.set(target.signalKey, rev);

    // Drop only the browser memory copy. loadHomeDailyGames() then reads the
    // already-refreshed persistent backend cache, not the official league site.
    homeDailyGamesCache.delete(target.key);
    if (currentPage === 'home' && homeDailyGamesLeague() === target.league && String(els.gameDate?.value || '') === target.date) {
      renderHomeDailyGames();
    }
  }

  async function reconcile(target = currentTarget()) {
    if (!target || !watching || watching.signalKey !== target.signalKey) return;
    try {
      const row = await readSignal(target);
      if (watching?.signalKey === target.signalKey) applySignal(row, { force:true });
    } catch {}
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
      // A device can open the page after the last Realtime event already fired.
      // Reconcile once immediately so its in-memory cache cannot remain behind.
      await reconcile(target);
    } catch {}
  }

  function ensure() { void start(currentTarget()); }
  function reconcileVisible() {
    const target = currentTarget();
    if (!target) return;
    void start(target).then(() => reconcile(target));
  }

  const renderHomeDailyGamesBeforeLeagueSignal = renderHomeDailyGames;
  renderHomeDailyGames = function renderHomeDailyGamesWithLeagueSignal(options = {}) {
    const result = renderHomeDailyGamesBeforeLeagueSignal(options);
    queueMicrotask(ensure);
    return result;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reconcileVisible();
  });
  window.addEventListener('focus', reconcileVisible);
  window.addEventListener('pageshow', reconcileVisible);
  void VERSION;
})();
