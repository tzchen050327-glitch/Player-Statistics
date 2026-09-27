    const playerToolsCache = new Map();
    const playerToolsLoading = new Set();
    const playerToolsErrors = new Map();
    let playerRankingLeague = ['cpbl','npb'].includes(localStorage.getItem('playerRankingLeague')) ? localStorage.getItem('playerRankingLeague') : 'cpbl';
    let playerRankingRole = ['hitter','pitcher'].includes(localStorage.getItem('playerRankingRole')) ? localStorage.getItem('playerRankingRole') : 'hitter';
    let playerRankingMetric = localStorage.getItem('playerRankingMetric') || 'avg';
    const schedulePageCache = new Map();
    const schedulePageLoading = new Set();
    const schedulePageErrors = new Map();
    let schedulePageLeague = ['CPBL','NPB'].includes(localStorage.getItem('schedulePageLeague'))
      ? localStorage.getItem('schedulePageLeague')
      : 'CPBL';
    let schedulePageDate = /^\d{4}-\d{2}-\d{2}$/.test(localStorage.getItem('schedulePageDate') || '')
      ? localStorage.getItem('schedulePageDate')
      : localISODate();

    function playerToolsLeagueCode(value) {
      return String(value || '').toLowerCase() === 'npb' ? 'NPB' : 'CPBL';
    }

    function playerToolsKey(league) {
      return `${playerToolsLeagueCode(league)}|${CURRENT_YEAR}`;
    }

    async function loadPlayerToolsData(league, { force=false } = {}) {
      const key = playerToolsKey(league);
      if (playerToolsLoading.has(key)) return;
      if (!force && playerToolsCache.has(key)) return playerToolsCache.get(key);
      playerToolsLoading.add(key);
      playerToolsErrors.delete(key);
      try {
        const response = await fetch(LEAGUE_PLAYER_STATS_API_URL, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body:JSON.stringify({
            appKey:CPBL_APP_KEY,
            league:playerToolsLeagueCode(league),
            year:CURRENT_YEAR,
            force:Boolean(force)
          })
        });
        const text = await response.text();
        let data = {};
        try { data = JSON.parse(text || '{}'); } catch {}
        if (!response.ok || data?.ok !== true) throw new Error(data?.error || `球員數據讀取失敗（${response.status}）`);
        playerToolsCache.set(key, data);
        return data;
      } catch (error) {
        playerToolsErrors.set(key, error instanceof Error ? error.message : String(error));
        return null;
      } finally {
        playerToolsLoading.delete(key);
        if (currentPage === 'player-ranking') renderPlayerRankingPage();
      }
    }

    function playerToolsData(league) {
      return playerToolsCache.get(playerToolsKey(league)) || null;
    }

    function playerToolsRows(league, role) {
      const data = playerToolsData(league);
      return Array.isArray(role === 'pitcher' ? data?.pitchers : data?.hitters)
        ? (role === 'pitcher' ? data.pitchers : data.hitters)
        : [];
    }

    function playerToolsMetricDefs(role) {
      return role === 'pitcher'
        ? [
            { key:'era', label:'ERA', lower:true, fmt:'two' },
            { key:'whip', label:'WHIP', lower:true, fmt:'two' },
            { key:'w', label:'W', fmt:'int' },
            { key:'k', label:'K', fmt:'int' },
            { key:'sv', label:'SV', fmt:'int' },
            { key:'hld', label:'HLD', fmt:'int' }
          ]
        : [
            { key:'avg', label:'AVG', fmt:'three' },
            { key:'ops', label:'OPS', fmt:'three' },
            { key:'opsplus', label:'OPS+', fmt:'int' },
            { key:'hr', label:'HR', fmt:'int' },
            { key:'rbi', label:'RBI', fmt:'int' },
            { key:'h', label:'H', fmt:'int' },
            { key:'sb', label:'SB', fmt:'int' },
            { key:'obp', label:'OBP', fmt:'three' },
            { key:'slg', label:'SLG', fmt:'three' }
          ];
    }

    function playerToolsMetricDef(role, key) {
      const defs = playerToolsMetricDefs(role);
      return defs.find(x => x.key === key) || defs[0];
    }

    function playerToolsFormat(value, fmt='int') {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      if (fmt === 'three') return n.toFixed(3).replace(/^0/,'');
      if (fmt === 'two') return n.toFixed(2);
      if (fmt === 'ip') {
        const outs = Math.max(0, Math.round(n));
        return `${Math.floor(outs/3)}.${outs%3}`;
      }
      return String(Math.round(n));
    }

    function playerToolsSortedRows(league, role, metric) {
      const def = playerToolsMetricDef(role, metric);
      const data = playerToolsData(league);
      const customOpsRate = role === 'hitter' && ['ops','opsplus','obp','slg'].includes(def.key);
      const official = data?.leaderboards?.[role]?.[def.key];
      if (!customOpsRate && Array.isArray(official) && official.length) return official;
      const standardRateMetric = role === 'hitter'
        ? def.key === 'avg'
        : ['era','whip'].includes(def.key);
      return [...playerToolsRows(league, role)]
        .filter(row => Number.isFinite(Number(row?.[def.key])))
        .filter(row => !standardRateMetric || row?.qualifiedRate === true)
        .filter(row => !customOpsRate || row?.qualifiedOpsRate === true)
        .sort((a,b) => {
          const av = Number(a?.[def.key] || 0);
          const bv = Number(b?.[def.key] || 0);
          const d = def.lower ? av - bv : bv - av;
          return d || String(a?.name || '').localeCompare(String(b?.name || ''));
        });
    }

    function playerToolsLeagueButtons(active, attr) {
      return [
        `<button type="button" class="player-tools-toggle ${active === 'cpbl' ? 'active' : ''}" ${attr}="cpbl">中職</button>`,
        `<button type="button" class="player-tools-toggle ${active === 'npb' ? 'active' : ''}" ${attr}="npb">日職</button>`
      ].join('');
    }

    function playerToolsRoleButtons(active, attr) {
      return [
        `<button type="button" class="player-tools-toggle ${active === 'hitter' ? 'active' : ''}" ${attr}="hitter">打者</button>`,
        `<button type="button" class="player-tools-toggle ${active === 'pitcher' ? 'active' : ''}" ${attr}="pitcher">投手</button>`
      ].join('');
    }

    function renderPlayerRankingPage() {
      if (!els.playerRankingPageContent) return;
      const key = playerToolsKey(playerRankingLeague);
      const data = playerToolsData(playerRankingLeague);
      const loading = playerToolsLoading.has(key);
      const error = playerToolsErrors.get(key) || '';
      const defs = playerToolsMetricDefs(playerRankingRole);
      if (!defs.some(x => x.key === playerRankingMetric)) playerRankingMetric = defs[0].key;
      const def = playerToolsMetricDef(playerRankingRole, playerRankingMetric);
      const rows = data ? playerToolsSortedRows(playerRankingLeague, playerRankingRole, playerRankingMetric) : [];
      els.playerRankingPageContent.innerHTML = `
        <div class="player-tools-switch-group">
          <div class="player-tools-switch-row">${playerToolsLeagueButtons(playerRankingLeague,'data-player-ranking-league')}</div>
          <div class="player-tools-switch-row">${playerToolsRoleButtons(playerRankingRole,'data-player-ranking-role')}</div>
        </div>
        <div class="player-tools-metric-strip">
          ${defs.map(item => `<button type="button" class="player-tools-metric ${item.key === playerRankingMetric ? 'active' : ''}" data-player-ranking-metric="${item.key}">${item.label}</button>`).join('')}
        </div>
        ${loading && !data ? '<div class="player-tools-empty">正在讀取官方球季數據…</div>' : ''}
        ${error ? `<div class="player-tools-error">${escapeHtml(error)}<button type="button" data-player-tools-retry="ranking">重試</button></div>` : ''}
        ${data ? `
          <div class="player-tools-source">
            <span>${playerRankingLeague === 'cpbl' ? 'CPBL' : 'NPB'} ${CURRENT_YEAR}</span>
            <span>${data?.cache?.hit ? '共用快取' : '官方更新'}</span>
          </div>
          <div class="player-ranking-table">
            <div class="player-ranking-head">
              <span>#</span><span>球員</span><span>球隊</span><span>${def.label}</span>
            </div>
            <div class="player-ranking-body">
              ${rows.length ? rows.map((row,index) => `
                <div class="player-ranking-row">
                  <b>${index + 1}</b>
                  <strong title="${escapeHtml(String(row?.name || ''))}">${escapeHtml(String(row?.name || '—'))}</strong>
                  <span title="${escapeHtml(String(row?.team || ''))}">${escapeHtml(String(row?.team || '—'))}</span>
                  <em>${playerToolsFormat(row?.[def.key], def.fmt)}</em>
                </div>`).join('') : '<div class="player-tools-empty">目前沒有可顯示的排行資料。</div>'}
            </div>
          </div>
          <div class="player-tools-note">${playerRankingRole === 'hitter' ? 'AVG 維持官方規定打席；OPS／OPS+／OBP／SLG 採自訂門檻：打席數至少等於球隊出賽數。OPS+ 以 100 為聯盟平均，不含球場因子。' : 'ERA／WHIP 僅列規定投球局達標投手；W／K／SV／HLD 不限制規定投球局。'}</div>
        ` : ''}
      `;

      els.playerRankingPageContent.querySelectorAll('[data-player-ranking-league]').forEach(btn => btn.addEventListener('click', () => {
        playerRankingLeague = String(btn.dataset.playerRankingLeague || 'cpbl');
        localStorage.setItem('playerRankingLeague', playerRankingLeague);
        renderPlayerRankingPage();
        void loadPlayerToolsData(playerRankingLeague);
      }));
      els.playerRankingPageContent.querySelectorAll('[data-player-ranking-role]').forEach(btn => btn.addEventListener('click', () => {
        playerRankingRole = String(btn.dataset.playerRankingRole || 'hitter');
        playerRankingMetric = playerToolsMetricDefs(playerRankingRole)[0].key;
        localStorage.setItem('playerRankingRole', playerRankingRole);
        localStorage.setItem('playerRankingMetric', playerRankingMetric);
        renderPlayerRankingPage();
      }));
      els.playerRankingPageContent.querySelectorAll('[data-player-ranking-metric]').forEach(btn => btn.addEventListener('click', () => {
        playerRankingMetric = String(btn.dataset.playerRankingMetric || '');
        localStorage.setItem('playerRankingMetric', playerRankingMetric);
        renderPlayerRankingPage();
      }));
      els.playerRankingPageContent.querySelector('[data-player-tools-retry="ranking"]')?.addEventListener('click', () => {
        playerToolsErrors.delete(key);
        void loadPlayerToolsData(playerRankingLeague, { force:true });
      });

      if (!data && !loading && !error) void loadPlayerToolsData(playerRankingLeague);
    }

    function schedulePageKey() {
      return `${schedulePageLeague}|${schedulePageDate}`;
    }

    function schedulePageShiftDate(date, offset) {
      const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(!m) return localISODate();
      const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
      d.setUTCDate(d.getUTCDate()+Number(offset||0));
      return d.toISOString().slice(0,10);
    }

    function schedulePageDateLabel(date) {
      const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(!m) return String(date||'');
      const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
      const weekday=['日','一','二','三','四','五','六'][d.getUTCDay()];
      return `${Number(m[2])}/${Number(m[3])} 週${weekday}`;
    }

    function schedulePageLeagueLabel(league) {
      return ({CPBL:'中職',NPB:'日職'})[league]||league;
    }

    function schedulePageStatusLabel(game, league) {
      const status=String(game?.status||'scheduled').toLowerCase();
      if(status==='final') return '已結束';
      if(status==='live') return String(game?.inningLabel||'').trim()||'比賽中';
      if(status==='suspended') return '暫停';
      if(status==='cancelled'||status==='postponed') {
        return String(game?.postponementReason||game?.cancellationReason||'').trim()
          || (status==='postponed'?'延賽':'取消／延期');
      }
      if((league==='CPBL'||league==='NPB')&&game?.lineupReady) return '先發打序';
      return String(game?.time||'').trim()||'未開打';
    }

    function schedulePageScore(value) {
      if(value===null||value===undefined||value==='') return '—';
      const n=Number(value);
      return Number.isFinite(n)?String(n):'—';
    }

    async function loadSchedulePageGames({force=false}={}) {
      const key=schedulePageKey();
      if(schedulePageLoading.has(key)) return;
      const cached=schedulePageCache.get(key);
      if(!force&&cached&&Date.now()-Number(cached.at||0)<60*1000) return cached;
      schedulePageLoading.add(key);
      schedulePageErrors.delete(key);
      try{
        const games=await leagueDailyGamesRequest(schedulePageLeague,schedulePageDate,force);
        const data={games:Array.isArray(games)?games:[],at:Date.now()};
        schedulePageCache.set(key,data);
        return data;
      }catch(error){
        schedulePageErrors.set(key,error instanceof Error?error.message:String(error));
        return null;
      }finally{
        schedulePageLoading.delete(key);
        if(currentPage==='schedule') renderSchedulePage();
      }
    }

    function renderSchedulePage() {
      if(!els.schedulePageContent) return;
      const key=schedulePageKey();
      const cached=schedulePageCache.get(key)||null;
      const games=Array.isArray(cached?.games)?cached.games:[];
      const loading=schedulePageLoading.has(key);
      const error=schedulePageErrors.get(key)||'';
      const today=localISODate();
      const dateStrip=Array.from({length:7},(_,i)=>schedulePageShiftDate(schedulePageDate,i-3));

      els.schedulePageContent.innerHTML=`
        <div class="schedule-toolbar">
          <div class="schedule-league-tabs">
            ${['CPBL','NPB'].map(league=>`
              <button type="button" class="${league===schedulePageLeague?'active':''}" data-schedule-league="${league}">
                ${schedulePageLeagueLabel(league)}
              </button>`).join('')}
          </div>
          <div class="schedule-date-controls">
            <button type="button" class="schedule-date-arrow" data-schedule-shift="-1" aria-label="前一天">‹</button>
            <label class="schedule-date-picker">
              <span>${schedulePageDate.replaceAll('-','/')}</span>
              <input type="date" value="${escapeHtml(schedulePageDate)}" data-schedule-date />
            </label>
            <button type="button" class="schedule-date-arrow" data-schedule-shift="1" aria-label="後一天">›</button>
            <button type="button" class="schedule-today-btn ${schedulePageDate===today?'active':''}" data-schedule-today>今天</button>
          </div>
        </div>
        <div class="schedule-date-strip">
          ${dateStrip.map(date=>`
            <button type="button" class="${date===schedulePageDate?'active':''} ${date===today?'is-today':''}" data-schedule-date-chip="${date}">
              <span>${schedulePageDateLabel(date).split(' ')[0]}</span>
              <small>${schedulePageDateLabel(date).split(' ')[1]}</small>
            </button>`).join('')}
        </div>
        <div class="schedule-summary">
          <strong>${schedulePageLeagueLabel(schedulePageLeague)}｜${schedulePageDate.replaceAll('-','/')}</strong>
          <span>${cached?games.length+' 場':'讀取中'}</span>
        </div>
        ${loading&&!cached?'<div class="player-tools-empty">正在讀取官方賽程…</div>':''}
        ${error?`<div class="player-tools-error">${escapeHtml(error)}<button type="button" data-schedule-retry>重試</button></div>`:''}
        ${cached?(
          games.length
            ? `<div class="schedule-game-list">${games.map((game,index)=>{
                const status=String(game?.status||'scheduled').toLowerCase();
                const showScore=status==='live'||status==='final'||status==='suspended';
                const away=String(game?.away||'');
                const home=String(game?.home||'');
                const detail=homeGameDetailSupported(schedulePageLeague);
                return `
                  <article class="schedule-game-card status-${escapeHtml(status)} ${detail?'is-detail-enabled':''}" ${detail?`data-schedule-game-index="${index}" role="button" tabindex="0"`:''}>
                    <div class="schedule-game-meta">
                      <span class="schedule-game-status">${escapeHtml(schedulePageStatusLabel(game,schedulePageLeague))}</span>
                      <span>${escapeHtml(String(game?.competitionLabel||game?.venue||''))}</span>
                    </div>
                    <div class="schedule-game-team">
                      <strong>${escapeHtml(away||'客隊')}</strong>
                      <b>${showScore?schedulePageScore(game?.awayScore):'—'}</b>
                    </div>
                    <div class="schedule-game-team">
                      <strong>${escapeHtml(home||'主隊')}</strong>
                      <b>${showScore?schedulePageScore(game?.homeScore):'—'}</b>
                    </div>
                    <div class="schedule-game-footer">
                      <span>${escapeHtml(String(game?.venue||'場地未提供'))}</span>
                      ${detail?'<em>查看對戰 ›</em>':''}
                    </div>
                  </article>`;
              }).join('')}</div>`
            : '<div class="player-tools-empty">這一天沒有賽事。</div>'
        ):''}
      `;

      els.schedulePageContent.querySelectorAll('[data-schedule-league]').forEach(btn=>btn.addEventListener('click',()=>{
        schedulePageLeague=String(btn.dataset.scheduleLeague||'CPBL');
        localStorage.setItem('schedulePageLeague',schedulePageLeague);
        renderSchedulePage();
        void loadSchedulePageGames();
      }));
      els.schedulePageContent.querySelectorAll('[data-schedule-shift]').forEach(btn=>btn.addEventListener('click',()=>{
        schedulePageDate=schedulePageShiftDate(schedulePageDate,Number(btn.dataset.scheduleShift)||0);
        localStorage.setItem('schedulePageDate',schedulePageDate);
        renderSchedulePage();
        void loadSchedulePageGames();
      }));
      els.schedulePageContent.querySelectorAll('[data-schedule-date-chip]').forEach(btn=>btn.addEventListener('click',()=>{
        schedulePageDate=String(btn.dataset.scheduleDateChip||schedulePageDate);
        localStorage.setItem('schedulePageDate',schedulePageDate);
        renderSchedulePage();
        void loadSchedulePageGames();
      }));
      els.schedulePageContent.querySelector('[data-schedule-date]')?.addEventListener('change',event=>{
        const next=String(event.target?.value||'');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
        schedulePageDate=next;
        localStorage.setItem('schedulePageDate',schedulePageDate);
        renderSchedulePage();
        void loadSchedulePageGames();
      });
      els.schedulePageContent.querySelector('[data-schedule-today]')?.addEventListener('click',()=>{
        schedulePageDate=localISODate();
        localStorage.setItem('schedulePageDate',schedulePageDate);
        renderSchedulePage();
        void loadSchedulePageGames();
      });
      els.schedulePageContent.querySelector('[data-schedule-retry]')?.addEventListener('click',()=>{
        schedulePageErrors.delete(key);
        void loadSchedulePageGames({force:true});
      });
      els.schedulePageContent.querySelectorAll('[data-schedule-game-index]').forEach(card=>{
        const open=()=>{
          const index=Number(card.dataset.scheduleGameIndex);
          const game=games[index];
          if(game&&homeGameDetailSupported(schedulePageLeague)) openHomeGameDetail(game,schedulePageLeague,schedulePageDate);
        };
        card.addEventListener('click',open);
        card.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}
        });
      });

      if(!cached&&!loading&&!error) void loadSchedulePageGames();
    }

