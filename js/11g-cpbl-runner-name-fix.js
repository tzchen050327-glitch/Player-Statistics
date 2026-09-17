(() => {
  // CPBL live runner fix: keep occupied bases and runner identities in sync when current.* lags one PA.
  const RUNNER_FIX_VERSION = 'runner-fix-v2';
  let latest = null;
  let timer = 0;

  const txt = v => String(v ?? '').trim();
  const boolState = value => {
    if (Array.isArray(value)) return { first:!!value[0], second:!!value[1], third:!!value[2] };
    if (value && typeof value === 'object') return {
      first:!!(value.first ?? value[1] ?? value.base1),
      second:!!(value.second ?? value[2] ?? value.base2),
      third:!!(value.third ?? value[3] ?? value.base3)
    };
    const s = txt(value);
    return {
      first:/一壘|一塁|(?:^|[^0-9])1(?:[^0-9]|$)/.test(s),
      second:/二壘|二塁|(?:^|[^0-9])2(?:[^0-9]|$)/.test(s),
      third:/三壘|三塁|(?:^|[^0-9])3(?:[^0-9]|$)/.test(s)
    };
  };

  function sameCurrentHalf(detail, play) {
    const m = txt(detail?.game?.inningLabel).match(/(\d+)\s*局?\s*([上下])/);
    if (!m || !play) return true;
    return Number(play?.inning) === Number(m[1]) && txt(play?.half) === (m[2] === '上' ? 'top' : 'bottom');
  }

  function stateInfo(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays.at(-1) || null;
    const current = boolState(detail?.current?.baseState ?? detail?.current?.bases ?? '');
    if (!last || !sameCurrentHalf(detail,last)) return { state:current, useAfter:false, last };

    const afterRaw = last?.baseStateAfter ?? last?.basesAfter;
    if (afterRaw === undefined || afterRaw === null) return { state:current, useAfter:false, last };

    // IMPORTANT: CPBL play.baseState / play.bases can already be the post-PA state.
    // Prefer the explicit *Before fields when deciding whether current.* is one PA behind.
    const beforeRaw = last?.baseStateBefore ?? last?.basesBefore ?? last?.baseState ?? last?.bases ?? '';
    const before = boolState(beforeRaw);
    const after = boolState(afterRaw);
    const currentKey = `${+current.first}${+current.second}${+current.third}`;
    const beforeKey = `${+before.first}${+before.second}${+before.third}`;
    const afterKey = `${+after.first}${+after.second}${+after.third}`;
    const useAfter = currentKey === beforeKey && beforeKey !== afterKey;
    return { state:useAfter ? after : current, useAfter, last };
  }

  function namesFor(detail, info) {
    const direct = detail?.current?.runners || {};
    const after = info?.last && sameCurrentHalf(detail, info.last) ? (info.last?.runnersAfter || {}) : {};
    const names = {
      first:txt(direct.first || direct.firstBase || direct[1] || direct.base1),
      second:txt(direct.second || direct.secondBase || direct[2] || direct.base2),
      third:txt(direct.third || direct.thirdBase || direct[3] || direct.base3)
    };
    for (const key of ['first','second','third']) {
      if (info?.useAfter && txt(after?.[key])) names[key] = txt(after[key]);
      else if (!names[key]) names[key] = txt(after?.[key]);
    }
    return names;
  }

  function patch() {
    timer = 0;
    const detail = latest;
    if (!detail || txt(detail?.league).toUpperCase() !== 'CPBL') return;
    const root = document.querySelector('#homeGameDetailBody');
    if (!root) return;

    const info = stateInfo(detail);
    const state = info.state;
    const names = namesFor(detail, info);
    for (const key of ['first','second','third']) {
      const base = root.querySelector(`.gdx-runner-base.gdx-runner-${key}`);
      const name = root.querySelector(`.gdx-runner-name-${key}`);
      if (base) base.classList.toggle('is-on', !!state[key]);
      if (name) name.textContent = state[key] ? (names[key] || '—') : '';
    }
  }

  function schedule(detail) {
    if (detail?.game) latest = detail;
    if (timer) clearTimeout(timer);
    timer = setTimeout(patch, 40);
    setTimeout(patch, 160);
  }

  window.addEventListener('home-game-detail-state', event => schedule(event?.detail?.detail));
  window.addEventListener('cpbl-live-cache-update', event => schedule(event?.detail?.detail || event?.detail?.row?.published_payload));
  void RUNNER_FIX_VERSION;
})();
