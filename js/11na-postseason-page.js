    let postseasonLoadPromise = null;
    const postseasonLastAttemptAt = new Map();

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

    function postseasonMlbLeague(prefix, title) {
      const mlb = standingsOfficialCache?.mlb || {};
      const keys = prefix === 'al' ? ['alEast','alCentral','alWest'] : ['nlEast','nlCentral','nlWest'];
      const sections = keys.map(key => postseasonSectionRows(mlb[key],99));
      const leaders = sections.map(rows => rows[0]).filter(Boolean);
      const leaderNames = new Set(leaders.map(row => String(row?.team || row?.sourceTeam || '').trim()));
      const wildcard = sections.flat()
        .filter(row => !leaderNames.has(String(row?.team || row?.sourceTeam || '').trim()))
        .sort((a,b) => {
          const ap = Number(a?.pct), bp = Number(b?.pct);
          if (Number.isFinite(ap) && Number.isFinite(bp) && ap !== bp) return bp - ap;
          return (Number(b?.wins) || 0) - (Number(a?.wins) || 0);
        })
        .slice(0,3);
      const rows = [...leaders, ...wildcard];
      return postseasonCard(title,'3 個分區領先 + 3 個外卡位置',rows,{labels:['分區1','分區1','分區1','WC1','WC2','WC3'].slice(0,rows.length)});
    }

    function postseasonMlbContent() {
      return `<div class="postseason-grid">
        ${postseasonMlbLeague('al','美國聯盟')}
        ${postseasonMlbLeague('nl','國家聯盟')}
      </div>`;
    }

    function renderPostseasonPage() {
      if (!els.postseasonPageContent) return;

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
            <p>資料：戰績排名共用快取 · ${postseasonEscape(fetchedText)}</p>
          </div>
          ${body}
        </div>`;
    }
