(() => {
  const UI_VERSION = document.querySelector('meta[name="app-version"]')?.getAttribute('content') || 'v2.45';
  const DETAIL_URL_RE = /\/(?:league-game-detail|cpbl-game-detail)(?:\?|$)/i;
  let latestDetail = null;
  let enhanceTimer = null;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const request = args[0];
      const url = typeof request === 'string' ? request : String(request?.url || '');
      if (DETAIL_URL_RE.test(url)) {
        response.clone().json().then(data => {
          if (data?.ok && data?.game) {
            latestDetail = data;
            scheduleEnhance();
          }
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  function applyVersionLabel() {
    const badge = document.getElementById('appVersionBadge');
    if (badge && badge.textContent !== UI_VERSION) badge.textContent = UI_VERSION;
    const splash = document.getElementById('appSplashVersion');
    const splashText = `VERSION ${UI_VERSION}`;
    if (splash && splash.textContent !== splashText) splash.textContent = splashText;
    const meta = document.querySelector('meta[name="app-version"]');
    if (meta && meta.getAttribute('content') !== UI_VERSION) meta.setAttribute('content', UI_VERSION);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }

  function normalizeBaseState(value) {
    if (Array.isArray(value)) return { first: !!value[0], second: !!value[1], third: !!value[2] };
    if (value && typeof value === 'object') {
      return {
        first: !!(value.first ?? value[1] ?? value.base1),
        second: !!(value.second ?? value[2] ?? value.base2),
        third: !!(value.third ?? value[3] ?? value.base3)
      };
    }
    const raw = String(value || '');
    return {
      first: /一壘|一塁|1塁|first/i.test(raw),
      second: /二壘|二塁|2塁|second/i.test(raw),
      third: /三壘|三塁|3塁|third/i.test(raw)
    };
  }

  function baseStateLabel(value) {
    const s = normalizeBaseState(value);
    const bases = [];
    if (s.first) bases.push('一壘');
    if (s.second) bases.push('二壘');
    if (s.third) bases.push('三壘');
    return bases.length ? `${bases.join('、')}有人` : '壘上無人';
  }

  function currentBaseState(detail) {
    if (detail?.current?.baseState) return detail.current.baseState;
    if (detail?.current?.bases) return detail.current.bases;
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    return last?.baseState || last?.basesAfter || last?.bases || '';
  }

  function parseOutNumber(value) {
    const m = String(value ?? '').match(/([0-3])/);
    return m ? Number(m[1]) : null;
  }

  function inferredOutsAfterPlay(play) {
    if (!play) return 0;
    const before = parseOutNumber(play.outs);
    if (before === null) return 0;
    const text = `${play.raw || ''} ${play.result || ''}`;
    let added = 0;
    if (/三殺|トリプルプレー/i.test(text)) added = 3;
    else if (/雙殺|併殺|ダブルプレー/i.test(text)) added = 2;
    else if (/三振|ゴロ|滾地|フライ|飛球|ライナー|平飛|犧牲|犠牲|犠打|アウト/i.test(text)) added = 1;
    return Math.min(3, before + added);
  }

  function currentOuts(detail) {
    const direct = parseOutNumber(detail?.current?.outs);
    if (direct !== null) return Math.min(2, direct);
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    if (!last) return 0;
    const m = String(detail?.game?.inningLabel || '').match(/(\d+)局([上下])/);
    if (m) {
      const sameInning = Number(m[1]) === Number(last.inning || 0);
      const sameHalf = (m[2] === '上' && last.half === 'top') || (m[2] === '下' && last.half === 'bottom');
      if (!sameInning || !sameHalf) return 0;
    }
    const after = inferredOutsAfterPlay(last);
    return after >= 3 ? 0 : after;
  }

  function renderDiamond(value) {
    const s = normalizeBaseState(value);
    return `<div class="gdx-diamond" aria-label="目前壘包狀態">
      <span class="gdx-base gdx-base-second ${s.second ? 'is-on' : ''}" title="二壘"></span>
      <span class="gdx-base gdx-base-third ${s.third ? 'is-on' : ''}" title="三壘"></span>
      <span class="gdx-base gdx-base-first ${s.first ? 'is-on' : ''}" title="一壘"></span>
      <span class="gdx-home"></span>
    </div>`;
  }

  function safeCell(value) {
    if (value === null || value === undefined) return '';
    const s = String(value).trim();
    return s === 'null' || s === 'undefined' ? '' : s;
  }

  function numericInningTotal(values) {
    let total = 0;
    let found = false;
    for (const value of Array.isArray(values) ? values : []) {
      const raw = safeCell(value);
      if (!/^-?\d+$/.test(raw)) continue;
      total += Number(raw);
      found = true;
    }
    return found ? total : null;
  }

  function inferredTotals(detail) {
    let awayH = 0, homeH = 0, awayE = 0, homeE = 0;
    for (const play of Array.isArray(detail?.plays) ? detail.plays : []) {
      const text = `${play?.result || ''} ${play?.raw || ''}`;
      const offense = play?.half === 'bottom' ? 'home' : 'away';
      if (/全壘打|三壘安打|二壘安打|(?:^|\s)安打(?:$|\s)/.test(text)) {
        if (offense === 'away') awayH += 1; else homeH += 1;
      }
      if (/失誤上壘|失誤|エラー/.test(text)) {
        if (offense === 'away') homeE += 1; else awayE += 1;
      }
    }
    return { awayH, homeH, awayE, homeE };
  }

  function normalizedBoard(detail) {
    const game = detail?.game || {};
    const source = detail?.scoreboard || {};
    const inferred = inferredTotals(detail);
    const innings = Array.isArray(source.innings) ? source.innings.map(String) : [];
    const away = Array.isArray(source.away) ? source.away : [];
    const home = Array.isArray(source.home) ? source.home : [];
    const fallback = (value, alt) => safeCell(value) === '' ? alt : value;
    const awayInningRuns = numericInningTotal(away);
    const homeInningRuns = numericInningTotal(home);
    const awayRuns = awayInningRuns !== null
      ? awayInningRuns
      : fallback(source?.awayTotals?.R, fallback(game.awayScore, ''));
    const homeRuns = homeInningRuns !== null
      ? homeInningRuns
      : fallback(source?.homeTotals?.R, fallback(game.homeScore, ''));
    return {
      innings,
      away,
      home,
      awayTotals: {
        R: awayRuns,
        H: fallback(source?.awayTotals?.H, inferred.awayH),
        E: fallback(source?.awayTotals?.E, inferred.awayE)
      },
      homeTotals: {
        R: homeRuns,
        H: fallback(source?.homeTotals?.H, inferred.homeH),
        E: fallback(source?.homeTotals?.E, inferred.homeE)
      }
    };
  }

  function patchMainScore(scoreCard, board) {
    const scoreEls = scoreCard?.querySelectorAll('.game-detail-score-row strong');
    if (!scoreEls || scoreEls.length < 2) return;
    const away = safeCell(board?.awayTotals?.R);
    const home = safeCell(board?.homeTotals?.R);
    if (away !== '') scoreEls[0].textContent = away;
    if (home !== '') scoreEls[1].textContent = home;
  }

  function renderScoreboard(detail, board = normalizedBoard(detail)) {
    const game = detail?.game || {};
    const head = board.innings.map(x => `<th>${esc(x)}</th>`).join('');
    const cells = values => board.innings.map((_, i) => `<td>${esc(safeCell(values[i]))}</td>`).join('');
    return `<section class="gdx-scoreboard game-detail-enhanced-marker" aria-label="計分板">
      <div class="gdx-section-head"><strong>計分板</strong></div>
      <div class="gdx-scoreboard-scroll"><table>
        <thead><tr><th class="gdx-team-col">球隊</th>${head}<th>R</th><th>H</th><th>E</th></tr></thead>
        <tbody>
          <tr><th class="gdx-team-col">${esc(game.away || '客隊')}</th>${cells(board.away)}<td class="gdx-total">${esc(safeCell(board.awayTotals.R))}</td><td>${esc(safeCell(board.awayTotals.H))}</td><td>${esc(safeCell(board.awayTotals.E))}</td></tr>
          <tr><th class="gdx-team-col">${esc(game.home || '主隊')}</th>${cells(board.home)}<td class="gdx-total">${esc(safeCell(board.homeTotals.R))}</td><td>${esc(safeCell(board.homeTotals.H))}</td><td>${esc(safeCell(board.homeTotals.E))}</td></tr>
        </tbody>
      </table></div>
    </section>`;
  }

  function renderLiveSituation(detail) {
    const pitcher = String(detail?.current?.pitcher?.fullName || detail?.current?.pitcher?.name || '').trim() || '讀取中';
    const batter = String(detail?.current?.batter?.fullName || detail?.current?.batter?.name || '').trim() || '等待下一位打者';
    return `<section class="gdx-live-situation game-detail-enhanced-marker">
      <div class="gdx-bases-card"><span>目前壘包</span>${renderDiamond(currentBaseState(detail))}<strong class="gdx-outs">${currentOuts(detail)}出局</strong></div>
      <div class="gdx-current-stack">
        <div class="gdx-current-row"><span>目前投手</span><strong>${esc(pitcher)}</strong></div>
        <div class="gdx-current-row"><span>目前打者</span><strong>${esc(batter)}</strong></div>
      </div>
    </section>`;
  }

  function renderPreviousPlay(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const play = plays[plays.length - 1];
    if (!play) return '';
    const inning = Number(play.inning) || 0;
    const half = play.half === 'bottom' ? '下' : play.half === 'top' ? '上' : '';
    const inningLabel = inning ? `${inning}局${half}` : '';
    const batter = String(play.batter || play.hitter || '—').trim() || '—';
    const result = String(play.result || play.raw || '—').trim() || '—';
    const outs = inferredOutsAfterPlay(play);
    const baseValue = play.baseState || play.basesAfter || play.bases || '';
    const meta = [];
    if (outs >= 3) meta.push('3出局', '攻守交換');
    else {
      meta.push(`${Math.max(0, outs)}出局`);
      meta.push(baseStateLabel(baseValue));
    }
    const rbi = Number(play.rbi) || 0;
    if (rbi > 0) meta.push(`${rbi}打點`);
    const pitcher = String(play.pitcher || '').trim();
    if (pitcher) meta.push(`投手 ${pitcher}`);
    const status = String(detail?.status || '').toLowerCase();
    const title = status === 'final' ? '最後一個打席' : '上一個打席';
    return `<section class="gdx-last-play game-detail-enhanced-marker" aria-label="${title}">
      <div class="gdx-last-play-head"><strong>${title}</strong><span>${esc(inningLabel)}</span></div>
      <div class="gdx-last-play-main">
        <strong>${esc(batter)}</strong>
        <span>${esc(result)}</span>
      </div>
      <div class="gdx-last-play-meta">${meta.map(esc).join('<i>｜</i>')}</div>
    </section>`;
  }

  function detailStamp(detail) {
    const game = detail?.game || {};
    const last = Array.isArray(detail?.plays) && detail.plays.length ? detail.plays[detail.plays.length - 1] : null;
    const board = detail?.scoreboard || {};
    return [
      detail?.league, detail?.date, detail?.status, game.id, game.awayScore, game.homeScore,
      detail?.updatedAt, detail?.current?.outs, detail?.current?.pitcher?.name, detail?.current?.batter?.name,
      JSON.stringify(board?.away || []), JSON.stringify(board?.home || []),
      board?.awayTotals?.R, board?.awayTotals?.H, board?.awayTotals?.E,
      board?.homeTotals?.R, board?.homeTotals?.H, board?.homeTotals?.E,
      last?.inning, last?.half, last?.batter, last?.pitcher, last?.result, last?.bases, last?.basesAfter, last?.rbi
    ].map(v => String(v ?? '')).join('|');
  }

  function sameGame(body, detail) {
    const scoreCard = body.querySelector('.game-detail-score-card');
    if (!scoreCard) return false;
    const text = scoreCard.textContent || '';
    const away = String(detail?.game?.away || '').trim();
    const home = String(detail?.game?.home || '').trim();
    return (!away || text.includes(away)) && (!home || text.includes(home));
  }

  function enhanceGameDetail() {
    applyVersionLabel();
    const detail = latestDetail;
    if (!detail?.game) return;
    const overlay = document.getElementById('homeGameDetailOverlay');
    const body = overlay?.querySelector('#homeGameDetailBody');
    if (!overlay || overlay.classList.contains('hidden') || !body || !sameGame(body, detail)) return;
    const scoreCard = body.querySelector('.game-detail-score-card');
    if (!scoreCard) return;
    const board = normalizedBoard(detail);
    patchMainScore(scoreCard, board);

    const stamp = detailStamp(detail);
    if (body.dataset.gdxStamp === stamp && body.querySelector('.game-detail-enhanced-marker')) return;
    body.dataset.gdxStamp = stamp;
    body.querySelectorAll('.game-detail-enhanced-marker').forEach(el => el.remove());
    body.querySelector('.game-detail-current-grid')?.remove();

    const status = String(detail.status || '').toLowerCase();
    let anchor = scoreCard;
    if (status === 'live') {
      scoreCard.insertAdjacentHTML('afterend', renderLiveSituation(detail));
      anchor = scoreCard.nextElementSibling || scoreCard;
    }
    anchor.insertAdjacentHTML('afterend', renderScoreboard(detail, board));

    const playSection = body.querySelector('.game-detail-play-section');
    const previousPlayHtml = renderPreviousPlay(detail);
    if (playSection && previousPlayHtml) {
      playSection.insertAdjacentHTML('beforebegin', previousPlayHtml);
    }
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceGameDetail, 40);
  }

  new MutationObserver(() => scheduleEnhance()).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-home-game], .home-daily-game, .home-game-row')) setTimeout(scheduleEnhance, 200);
  }, true);

  applyVersionLabel();
  scheduleEnhance();
})();
