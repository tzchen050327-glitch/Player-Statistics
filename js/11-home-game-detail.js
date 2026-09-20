    function homeGameDetailSupported(league) {
      return league === 'CPBL' || league === 'NPB';
    }

    function homeGameDetailKey(league, date, game = {}) {
      return [league, date, String(game?.kindCode || ''), String(game?.id || ''), String(game?.away || ''), String(game?.home || '')].join('|');
    }

    function homeGameDetailBudget() {
      const day = localISODate();
      try {
        const raw = JSON.parse(localStorage.getItem(HOME_GAME_DETAIL_AUTO_STORAGE_KEY) || '{}');
        if (raw?.day === day) return { day, count:Math.max(0, Number(raw.count) || 0) };
      } catch {}
      return { day, count:0 };
    }

    function homeGameDetailAutoAvailable() {
      return homeGameDetailBudget().count < HOME_GAME_DETAIL_AUTO_LIMIT;
    }

    function consumeHomeGameDetailAuto() {
      const state = homeGameDetailBudget();
      if (state.count >= HOME_GAME_DETAIL_AUTO_LIMIT) return false;
      try {
        localStorage.setItem(HOME_GAME_DETAIL_AUTO_STORAGE_KEY, JSON.stringify({ day:state.day, count:state.count + 1 }));
      } catch {}
      return true;
    }

    async function leagueGameDetailRequest(league, date, game, force = false) {
      const cpblKindCode = String(game?.kindCode || 'A').trim().toUpperCase();
      const detailApiUrl = league === 'CPBL'
        ? (cpblKindCode === 'D'
            ? CPBL_MINOR_GAME_DETAIL_API_URL
            : (cpblKindCode === 'E' || cpblKindCode === 'C' ? CPBL_POSTSEASON_DETAIL_API_URL : CPBL_GAME_DETAIL_API_URL))
        : league === 'NPB'
          ? NPB_GAME_DETAIL_API_URL
          : (league === 'MLB' || league === 'KBO')
            ? LEAGUE_GAME_DETAIL_B_API_URL
            : LEAGUE_GAME_DETAIL_A_API_URL;
      const response = await fetch(detailApiUrl, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'game-detail',
          league,
          date,
          gameId:String(game?.id || ''),
          kindCode:String(game?.kindCode || ''),
          competition:String(game?.competition || ''),
          away:String(game?.away || ''),
          home:String(game?.home || ''),
          venue:String(game?.venue || ''),
          status:String(game?.status || ''),
          force:Boolean(force)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `單場逐打席讀取失敗（${response.status}）`);
      // NPB historical pages can lack the exact end-time marker used by the backend status parser.
      // If official play-by-play exists, this is not a scheduled pregame page.
      if (league === 'NPB' && String(data?.status || '').toLowerCase() === 'scheduled'
          && Array.isArray(data?.plays) && data.plays.length > 0) {
        data.status = 'final';
        if (data.game && typeof data.game === 'object') data.game.status = 'final';
      }
      // A postseason card already knows its exact stage. Keep that context even if
      // an old NPB page contains generic navigation text for other competitions.
      if (game?.competition) {
        data.competition = String(game.competition);
        data.competitionLabel = String(game.competitionLabel || data.competitionLabel || '');
        if (data.game && typeof data.game === 'object') {
          data.game.competition = data.competition;
          data.game.competitionLabel = data.competitionLabel;
        }
      } else if (league === 'NPB') {
        // Normal NPB game cards have no postseason competition attached. Some NPB
        // pages include a generic 日本シリーズ navigation link, which the legacy
        // backend classifier can mistake for the active competition. Normalize the
        // whole scope, not just the label, so the lineup header cannot still render
        // LINEUP · 日本大賽 from a stale competition-scoped statsScope.
        data.competition = 'regular';
        data.competitionLabel = '例行賽';
        data.statsScope = 'season';
        if (data.authority && typeof data.authority === 'object') data.authority.statsScope = 'season';
        if (data.game && typeof data.game === 'object') {
          data.game.competition = 'regular';
          data.game.competitionLabel = '例行賽';
        }
        data.statsScope = 'season';
        if (data.authority && typeof data.authority === 'object') data.authority.statsScope = 'season';
        if (data.game && typeof data.game === 'object') {
          data.game.competition = 'regular';
          data.game.competitionLabel = '例行賽';
        }
      }
      return data;
    }

    async function pregameStarterRequest(league, date, game) {
      const endpoint = league === 'NPB'
        ? NPB_PREGAME_STARTERS_API_URL
        : (() => {
            const base = (league === 'MLB' || league === 'KBO')
              ? LEAGUE_GAME_DETAIL_B_API_URL
              : LEAGUE_GAME_DETAIL_A_API_URL;
            const url = new URL(base);
            url.pathname = url.pathname.replace(/\/[^/]+$/, '/pregame-starters');
            return url.toString();
          })();
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'pregame-starters',
          league,
          date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || '')
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `先發投手資料讀取失敗（${response.status}）`);
      return data;
    }

    function homeGameDetailStatusLabel(detail) {
      const status = String(detail?.status || '').toLowerCase();
      if (status === 'live') return ['比賽中', detail?.game?.inningLabel || ''].filter(Boolean).join('｜');
      if (status === 'final') return '比賽結束';
      if (status === 'cancelled') return '延賽／取消';
      return '尚未開打';
    }

    function homeGameDetailScore(value) {
      const n = Number(value);
      return Number.isFinite(n) ? String(n) : '—';
    }

    function homeGameDetailOutLabel(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      if (/^\d+$/.test(raw)) return `${Number(raw)}出局`;
      return raw.replace(/(\d+)\s*アウト/g, '$1出局').replace(/(\d+)\s*outs?/gi, '$1出局');
    }

    function homeGameDetailBasesLabel(value) {
      let raw = String(value ?? '').trim();
      if (!raw) return '';
      raw = raw.replace(/走者なし|ランナーなし|no runners?/gi, '壘上無人')
        .replace(/一塁|1塁/g, '一壘')
        .replace(/二塁|2塁/g, '二壘')
        .replace(/三塁|3塁/g, '三壘');
      if (/壘上無人/.test(raw)) return '壘上無人';
      if (/滿壘/.test(raw)) return '一、二、三壘有人';
      const bases = [];
      if (/一壘|(?:^|[^0-9])1(?:[^0-9]|$)/.test(raw)) bases.push('一');
      if (/二壘|(?:^|[^0-9])2(?:[^0-9]|$)/.test(raw)) bases.push('二');
      if (/三壘|(?:^|[^0-9])3(?:[^0-9]|$)/.test(raw)) bases.push('三');
      if (bases.length) return `${[...new Set(bases)].join('、')}壘有人`;
      return /壘$/.test(raw) ? `${raw}有人` : raw;
    }

    function homeGameDetailRbiLabel(value) {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? `${Math.floor(n)}打點` : '';
    }

    function homeGameDetailMeta(play) {
      return [
        homeGameDetailOutLabel(play?.outs),
        homeGameDetailBasesLabel(play?.bases),
        homeGameDetailRbiLabel(play?.rbi)
      ].map(v => String(v || '').trim()).filter(Boolean).join('｜');
    }

    function homeGameDetailDisplayPlay(play = {}) {
      const description = String(play?.description || '').trim();
      const batter = String(play?.batter || play?.hitter || '').trim();
      const result = String(play?.result || play?.raw || '').trim();
      if (!description) return Boolean(batter && result);
      const hasChange = /更換(?:代打|代跑|選手|守備|投手)/.test(description);
      const hasAction = /(好球|壞球|揮棒|擊出|打者出局|安打|四壞|故意四壞|觸身|死球|三振|雙殺|三殺|犧牲|犧短|犧飛|失誤|趁傳|全壘打|野手選擇|飛球|滾地球)/.test(description);
      if (hasChange && !hasAction) return false;
      return Boolean(batter && (result || hasAction));
    }

    function homeGameDetailGroups(plays = []) {
      const map = new Map();
      for (const play of Array.isArray(plays) ? plays : []) {
        const inning = Math.max(0, Number(play?.inning) || 0);
        const half = String(play?.half || '');
        const key = `${inning}|${half}`;
        if (!map.has(key)) map.set(key, { inning, half, team:String(play?.team || ''), plays:[] });
        map.get(key).plays.push(play);
      }
      return [...map.values()].sort((a,b) => a.inning - b.inning || (a.half === 'top' ? -1 : 1));
    }

    function ensureHomeGameDetailOverlay() {
      let overlay = document.getElementById('homeGameDetailOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'homeGameDetailOverlay';
      overlay.className = 'home-game-detail-overlay hidden';
      overlay.innerHTML = '<div class="home-game-detail-page" role="dialog" aria-modal="true" aria-label="單場逐打席"><div id="homeGameDetailBody"></div></div>';
      document.body.appendChild(overlay);
      return overlay;
    }

    function detailRunsFromScoreboard(detail, side) {
      const values = Array.isArray(detail?.scoreboard?.[side]) ? detail.scoreboard[side] : [];
      let total = 0;
      let found = false;
      for (const value of values) {
        const raw = String(value ?? '').trim();
        if (!/^\d+$/.test(raw)) continue;
        total += Number(raw);
        found = true;
      }
      return found ? total : null;
    }

    function homeDetailLineupReady(detail) {
      return ['away','home'].every(side => {
        const batters = Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : [];
        return batters.length >= 9 && batters.slice(0, 9).every((player, index) => {
          const name = String(player?.fullName || player?.name || '').trim();
          const order = Number(player?.order || index + 1);
          return Boolean(name) && order >= 1 && order <= 9;
        });
      });
    }

    function syncHomeDailyGameFromDetail(league, date, game, detail) {
      const info = detail?.game || {};
      const awayRuns = detailRunsFromScoreboard(detail, 'away');
      const homeRuns = detailRunsFromScoreboard(detail, 'home');
      const normalizedStatus = String(detail?.status || '').toLowerCase();
      const apply = target => {
        if (!target) return;
        const awayScore = awayRuns !== null ? awayRuns : Number(info?.awayScore);
        const homeScore = homeRuns !== null ? homeRuns : Number(info?.homeScore);
        if (Number.isFinite(awayScore)) target.awayScore = awayScore;
        if (Number.isFinite(homeScore)) target.homeScore = homeScore;
        if (normalizedStatus) target.status = normalizedStatus;
        if (info?.id && !target.id) target.id = info.id;
        if (homeDetailLineupReady(detail)) target.lineupReady = true;
      };
      apply(game);
      const daily = homeDailyGamesCache.get(`${league}|${date}`);
      const games = Array.isArray(daily?.games) ? daily.games : [];
      const expectedKind = league === 'CPBL'
        ? String(info?.kindCode || game?.kindCode || 'A').toUpperCase()
        : '';
      const sameKind = item => league !== 'CPBL'
        || String(item?.kindCode || 'A').toUpperCase() === expectedKind;
      const target = games.find(item =>
        (((info?.id && item?.id && String(info.id) === String(item.id))
          || (String(item?.away || '') === String(info?.away || game?.away || '')
            && String(item?.home || '') === String(info?.home || game?.home || '')))
          && sameKind(item))
      );
      apply(target);
    }

    function updateHomeGameDetailRefreshCountdown() {
      const el = document.getElementById('homeGameDetailRefreshCountdown');
      if (!el) return;
      const realtimeConnected = activeHomeGameDetail?.league === 'CPBL'
        ? window.__cpblRealtimeConnected
        : activeHomeGameDetail?.league === 'NPB'
          ? window.__npbRealtimeConnected
          : false;
      if (realtimeConnected) {
        el.textContent = '即時推送';
        return;
      }
      if (activeHomeGameDetail?.loading) {
        el.textContent = '更新中…';
        return;
      }
      if (!homeGameDetailNextRefreshAt) {
        el.textContent = '';
        return;
      }
      const seconds = Math.max(0, Math.ceil((homeGameDetailNextRefreshAt - Date.now()) / 1000));
      el.textContent = `${seconds}秒後更新`;
    }

    function startHomeGameDetailRefreshCountdown(delay) {
      if (homeGameDetailCountdownTimer) clearInterval(homeGameDetailCountdownTimer);
      homeGameDetailNextRefreshAt = Date.now() + Math.max(0, Number(delay) || 0);
      updateHomeGameDetailRefreshCountdown();
      homeGameDetailCountdownTimer = setInterval(updateHomeGameDetailRefreshCountdown, 1000);
    }

    function stopHomeGameDetailRefreshCountdown() {
      if (homeGameDetailCountdownTimer) clearInterval(homeGameDetailCountdownTimer);
      homeGameDetailCountdownTimer = 0;
      homeGameDetailNextRefreshAt = 0;
      updateHomeGameDetailRefreshCountdown();
    }

    function stopHomeGameDetailRefresh() {
      if (homeGameDetailRefreshTimer) clearTimeout(homeGameDetailRefreshTimer);
      homeGameDetailRefreshTimer = 0;
      stopHomeGameDetailRefreshCountdown();
    }

    function closeHomeGameDetail() {
      stopHomeGameDetailRefresh();
      window.dispatchEvent(new CustomEvent('cpbl-live-unwatch'));
      window.dispatchEvent(new CustomEvent('npb-live-unwatch'));
      document.body.classList.remove('gdx-cpbl-landscape');
      activeHomeGameDetail = null;
      const overlay = document.getElementById('homeGameDetailOverlay');
      if (overlay) overlay.classList.add('hidden');
      document.body.classList.remove('home-game-detail-open');
      if (currentPage === 'home') scheduleHomeDailyGamesAutoRefresh();
    }

    function homeStarterStatItems(starter) {
      const stats = starter?.stats || {};
      const out = [];
      const win = String(stats.wins ?? '').trim();
      const loss = String(stats.losses ?? '').trim();
      if (win || loss) out.push(['勝敗', String(win || 0) + '-' + String(loss || 0)]);
      if (String(stats.era ?? '').trim()) out.push(['ERA', String(stats.era)]);
      if (String(stats.ip ?? '').trim()) out.push(['IP', String(stats.ip)]);
      if (String(stats.so ?? '').trim()) out.push(['SO', String(stats.so)]);
      if (String(stats.hits ?? '').trim()) out.push(['被安打', String(stats.hits)]);
      if (String(stats.homeRuns ?? '').trim()) out.push(['被全壘打', String(stats.homeRuns)]);
      if (String(stats.fourDead ?? '').trim()) out.push(['四死球', String(stats.fourDead)]);
      if (String(stats.whip ?? '').trim()) out.push(['WHIP', String(stats.whip)]);
      if (String(stats.games ?? '').trim()) out.push(['G', String(stats.games)]);
      return out.slice(0, 10);
    }

    function homeStarterCard(starter, teamName, sideLabel) {
      if (!starter) {
        return `<article class="game-detail-starter-card is-empty"><div class="game-detail-starter-team">${escapeHtml(teamName || sideLabel)}</div><div class="game-detail-starter-empty">先發投手尚未公布</div></article>`;
      }
      const statItems = homeStarterStatItems(starter);
      const meta = [
        starter?.number ? `#${starter.number}` : '',
        starter?.throws || '',
        starter?.stats?.year ? `${starter.stats.year} 球季` : ''
      ].filter(Boolean).join('｜');
      return `<article class="game-detail-starter-card">
        <div class="game-detail-starter-team">${escapeHtml(teamName || starter?.team || sideLabel)}</div>
        <div class="game-detail-starter-name">${escapeHtml(String(starter?.fullName || starter?.name || '—'))}</div>
        <div class="game-detail-starter-meta">${escapeHtml(meta || '預告先發')}</div>
        ${statItems.length ? `<div class="game-detail-starter-stats">${statItems.map(([label,value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : '<div class="game-detail-starter-no-stats">目前沒有可用的本季投球數據</div>'}
      </article>`;
    }

    function renderHomeGameDetail(detail, game, { loading = false, error = '' } = {}) {
      const overlay = ensureHomeGameDetailOverlay();
      const body = overlay.querySelector('#homeGameDetailBody');
      if (!body) return;
      if (detail?.game) {
        window.__latestHomeGameDetail = detail;
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent('home-game-detail-state', {
            detail:{ detail, league:activeHomeGameDetail?.league || detail?.league || '', date:activeHomeGameDetail?.date || detail?.date || '' }
          }));
        });
      }
      const status = String(detail?.status || game?.status || 'scheduled').toLowerCase();
      const currentBatter = String(detail?.current?.batter?.name || '').trim();
      const currentPitcher = String(detail?.current?.pitcher?.name || '').trim();
      const displayPlays = (Array.isArray(detail?.plays) ? detail.plays : []).filter(homeGameDetailDisplayPlay);
      const groups = homeGameDetailGroups(displayPlays);
      const gameInfo = detail?.game || game || {};
      const leagueLabel = activeHomeGameDetail?.league === 'CPBL' ? '中華職棒' : '日本職棒';
      const dateLabel = String(activeHomeGameDetail?.date || '').replaceAll('-', '/');
      const pregame = detail?.pregame || null;
      const starterSection = status === 'scheduled' ? `
        <section class="game-detail-pregame-section">
          <div class="game-detail-section-title game-detail-pregame-title">
            <div><strong>預告先發</strong><span>${escapeHtml(String(pregame?.source || (activeHomeGameDetail?.league === 'NPB' ? 'NPB 官方' : 'CPBL 官方')))}</span></div>
            <button id="homeGameDetailPregameRefresh" class="game-detail-pregame-refresh" type="button" ${loading ? 'disabled' : ''}>重新整理</button>
          </div>
          ${pregame?.error ? `<div class="game-detail-pregame-note error">${escapeHtml(String(pregame.error))}</div>` : ''}
          <div class="game-detail-starter-grid">
            ${homeStarterCard(pregame?.awayStarter || null, String(gameInfo?.away || game?.away || '客隊'), '客隊')}
            ${homeStarterCard(pregame?.homeStarter || null, String(gameInfo?.home || game?.home || '主隊'), '主隊')}
          </div>
          ${!pregame?.awayStarter && !pregame?.homeStarter ? '<div class="game-detail-pregame-note">聯盟公布預告先發後，重新整理就會自動帶入本季投球資料。</div>' : ''}
        </section>` : '';
      const matchup = status === 'live' ? `
        <div class="game-detail-current-grid">
          <div class="game-detail-current-card"><span>目前打者</span><strong>${escapeHtml(currentBatter || '等待下一位打者')}</strong></div>
          <div class="game-detail-current-card"><span>目前投手</span><strong>${escapeHtml(currentPitcher || '讀取中')}</strong></div>
        </div>` : '';
      const playsHtml = groups.length ? groups.map(group => `
        <details class="game-detail-inning" open>
          <summary>${group.inning || '—'}局${group.half === 'top' ? '上' : group.half === 'bottom' ? '下' : ''}${group.team ? `｜${escapeHtml(group.team)}` : ''}<span>${group.plays.length} 打席</span></summary>
          <div class="game-detail-pa-list">
            ${group.plays.map(play => `
              <div class="game-detail-pa-row">
                <div class="game-detail-pa-main"><strong>${escapeHtml(String(play?.batter || '未辨識打者'))}</strong><span>${escapeHtml(String(play?.result || '—'))}</span></div>
                <div class="game-detail-pa-meta">${escapeHtml(homeGameDetailMeta(play))}</div>
              </div>`).join('')}
          </div>
        </details>`).join('') : `<div class="game-detail-empty">${status === 'scheduled' ? '比賽尚未開始，開打後這裡會顯示逐打席。' : loading ? '正在讀取官方逐打席…' : '官方來源目前沒有可顯示的逐打席。'}</div>`;

      body.innerHTML = `
        <header class="game-detail-sticky-head">
          <button id="homeGameDetailBack" class="game-detail-back" type="button">← 返回賽事</button>
          <div class="game-detail-head-copy"><strong>${escapeHtml(leagueLabel)}</strong><span>${escapeHtml(dateLabel)}${gameInfo?.venue ? `｜${escapeHtml(String(gameInfo.venue))}` : ''}</span></div>
          ${status === 'live' ? `<span class="game-detail-live-dot ${loading ? 'is-refreshing' : ''}"><i></i>LIVE<span id="homeGameDetailRefreshCountdown" style="margin-left:6px;font-size:11px;font-weight:700;opacity:.72;white-space:nowrap">${loading ? '更新中…' : ''}</span></span>` : ''}
        </header>
        <main class="game-detail-content">
          <section class="game-detail-score-card">
            <div class="game-detail-status">${escapeHtml(homeGameDetailStatusLabel(detail || {status,game:gameInfo}))}${loading ? '｜更新中…' : ''}</div>
            <div class="game-detail-score-row">
              <div><span>${escapeHtml(String(gameInfo?.away || game?.away || '客隊'))}</span><strong>${homeGameDetailScore(gameInfo?.awayScore)}</strong></div>
              <b>－</b>
              <div><span>${escapeHtml(String(gameInfo?.home || game?.home || '主隊'))}</span><strong>${homeGameDetailScore(gameInfo?.homeScore)}</strong></div>
            </div>
            ${matchup}
          </section>
          ${error ? `<div class="game-detail-error">${escapeHtml(error)}<button id="homeGameDetailRetry" type="button">重新讀取</button></div>` : ''}
          ${starterSection}
          <section class="game-detail-play-section">
            <div class="game-detail-section-title"><strong>全場逐打席</strong><span>${displayPlays.length} 筆</span></div>
            ${playsHtml}
          </section>
        </main>`;
      overlay.classList.remove('hidden');
      document.body.classList.add('home-game-detail-open');
      body.querySelector('#homeGameDetailBack')?.addEventListener('click', closeHomeGameDetail);
      body.querySelector('#homeGameDetailRetry')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));
      body.querySelector('#homeGameDetailPregameRefresh')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));
      updateHomeGameDetailRefreshCountdown();
    }

    function homeGameDetailCacheTtl(detail) {
      const status = String(detail?.status || '').toLowerCase();
      if (status === 'final' || status === 'cancelled') return 12 * 60 * 60 * 1000;
      if (status === 'scheduled') return 2 * 60 * 1000;
      return 45 * 1000;
    }

    function scheduleHomeGameDetailRefresh(detail) {
      stopHomeGameDetailRefresh();
      if (!activeHomeGameDetail || document.visibilityState !== 'visible') return;
      if (String(detail?.status || '').toLowerCase() !== 'live') return;
      if (!homeGameDetailAutoAvailable()) return;
      let delay = 30 * 1000;
      if (activeHomeGameDetail.league === 'CPBL') {
        // CPBL still uses Realtime as the primary path; keep a five-minute fallback only if disconnected.
        if (window.__cpblRealtimeConnected) {
          updateHomeGameDetailRefreshCountdown();
          return;
        }
        delay = 5 * 60 * 1000;
      } else if (activeHomeGameDetail.league === 'NPB') {
        // NPB Realtime is the primary path. The 10s revision watchdog remains a lightweight
        // safety check; only fall back to a 45s full shared-cache refresh when Realtime is down.
        if (window.__npbRealtimeConnected) {
          updateHomeGameDetailRefreshCountdown();
          return;
        }
        delay = 45 * 1000;
      }
      startHomeGameDetailRefreshCountdown(delay);
      homeGameDetailRefreshTimer = setTimeout(() => {
        homeGameDetailRefreshTimer = 0;
        stopHomeGameDetailRefreshCountdown();
        if (!activeHomeGameDetail || document.visibilityState !== 'visible' || !consumeHomeGameDetailAuto()) return;
        refreshActiveHomeGameDetail({ force:false, automatic:true });
      }, delay);
    }

    async function refreshActiveHomeGameDetail({ force = false, automatic = false } = {}) {
      if (!activeHomeGameDetail) return;
      const { league, date, game } = activeHomeGameDetail;
      const key = homeGameDetailKey(league, date, game);
      const cached = homeGameDetailCache.get(key);
      const age = cached ? Date.now() - Number(cached.at || 0) : Infinity;
      if (!force && cached && age < homeGameDetailCacheTtl(cached.detail)) {
        renderHomeGameDetail(cached.detail, game);
        scheduleHomeGameDetailRefresh(cached.detail);
        return;
      }
      if (activeHomeGameDetail.loading) return;
      activeHomeGameDetail.loading = true;
      if (cached?.detail) renderHomeGameDetail(cached.detail, game, { loading:false });
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      try {
        let detail = null;
        const staleDetail = !force ? (cached?.detail || null) : null;
        let fromPublishedCache = false;
        let fromAnyCache = Boolean(staleDetail);
        if (!force && league === 'CPBL' && date === localISODate() && game?.id && typeof window.__cpblRealtimeReadPublished === 'function') {
          try {
            const published = await window.__cpblRealtimeReadPublished(date, String(game.id), String(game?.kindCode || 'A'));
            detail = published?.detail || null;
            fromPublishedCache = Boolean(detail);
            if (detail) fromAnyCache = true;
          } catch {}
        }
        if (!detail && league === 'NPB' && date === localISODate() && game?.id && typeof window.__npbRealtimeReadPublished === 'function') {
          try {
            const published = await window.__npbRealtimeReadPublished(date, String(game.id));
            detail = published?.detail || null;
            if (detail) fromAnyCache = true;
          } catch {}
        }
        if (!detail && staleDetail) detail = staleDetail;
        if (!detail) detail = await leagueGameDetailRequest(league, date, game, league === 'CPBL' ? false : force);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        // Preserve a previously fetched pregame card when a fresh published-cache detail
        // does not contain pregame data. CPBL scheduled rows are intentionally lightweight.
        if (detail && !force && !detail?.pregame && staleDetail?.pregame) {
          detail.pregame = staleDetail.pregame;
        }
        const detailStatus = String(detail?.status || '').toLowerCase();
        const supportsPregameStarters = league === 'CPBL' || league === 'NPB';
        if (detailStatus === 'scheduled' && supportsPregameStarters && (force || !detail?.pregame)) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
          }
        }
        const detailChanged = !cached?.detail || JSON.stringify(cached.detail) !== JSON.stringify(detail);
        homeGameDetailCache.set(key, { at:Date.now(), detail });
        homeGameDetailErrorStreak = 0;
        syncHomeDailyGameFromDetail(league, date, game, detail);
        if (detail?.game?.id && !game.id) game.id = detail.game.id;
        if (detailChanged || force) renderHomeGameDetail(detail, game);
        scheduleHomeGameDetailRefresh(detail);
      } catch (error) {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        const detail = cached?.detail || { status:game?.status, game, plays:[] };
        renderHomeGameDetail(detail, game, { error:error?.message || '單場逐打席讀取失敗。' });
        if (automatic) {
          homeGameDetailErrorStreak = Math.min(homeGameDetailErrorStreak + 1, 5);
          const retryDelay = Math.min(10 * 60 * 1000, 60 * 1000 * (2 ** (homeGameDetailErrorStreak - 1)));
          stopHomeGameDetailRefresh();
          startHomeGameDetailRefreshCountdown(retryDelay);
          homeGameDetailRefreshTimer = setTimeout(() => {
            homeGameDetailRefreshTimer = 0;
            if (activeHomeGameDetail && document.visibilityState === 'visible') refreshActiveHomeGameDetail({ force:false, automatic:true });
          }, retryDelay);
        }
      } finally {
        if (activeHomeGameDetail && activeHomeGameDetail.key === key) activeHomeGameDetail.loading = false;
      }
    }

    function openHomeGameDetail(game, league, date) {
      if (!homeGameDetailSupported(league)) return;
      stopHomeDailyGamesAutoRefresh();
      const key = homeGameDetailKey(league, date, game);
      activeHomeGameDetail = { league, date, game, key, loading:false };
      if (league === 'CPBL' && date === localISODate() && game?.id) {
        window.dispatchEvent(new CustomEvent('cpbl-live-watch', { detail:{ date, gameId:String(game.id), kindCode:String(game?.kindCode || 'A') } }));
      } else {
        window.dispatchEvent(new CustomEvent('cpbl-live-unwatch'));
      }
      if (league === 'NPB' && date === localISODate() && game?.id) {
        window.dispatchEvent(new CustomEvent('npb-live-watch', { detail:{ date, gameId:String(game.id) } }));
      } else {
        window.dispatchEvent(new CustomEvent('npb-live-unwatch'));
      }

      const cached = homeGameDetailCache.get(key);
      if (cached?.detail) renderHomeGameDetail(cached.detail, game);
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      refreshActiveHomeGameDetail();
    }


    window.addEventListener('cpbl-live-cache-update', event => {
      if (!activeHomeGameDetail || activeHomeGameDetail.league !== 'CPBL') return;
      const row = event?.detail?.row || null;
      const detail = event?.detail?.detail || row?.published_payload || null;
      if (!detail?.game) return;
      const { date, game } = activeHomeGameDetail;
      if (String(row?.game_date || detail?.date || '') !== String(date || '')) return;
      const expectedId = String(game?.id || '');
      const incomingId = String(row?.game_id || detail?.game?.id || '');
      const expectedKind = String(game?.kindCode || 'A').toUpperCase();
      const incomingKind = String(row?.kind_code || detail?.kindCode || detail?.game?.kindCode || 'A').toUpperCase();
      if (expectedId && incomingId && expectedId !== incomingId) return;
      if (expectedKind !== incomingKind) return;
      const key = homeGameDetailKey('CPBL', date, game);
      homeGameDetailCache.set(key, { at:Date.now(), detail });
      homeGameDetailErrorStreak = 0;
      syncHomeDailyGameFromDetail('CPBL', date, game, detail);
      renderHomeGameDetail(detail, game);
      scheduleHomeGameDetailRefresh(detail);
    });

    window.addEventListener('npb-live-cache-update', event => {
      if (!activeHomeGameDetail || activeHomeGameDetail.league !== 'NPB') return;
      const row = event?.detail?.row || null;
      const detail = event?.detail?.detail || row?.published_payload || null;
      if (!detail?.game) return;
      const { date, game } = activeHomeGameDetail;
      const expectedId = String(game?.id || '');
      const incomingId = String(row?.game_id || detail?.game?.id || '');
      if (expectedId && incomingId && expectedId !== incomingId) return;
      const key = homeGameDetailKey('NPB', date, game);
      homeGameDetailCache.set(key, { at:Date.now(), detail });
      homeGameDetailErrorStreak = 0;
      syncHomeDailyGameFromDetail('NPB', date, game, detail);
      renderHomeGameDetail(detail, game);
      scheduleHomeGameDetailRefresh(detail);
    });

    window.addEventListener('npb-live-realtime-status', event => {
      if (!activeHomeGameDetail || activeHomeGameDetail.league !== 'NPB') return;
      const cached = homeGameDetailCache.get(homeGameDetailKey('NPB', activeHomeGameDetail.date, activeHomeGameDetail.game));
      if (event?.detail?.connected) {
        stopHomeGameDetailRefresh();
        updateHomeGameDetailRefreshCountdown();
      } else if (cached?.detail) {
        scheduleHomeGameDetailRefresh(cached.detail);
      }
    });

    window.addEventListener('cpbl-live-realtime-status', event => {
      if (!activeHomeGameDetail || activeHomeGameDetail.league !== 'CPBL') return;
      const cached = homeGameDetailCache.get(homeGameDetailKey('CPBL', activeHomeGameDetail.date, activeHomeGameDetail.game));
      if (event?.detail?.connected) {
        stopHomeGameDetailRefresh();
        updateHomeGameDetailRefreshCountdown();
      } else if (cached?.detail) {
        scheduleHomeGameDetailRefresh(cached.detail);
      }
    });

    window.addEventListener('cpbl-live-day-update', event => {
      if (currentPage !== 'home' || homeDailyGamesLeague() !== 'CPBL') return;
      const row = event?.detail?.row || null;
      const detail = event?.detail?.detail || row?.published_payload || null;
      const date = String(row?.game_date || detail?.date || '');
      if (!date || date !== String(els.gameDate?.value || localISODate())) return;
      const key = `CPBL|${date}`;
      const cached = homeDailyGamesCache.get(key);
      if (!cached || !Array.isArray(cached.games)) return;
      const incomingId = String(row?.game_id || detail?.game?.id || '');
      const incomingKind = String(row?.kind_code || detail?.kindCode || detail?.game?.kindCode || 'A').toUpperCase();
      const index = cached.games.findIndex(g =>
        String(g?.id || '') === incomingId
        && String(g?.kindCode || 'A').toUpperCase() === incomingKind
      );
      if (index < 0) return;
      const gameInfo = detail?.game || {};
      cached.games[index] = {
        ...cached.games[index],
        ...gameInfo,
        id:incomingId || cached.games[index]?.id,
        status:String(detail?.status || row?.status || cached.games[index]?.status || 'scheduled'),
        lineupReady:Boolean(cached.games[index]?.lineupReady || homeDetailLineupReady(detail))
      };
      cached.at = Date.now();
      cached.error = '';
      homeDailyGamesCache.set(key, cached);
      renderHomeDailyGames({ skipLoad:true });
    });

    window.addEventListener('cpbl-live-day-realtime-status', event => {
      if (currentPage !== 'home' || homeDailyGamesLeague() !== 'CPBL') return;
      if (event?.detail?.connected) stopHomeDailyGamesAutoRefresh();
      else scheduleHomeDailyGamesAutoRefresh();
    });
