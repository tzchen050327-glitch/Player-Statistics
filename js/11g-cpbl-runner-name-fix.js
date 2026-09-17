(() => {
  // CPBL live runner fix: keep occupied bases and runner identities in sync when current.* lags one PA.
  const RUNNER_FIX_VERSION = 'runner-fix-v3';
  let latest = null;
  let timer = 0;

  const txt = v => String(v ?? '').trim();
  const runnerName = v => {
    const s = txt(v);
    if (!s || /^\d+$/.test(s)) return '';
    return s;
  };
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

  function isThirdOut(play) {
    if (!play) return false;
    const text = `${txt(play?.result)} ${txt(play?.raw)} ${txt(play?.description)}`;
    if (/3\s*人出局|三人出局|半局結束/i.test(text)) return true;
    const before = Number(String(play?.outs ?? '').match(/[0-3]/)?.[0]);
    if (before !== 2) return false;
    if (/安打|全壘打|二壘安打|三壘安打|四壞|故意四壞|觸身|死球|失誤上壘|野手選擇|趁傳上壘/i.test(`${txt(play?.result)} ${txt(play?.raw)}`)) return false;
    return /三振|出局|飛球|界飛|邪飛|滾地|滾|雙殺|併殺|犧牲|犧飛|犠牲|アウト/i.test(text);
  }

  function stateInfo(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays.at(-1) || null;
    const current = boolState(detail?.current?.baseState ?? detail?.current?.bases ?? '');
    if (last && sameCurrentHalf(detail,last) && isThirdOut(last)) {
      return { state:{first:false,second:false,third:false}, useAfter:false, last, thirdOut:true };
    }
    if (!last || !sameCurrentHalf(detail,last)) return { state:current, useAfter:false, last, thirdOut:false };

    const afterRaw = last?.baseStateAfter ?? last?.basesAfter;
    if (afterRaw === undefined || afterRaw === null) return { state:current, useAfter:false, last, thirdOut:false };

    // CPBL play.baseState / play.bases can already be the post-PA state.
    // Prefer explicit *Before fields when deciding whether current.* is one PA behind.
    const beforeRaw = last?.baseStateBefore ?? last?.basesBefore ?? last?.baseState ?? last?.bases ?? '';
    const before = boolState(beforeRaw);
    const after = boolState(afterRaw);
    const currentKey = `${+current.first}${+current.second}${+current.third}`;
    const beforeKey = `${+before.first}${+before.second}${+before.third}`;
    const afterKey = `${+after.first}${+after.second}${+after.third}`;
    const useAfter = currentKey === beforeKey && beforeKey !== afterKey;
    return { state:useAfter ? after : current, useAfter, last, thirdOut:false };
  }

  function namesFor(detail, info) {
    if (info?.thirdOut) return {first:'',second:'',third:''};
    const direct = detail?.current?.runners || {};
    const after = info?.last && sameCurrentHalf(detail, info.last) ? (info.last?.runnersAfter || {}) : {};
    const names = {
      first:runnerName(direct.first || direct.firstBase || direct.base1),
      second:runnerName(direct.second || direct.secondBase || direct.base2),
      third:runnerName(direct.third || direct.thirdBase || direct.base3)
    };
    for (const key of ['first','second','third']) {
      const afterName = runnerName(after?.[key]);
      if (info?.useAfter && afterName) names[key] = afterName;
      else if (!names[key]) names[key] = afterName;
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
