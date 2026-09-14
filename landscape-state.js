(() => {
  const VERSION = 'v2.76';
  const DETAIL_RE = /\/(?:cpbl-game-detail|cpbl-postseason-detail|npb-game-detail|league-game-detail)(?:\?|$)/i;
  let latestDetail = null;
  let timer = 0;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const safe = value => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return text === 'null' || text === 'undefined' ? '' : text;
  };

  function parseOuts(value) {
    const match = String(value ?? '').match(/([0-3])/);
    return match ? Number(match[1]) : null;
  }

  function outsAfter(play) {
    if (!play) return 0;
    const before = parseOuts(play.outs);
    if (before === null) return 0;
    const text = `${play.raw || ''} ${play.result || ''}`;
    let add = 0;
    if (/三殺|トリプルプレー/i.test(text)) add = 3;
    else if (/雙殺|併殺|ダブルプレー/i.test(text)) add = 2;
    else if (/三振|ゴロ|滾地|フライ|飛球|ライナー|平飛|犧牲|犠牲|犠打|アウト/i.test(text)) add = 1;
    return Math.min(3, before + add);
  }

  function shouldShowBothLineups(detail) {
    const status = String(detail?.status || '').toLowerCase();
    if (status === 'final') return true;
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    return outsAfter(plays.at(-1)) >= 3;
  }

  function lineupRows(detail, side) {
    const raw = detail?.lineups?.[side] || {};
    const rows = Array.isArray(raw.batters) ? raw.batters : [];
    return rows
      .map((entry, index) => ({
        order:Number(entry?.order) || index + 1,
        number:safe(entry?.number || entry?.uniformNumber || entry?.jersey || ''),
        name:clean(entry?.name || entry?.fullName || entry?.playerName || ''),
        avg:safe(entry?.avg ?? entry?.average ?? entry?.battingAverage ?? ''),
        hits:safe(entry?.hits ?? entry?.h ?? ''),
        homeRuns:safe(entry?.homeRuns ?? entry?.hr ?? ''),
        rbi:safe(entry?.rbi ?? entry?.rbis ?? '')
      }))
      .filter(entry => entry.name)
      .sort((a,b) => a.order - b.order)
      .slice(0, 9);
  }

  function renderLineup(detail, side) {
    const entries = lineupRows(detail, side);
    const rows = Array.from({length:9}, (_, index) => entries[index] || {});
    return `<div class="gdx-landscape-lineup gdx-v276-lineup" data-v276-lineup="${side}">
      <div class="gdx-lineup-head"><span>#</span><span>姓名</span><span>AVG</span><span>H</span><span>HR</span><span>RBI</span></div>
      ${rows.map(entry => `<div class="gdx-lineup-row"><span>${esc(entry.number || '—')}</span><strong>${esc(entry.name || '—')}</strong><span>${esc(entry.avg || '—')}</span><span>${esc(entry.hits || '—')}</span><span>${esc(entry.homeRuns || '—')}</span><span>${esc(entry.rbi || '—')}</span></div>`).join('')}
    </div>`;
  }

  function apply() {
    timer = 0;
    const detail = latestDetail;
    const league = String(detail?.league || '').toUpperCase();
    if (!detail || !['CPBL','NPB'].includes(league)) return;
    const board = document.querySelector('.gdx-landscape-board');
    if (!board) return;
    if (!shouldShowBothLineups(detail)) return;

    board.classList.add('is-lineup-reset');
    for (const side of ['away','home']) {
      const section = board.querySelector(`.gdx-side-${side}`);
      if (!section) continue;
      const head = section.querySelector('.gdx-landscape-team-head');
      const label = head?.querySelector('em');
      if (label) label.textContent = 'LINEUP';
      const current = section.querySelector('.gdx-landscape-lineup, .gdx-landscape-pitcher');
      const template = document.createElement('template');
      template.innerHTML = renderLineup(detail, side).trim();
      const fresh = template.content.firstElementChild;
      if (!fresh) continue;
      if (current) current.replaceWith(fresh);
      else section.appendChild(fresh);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 40);
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const request = args[0];
      const url = typeof request === 'string' ? request : String(request?.url || '');
      if (DETAIL_RE.test(url)) {
        response.clone().json().then(data => {
          if (data?.ok && data?.game && String(data?.league || '').toUpperCase() === 'CPBL') {
            latestDetail = data;
            schedule();
          }
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  const acceptLiveCacheUpdate = event => {
    const detail = event?.detail?.detail || event?.detail?.row?.published_payload || null;
    if (detail?.game && ['CPBL','NPB'].includes(String(detail?.league || '').toUpperCase())) {
      latestDetail = detail;
      schedule();
    }
  };
  window.addEventListener('cpbl-live-cache-update', acceptLiveCacheUpdate);
  window.addEventListener('npb-live-cache-update', acceptLiveCacheUpdate);

  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('orientationchange', () => setTimeout(schedule, 80), {passive:true});
  window.__landscapeStateVersion = VERSION;
})();
