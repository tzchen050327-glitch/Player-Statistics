(() => {
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

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }

  function normalizeBaseState(value) {
    if (Array.isArray(value)) {
      return { first: !!value[0], second: !!value[1], third: !!value[2] };
    }
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

  function currentBaseState(detail) {
    if (detail?.current?.baseState) return detail.current.baseState;
    if (detail?.current?.bases) return detail.current.bases;
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    return last?.baseState || last?.basesAfter || last?.bases || '';
  }

  function renderDiamond(value) {
    const state = normalizeBaseState(value);
    return `
      <div class="gdx-diamond" aria-label="目前壘包狀態">
        <span class="gdx-base gdx-base-second ${state.second ? 'is-on' : ''}" title="二壘"></span>
        <span class="gdx-base gdx-base-third ${state.third ? 'is-on' : ''}" title="三壘"></span>
        <span class="gdx-base gdx-base-first ${state.first ? 'is-on' : ''}" title="一壘"></span>
        <span class="gdx-home"></span>
      </div>`;
  }

  function safeCell(value) {
    if (value === null || value === undefined) return '';
    const s = String(value).trim();
    return s === 'null' || s === 'undefined' ? '' : s;
  }

  function normalizedBoard(detail) {
    const game = detail?.game || {};
    const source = detail?.scoreboard || {};
    const innings = Array.isArray(source.innings) ? source.innings.map(String) : [];
    const away = Array.isArray(source.away) ? source.away : [];
    const home = Array.isArray(source.home) ? source.home : [];
    return {
      innings,
      away,
      home,
      awayTotals: {
        R: source?.awayTotals?.R ?? game.awayScore ?? '',
        H: source?.awayTotals?.H ?? '',
        E: source?.awayTotals?.E ?? ''
      },
      homeTotals: {
        R: source?.homeTotals?.R ?? game.homeScore ?? '',
        H: source?.homeTotals?.H ?? '',
        E: source?.homeTotals?.E ?? ''
      }
    };
  }

  function renderScoreboard(detail) {
    const board = normalizedBoard(detail);
    const game = detail?.game || {};
    const innings = board.innings;
    const inningHead = innings.map(x => `<th>${esc(x)}</th>`).join('');
    const rowCells = (values) => innings.map((_, i) => `<td>${esc(safeCell(values[i]))}</td>`).join('');
    const hasHits = safeCell(board.awayTotals.H) !== '' || safeCell(board.homeTotals.H) !== '';
    const hasErrors = safeCell(board.awayTotals.E) !== '' || safeCell(board.homeTotals.E) !== '';
    return `
      <section class="gdx-scoreboard game-detail-enhanced-marker" aria-label="計分板">
        <div class="gdx-section-head"><strong>計分板</strong></div>
        <div class="gdx-scoreboard-scroll">
          <table>
            <thead><tr>
              <th class="gdx-team-col">球隊</th>
              ${inningHead}
              <th>R</th>${hasHits ? '<th>H</th>' : ''}${hasErrors ? '<th>E</th>' : ''}
            </tr></thead>
            <tbody>
              <tr>
                <th class="gdx-team-col">${esc(game.away || '客隊')}</th>
                ${rowCells(board.away)}
                <td class="gdx-total">${esc(safeCell(board.awayTotals.R))}</td>
                ${hasHits ? `<td>${esc(safeCell(board.awayTotals.H))}</td>` : ''}
                ${hasErrors ? `<td>${esc(safeCell(board.awayTotals.E))}</td>` : ''}
              </tr>
              <tr>
                <th class="gdx-team-col">${esc(game.home || '主隊')}</th>
                ${rowCells(board.home)}
                <td class="gdx-total">${esc(safeCell(board.homeTotals.R))}</td>
                ${hasHits ? `<td>${esc(safeCell(board.homeTotals.H))}</td>` : ''}
                ${hasErrors ? `<td>${esc(safeCell(board.homeTotals.E))}</td>` : ''}
              </tr>
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderLiveSituation(detail) {
    const pitcher = String(detail?.current?.pitcher?.name || '').trim() || '讀取中';
    const batter = String(detail?.current?.batter?.name || '').trim() || '等待下一位打者';
    return `
      <section class="gdx-live-situation game-detail-enhanced-marker">
        <div class="gdx-bases-card">
          <span>目前壘包</span>
          ${renderDiamond(currentBaseState(detail))}
        </div>
        <div class="gdx-current-stack">
          <div class="gdx-current-row"><span>目前投手</span><strong>${esc(pitcher)}</strong></div>
          <div class="gdx-current-row"><span>目前打者</span><strong>${esc(batter)}</strong></div>
        </div>
      </section>`;
  }

  function detailStamp(detail) {
    const game = detail?.game || {};
    const last = Array.isArray(detail?.plays) && detail.plays.length ? detail.plays[detail.plays.length - 1] : null;
    return [
      detail?.league, detail?.date, detail?.status, game.id, game.awayScore, game.homeScore,
      detail?.updatedAt, last?.inning, last?.half, last?.batter, last?.result, last?.bases
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
    const detail = latestDetail;
    if (!detail?.game) return;
    const overlay = document.getElementById('homeGameDetailOverlay');
    const body = overlay?.querySelector('#homeGameDetailBody');
    if (!overlay || overlay.classList.contains('hidden') || !body || !sameGame(body, detail)) return;

    const main = body.querySelector('.game-detail-content');
    const scoreCard = body.querySelector('.game-detail-score-card');
    if (!main || !scoreCard) return;

    const stamp = detailStamp(detail);
    if (body.dataset.gdxStamp === stamp && body.querySelector('.game-detail-enhanced-marker')) return;
    body.dataset.gdxStamp = stamp;

    body.querySelectorAll('.game-detail-enhanced-marker').forEach(el => el.remove());
    const nativeCurrent = body.querySelector('.game-detail-current-grid');
    if (nativeCurrent) nativeCurrent.remove();

    const status = String(detail.status || '').toLowerCase();
    let anchor = scoreCard;
    if (status === 'live') {
      scoreCard.insertAdjacentHTML('afterend', renderLiveSituation(detail));
      anchor = scoreCard.nextElementSibling || scoreCard;
    }
    anchor.insertAdjacentHTML('afterend', renderScoreboard(detail));

    const badge = document.getElementById('appVersionBadge');
    if (badge) badge.textContent = 'v2.34';
    const splash = document.getElementById('appSplashVersion');
    if (splash) splash.textContent = 'VERSION v2.34';
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceGameDetail, 40);
  }

  new MutationObserver(scheduleEnhance).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-home-game], .home-daily-game, .home-game-row')) {
      setTimeout(scheduleEnhance, 200);
    }
  }, true);

  scheduleEnhance();
})();
