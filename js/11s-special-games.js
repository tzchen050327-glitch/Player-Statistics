    const SPECIAL_GAMES_API_URL = SUPABASE_A_FUNCTIONS_BASE + '/special-games';
    const SPECIAL_REPLAY_CACHE_PREFIX = 'diamondscope:special-replay:v2:';
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
        '.special-replay-overlay{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#06192a;color:#eef8ff;font-family:inherit;user-select:none}',
        '.special-replay-overlay *{box-sizing:border-box}.special-replay-overlay button{font:inherit}',
        '.special-replay-close{position:absolute;right:max(7px,env(safe-area-inset-right));top:max(7px,env(safe-area-inset-top));z-index:7;display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(133,190,236,.25);border-radius:8px;background:rgba(2,14,25,.72);color:#dff2ff;font-size:20px;cursor:pointer}',
        '.special-replay-loading{height:100%;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 50% 42%,#133653 0,#06192a 56%,#04111d 100%)}.special-replay-loading strong{display:block;font-size:22px}.special-replay-loading span{display:block;margin-top:7px;color:#78a5c9;font-size:10px;font-weight:800}',
        '.special-replay-broadcast{height:100%;display:grid;grid-template-columns:20% minmax(0,60%) 20%;background:#06192a}',
        '.special-replay-lineup{min-width:0;display:grid;grid-template-rows:60px 38px minmax(0,1fr);border-right:1px solid rgba(118,174,216,.22);background:#0a2238}.special-replay-lineup.home{border-right:0;border-left:1px solid rgba(118,174,216,.22)}',
        '.special-replay-lineup-head{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:0 15px;border-bottom:1px solid rgba(118,174,216,.22)}.special-replay-lineup-side{color:#7fb9e7;font-size:10px;font-weight:1000;letter-spacing:.12em}.special-replay-lineup-team{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:17px;font-weight:1000}.special-replay-lineup-title{color:#83b7de;font-size:9px;font-weight:1000;letter-spacing:.11em}',
        '.special-replay-lineup-cols,.special-replay-lineup-row{display:grid;grid-template-columns:22px minmax(0,1fr) 24px 24px 28px 34px;align-items:center;gap:3px;padding:0 8px}.special-replay-lineup-cols{border-bottom:1px solid rgba(118,174,216,.2);color:#75add7;font-size:8px;font-weight:950}.special-replay-lineup-cols span:not(:nth-child(2)){text-align:center}',
        '.special-replay-lineup-list{min-height:0;display:grid;grid-template-rows:repeat(9,minmax(0,1fr));overflow:hidden}.special-replay-lineup-row{position:relative;border-bottom:1px solid rgba(118,174,216,.08);font-size:10px;font-weight:900}.special-replay-lineup-row:last-child{border-bottom:0}.special-replay-lineup-row>span:not(.special-replay-lineup-name){text-align:center;color:#c6e6ff}.special-replay-lineup-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px;font-weight:1000}.special-replay-lineup-row.active{margin:3px 5px;padding-left:3px;padding-right:3px;border:1px solid #59aaf2;border-radius:6px;background:#163f63;box-shadow:inset 4px 0 0 #6fc0ff}.special-replay-lineup-row.active .special-replay-lineup-name{color:#fff}.special-replay-lineup-pos{font-size:7px!important;color:#87c7f5!important;font-weight:1000!important}',
        '.special-replay-center{min-width:0;min-height:0;display:grid;grid-template-rows:104px 96px minmax(0,1fr) 42px;background:linear-gradient(180deg,#071d30 0,#061929 100%)}',
        '.special-replay-score{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 40px 6px;border-bottom:1px solid rgba(118,174,216,.16)}.special-replay-score-team{min-width:90px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:1000}.special-replay-score-team.away{text-align:right}.special-replay-score-team.home{text-align:left}.special-replay-score-num{font-size:46px;font-weight:1000;line-height:1;font-variant-numeric:tabular-nums}.special-replay-status-pill{min-width:72px;padding:7px 9px;border:1px solid rgba(116,175,220,.24);border-radius:999px;background:#0a2439;color:#9dcaec;text-align:center;font-size:9px;font-weight:1000}.special-replay-score-sub{position:absolute;margin-top:68px;color:#6f9aba;font-size:8px;font-weight:850}',
        '.special-replay-linescore{min-width:0;overflow:hidden;border-bottom:1px solid rgba(118,174,216,.2)}.special-replay-linescore table{width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums}.special-replay-linescore th,.special-replay-linescore td{padding:0 3px;text-align:center;border-bottom:1px solid rgba(118,174,216,.12);font-size:9px}.special-replay-linescore thead th{height:30px;color:#6fa7d1;font-size:8px;font-weight:1000}.special-replay-linescore th:first-child,.special-replay-linescore td:first-child{width:92px;text-align:left;padding-left:12px;color:#edf8ff;font-weight:1000}.special-replay-linescore th.current,.special-replay-linescore td.current{background:rgba(61,142,204,.12);color:#93ceff}.special-replay-linescore td.total{color:#88c9f7;font-weight:1000}',
        '.special-replay-arena{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 28%;gap:8px;padding:8px}',
        '.special-replay-field,.special-replay-state-card{min-height:0;position:relative;border:1px solid rgba(118,174,216,.22);border-radius:10px;background:#061a2b;overflow:hidden}',
        '.special-replay-field-label{position:absolute;left:9px;top:8px;z-index:2;color:#7fb9e7;font-size:8px;font-weight:1000}',
        '.special-replay-field-lines{position:absolute;left:9%;right:9%;bottom:7%;top:19%;opacity:.62}.special-replay-field-line{position:absolute;left:50%;bottom:0;width:2px;height:72%;background:#8f8c70;transform-origin:bottom}.special-replay-field-line.left{transform:rotate(-45deg)}.special-replay-field-line.right{transform:rotate(45deg)}.special-replay-infield-line{position:absolute;left:50%;bottom:1%;width:43%;height:43%;border-left:2px solid #8f8c70;border-top:2px solid #8f8c70;transform:translateX(-50%) rotate(45deg);transform-origin:center}',
        '.special-replay-defender{position:absolute;z-index:3;transform:translate(-50%,-50%);max-width:120px;padding:3px 6px;border:1px solid rgba(116,175,220,.22);border-radius:5px;background:#041522;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:8px;font-weight:1000;white-space:nowrap}.special-replay-defender small{margin-left:4px;color:#76b9e9;font-size:6px}.special-replay-defender[data-pos="CF"]{left:50%;top:24%}.special-replay-defender[data-pos="LF"]{left:28%;top:39%}.special-replay-defender[data-pos="RF"]{left:72%;top:39%}.special-replay-defender[data-pos="SS"]{left:39%;top:60%}.special-replay-defender[data-pos="2B"]{left:61%;top:60%}.special-replay-defender[data-pos="3B"]{left:26%;top:76%}.special-replay-defender[data-pos="1B"]{left:74%;top:76%}.special-replay-defender[data-pos="P"]{left:50%;top:75%}.special-replay-defender[data-pos="C"]{left:50%;top:93%}',
        '.special-replay-callout{position:absolute;left:12px;right:12px;bottom:10px;z-index:5;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;padding:6px 9px;border:1px solid rgba(87,171,237,.28);border-radius:7px;background:rgba(2,14,25,.88);backdrop-filter:blur(7px)}.special-replay-callout-tag{padding:3px 6px;border-radius:999px;background:#17456b;color:#9cd4ff;font-size:7px;font-weight:1000}.special-replay-callout-copy{min-width:0}.special-replay-callout-copy strong,.special-replay-callout-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.special-replay-callout-copy strong{font-size:10px}.special-replay-callout-copy span{margin-top:1px;color:#a5bfd3;font-size:8px;font-weight:850}',
        '.special-replay-state-card{display:grid;grid-template-rows:auto 128px auto minmax(0,1fr);padding:9px}.special-replay-state-title{color:#84bae2;font-size:8px;font-weight:1000}.special-replay-diamond-wrap{display:grid;place-items:center}.special-replay-diamond{position:relative;width:76px;aspect-ratio:1;transform:rotate(45deg)}.special-replay-base{position:absolute;width:25%;aspect-ratio:1;border:2px solid #8aa6ba;background:#0a2238}.special-replay-base.on{border-color:#ffdc70;background:#ffca3a;box-shadow:0 0 14px rgba(255,202,58,.34)}.special-replay-base.b2{left:0;top:0}.special-replay-base.b1{right:0;top:0}.special-replay-base.b3{left:0;bottom:0}.special-replay-homeplate{position:absolute;right:0;bottom:0;width:22%;aspect-ratio:1;border:2px solid #dce9f3;background:#f6fbff}',
        '.special-replay-state-inning{text-align:center;color:#eef8ff;font-size:12px;font-weight:1000}.special-replay-state-info{align-self:end;display:grid;gap:5px;padding-top:7px;border-top:1px solid rgba(118,174,216,.14);font-size:8px}.special-replay-state-info-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:5px;align-items:center}.special-replay-state-info-row span:first-child{color:#6fa7d1;font-weight:900}.special-replay-state-info-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:9px}.special-replay-outs{display:flex;gap:4px}.special-replay-outs i{width:7px;height:7px;border-radius:50%;border:1px solid #ff7272}.special-replay-outs i.on{background:#ff5d5d}.special-replay-prev{margin-top:2px;padding-top:5px;border-top:1px solid rgba(118,174,216,.11);color:#7ea5c0;font-size:7px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.special-replay-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:5px 8px 6px;border-top:1px solid rgba(118,174,216,.18)}.special-replay-progress{display:grid;gap:3px}.special-replay-progress-top{display:flex;justify-content:space-between;color:#759db9;font-size:7px;font-weight:850}.special-replay-progress-track{height:3px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}.special-replay-progress-bar{height:100%;background:#69b8ff}.special-replay-controls{display:flex;gap:4px}.special-replay-control{height:28px;min-width:32px;padding:0 8px;border:1px solid rgba(118,174,216,.2);border-radius:7px;background:#0a263d;color:#e9f8ff;font-size:8px;font-weight:1000;cursor:pointer}.special-replay-control.primary{min-width:52px;background:#1767a5}',
        '.special-replay-rotate-hint{display:none}',
        '@media (max-height:520px) and (orientation:landscape){.special-replay-lineup{grid-template-rows:46px 28px minmax(0,1fr)}.special-replay-lineup-head{padding:0 8px}.special-replay-lineup-team{font-size:12px}.special-replay-lineup-side,.special-replay-lineup-title{font-size:7px}.special-replay-lineup-cols,.special-replay-lineup-row{grid-template-columns:17px minmax(0,1fr) 20px 20px 22px 27px;padding:0 4px;font-size:7px}.special-replay-lineup-name{font-size:8px}.special-replay-center{grid-template-rows:70px 70px minmax(0,1fr) 34px}.special-replay-score{padding:4px 24px}.special-replay-score-num{font-size:32px}.special-replay-score-team{min-width:64px;font-size:10px}.special-replay-status-pill{min-width:56px;padding:5px;font-size:7px}.special-replay-score-sub{margin-top:46px;font-size:6px}.special-replay-linescore thead th{height:21px}.special-replay-linescore th,.special-replay-linescore td{font-size:7px}.special-replay-linescore th:first-child,.special-replay-linescore td:first-child{width:66px;padding-left:7px}.special-replay-arena{gap:5px;padding:5px}.special-replay-state-card{grid-template-rows:auto 80px auto minmax(0,1fr);padding:6px}.special-replay-diamond{width:49px}.special-replay-defender{font-size:6px;padding:2px 4px}.special-replay-defender small{font-size:5px}.special-replay-callout{left:7px;right:7px;bottom:6px;padding:4px 6px}.special-replay-callout-copy strong{font-size:7px}.special-replay-callout-copy span{font-size:6px}.special-replay-state-info{gap:3px;font-size:6px}.special-replay-state-info-row{grid-template-columns:22px minmax(0,1fr) auto}.special-replay-state-info-row strong{font-size:7px}.special-replay-prev{font-size:6px}.special-replay-footer{padding:3px 5px}.special-replay-control{height:24px}}',
        '@media (orientation:portrait){.special-replay-broadcast{grid-template-columns:1fr}.special-replay-lineup{display:none}.special-replay-center{grid-template-rows:86px 82px minmax(0,1fr) 42px}.special-replay-rotate-hint{display:block;position:absolute;left:50%;top:7px;z-index:8;transform:translateX(-50%);padding:5px 9px;border:1px solid rgba(118,174,216,.2);border-radius:999px;background:rgba(3,18,30,.85);color:#9ac8e8;font-size:8px;font-weight:900}.special-replay-arena{grid-template-columns:1fr}.special-replay-state-card{display:none}}'
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

    function specialReplayKindLabel(kind) {
      return ({pa:'打席',runner:'跑壘',pitch:'換投',sub:'換人',half:'半局'})[String(kind || '')] || '事件';
    }

    function specialReplayInningLabel(event) {
      return String(Number(event && event.i) || 1) + '局' + (String(event && event.h || 'T') === 'B' ? '下' : '上');
    }

    function specialReplayBaseHtml(mask) {
      const b = Number(mask) || 0;
      return '<div class="special-replay-diamond"><i class="special-replay-base b2 ' + (b & 2 ? 'on' : '') + '"></i><i class="special-replay-base b1 ' + (b & 1 ? 'on' : '') + '"></i><i class="special-replay-base b3 ' + (b & 4 ? 'on' : '') + '"></i><i class="special-replay-homeplate"></i></div>';
    }

    function specialReplayOutsHtml(outs) {
      const value = Math.max(0, Math.min(3, Number(outs) || 0));
      return '<div class="special-replay-outs">' + [1,2,3].map(n => '<i class="' + (value >= n ? 'on' : '') + '"></i>').join('') + '</div>';
    }

    function specialReplayFallbackLineups() {
      return {
        away:[
          {order:1,name:'鄭宗哲',pos:'2B'},{order:2,name:'陳晨威',pos:'CF'},{order:3,name:'費柴德',pos:'RF'},
          {order:4,name:'張育成',pos:'1B'},{order:5,name:'吳念庭',pos:'3B'},{order:6,name:'林安可',pos:'LF'},
          {order:7,name:'吉力吉撈・鞏冠',pos:'DH'},{order:8,name:'林家正',pos:'C'},{order:9,name:'江坤宇',pos:'SS'}
        ],
        home:[
          {order:1,name:'金倒永',pos:'3B'},{order:2,name:'Jahmai Jones',pos:'LF'},{order:3,name:'李政厚',pos:'CF'},
          {order:4,name:'Ahn Hyeon-min',pos:'RF'},{order:5,name:'文保景',pos:'1B'},{order:6,name:'Shay Whitcomb',pos:'DH'},
          {order:7,name:'金周元',pos:'SS'},{order:8,name:'朴東原',pos:'C'},{order:9,name:'金慧成',pos:'2B'}
        ]
      };
    }

    function specialReplayLineupHtml(side, teamName, lineup, event) {
      const isOffense = (String(event.h || 'T') === 'T' && side === 'away') || (String(event.h || 'T') === 'B' && side === 'home');
      const sideLabel = side === 'away' ? 'AWAY' : 'HOME';
      const rows = (Array.isArray(lineup) ? lineup : []).slice(0,9).map((player,index) => {
        const playerName = String(player && player.name || '');
        const active = isOffense && String(event.k || '') === 'pa' && playerName && String(event.n || '') === playerName;
        return '<div class="special-replay-lineup-row ' + (active ? 'active' : '') + '"><span>' + escapeHtml(player.order || index + 1) + '</span><span class="special-replay-lineup-name">' + escapeHtml(playerName) + '</span><span>' + escapeHtml(player.h == null ? '-' : player.h) + '</span><span>' + escapeHtml(player.hr == null ? '-' : player.hr) + '</span><span>' + escapeHtml(player.rbi == null ? '-' : player.rbi) + '</span><span class="special-replay-lineup-pos">' + escapeHtml(player.pos || '') + '</span></div>';
      }).join('');
      return '<aside class="special-replay-lineup ' + (side === 'home' ? 'home' : '') + '"><div class="special-replay-lineup-head"><span class="special-replay-lineup-side">' + sideLabel + '</span><strong class="special-replay-lineup-team">' + escapeHtml(teamName) + '</strong><span class="special-replay-lineup-title">LINEUP</span></div><div class="special-replay-lineup-cols"><span>#</span><span>姓名</span><span>H</span><span>HR</span><span>RBI</span><span>守位</span></div><div class="special-replay-lineup-list">' + rows + '</div></aside>';
    }

    function specialReplayCurrentPitcher(state, event) {
      for (let i = state.index; i >= 0; i -= 1) {
        const item = state.events[i];
        if (item && item.p && item.h === event.h) return item.p;
        if (item && Number(item.i) < Number(event.i) - 1) break;
      }
      const defenseSide = String(event.h || 'T') === 'T' ? 'home' : 'away';
      return state.detail && state.detail.payload && state.detail.payload.defense && state.detail.payload.defense[defenseSide] && state.detail.payload.defense[defenseSide].P || '';
    }

    function specialReplayPreviousPa(state) {
      for (let i = state.index - 1; i >= 0; i -= 1) {
        const item = state.events[i];
        if (item && item.k === 'pa') return item;
      }
      return null;
    }

    function specialReplayDefenseHtml(state, event) {
      const payload = state.detail && state.detail.payload || {};
      const fieldingSide = String(event.h || 'T') === 'T' ? 'home' : 'away';
      const defense = Object.assign({}, payload.defense && payload.defense[fieldingSide] || {});
      const pitcher = specialReplayCurrentPitcher(state,event);
      if (pitcher) defense.P = pitcher;
      return ['LF','CF','RF','3B','SS','2B','1B','P','C'].map(pos => {
        const name = defense[pos] || pos;
        return '<span class="special-replay-defender" data-pos="' + pos + '">' + escapeHtml(name) + '<small>' + pos + '</small></span>';
      }).join('');
    }

    function specialReplayLineScoreHtml(detail,event) {
      const payload = detail.payload || {};
      const lineScore = payload.line_score || {};
      const away = Array.isArray(lineScore.away) ? lineScore.away : [];
      const home = Array.isArray(lineScore.home) ? lineScore.home : [];
      const summary = payload.summary || {};
      const innings = Math.max(9, away.length, home.length, Number(summary.innings) || 9);
      const current = Math.max(1, Number(event.i) || 1);
      let head = '<th></th>';
      for (let i=1;i<=innings;i+=1) head += '<th class="' + (i === current ? 'current' : '') + '">' + i + '</th>';
      head += '<th>R</th><th>H</th><th>E</th>';
      const row = (name,arr,r,h,e) => {
        let cells = '<td>' + escapeHtml(name) + '</td>';
        for (let i=1;i<=innings;i+=1) cells += '<td class="' + (i === current ? 'current' : '') + '">' + escapeHtml(arr[i-1] == null ? '' : arr[i-1]) + '</td>';
        cells += '<td class="total">' + escapeHtml(r) + '</td><td>' + escapeHtml(h == null ? '-' : h) + '</td><td>' + escapeHtml(e == null ? '-' : e) + '</td>';
        return '<tr>' + cells + '</tr>';
      };
      return '<div class="special-replay-linescore"><table><thead><tr>' + head + '</tr></thead><tbody>' + row(detail.away_team || '中華台北',away,summary.away_score,summary.away_hits,summary.away_errors) + row(detail.home_team || '韓國',home,summary.home_score,summary.home_hits,summary.home_errors) + '</tbody></table></div>';
    }

    function specialReplayCenterHtml(state,event) {
      const detail = state.detail;
      const payload = detail.payload || {};
      const summary = payload.summary || {};
      const scores = Array.isArray(event.s) ? event.s : [0,0];
      const prev = specialReplayPreviousPa(state);
      const pitcher = specialReplayCurrentPitcher(state,event);
      const batter = event.k === 'pa' ? event.n : '';
      const fieldLabel = String(event.h || 'T') === 'T' ? (detail.home_team || '韓國') + ' 守備' : (detail.away_team || '中華台北') + ' 守備';
      const lastEvent = state.index >= state.events.length - 1;
      const statusText = lastEvent ? '比賽結束' : specialReplayInningLabel(event);
      const eventTitle = event.n || specialReplayInningLabel(event);
      const eventCopy = event.r || '';
      const progress = Math.max(0, Math.min(100, ((state.index + 1) / state.events.length) * 100));
      return '<main class="special-replay-center"><div class="special-replay-rotate-hint">請將手機橫向觀看</div><div class="special-replay-score"><span class="special-replay-score-team away">' + escapeHtml(detail.away_team || '中華台北') + '</span><strong class="special-replay-score-num">' + (Number(scores[0]) || 0) + '</strong><span class="special-replay-status-pill">' + escapeHtml(statusText) + '</span><strong class="special-replay-score-num">' + (Number(scores[1]) || 0) + '</strong><span class="special-replay-score-team home">' + escapeHtml(detail.home_team || '韓國') + '</span><span class="special-replay-score-sub">' + escapeHtml([detail.game_date,detail.venue].filter(Boolean).join('｜')) + '</span></div>' + specialReplayLineScoreHtml(detail,event) + '<div class="special-replay-arena"><section class="special-replay-field"><span class="special-replay-field-label">' + escapeHtml(fieldLabel) + '</span><div class="special-replay-field-lines"><i class="special-replay-field-line left"></i><i class="special-replay-field-line right"></i><i class="special-replay-infield-line"></i></div>' + specialReplayDefenseHtml(state,event) + '<div class="special-replay-callout"><span class="special-replay-callout-tag">' + escapeHtml(specialReplayKindLabel(event.k)) + '</span><div class="special-replay-callout-copy"><strong>' + escapeHtml(eventTitle) + '</strong><span>' + escapeHtml(eventCopy) + '</span></div></div></section><aside class="special-replay-state-card"><span class="special-replay-state-title">壘上</span><div class="special-replay-diamond-wrap">' + specialReplayBaseHtml(event.b) + '</div><div class="special-replay-state-inning">' + escapeHtml(specialReplayInningLabel(event)) + '</div><div class="special-replay-state-info"><div class="special-replay-state-info-row"><span>投手</span><strong>' + escapeHtml(pitcher || '-') + '</strong>' + specialReplayOutsHtml(event.o) + '</div><div class="special-replay-state-info-row"><span>打者</span><strong>' + escapeHtml(batter || event.n || '-') + '</strong><span></span></div><div class="special-replay-state-info-row"><span>比分</span><strong>' + (Number(scores[0]) || 0) + ' : ' + (Number(scores[1]) || 0) + '</strong><span></span></div><div class="special-replay-prev">上一棒　' + escapeHtml(prev ? prev.n + '｜' + prev.r : '—') + '</div></div></aside></div><div class="special-replay-footer"><div class="special-replay-progress"><div class="special-replay-progress-top"><span>' + escapeHtml(specialReplayKindLabel(event.k)) + ' · ' + (Math.max(250,Number(event.d)||1000)/1000).toFixed(1) + ' 秒</span><span>' + (state.index + 1) + ' / ' + state.events.length + '</span></div><div class="special-replay-progress-track"><div class="special-replay-progress-bar" style="width:' + progress.toFixed(2) + '%"></div></div></div><div class="special-replay-controls"><button class="special-replay-control" type="button" data-special-replay-prev>‹</button><button class="special-replay-control primary" type="button" data-special-replay-toggle>' + (state.playing ? '暫停' : (lastEvent ? '重播' : '播放')) + '</button><button class="special-replay-control" type="button" data-special-replay-next>›</button></div></div></main>';
    }

    async function openSpecialGameReplay(game) {
      ensureSpecialReplayStyles();
      closeSpecialGameReplay();
      const overlay = document.createElement('section');
      overlay.className = 'special-replay-overlay';
      overlay.innerHTML = '<button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button><div class="special-replay-loading"><div><strong>準備轉播畫面</strong><span>正在讀取手機快取／比賽時間軸…</span></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('[data-special-replay-close]').addEventListener('click', closeSpecialGameReplay);
      try {
        const full = overlay.requestFullscreen && overlay.requestFullscreen();
        if (full && full.then) full.then(() => {
          try {
            const lock = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape');
            if (lock && lock.catch) lock.catch(() => {});
          } catch {}
        }).catch(() => {});
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
        overlay.innerHTML = '<button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button><div class="special-replay-loading"><div><strong>重播載入失敗</strong><span>' + escapeHtml(error && error.message || '請稍後再試') + '</span></div></div>';
        overlay.querySelector('[data-special-replay-close]').addEventListener('click', closeSpecialGameReplay);
      }
    }

    function renderSpecialReplayFrame() {
      const state = specialReplayActive;
      if (!state || !state.overlay || !state.events.length || !state.detail) return;
      const event = state.events[state.index] || state.events[0];
      const payload = state.detail.payload || {};
      const lineups = payload.lineups || specialReplayFallbackLineups();
      state.overlay.innerHTML = '<button class="special-replay-close" type="button" data-special-replay-close aria-label="關閉">×</button><div class="special-replay-broadcast">' + specialReplayLineupHtml('away',state.detail.away_team || '中華台北',lineups.away,event) + specialReplayCenterHtml(state,event) + specialReplayLineupHtml('home',state.detail.home_team || '韓國',lineups.home,event) + '</div>';
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
        if (current.index >= current.events.length - 1) {
          current.playing = false;
          renderSpecialReplayFrame();
          return;
        }
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
      if (state.index >= state.events.length - 1) {
        state.index = 0;
        state.remainingMs = Math.max(250, Number(state.events[0] && state.events[0].d) || 1000);
      }
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
      try {
        if (document.fullscreenElement === overlay && document.exitFullscreen) {
          const exit = document.exitFullscreen();
          if (exit && exit.catch) exit.catch(() => {});
        }
      } catch {}
      if (overlay && overlay.remove) overlay.remove();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && specialReplayActive && specialReplayActive.playing) toggleSpecialReplayPlayback();
    });
