(() => {
  const API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/postseason-history';
  const APP_KEY = 'TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
  const cache = new Map();
  let activeKey = '';
  let selectedCompetition = '';
  let renderSeq = 0;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const scoreCell = value => value === null || value === undefined || value === '' ? '—' : String(value);
  const leagueForPlayer = player => {
    if (!player) return '';
    const scope = String(player.scope || '').trim();
    if (scope !== 'overseas' && scope !== 'international') return 'CPBL';
    if (scope === 'overseas' && String(player.externalProvider || '').toUpperCase() === 'NPB') return 'NPB';
    return '';
  };
  const playerIdFor = (player, league) => league === 'CPBL'
    ? String(player?.cpblAcnt || '').trim()
    : String(player?.externalPlayerId || '').trim();
  const playerNameFor = player => String(player?.externalOfficialName || player?.name || '').trim();
  const getContext = () => typeof window.__getPlayerContext === 'function' ? window.__getPlayerContext() : null;
  const postseasonTab = () => document.querySelector('.tab-btn[data-tab="postseason"]');
  const host = () => document.getElementById('contentPanel');

  function setMode(active) {
    document.body.classList.toggle('postseason-history-mode', Boolean(active));
  }

  function showAvailability(ctx) {
    const tab = postseasonTab();
    if (!tab) return '';
    const league = leagueForPlayer(ctx?.player);
    const supported = league === 'CPBL' || league === 'NPB';
    tab.classList.toggle('hidden', !supported);
    if (!supported && ctx?.selectedTab === 'postseason') {
      document.querySelector('.tab-btn[data-tab="base"]')?.click();
      setMode(false);
    }
    return supported ? league : '';
  }

  function statGrid(title, stats, type) {
    if (!stats) return '';
    const cells = type === 'pitching'
      ? [
          ['G', stats.games], ['IP', stats.ip], ['H', stats.hits], ['HR', stats.homeRuns],
          ['BB', stats.walks], ['HBP', stats.hbp], ['SO', stats.strikeouts], ['R', stats.runs],
          ['ER', stats.earnedRuns], ['ERA', stats.era], ['PITCH', stats.pitches]
        ]
      : [
          ['G', stats.games], ['PA', stats.pa], ['AB', stats.ab], ['H', stats.hits],
          ['AVG', stats.avg], ['HR', stats.homeRuns], ['RBI', stats.rbi], ['R', stats.runs],
          ['BB', stats.walks], ['HBP', stats.hbp], ['SO', stats.strikeouts]
        ];
    return `<section class="postseason-summary-card"><div class="postseason-summary-title">${esc(title)}</div><div class="postseason-stat-grid">${cells.map(([k,v])=>`<div class="postseason-stat"><span>${esc(k)}</span><strong>${esc(v ?? '—')}</strong></div>`).join('')}</div></section>`;
  }

  function gamePlayerLine(game) {
    const parts = [];
    if (game?.batting) {
      const b = game.batting;
      parts.push(`打擊 ${num(b.hits)}-${num(b.ab)}${num(b.homeRuns) ? `｜${num(b.homeRuns)} HR` : ''}${num(b.rbi) ? `｜${num(b.rbi)} RBI` : ''}`);
    }
    if (game?.pitching) {
      const p = game.pitching;
      const ip = `${Math.floor(num(p.outs)/3)}.${num(p.outs)%3}`;
      parts.push(`投球 ${ip} 局｜${num(p.strikeouts)} K｜${num(p.earnedRuns)} ER`);
    }
    return parts.length ? parts.join('　') : '未出賽';
  }

  function relevantGames(comp) {
    const games = Array.isArray(comp?.games) ? comp.games : [];
    const appeared = games.filter(g => g?.batting || g?.pitching);
    if (!appeared.length) return games;
    const teams = new Set();
    for (const g of appeared) {
      if (g.away) teams.add(String(g.away));
      if (g.home) teams.add(String(g.home));
    }
    return games.filter(g => teams.has(String(g.away)) || teams.has(String(g.home)));
  }

  function renderCompetition(data, key) {
    const target = host();
    if (!target) return;
    const competitions = (Array.isArray(data?.competitions) ? data.competitions : []).filter(c => c?.playerAppeared);
    if (!competitions.length) {
      target.innerHTML = `<div class="postseason-empty"><strong>${esc(data?.year || '')} 沒有找到這位球員的季後賽出賽紀錄</strong><span>若球員當年沒有進季後賽名單，這裡就不會顯示系列成績。</span></div>`;
      return;
    }
    let comp = competitions.find(c => c.key === key) || competitions[0];
    selectedCompetition = comp.key;
    const games = relevantGames(comp);
    target.innerHTML = `
      <div class="postseason-history">
        <div class="postseason-head">
          <div><span class="postseason-kicker">POSTSEASON HISTORY</span><h2>${esc(data.year)} ${esc(comp.label)}</h2></div>
          <div class="postseason-source">${esc(data.league)} 官方資料</div>
        </div>
        <div class="postseason-stage-tabs">${competitions.map(c=>`<button type="button" class="press-btn postseason-stage-btn ${c.key===comp.key?'active':''}" data-postseason-stage="${esc(c.key)}">${esc(c.label)}</button>`).join('')}</div>
        <div class="postseason-summary-wrap">
          ${statGrid('系列打擊成績', comp.batting, 'batting')}
          ${statGrid('系列投球成績', comp.pitching, 'pitching')}
        </div>
        <section class="postseason-games-section">
          <div class="postseason-games-head"><strong>系列賽程</strong><span>${games.length} 場</span></div>
          <div class="postseason-game-list">${games.map((g,index)=>`
            <button type="button" class="postseason-game-row" data-postseason-game="${index}" ${g?.id?'':'disabled'}>
              <div class="postseason-game-date">${esc(String(g.date||'').replaceAll('-','/'))}</div>
              <div class="postseason-game-matchup"><span>${esc(g.away||'客隊')}</span><b>${esc(scoreCell(g.awayScore))} - ${esc(scoreCell(g.homeScore))}</b><span>${esc(g.home||'主隊')}</span></div>
              <div class="postseason-game-player">${esc(gamePlayerLine(g))}</div>
              <div class="postseason-game-open">查看單場 ›</div>
            </button>`).join('')}</div>
        </section>
      </div>`;

    target.querySelectorAll('[data-postseason-stage]').forEach(button => {
      button.addEventListener('click', () => renderCompetition(data, String(button.dataset.postseasonStage || '')));
    });
    target.querySelectorAll('[data-postseason-game]').forEach(button => {
      button.addEventListener('click', () => {
        const game = games[Number(button.dataset.postseasonGame)];
        if (!game?.id) return;
        window.dispatchEvent(new CustomEvent('postseason-open-game', { detail:{ game, league:data.league, date:game.date } }));
      });
    });
  }

  async function loadAndRender(ctx) {
    const league = showAvailability(ctx);
    const target = host();
    const year = Number(ctx?.selectedSeason);
    if (!league || !target || !Number.isInteger(year)) return;
    if (ctx.selectedTab !== 'postseason') {
      setMode(false);
      return;
    }
    setMode(true);
    const player = ctx.player;
    const playerId = playerIdFor(player, league);
    const playerName = playerNameFor(player);
    const key = `${league}|${year}|${playerId}|${playerName}`;
    activeKey = key;
    const seq = ++renderSeq;
    const canvasTitle = document.getElementById('canvasPreviewTitle');
    if (canvasTitle) canvasTitle.textContent = `${year} 季後賽歷史資料`;

    if (cache.has(key)) {
      renderCompetition(cache.get(key), selectedCompetition);
      return;
    }
    target.innerHTML = `<div class="postseason-loading"><span class="postseason-loader"></span><strong>正在讀取 ${esc(year)} 季後賽資料…</strong><span>第一次讀取歷史系列會稍久，之後會使用後端快取。</span></div>`;
    try {
      const response = await fetch(API_URL, {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({appKey:APP_KEY,action:'player-history',league,year,playerId,playerName})
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      if (seq !== renderSeq || activeKey !== key) return;
      cache.set(key,data);
      selectedCompetition = '';
      renderCompetition(data,'');
    } catch (error) {
      if (seq !== renderSeq || activeKey !== key) return;
      target.innerHTML = `<div class="postseason-empty"><strong>季後賽資料讀取失敗</strong><span>${esc(error instanceof Error ? error.message : String(error))}</span><button type="button" class="press-btn" id="retryPostseasonHistory">重新讀取</button></div>`;
      document.getElementById('retryPostseasonHistory')?.addEventListener('click', () => { cache.delete(key); loadAndRender(ctx); });
    }
  }

  function syncFromApp() {
    const ctx = getContext();
    if (!ctx?.player) {
      postseasonTab()?.classList.add('hidden');
      setMode(false);
      return;
    }
    showAvailability(ctx);
    if (ctx.selectedTab === 'postseason') void loadAndRender(ctx);
    else setMode(false);
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('.tab-btn[data-tab="postseason"]') : null;
    if (button) setTimeout(syncFromApp, 0);
  });
  document.getElementById('seasonSelect')?.addEventListener('change', () => setTimeout(syncFromApp,0));
  const observer = new MutationObserver(() => syncFromApp());
  const selected = document.getElementById('selectedPlayerText');
  const page = document.getElementById('playerPage');
  if (selected) observer.observe(selected,{childList:true,subtree:true,characterData:true});
  if (page) observer.observe(page,{attributes:true,attributeFilter:['class']});
  window.addEventListener('pageshow', syncFromApp);
  setTimeout(syncFromApp,0);
})();
