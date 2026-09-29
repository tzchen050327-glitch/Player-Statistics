    const SPECIAL_GAMES_API_URL = `${SUPABASE_A_FUNCTIONS_BASE}/special-games`;

    async function loadSpecialGames() {
      if (!els.homeSpecialGamesExplorer) return [];
      try {
        const response = await fetch(SPECIAL_GAMES_API_URL, { cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        homeSpecialGames = (Array.isArray(payload?.games) ? payload.games : []).filter(game => !['CPBL','中職','中華職棒'].includes(String(game?.league || '').trim().toUpperCase()));
      } catch (error) {
        console.warn('特殊比賽讀取失敗', error);
        homeSpecialGames = [];
      }
      return homeSpecialGames;
    }

    function renderSpecialGamesExplorer() {
      if (!els.homeSpecialGamesExplorer || homeRootSection !== 'special') return;
      if (!Array.isArray(homeSpecialGames) || !homeSpecialGames.length) {
        els.homeSpecialGamesExplorer.innerHTML = `
          <div class="special-games-empty">
            <strong>目前沒有特殊比賽</strong>
            <span>你指定要收錄的比賽之後會顯示在這裡。</span>
          </div>`;
        void loadSpecialGames().then(() => {
          if (homeRootSection === 'special' && homeSpecialGames.length) renderSpecialGamesExplorer();
        });
        return;
      }
      els.homeSpecialGamesExplorer.innerHTML = homeSpecialGames.map(game => `
        <article class="special-game-card">
          <div class="special-game-card-top">
            <strong>${escapeHtml(game.title || '特殊比賽')}</strong>
            <span>${escapeHtml(game.status || '')}</span>
          </div>
          <div class="special-game-matchup">${escapeHtml(game.away_team || '')}<b>VS</b>${escapeHtml(game.home_team || '')}</div>
          <div class="special-game-meta">${escapeHtml([game.game_date, game.game_time, game.venue].filter(Boolean).join('｜'))}</div>
        </article>`).join('');
    }
