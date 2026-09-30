    const SPECIAL_GAMES_API_URL = SUPABASE_A_FUNCTIONS_BASE + '/special-games';
    const SPECIAL_REPLAY_CACHE_PREFIX = 'diamondscope:special-replay:v1:';
    const specialReplayMemory = new Map();
    let specialReplayActive = null;

    function ensureSpecialReplayStyles() {
      if (document.getElementById('specialReplayStyles')) return;
      const style = document.createElement('style');
      style.id = 'specialReplayStyles';
      style.textContent = [
        '.special-game-card{width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer;transition:.14s transform,.14s border-color,.14s box-shadow}',
        '.special-game-card:hover{border-color:var(--accent);box-shadow:0 8px 24px rgba(0,0,0,.08)}.special-game-card:active{transform:scale(.992)}',
        '.special-game-card-foot{display:flex;justify-content:space-between;gap:10px;margin-top:12px;padding-top:11px;border-top:1px solid var(--line);font-size:11px;font-weight:900}.special-game-card-foot span:first-child{opacity:.62}.special-game-card-foot span:last-child{color:var(--accent)}',
        '.special-replay-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-rows:auto 1fr auto;min-width:0;min-height:0;padding:max(8px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));overflow:hidden;background:radial-gradient(circle at 50% 28%,#17304a 0,#09131f 43%,#03070b 100%);color:#f7fbff;font-family:inherit}',
        '.special-replay-overlay button{font:inherit}.special-replay-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;min-height:42px}.special-replay-brand{min-width:0;display:flex;align-items:center;gap:9px}.special-replay-brand-badge{padding:5px 8px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:rgba(255,255,255,.08);font-size:9px;font-weight:1000}.special-replay-brand-text{min-width:0}.special-replay-brand-text strong,.special-replay-brand-text span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.special-replay-brand-text strong{font-size:13px}.special-replay-brand-text span{margin-top:2px;color:#8fa4b8;font-size:8px;font-weight:800}.special-replay-close{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:21px;cursor:pointer}',
        '.special-replay-loading{display:grid;place-items:center;text-align:center}.special-replay-loading strong{display:block;font-size:22px}.special-replay-loading span{display:block;margin-top:7px;color:#91a7ba;font-size:10px}',
        '.special-replay-body{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:9px}.special-replay-scorebar{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;padding:8px 12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(4,9,16,.72)}',
        '.special-replay-team{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:9px}.special-replay-team.home{grid-template-columns:auto minmax(0,1fr)}.special-replay-team.home .special-replay-team-copy{text-align:right}.special-replay-team-code{display:block;color:#8fa4b8;font-size:8px;font-weight:1000}.special-replay-team-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:1000}.special-replay-team-score{font-size:36px;font-weight:1000;line-height:1;font-variant-numeric:tabular-nums}.special-replay-inning{display:grid;place-items:center;min-width:82px;text-align:center}.special-replay-inning strong{font-size:16px}.special-replay-inning span{margin-top:2px;color:#8fa4b8;font-size:7px;font-weight:900}',
        '.special-replay-stage{min-height:0;display:grid;grid-template-columns:minmax(0,1.65fr) minmax(190px,.65fr);gap:9px}.special-replay-main,.special-replay-state{min-height:0;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:linear-gradient(145deg,rgba(17,33,51,.88),rgba(5,11,19,.9))}.special-replay-main{display:grid;align-content:center;gap:8px;padding:clamp(18px,4vw,44px)}',
        '.special-replay-event-tag{width:max-content;max-width:100%;padding:5px 9px;border:1px solid rgba(118,187,255,.28);border-radius:999px;background:rgba(52,143,236,.12);color:#a8d5ff;font-size:8px;font-weight:1000}.special-replay-player{margin:0;font-size:clamp(25px,4.5vw,58px);font-weight:1000;line-height:1.03}.special-replay-vs{color:#91a7ba;font-size:clamp(10px,1.3vw,14px);font-weight:850}.special-replay-result{font-size:clamp(15px,2.3vw,29px);font-weight:950;line-height:1.25}.special-replay-half .special-replay-player{font-size:clamp(30px,5vw,66px)}.special-replay-half .special-replay-result{color:#8ec9ff}',
        '.special-replay-state{display:grid;grid-template-rows:minmax(0,1fr) auto;align-items:center;padding:16px}.special-replay-diamond-wrap{display:grid;place-items:center}.special-replay-diamond{position:relative;width:min(19vw,145px);aspect-ratio:1;transform:rotate(45deg)}.special-replay-base{position:absolute;width:28%;aspect-ratio:1;border:2px solid rgba(255,255,255,.62);border-radius:10%;background:rgba(255,255,255,.07)}.special-replay-base.on{border-color:#ffd66b;background:#ffca3a;box-shadow:0 0 24px rgba(255,202,58,.34)}.special-replay-base.b2{left:0;top:0}.special-replay-base.b1{right:0;top:0}.special-replay-base.b3{left:0;bottom:0}.special-replay-homeplate{position:absolute;right:0;bottom:0;width:24%;aspect-ratio:1;border:2px solid rgba(255,255,255,.32);border-radius:12%}',
        '.special-replay-state-bottom{display:grid;gap:8px}.special-replay-outs{display:flex;justify-content:center;gap:7px}.special-replay-outs span{width:12px;height:12px;border-radius:50%;border:2px solid #ff6b6b}.special-replay-outs span.on{background:#ff5d5d;box-shadow:0 0 10px rgba(255,93,93,.5)}.special-replay-outs-label,.special-replay-count{text-align:center;color:#91a7ba;font-size:8px;font-weight:900}.special-replay-count{display:flex;justify-content:center;gap:9px}',
        '.special-replay-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding-top:7px}.special-replay-progress{display:grid;gap:4px}.special-replay-progress-top{display:flex;justify-content:space-between;color:#8fa4b8;font-size:8px;font-weight:850}.special-replay-progress-track{height:4px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}.special-replay-progress-bar{height:100%;background:#69b8ff}.special-replay-controls{display:flex;gap:6px}.special-replay-control{min-width:40px;height:34px;padding:0 10px;border:1px solid rgba(255,255,255,.15);border-radius:9px;background:rgba(255,255,255,.08);color:#fff;font-size:9px;font-weight:950;cursor:pointer}.special-replay-control.primary{min-width:70px;background:#1f75c7}.special-replay-rotate-hint{display:none}',
        '@media (orientation:portrait){.special-replay-rotate-hint{display:flex;align-items:center;justify-content:center;min-height:30px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:rgba(255,255,255,.06);color:#a8bfd2;font-size:8px;font-weight:900}.special-replay-stage{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.special-replay-state{grid-template-columns:1fr auto;grid-template-rows:1fr;gap:16px;padding:10px 14px}.special-replay-diamond{width:84px}.special-replay-main{padding:18px}.special-replay-team-name{font-size:11px}.special-replay-team-score{font-size:28px}.special-replay-inning{min-width:64px}.special-replay-footer{grid-template-columns:1fr}.special-replay-controls{justify-content:center}}',
        '@media (max-height:520px) and (orientation:landscape){.special-replay-overlay{padding-top:5px;padding-bottom:5px}.special-replay-head{min-height:32px}.special-replay-scorebar{padding:6px 10px}.special-replay-team-score{font-size:30px}.special-replay-main{padding:15px 23px}.special-replay-diamond{width:min(17vw,108px)}.special-replay-footer{padding-top:5px}}'
      ].join('');
      document.head.appendChild(style);
    }

    function specialReplayCacheKey(game) {
      return SPECIAL_REPLAY_CACHE_PREFIX + String(game && game.slug || '') + ':' + String(game && game.updated_at || 'latest');
    }

    function readSpecialReplayCache(game) {
      const key = specialReplayCacheKey(game);
      if (specialReplayMemory.has(key)) return specialReplayMemory.get(key);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const detail = JSON.parse(raw);
        specialReplayMemory.set(key, detail);
        return detail;
      } catch { return null; }
    }

    function writeSpecialReplayCache(game, detail) {
      const key = specialReplayCacheKey(game);
      specialReplayMemory.set(key, detail);
      try {
        const prefix = SPECIAL_REPLAY_CACHE_PREFIX + String(game && game.slug || '') + ':';
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
          const oldKey = localStorage.key(i);
          if (oldKey && oldKey.startsWith(prefix) && oldKey !== key) localStorage.removeItem(oldKey);
        }
        localStorage.setItem(key, JSON.stringify(detail));
      } catch {}
    }

    async function loadSpecialGameDetail(game) {
      const cached = readSpecialReplayCache(game);
      if (cached && cached.payload && Array.isArray(cached.payload.events) && cached.payload.events.length) return cached;
      const slug = String(game && game.slug || '').trim();
      if (!slug) throw new Error('特殊比賽缺少識別碼');
      const response = await fetch(SPECIAL_GAMES_API_URL + '?slug=' + encodeURIComponent(slug), { cache:'default' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const body = await response.json();
      if (!body || !body.game || !body.game.payload || !Array.isArray(body.game.payload.events) || !body.game.payload.events.length) throw new Error('找不到重播時間軸');
      writeSpecialReplayCache(game, body.game);
      return body.game;
    }

    async function loadSpecialGames() {
      if (!els.homeSpecialGamesExplorer) return [];
      try {
        const response = await fetch(SPECIAL_GAMES_API_URL, { cache:'default' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const payload = await response.json();
        homeSpecialGames = (Array.isArray(payload && payload.games) ? payload.games : []).filter(game => !['CPBL','中職','中華職棒'].includes(String(game && game.league || '').trim().toUpperCase()));
      } catch (error) {
        console.warn('特殊比賽讀取失敗', error);
        homeSpecialGames = [];
      }
      return homeSpecialGames;
    }

    function renderSpecialGamesExplorer() {
      if (!els.homeSpecialGamesExplorer || homeRootSection !== 'special') return;
      ensureSpecialReplayStyles();
      if (!Array.isArray(homeSpecialGames) || !homeSpecialGames.length) {
        els.homeSpecialGamesExplorer.innerHTML = '<div class="special-games-empty"><strong>目前沒有特殊比賽</strong><span>你指定要收錄的比賽之後會顯示在這裡。</span></div>';
        void loadSpecialGames().then(() => { if (homeRootSection === 'special' && homeSpecialGames.length) renderSpecialGamesExplorer(); });
        return;
      }
      els.homeSpecialGamesExplorer.innerHTML = homeSpecialGames.map(game => '<button class="special-game-card" type="button" data-special-replay-slug="' + escapeHtml(game.slug || '') + '"><div class="special-game-card-top"><strong>' + escapeHtml(game.title || '特殊比賽') + '</strong><span>' + escapeHtml(game.status || '') + '</span></div><div class="special-game-matchup">' + escapeHtml(game.away_team || '') + '<b>VS</b>' + escapeHtml(game.home_team || '') + '</div><div class="special-game-meta">' + escapeHtml([game.game_date, game.game_time, game.venue].filter(Boolean).join('｜')) + '</div><div class="special-game-card-foot"><span>' + escapeHtml(game.league || 'SPECIAL') + '</span><span>▶ 橫向重播</span></div></button>').join('');
      els.homeSpecialGamesExplorer.querySelectorAll('[data-special-replay-slug]').forEach(button => button.addEventListener('click', () => {
        const game = homeSpecialGames.find(item => String(item && item.slug || '') === String(button.dataset.specialReplaySlug || ''));
        if (game) void openSpecialGameReplay(game);
      }));
    }

    function specialReplayKindLabel(kind) { return ({pa:'打席',runner:'跑壘事件',pitch:'投手更換',sub:'球員更換',half:'半局結束'})[String(kind || '')] || '比賽事件'; }
    function specialReplayInningLabel(event) { return String(Number(event && event.i) || 1) + '局' + (String(event && event.h || 'T') === 'B' ? '下' : '上'); }
    function specialReplayBaseHtml(mask) {
      const b = Number(mask) || 0;
      return '<div class="special-replay-diamond"><i class="special-replay-base b2 ' + (b & 2 ? 'on' : '') + '"></i><i class="special-replay-base b1 ' + (b & 1 ? 'on' : '') + '"></i><i class="special-replay-base b3 ' + (b & 4 ? 'on' : '') + '"></i><i class="special-replay-homeplate"></i></div>';
    }
    function specialReplayOutsHtml(outs) {
      const value = Math.max(0, Math.min(3, Number(outs) || 0));
      return '<div class="special-replay-outs">' + [1,2,3].map(n => '<span class="' + (value >= n ? 'on' : '') + '"></span>').join('') + '</div>';
    }

    function specialReplayHeader(game) {
      return '<div class="special-replay-head"><div class="special-replay-brand"><span class="special-replay-brand-badge">WBC 2026</span><div class="special-replay-brand-text"><strong>' + escapeHtml(game.title || '特殊比賽') + '</strong><span>' + escapeHtml([game.game_date, game.venue].filter(Boolean).join('｜')) + '</span></div></div><button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button></div>';
    }

    async function openSpecialGameReplay(game) {
      ensureSpecialReplayStyles();
      closeSpecialGameReplay();
      const overlay = document.createElement('section');
      overlay.className = 'special-replay-overlay';
      overlay.innerHTML = specialReplayHeader(game) + '<div class="special-replay-loading"><div><strong>準備重播</strong><span>正在讀取本機快取／比賽時間軸…</span></div></div><div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('[data-special-replay-close]').addEventListener('click', closeSpecialGameReplay);
      try {
        const full = overlay.requestFullscreen && overlay.requestFullscreen();
        if (full && full.then) full.then(() => { try { const lock = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (lock && lock.catch) lock.catch(() => {}); } catch {} }).catch(() => {});
      } catch {}
      specialReplayActive = { overlay:overlay, game:game, detail:null, events:[], index:0, playing:false, timer:0, remainingMs:0, startedAt:0 };
      try {
        const detail = await loadSpecialGameDetail(game);
        if (!specialReplayActive || specialReplayActive.overlay !== overlay) return;
        specialReplayActive.detail = detail;
        specialReplayActive.events = detail.payload.events;
        specialReplayActive.playing = true;
        specialReplayActive.remainingMs = Math.max(250, Number(detail.payload.events[0] && detail.payload.events[0].d) || 1000);
        renderSpecialReplayFrame();
        scheduleSpecialReplayAdvance();
      } catch (error) {
        console.warn('特殊比賽重播載入失敗', error);
        const loading = overlay.querySelector('.special-replay-loading');
        if (loading) loading.innerHTML = '<div><strong>重播載入失敗</strong><span>' + escapeHtml(error && error.message || '請稍後再試') + '</span></div>';
      }
    }

    function renderSpecialReplayFrame() {
      const state = specialReplayActive;
      if (!state || !state.overlay || !state.events.length) return;
      const event = state.events[state.index] || state.events[0];
      const detail = state.detail || state.game;
      const summary = detail.payload && detail.payload.summary || {};
      const scores = Array.isArray(event.s) ? event.s : [0,0];
      const isHalf = String(event.k || '') === 'half';
      const progress = Math.max(0, Math.min(100, ((state.index + 1) / state.events.length) * 100));
      const awayName = detail.away_team || '中華台北', homeName = detail.home_team || '韓國';
      const mainName = event.n || specialReplayInningLabel(event);
      const pitcher = event.p ? '<div class="special-replay-vs">vs ' + escapeHtml(event.p) + '</div>' : '';
      state.overlay.innerHTML = specialReplayHeader(detail) + '<div class="special-replay-body"><div class="special-replay-rotate-hint">旋轉手機可進入橫向大螢幕重播</div><div class="special-replay-scorebar"><div class="special-replay-team"><div class="special-replay-team-copy"><span class="special-replay-team-code">' + escapeHtml(summary.away_code || 'TPE') + '</span><span class="special-replay-team-name">' + escapeHtml(awayName) + '</span></div><strong class="special-replay-team-score">' + (Number(scores[0]) || 0) + '</strong></div><div class="special-replay-inning"><strong>' + escapeHtml(specialReplayInningLabel(event)) + '</strong><span>' + escapeHtml(detail.status || 'REPLAY') + '</span></div><div class="special-replay-team home"><strong class="special-replay-team-score">' + (Number(scores[1]) || 0) + '</strong><div class="special-replay-team-copy"><span class="special-replay-team-code">' + escapeHtml(summary.home_code || 'KOR') + '</span><span class="special-replay-team-name">' + escapeHtml(homeName) + '</span></div></div></div><div class="special-replay-stage"><section class="special-replay-main ' + (isHalf ? 'special-replay-half' : '') + '"><span class="special-replay-event-tag">' + escapeHtml(specialReplayKindLabel(event.k)) + '</span><h2 class="special-replay-player">' + escapeHtml(mainName) + '</h2>' + pitcher + '<div class="special-replay-result">' + escapeHtml(event.r || '') + '</div></section><aside class="special-replay-state"><div class="special-replay-diamond-wrap">' + specialReplayBaseHtml(event.b) + '</div><div class="special-replay-state-bottom">' + specialReplayOutsHtml(event.o) + '<div class="special-replay-outs-label">OUT</div><div class="special-replay-count"><span>EVENT ' + (state.index + 1) + '</span><span>' + state.events.length + ' EVENTS</span></div></div></aside></div></div><div class="special-replay-footer"><div class="special-replay-progress"><div class="special-replay-progress-top"><span>' + escapeHtml(specialReplayKindLabel(event.k)) + ' · ' + (Math.max(250, Number(event.d) || 1000) / 1000).toFixed(1) + ' 秒</span><span>' + (state.index + 1) + ' / ' + state.events.length + '</span></div><div class="special-replay-progress-track"><div class="special-replay-progress-bar" style="width:' + progress.toFixed(2) + '%"></div></div></div><div class="special-replay-controls"><button class="special-replay-control" type="button" data-special-replay-prev>‹</button><button class="special-replay-control primary" type="button" data-special-replay-toggle>' + (state.playing ? '暫停' : (state.index >= state.events.length - 1 ? '重播' : '播放')) + '</button><button class="special-replay-control" type="button" data-special-replay-next>›</button></div></div>';
      state.overlay.querySelector('[data-special-replay-close]').addEventListener('click', closeSpecialGameReplay);
      state.overlay.querySelector('[data-special-replay-toggle]').addEventListener('click', toggleSpecialReplayPlayback);
      state.overlay.querySelector('[data-special-replay-prev]').addEventListener('click', () => seekSpecialReplay(-1));
      state.overlay.querySelector('[data-special-replay-next]').addEventListener('click', () => seekSpecialReplay(1));
    }

    function scheduleSpecialReplayAdvance() {
      const state = specialReplayActive;
      if (!state || !state.playing || !state.events.length) return;
      clearTimeout(state.timer);
      state.remainingMs = Math.max(100, Number(state.remainingMs) || Number(state.events[state.index] && state.events[state.index].d) || 1000);
      state.startedAt = performance.now();
      state.timer = setTimeout(() => {
        const current = specialReplayActive;
        if (!current || !current.playing) return;
        if (current.index >= current.events.length - 1) { current.playing = false; renderSpecialReplayFrame(); return; }
        current.index += 1;
        current.remainingMs = Math.max(250, Number(current.events[current.index] && current.events[current.index].d) || 1000);
        renderSpecialReplayFrame();
        scheduleSpecialReplayAdvance();
      }, state.remainingMs);
    }

    function toggleSpecialReplayPlayback() {
      const state = specialReplayActive;
      if (!state || !state.events.length) return;
      if (state.playing) {
        clearTimeout(state.timer);
        state.remainingMs = Math.max(100, state.remainingMs - Math.max(0, performance.now() - state.startedAt));
        state.playing = false;
        renderSpecialReplayFrame();
        return;
      }
      if (state.index >= state.events.length - 1) { state.index = 0; state.remainingMs = Math.max(250, Number(state.events[0] && state.events[0].d) || 1000); }
      state.playing = true;
      renderSpecialReplayFrame();
      scheduleSpecialReplayAdvance();
    }

    function seekSpecialReplay(delta) {
      const state = specialReplayActive;
      if (!state || !state.events.length) return;
      clearTimeout(state.timer);
      state.index = Math.max(0, Math.min(state.events.length - 1, state.index + Number(delta || 0)));
      state.remainingMs = Math.max(250, Number(state.events[state.index] && state.events[state.index].d) || 1000);
      renderSpecialReplayFrame();
      if (state.playing) scheduleSpecialReplayAdvance();
    }

    function closeSpecialGameReplay() {
      const state = specialReplayActive;
      if (!state) return;
      clearTimeout(state.timer);
      const overlay = state.overlay;
      specialReplayActive = null;
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch {}
      try { if (document.fullscreenElement === overlay && document.exitFullscreen) { const exit = document.exitFullscreen(); if (exit && exit.catch) exit.catch(() => {}); } } catch {}
      if (overlay && overlay.remove) overlay.remove();
    }

    document.addEventListener('visibilitychange', () => { if (document.hidden && specialReplayActive && specialReplayActive.playing) toggleSpecialReplayPlayback(); });
