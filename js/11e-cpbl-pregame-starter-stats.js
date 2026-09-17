    /* ---------- CPBL pregame starter stats ---------- */
    // Scheduled CPBL game-detail can already know the 1-9 batting order while the
    // lightweight probe intentionally skips full-team season-stat requests. Reuse
    // cpbl-pregame-lineup: it reads the same official BOX payload and returns only
    // the 9 starters on each side with AVG / H / HR / RBI.
    const fetchBeforeCpblPregameStarterStats = window.fetch.bind(window);
    const CPBL_PREGAME_STARTER_STATS_URL = `${String(CPBL_GAME_DETAIL_API_URL || '').replace(/\/cpbl-game-detail(?:\?.*)?$/, '')}/cpbl-pregame-lineup`;
    const cpblPregameStarterStatsCache = new Map();
    const CPBL_PREGAME_STARTER_STATS_TTL = 5 * 60 * 1000;

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

    function mergeCpblPregameStarterStats(detail, payload) {
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
      detail.authority = {
        ...(detail.authority || {}),
        pregameLineupStats: 'CPBL official BOX starters only (AVG/H/HR/RBI)'
      };
      return detail;
    }

    async function cpblPregameStarterStats(date, gameId) {
      const key = `${date}|${gameId}`;
      const cached = cpblPregameStarterStatsCache.get(key);
      if (cached && Date.now() - cached.at < CPBL_PREGAME_STARTER_STATS_TTL) return cached.payload;
      const response = await fetchBeforeCpblPregameStarterStats(CPBL_PREGAME_STARTER_STATS_URL, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({appKey:CPBL_APP_KEY,date,gameId}),
        cache:'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok && Number(payload?.counts?.away) >= 9 && Number(payload?.counts?.home) >= 9) {
        cpblPregameStarterStatsCache.set(key, { at:Date.now(), payload });
      }
      return payload;
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

        const date = String(detail?.date || '');
        const gameId = String(detail?.game?.id || detail?.gameId || '');
        if (!date || !gameId) return response;
        const payload = await cpblPregameStarterStats(date, gameId);
        if (!payload?.ok) return response;
        mergeCpblPregameStarterStats(detail, payload);

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
