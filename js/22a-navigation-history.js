    const APP_NAV_HISTORY_KEY = '__diamondScopeNavV1';
    let appNavigationApplyingHistory = false;

    const appNavigationOriginalRenderAll = renderAll;
    const appNavigationOriginalOpenHomeGameDetail = typeof openHomeGameDetail === 'function'
      ? openHomeGameDetail
      : null;
    const appNavigationOriginalCloseHomeGameDetail = typeof closeHomeGameDetail === 'function'
      ? closeHomeGameDetail
      : null;

    function appNavigationRoute() {
      const state = history.state;
      const route = state && typeof state === 'object' ? state[APP_NAV_HISTORY_KEY] : null;
      return route && typeof route === 'object' ? route : null;
    }

    function appNavigationWrite(method, route) {
      const base = history.state && typeof history.state === 'object' ? history.state : {};
      const state = { ...base, [APP_NAV_HISTORY_KEY]: route };
      history[method](state, '', location.href);
    }

    function appNavigationPush(route) {
      appNavigationWrite('pushState', route);
    }

    function appNavigationReplace(route) {
      appNavigationWrite('replaceState', route);
    }

    function appNavigationPageRoute(page = currentPage) {
      const normalized = ['player', 'prediction', 'standings'].includes(String(page)) ? String(page) : 'home';
      return {
        kind: 'page',
        page: normalized,
        playerId: normalized === 'player' ? String(selectedPlayerId || '') : ''
      };
    }

    function appNavigationRouteRepresentsPage(route, page) {
      if (!route) return page === 'home';
      if (route.kind === 'page') return route.page === page;
      if (route.kind === 'standings-team') return page === 'standings';
      if (route.kind === 'game-detail') {
        const parent = route.parent;
        if (parent?.kind === 'page') return parent.page === page;
        if (parent?.kind === 'standings-team') return page === 'standings';
      }
      return false;
    }

    function appNavigationSyncRenderedPage() {
      if (appNavigationApplyingHistory) return;
      const page = ['player', 'prediction', 'standings'].includes(String(currentPage)) ? String(currentPage) : 'home';
      if (page === 'home') return;
      const route = appNavigationRoute();
      if (appNavigationRouteRepresentsPage(route, page)) return;
      appNavigationPush(appNavigationPageRoute(page));
    }

    renderAll = function (...args) {
      const result = appNavigationOriginalRenderAll.apply(this, args);
      appNavigationSyncRenderedPage();
      return result;
    };

    function appNavigationCloseGameDetailNow() {
      if (appNavigationOriginalCloseHomeGameDetail && activeHomeGameDetail) {
        appNavigationOriginalCloseHomeGameDetail();
      }
    }

    function appNavigationApplyPageRoute(route) {
      appNavigationCloseGameDetailNow();
      const page = ['player', 'prediction', 'standings'].includes(String(route?.page))
        ? String(route.page)
        : 'home';

      if (typeof standingsSelectedTeam !== 'undefined') {
        standingsSelectedTeam = '';
        standingsTeamDetailError = '';
      }

      if (page === 'player' && route?.playerId && players.some(player => String(player.id) === String(route.playerId))) {
        selectedPlayerId = String(route.playerId);
        localStorage.setItem('baseballSelectedPlayerId', selectedPlayerId);
      }

      currentPage = page;
      renderAll();
      window.scrollTo({ top: 0, behavior: 'instant' });

      if (page === 'player' && selectedPlayerId) {
        const expectedPlayerId = selectedPlayerId;
        Promise.resolve(loadRecord())
          .then(() => {
            if (currentPage === 'player' && selectedPlayerId === expectedPlayerId) renderAll();
          })
          .catch(error => console.warn('返回球員頁時讀取紀錄失敗', error));
      } else if (page === 'standings') {
        void loadOfficialStandings();
      }
    }

    function appNavigationApplyStandingsTeamRoute(route) {
      appNavigationCloseGameDetailNow();
      currentPage = 'standings';
      standingsSelectedTeam = String(route?.team || '');
      standingsTeamTab = route?.tab === 'schedule' ? 'schedule' : 'h2h';
      standingsTeamDetailError = '';
      renderAll();
      if (standingsSelectedTeam) void loadStandingsTeamDetail(standingsSelectedTeam, { force: false });
      requestAnimationFrame(() => {
        document.getElementById('standingsTeamDetail')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }

    function appNavigationSafeGame(game) {
      try {
        return JSON.parse(JSON.stringify(game || {}));
      } catch {
        return {
          id: String(game?.id || ''),
          away: String(game?.away || ''),
          home: String(game?.home || ''),
          status: String(game?.status || 'scheduled'),
          kindCode: String(game?.kindCode || 'A')
        };
      }
    }

    function appNavigationApplyRoute(route) {
      if (!route || route.kind === 'page') {
        appNavigationApplyPageRoute(route || { kind: 'page', page: 'home' });
        return;
      }

      if (route.kind === 'standings-team') {
        appNavigationApplyStandingsTeamRoute(route);
        return;
      }

      if (route.kind === 'game-detail') {
        const parent = route.parent || { kind: 'page', page: 'home' };
        if (parent.kind === 'standings-team') appNavigationApplyStandingsTeamRoute(parent);
        else appNavigationApplyPageRoute(parent);

        if (appNavigationOriginalOpenHomeGameDetail && route.game && route.league && route.date) {
          appNavigationOriginalOpenHomeGameDetail(route.game, route.league, route.date, {
            tab: route.tab || '',
            __historyRestore: true
          });
        }
      }
    }

    if (appNavigationOriginalOpenHomeGameDetail) {
      openHomeGameDetail = function (game, league, date, options = {}) {
        const previousDetail = activeHomeGameDetail;
        const parentRoute = appNavigationRoute() || appNavigationPageRoute(currentPage);
        const result = appNavigationOriginalOpenHomeGameDetail(game, league, date, options);

        if (!appNavigationApplyingHistory && !options?.__historyRestore && !previousDetail && activeHomeGameDetail) {
          appNavigationPush({
            kind: 'game-detail',
            parent: parentRoute,
            league: String(league || ''),
            date: String(date || ''),
            game: appNavigationSafeGame(game),
            tab: String(activeHomeGameDetail?.centerTab || options?.tab || '')
          });
        }
        return result;
      };
    }

    function appNavigationGoBackOrHome() {
      const route = appNavigationRoute();
      if (route && !(route.kind === 'page' && route.page === 'home') && history.length > 1) {
        history.back();
        return;
      }
      appNavigationApplyingHistory = true;
      try {
        appNavigationApplyPageRoute({ kind: 'page', page: 'home' });
        appNavigationReplace({ kind: 'page', page: 'home', playerId: '' });
      } finally {
        appNavigationApplyingHistory = false;
      }
    }

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest('#backHomeBtn, #predictionBackHomeBtn, #standingsBackHomeBtn')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        appNavigationGoBackOrHome();
        return;
      }

      if (target.closest('#homeGameDetailBack')) {
        const route = appNavigationRoute();
        if (route?.kind !== 'game-detail') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        history.back();
        return;
      }

      if (target.closest('[data-standings-team-close]')) {
        const route = appNavigationRoute();
        if (route?.kind !== 'standings-team') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        history.back();
        return;
      }

      const teamButton = target.closest('[data-standings-team]');
      if (teamButton && currentPage === 'standings') {
        const team = String(teamButton.dataset.standingsTeam || '').trim();
        if (!team) return;
        const current = appNavigationRoute();
        const route = {
          kind: 'standings-team',
          team,
          tab: 'h2h'
        };
        if (current?.kind === 'standings-team') appNavigationReplace(route);
        else appNavigationPush(route);
      }
    }, true);

    window.addEventListener('popstate', event => {
      const route = event.state && typeof event.state === 'object'
        ? event.state[APP_NAV_HISTORY_KEY]
        : null;
      if (!route) return;

      appNavigationApplyingHistory = true;
      try {
        appNavigationApplyRoute(route);
      } finally {
        appNavigationApplyingHistory = false;
      }
    });

    // The app always boots on the home view. Mark the current document entry as
    // home so Android back can leave only when the user is actually at home.
    appNavigationReplace({ kind: 'page', page: 'home', playerId: '' });
