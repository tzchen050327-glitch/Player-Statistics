(() => {
  const API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/postseason-history';
  const APP_KEY = 'TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
  const YEAR_CACHE_TTL = 30 * 60 * 1000;
  const historyCache = new Map();
  const historyInflight = new Map();
  const candidateYearsCache = new Map();
  const validYearsCache = new Map();
  const selectedYearCache = new Map();
  const scanPromises = new Map();
  let activeKey = '';
  let selectedCompetition = '';
  let renderSeq = 0;
  let scanSeq = 0;
  let seasonMutationGuard = false;
  let syncTimer = 0;

  const HISTORY_DB_NAME = 'postseason-history-cache-v1';
  const HISTORY_STORE = 'history';
  const HISTORY_CACHE_SCHEMA = 2;
  const CURRENT_YEAR = new Date().getFullYear();
  let historyDbPromise = null;

  function openHistoryDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (historyDbPromise) return historyDbPromise;
    historyDbPromise = new Promise(resolve => {
      const req = indexedDB.open(HISTORY_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath:'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return historyDbPromise;
  }

  async function readPersistentHistory(key, year) {
    try {
      const db = await openHistoryDb();
      if (!db) return null;
      const row = await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readonly');
        const req = tx.objectStore(HISTORY_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (!row || row.schema !== HISTORY_CACHE_SCHEMA || !row.data) return null;
      // Finished seasons are immutable for this UI. Current season stays refreshable.
      if (Number(year) < CURRENT_YEAR) return row.data;
      if (Date.now() - Number(row.at || 0) <= 10 * 60 * 1000) return row.data;
      return null;
    } catch {
      return null;
    }
  }

  async function writePersistentHistory(key, year, data) {
    try {
      const db = await openHistoryDb();
      if (!db) return;
      await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readwrite');
        tx.objectStore(HISTORY_STORE).put({ key, year:Number(year), at:Date.now(), schema:HISTORY_CACHE_SCHEMA, data });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {}
  }

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
  const seasonSelect = () => document.getElementById('seasonSelect');
  const seasonButtonText = () => document.getElementById('seasonSelectButtonText');

  function injectUiStyle() {
    if (document.getElementById('postseasonFiveTabsStyle')) return;
    const style = document.createElement('style');
    style.id = 'postseasonFiveTabsStyle';
    style.textContent = `
      .player-page-tabs.postseason-five-tabs{
        grid-template-columns:repeat(5,minmax(0,1fr)) !important;
      }
      .player-page-tabs.postseason-five-tabs .tab-btn{
        min-width:0;
      }
      @media(max-width:640px){
        .player-page-tabs.postseason-five-tabs{
          grid-template-columns:repeat(5,minmax(0,1fr)) !important;
          gap:4px;
        }
        .player-page-tabs.postseason-five-tabs .tab-btn{
          min-height:36px;
          padding:6px 3px;
          font-size:11px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setMode(active) {
    document.body.classList.toggle('postseason-history-mode', Boolean(active));
  }

  function tabOrder(supported) {
    return supported
      ? ['base','minor','postseason','today','photos','secondary']
      : ['base','minor','secondary','postseason','today','photos'];
  }

  function normalizePrimaryTabs(supported) {
    const tabsHost = document.querySelector('.player-page-tabs');
    if (!tabsHost) return;
    tabsHost.classList.toggle('postseason-five-tabs', supported);

    const today = tabsHost.querySelector('.tab-btn[data-tab="today"]');
    if (supported && today && today.textContent !== '今日資訊') today.textContent = '今日資訊';

    const desired = tabOrder(supported);
    const current = [...tabsHost.querySelectorAll(':scope > .tab-btn')].map(btn => String(btn.dataset.tab || ''));
    const desiredExisting = desired.filter(key => tabsHost.querySelector(`:scope > .tab-btn[data-tab="${key}"]`));
    if (current.join('|') !== desiredExisting.join('|')) {
      for (const key of desiredExisting) {
        const node = tabsHost.querySelector(`:scope > .tab-btn[data-tab="${key}"]`);
        if (node) tabsHost.appendChild(node);
      }
    }
  }

  function playerKey(ctx, league) {
    const player = ctx?.player;
    return `${league}|${playerIdFor(player, league)}|${playerNameFor(player)}`;
  }

  function showAvailability(ctx) {
    const tab = postseasonTab();
    if (!tab) return '';
    const league = leagueForPlayer(ctx?.player);
    const supported = league === 'CPBL' || league === 'NPB';
    tab.classList.toggle('hidden', !supported);
    normalizePrimaryTabs(supported);
    if (!supported && ctx?.selectedTab === 'postseason') {
      document.querySelector('.tab-btn[data-tab="base"]')?.click();
      setMode(false);
    }
    return supported ? league : '';
  }

  function readVisibleYears() {
    const select = seasonSelect();
    if (!select) return [];
    return [...select.options]
      .map(option => Number(option.value))
      .filter(year => Number.isInteger(year) && year >= 1990 && year <= 2100)
      .filter((year, index, all) => all.indexOf(year) === index)
      .sort((a,b) => b-a);
  }

  function rememberCandidateYears(ctx, league) {
    if (!ctx?.player || !league) return [];
    const key = playerKey(ctx, league);
    const visible = readVisibleYears();
    const major = Array.isArray(ctx?.careerYears?.A) ? ctx.careerYears.A : [];
    const minor = Array.isArray(ctx?.careerYears?.D) ? ctx.careerYears.D : [];
    const prior = candidateYearsCache.get(key) || [];
    const merged = [...new Set([...prior, ...major, ...minor, ...visible, Number(ctx.selectedSeason)])]
      .map(Number)
      .filter(year => Number.isInteger(year) && year >= 1990 && year <= 2100)
      .sort((a,b) => b-a);
    if (merged.length) candidateYearsCache.set(key, merged);
    return merged;
  }

  function scanStorageKey(key, candidates) {
    return `postseason-years-v2:${encodeURIComponent(key)}:${candidates.join(',')}`;
  }

  function readStoredYears(key, candidates) {
    try {
      const raw = localStorage.getItem(scanStorageKey(key, candidates));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || Date.now() - Number(data.at || 0) > YEAR_CACHE_TTL) return null;
      const years = Array.isArray(data.years) ? data.years.map(Number).filter(Number.isInteger) : [];
      return [...new Set(years)].sort((a,b) => b-a);
    } catch {
      return null;
    }
  }

  function writeStoredYears(key, candidates, years) {
    try {
      localStorage.setItem(scanStorageKey(key, candidates), JSON.stringify({ at:Date.now(), years }));
    } catch {}
  }

  function historyKey(ctx, league, year) {
    return `${league}|${year}|${playerIdFor(ctx?.player, league)}|${playerNameFor(ctx?.player)}`;
  }

  async function requestHistory(ctx, league, year) {
    const key = historyKey(ctx, league, year);
    if (historyCache.has(key)) return historyCache.get(key);
    if (historyInflight.has(key)) return historyInflight.get(key);

    const player = ctx.player;
    const request = (async () => {
      const stored = await readPersistentHistory(key, year);
      if (stored) {
        historyCache.set(key, stored);
        return stored;
      }

      const response = await fetch(API_URL, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          appKey:APP_KEY,
          action:'player-history',
          league,
          year,
          playerId:playerIdFor(player, league),
          playerName:playerNameFor(player)
        })
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      historyCache.set(key, data);
      void writePersistentHistory(key, year, data);
      return data;
    })().finally(() => historyInflight.delete(key));

    historyInflight.set(key, request);
    return request;
  }

  function playerAppeared(data) {
    return (Array.isArray(data?.competitions) ? data.competitions : []).some(comp =>
      Boolean(comp?.playerAppeared || comp?.batting || comp?.pitching ||
        (Array.isArray(comp?.games) && comp.games.some(game => game?.batting || game?.pitching)))
    );
  }

  function yearOptionsMatch(years) {
    const current = readVisibleYears();
    return current.length === years.length && current.every((year,index) => year === years[index]);
  }

  function applyYearOptions(ctx, league, years) {
    const select = seasonSelect();
    if (!select) return 0;
    const key = playerKey(ctx, league);
    const cleanYears = [...new Set((years || []).map(Number).filter(Number.isInteger))].sort((a,b)=>b-a);
    validYearsCache.set(key, cleanYears);

    if (!cleanYears.length) {
      seasonMutationGuard = true;
      select.innerHTML = '<option value="">無季後賽出賽</option>';
      select.value = '';
      select.disabled = true;
      seasonMutationGuard = false;
      if (seasonButtonText()) seasonButtonText().textContent = '無季後賽出賽';
      return 0;
    }

    const previous = Number(selectedYearCache.get(key));
    const appYear = Number(ctx.selectedSeason);
    const chosen = cleanYears.includes(previous)
      ? previous
      : (cleanYears.includes(appYear) ? appYear : cleanYears[0]);
    selectedYearCache.set(key, chosen);

    seasonMutationGuard = true;
    if (!yearOptionsMatch(cleanYears)) {
      select.innerHTML = cleanYears.map(year => `<option value="${year}">${year}</option>`).join('');
    }
    select.disabled = false;
    select.value = String(chosen);
    seasonMutationGuard = false;
    if (seasonButtonText()) seasonButtonText().textContent = String(chosen);
    return chosen;
  }

  function showYearScanProgress(done, total) {
    const target = host();
    if (seasonButtonText()) seasonButtonText().textContent = `搜尋季後賽年份 ${done}/${total}`;
    if (!target) return;
    target.innerHTML = `
      <div class="postseason-loading">
        <span class="postseason-loader"></span>
        <strong>正在確認有實際出賽的季後賽年份…</strong>
        <span>${done} / ${total}</span>
      </div>`;
  }

  async function scanPostseasonYears(ctx, league, candidates, silent = false) {
    const key = playerKey(ctx, league);
    const stored = readStoredYears(key, candidates);
    if (stored) return { years:stored, failures:[] };

    let cursor = 0;
    let done = 0;
    const years = [];
    const failures = [];
    if (!silent) showYearScanProgress(0, candidates.length);

    const worker = async () => {
      while (cursor < candidates.length) {
        const index = cursor++;
        const year = candidates[index];
        try {
          const data = await requestHistory(ctx, league, year);
          if (playerAppeared(data)) years.push(year);
        } catch (error) {
          console.warn(`季後賽年份 ${year} 讀取失敗`, error);
          failures.push(year);
        } finally {
          done += 1;
          if (!silent) showYearScanProgress(done, candidates.length);
        }
      }
    };

    const workers = Array.from({length:Math.min(2, candidates.length)}, () => worker());
    await Promise.all(workers);
    years.sort((a,b)=>b-a);
    if (!failures.length) writeStoredYears(key, candidates, years);
    return { years, failures };
  }

  async function preparePostseasonYears(ctx, league, { background = false } = {}) {
    const key = playerKey(ctx, league);
    let candidates = candidateYearsCache.get(key) || [];
    const refreshedCandidates = rememberCandidateYears(ctx, league);
    if (refreshedCandidates.length) candidates = refreshedCandidates;

    if (!candidates.length) {
      if (!background) applyYearOptions(ctx, league, []);
      return { year:0, failures:[] };
    }

    if (validYearsCache.has(key)) {
      const years = validYearsCache.get(key) || [];
      return {
        year: background ? 0 : applyYearOptions(ctx, league, years),
        failures:[]
      };
    }

    if (!scanPromises.has(key)) {
      const mySeq = ++scanSeq;
      const promise = scanPostseasonYears(ctx, league, candidates, background)
        .then(result => {
          if (mySeq !== scanSeq && getContext()?.selectedTab !== 'postseason') return result;
          validYearsCache.set(key, result.years);
          return result;
        })
        .finally(() => scanPromises.delete(key));
      scanPromises.set(key, promise);
    }

    const result = await scanPromises.get(key);
    if (background) return { year:0, failures:result?.failures || [] };

    const fresh = getContext();
    if (!fresh?.player || fresh.selectedTab !== 'postseason' || playerKey(fresh, league) !== key) {
      return { year:0, failures:result?.failures || [] };
    }
    const year = applyYearOptions(fresh, league, result?.years || []);
    return { year, failures:result?.failures || [] };
  }

  function statGrid(title, stats, type) {
    if (!stats) return `<section class="postseason-summary-card postseason-summary-empty"><div class="postseason-summary-title">${esc(title)}</div><div class="postseason-summary-none">未出賽</div></section>`;
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

  function seriesProgress(games, comp, league) {
    const ordered = (Array.isArray(games) ? games : []).slice().sort((a,b) =>
      String(a?.date || '').localeCompare(String(b?.date || '')) || String(a?.id || '').localeCompare(String(b?.id || ''))
    );
    if (!ordered.length) return [];
    const first = ordered[0];
    const teamA = String(first?.away || '客隊');
    const teamB = String(first?.home || '主隊');
    const wins = new Map([[teamA,0],[teamB,0]]);
    let draws = 0;

    // NPB CS Final Stage gives the regular-season champion (the home club) a one-win advantage.
    if (String(league || '').toUpperCase() === 'NPB' && ['climax_final','climax_special'].includes(comp?.key) && teamB) {
      wins.set(teamB, 1);
    }

    return ordered.map(game => {
      const away = String(game?.away || '客隊');
      const home = String(game?.home || '主隊');
      if (!wins.has(away)) wins.set(away,0);
      if (!wins.has(home)) wins.set(home,0);
      const awayRaw = game?.awayScore;
      const homeRaw = game?.homeScore;
      const awayScore = Number(awayRaw);
      const homeScore = Number(homeRaw);
      const hasScore = awayRaw !== null && awayRaw !== undefined && awayRaw !== ''
        && homeRaw !== null && homeRaw !== undefined && homeRaw !== ''
        && Number.isFinite(awayScore) && Number.isFinite(homeScore);
      if (hasScore) {
        if (awayScore > homeScore) wins.set(away, (wins.get(away) || 0) + 1);
        else if (homeScore > awayScore) wins.set(home, (wins.get(home) || 0) + 1);
        else draws += 1;
      }
      const aWins = wins.get(teamA) || 0;
      const bWins = wins.get(teamB) || 0;
      return {
        game,
        seriesText: hasScore ? `${teamA} ${aWins}–${bWins} ${teamB}${draws ? `（${draws}和）` : ''}` : '大比分 —'
      };
    });
  }

  function renderStageCard(comp, data, stageIndex) {
    const games = relevantGames(comp);
    const progress = seriesProgress(games, comp, data?.league);
    return `
      <section class="postseason-stage-card" data-stage-key="${esc(comp.key || '')}">
        <div class="postseason-stage-title-row">
          <div><span class="postseason-stage-kicker">SERIES</span><h3>${esc(comp.label || '')}</h3></div>
          <span class="postseason-stage-count">${games.length} 場</span>
        </div>
        <div class="postseason-stage-summary">
          ${statGrid('系列打擊成績', comp.batting, 'batting')}
          ${statGrid('系列投球成績', comp.pitching, 'pitching')}
        </div>
        <div class="postseason-game-list postseason-game-list-compact">${progress.map(({game:g,seriesText},index)=>`
          <button type="button" class="postseason-game-row postseason-game-row-compact" data-postseason-stage-index="${stageIndex}" data-postseason-game="${index}" ${g?.id?'':'disabled'}>
            <div class="postseason-game-topline">
              <span class="postseason-game-date">${esc(String(g.date||'').replaceAll('-','/'))}</span>
              <span class="postseason-game-open">查看單場 ›</span>
            </div>
            <div class="postseason-game-matchup"><span>${esc(g.away||'客隊')}</span><b>${esc(scoreCell(g.awayScore))} - ${esc(scoreCell(g.homeScore))}</b><span>${esc(g.home||'主隊')}</span></div>
            <div class="postseason-series-score">大比分 ${esc(seriesText)}</div>
            <div class="postseason-game-player ${gamePlayerLine(g)==='未出賽'?'is-dnp':''}">${esc(gamePlayerLine(g))}</div>
          </button>`).join('')}</div>
      </section>`;
  }

  function renderCompetition(data, key) {
    const target = host();
    if (!target) return;
    const competitions = (Array.isArray(data?.competitions) ? data.competitions : []).filter(c => c?.playerAppeared);
    if (!competitions.length) {
      target.innerHTML = `<div class="postseason-empty"><strong>${esc(data?.year || '')} 沒有找到這位球員的季後賽出賽紀錄</strong><span>若球員當年沒有實際出賽，這個年份不會保留在季後賽年份選單。</span></div>`;
      return;
    }

    const comp = competitions.find(c => c.key === key) || competitions[0];
    selectedCompetition = comp.key;
    const games = relevantGames(comp);
    const progress = seriesProgress(games, comp, data?.league);

    target.innerHTML = `
      <div class="postseason-history">
        <div class="postseason-head">
          <div><span class="postseason-kicker">POSTSEASON HISTORY</span><h2>${esc(data.year)} ${esc(comp.label)}</h2></div>
          <div class="postseason-source">${esc(data.league)} 官方資料</div>
        </div>
        <div class="postseason-stage-tabs" style="--postseason-stage-count:${competitions.length}">
          ${competitions.map(c=>`<button type="button" class="press-btn postseason-stage-btn ${c.key===comp.key?'active':''}" data-postseason-stage="${esc(c.key)}">${esc(c.label)}</button>`).join('')}
        </div>
        <div class="postseason-summary-wrap">
          ${statGrid('系列打擊成績', comp.batting, 'batting')}
          ${statGrid('系列投球成績', comp.pitching, 'pitching')}
        </div>
        <section class="postseason-games-section">
          <div class="postseason-games-head"><strong>系列賽程</strong><span>${games.length} 場</span></div>
          <div class="postseason-game-list">${games.map((g,index)=>{
            const seriesText = progress[index]?.text || '—';
            const playerLine = gamePlayerLine(g);
            return `
            <button type="button" class="postseason-game-row" data-postseason-game="${index}" ${g?.id?'':'disabled'}>
              <div class="postseason-game-date">${esc(String(g.date||'').replaceAll('-','/'))}</div>
              <div class="postseason-game-matchup"><span>${esc(g.away||'客隊')}</span><b>${esc(scoreCell(g.awayScore))} - ${esc(scoreCell(g.homeScore))}</b><span>${esc(g.home||'主隊')}</span></div>
              <div class="postseason-series-score">大比分 ${esc(seriesText)}</div>
              <div class="postseason-game-player ${playerLine==='未出賽'?'is-dnp':''}">${esc(playerLine)}</div>
              <div class="postseason-game-open">查看逐打席 ›</div>
            </button>`;
          }).join('')}</div>
        </section>
      </div>`;

    target.querySelectorAll('[data-postseason-stage]').forEach(button => {
      button.addEventListener('click', () => renderCompetition(data, String(button.dataset.postseasonStage || '')));
    });
    target.querySelectorAll('[data-postseason-game]').forEach(button => {
      button.addEventListener('click', () => {
        const game = games[Number(button.dataset.postseasonGame)];
        if (!game?.id) return;
        window.dispatchEvent(new CustomEvent('postseason-open-game', { detail:{ game:{...game,status:'final'}, league:data.league, date:game.date, postseason:true } }));
      });
    });
  }

  async function loadAndRender(ctx, yearOverride = 0) {
    const league = showAvailability(ctx);
    const target = host();
    const keyForPlayer = league ? playerKey(ctx, league) : '';
    const year = Number(yearOverride || selectedYearCache.get(keyForPlayer) || ctx?.selectedSeason);
    if (!league || !target || !Number.isInteger(year)) return;
    if (ctx.selectedTab !== 'postseason') {
      setMode(false);
      return;
    }
    setMode(true);
    const key = historyKey(ctx, league, year);
    activeKey = key;
    const seq = ++renderSeq;
    const canvasTitle = document.getElementById('canvasPreviewTitle');
    if (canvasTitle) canvasTitle.textContent = `${year} 季後賽歷史資料`;

    if (historyCache.has(key)) {
      renderCompetition(historyCache.get(key), selectedCompetition);
      return;
    }
    target.innerHTML = `<div class="postseason-loading"><span class="postseason-loader"></span><strong>正在讀取 ${esc(year)} 季後賽資料…</strong><span>第一次讀取歷史系列會稍久，之後會使用後端快取。</span></div>`;
    try {
      const data = await requestHistory(ctx, league, year);
      if (seq !== renderSeq || activeKey !== key) return;
      selectedCompetition = '';
      renderCompetition(data,'');
    } catch (error) {
      if (seq !== renderSeq || activeKey !== key) return;
      target.innerHTML = `<div class="postseason-empty"><strong>季後賽資料讀取失敗</strong><span>${esc(error instanceof Error ? error.message : String(error))}</span><button type="button" class="press-btn" id="retryPostseasonHistory">重新讀取</button></div>`;
      document.getElementById('retryPostseasonHistory')?.addEventListener('click', () => {
        historyCache.delete(key);
        historyInflight.delete(key);
        void loadAndRender(ctx, year);
      });
    }
  }

  async function openPostseason(ctx, league) {
    setMode(true);
    const result = await preparePostseasonYears(ctx, league);
    const fresh = getContext();
    if (!fresh?.player || fresh.selectedTab !== 'postseason' || leagueForPlayer(fresh.player) !== league) return;

    if (!result.year) {
      const target = host();
      if (!target) return;
      if (result.failures?.length) {
        target.innerHTML = `<div class="postseason-empty"><strong>季後賽年份讀取不完整</strong><span>有 ${result.failures.length} 個年份暫時讀取失敗。</span><button type="button" class="press-btn" id="retryPostseasonYears">重新搜尋年份</button></div>`;
        document.getElementById('retryPostseasonYears')?.addEventListener('click', () => {
          const key = playerKey(fresh, league);
          validYearsCache.delete(key);
          scanPromises.delete(key);
          scanSeq += 1;
          void openPostseason(fresh, league);
        });
      } else {
        target.innerHTML = '<div class="postseason-empty"><strong>沒有季後賽出賽紀錄</strong><span>年份選單只會列出這位球員實際有上場的季後賽年份。</span></div>';
      }
      const canvasTitle = document.getElementById('canvasPreviewTitle');
      if (canvasTitle) canvasTitle.textContent = '季後賽歷史資料';
      return;
    }

    await loadAndRender(fresh, result.year);
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncFromApp, 0);
  }

  function syncFromApp() {
    const ctx = getContext();
    if (!ctx?.player) {
      postseasonTab()?.classList.add('hidden');
      normalizePrimaryTabs(false);
      setMode(false);
      return;
    }
    const league = showAvailability(ctx);
    if (!league) return;

    if (ctx.selectedTab !== 'postseason') {
      rememberCandidateYears(ctx, league);
      setMode(false);
      if (ctx.currentPage === 'player') {
        // Validate postseason seasons immediately after entering a player page.
        // This is silent and never replaces the current A/D page with scan progress.
        void preparePostseasonYears(ctx, league, { background:true });
      }
      return;
    }

    void openPostseason(ctx, league);
  }

  injectUiStyle();

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('.tab-btn') : null;
    if (button) scheduleSync();
  });

  const select = seasonSelect();
  select?.addEventListener('change', event => {
    const ctx = getContext();
    if (!ctx?.player || ctx.selectedTab !== 'postseason') return;
    const league = leagueForPlayer(ctx.player);
    if (!league) return;

    // 季後賽年份獨立於例行賽年份；阻止 app.js 把這次切換當成例行賽賽季同步。
    event.stopImmediatePropagation();
    const year = Number(select.value);
    const key = playerKey(ctx, league);
    const allowed = validYearsCache.get(key) || [];
    if (!Number.isInteger(year) || !allowed.includes(year)) return;
    selectedYearCache.set(key, year);
    selectedCompetition = '';
    if (seasonButtonText()) seasonButtonText().textContent = String(year);
    void loadAndRender(ctx, year);
  }, true);

  const seasonObserver = new MutationObserver(() => {
    if (seasonMutationGuard) return;
    const ctx = getContext();
    if (ctx?.selectedTab === 'postseason') scheduleSync();
  });
  if (select) seasonObserver.observe(select,{childList:true});

  const pageObserver = new MutationObserver(() => scheduleSync());
  const selected = document.getElementById('selectedPlayerText');
  const page = document.getElementById('playerPage');
  if (selected) pageObserver.observe(selected,{childList:true,subtree:true,characterData:true});
  if (page) pageObserver.observe(page,{attributes:true,attributeFilter:['class']});

  const tabsHost = document.querySelector('.player-page-tabs');
  const tabsObserver = new MutationObserver(() => {
    const ctx = getContext();
    const supported = Boolean(leagueForPlayer(ctx?.player));
    normalizePrimaryTabs(supported);
  });
  if (tabsHost) tabsObserver.observe(tabsHost,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});

  window.__prefetchPostseasonContext = async () => {
    const ctx = getContext();
    if (!ctx?.player) return { years:[], failures:[] };
    const league = showAvailability(ctx);
    if (!league) return { years:[], failures:[] };
    rememberCandidateYears(ctx, league);
    const key = playerKey(ctx, league);
    const result = await preparePostseasonYears(ctx, league, { background:true });
    return { years:(validYearsCache.get(key) || []).slice(), failures:result?.failures || [] };
  };

  window.addEventListener('pageshow', scheduleSync);
  setTimeout(syncFromApp,0);
})();
