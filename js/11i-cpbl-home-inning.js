(() => {
  // CPBL home cards: use the shared revision signal as the authoritative live inning source.
  const VERSION = 'cpbl-home-inning-v1';
  const SUPABASE_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co';
  const SIGNAL_TABLE = 'cpbl_live_revision_signal';

  async function liveLabels(date) {
    try {
      const query = new URLSearchParams({
        game_date:`eq.${date}`,
        kind_code:'eq.A',
        select:'game_id,status,away_score,home_score,inning_label,published_revision'
      });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}?${query}`, {
        headers:{ apikey:CPBL_ANON_KEY, authorization:`Bearer ${CPBL_ANON_KEY}` },
        cache:'no-store'
      });
      if (!response.ok) return new Map();
      const rows = await response.json().catch(() => []);
      return new Map((Array.isArray(rows) ? rows : []).map(row => [String(row?.game_id || ''), row]));
    } catch {
      return new Map();
    }
  }

  const previousRequest = leagueDailyGamesRequest;
  leagueDailyGamesRequest = async function leagueDailyGamesRequestWithCpblInning(league, date) {
    const games = await previousRequest(league, date);
    if (String(league || '').toUpperCase() !== 'CPBL' || !Array.isArray(games) || !games.length) return games;
    const labels = await liveLabels(date);
    if (!labels.size) return games;
    return games.map(game => {
      const row = labels.get(String(game?.id || ''));
      if (!row) return game;
      const next = { ...game };
      if (row.status) next.status = String(row.status).toLowerCase();
      if (String(row.inning_label || '').trim()) next.inningLabel = String(row.inning_label).trim();
      if (String(row.away_score ?? '').trim() !== '') next.awayScore = Number(row.away_score);
      if (String(row.home_score ?? '').trim() !== '') next.homeScore = Number(row.home_score);
      return next;
    });
  };

  function applyDaySignal(event) {
    const row = event?.detail?.row || null;
    const detail = event?.detail?.detail || null;
    const date = String(row?.game_date || detail?.date || '');
    const gameId = String(row?.game_id || detail?.game?.id || '');
    if (!date || !gameId) return;
    const cached = homeDailyGamesCache.get(`CPBL|${date}`);
    const games = Array.isArray(cached?.games) ? cached.games : [];
    const game = games.find(item => String(item?.id || '') === gameId);
    if (!game) return;
    const label = String(row?.inning_label || detail?.game?.inningLabel || '').trim();
    if (label) game.inningLabel = label;
    if (row?.status || detail?.status) game.status = String(row?.status || detail?.status).toLowerCase();
    if (String(row?.away_score ?? '').trim() !== '') game.awayScore = Number(row.away_score);
    if (String(row?.home_score ?? '').trim() !== '') game.homeScore = Number(row.home_score);
    if (currentPage === 'home' && homeDailyGamesLeague() === 'CPBL' && String(els.gameDate?.value || localISODate()) === date) {
      renderHomeDailyGames();
    }
  }

  window.addEventListener('cpbl-live-day-update', applyDaySignal);
  void VERSION;
})();
