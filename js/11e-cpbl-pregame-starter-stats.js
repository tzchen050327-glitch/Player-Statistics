    /* ---------- CPBL pregame starter stats ---------- */
    // Scheduled CPBL detail often knows the official 1-9 batting order before
    // BattingJson is populated. Keep the lineup source separate from season stats:
    // 1) hydrate the 18 starters if the lineup itself is incomplete;
    // 2) resolve only those starter Acnts against the existing 30-minute team batting cache.
    const fetchBeforeCpblPregameStarterStats = window.fetch.bind(window);
    const CPBL_FUNCTIONS_BASE = String(CPBL_GAME_DETAIL_API_URL || '').replace(/\/cpbl-game-detail(?:\?.*)?$/, '');
    const CPBL_PREGAME_STARTER_LINEUP_URL = `${CPBL_FUNCTIONS_BASE}/cpbl-pregame-lineup`;
    const CPBL_TEAM_BATTING_STATS_URL = `${CPBL_FUNCTIONS_BASE}/cpbl-team-batting-cache`;
    const cpblPregameStarterLineupCache = new Map();
    const cpblPregameTeamStatsCache = new Map();
    const CPBL_PREGAME_CLIENT_CACHE_TTL = 5 * 60 * 1000;

    function cpblStarterStatPresent(value) {
      return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
    }

    function cpblStarterStatsComplete(detail) {
      for (const side of ['away','home']) {
        const list = Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : [];
        if (list.length < 9) return false;
        if (!list.slice(0,9).every(player =>
          String(player?.avg ?? '').trim() !== ''
          && cpblStarterStatPresent(player?.hits)
          && cpblStarterStatPresent(player?.homeRuns)
          && cpblStarterStatPresent(player?.rbi)
        )) return false;
      }
      return true;
    }

    function cpblStarterLineupComplete(detail) {
      return ['away','home'].every(side => {
        const list = Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : [];
        return list.length >= 9 && list.slice(0,9).every(player => String(player?.acnt || player?.id || '').trim());
      });
    }

    function mergeCpblPregameStarterLineup(detail, payload) {
      if (!payload?.ok || !payload?.lineups) return detail;
      detail.lineups ||= {};
      for (const side of ['away','home']) {
        const incoming = Array.isArray(payload?.lineups?.[side]) ? payload.lineups[side] : [];
        if (incoming.length < 9) continue;
        detail.lineups[side] ||= {};
        const current = Array.isArray(detail.lineups[side].batters) ? detail.lineups[side].batters : [];
        const byAcnt = new Map(current.map(player => [String(player?.acnt || player?.id || ''), player]));
        const byOrder = new Map(current.map(player => [Number(player?.order) || 0, player]));
        detail.lineups[side].batters = incoming.slice(0,9).map(entry => {
          const acnt = String(entry?.acnt || entry?.id || '');
          const order = Number(entry?.order) || 0;
          const base = (acnt && byAcnt.get(acnt)) || (order && byOrder.get(order)) || {};
          return { ...base, ...entry };
        });
      }
      return detail;
    }

    async function cpblPregameStarterLineup(date, gameId) {
      const key = `${date}|${gameId}`;
      const cached = cpblPregameStarterLineupCache.get(key);
      if (cached && Date.now() - cached.at < CPBL_PREGAME_CLIENT_CACHE_TTL) return cached.payload;
      const response = await fetchBeforeCpblPregameStarterStats(CPBL_PREGAME_STARTER_LINEUP_URL, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({appKey:CPBL_APP_KEY,date,gameId}),
        cache:'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok && Number(payload?.counts?.away) >= 9 && Number(payload?.counts?.home) >= 9) {
        cpblPregameStarterLineupCache.set(key, { at:Date.now(), payload });
      }
      return payload;
    }

    async function cpblPregameTeamBattingStats(season, clubNo) {
      const code = String(clubNo || '').trim().toUpperCase().slice(0,3);
      if (!/^[A-Z]{3}$/.test(code)) return new Map();
      const key = `${season}|${code}`;
      const cached = cpblPregameTeamStatsCache.get(key);
      if (cached && Date.now() - cached.at < CPBL_PREGAME_CLIENT_CACHE_TTL) return cached.players;
      const response = await fetchBeforeCpblPregameStarterStats(CPBL_TEAM_BATTING_STATS_URL, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({appKey:CPBL_APP_KEY,season,clubNo:code}),
        cache:'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !Array.isArray(payload?.players)) return new Map();
      const players = new Map(payload.players.map(player => [String(player?.acnt || ''), player]));
      cpblPregameTeamStatsCache.set(key, { at:Date.now(), players });
      return players;
    }

    function statOr(current, incoming) {
      return incoming !== '' && incoming !== null && incoming !== undefined ? incoming : current;
    }

    async function hydrateCpblPregameStarterStats(detail) {
      const date = String(detail?.date || '');
      const gameId = String(detail?.game?.id || detail?.gameId || '');
      if (!date || !gameId) return detail;

      if (!cpblStarterLineupComplete(detail)) {
        try {
          const lineup = await cpblPregameStarterLineup(date, gameId);
          mergeCpblPregameStarterLineup(detail, lineup);
        } catch {}
      }
      if (!cpblStarterLineupComplete(detail)) return detail;

      const season = Number(date.slice(0,4)) || new Date().getFullYear();
      const awayCode = String(detail?.game?.awayCode || '').slice(0,3);
      const homeCode = String(detail?.game?.homeCode || '').slice(0,3);
      const [awayStats, homeStats] = await Promise.all([
        cpblPregameTeamBattingStats(season, awayCode),
        cpblPregameTeamBattingStats(season, homeCode)
      ]);

      for (const side of ['away','home']) {
        const stats = side === 'away' ? awayStats : homeStats;
        const list = Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : [];
        detail.lineups[side].batters = list.map((player, index) => {
          if (index >= 9) return player;
          const stat = stats.get(String(player?.acnt || player?.id || ''));
          if (!stat) return player;
          return {
            ...player,
            ab:statOr(player?.ab, stat?.ab),
            avg:statOr(player?.avg, stat?.avg),
            hits:statOr(player?.hits, stat?.hits),
            homeRuns:statOr(player?.homeRuns, stat?.hr),
            rbi:statOr(player?.rbi, stat?.rbi)
          };
        });
      }

      detail.authority = {
        ...(detail.authority || {}),
        pregameLineupStats:'CPBL starter Acnt + cached team batting totals (18 starters only)'
      };
      return detail;
    }

    window.fetch = async (...args) => {
      const response = await fetchBeforeCpblPregameStarterStats(...args);
      try {
        const request = args[0];
        const url = typeof request === 'string' ? request : String(request?.url || '');
        if (!/\/functions\/v1\/cpbl-game-detail(?:\?|$)/i.test(url) || !response.ok) return response;

        const detail = await response.clone().json().catch(() => null);
        if (!detail?.ok || String(detail?.league || '').toUpperCase() !== 'CPBL') return response;
        const status = String(detail?.status || detail?.game?.status || '').toLowerCase();
        const hasLivePlays = Array.isArray(detail?.plays) && detail.plays.length > 0;
        if (hasLivePlays || ['live','playing','inprogress','in_progress','final','suspended'].includes(status)) return response;
        if (cpblStarterStatsComplete(detail)) return response;

        await hydrateCpblPregameStarterStats(detail);
        if (!cpblStarterLineupComplete(detail)) return response;

        const headers = new Headers(response.headers);
        headers.delete('content-length');
        headers.delete('content-encoding');
        return new Response(JSON.stringify(detail), {
          status:response.status,
          statusText:response.statusText,
          headers
        });
      } catch {
        return response;
      }
    };
