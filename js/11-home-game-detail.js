    const homePitcherRecordsCache = new Map();
    const homeBullpenSessionCache = new Map();

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

    function homePitcherRecordsSupported(league, game = {}) {
      if (league === 'NPB') return true;
      if (league !== 'CPBL') return false;
      const kindCode = String(game?.kindCode || 'A').trim().toUpperCase();
      return !kindCode || kindCode === 'A';
    }

    async function homePitcherRecordsRequest(league, date, game = {}) {
      if (!homePitcherRecordsSupported(league, game)) throw new Error('此賽事目前不支援投手紀錄。');
      const url = league === 'CPBL' ? CPBL_GAME_DETAIL_API_URL : NPB_GAME_DETAIL_API_URL;
      const response = await fetch(url, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'pitcher-records',
          league,
          date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || ''),
          status:String(game?.status || '')
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `投手紀錄讀取失敗（${response.status}）`);
      return {
        away:Array.isArray(data?.away) ? data.away : [],
        home:Array.isArray(data?.home) ? data.home : [],
        awayTotal:Array.isArray(data?.awayTotal) ? data.awayTotal : null,
        homeTotal:Array.isArray(data?.homeTotal) ? data.homeTotal : null
      };
    }

    async function refreshHomePitcherRecords({ force = false } = {}) {
      if (!activeHomeGameDetail) return;
      const { league, date, game, key } = activeHomeGameDetail;
      if (!homePitcherRecordsSupported(league, game) || activeHomeGameDetail.centerTab !== 'pitchers') return;
      if (activeHomeGameDetail.pitcherRecordsLoading) return;

      const detail = homeGameDetailCache.get(key)?.detail || { status:game?.status, game, plays:[] };
      const status = String(detail?.status || game?.status || '').toLowerCase();
      const cached = homePitcherRecordsCache.get(key) || null;
      const ttl = ['live','suspended'].includes(status) ? 45_000 : status === 'final' ? Infinity : 60_000;
      const fresh = cached && (ttl === Infinity || Date.now() - Number(cached.at || 0) < ttl);

      if (!force && fresh) {
        if (activeHomeGameDetail.pitcherRecords !== cached.records) {
          activeHomeGameDetail.pitcherRecords = cached.records;
          activeHomeGameDetail.pitcherRecordsError = '';
          renderHomeGameDetail(detail, game);
        }
        return;
      }

      activeHomeGameDetail.pitcherRecordsLoading = true;
      activeHomeGameDetail.pitcherRecordsError = '';
      renderHomeGameDetail(detail, game);
      try {
        const records = await homePitcherRecordsRequest(league, date, { ...game, ...(detail?.game || {}) });
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        homePitcherRecordsCache.set(key, { at:Date.now(), records });
        activeHomeGameDetail.pitcherRecords = records;
        activeHomeGameDetail.pitcherRecordsError = '';
      } catch (error) {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        activeHomeGameDetail.pitcherRecordsError = error?.message || '投手紀錄讀取失敗。';
      } finally {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        activeHomeGameDetail.pitcherRecordsLoading = false;
        const latest = homeGameDetailCache.get(key)?.detail || detail;
        renderHomeGameDetail(latest, activeHomeGameDetail.game || game);
      }
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

    function homeGameDetailResultTone(value) {
      const text = String(value || '').trim();
      if (/全壘打|全塁打|home\s*run/i.test(text)) return 'is-homer';
      if (/三壘安打|三塁打|二壘安打|二塁打|安打|ヒット|single|double|triple/i.test(text)) return 'is-hit';
      if (/四壞|保送|四球|walk|觸身|触身|死球|hit\s*by\s*pitch/i.test(text)) return 'is-free-pass';
      if (/犧牲飛球|犧牲觸擊|犧牲短打|犠牲フライ|犠打|sacrifice/i.test(text)) return 'is-sacrifice';
      return '';
    }

    function homeGameDetailSeasonResultLabels(detail, plays = []) {
      const labels = new Map();
      const league = String(activeHomeGameDetail?.league || detail?.league || '').toUpperCase();
      if (league !== 'CPBL') return labels;

      const normalizeName = value => String(value || '')
        .replace(/^(?:代打|代跑)[・·\\s]*/,'')
        .replace(/[・·.\\s]/g,'')
        .trim()
        .toLowerCase();
      const pickNumber = (row, keys) => {
        for (const key of keys) {
          const value = row?.[key];
          if (value === null || value === undefined || value === '') continue;
          const n = Number(value);
          if (Number.isFinite(n)) return n;
        }
        return null;
      };

      const rawBatters = [
        ...(Array.isArray(detail?.gameBatters) ? detail.gameBatters : []),
        ...['away','home'].flatMap(side => [
          ...(Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : []),
          ...(Array.isArray(detail?.lineups?.[side]?.roster) ? detail.lineups[side].roster : []),
          ...(Array.isArray(detail?.startingLineup?.[side]) ? detail.startingLineup[side] : [])
        ])
      ];
      const byName = new Map();
      for (const row of rawBatters) {
        const name = String(row?.fullName || row?.name || row?.playerName || '').trim();
        const key = normalizeName(name);
        if (!key) continue;
        const score = [
          'pregameHits','pregameHomeRuns','hits','h','homeRuns','hr',
          'gameHits','gameHomeRuns','pregameAb','ab','atBats','gameAb'
        ].reduce((sum, field) => sum + (row?.[field] !== null && row?.[field] !== undefined && row?.[field] !== '' ? 1 : 0), 0);
        const existing = byName.get(key);
        if (!existing || score > existing.score) byName.set(key, { row, score });
      }

      const counters = new Map();
      const counterFor = name => {
        const key = normalizeName(name);
        if (!key) return null;
        if (counters.has(key)) return counters.get(key);
        const row = byName.get(key)?.row || null;
        if (!row) {
          const empty = { hits:null, homeRuns:null };
          counters.set(key, empty);
          return empty;
        }

        const pregameHits = pickNumber(row, ['pregameHits']);
        const pregameHomeRuns = pickNumber(row, ['pregameHomeRuns','pregameHr']);
        const directHits = pickNumber(row, ['hits','h']);
        const directHomeRuns = pickNumber(row, ['homeRuns','hr']);
        const gameHits = pickNumber(row, ['gameHits']);
        const gameHomeRuns = pickNumber(row, ['gameHomeRuns','gameHr']);
        const pregameAb = pickNumber(row, ['pregameAb']);
        const directAb = pickNumber(row, ['ab','atBats']);

        let hits = pregameHits;
        let homeRuns = pregameHomeRuns;

        // Prefer the locked pregame snapshot. During a live/suspended CPBL game,
        // direct season totals are already updated by the official source, so
        // subtract the current game's line first and then rebuild each PA in order.
        // This prevents e.g. the 98th season hit from rendering as hit 99.
        const liveLike = ['live','playing','inprogress','in_progress','suspended'].includes(
          String(detail?.status || detail?.game?.status || '').toLowerCase()
        );
        const directLooksPostgame = directAb !== null && pregameAb !== null && directAb > pregameAb;

        if (hits === null && directHits !== null) {
          hits = gameHits !== null && (liveLike || directLooksPostgame)
            ? Math.max(0, directHits - gameHits)
            : directHits;
        }
        if (homeRuns === null && directHomeRuns !== null) {
          homeRuns = gameHomeRuns !== null && (liveLike || directLooksPostgame)
            ? Math.max(0, directHomeRuns - gameHomeRuns)
            : directHomeRuns;
        }

        const counter = { hits, homeRuns };
        counters.set(key, counter);
        return counter;
      };

      for (const play of Array.isArray(plays) ? plays : []) {
        const batter = String(play?.batter || play?.hitter || '').trim();
        if (!batter) continue;
        const result = String(play?.result || play?.raw || '').trim();
        if (!result) continue;
        const isHomeRun = /全壘打|全塁打|本塁打|home\\s*run/i.test(result);
        const isHit = isHomeRun || /三壘安打|三塁打|二壘安打|二塁打|一壘安打|一塁打|安打|ヒット|single|double|triple/i.test(result);
        if (!isHit) continue;

        const counter = counterFor(batter);
        if (!counter) continue;
        if (counter.hits !== null) counter.hits += 1;
        if (isHomeRun && counter.homeRuns !== null) counter.homeRuns += 1;

        if (isHomeRun && counter.homeRuns !== null) {
          labels.set(play, `${result}${Math.floor(counter.homeRuns)}`);
        } else if (counter.hits !== null) {
          labels.set(play, `${result}${Math.floor(counter.hits)}`);
        }
      }
      return labels;
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
      overlay.innerHTML = '<div class="home-game-detail-page" role="dialog" aria-modal="true" aria-label="對戰中心"><div id="homeGameDetailBody"></div></div>';
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

    async function homeMatchCenterPost(url, payload, label, timeoutMs = 10000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body:JSON.stringify(payload),
          signal:controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) throw new Error(data?.error || `${label}讀取失敗（${response.status}）`);
        return data;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`${label}讀取逾時，請再試一次`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    async function homePregameCenterRequest(league, date, game, force = false) {
      return homeMatchCenterPost(LEAGUE_PREGAME_CENTER_API_URL, {
        appKey:CPBL_APP_KEY,
        league,
        date,
        gameId:String(game?.id || ''),
        away:String(game?.away || ''),
        home:String(game?.home || ''),
        force:Boolean(force)
      }, '對戰總覽', 9000);
    }

    async function homeBullpenStatusRequest(league, date, game, force = false) {
      if (league !== 'CPBL') throw new Error('投手狀態目前只支援中華職棒。');
      return homeMatchCenterPost(LEAGUE_BULLPEN_STATUS_API_URL, {
        appKey:CPBL_APP_KEY,
        league,
        date,
        gameId:String(game?.id || ''),
        away:String(game?.away || ''),
        home:String(game?.home || ''),
        force:Boolean(force)
      }, '牛棚資料', 30000);
    }

    function homePregameRecordText(record) {
      if (!record) return '—';
      return `${Number(record.wins || 0)}勝 ${Number(record.losses || 0)}敗${Number(record.ties || 0) ? ` ${Number(record.ties)}和` : ''}`;
    }

    function homeMatchCenterStarters(center = null) {
      const cachedDetail = activeHomeGameDetail
        ? (homeGameDetailCache.get(activeHomeGameDetail.key)?.detail || null)
        : null;
      const pregame = cachedDetail?.pregame || null;
      const lineups = cachedDetail?.lineups || null;
      const apiStarters = center?.starters || {};

      const lineupPitcher = side => {
        const raw = lineups?.[side]?.pitcher || null;
        if (!raw || !(raw?.name || raw?.fullName)) return null;
        return raw;
      };

      // The single-game detail is the same source used by landscape mode.
      // Prefer it so portrait overview can never disagree with landscape.
      return {
        away: pregame?.awayStarter || apiStarters?.away || lineupPitcher('away') || null,
        home: pregame?.homeStarter || apiStarters?.home || lineupPitcher('home') || null,
        source: pregame?.source || apiStarters?.source || ''
      };
    }

    function homePregameStarterPair(center, gameInfo, game) {
      const starters = homeMatchCenterStarters(center);
      return `
        <div class="pregame-center-block">
          <div class="pregame-center-block-title"><strong>先發投手</strong><span>官方公布資料</span></div>
          <div class="game-detail-starter-grid">
            ${homeStarterCard(starters?.away || null, String(gameInfo?.away || game?.away || '客隊'), '客隊')}
            ${homeStarterCard(starters?.home || null, String(gameInfo?.home || game?.home || '主隊'), '主隊')}
          </div>
        </div>
      `;
    }

    function homePregameMatchupPanel(center, gameInfo, game) {
      const starterPair = homePregameStarterPair(center, gameInfo, game);
      if (!center) {
        return `${starterPair}<div class="pregame-center-loading">其他賽前對戰資料尚未建立。</div>`;
      }
      const matchup = center?.matchup || {};
      const h2h = matchup?.h2h || null;
      const away = String(gameInfo?.away || game?.away || '客隊');
      const home = String(gameInfo?.home || game?.home || '主隊');
      return `
        ${starterPair}
        <div class="pregame-center-summary-grid">
          <article>
            <span>近 6 場</span>
            <strong>${escapeHtml(away)}</strong>
            <b>${escapeHtml(homePregameRecordText(matchup?.awayRecent))}</b>
          </article>
          <article>
            <span>近 6 場</span>
            <strong>${escapeHtml(home)}</strong>
            <b>${escapeHtml(homePregameRecordText(matchup?.homeRecent))}</b>
          </article>
          <article class="is-wide">
            <span>本季對戰</span>
            <strong>${escapeHtml(away)} ${h2h ? Number(h2h.awayWins || 0) : '—'}－${h2h ? Number(h2h.homeWins || 0) : '—'} ${escapeHtml(home)}</strong>
            <b>${h2h && Number(h2h.ties || 0) ? `${Number(h2h.ties)} 和` : '例行賽對戰'}</b>
          </article>
        </div>

      `;
    }

    function homeBullpenStatusClass(level) {
      const v = String(level || '').toLowerCase();
      if (v === 'rest') return 'is-rest';
      if (v === 'caution') return 'is-caution';
      return 'is-ready';
    }

    function homeBullpenTeamCard(side, fallbackTeam) {
      if (!side) {
        return `<article class="bullpen-roster-card is-empty"><strong>${escapeHtml(fallbackTeam || '球隊')}</strong><span>目前沒有可用的一軍投手資料</span></article>`;
      }
      const members = Array.isArray(side?.members) ? side.members : [];
      const team = String(side?.team || fallbackTeam || '球隊');
      return `
        <article class="bullpen-roster-card">
          <div class="bullpen-roster-head">
            <div>
              <span>一軍投手</span>
              <strong>${escapeHtml(team)}</strong>
            </div>
            <b>${members.length} 人</b>
          </div>
          <div class="bullpen-roster-table">
            <div class="bullpen-roster-row bullpen-roster-header">
              <span>投手</span>
              <span>昨日用球</span>
              <span>前日用球</span>
              <span>預估狀態</span>
            </div>
            <div class="bullpen-roster-scroll">
            ${members.length ? members.map(member => {
              const yesterday = Math.max(0, Number(member?.yesterdayPitches) || 0);
              const twoDaysAgo = Math.max(0, Number(member?.twoDaysAgoPitches) || 0);
              const status = String(member?.status || '可用');
              const reason = String(member?.statusReason || '');
              return `
                <div class="bullpen-roster-row">
                  <strong>${escapeHtml(String(member?.name || '未辨識投手'))}${member?.isStarter ? '<small class="pitcher-status-starter">先發</small>' : ''}</strong>
                  <span class="${yesterday > 0 ? 'has-work' : ''}">${yesterday} 球</span>
                  <span class="${twoDaysAgo > 0 ? 'has-work' : ''}">${twoDaysAgo} 球</span>
                  <span class="bullpen-status-pill ${homeBullpenStatusClass(member?.statusLevel)}" title="${escapeAttr(reason)}">
                    <b>${escapeHtml(status)}</b>
                    ${reason ? `<small>${escapeHtml(reason)}</small>` : ''}
                  </span>
                </div>`;
            }).join('') : `
              <div class="bullpen-roster-empty">目前沒有可確認的一軍投手。</div>
            `}
            </div>
          </div>
        </article>
      `;
    }

    function homeBullpenPanel(bullpen, gameInfo, game) {
      if (!bullpen) return '<div class="pregame-center-loading">正在整理牛棚狀況…</div>';
      return `
        <div class="bullpen-status-grid">
          ${homeBullpenTeamCard(bullpen?.awayBullpen || null, String(gameInfo?.away || game?.away || '客隊'))}
          ${homeBullpenTeamCard(bullpen?.homeBullpen || null, String(gameInfo?.home || game?.home || '主隊'))}
        </div>
      `;
    }

    function homeBullpenDataUsable(data) {
      const away = Array.isArray(data?.awayBullpen?.members) ? data.awayBullpen.members.length : 0;
      const home = Array.isArray(data?.homeBullpen?.members) ? data.homeBullpen.members.length : 0;
      return Number(data?.pitcherStatusVersion || 0) >= 10 && away > 0 && home > 0;
    }

    async function refreshHomeBullpenStatus({ force = false } = {}) {
      if (!activeHomeGameDetail || activeHomeGameDetail.league !== 'CPBL') return;
      if (activeHomeGameDetail.centerTab !== 'bullpen') return;
      if (activeHomeGameDetail.bullpenLoading) return;
      const { league, date, game, key } = activeHomeGameDetail;
      if (!game?.id || !game?.away || !game?.home) return;

      const cached = homeBullpenSessionCache.get(key) || null;
      if (!force && cached?.data && homeBullpenDataUsable(cached.data)) {
        activeHomeGameDetail.bullpenData = cached.data;
        activeHomeGameDetail.bullpenError = '';
        const detail = homeGameDetailCache.get(key)?.detail || { status:game?.status, game, plays:[] };
        renderHomeGameDetail(detail, game);
        return;
      }

      activeHomeGameDetail.bullpenLoading = true;
      activeHomeGameDetail.bullpenError = '';
      const detail = homeGameDetailCache.get(key)?.detail || { status:game?.status, game, plays:[] };
      renderHomeGameDetail(detail, game);
      try {
        const data = await homeBullpenStatusRequest(league, date, game, false);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        if (!homeBullpenDataUsable(data)) throw new Error('一軍投手名單尚未建立完成，請稍後再試。');
        homeBullpenSessionCache.set(key, { at:Date.now(), data });
        activeHomeGameDetail.bullpenData = data;
      } catch (error) {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        activeHomeGameDetail.bullpenError = error?.message || '牛棚資料讀取失敗。';
      } finally {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        activeHomeGameDetail.bullpenLoading = false;
        const latest = homeGameDetailCache.get(key)?.detail || detail;
        renderHomeGameDetail(latest, game);
      }
    }

    function homeBullpenDetailPanel(detail, gameInfo, game) {
      const data = activeHomeGameDetail?.bullpenData || null;
      const loading = Boolean(activeHomeGameDetail?.bullpenLoading);
      const error = String(activeHomeGameDetail?.bullpenError || '');
      if (loading && !data) {
        return '<div class="pregame-center-loading">正在整理兩隊投手使用狀況…</div>';
      }
      if (error && !data) {
        return `<div class="game-detail-error">${escapeHtml(error)}</div>`;
      }
      if (!data) {
        return '<div class="pregame-center-loading">正在讀取已鎖定的投手資料…</div>';
      }
      return `
        <section class="match-center-data-panel game-bullpen-panel">
          <div class="match-center-data-tools">
            <span>投手狀態<small class="match-center-update-time">目前一軍 · 官方用球數</small></span>
          </div>
          <div class="pregame-center-body">
            ${homeBullpenPanel(data, gameInfo, game)}
            <div class="bullpen-estimate-note">預估狀態只依最近兩日官方用球量與連續登板判定，不代表球隊實際調度決策。</div>
          </div>
        </section>`;
    }

    function homeSnapshotTeamForBatter(detail, name) {
      const cleanName = String(name || '').replace(/^代打[・·\s]*/,'').trim();
      for (const side of ['away','home']) {
        const lineup = Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : [];
        const found = lineup.some(player => {
          const candidate = String(player?.fullName || player?.name || '').trim();
          return candidate && (candidate === cleanName || candidate.includes(cleanName) || cleanName.includes(candidate));
        });
        if (found) return side;
      }
      const play = (Array.isArray(detail?.plays) ? detail.plays : []).find(item => {
        const batter = String(item?.batter || item?.hitter || '').replace(/^代打[・·\s]*/,'').trim();
        return batter && (batter === cleanName || batter.includes(cleanName) || cleanName.includes(batter));
      });
      const away = String(detail?.game?.away || '');
      const home = String(detail?.game?.home || '');
      const team = String(play?.team || '');
      if (team && away && (away.includes(team) || team.includes(away))) return 'away';
      if (team && home && (home.includes(team) || team.includes(home))) return 'home';
      return '';
    }

    function homeSnapshotBatters(detail) {
      const raw = Array.isArray(detail?.gameBatters) && detail.gameBatters.length
        ? detail.gameBatters
        : ['away','home'].flatMap(side => Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : []);
      const map = new Map();
      for (const batter of raw) {
        const name = String(batter?.fullName || batter?.name || '').trim();
        if (!name) continue;
        const hits = Number(batter?.gameHits || 0);
        const ab = Number(batter?.gameAb || 0);
        const hr = Number(batter?.gameHomeRuns || 0);
        const rbi = Number(batter?.gameRbi || 0);
        const side = homeSnapshotTeamForBatter(detail, name);
        const score = hits * 2 + rbi * 3 + hr * 5;
        const prev = map.get(name);
        if (!prev || score > prev.score) map.set(name, { name, hits, ab, hr, rbi, side, score });
      }
      return [...map.values()].filter(row => row.ab > 0 || row.hits > 0 || row.rbi > 0 || row.hr > 0)
        .sort((a,b) => b.score - a.score || b.rbi - a.rbi || b.hits - a.hits);
    }

    function homeSnapshotPlayRbi(play) {
      const direct = Number(play?.rbi);
      if (Number.isFinite(direct) && direct > 0) return direct;
      const text = [play?.result, play?.raw, play?.description].filter(Boolean).join(' ');
      const match = text.match(/(?:打點|打点|RBI)\s*[:：]?\s*([1-4])/i)
        || text.match(/([1-4])\s*(?:分打點|打点)/);
      return match ? Number(match[1]) : 0;
    }

    function homeSnapshotPlayRuns(play) {
      const rbi = homeSnapshotPlayRbi(play);
      const text = String(play?.description || '');
      const scored = text.match(/回本壘得分|生還|得点/g);
      const describedRuns = Array.isArray(scored) ? scored.length : 0;
      return Math.max(rbi, describedRuns);
    }

    function homeSnapshotScoreTimeline(detail) {
      const plays = (Array.isArray(detail?.plays) ? detail.plays : []).filter(homeGameDetailDisplayPlay);
      let awayScore = 0;
      let homeScore = 0;
      return plays.map((play,index) => {
        const before = { away:awayScore, home:homeScore };
        const rbi = homeSnapshotPlayRbi(play);
        const runs = homeSnapshotPlayRuns(play);
        const half = String(play?.half || '');
        if (runs > 0) {
          if (half === 'top') awayScore += runs;
          else if (half === 'bottom') homeScore += runs;
        }
        return {
          play,index,rbi,runs,
          before,
          after:{ away:awayScore, home:homeScore }
        };
      });
    }

    function homeSnapshotKeyPlays(detail) {
      const candidates = homeSnapshotScoreTimeline(detail).map(item => {
        const { play,index,rbi,runs } = item;
        const result = String(play?.result || play?.raw || '').trim();
        const inning = Number(play?.inning || 0);
        const homer = /全壘打|全塁打|本塁打|home\s*run/i.test(result);
        const clutch = /適時|タイムリー|逆轉|逆転|勝ち越し|追平|同点|失誤|エラー|暴投|捕逸/i.test(result + ' ' + String(play?.description || ''));
        const score = runs * 12 + rbi * 4 + (homer ? 7 : 0) + (clutch ? 4 : 0) + Math.min(9, inning) * .45;
        return { ...item, score, inning };
      }).filter(item => item.runs > 0 || item.rbi > 0 || item.score >= 4)
        .sort((a,b) => b.score - a.score || b.inning - a.inning || b.index - a.index)
        .slice(0,4)
        .sort((a,b) => a.inning - b.inning || a.index - b.index);
      return candidates;
    }

    function homeSnapshotDecisionItems(detail) {
      const d = detail?.decisions || detail?.gameDecisions || {};
      const items = [];
      const add = (label, value) => {
        const name = String(value?.name || value?.fullName || value || '').trim();
        if (name) items.push({ label, name });
      };
      add('勝投', d?.winningPitcher);
      add('敗投', d?.losingPitcher);
      add('救援', d?.savePitcher || d?.savingPitcher);
      const holds = Array.isArray(d?.holdPitchers) ? d.holdPitchers : Array.isArray(d?.holds) ? d.holds : [];
      if (holds.length) items.push({ label:'中繼', name:holds.map(x => String(x?.name || x?.fullName || x || '').trim()).filter(Boolean).join('、') });
      return items.slice(0,4);
    }

    function homeSnapshotPanel(detail, gameInfo, game) {
      const status = String(detail?.status || game?.status || '').toLowerCase();
      const away = String(gameInfo?.away || game?.away || '客隊');
      const home = String(gameInfo?.home || game?.home || '主隊');
      const awayScore = Number(gameInfo?.awayScore);
      const homeScore = Number(gameInfo?.homeScore);
      const batters = homeSnapshotBatters(detail);
      const leaders = batters.slice(0,3);
      const keyPlays = homeSnapshotKeyPlays(detail);
      const decisions = homeSnapshotDecisionItems(detail);
      const totals = detail?.scoreboard || {};
      const awayTotals = totals?.awayTotals || {};
      const homeTotals = totals?.homeTotals || {};

      if (status === 'scheduled' && !batters.length) {
        return '<div class="game-snapshot-empty"><strong>比賽尚未開始</strong><span>開打後會自動把關鍵打者、重要打席與投手結果濃縮在這裡。</span></div>';
      }

      let headline = '比賽進行中';
      if (Number.isFinite(awayScore) && Number.isFinite(homeScore)) {
        if (awayScore === homeScore) headline = status === 'final' ? `終場 ${awayScore}：${homeScore} 平手` : `目前 ${awayScore}：${homeScore} 平手`;
        else {
          const leader = awayScore > homeScore ? away : home;
          const a = status === 'final' ? '勝' : '領先';
          headline = `${leader} ${a}｜${awayScore}：${homeScore}`;
        }
      }

      const top = leaders[0] || null;
      const summary = top
        ? `${top.name} 目前最突出：${top.hits} 安、${top.hr} 轟、${top.rbi} 打點`
        : '目前沒有足夠打擊資料可整理。';

      const teamStat = (team, t) => `
        <article>
          <span>${escapeHtml(team)}</span>
          <strong>${Number(t?.R ?? '') || 0} R</strong>
          <b>${Number(t?.H ?? '') || 0} H｜${Number(t?.E ?? '') || 0} E</b>
        </article>`;

      return `
        <div class="game-snapshot-page">
          <section class="game-snapshot-hero">
            <span>${status === 'final' ? 'FINAL SNAPSHOT' : 'LIVE SNAPSHOT'}</span>
            <strong>${escapeHtml(headline)}</strong>
            <p>${escapeHtml(summary)}</p>
          </section>

          <section class="game-snapshot-team-row">
            ${teamStat(away, awayTotals)}
            ${teamStat(home, homeTotals)}
          </section>

          <section class="game-snapshot-section">
            <div class="game-snapshot-title"><strong>關鍵打者</strong><span>本場貢獻最高</span></div>
            <div class="game-snapshot-leaders">
              ${leaders.length ? leaders.map((row,index) => `
                <article>
                  <i>0${index+1}</i>
                  <div><strong>${escapeHtml(row.name)}</strong><span>${escapeHtml(row.side === 'away' ? away : row.side === 'home' ? home : '')}</span></div>
                  <b>${row.hits}-${row.ab}｜${row.hr ? `${row.hr} HR｜` : ''}${row.rbi} RBI</b>
                </article>`).join('') : '<div class="game-snapshot-muted">目前沒有可用的打者數據。</div>'}
            </div>
          </section>

          <section class="game-snapshot-section">
            <div class="game-snapshot-title"><strong>關鍵打席</strong><span>只留影響比分的重點</span></div>
            <div class="game-snapshot-plays">
              ${keyPlays.length ? keyPlays.map(({play,rbi,runs,before,after}) => `
                <article>
                  <b>${Number(play?.inning || 0) || '—'}局${String(play?.half || '') === 'top' ? '上' : String(play?.half || '') === 'bottom' ? '下' : ''}</b>
                  <div>
                    <strong>${escapeHtml(String(play?.batter || play?.hitter || '未辨識打者'))}</strong>
                    <span>${escapeHtml(String(play?.result || play?.raw || ''))}</span>
                    <small class="game-snapshot-play-meta">
                      <b>${rbi > 0 ? `${rbi} 打點` : (runs > 0 ? '非打點得分' : '關鍵事件')}</b>
                      ${runs > 0 ? `<i>比分 ${before.away}–${before.home} → ${after.away}–${after.home}</i>` : ''}
                    </small>
                  </div>
                  <em>${runs > 0 ? `+${runs} 分` : '關鍵事件'}</em>
                </article>`).join('') : '<div class="game-snapshot-muted">目前還沒有明確的得分關鍵打席。</div>'}
            </div>
          </section>

          ${decisions.length ? `
            <section class="game-snapshot-section">
              <div class="game-snapshot-title"><strong>投手結果</strong><span>官方判定</span></div>
              <div class="game-snapshot-decisions">
                ${decisions.map(item => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.name)}</strong></article>`).join('')}
              </div>
            </section>` : ''}
        </div>`;
    }

    function homeGameBatterPanel(detail, gameInfo = {}) {
      const plays = (Array.isArray(detail?.plays) ? detail.plays : []).filter(homeGameDetailDisplayPlay);
      const rawBatters = [
        ...(Array.isArray(detail?.gameBatters) ? detail.gameBatters : []),
        ...['away','home'].flatMap(side => [
          ...(Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : []),
          ...(Array.isArray(detail?.lineups?.[side]?.roster) ? detail.lineups[side].roster : []),
          ...(Array.isArray(detail?.startingLineup?.[side]) ? detail.startingLineup[side] : [])
        ])
      ];
      const normalizeName = value => String(value || '')
        .replace(/^(?:代打|代跑)[・·\\s]*/,'')
        .replace(/\\s+/g,'')
        .trim();
      const pickNumber = (row, keys) => {
        for (const key of keys) {
          const n = Number(row?.[key]);
          if (Number.isFinite(n)) return n;
        }
        return null;
      };
      const statAliases = {
        ab:['gameAb','ab','atBats'],
        r:['gameRuns','runs','r'],
        h:['gameHits','hits','h'],
        rbi:['gameRbi','rbi'],
        bb:['gameWalks','gameBb','walks','bb'],
        so:['gameStrikeouts','gameSo','strikeouts','so','k'],
        hr:['gameHomeRuns','gameHr','homeRuns','hr']
      };
      const playStatsFor = name => {
        const target = normalizeName(name);
        const totals = { ab:0, h:0, rbi:0, bb:0, so:0, hr:0 };
        for (const play of plays) {
          const batter = normalizeName(play?.batter || play?.hitter);
          if (!target || !batter || (target !== batter && !target.includes(batter) && !batter.includes(target))) continue;
          const text = [play?.result, play?.raw, play?.description].filter(Boolean).join(' ');
          const isHr = /全壘打|全塁打|本塁打|home\\s*run/i.test(text);
          const isTriple = /三壘安打|三塁打|triple/i.test(text);
          const isDouble = /二壘安打|二塁打|double/i.test(text);
          const isHit = isHr || isTriple || isDouble || /(?:安打|ヒット|single)/i.test(text);
          const isBb = /四壞|故意四壞|保送|四球|walk/i.test(text);
          const isHbp = /觸身|触身|死球|hit\\s*by\\s*pitch/i.test(text);
          const isSac = /犧牲飛球|犧牲觸擊|犧牲短打|犠牲フライ|犠打|sacrifice/i.test(text);
          const isCi = /捕手妨礙|打撃妨害|catcher.{0,3}interference/i.test(text);
          const isSo = /三振|strikeout/i.test(text);
          if (!isBb && !isHbp && !isSac && !isCi) totals.ab += 1;
          if (isHit) totals.h += 1;
          if (isHr) totals.hr += 1;
          if (isBb) totals.bb += 1;
          if (isSo) totals.so += 1;
          totals.rbi += homeSnapshotPlayRbi(play);
        }
        return totals;
      };
      const rawByName = new Map();
      for (const row of rawBatters) {
        const name = String(row?.fullName || row?.name || row?.playerName || '').trim();
        if (name) rawByName.set(normalizeName(name), row);
      }
      const sideRows = side => {
        const lineup = Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : [];
        const lockedStarters = Array.isArray(detail?.startingLineup?.[side]) ? detail.startingLineup[side] : [];

        // Historical final payloads may only retain the current lineup after
        // substitutions. Recover the original batting order from the first nine
        // distinct hitters who actually appeared for that side.
        const firstNine = [];
        const firstNineSeen = new Set();
        for (const play of plays) {
          const half = String(play?.half || '');
          const playSide = half === 'top' ? 'away' : half === 'bottom' ? 'home' : '';
          if (playSide !== side) continue;
          const name = String(play?.batter || play?.hitter || '').replace(/^(?:代打|代跑)[・·\\s]*/,'').trim();
          const key = normalizeName(name);
          if (!key || firstNineSeen.has(key)) continue;
          firstNineSeen.add(key);
          firstNine.push({ name, order:firstNine.length + 1, isStarter:true });
          if (firstNine.length === 9) break;
        }

        const starterLineup = lockedStarters.length === 9
          ? lockedStarters
          : firstNine.length === 9
            ? firstNine
            : lineup.filter(player => player?.isSubstitute !== true);

        const orderByName = new Map();
        const starterByOrder = new Map();
        const starterNames = new Set();
        starterLineup.forEach((player,index) => {
          const name = String(player?.fullName || player?.name || player?.playerName || '').trim();
          const key = normalizeName(name);
          const order = Math.max(1, Math.min(9, Number(player?.order || index + 1) || index + 1));
          if (!key) return;
          orderByName.set(key, order);
          starterByOrder.set(order, key);
          starterNames.add(key);
        });

        const cleanSubName = value => {
          let text = String(value || '').replace(/[()（）]/g,'').trim();
          text = text
            .replace(/^(?:投手|捕手|一壘手|二壘手|三壘手|游擊手|遊擊手|左外野手|中外野手|右外野手|指定打擊|DH)[-：:]*/,'')
            .replace(/[-：:]*(?:投手|捕手|一壘手|二壘手|三壘手|游擊手|遊擊手|左外野手|中外野手|右外野手|指定打擊|DH)$/,'')
            .replace(/^[-：:]+|[-：:]+$/g,'')
            .trim();
          return text;
        };

        // Reconstruct the real batting-slot substitution chain from the official
        // change log. The play "battingOrder" value is per-inning PA sequence,
        // not the lineup slot, so it must never be used for this purpose.
        const activeSlotByName = new Map(orderByName);
        const substitutionOrder = new Map();
        const substitutionSequence = new Map();
        let substitutionIndex = 0;
        for (const play of plays) {
          const description = String(play?.description || '');
          const re = /更換(?:代打|代跑|選手|守備)：([^。]+?)=>([^。]+)/g;
          let match;
          while ((match = re.exec(description))) {
            const fromName = cleanSubName(match[1]);
            const toName = cleanSubName(match[2]);
            const fromKey = normalizeName(fromName);
            const toKey = normalizeName(toName);
            if (!fromKey || !toKey || fromKey === toKey) continue;
            const order = activeSlotByName.get(fromKey) || orderByName.get(fromKey) || 0;
            if (!(order >= 1 && order <= 9)) continue;
            activeSlotByName.delete(fromKey);
            activeSlotByName.set(toKey, order);
            orderByName.set(toKey, order);
            substitutionOrder.set(toKey, order);
            if (!substitutionSequence.has(toKey)) substitutionSequence.set(toKey, substitutionIndex++);
          }
        }

        // The final/current lineup is an authoritative fallback for replacements
        // whose change text could not be parsed.
        lineup.forEach((player,index) => {
          const name = String(player?.fullName || player?.name || player?.playerName || '').trim();
          const key = normalizeName(name);
          const order = Math.max(1, Math.min(9, Number(player?.order || index + 1) || index + 1));
          if (!key) return;
          if (!orderByName.has(key)) orderByName.set(key, order);
          if (player?.isSubstitute === true || starterByOrder.get(order) !== key) {
            substitutionOrder.set(key, order);
            if (!substitutionSequence.has(key)) substitutionSequence.set(key, 100 + index);
          }
        });

        const rawByKey = new Map();
        for (const row of rawBatters) {
          const name = String(row?.fullName || row?.name || row?.playerName || '').trim();
          const key = normalizeName(name);
          if (!key) continue;
          const existing = rawByKey.get(key);
          const score = ['gameAb','gameHits','gameRbi','gameWalks','gameBb','gameStrikeouts','gameSo','gameHomeRuns','gameHr']
            .reduce((sum,k) => sum + (Number.isFinite(Number(row?.[k])) ? 1 : 0), 0);
          if (!existing || score > existing.score) rawByKey.set(key, { row, score });
        }

        const candidates = [];
        const seen = new Set();
        const addByName = (name, order, isSubstitute = false, sourceIndex = 999, sourceRow = null) => {
          const key = normalizeName(name);
          if (!key || seen.has(key) || !(order >= 1 && order <= 9)) return;
          const raw = rawByKey.get(key)?.row || sourceRow || {};
          const fallback = playStatsFor(name);
          const stat = keyName => {
            const official = pickNumber(raw, statAliases[keyName]);
            return official === null ? fallback[keyName] ?? null : official;
          };
          seen.add(key);
          candidates.push({
            order,
            name:String(name || '').trim(),
            key,
            starter:!isSubstitute && starterByOrder.get(order) === key,
            substitute:Boolean(isSubstitute),
            firstAppearance:sourceIndex,
            ab:stat('ab'), r:stat('r'), h:stat('h'), rbi:stat('rbi'),
            bb:stat('bb'), so:stat('so'), hr:stat('hr')
          });
        };

        starterLineup.forEach((row,index) => {
          const name = String(row?.fullName || row?.name || row?.playerName || '').trim();
          const order = Number(row?.order || index + 1);
          addByName(name, order, false, index, row);
        });

        const substitutionNames = [...substitutionOrder.entries()]
          .sort((a,b) => {
            const orderDiff = a[1] - b[1];
            if (orderDiff) return orderDiff;
            return Number(substitutionSequence.get(a[0]) || 0) - Number(substitutionSequence.get(b[0]) || 0);
          });
        for (const [key,order] of substitutionNames) {
          const row = rawByKey.get(key)?.row
            || lineup.find(player => normalizeName(player?.fullName || player?.name || player?.playerName) === key)
            || {};
          const name = String(row?.fullName || row?.name || row?.playerName || '').trim()
            || [...plays].map(play => String(play?.batter || play?.hitter || '').trim()).find(x => normalizeName(x) === key)
            || key;
          addByName(name, order, true, 100 + Number(substitutionSequence.get(key) || 0), row);
        }

        return candidates.sort((a,b) =>
          a.order - b.order
          || Number(a.substitute) - Number(b.substitute)
          || a.firstAppearance - b.firstAppearance
        );
      };
      const teamRuns = side => {
        const fromBoard = detailRunsFromScoreboard(detail, side);
        if (fromBoard !== null) return fromBoard;
        const n = Number(side === 'away' ? gameInfo?.awayScore : gameInfo?.homeScore);
        return Number.isFinite(n) ? n : null;
      };
      const value = n => Number.isFinite(Number(n)) ? String(Number(n)) : '—';
      const teamSection = (side, teamName) => {
        const rows = sideRows(side);
        const totals = rows.reduce((acc,row) => {
          for (const key of ['ab','h','rbi','bb','so','hr']) {
            if (Number.isFinite(Number(row[key]))) acc[key] += Number(row[key]);
          }
          return acc;
        }, {ab:0,h:0,rbi:0,bb:0,so:0,hr:0});
        const runs = teamRuns(side);
        let previousOrder = null;
        return `
          <section class="game-batter-team">
            <div class="game-batter-team-head"><span>${side === 'away' ? '客隊' : '主隊'}</span><strong>${escapeHtml(teamName)}</strong><em>${rows.length} 人</em></div>
            <div class="game-batter-table-head"><span>棒次</span><span>打者</span><span>AB</span><span>R</span><span>H</span><span>RBI</span><span>BB</span><span>K</span><span>HR</span></div>
            <div class="game-batter-scroll">
              ${rows.length ? rows.map(row => {
                const showOrder = row.order >= 1 && row.order <= 9 && row.order !== previousOrder;
                previousOrder = row.order;
                return `
                <div class="game-batter-row ${row.substitute ? 'is-sub' : ''}">
                  <span class="game-batter-order">${showOrder ? row.order : ''}</span>
                  <strong class="game-batter-name" title="${escapeHtml(row.name)}">${row.substitute ? '<i class="game-batter-sub-arrow" aria-hidden="true">↳</i>' : ''}${escapeHtml(row.name)}</strong>
                  <span>${value(row.ab)}</span><span>${value(row.r)}</span><span>${value(row.h)}</span><span>${value(row.rbi)}</span>
                  <span>${value(row.bb)}</span><span>${value(row.so)}</span><span>${value(row.hr)}</span>
                </div>`;
              }).join('') : '<div class="game-detail-empty">目前沒有可整理的打者紀錄。</div>'}
            </div>
            <div class="game-batter-total"><strong>TOTAL</strong><span></span><span>${totals.ab}</span><span>${runs === null ? '—' : runs}</span><span>${totals.h}</span><span>${totals.rbi}</span><span>${totals.bb}</span><span>${totals.so}</span><span>${totals.hr}</span></div>
          </section>`;
      };
      const away = String(gameInfo?.away || detail?.game?.away || '客隊');
      const home = String(gameInfo?.home || detail?.game?.home || '主隊');
      return `<div class="game-batter-page">${teamSection('away',away)}${teamSection('home',home)}</div>`;
    }

    function homeGamePitcherPanel(detail, gameInfo = {}) {
      const records = activeHomeGameDetail?.pitcherRecords || null;
      const loading = Boolean(activeHomeGameDetail?.pitcherRecordsLoading);
      const error = String(activeHomeGameDetail?.pitcherRecordsError || '');
      const teams = [
        ['away', String(gameInfo?.away || detail?.game?.away || '客隊')],
        ['home', String(gameInfo?.home || detail?.game?.home || '主隊')]
      ];
      const currentPitcher = detail?.current?.pitcher || {};
      const currentId = String(currentPitcher?.id || currentPitcher?.acnt || '');
      const currentName = String(currentPitcher?.fullName || currentPitcher?.name || '').trim();
      const rowValue = (row, index, fallback = '0') => {
        const value = Array.isArray(row) ? row[index] : '';
        return value === null || value === undefined || String(value).trim() === '' ? fallback : String(value);
      };
      const samePitcher = (row) => {
        const id = rowValue(row, 0, '');
        const name = rowValue(row, 1, '');
        return Boolean((currentId && id && currentId === id) || (currentName && name && (currentName.includes(name) || name.includes(currentName))));
      };
      const inningsToOuts = (value) => {
        const text = String(value ?? '').trim();
        if (!text) return 0;
        const match = text.match(/^(\d+)(?:\.([12]))?$/);
        if (!match) return 0;
        return Number(match[1]) * 3 + Number(match[2] || 0);
      };
      const outsToInnings = (outs) => {
        const safe = Math.max(0, Number(outs) || 0);
        return `${Math.floor(safe / 3)}.${safe % 3}`;
      };
      const totalPitchingInnings = (list) => {
        const totalOuts = (Array.isArray(list) ? list : []).reduce(
          (sum, row) => sum + inningsToOuts(rowValue(row,2,'0')),
          0
        );
        return outsToInnings(totalOuts);
      };
      const totalsFor = (list) => {
        const totals = { p:0, h:0, hr:0, bb:0, hbp:0, k:0, r:0, er:0 };
        for (const row of list) {
          totals.p += Number(rowValue(row,3,'0')) || 0;
          totals.h += Number(rowValue(row,4,'0')) || 0;
          totals.hr += Number(rowValue(row,5,'0')) || 0;
          totals.bb += Number(rowValue(row,6,'0')) || 0;
          totals.hbp += Number(rowValue(row,7,'0')) || 0;
          totals.k += Number(rowValue(row,8,'0')) || 0;
          totals.r += Number(rowValue(row,9,'0')) || 0;
          totals.er += Number(rowValue(row,10,'0')) || 0;
        }
        return [totalPitchingInnings(list), totals.p, totals.h, totals.hr, totals.bb, totals.hbp, totals.k, totals.r, totals.er];
      };
      const teamSection = ([side, teamName]) => {
        const list = Array.isArray(records?.[side]) ? records[side] : [];
        let rows = '';
        if (list.length) {
          rows = list.map(row => `
            <div class="game-pitcher-row ${samePitcher(row) ? 'is-current' : ''}">
              <strong title="${escapeHtml(rowValue(row,1,'—'))}">${escapeHtml(rowValue(row,1,'—'))}</strong>
              <span>${escapeHtml(rowValue(row,2,'—'))}</span>
              <span>${escapeHtml(rowValue(row,3))}</span>
              <span>${escapeHtml(rowValue(row,4))}</span>
              <span>${escapeHtml(rowValue(row,5))}</span>
              <span>${escapeHtml(rowValue(row,6))}</span>
              <span>${escapeHtml(rowValue(row,7))}</span>
              <span>${escapeHtml(rowValue(row,8))}</span>
              <span>${escapeHtml(rowValue(row,9))}</span>
              <span>${escapeHtml(rowValue(row,10))}</span>
            </div>`).join('');
        } else if (loading) {
          rows = '<div class="game-pitcher-empty">正在讀取本場投手紀錄…</div>';
        } else if (error) {
          rows = `<div class="game-pitcher-empty">${escapeHtml(error)}</div>`;
        } else {
          rows = '<div class="game-pitcher-empty">點開投手紀錄後才載入資料。</div>';
        }
        const backendTotal = Array.isArray(records?.[`${side}Total`]) ? records[`${side}Total`] : null;
        const totals = list.length ? (backendTotal?.length === 9 ? backendTotal : totalsFor(list)) : null;
        const awayScore = Number(gameInfo?.awayScore ?? detail?.game?.awayScore);
        const homeScore = Number(gameInfo?.homeScore ?? detail?.game?.homeScore);
        const finalStatus = String(detail?.status || gameInfo?.status || '').toLowerCase() === 'final';
        const fractionalIp = totals && /\\.[12]$/.test(String(totals[0] || ''));
        const walkoffNote = side === 'away' && finalStatus && fractionalIp
          && Number.isFinite(awayScore) && Number.isFinite(homeScore) && homeScore > awayScore
          ? '<em class="game-pitcher-total-note">再見結束</em>'
          : '';
        const totalHtml = totals ? `
          <div class="game-pitcher-total">
            <strong>TOTAL${walkoffNote}</strong>
            ${totals.map(value => `<span>${escapeHtml(String(value))}</span>`).join('')}
          </div>` : '';
        return `
          <section class="game-pitcher-team game-pitcher-team-${side}">
            <div class="game-pitcher-team-head"><span>${side === 'away' ? '客隊' : '主隊'}</span><strong>${escapeHtml(teamName)}</strong><em>${list.length} 位</em></div>
            <div class="game-pitcher-table-head">
              <span>投手</span><span>IP</span><span>P</span><span>H</span><span>HR</span><span>BB</span><span>HBP</span><span>K</span><span>R</span><span>ER</span>
            </div>
            <div class="game-pitcher-scroll">${rows}</div>
            ${totalHtml}
          </section>`;
      };
      return `<div class="game-pitcher-page">${teams.map(teamSection).join('')}</div>`;
    }
    function homeMatchCenterDisplayTime(value) {
      const ms = typeof value === 'number' ? value : Date.parse(String(value || ''));
      if (!Number.isFinite(ms)) return '';
      return new Intl.DateTimeFormat('zh-TW', {
        hour:'2-digit',
        minute:'2-digit',
        hour12:false
      }).format(new Date(ms));
    }

    function homePregameLineupEntries(detail, side) {
      const raw = Array.isArray(detail?.lineups?.[side]?.batters) ? detail.lineups[side].batters : [];
      return raw.map((player, index) => ({
        order:Number(player?.order || index + 1),
        number:String(player?.number || player?.uniformNumber || player?.jersey || '').trim(),
        name:String(player?.fullName || player?.name || player?.playerName || '').trim(),
        position:(() => {
          const pos = String(player?.position || player?.pos || '').trim();
          return pos === '0' ? 'DH' : pos;
        })()
      }))
        .filter(player => player.name && player.order >= 1 && player.order <= 9)
        .sort((a,b) => a.order - b.order)
        .slice(0,9);
    }

    function homePregameLineupPage(detail, gameInfo, game) {
      const away = String(gameInfo?.away || game?.away || '客隊');
      const home = String(gameInfo?.home || game?.home || '主隊');
      const awayRows = homePregameLineupEntries(detail, 'away');
      const homeRows = homePregameLineupEntries(detail, 'home');
      const awayByOrder = new Map(awayRows.map(player => [player.order, player]));
      const homeByOrder = new Map(homeRows.map(player => [player.order, player]));

      const playerHtml = (player) => {
        if (!player) {
          return `
            <div class="pregame-lineup-player is-empty">
              <span class="pregame-lineup-jersey">—</span>
              <strong>—</strong>
              <span class="pregame-lineup-position">—</span>
            </div>
          `;
        }
        return `
          <div class="pregame-lineup-player">
            <span class="pregame-lineup-jersey">${player.number ? `#${escapeHtml(player.number)}` : '—'}</span>
            <strong>${escapeHtml(player.name)}</strong>
            <span class="pregame-lineup-position">${escapeHtml(player.position || '—')}</span>
          </div>
        `;
      };

      return `
        <div class="pregame-lineup-page">
          <div class="pregame-lineup-title">
            <div>
              <span>STARTING LINEUP</span>
              <strong>先發打序</strong>
            </div>
            <em>官方公布</em>
          </div>

          <div class="pregame-lineup-compare">
            <div class="pregame-lineup-compare-head">
              <div class="pregame-lineup-team-head is-away">
                <div><span>客隊</span><strong>${escapeHtml(away)}</strong></div>
                <small><b>背號</b><b>姓名</b><b>守位</b></small>
              </div>
              <div class="pregame-lineup-head-center">棒次</div>
              <div class="pregame-lineup-team-head is-home">
                <div><span>主隊</span><strong>${escapeHtml(home)}</strong></div>
                <small><b>背號</b><b>姓名</b><b>守位</b></small>
              </div>
            </div>

            <div class="pregame-lineup-rows">
              ${Array.from({length:9}, (_, index) => {
                const order = index + 1;
                return `
                  <div class="pregame-lineup-compare-row">
                    <div class="pregame-lineup-side is-away">
                      ${playerHtml(awayByOrder.get(order) || null)}
                    </div>
                    <div class="pregame-lineup-order"><i>${order}</i></div>
                    <div class="pregame-lineup-side is-home">
                      ${playerHtml(homeByOrder.get(order) || null)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function homePregameOverviewPager(center, detail, gameInfo, game) {
      const overviewHtml = homePregameMatchupPanel(center, gameInfo, game);
      const lineupReady = homeDetailLineupReady(detail);
      if (!lineupReady) {
        if (activeHomeGameDetail) activeHomeGameDetail.overviewPage = 0;
        return overviewHtml;
      }
      const initialPage = Math.max(0, Math.min(1, Number(activeHomeGameDetail?.overviewPage) || 0));
      return `
        <div class="match-overview-pager" data-overview-pager>
          <div class="match-overview-page" data-overview-page="0">${overviewHtml}</div>
          <div class="match-overview-page" data-overview-page="1">${homePregameLineupPage(detail, gameInfo, game)}</div>
        </div>
        <div class="match-overview-pager-footer">
          <div class="match-overview-pager-dots" aria-label="對戰總覽頁面">
            <button type="button" class="match-overview-page-dot ${initialPage === 0 ? 'is-active' : ''}" data-overview-page-button="0" aria-label="賽前比較"></button>
            <button type="button" class="match-overview-page-dot ${initialPage === 1 ? 'is-active' : ''}" data-overview-page-button="1" aria-label="先發打序"></button>
          </div>
          <span data-overview-pager-label>${initialPage === 1 ? '先發打序' : '左滑查看先發打序'}</span>
        </div>
      `;
    }

    function bindHomeOverviewPager(root) {
      const scroller = root?.querySelector?.('[data-overview-pager]');
      if (!scroller || !activeHomeGameDetail) return;
      const pages = [...scroller.querySelectorAll('[data-overview-page]')];
      if (pages.length < 2) return;
      const dots = [...root.querySelectorAll('[data-overview-page-button]')];
      const label = root.querySelector('[data-overview-pager-label]');
      const clampPage = value => Math.max(0, Math.min(pages.length - 1, Number(value) || 0));
      const updatePage = value => {
        const page = clampPage(value);
        if (activeHomeGameDetail) activeHomeGameDetail.overviewPage = page;
        dots.forEach((dot,index) => dot.classList.toggle('is-active', index === page));
        if (label) label.textContent = page === 1 ? '先發打序' : '左滑查看先發打序';
      };
      const pageWidth = () => Math.max(1, scroller.clientWidth || scroller.getBoundingClientRect().width || 1);
      const initial = clampPage(activeHomeGameDetail.overviewPage);
      requestAnimationFrame(() => {
        scroller.scrollLeft = initial * pageWidth();
        updatePage(initial);
      });
      let scrollRaf = 0;
      scroller.addEventListener('scroll', () => {
        if (scrollRaf) cancelAnimationFrame(scrollRaf);
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          updatePage(Math.round(scroller.scrollLeft / pageWidth()));
        });
      }, { passive:true });
      dots.forEach((dot,index) => {
        dot.addEventListener('click', () => {
          updatePage(index);
          scroller.scrollTo({ left:index * pageWidth(), behavior:'smooth' });
        });
      });
    }

    function homeMatchCenterDataPanel(tab, detail, gameInfo, game) {
      if (!activeHomeGameDetail || !['CPBL','NPB'].includes(activeHomeGameDetail.league)) return '';
      const center = activeHomeGameDetail?.pregameCenter || null;
      const updateTime = homeMatchCenterDisplayTime(center?.fetchedAt || center?.updatedAt || 0);
      return `
        <section class="match-center-data-panel">
          <div class="match-center-data-tools">
            <span>
              兩隊賽前資料比較
              ${updateTime ? `<small class="match-center-update-time">鎖定 ${escapeHtml(updateTime)}</small>` : ''}
            </span>
          </div>
          <div class="pregame-center-body">
            ${homePregameOverviewPager(center, detail, gameInfo, game)}
          </div>
        </section>
      `;
    }

    async function refreshHomePregameExtras(force = false) {
      if (!activeHomeGameDetail || !['CPBL','NPB'].includes(activeHomeGameDetail.league)) return;
      const { league, date, game, key } = activeHomeGameDetail;
      if (!game?.id || !game?.away || !game?.home) return;
      if (activeHomeGameDetail.pregameExtrasLoading) return;
      const tab = 'overview';
      if (!force && activeHomeGameDetail.pregameCenter) return;
      activeHomeGameDetail.pregameExtrasLoading = true;
      activeHomeGameDetail.pregameExtrasError = '';
      const cachedDetail = homeGameDetailCache.get(key)?.detail || { status:game?.status, game, plays:[] };
      renderHomeGameDetail(cachedDetail, game);
      try {
        const data = await homePregameCenterRequest(league, date, game, force);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        activeHomeGameDetail.pregameExtrasUpdatedAt = Date.now();
        const detailPregame = homeGameDetailCache.get(key)?.detail?.pregame || null;
        const existing = data?.starters || {};
        activeHomeGameDetail.pregameCenter = {
          ...data,
          starters:{
            away:detailPregame?.awayStarter || existing?.away || null,
            home:detailPregame?.homeStarter || existing?.home || null,
            source:detailPregame?.source || existing?.source || ''
          }
        };
      } catch (error) {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        activeHomeGameDetail.pregameExtrasError = error?.message || '對戰總覽讀取失敗。';
      } finally {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        activeHomeGameDetail.pregameExtrasLoading = false;
        const detail = homeGameDetailCache.get(key)?.detail || cachedDetail;
        renderHomeGameDetail(detail, game);
      }
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
      const seasonResultLabels = homeGameDetailSeasonResultLabels(detail, displayPlays);
      const groups = homeGameDetailGroups(displayPlays);
      const gameInfo = detail?.game || game || {};
      const leagueLabel = activeHomeGameDetail?.league === 'CPBL' ? '中華職棒' : '日本職棒';
      const dateLabel = String(activeHomeGameDetail?.date || '').replaceAll('-', '/');
      const detailCacheAt = activeHomeGameDetail ? Number(homeGameDetailCache.get(activeHomeGameDetail.key)?.at || 0) : 0;
      const detailUpdateTime = homeMatchCenterDisplayTime(detail?.updatedAt || detail?.fetchedAt || detailCacheAt || 0);
      const pregame = detail?.pregame || null;
      if (pregame && activeHomeGameDetail?.pregameCenter) {
        const existing = activeHomeGameDetail.pregameCenter.starters || {};
        activeHomeGameDetail.pregameCenter.starters = {
          away:existing?.away || pregame?.awayStarter || null,
          home:existing?.home || pregame?.homeStarter || null,
          source:existing?.source || pregame?.source || ''
        };
      }
      const requestedCenterTab = String(activeHomeGameDetail?.centerTab || '');
      const supportsPitchers = homePitcherRecordsSupported(activeHomeGameDetail?.league, gameInfo);
      const supportsBullpen = activeHomeGameDetail?.league === 'CPBL';
      const allowedCenterTabs = supportsPitchers
        ? (supportsBullpen ? ['play','batters','pitchers','bullpen','snapshot','overview'] : ['play','batters','pitchers','snapshot','overview'])
        : (supportsBullpen ? ['play','batters','bullpen','snapshot','overview'] : ['play','batters','snapshot','overview']);
      const centerTab = allowedCenterTabs.includes(requestedCenterTab) ? requestedCenterTab : 'play';
      const centerDataPanel = centerTab === 'overview'
        ? homeMatchCenterDataPanel('overview', detail, gameInfo, game)
        : centerTab === 'batters'
          ? homeGameBatterPanel(detail, gameInfo)
          : centerTab === 'pitchers'
            ? homeGamePitcherPanel(detail, gameInfo)
          : centerTab === 'bullpen'
            ? homeBullpenDetailPanel(detail, gameInfo, game)
            : centerTab === 'snapshot'
              ? homeSnapshotPanel(detail, gameInfo, game)
              : '';
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
                <div class="game-detail-pa-main"><strong>${escapeHtml(String(play?.batter || '未辨識打者'))}</strong><span class="game-detail-pa-result ${homeGameDetailResultTone(play?.result)}">${escapeHtml(String(seasonResultLabels.get(play) || play?.result || '—'))}</span></div>
                <div class="game-detail-pa-meta">${escapeHtml(homeGameDetailMeta(play))}</div>
              </div>`).join('')}
          </div>
        </details>`).join('') : `<div class="game-detail-empty">${status === 'scheduled' ? '比賽尚未開始，開打後這裡會顯示逐打席。' : loading ? '正在讀取官方逐打席…' : '官方來源目前沒有可顯示的逐打席。'}</div>`;

      body.innerHTML = `
        <header class="game-detail-sticky-head">
          <button id="homeGameDetailBack" class="game-detail-back" type="button">← 返回賽事</button>
          <div class="game-detail-head-copy"><strong>對戰中心</strong><span>${escapeHtml(leagueLabel)}｜${escapeHtml(dateLabel)}${gameInfo?.venue ? `｜${escapeHtml(String(gameInfo.venue))}` : ''}${detailUpdateTime ? `｜更新 ${escapeHtml(detailUpdateTime)}` : ''}</span></div>
          ${status === 'live' ? `<span class="game-detail-live-dot ${loading ? 'is-refreshing' : ''}"><i></i>LIVE<span id="homeGameDetailRefreshCountdown" style="margin-left:6px;font-size:11px;font-weight:700;opacity:.72;white-space:nowrap">${loading ? '更新中…' : ''}</span></span>` : ''}
        </header>
        <nav class="match-center-tabs ${supportsPitchers && supportsBullpen ? 'is-six' : (supportsPitchers || supportsBullpen ? 'is-five' : 'is-four')}" aria-label="對戰中心分類">
          <button type="button" data-match-center-tab="play" class="${centerTab === 'play' ? 'active' : ''}">逐打席</button>
          <button type="button" data-match-center-tab="batters" class="${centerTab === 'batters' ? 'active' : ''}">打者紀錄</button>
          ${supportsPitchers ? `<button type="button" data-match-center-tab="pitchers" class="${centerTab === 'pitchers' ? 'active' : ''}">投手紀錄</button>` : ''}
          ${supportsBullpen ? `<button type="button" data-match-center-tab="bullpen" class="${centerTab === 'bullpen' ? 'active' : ''}">投手狀態</button>` : ''}
          <button type="button" data-match-center-tab="snapshot" class="${centerTab === 'snapshot' ? 'active' : ''}">比賽快照</button>
          <button type="button" data-match-center-tab="overview" class="${centerTab === 'overview' ? 'active' : ''}">對戰總覽</button>
        </nav>
        <main class="game-detail-content">
          <div class="match-center-panel ${centerTab === 'play' ? 'active' : ''}" data-match-center-panel="play">
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
            <section class="game-detail-play-section">
              <div class="game-detail-section-title"><strong>全場逐打席</strong><span>${displayPlays.length} 筆</span></div>
              ${playsHtml}
            </section>
          </div>
          ${centerTab !== 'play' ? `<div class="match-center-panel active ${centerTab === 'pitchers' ? 'game-pitcher-panel' : centerTab === 'batters' ? 'game-batter-panel' : ''}" data-match-center-panel="${centerTab}">${centerDataPanel}</div>` : ''}
        </main>`;
      overlay.classList.remove('hidden');
      document.body.classList.add('home-game-detail-open');
      body.querySelector('#homeGameDetailBack')?.addEventListener('click', closeHomeGameDetail);
      body.querySelector('#homeGameDetailRetry')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));
      body.querySelectorAll('[data-match-center-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!activeHomeGameDetail) return;
          const tab = String(btn.dataset.matchCenterTab || 'play');
          const hasPitchers = homePitcherRecordsSupported(activeHomeGameDetail?.league, activeHomeGameDetail?.game);
          const hasBullpen = activeHomeGameDetail?.league === 'CPBL';
          const allowedTabs = hasPitchers
            ? (hasBullpen ? ['play','batters','pitchers','bullpen','snapshot','overview'] : ['play','batters','pitchers','snapshot','overview'])
            : (hasBullpen ? ['play','batters','bullpen','snapshot','overview'] : ['play','batters','snapshot','overview']);
          if (!allowedTabs.includes(tab)) return;
          activeHomeGameDetail.centerTab = tab;
          const current = homeGameDetailCache.get(activeHomeGameDetail.key)?.detail || detail;
          renderHomeGameDetail(current, game);
          if (tab === 'pitchers') void refreshHomePitcherRecords({ force:false });
          if (tab === 'bullpen') void refreshHomeBullpenStatus({ force:false });
        });
      });
      bindHomeOverviewPager(body);
      updateHomeGameDetailRefreshCountdown();
    }

    function homeGameDecisionsSettled(detail) {
      if (String(detail?.status || '').toLowerCase() !== 'final') return true;
      const game = detail?.game || {};
      const awayScore = Number(game?.awayScore);
      const homeScore = Number(game?.homeScore);
      if (Number.isFinite(awayScore) && Number.isFinite(homeScore) && awayScore === homeScore) return true;
      const decisions = detail?.decisions || detail?.gameDecisions || null;
      const winner = String(decisions?.winningPitcher?.name || decisions?.winningPitcher?.fullName || '').trim();
      const loser = String(decisions?.losingPitcher?.name || decisions?.losingPitcher?.fullName || '').trim();
      return Boolean(winner && loser);
    }

    function homeGameDetailCacheTtl(detail) {
      const status = String(detail?.status || '').toLowerCase();
      if (status === 'final') {
        const plays = Array.isArray(detail?.plays) ? detail.plays : [];
        if (activeHomeGameDetail?.league === 'CPBL' && plays.length === 0) return 0;
        return homeGameDecisionsSettled(detail) ? 12 * 60 * 60 * 1000 : 60 * 1000;
      }
      if (status === 'cancelled') return 12 * 60 * 60 * 1000;
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
        if (detail && league === 'CPBL' && String(detail?.status || '').toLowerCase() === 'final' && !homeGameDecisionsSettled(detail)) {
          try {
            detail = await leagueGameDetailRequest(league, date, { ...game, ...(detail?.game || {}), status:'final' }, false);
            fromPublishedCache = false;
            fromAnyCache = true;
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
        const starterHasStats = (starter) => Boolean(starter?.stats && Object.keys(starter.stats).some(key => String(starter.stats[key] ?? '').trim()));
        const existingPregame = detail?.pregame || null;
        const npbNeedsStarterSnapshot = league === 'NPB' && (
          !starterHasStats(existingPregame?.awayStarter) ||
          !starterHasStats(existingPregame?.homeStarter)
        );
        const shouldLoadPregameStarters = supportsPregameStarters && (
          (detailStatus === 'scheduled' && (force || !existingPregame)) ||
          npbNeedsStarterSnapshot
        );
        if (shouldLoadPregameStarters) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            if (!detail?.pregame) {
              detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
            }
          }
        }
        const detailChanged = !cached?.detail || JSON.stringify(cached.detail) !== JSON.stringify(detail);
        homeGameDetailCache.set(key, { at:Date.now(), detail });
        homeGameDetailErrorStreak = 0;
        syncHomeDailyGameFromDetail(league, date, game, detail);
        if (detail?.game?.id && !game.id) game.id = detail.game.id;
        if (detailChanged || force) renderHomeGameDetail(detail, game);
        scheduleHomeGameDetailRefresh(detail);
        if (activeHomeGameDetail?.centerTab === 'pitchers') void refreshHomePitcherRecords({ force:false });
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

    async function refreshHomeGameOverviewFromDaily(game, league, date, key) {
      if (!['CPBL','NPB'].includes(league) || !game?.id) return;
      try {
        const dailyKey = `${league}|${date}`;
        const dailyCached = homeDailyGamesCache.get(dailyKey);
        if (dailyCached) dailyCached.at = 0;

        const games = await loadHomeDailyGames(league, date, { force:true });
        if (!Array.isArray(games) || !activeHomeGameDetail || activeHomeGameDetail.key !== key) return;

        const gameId = String(game?.id || '');
        const fresh = games.find(item => String(item?.id || '') === gameId)
          || games.find(item => String(item?.away || '') === String(game?.away || '') && String(item?.home || '') === String(game?.home || ''));
        if (!fresh?.overview) return;

        activeHomeGameDetail.game = { ...activeHomeGameDetail.game, ...fresh };
        activeHomeGameDetail.pregameCenter = fresh.overview;

        const cachedDetail = homeGameDetailCache.get(key)?.detail || null;
        const detail = cachedDetail || { status:fresh?.status || game?.status, game:fresh, plays:[] };
        renderHomeGameDetail(detail, activeHomeGameDetail.game);
      } catch (error) {
        console.warn('matchup overview refresh', error);
      }
    }

    function openHomeGameDetail(game, league, date, options = {}) {
      if (!homeGameDetailSupported(league)) return;
      stopHomeDailyGamesAutoRefresh();
      const key = homeGameDetailKey(league, date, game);
      const rawRequestedTab = String(options?.tab || '');
      const openAllowedTabs = league === 'CPBL'
        ? ['play','pitchers','bullpen','snapshot','overview']
        : ['play','pitchers','snapshot','overview'];
      const requestedTab = openAllowedTabs.includes(rawRequestedTab) ? rawRequestedTab : '';
      const defaultTab = requestedTab || (String(game?.status || 'scheduled').toLowerCase() === 'scheduled' ? 'overview' : 'play');
      const cachedPitchers = homePitcherRecordsCache.get(key) || null;
      const cachedBullpen = homeBullpenSessionCache.get(key) || null;
      activeHomeGameDetail = { league, date, game, key, loading:false, centerTab:defaultTab, pregameCenter:game?.overview || null, pregameExtrasLoading:false, pregameExtrasError:'', pitcherRecords:cachedPitchers?.records || null, pitcherRecordsLoading:false, pitcherRecordsError:'', bullpenData:cachedBullpen?.data || null, bullpenLoading:false, bullpenError:'' };
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
      void refreshHomeGameOverviewFromDaily(game, league, date, key);
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
