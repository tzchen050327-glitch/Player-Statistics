    let postseasonLoadPromise = null;
    const postseasonLastAttemptAt = new Map();
    let postseasonMlbBracket = null;
    let postseasonMlbBracketAt = 0;
    let postseasonMlbBracketPromise = null;
    let postseasonMlbBracketError = '';
    let postseasonMlbRefreshTimer = null;
    const POSTSEASON_MLB_BROWSER_CACHE_MS = 5 * 60 * 1000;
    const POSTSEASON_MLB_LIVE_CACHE_MS = 60 * 1000;

    function postseasonMlbHasLiveGame(data = postseasonMlbBracket) {
      return (data?.series || []).some(series =>
        (series?.games || []).some(game => String(game?.status || '') === 'live')
      );
    }

    function postseasonMlbBrowserCacheMs(data = postseasonMlbBracket) {
      return postseasonMlbHasLiveGame(data) ? POSTSEASON_MLB_LIVE_CACHE_MS : POSTSEASON_MLB_BROWSER_CACHE_MS;
    }

    function postseasonMlbStopRefreshTimer() {
      if (!postseasonMlbRefreshTimer) return;
      clearTimeout(postseasonMlbRefreshTimer);
      postseasonMlbRefreshTimer = null;
    }

    function postseasonMlbEnsureRefreshTimer() {
      if (postseasonMlbRefreshTimer) return;
      if (currentPage !== 'postseason' || leagueHubLeague !== 'mlb' || !postseasonSeasonActive()) return;
      const delay = postseasonMlbBrowserCacheMs(postseasonMlbBracket);
      postseasonMlbRefreshTimer = setTimeout(async () => {
        postseasonMlbRefreshTimer = null;
        if (currentPage !== 'postseason' || leagueHubLeague !== 'mlb' || !postseasonSeasonActive()) return;
        if (document.visibilityState !== 'hidden') await loadPostseasonMlbBracket();
        postseasonMlbEnsureRefreshTimer();
      }, delay);
    }

    function postseasonEscape(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
      })[char]);
    }

    function postseasonLeagueLabel() {
      return ({ cpbl:'中華職棒', npb:'日本職棒', kbo:'韓國職棒', mlb:'美國大聯盟' })[leagueHubLeague] || '季後賽';
    }

    function postseasonSectionRows(section, limit = 99) {
      const rows = Array.isArray(section?.rows) ? section.rows.filter(row => row && row.official !== false) : [];
      return rows.slice().sort((a,b) => {
        const ar = Number(a?.rank), br = Number(b?.rank);
        if (Number.isFinite(ar) && Number.isFinite(br) && ar !== br) return ar - br;
        const ap = Number(a?.pct), bp = Number(b?.pct);
        if (Number.isFinite(ap) && Number.isFinite(bp) && ap !== bp) return bp - ap;
        return (Number(b?.wins) || 0) - (Number(a?.wins) || 0);
      }).slice(0, limit);
    }

    function postseasonTeamName(row) {
      const raw = String(row?.team || row?.sourceTeam || '').trim();
      if (leagueHubLeague === 'mlb' && typeof mlbStandingsTeamZh === 'function') return mlbStandingsTeamZh(raw);
      return raw || '—';
    }

    function postseasonRecord(row) {
      const wins = Number(row?.wins);
      const losses = Number(row?.losses);
      const ties = Number(row?.ties);
      const pct = Number(row?.pct);
      const record = Number.isFinite(wins) && Number.isFinite(losses)
        ? `${wins}-${losses}${Number.isFinite(ties) && ties > 0 ? `-${ties}` : ''}`
        : '—';
      const pctText = Number.isFinite(pct) ? pct.toFixed(3).replace(/^0/, '') : '';
      return pctText ? `${record} · ${pctText}` : record;
    }

    function postseasonHasSelectedLeagueData() {
      const cache = standingsOfficialCache;
      if (!cache) return false;
      if (leagueHubLeague === 'cpbl') return Boolean(cache?.cpbl?.annual?.rows?.length);
      if (leagueHubLeague === 'npb') return Boolean(cache?.npb?.central?.rows?.length || cache?.npb?.pacific?.rows?.length);
      if (leagueHubLeague === 'kbo') return Boolean(cache?.kbo?.regular?.rows?.length);
      if (leagueHubLeague === 'mlb') {
        return ['alEast','alCentral','alWest','nlEast','nlCentral','nlWest'].some(key => cache?.mlb?.[key]?.rows?.length);
      }
      return false;
    }

    function ensurePostseasonData() {
      if (postseasonHasSelectedLeagueData()) return Promise.resolve(standingsOfficialCache);
      if (postseasonLoadPromise) return postseasonLoadPromise;

      if (standingsOfficialLoading) {
        postseasonLoadPromise = new Promise(resolve => {
          const started = Date.now();
          const waitForSharedRequest = () => {
            if (!standingsOfficialLoading || Date.now() - started >= 8000) {
              resolve(standingsOfficialCache || null);
              return;
            }
            setTimeout(waitForSharedRequest, 120);
          };
          waitForSharedRequest();
        }).finally(() => {
          postseasonLoadPromise = null;
          if (currentPage === 'postseason') renderPostseasonPage();
        });
        return postseasonLoadPromise;
      }

      const key = String(leagueHubLeague || 'cpbl');
      const last = Number(postseasonLastAttemptAt.get(key) || 0);
      if (Date.now() - last < 30000) return Promise.resolve(null);
      postseasonLastAttemptAt.set(key, Date.now());

      // Reuse the standings payload first. Only fetch once when the selected
      // league is missing from memory. No independent postseason polling.
      const force = Boolean(standingsOfficialCache && !postseasonHasSelectedLeagueData());
      postseasonLoadPromise = Promise.resolve(loadOfficialStandings({ force }))
        .catch(() => null)
        .finally(() => {
          postseasonLoadPromise = null;
          if (currentPage === 'postseason') renderPostseasonPage();
        });
      return postseasonLoadPromise;
    }

    function postseasonSeedList(rows, { labels = null, empty = '目前沒有可用戰績資料' } = {}) {
      if (!rows.length) return `<div class="postseason-empty">${postseasonEscape(empty)}</div>`;
      return `<div class="postseason-seed-list">${rows.map((row,index) => {
        const seed = Array.isArray(labels) ? (labels[index] || `#${index + 1}`) : `#${index + 1}`;
        return `<div class="postseason-seed">
          <span class="postseason-seed-rank">${postseasonEscape(seed)}</span>
          <strong class="postseason-team">${postseasonEscape(postseasonTeamName(row))}</strong>
          <span class="postseason-record">${postseasonEscape(postseasonRecord(row))}</span>
        </div>`;
      }).join('')}</div>`;
    }

    function postseasonCard(title, subtitle, rows, options = {}) {
      return `<section class="postseason-card">
        <div class="postseason-card-head"><div><strong>${postseasonEscape(title)}</strong><span>${postseasonEscape(subtitle)}</span></div></div>
        ${postseasonSeedList(rows, options)}
      </section>`;
    }

    function postseasonCpblContent() {
      const cpbl = standingsOfficialCache?.cpbl || {};
      const first = postseasonSectionRows(cpbl.first, 1);
      const second = postseasonSectionRows(cpbl.second, 1);
      const annual = postseasonSectionRows(cpbl.annual, 3);
      const halfRows = [];
      const halfLabels = [];
      if (first[0]) { halfRows.push(first[0]); halfLabels.push('上半季'); }
      if (second[0]) { halfRows.push(second[0]); halfLabels.push('下半季'); }
      return `
        <div class="postseason-grid">
          ${postseasonCard('半季版圖','各半季目前排名第一',halfRows,{labels:halfLabels})}
          ${postseasonCard('年度戰績','年度目前前 3 名',annual)}
        </div>
        <div class="postseason-footnote">中職季後賽資格牽涉上下半季冠軍與年度戰績；此處先呈現資格判斷需要的現有戰績，不額外抓取資料。</div>`;
    }

    function postseasonNpbContent() {
      const npb = standingsOfficialCache?.npb || {};
      return `<div class="postseason-grid">
        ${postseasonCard('中央聯盟','目前前 3 名',postseasonSectionRows(npb.central,3))}
        ${postseasonCard('太平洋聯盟','目前前 3 名',postseasonSectionRows(npb.pacific,3))}
      </div>`;
    }

    function postseasonKboContent() {
      return `<div class="postseason-grid postseason-grid-single">
        ${postseasonCard('季後賽席位區','例行賽目前前 5 名',postseasonSectionRows(standingsOfficialCache?.kbo?.regular,5))}
      </div>`;
    }


    function postseasonTodayKey() {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit'
        }).format(new Date());
      } catch {
        return new Date().toISOString().slice(0,10);
      }
    }

    function postseasonSeasonActive() {
      const today = postseasonTodayKey();
      if (leagueHubLeague === 'mlb') {
        const start = ({ 2026:'2026-09-29' })[CURRENT_YEAR] || `${CURRENT_YEAR}-09-25`;
        return today >= start;
      }
      if (leagueHubLeague === 'npb') {
        // NPB regular season is 143 games per club. Switch as soon as both
        // leagues have completed their schedules, not on the CS opening date.
        const central = postseasonSectionRows(standingsOfficialCache?.npb?.central, 99);
        const pacific = postseasonSectionRows(standingsOfficialCache?.npb?.pacific, 99);
        const completed = rows => rows.length >= 6 &&
          rows.every(row => Number(row?.games) >= 143);
        if (completed(central) && completed(pacific)) return true;
        // The official 2026 regular-season finale was on 10/08. This fallback
        // only covers temporarily unavailable standings data after the finale.
        if (String(CURRENT_YEAR) === '2026' && today >= '2026-10-09') return true;
        return false;
      }
      if (leagueHubLeague === 'kbo') {
        const rows = postseasonSectionRows(standingsOfficialCache?.kbo?.regular,5);
        return rows.length >= 5 && rows.every(row => Number(row?.games) >= 144);
      }
      if (leagueHubLeague === 'cpbl') {
        const rows = postseasonSectionRows(standingsOfficialCache?.cpbl?.annual,99);
        return rows.length >= 6 && rows.every(row => Number(row?.games) >= 120);
      }
      return false;
    }

    function postseasonMatchCard(title, teamA, teamB, note = '', options = {}) {
      const a = postseasonEscape(teamA || '待定');
      const b = postseasonEscape(teamB || '待定');
      const hasSeriesScore = Array.isArray(options.seriesScore);
      const aScore = hasSeriesScore ? String(options.seriesScore[0]) : '—';
      const bScore = hasSeriesScore ? String(options.seriesScore[1]) : '—';
      const footer = options.format
        ? '<div class="postseason-series-foot" style="text-align:right">' + postseasonEscape(options.format) + '</div>'
        : '';
      return '<div class="postseason-series-card">' +
        '<div class="postseason-series-meta"><span>' + postseasonEscape(title) + '</span><em>' + postseasonEscape(note) + '</em></div>' +
        '<div class="postseason-bracket-teams">' +
          '<div class="postseason-bracket-team"><strong>' + a + '</strong><b>' + aScore + '</b></div>' +
          '<div class="postseason-bracket-team"><strong>' + b + '</strong><b>' + bScore + '</b></div>' +
        '</div>' + footer + '</div>';
    }

    let postseasonNpbGames = [];
    let postseasonNpbResultsAt = 0;
    let postseasonNpbResultsPromise = null;
    let postseasonNpbRefreshTimer = null;
    const POSTSEASON_NPB_RESULT_TTL = 90 * 1000;
    function postseasonNpbTeamKey(value) {
      const name = String(value || '').replace(/\\s+/g,'');
      if (/DeNA|ＤｅＮＡ|橫濱|横浜|ベイスターズ/.test(name)) return 'dena';
      if (/讀賣|読売|巨人/.test(name)) return 'giants';
      if (/阪神|タイガース/.test(name)) return 'tigers';
      if (/軟銀|ソフトバンク|福岡/.test(name)) return 'hawks';
      if (/日本火腿|日本ハム|ファイターズ|北海道/.test(name)) return 'fighters';
      if (/西武|ライオンズ|埼玉/.test(name)) return 'lions';
      return name;
    }
    function postseasonNpbWins(team, stage, rival) {
      const key = postseasonNpbTeamKey(team);
      const opponent = rival ? postseasonNpbTeamKey(rival) : null;
      if (!key) return 0;
      const seen = new Set();
      let wins = 0;
      for (const g of postseasonNpbGames) {
        if (String(g.competition) !== stage || String(g.status).toLowerCase() !== 'final') continue;
        const away = postseasonNpbTeamKey(g.away), home = postseasonNpbTeamKey(g.home);
        if (!away || !home || away === home) continue;
        if (opponent && ![away,home].includes(opponent)) continue;
        const as = Number(g.awayScore), hs = Number(g.homeScore);
        if (!Number.isFinite(as) || !Number.isFinite(hs) || as === hs) continue;
        const gameId = String(g.date || '') + '|' + String(g.id || '');
        if (seen.has(gameId)) continue;
        seen.add(gameId);
        if ((as > hs ? away : home) === key) wins++;
      }
      return wins;
    }
    function postseasonNpbSeriesWinner(a,b,stage,target,advantageA=0) {
      if (!a || !b) return '';
      const aw = advantageA + postseasonNpbWins(a,stage,b), bw = postseasonNpbWins(b,stage,a);
      return aw >= target ? a : bw >= target ? b : '';
    }
    function postseasonNpbScheduleRefresh() {
      if (postseasonNpbRefreshTimer) clearTimeout(postseasonNpbRefreshTimer);
      if (currentPage !== 'postseason' || leagueHubLeague !== 'npb') return;
      postseasonNpbRefreshTimer = setTimeout(() => {
        postseasonNpbRefreshTimer = null;
        if (currentPage === 'postseason' && leagueHubLeague === 'npb' && document.visibilityState !== 'hidden')
          void refreshPostseasonNpbResults(true);
      }, POSTSEASON_NPB_RESULT_TTL);
    }
    async function refreshPostseasonNpbResults(force=false) {
      if (postseasonNpbResultsPromise) return postseasonNpbResultsPromise;
      if (!force && Date.now()-postseasonNpbResultsAt < POSTSEASON_NPB_RESULT_TTL) return postseasonNpbGames;
      postseasonNpbResultsAt = Date.now();
      postseasonNpbResultsPromise = fetch('https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-postseason-results?year='+encodeURIComponent(CURRENT_YEAR))
        .then(async response => {
          const data = await response.json();
          if (!response.ok || data?.ok !== true || !Array.isArray(data.games)) throw Error('日職季後賽結果暫時無法讀取');
          postseasonNpbGames = data.games;
          return postseasonNpbGames;
        }).catch(error => {
          console.warn('NPB postseason result cache:',error);
          return postseasonNpbGames;
        }).finally(() => {
          postseasonNpbResultsPromise=null;
          if (currentPage === 'postseason' && leagueHubLeague === 'npb') {
            renderPostseasonPage();
            postseasonNpbScheduleRefresh();
          }
        });
      return postseasonNpbResultsPromise;
    }

    function postseasonNpbBracketContent() {
      const npb = standingsOfficialCache?.npb || {};
      const central = postseasonSectionRows(npb.central,3);
      const pacific = postseasonSectionRows(npb.pacific,3);
      const leagueBlock = (label, rows, isPacific = false) => {
        const first=postseasonTeamName(rows[0]),second=postseasonTeamName(rows[1]),third=postseasonTeamName(rows[2]);
        const firstWinner=postseasonNpbSeriesWinner(second,third,'climax_first',2);
        const advance=isPacific?2:1,finalOpponent=firstWinner||'第一階段勝者';
        const firstScore=[postseasonNpbWins(second,'climax_first',third),postseasonNpbWins(third,'climax_first',second)];
        const finalScore=[advance+(firstWinner?postseasonNpbWins(first,'climax_final',firstWinner):0),
          firstWinner?postseasonNpbWins(firstWinner,'climax_final',first):0];
        return '<div class="postseason-league-bracket">' +
          '<div class="postseason-bracket-league-label">' + postseasonEscape(label) + '</div>' +
          '<div class="postseason-bracket">' +
          '<section class="postseason-round"><div class="postseason-round-title">FIRST STAGE</div><div class="postseason-round-series">' +
          postseasonMatchCard('第一階段',second,third,firstWinner?firstWinner+' 晉級 Final Stage':'勝者晉級 Final Stage',
            {format:'3戰2勝制',seriesScore:firstScore}) +
          '</div></section>' +
          '<section class="postseason-round"><div class="postseason-round-title">FINAL STAGE</div><div class="postseason-round-series">' +
          postseasonMatchCard('決勝階段',first,finalOpponent,first+' 帶 '+advance+' 勝優勢',
            {seriesScore:finalScore,format:isPacific&&String(CURRENT_YEAR)==='2026'?'7戰5勝制':'6戰4勝制'}) +
          '</div></section></div></div>';
      };
      const leagueChampion=(rows,isPacific)=>{
        const first=postseasonTeamName(rows[0]),second=postseasonTeamName(rows[1]),third=postseasonTeamName(rows[2]);
        const firstWinner=postseasonNpbSeriesWinner(second,third,'climax_first',2);
        return firstWinner?postseasonNpbSeriesWinner(first,firstWinner,'climax_final',isPacific?5:4,isPacific?2:1):'';
      };
      const centralChampion=leagueChampion(central,false),pacificChampion=leagueChampion(pacific,true);
      const japanScore=centralChampion&&pacificChampion
        ? [postseasonNpbWins(centralChampion,'japan_series',pacificChampion),postseasonNpbWins(pacificChampion,'japan_series',centralChampion)]
        : null;
      return '<div class="postseason-bracket-wrap">' +
        leagueBlock('CENTRAL LEAGUE',central) +
        '<div class="postseason-world-series"><section class="postseason-round"><div class="postseason-round-title">JAPAN SERIES</div><div class="postseason-round-series">' +
        postseasonMatchCard('日本大賽',centralChampion||'央聯 CS 勝者',pacificChampion||'洋聯 CS 勝者','',{format:'7戰4勝制',...(japanScore?{seriesScore:japanScore}:{})}) +
        '</div></section></div>' +
        leagueBlock('PACIFIC LEAGUE',pacific) +
        '</div>';
    }

    function postseasonKboBracketContent() {
      const rows = postseasonSectionRows(standingsOfficialCache?.kbo?.regular,5);
      const t = index => postseasonTeamName(rows[index]);
      return '<div class="postseason-bracket-wrap">' +
        '<div class="postseason-league-bracket"><div class="postseason-bracket-league-label">KBO POSTSEASON</div>' +
        '<div class="postseason-bracket">' +
          '<section class="postseason-round"><div class="postseason-round-title">WILD CARD</div><div class="postseason-round-series">' +
            postseasonMatchCard('外卡決定戰', t(3), t(4), '4 號種子帶 1 勝優勢', {seriesScore:[1,0],format:'最多2戰，4號種子1勝或1和即晉級'}) +
          '</div></section>' +
          '<section class="postseason-round"><div class="postseason-round-title">SEMI-PLAYOFF</div><div class="postseason-round-series">' +
            postseasonMatchCard('準季後賽', t(2), '外卡勝者', '', {format:'5戰3勝制'}) +
          '</div></section>' +
          '<section class="postseason-round"><div class="postseason-round-title">PLAYOFF</div><div class="postseason-round-series">' +
            postseasonMatchCard('季後賽', t(1), '準季後賽勝者', '', {format:'5戰3勝制'}) +
          '</div></section>' +
        '</div></div>' +
        '<div class="postseason-world-series"><section class="postseason-round"><div class="postseason-round-title">KOREAN SERIES</div><div class="postseason-round-series">' +
          postseasonMatchCard('韓國大賽', t(0), '季後賽勝者', '', {format:'7戰4勝制'}) +
        '</div></section></div>' +
      '</div>';
    }

    let postseasonCpblResults = [];
    let postseasonCpblOfficialWins = null;
    let postseasonCpblFetchError = '';
    let postseasonCpblResultsAt = 0;
    let postseasonCpblResultsPromise = null;
    const POSTSEASON_CPBL_RESULT_TTL = 90 * 1000;
    async function refreshPostseasonCpblResults(force = false) {
      if (postseasonCpblResultsPromise) return postseasonCpblResultsPromise;
      if (!force && Date.now() - postseasonCpblResultsAt < POSTSEASON_CPBL_RESULT_TTL) return postseasonCpblResults;
      if (String(CURRENT_YEAR) !== '2026') return postseasonCpblResults;
      // Read finalized playoff games from one shared backend database query.
      // Do not fetch each day's schedule or request game details per viewer.
      postseasonCpblResultsPromise = (async () => {
        const response = await fetch('https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-playoff-series-results', {
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({appKey:CPBL_APP_KEY,action:'cpbl-playoff-series',year:String(CURRENT_YEAR)})
        });
        const data = await response.json();
        if (!response.ok || data?.ok !== true) throw new Error(data?.error || '季後賽系列戰績讀取失敗');
        const next = Array.isArray(data.games) ? data.games : [];
        postseasonCpblResults = next;
        postseasonCpblOfficialWins = data.wins && typeof data.wins === 'object' ? data.wins : null;
        postseasonCpblFetchError = '';
        postseasonCpblResultsAt = Date.now();
        if (currentPage === 'postseason' && leagueHubLeague === 'cpbl') { renderPostseasonPage(); updateCpblSeriesScoreDom(); }
        return next;
      })().catch(error => {
        postseasonCpblFetchError = String(error?.message || error);
        console.warn('CPBL playoff series results', error);
        if (currentPage === 'postseason' && leagueHubLeague === 'cpbl') {
          updateCpblSeriesScoreDom();
        }
        return postseasonCpblResults;
      }).finally(() => { postseasonCpblResultsPromise = null; });
      return postseasonCpblResultsPromise;
    }
    window.addEventListener('cpbl-live-day-update', () => {
      if (currentPage !== 'postseason' || leagueHubLeague !== 'cpbl') return;
      if (Date.now() - postseasonCpblResultsAt < POSTSEASON_CPBL_RESULT_TTL) return;
      void refreshPostseasonCpblResults();
    });
    function updateCpblSeriesScoreDom() {
      const root = els.postseasonPageContent;
      if (!root || currentPage !== 'postseason' || leagueHubLeague !== 'cpbl') return;
      const rounds = [...root.querySelectorAll('.postseason-round')];
      const round = rounds.find(node => node.querySelector('.postseason-round-title')?.textContent?.trim() === 'PLAYOFF SERIES');
      if (!round) return;
      const teams = [...round.querySelectorAll('.postseason-bracket-team')];
      if (teams.length !== 2) return;
      const a = teams[0].querySelector('strong')?.textContent || '';
      const b = teams[1].querySelector('strong')?.textContent || '';
      const score = postseasonCpblSeriesScore(a,b);
      if (postseasonCpblFetchError) round.setAttribute('data-series-fetch-error',postseasonCpblFetchError);
      else round.removeAttribute('data-series-fetch-error');
      teams[0].querySelector('b')?.replaceChildren(document.createTextNode(String(score[0])));
      teams[1].querySelector('b')?.replaceChildren(document.createTextNode(String(score[1])));
    }
    function postseasonCpblSeriesScore(a,b) {
      const normalize = value => String(value || '').replace(/7-ELEVEN|7－ELEVEN|7-11|\\s/g, '').trim();
      const fromApi = postseasonCpblOfficialWins;
      if (fromApi) {
        const countFor = name => Object.entries(fromApi).reduce((sum,[team,count]) => sum + (normalize(team) === normalize(name) ? (Number(count) || 0) : 0),0);
        return [1 + countFor(a), countFor(b)];
      }
      // While loading, do not mistake the pre-series advantage for a current score.
      const merged = new Map();
      if (typeof homeDailyGamesCache !== 'undefined' && homeDailyGamesCache?.values) {
        for (const entry of homeDailyGamesCache.values()) {
          for (const game of (Array.isArray(entry?.games) ? entry.games : [])) {
            if (String(game?.kindCode || '').toUpperCase() === 'E' && game.status === 'final')
              merged.set(String(game.date || '') + '|' + String(game.id || ''), game);
          }
        }
      }
      for (const game of postseasonCpblResults) {
        if (game.status === 'final') merged.set(String(game.date || '') + '|' + String(game.id || ''),game);
      }
      const score=[1,0];
      for(const game of merged.values()) {
        const away=normalize(game.away),home=normalize(game.home);
        if(!((away===normalize(a)&&home===normalize(b))||(away===normalize(b)&&home===normalize(a))))continue;
        const aw=Number(game.awayScore),hw=Number(game.homeScore);
        if(!Number.isFinite(aw)||!Number.isFinite(hw)||aw===hw)continue;
        if(aw>hw)score[away===normalize(a)?0:1]++;
        else score[home===normalize(a)?0:1]++;
      }
      return score;
    }

    function postseasonCpblBracketContent() {
      const cpbl = standingsOfficialCache?.cpbl || {};
      const first = postseasonSectionRows(cpbl.first,1)[0] || null;
      const second = postseasonSectionRows(cpbl.second,1)[0] || null;
      const annual = postseasonSectionRows(cpbl.annual,6);
      const firstName = postseasonTeamName(first);
      const secondName = postseasonTeamName(second);
      const sameChampion = firstName && secondName && firstName === secondName;
      let playoffA = '';
      let playoffB = '';
      let direct = '';

      if (sameChampion) {
        direct = postseasonTeamName(annual[0]);
        playoffA = postseasonTeamName(annual[1]);
        playoffB = postseasonTeamName(annual[2]);
      } else {
        const annualIndex = new Map(annual.map((row,index) => [postseasonTeamName(row), index]));
        const fi = annualIndex.has(firstName) ? annualIndex.get(firstName) : 99;
        const si = annualIndex.has(secondName) ? annualIndex.get(secondName) : 99;
        direct = fi < si ? firstName : secondName;
        playoffA = fi < si ? secondName : firstName;
        const outsider = annual.find(row => {
          const name = postseasonTeamName(row);
          return name !== firstName && name !== secondName;
        });
        playoffB = postseasonTeamName(outsider);
      }

      return '<div class="postseason-bracket-wrap">' +
        '<div class="postseason-league-bracket"><div class="postseason-bracket-league-label">CPBL POSTSEASON</div>' +
        '<div class="postseason-bracket">' +
          '<section class="postseason-round"><div class="postseason-round-title">PLAYOFF SERIES</div><div class="postseason-round-series">' +
            postseasonMatchCard('季後挑戰賽', playoffA, playoffB,
              playoffA && playoffB ? postseasonEscape(playoffA) + '帶 1 勝優勢' : '待定',
              { seriesScore: postseasonCpblSeriesScore(playoffA, playoffB), format: '4戰3勝制｜' + playoffA + '先帶1勝' + (postseasonCpblFetchError ? '｜戰績更新失敗' : (!postseasonCpblOfficialWins && !postseasonCpblResults.length ? '｜戰績同步中' : '')) }) +
          '</div></section>' +
          '<section class="postseason-round"><div class="postseason-round-title">TAIWAN SERIES</div><div class="postseason-round-series">' +
            postseasonMatchCard('台灣大賽', direct, '季後挑戰賽勝者', '', {format:'7戰4勝制'}) +
          '</div></section>' +
        '</div></div></div>';
    }

    function postseasonMlbQualificationContent() {
      const mlb = standingsOfficialCache?.mlb || {};
      const block = (prefix, title) => {
        const keys = prefix === 'al' ? ['alEast','alCentral','alWest'] : ['nlEast','nlCentral','nlWest'];
        const divisions = keys.map(key => postseasonSectionRows(mlb[key],99));
        const leaders = divisions.map(rows => rows[0]).filter(Boolean);
        const leaderNames = new Set(leaders.map(row => String(row?.team || row?.sourceTeam || '').trim()));
        const wildcards = divisions.flat()
          .filter(row => !leaderNames.has(String(row?.team || row?.sourceTeam || '').trim()))
          .sort((a,b) => {
            const ap = Number(a?.pct), bp = Number(b?.pct);
            if (Number.isFinite(ap) && Number.isFinite(bp) && ap !== bp) return bp - ap;
            return (Number(b?.wins) || 0) - (Number(a?.wins) || 0);
          }).slice(0,3);
        const rows = [...leaders, ...wildcards];
        return postseasonCard(title, '3 個分區冠軍位置 + 3 個外卡資格', rows, {
          labels:['分區冠軍','分區冠軍','分區冠軍','WC1','WC2','WC3']
        });
      };
      return '<div class="postseason-grid">' + block('al','美國聯盟') + block('nl','國家聯盟') + '</div>';
    }


    function postseasonMlbTeamZh(name) {
      const raw = String(name || '').trim();
      return typeof mlbStandingsTeamZh === 'function' ? mlbStandingsTeamZh(raw) : raw;
    }

    function postseasonMlbSeriesTeams(series) {
      const names = [];
      (series?.games || []).forEach(game => {
        [game?.away, game?.home].forEach(name => {
          const value = String(name || '').trim();
          if (value && !names.includes(value)) names.push(value);
        });
      });
      [series?.away, series?.home].forEach(name => {
        const value = String(name || '').trim();
        if (value && !names.includes(value)) names.push(value);
      });
      return names.slice(0, 2);
    }

    function postseasonMlbSeriesWins(series, team) {
      return (series?.games || []).reduce((sum, game) => {
        if (String(game?.status || '') !== 'final') return sum;
        const away = String(game?.away || '');
        const home = String(game?.home || '');
        const awayScore = Number(game?.awayScore);
        const homeScore = Number(game?.homeScore);
        if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore) || awayScore === homeScore) return sum;
        const winner = awayScore > homeScore ? away : home;
        return sum + (winner === team ? 1 : 0);
      }, 0);
    }

    function postseasonMlbSeriesWinner(series) {
      const teams = postseasonMlbSeriesTeams(series);
      const target = series?.round === 'wildcard' ? 2 : (series?.round === 'division' ? 3 : 4);
      const wins = teams.map(team => postseasonMlbSeriesWins(series, team));
      const index = wins.findIndex(value => value >= target);
      if (index >= 0) return teams[index];
      return String(series?.winner || '').trim();
    }

    function postseasonMlbSeriesStatus(series) {
      const winner = postseasonMlbSeriesWinner(series);
      if (winner) return postseasonMlbTeamZh(winner) + ' 晉級';
      const teams = postseasonMlbSeriesTeams(series);
      if (teams.length < 2) return String(series?.statusText || '待定');
      const a = postseasonMlbSeriesWins(series, teams[0]);
      const b = postseasonMlbSeriesWins(series, teams[1]);
      if (a === 0 && b === 0) return '尚未開打';
      if (a === b) return '系列賽 ' + a + '-' + b;
      const leader = a > b ? teams[0] : teams[1];
      return postseasonMlbTeamZh(leader) + ' ' + Math.max(a,b) + '-' + Math.min(a,b) + ' 領先';
    }

    function postseasonMlbSeriesCard(series) {
      const teams = postseasonMlbSeriesTeams(series);
      const winner = postseasonMlbSeriesWinner(series);
      const rows = teams.length ? teams.map(team => {
        const wins = postseasonMlbSeriesWins(series, team);
        const isWinner = winner && (team === winner || postseasonMlbTeamZh(team) === winner);
        return '<div class="postseason-bracket-team ' + (isWinner ? 'is-winner' : '') + '">' +
          '<strong>' + postseasonEscape(postseasonMlbTeamZh(team)) + '</strong>' +
          '<b>' + wins + '</b></div>';
      }).join('') : '<div class="postseason-bracket-team is-tbd"><strong>待定</strong><b>—</b></div>';

      const completedGames = (series?.games || []).filter(game => String(game?.status || '') === 'final').length;
      const nextGame = (series?.games || []).find(game => ['scheduled','live','suspended'].includes(String(game?.status || '')));
      const detail = nextGame
        ? postseasonEscape(nextGame?.time || '') + ' ' + (String(nextGame?.status || '') === 'live' ? '進行中' : '下一戰')
        : (completedGames ? postseasonMlbSeriesStatus(series) : '尚未開打');

      const format = ({wildcard:'3戰2勝制',division:'5戰3勝制',league:'7戰4勝制',world:'7戰4勝制'})[String(series?.round || '')] || '';
      return '<div class="postseason-series-card ' + (winner ? 'is-complete' : '') + '">' +
        '<div class="postseason-series-meta"><span>' + postseasonEscape(series?.description || series?.roundLabel || '') + '</span>' +
        '<em>' + postseasonEscape(postseasonMlbSeriesStatus(series)) + '</em></div>' +
        '<div class="postseason-bracket-teams">' + rows + '</div>' +
        '<div class="postseason-series-foot" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>' + detail + '</span><span style="margin-left:auto">' + postseasonEscape(format) + '</span></div></div>';
    }

    function postseasonMlbRound(title, code, league = '') {
      const series = (postseasonMlbBracket?.series || []).filter(item =>
        item?.round === code && (!league || item?.league === league)
      );
      const cards = series.length
        ? series.map(postseasonMlbSeriesCard).join('')
        : '<div class="postseason-series-card is-placeholder"><div class="postseason-bracket-team is-tbd"><strong>待定</strong><b>—</b></div></div>';
      return '<section class="postseason-round" data-round="' + code + '">' +
        '<div class="postseason-round-title">' + postseasonEscape(title) + '</div>' +
        '<div class="postseason-round-series">' + cards + '</div></section>';
    }

    function postseasonMlbContent() {
      if (postseasonMlbBracketError && !postseasonMlbBracket) {
        return '<div class="postseason-loading">' + postseasonEscape(postseasonMlbBracketError) + '</div>';
      }
      if (!postseasonMlbBracket) {
        return '<div class="postseason-loading">正在讀取 MLB 季後賽對戰圖…</div>';
      }

      const wcAl = postseasonMlbRound('美聯外卡','wildcard','AL');
      const dsAl = postseasonMlbRound('美聯分區賽','division','AL');
      const lcsAl = postseasonMlbRound('美聯冠軍賽','league','AL');
      const wcNl = postseasonMlbRound('國聯外卡','wildcard','NL');
      const dsNl = postseasonMlbRound('國聯分區賽','division','NL');
      const lcsNl = postseasonMlbRound('國聯冠軍賽','league','NL');
      const ws = postseasonMlbRound('世界大賽','world','');

      return '<div class="postseason-bracket-wrap">' +
        '<div class="postseason-league-bracket"><div class="postseason-bracket-league-label">AMERICAN LEAGUE</div><div class="postseason-bracket">' + wcAl + dsAl + lcsAl + '</div></div>' +
        '<div class="postseason-world-series">' + ws + '</div>' +
        '<div class="postseason-league-bracket"><div class="postseason-bracket-league-label">NATIONAL LEAGUE</div><div class="postseason-bracket">' + wcNl + dsNl + lcsNl + '</div></div>' +
        '</div>';
    }

    async function loadPostseasonMlbBracket({ force = false } = {}) {
      const now = Date.now();
      if (!force && postseasonMlbBracket && now - postseasonMlbBracketAt < postseasonMlbBrowserCacheMs(postseasonMlbBracket)) return postseasonMlbBracket;
      if (postseasonMlbBracketPromise) return postseasonMlbBracketPromise;

      try {
        const saved = JSON.parse(localStorage.getItem('postseasonMlbBracketCache') || 'null');
        if (!force && saved?.data && Number(saved?.at) > 0 && now - Number(saved.at) < postseasonMlbBrowserCacheMs(saved.data)) {
          postseasonMlbBracket = saved.data;
          postseasonMlbBracketAt = Number(saved.at);
          postseasonMlbBracketError = '';
          postseasonMlbStopRefreshTimer();
          if (currentPage === 'postseason' && leagueHubLeague === 'mlb') setTimeout(renderPostseasonPage, 0);
          return postseasonMlbBracket;
        }
      } catch {}

      postseasonMlbBracketError = '';
      postseasonMlbBracketPromise = fetch(LEAGUE_POSTSEASON_BRACKET_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({ appKey:CPBL_APP_KEY, year:CURRENT_YEAR })
      }).then(async response => {
        const text = await response.text();
        let data = {};
        try { data = JSON.parse(text || '{}'); } catch {}
        if (!response.ok || data?.ok !== true) throw new Error(data?.error || ('季後賽對戰圖讀取失敗（' + response.status + '）'));
        postseasonMlbBracket = data;
        postseasonMlbBracketAt = Date.now();
        postseasonMlbStopRefreshTimer();
        postseasonMlbBracketError = '';
        try { localStorage.setItem('postseasonMlbBracketCache', JSON.stringify({ at:postseasonMlbBracketAt, data })); } catch {}
        return data;
      }).catch(error => {
        postseasonMlbBracketError = error?.message || '季後賽對戰圖讀取失敗';
        return null;
      }).finally(() => {
        postseasonMlbBracketPromise = null;
        if (currentPage === 'postseason' && leagueHubLeague === 'mlb') renderPostseasonPage();
      });
      return postseasonMlbBracketPromise;
    }

    function renderPostseasonPage() {
      if (!els.postseasonPageContent) return;

      const active = postseasonSeasonActive();
      if (leagueHubLeague === 'mlb' && active) postseasonMlbEnsureRefreshTimer();
      if (leagueHubLeague === 'npb' && active && !postseasonNpbResultsPromise && Date.now()-postseasonNpbResultsAt >= POSTSEASON_NPB_RESULT_TTL) void refreshPostseasonNpbResults();
      if (leagueHubLeague === 'cpbl' && active && !postseasonCpblResultsPromise && Date.now() - postseasonCpblResultsAt >= POSTSEASON_CPBL_RESULT_TTL) void refreshPostseasonCpblResults();
      else postseasonMlbStopRefreshTimer();

      if (!active && !postseasonHasSelectedLeagueData()) {
        const key = String(leagueHubLeague || 'cpbl');
        const recentAttempt = Date.now() - Number(postseasonLastAttemptAt.get(key) || 0) < 30000;
        const error = String(standingsOfficialError || '').trim();
        els.postseasonPageContent.innerHTML = `
          <div class="postseason-overview">
            <div class="postseason-intro">
              <div><span>POSTSEASON</span><strong>${postseasonEscape(postseasonLeagueLabel())}｜季後賽專區</strong></div>
              <p>例行賽資格狀態 · 共用戰績快取</p>
            </div>
            <div class="postseason-loading">${postseasonLoadPromise ? '正在讀取現有戰績快取…' : (recentAttempt && error ? postseasonEscape(error) : '準備現有戰績資料…')}</div>
          </div>`;
        if (!postseasonLoadPromise && !recentAttempt) void ensurePostseasonData();
        return;
      }

      if (leagueHubLeague === 'mlb' && active && !postseasonMlbBracket) {
        els.postseasonPageContent.innerHTML = '<div class="postseason-overview">' +
          '<div class="postseason-intro"><div><span>POSTSEASON</span><strong>美國大聯盟｜季後賽對戰圖</strong></div><p>實際系列賽結果 · 進行中自動更新</p></div>' +
          postseasonMlbContent() + '</div>';
        if (!postseasonMlbBracketPromise) void loadPostseasonMlbBracket();
        return;
      }

      if (!postseasonHasSelectedLeagueData() && leagueHubLeague !== 'mlb') {
        if (!postseasonLoadPromise) void ensurePostseasonData();
      }

      const fetchedAt = standingsOfficialCache?.fetchedAt ? new Date(standingsOfficialCache.fetchedAt) : null;
      const fetchedText = fetchedAt && !Number.isNaN(fetchedAt.getTime())
        ? fetchedAt.toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
        : '沿用現有快取';

      let body = '';
      if (!active) {
        body = leagueHubLeague === 'cpbl' ? postseasonCpblContent()
          : leagueHubLeague === 'npb' ? postseasonNpbContent()
          : leagueHubLeague === 'kbo' ? postseasonKboContent()
          : postseasonMlbQualificationContent();
      } else {
        body = leagueHubLeague === 'cpbl' ? postseasonCpblBracketContent()
          : leagueHubLeague === 'npb' ? postseasonNpbBracketContent()
          : leagueHubLeague === 'kbo' ? postseasonKboBracketContent()
          : postseasonMlbContent();
      }

      els.postseasonPageContent.innerHTML = `
        <div class="postseason-overview">
          <div class="postseason-intro">
            <div><span>POSTSEASON</span><strong>${postseasonEscape(postseasonLeagueLabel())}｜${active ? '季後賽對戰表' : '季後賽資格'}</strong></div>
            <p>${active ? '已進入季後賽階段' : ('例行賽進行中 · ' + postseasonEscape(fetchedText))}</p>
          </div>
          ${body}
        </div>`;
      if (leagueHubLeague === 'cpbl' && active) updateCpblSeriesScoreDom();
    }
