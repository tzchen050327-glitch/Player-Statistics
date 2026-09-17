    /* ---------- NPB live state fixes ---------- */
    // Use a tiny RPC for home-card inning labels. This avoids relying on JSON-path
    // projection against the cache table and returns only game_id + inning_label.
    homeNpbLiveInningLabels = async function homeNpbLiveInningLabelsRpc(date) {
      try {
        const base = String(NPB_GAMES_API_URL || '').split('/functions/v1/')[0];
        if (!base) return new Map();
        const response = await fetch(`${base}/rest/v1/rpc/npb_live_home_summary`, {
          method:'POST',
          headers:{
            'content-type':'application/json',
            apikey:CPBL_ANON_KEY,
            authorization:`Bearer ${CPBL_ANON_KEY}`
          },
          body:JSON.stringify({ p_date:date }),
          cache:'no-store'
        });
        if (!response.ok) return new Map();
        const rows = await response.json().catch(() => []);
        return new Map((Array.isArray(rows) ? rows : [])
          .map(row => [String(row?.game_id || ''), String(row?.inning_label || '').trim()])
          .filter(([id,label]) => id && label));
      } catch {
        return new Map();
      }
    };

    // NPB's play.baseState is the PRE-PA state and currently does not expose
    // baseStateAfter/runnersAfter. Patch only scoring plays where the official
    // result itself tells us that a runner scored, instead of changing CPBL logic.
    let npbLiveStateDetail = null;
    let npbLiveStatePatchTimer = 0;

    function npbBaseState(value) {
      if (Array.isArray(value)) return { first:!!value[0], second:!!value[1], third:!!value[2] };
      if (value && typeof value === 'object') return {
        first:!!(value.first ?? value[1] ?? value.base1),
        second:!!(value.second ?? value[2] ?? value.base2),
        third:!!(value.third ?? value[3] ?? value.base3)
      };
      const raw = String(value || '').normalize('NFKC');
      return {
        first:/一壘|一塁/.test(raw),
        second:/二壘|二塁/.test(raw),
        third:/三壘|三塁/.test(raw)
      };
    }

    function npbRbiFromResult(text) {
      const m = String(text || '').normalize('NFKC').match(/(?:打點|打点)\s*([0-9]+)/i);
      return m ? Math.max(0, Number(m[1]) || 0) : 0;
    }

    function npbScoringAfterState(detail) {
      if (String(detail?.league || '').toUpperCase() !== 'NPB') return null;
      if (String(detail?.status || '').toLowerCase() !== 'live') return null;
      const label = String(detail?.game?.inningLabel || '');
      const lm = label.match(/(\d+)\s*局?\s*([上下])/);
      if (!lm) return null;
      const inning = Number(lm[1]);
      const half = lm[2] === '上' ? 'top' : 'bottom';
      const plays = (Array.isArray(detail?.plays) ? detail.plays : [])
        .filter(play => Number(play?.inning) === inning && String(play?.half || '') === half);
      const last = plays.at(-1);
      if (!last) return null;
      const text = `${last?.result || ''} ${last?.raw || ''}`.normalize('NFKC');
      const before = npbBaseState(last?.baseStateBefore ?? last?.basesBefore ?? last?.baseState ?? last?.bases ?? '');
      const rbi = npbRbiFromResult(text);

      // Sacrifice fly with an RBI: the lead runner scores. Keep other runners
      // where they were unless NPB later gives us an explicit post-PA state.
      if (/犧牲飛球|犠牲飛球|犠牲フライ|犧飛|犠飛/i.test(text) && rbi > 0) {
        const after = { ...before };
        let left = rbi;
        for (const key of ['third','second','first']) {
          if (left > 0 && after[key]) {
            after[key] = false;
            left--;
          }
        }
        return after;
      }

      // Timely / RBI single: remove the lead scoring runner(s), advance every
      // remaining pre-existing runner one base, and put the batter on first.
      const single = /(?:前|內野|内野|投手)?(?:適時)?安打|タイムリーヒット|(?:前)?ヒット/i.test(text)
        && !/二壘安打|二塁打|ツーベース|三壘安打|三塁打|スリーベース|全壘打|全塁打|ホームラン/i.test(text);
      if (single && rbi > 0) {
        const occupied = [
          ['third', before.third],
          ['second', before.second],
          ['first', before.first]
        ].filter(([,on]) => on).map(([key]) => key);
        const scoring = new Set(occupied.slice(0, Math.min(rbi, occupied.length)));
        const after = { first:true, second:false, third:false };
        if (before.second && !scoring.has('second')) after.third = true;
        if (before.first && !scoring.has('first')) after.second = true;
        return after;
      }
      return null;
    }

    function applyNpbLiveStatePatch() {
      npbLiveStatePatchTimer = 0;
      const detail = npbLiveStateDetail || window.__latestHomeGameDetail;
      const state = npbScoringAfterState(detail);
      if (!state) return;
      const diamond = document.querySelector('#homeGameDetailBody .gdx-live-situation .gdx-diamond');
      if (!diamond) return;
      const first = diamond.querySelector('.gdx-base-first');
      const second = diamond.querySelector('.gdx-base-second');
      const third = diamond.querySelector('.gdx-base-third');
      first?.classList.toggle('is-on', !!state.first);
      second?.classList.toggle('is-on', !!state.second);
      third?.classList.toggle('is-on', !!state.third);
    }

    function scheduleNpbLiveStatePatch() {
      if (npbLiveStatePatchTimer) return;
      npbLiveStatePatchTimer = setTimeout(applyNpbLiveStatePatch, 0);
    }

    window.addEventListener('home-game-detail-state', event => {
      const detail = event?.detail?.detail || null;
      const league = String(event?.detail?.league || detail?.league || '').toUpperCase();
      if (league !== 'NPB') return;
      npbLiveStateDetail = detail;
      scheduleNpbLiveStatePatch();
      setTimeout(scheduleNpbLiveStatePatch, 50);
    });

    const npbStateObserver = new MutationObserver(() => {
      if (npbLiveStateDetail) scheduleNpbLiveStatePatch();
    });
    if (document.body) npbStateObserver.observe(document.body, { childList:true, subtree:true });
