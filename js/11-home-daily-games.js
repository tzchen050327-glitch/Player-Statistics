    const homeDailyGamesCache = new Map();
    const homeDailyGamesLoading = new Set();
    const homeDailyGamesScrollState = new Map();
    const homeGameDetailCache = new Map();
    const HOME_GAME_DETAIL_AUTO_LIMIT = 2400;
    const HOME_GAME_DETAIL_AUTO_STORAGE_KEY = 'home-game-detail-auto-budget-v1';
    let activeHomeGameDetail = null;
    let homeGameDetailRefreshTimer = 0;
    let homeGameDetailCountdownTimer = 0;
    let homeGameDetailNextRefreshAt = 0;
    let homeGameDetailErrorStreak = 0;
    const HOME_DAILY_GAMES_TTL = 30 * 1000;
    const HOME_DAILY_GAMES_FORCE_FLOOR = 15 * 1000;
    const HOME_DAILY_AUTO_REFRESH_LIMIT = 2400;
    const HOME_DAILY_AUTO_REFRESH_STORAGE_KEY = 'home-daily-games-auto-refresh-budget-v1';
    let homeDailyGamesRefreshTimer = 0;

    function homeDailyGamesAutoRefreshBudget() {
      const day = localISODate();
      try {
        const raw = JSON.parse(localStorage.getItem(HOME_DAILY_AUTO_REFRESH_STORAGE_KEY) || '{}');
        if (raw?.day === day) return { day, count:Math.max(0, Number(raw.count) || 0) };
      } catch {}
      return { day, count:0 };
    }

    function homeDailyGamesAutoRefreshAvailable() {
      return homeDailyGamesAutoRefreshBudget().count < HOME_DAILY_AUTO_REFRESH_LIMIT;
    }

    function consumeHomeDailyGamesAutoRefresh() {
      const state = homeDailyGamesAutoRefreshBudget();
      if (state.count >= HOME_DAILY_AUTO_REFRESH_LIMIT) return false;
      try {
        localStorage.setItem(HOME_DAILY_AUTO_REFRESH_STORAGE_KEY, JSON.stringify({ day:state.day, count:state.count + 1 }));
      } catch {}
      return true;
    }

    function homeDailyGamesHasLive(games = []) {
      return Array.isArray(games) && games.some(game => String(game?.status || '').toLowerCase() === 'live');
    }

    function homeDailyGameStableKey(game = {}) {
      return [
        String(game?.id || ''),
        String(game?.kindCode || ''),
        String(game?.away || ''),
        String(game?.home || ''),
        String(game?.time || '')
      ].join('|');
    }

    function homeDailyGamesDisplayRows(games = []) {
      return (Array.isArray(games) ? games : [])
        .map((game, sourceIndex) => ({ game, sourceIndex }))
        .sort((a, b) => {
          const aStatus = String(a.game?.status || '').toLowerCase();
          const bStatus = String(b.game?.status || '').toLowerCase();
          const aLive = aStatus === 'live' || aStatus === 'suspended';
          const bLive = bStatus === 'live' || bStatus === 'suspended';
          if (aLive !== bLive) return aLive ? -1 : 1;
          return a.sourceIndex - b.sourceIndex;
        });
    }

    function captureHomeDailyGamesScroll(scroller) {
      if (!scroller) return null;
      const cards = [...scroller.querySelectorAll('[data-home-game-key]')];
      const scrollerRect = scroller.getBoundingClientRect();
      const anchor = cards.find(card => card.getBoundingClientRect().right > scrollerRect.left + 1) || cards[0] || null;
      return {
        scrollLeft:Math.max(0, Number(scroller.scrollLeft) || 0),
        anchorKey:String(anchor?.dataset?.homeGameKey || ''),
        anchorOffset:anchor ? anchor.getBoundingClientRect().left - scrollerRect.left : 0
      };
    }

    function restoreHomeDailyGamesScroll(scroller, state) {
      if (!scroller || !state) return;
      const raw = Math.max(0, Number(state.scrollLeft) || 0);
      if (raw <= 8) { scroller.scrollLeft = 0; return; }
      scroller.scrollLeft = raw;
      const anchorKey = String(state.anchorKey || '');
      if (!anchorKey) return;
      requestAnimationFrame(() => {
        const anchor = [...scroller.querySelectorAll('[data-home-game-key]')].find(card => String(card.dataset.homeGameKey || '') === anchorKey);
        if (!anchor) return;
        const scrollerRect = scroller.getBoundingClientRect();
        const currentOffset = anchor.getBoundingClientRect().left - scrollerRect.left;
        scroller.scrollLeft += currentOffset - (Number(state.anchorOffset) || 0);
      });
    }
    function homeDailyGamesStartMs(league, date, time) {
      const m = String(time || '').match(/(\d{1,2}):(\d{2})/);
      if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return NaN;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
      const offsetHours = league === 'NPB' || league === 'KBO' ? 9 : league === 'MLB' ? -4 : 8;
      const [y, mo, d] = String(date).split('-').map(Number);
      return Date.UTC(y, mo - 1, d, hh - offsetHours, mm, 0, 0);
    }

    function cpblAlignedRefreshDelay(now = Date.now()) {
      const d = new Date(now);
      const withinMinute = d.getSeconds() * 1000 + d.getMilliseconds();
      for (const mark of [25 * 1000, 55 * 1000]) {
        if (withinMinute < mark) return Math.max(250, mark - withinMinute);
      }
      return Math.max(250, 60 * 1000 - withinMinute + 25 * 1000);
    }

    function homeDailyGamesRefreshDelay(league, date, games = []) {
      if (String(date || '') !== localISODate()) return 0;
      if (homeDailyGamesHasLive(games)) {
        if (league === 'CPBL') return cpblAlignedRefreshDelay();
        // MLB games span much more of the day, so poll it less aggressively.
        return league === 'MLB' ? 2 * 60 * 1000 : league === 'NPB' ? 45 * 1000 : 30 * 1000;
      }
      if (league === 'NPB' && (Array.isArray(games) ? games : []).some(game => String(game?.status || '').toLowerCase() === 'cancelled')) {
        // NPB official pages can temporarily surface ambiguous cancellation text.
        // Keep rechecking today's card instead of freezing a potentially stale cancelled state.
        return 45 * 1000;
      }
      const scheduled = (Array.isArray(games) ? games : []).filter(game => String(game?.status || '').toLowerCase() === 'scheduled');
      if (!scheduled.length) return 0;
      const starts = scheduled.map(game => homeDailyGamesStartMs(league, date, game?.time)).filter(Number.isFinite);
      if (!starts.length) return 60 * 60 * 1000;
      const msUntil = Math.min(...starts) - Date.now();
      if (league === 'CPBL' && msUntil <= 2 * 60 * 1000) return cpblAlignedRefreshDelay();
      if (msUntil <= 15 * 60 * 1000) return 2 * 60 * 1000;
      if (msUntil <= 60 * 60 * 1000) return 10 * 60 * 1000;
      if (msUntil <= 3 * 60 * 60 * 1000) return 20 * 60 * 1000;
      return 60 * 60 * 1000;
    }

    function stopHomeDailyGamesAutoRefresh() {
      if (homeDailyGamesRefreshTimer) clearTimeout(homeDailyGamesRefreshTimer);
      homeDailyGamesRefreshTimer = 0;
    }

    function scheduleHomeDailyGamesAutoRefresh() {
      stopHomeDailyGamesAutoRefresh();
      if (activeHomeGameDetail) return;
      if (document.visibilityState !== 'visible' || currentPage !== 'home') return;
      const league = homeDailyGamesLeague();
      const date = String(els.gameDate?.value || localISODate());
      if (!league) return;
      if (league === 'CPBL' && date === localISODate()) {
        window.dispatchEvent(new CustomEvent('cpbl-live-watch-day', { detail:{ date } }));
        if (window.__cpblDayRealtimeConnected) return;
      } else {
        window.dispatchEvent(new CustomEvent('cpbl-live-unwatch-day'));
      }
      const cached = homeDailyGamesCache.get(`${league}|${date}`);
      const games = Array.isArray(cached?.games) ? cached.games : [];
      let delay = homeDailyGamesRefreshDelay(league, date, games);
      if (league === 'CPBL') delay = window.__cpblDayRealtimeConnected ? 0 : 5 * 60 * 1000;
      // On upstream errors, slow down retries instead of hammering Supabase / official sites.
      if (cached?.error) delay = Math.max(delay || 0, 10 * 60 * 1000);
      if (!delay || !homeDailyGamesAutoRefreshAvailable()) return;
      if (globalThis.navigator?.connection?.saveData) delay *= 2;
      homeDailyGamesRefreshTimer = setTimeout(() => {
        homeDailyGamesRefreshTimer = 0;
        if (document.visibilityState !== 'visible' || currentPage !== 'home' || homeDailyGamesLeague() !== league || String(els.gameDate?.value || localISODate()) !== date) return;
        if (!consumeHomeDailyGamesAutoRefresh()) return;
        renderHomeDailyGames({ force:true });
      }, delay);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (activeHomeGameDetail) refreshActiveHomeGameDetail();
        // Reuse a still-fresh result instead of forcing another Edge Function invocation on every focus change.
        else if (currentPage === 'home') renderHomeDailyGames();
      } else {
        stopHomeDailyGamesAutoRefresh();
        stopHomeGameDetailRefresh();
      }
    });

    window.addEventListener('cpbl-live-day-update', event => {
      const updateDate = String(event?.detail?.detail?.date || event?.detail?.row?.game_date || '');
      const selectedDate = String(els.gameDate?.value || localISODate());
      if (!updateDate || updateDate !== selectedDate) return;
      if (currentPage !== 'home' || homeDailyGamesLeague() !== 'CPBL') return;
      // Realtime means the backend cache changed (lineup, score, inning, final, etc.).
      // Re-read the lightweight daily feed so lineupReady/status/score are reflected immediately.
      const key = `CPBL|${updateDate}`;
      const cached = homeDailyGamesCache.get(key);
      if (cached) cached.at = 0;
      void loadHomeDailyGames('CPBL', updateDate, { force:true });
    });

    function homeDailyGamesLeague() {
      if (homeRootSection === 'international') return '';
      if (homeProCountry === 'TW') return 'CPBL';
      if (homeProCountry === 'JP') return 'NPB';
      if (homeProCountry === 'KR') return 'KBO';
      if (homeProCountry === 'US') return 'MLB';
      return '';
    }

    function homeDailyGamesLeagueLabel(league) {
      return ({ CPBL:'中華職棒', NPB:'日本職棒', KBO:'韓國職棒', MLB:'MLB' })[league] || league;
    }

    function homeDailyGameStatusLabel(game) {
      const status = String(game?.status || '').toLowerCase();
      const league = homeDailyGamesLeague();
      if (status === 'final') return '已結束';
      if (status === 'live') return String(game?.inningLabel || '').trim() || '比賽中';
      if (status === 'cancelled') return league === 'NPB' ? (String(game?.postponementReason || '').trim() || '延賽') : '取消／延期';
      if ((league === 'CPBL' || league === 'NPB') && game?.lineupReady) return '先發打序';
      return String(game?.time || '').trim() || '未開打';
    }

    function homeDailyGameScore(value) {
      if (value === null || value === undefined || value === '') return '—';
      const number = Number(value);
      return Number.isFinite(number) ? String(number) : '—';
    }

    async function leagueDailyGamesRequest(league, date) {
      const requestUrl = league === 'KBO'
        ? KBO_GAMES_API_URL
        : league === 'MLB'
          ? LEAGUE_GAMES_B_API_URL
          : LEAGUE_GAMES_A_API_URL;
      const response = await fetch(requestUrl, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'daily-games',
          league,
          date,
          ...(league === 'CPBL' ? { kindCodes:['A','E','C'] } : {})
        })
      });
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text || '{}'); } catch {}
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || `當日賽事讀取失敗（${response.status}）`);
      }
      let games = Array.isArray(data.games) ? data.games : [];
      if (league === 'NPB') {
        games = games.map(game => {
          const status = String(game?.status || '').toLowerCase();
          const awayScore = game?.awayScore;
          const homeScore = game?.homeScore;
          const hasScore = awayScore !== null && awayScore !== undefined && awayScore !== ''
            || homeScore !== null && homeScore !== undefined && homeScore !== '';
          if (status === 'cancelled' && hasScore) {
            return { ...game, status:String(date || '') < localISODate() ? 'final' : 'live' };
          }
          return game;
        });
      }
      // CPBL schedule history can occasionally omit an end marker and look live/scheduled.
      // A date before today is immutable history in the UI, so normalize those states to FINAL.
      if (league === 'CPBL' && String(date || '') < localISODate()) {
        games = games.map(game => {
          const status = String(game?.status || '').toLowerCase();
          return ['live','scheduled','suspended'].includes(status)
            ? { ...game, status:'final' }
            : game;
        });
      }
      return games;
    }

    async function loadHomeDailyGames(league, date, { force = false } = {}) {
      const key = `${league}|${date}`;
      const now = Date.now();
      const cached = homeDailyGamesCache.get(key);
      const age = cached ? now - Number(cached.at || 0) : Infinity;
      if (!force && cached && age < HOME_DAILY_GAMES_TTL) return cached.games || [];
      // Even forced refreshes are coalesced for a short floor to avoid double-clicks / rapid tab changes.
      if (force && cached && age < HOME_DAILY_GAMES_FORCE_FLOOR) return cached.games || [];
      if (homeDailyGamesLoading.has(key)) return null;

      homeDailyGamesLoading.add(key);
      try {
        let games = await leagueDailyGamesRequest(league, date);
        if (league === 'CPBL') {
          games = (Array.isArray(games) ? games : []).filter(game => String(game?.kindCode || 'A').toUpperCase() !== 'D');
        }

        // Outer cards use only the daily schedule feed. Single-game detail is fetched only after the user opens a game.

        homeDailyGamesCache.set(key, { at:Date.now(), games, error:'' });
        return games;
      } catch (error) {
        homeDailyGamesCache.set(key, {
          at:Date.now(),
          games:Array.isArray(cached?.games) ? cached.games : [],
          error:error?.message || '當日賽事讀取失敗。'
        });
        return null;
      } finally {
        homeDailyGamesLoading.delete(key);
        if (currentPage === 'home' && homeDailyGamesLeague() === league && String(els.gameDate?.value || '') === date) {
          renderHomeDailyGames({ skipLoad:true });
        }
      }
    }

    function renderHomeDailyGames({ force = false, skipLoad = false } = {}) {
      const host = els.homeDailyGames;
      if (!host) return;

      const league = homeDailyGamesLeague();
      const date = String(els.gameDate?.value || localISODate());
      if (!league || homeRootSection === 'international') {
        host.classList.add('hidden');
        host.innerHTML = '';
        return;
      }
      host.classList.remove('hidden');

      const key = `${league}|${date}`;
      const existingScroller = host.querySelector('.home-games-scroller');
      if (existingScroller) {
        const captured = captureHomeDailyGamesScroll(existingScroller);
        const existingKey = String(existingScroller.dataset.homeGamesKey || key);
        if (captured) homeDailyGamesScrollState.set(existingKey, captured);
      }
      const cached = homeDailyGamesCache.get(key) || null;
      const loading = homeDailyGamesLoading.has(key);
      const fresh = cached && Date.now() - Number(cached.at || 0) < HOME_DAILY_GAMES_TTL;
      const games = Array.isArray(cached?.games) ? cached.games : [];
      const displayRows = homeDailyGamesDisplayRows(games);
      const error = String(cached?.error || '');
      const leagueLabel = homeDailyGamesLeagueLabel(league);
      const dateLabel = date.replaceAll('-', '/');

      let bodyHtml = '';
      if (!cached && !loading) {
        bodyHtml = '<div class="home-games-state">正在讀取官方賽程…</div>';
      } else if (loading && !games.length) {
        bodyHtml = '<div class="home-games-state"><span class="home-games-loading-dot"></span>正在讀取官方賽程…</div>';
      } else if (error && !games.length) {
        bodyHtml = `<div class="home-games-state error"><span>${escapeHtml(error)}</span><button class="press-btn home-games-retry" type="button">重新整理</button></div>`;
      } else if (!games.length) {
        bodyHtml = `<div class="home-games-state">這個日期沒有找到 ${escapeHtml(leagueLabel)} 比賽。</div>`;
      } else {
        bodyHtml = `<div class="home-games-scroller ${league === 'MLB' ? 'is-mlb' : ''}" data-home-games-key="${escapeAttr(key)}">${displayRows.map(({ game, sourceIndex }) => {
          const gameKey = homeDailyGameStableKey(game);
          const status = String(game?.status || 'scheduled').toLowerCase();
          const statusLabel = homeDailyGameStatusLabel(game);
          const lineupReady = status === 'scheduled' && (league === 'CPBL' || league === 'NPB') && Boolean(game?.lineupReady);
          const showScore = status === 'live' || status === 'final';
          const awayScore = showScore ? homeDailyGameScore(game?.awayScore) : '—';
          const homeScore = showScore ? homeDailyGameScore(game?.homeScore) : '—';
          const venue = String(game?.venue || '').trim();
          const awayName = league === 'MLB' ? mlbTeamZh(game?.away || '') : String(game?.away || '');
          const homeName = league === 'MLB' ? mlbTeamZh(game?.home || '') : String(game?.home || '');
          return `
            <article class="home-game-card status-${escapeAttr(status)} ${homeGameDetailSupported(league) ? 'is-detail-enabled' : ''}" data-home-game-key="${escapeAttr(gameKey)}" ${homeGameDetailSupported(league) ? `data-game-detail-index="${sourceIndex}" role="button" tabindex="0" aria-label="查看 ${escapeAttr(awayName)} 對 ${escapeAttr(homeName)} 全場逐打席"` : ''}>
              <div class="home-game-card-top">
                <span class="home-game-status status-${escapeAttr(status)} ${lineupReady ? 'is-lineup-ready' : ''}">${escapeHtml(statusLabel)}</span>
                ${game?.time && ['final','live'].includes(status) && league !== 'CPBL' && league !== 'NPB'
                  ? `<span class="home-game-time">${escapeHtml(String(game.time))}</span>`
                  : ''}
              </div>
              <div class="home-game-team">
                <span class="home-game-team-name">${escapeHtml(awayName || '客隊')}</span>
                <strong class="home-game-score">${escapeHtml(awayScore)}</strong>
              </div>
              <div class="home-game-team">
                <span class="home-game-team-name">${escapeHtml(homeName || '主隊')}</span>
                <strong class="home-game-score">${escapeHtml(homeScore)}</strong>
              </div>
              <div class="home-game-venue">${escapeHtml(venue || '場地未提供')}</div>
            </article>`;
        }).join('')}</div>`;
      }

      scheduleHomeDailyGamesAutoRefresh();
      host.innerHTML = `
        <section class="home-daily-games-shell">
          <div class="home-daily-games-head">
            <div class="home-daily-games-title">
              <strong>當日賽事</strong>
              <span class="home-league-live-row">
                <span>${escapeHtml(leagueLabel)}</span>
                ${homeDailyGamesHasLive(games) && homeDailyGamesAutoRefreshAvailable() ? `<span class="home-live-battery ${loading ? 'is-refreshing' : ''}" title="比賽進行中，自動更新比分" aria-label="比賽進行中，自動更新比分">
                  <svg class="battery-player battery-pitcher battery-pitcher-formal" viewBox="0 0 44 44" aria-hidden="true">
                    <g class="battery-pitcher-figure">
                      <g class="battery-pitcher-core">
                        <path class="battery-cap" d="M9 8.7c1.2-4 4.4-6.2 8.4-5.5 2.8.5 4.7 2.1 5.8 4.7l-9.3 1.9Z"></path>
                        <circle class="battery-skin" cx="16.4" cy="10.8" r="4.2"></circle>
                        <path class="battery-uniform" d="M12.8 15.1c2-1.2 5.7-1.1 7.8.2l3.5 9.4-3.5 3.2-4-7.3-3.1 7.1-4-2.2Z"></path>
                      </g>
                      <path class="battery-drive-leg" d="M13.9 24.2 9.2 36.7l4.2 1.1 4.7-10.6-1.4-3.7Z"></path>
                      <path class="battery-stride-leg" d="M18.4 24.2c3.6 2.5 6 6.1 7.9 10.1l-3.8 1.9c-1.9-3.5-4.1-6.1-6.6-7.6Z"></path>
                      <g class="battery-throw-arm-formal">
                        <path d="M20 16.3c4.7.3 8.7 2.8 12.1 5.9l-2.4 3.1c-3-2.4-6.3-4-10.5-4.3Z"></path>
                        <circle class="battery-hand" cx="31.8" cy="23.5" r="1.7"></circle>
                      </g>
                      <g class="battery-glove-side-formal">
                        <path class="battery-glove-arm" d="M12.7 16.5 7 20.8l2 3.4 6.5-3.5Z"></path>
                        <ellipse class="battery-glove" cx="6.8" cy="22" rx="3.8" ry="3.1"></ellipse>
                      </g>
                    </g>
                  </svg>
                  <span class="battery-ball"><i></i></span>
                  <svg class="battery-player battery-catcher" viewBox="0 0 44 44" aria-hidden="true">
                    <g class="battery-catcher-crouch">
                      <path class="battery-mask" d="M14 5.6c2.2-2.1 6.4-2.4 9-.6l1.7 4.5-2.4 5.2-7.7-.4-2.1-5.1Z"></path>
                      <path class="battery-mask-line" d="M14.5 8.6h9.2M16.1 5.8l-.3 7.1M21.2 5.5l.7 7.4"></path>
                      <path class="battery-chest" d="M13.7 14.1c3-1.2 7.5-1 10 .5l2.2 10-5.3 2.8-4.2-1-4.6-2.4Z"></path>
                      <path class="battery-catcher-leg" d="m14 23.6-7 7.6 3.7 3.5 7.5-5.4 6.8 5.2 3.4-3.4-6.4-7.5Z"></path>
                      <path class="battery-receive-arm" d="M13.8 16.1 6.7 19l1.6 3.7 7.8-2.6Z"></path>
                      <ellipse class="battery-mitt" cx="5.7" cy="20.7" rx="4.2" ry="3.4"></ellipse>
                    </g>
                    <g class="battery-catcher-stand">
                      <path class="battery-mask" d="M14.8 3.8c2.2-2 6.2-2.2 8.8-.4l1.5 4.1-2.1 4.9-7.6-.3-2-4.9Z"></path>
                      <path class="battery-mask-line" d="M15.2 6.6h9M16.8 4l-.3 7M21.8 3.9l.6 7"></path>
                      <path class="battery-chest" d="M14.1 12.1c3.1-1.2 7.2-1.1 9.7.4l2 10.2-4.6 2.2-4.4-.5-4.2-2.8Z"></path>
                      <path class="battery-stand-leg" d="m15.3 22.1-3.7 14.7 4.1.8 3.5-10.7 4 10.5 4-1.2-4.1-14Z"></path>
                      <g class="battery-return-arm">
                        <path d="M22.8 13.5c4.9 1 8.3 4.1 10.7 7.1l-2.6 2.5c-2.8-2.8-5.8-4.7-9.4-5.2Z"></path>
                        <circle class="battery-hand" cx="33.4" cy="21.9" r="1.7"></circle>
                      </g>
                      <g class="battery-catcher-glove-side">
                        <path class="battery-glove-arm" d="M14.2 14.3 8.1 18l1.7 3.3 6.8-3.4Z"></path>
                        <ellipse class="battery-glove" cx="7.7" cy="19.4" rx="3.4" ry="2.9"></ellipse>
                      </g>
                    </g>
                  </svg>
                </span>` : ''}
              </span>
            </div>
            <div class="home-daily-games-meta">
              <span>${escapeHtml(dateLabel)}</span>
              ${games.length ? `<span>${games.length} 場</span>` : ''}
              ${loading && games.length ? '<span>更新中…</span>' : ''}
            </div>
          </div>
          ${bodyHtml}
        </section>`;

      const renderedScroller = host.querySelector('.home-games-scroller');
      const savedScrollState = homeDailyGamesScrollState.get(key) || null;
      restoreHomeDailyGamesScroll(renderedScroller, savedScrollState);
      renderedScroller?.addEventListener('scroll', () => {
        const captured = captureHomeDailyGamesScroll(renderedScroller);
        if (captured) homeDailyGamesScrollState.set(key, captured);
      }, { passive:true });

      host.querySelector('.home-games-retry')?.addEventListener('click', () => {
        homeDailyGamesCache.delete(key);
        renderHomeDailyGames({ force:true });
      });
      if (homeGameDetailSupported(league)) {
        host.querySelectorAll('[data-game-detail-index]').forEach(card => {
          const open = () => {
            const index = Number(card.dataset.gameDetailIndex);
            const game = games[index];
            if (game) openHomeGameDetail(game, league, date);
          };
          card.addEventListener('click', open);
          card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          });
        });
      }

      if (!skipLoad && (force || !cached || !fresh) && !loading) {
        void loadHomeDailyGames(league, date, { force }).then(() => {});
      }
    }
