    /* ---------- NPB home inning DOM patch ---------- */
    // The daily schedule feed intentionally contains only status/score. NPB's current
    // inning lives in the shared detail cache. Patch the rendered home cards directly
    // from the tiny summary RPC so the label cannot be lost by an intermediate cache.
    const renderHomeDailyGamesBeforeNpbInningDom = renderHomeDailyGames;
    let npbHomeInningDomRequestSeq = 0;

    async function patchNpbHomeInningDom() {
      if (currentPage !== 'home' || homeDailyGamesLeague() !== 'NPB') return;
      const date = String(els.gameDate?.value || localISODate());
      const key = `NPB|${date}`;
      const cached = homeDailyGamesCache.get(key);
      const games = Array.isArray(cached?.games) ? cached.games : [];
      if (!games.some(game => String(game?.status || '').toLowerCase() === 'live')) return;

      const seq = ++npbHomeInningDomRequestSeq;
      const labels = await homeNpbLiveInningLabels(date);
      if (seq !== npbHomeInningDomRequestSeq) return;
      if (currentPage !== 'home' || homeDailyGamesLeague() !== 'NPB' || String(els.gameDate?.value || localISODate()) !== date) return;
      if (!labels?.size) return;

      const host = els.homeDailyGames;
      if (!host) return;
      host.querySelectorAll('.home-game-card[data-game-detail-index]').forEach(card => {
        const index = Number(card.getAttribute('data-game-detail-index'));
        if (!Number.isInteger(index) || index < 0 || index >= games.length) return;
        const game = games[index];
        if (String(game?.status || '').toLowerCase() !== 'live') return;
        const label = String(labels.get(String(game?.id || '')) || '').trim();
        if (!label) return;
        game.inningLabel = label;
        const statusEl = card.querySelector('.home-game-status');
        if (statusEl) statusEl.textContent = label;
      });
    }

    renderHomeDailyGames = function renderHomeDailyGamesWithNpbInningDom(options = {}) {
      const result = renderHomeDailyGamesBeforeNpbInningDom(options);
      queueMicrotask(() => { void patchNpbHomeInningDom(); });
      return result;
    };
