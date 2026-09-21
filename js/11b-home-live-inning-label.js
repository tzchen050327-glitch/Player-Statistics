    /* ---------- Home live inning labels ---------- */
    // NPB daily cards come from npb-live-games, while the authoritative inning label
    // lives in the shared npb_live_game_cache payload. Fetch only game_id + inningLabel
    // so the home page can show "2局上 / 2局下" without downloading full game detail.
    const leagueDailyGamesRequestBeforeLiveInning = leagueDailyGamesRequest;

    async function homeNpbLiveInningLabels(date) {
      try {
        const base = String(NPB_GAMES_API_URL || '').split('/functions/v1/')[0];
        if (!base) return new Map();
        const query = new URLSearchParams({
          game_date: `eq.${date}`,
          published_revision: 'gt.0',
          select: 'game_id,inning_label:published_payload->game->>inningLabel'
        });
        const response = await fetch(`${base}/rest/v1/npb_live_game_cache?${query}`, {
          headers: {
            apikey: CPBL_ANON_KEY,
            authorization: `Bearer ${CPBL_ANON_KEY}`
          },
          cache: 'no-store'
        });
        if (!response.ok) return new Map();
        const rows = await response.json().catch(() => []);
        return new Map((Array.isArray(rows) ? rows : [])
          .map(row => [String(row?.game_id || ''), String(row?.inning_label || '').trim()])
          .filter(([id, label]) => id && label));
      } catch {
        return new Map();
      }
    }

    leagueDailyGamesRequest = async function leagueDailyGamesRequestWithLiveInning(league, date) {
      const games = await leagueDailyGamesRequestBeforeLiveInning(league, date);
      if (league !== 'NPB' || !Array.isArray(games) || !games.some(game => String(game?.status || '').toLowerCase() === 'live')) {
        return games;
      }
      const labels = await homeNpbLiveInningLabels(date);
      if (!labels.size) return games;
      return games.map(game => {
        const label = labels.get(String(game?.id || '')) || '';
        return label ? { ...game, inningLabel: label } : game;
      });
    };

    homeDailyGameStatusLabel = function homeDailyGameStatusLabelWithInning(game) {
      const status = String(game?.status || '').toLowerCase();
      const league = homeDailyGamesLeague();
      if (status === 'final') return '已結束';
      if (status === 'live') {
        const direct = String(game?.inningLabel || '').trim();
        if (direct) return direct;
        const inning = Number(game?.currentInning ?? game?.inning);
        const halfRaw = String(game?.currentHalf || game?.half || '').toLowerCase();
        const half = ['top','up','上'].includes(halfRaw) ? '上' : ['bottom','down','下'].includes(halfRaw) ? '下' : '';
        if (Number.isFinite(inning) && inning > 0) return `${inning}局${half}`;
        return '比賽中';
      }
      if (status === 'cancelled') {
        const reason = String(game?.postponementReason || '').trim();
        if (reason) return reason;
        return league === 'NPB' ? '延賽' : '取消／延期';
      }
      if ((league === 'CPBL' || league === 'NPB') && game?.lineupReady) return '先發打序';
      return String(game?.time || '').trim() || '未開打';
    };

    // If a user opens a live detail page, immediately copy the newest inning label back
    // to the home-card cache as well instead of waiting for the next 45-second home refresh.
    const syncHomeDailyGameFromDetailBeforeLiveInning = syncHomeDailyGameFromDetail;
    syncHomeDailyGameFromDetail = function syncHomeDailyGameFromDetailWithInning(league, date, game, detail) {
      syncHomeDailyGameFromDetailBeforeLiveInning(league, date, game, detail);
      const label = String(detail?.game?.inningLabel || '').trim();
      if (!label) return;
      if (game) game.inningLabel = label;
      const daily = homeDailyGamesCache.get(`${league}|${date}`);
      const games = Array.isArray(daily?.games) ? daily.games : [];
      const detailGame = detail?.game || {};
      const target = games.find(item =>
        (detailGame?.id && item?.id && String(detailGame.id) === String(item.id))
        || (String(item?.away || '') === String(detailGame?.away || game?.away || '')
          && String(item?.home || '') === String(detailGame?.home || game?.home || ''))
      );
      if (target) target.inningLabel = label;
    };
