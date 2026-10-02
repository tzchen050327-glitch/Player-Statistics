    let postseasonLoadPromise = null;
    const postseasonLastAttemptAt = new Map();
    let postseasonMlbBracket = null;
    let postseasonMlbBracketAt = 0;
    let postseasonMlbBracketPromise = null;
    let postseasonMlbBracketError = '';
    const POSTSEASON_MLB_BROWSER_CACHE_MS = 5 * 60 * 1000;

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

      return '<div class="postseason-series-card ' + (winner ? 'is-complete' : '') + '">' +
        '<div class="postseason-series-meta"><span>' + postseasonEscape(series?.description || series?.roundLabel || '') + '</span>' +
        '<em>' + postseasonEscape(postseasonMlbSeriesStatus(series)) + '</em></div>' +
        '<div class="postseason-bracket-teams">' + rows + '</div>' +
        '<div class="postseason-series-foot">' + detail + '</div></div>';
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
      if (!force && postseasonMlbBracket && now - postseasonMlbBracketAt < POSTSEASON_MLB_BROWSER_CACHE_MS) return postseasonMlbBracket;
      if (postseasonMlbBracketPromise) return postseasonMlbBracketPromise;

      try {
        const saved = JSON.parse(localStorage.getItem('postseasonMlbBracketCache') || 'null');
        if (!force && saved?.data && Number(saved?.at) > 0 && now - Number(saved.at) < POSTSEASON_MLB_BROWSER_CACHE_MS) {
          postseasonMlbBracket = saved.data;
          postseasonMlbBracketAt = Number(saved.at);
          postseasonMlbBracketError = '';
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

      if (leagueHubLeague === 'mlb' && !postseasonMlbBracket) {
        els.postseasonPageContent.innerHTML = '<div class="postseason-overview">' +
          '<div class="postseason-intro"><div><span>POSTSEASON</span><strong>美國大聯盟｜季後賽對戰圖</strong></div><p>實際系列賽結果 · 無背景輪詢</p></div>' +
          postseasonMlbContent() + '</div>';
        if (!postseasonMlbBracketPromise) void loadPostseasonMlbBracket();
        return;
      }

      if (!postseasonHasSelectedLeagueData()) {
        const key = String(leagueHubLeague || 'cpbl');
        const recentAttempt = Date.now() - Number(postseasonLastAttemptAt.get(key) || 0) < 30000;
        const error = String(standingsOfficialError || '').trim();
        els.postseasonPageContent.innerHTML = `
          <div class="postseason-overview">
            <div class="postseason-intro">
              <div><span>POSTSEASON</span><strong>${postseasonEscape(postseasonLeagueLabel())}｜季後賽專區</strong></div>
              <p>共用戰績快取 · 不新增背景輪詢</p>
            </div>
            <div class="postseason-loading">${postseasonLoadPromise ? '正在讀取現有戰績快取…' : (recentAttempt && error ? postseasonEscape(error) : '準備現有戰績資料…')}</div>
          </div>`;
        if (!postseasonLoadPromise && !recentAttempt) void ensurePostseasonData();
        return;
      }

      const fetchedAt = standingsOfficialCache?.fetchedAt ? new Date(standingsOfficialCache.fetchedAt) : null;
      const fetchedText = fetchedAt && !Number.isNaN(fetchedAt.getTime())
        ? fetchedAt.toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
        : '沿用現有快取';
      const body = leagueHubLeague === 'cpbl' ? postseasonCpblContent()
        : leagueHubLeague === 'npb' ? postseasonNpbContent()
        : leagueHubLeague === 'kbo' ? postseasonKboContent()
        : postseasonMlbContent();

      els.postseasonPageContent.innerHTML = `
        <div class="postseason-overview">
          <div class="postseason-intro">
            <div><span>POSTSEASON</span><strong>${postseasonEscape(postseasonLeagueLabel())}｜季後賽專區</strong></div>
            <p>${leagueHubLeague === 'mlb' ? '資料：MLB 官方季後賽系列賽快取' : `資料：戰績排名共用快取 · ${postseasonEscape(fetchedText)}`}</p>
          </div>
          ${body}
        </div>`;
    }
