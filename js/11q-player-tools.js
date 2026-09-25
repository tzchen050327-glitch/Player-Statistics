    const playerToolsCache = new Map();
    const playerToolsLoading = new Set();
    const playerToolsErrors = new Map();
    let playerRankingLeague = ['cpbl','npb'].includes(localStorage.getItem('playerRankingLeague')) ? localStorage.getItem('playerRankingLeague') : 'cpbl';
    let playerRankingRole = ['hitter','pitcher'].includes(localStorage.getItem('playerRankingRole')) ? localStorage.getItem('playerRankingRole') : 'hitter';
    let playerRankingMetric = localStorage.getItem('playerRankingMetric') || 'avg';
    let playerCompareLeague = ['cpbl','npb'].includes(localStorage.getItem('playerCompareLeague')) ? localStorage.getItem('playerCompareLeague') : 'cpbl';
    let playerCompareRole = ['hitter','pitcher'].includes(localStorage.getItem('playerCompareRole')) ? localStorage.getItem('playerCompareRole') : 'hitter';
    let playerCompareIds = [];

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
        if (currentPage === 'player-compare') renderPlayerComparePage();
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
      const official = data?.leaderboards?.[role]?.[def.key];
      if (Array.isArray(official) && official.length) return official;
      const rateMetric = role === 'hitter'
        ? ['avg','ops','obp','slg'].includes(def.key)
        : ['era','whip'].includes(def.key);
      return [...playerToolsRows(league, role)]
        .filter(row => Number.isFinite(Number(row?.[def.key])))
        .filter(row => !rateMetric || row?.qualifiedRate === true)
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
          <div class="player-tools-note">${playerRankingRole === 'hitter' ? 'AVG／OPS／OBP／SLG 僅列規定打席達標球員；累積項目不限制規定打席。' : 'ERA／WHIP 僅列規定投球局達標投手；W／K／SV／HLD 不限制規定投球局。'}</div>
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

    function playerCompareMetricDefs(role) {
      return role === 'pitcher'
        ? [
            { key:'era', label:'ERA', fmt:'two', lower:true },
            { key:'whip', label:'WHIP', fmt:'two', lower:true },
            { key:'outs', label:'IP', fmt:'ip' },
            { key:'w', label:'W', fmt:'int' },
            { key:'l', label:'L', fmt:'int' },
            { key:'k', label:'K', fmt:'int' },
            { key:'bb', label:'BB', fmt:'int', lower:true },
            { key:'h', label:'H', fmt:'int', lower:true },
            { key:'sv', label:'SV', fmt:'int' },
            { key:'hld', label:'HLD', fmt:'int' }
          ]
        : [
            { key:'avg', label:'AVG', fmt:'three' },
            { key:'obp', label:'OBP', fmt:'three' },
            { key:'slg', label:'SLG', fmt:'three' },
            { key:'ops', label:'OPS', fmt:'three' },
            { key:'h', label:'H', fmt:'int' },
            { key:'hr', label:'HR', fmt:'int' },
            { key:'rbi', label:'RBI', fmt:'int' },
            { key:'bb', label:'BB', fmt:'int' },
            { key:'k', label:'K', fmt:'int', lower:true },
            { key:'sb', label:'SB', fmt:'int' }
          ];
    }

    function playerCompareOptions(rows, selectedId) {
      const teams = [...new Set(rows.map(row => String(row?.team || '')).filter(Boolean))].sort();
      const groups = teams.map(team => {
        const opts = rows.filter(row => String(row?.team || '') === team)
          .sort((a,b) => String(a?.name || '').localeCompare(String(b?.name || '')))
          .map(row => `<option value="${escapeHtml(String(row.id))}" ${String(row.id) === String(selectedId || '') ? 'selected' : ''}>${escapeHtml(String(row.name || ''))}</option>`)
          .join('');
        return `<optgroup label="${escapeHtml(team)}">${opts}</optgroup>`;
      }).join('');
      return `<option value="">＋ 選擇球員</option>${groups}`;
    }

    function playerCompareSelectedRows() {
      const rows = playerToolsRows(playerCompareLeague, playerCompareRole);
      const byId = new Map(rows.map(row => [String(row?.id || ''), row]));
      return playerCompareIds.map(id => byId.get(String(id))).filter(Boolean);
    }

    function playerCompareSummary(selected, defs) {
      if (selected.length < 2) return '';
      const a = selected[0], b = selected[1];
      const picks = playerCompareRole === 'pitcher' ? ['era','whip','k'] : ['ops','hr','k'];
      const lines = [];
      for (const key of picks) {
        const def = defs.find(x => x.key === key);
        if (!def) continue;
        const av = Number(a?.[key]), bv = Number(b?.[key]);
        if (!Number.isFinite(av) || !Number.isFinite(bv) || av === bv) continue;
        const betterA = def.lower ? av < bv : av > bv;
        const leader = betterA ? a : b;
        const diff = Math.abs(av - bv);
        const diffText = def.fmt === 'three' ? diff.toFixed(3).replace(/^0/,'') : def.fmt === 'two' ? diff.toFixed(2) : String(Math.round(diff));
        lines.push(`<span><strong>${escapeHtml(def.label)}</strong>：${escapeHtml(String(leader?.name || ''))} ${def.lower ? '低' : '多'} ${diffText}</span>`);
      }
      return lines.length ? `<div class="player-compare-summary"><b>差異摘要</b>${lines.join('')}</div>` : '';
    }

    function renderPlayerComparePage() {
      if (!els.playerComparePageContent) return;
      const key = playerToolsKey(playerCompareLeague);
      const data = playerToolsData(playerCompareLeague);
      const loading = playerToolsLoading.has(key);
      const error = playerToolsErrors.get(key) || '';
      const rows = data ? playerToolsRows(playerCompareLeague, playerCompareRole) : [];
      const validIds = new Set(rows.map(row => String(row?.id || '')));
      playerCompareIds = playerCompareIds.filter(id => validIds.has(String(id))).slice(0,4);
      const selected = playerCompareSelectedRows();
      const defs = playerCompareMetricDefs(playerCompareRole);
      const slots = Array.from({length:4}, (_,index) => playerCompareIds[index] || '');

      els.playerComparePageContent.innerHTML = `
        <div class="player-tools-switch-group">
          <div class="player-tools-switch-row">${playerToolsLeagueButtons(playerCompareLeague,'data-player-compare-league')}</div>
          <div class="player-tools-switch-row">${playerToolsRoleButtons(playerCompareRole,'data-player-compare-role')}</div>
        </div>
        ${loading && !data ? '<div class="player-tools-empty">正在讀取官方球季數據…</div>' : ''}
        ${error ? `<div class="player-tools-error">${escapeHtml(error)}<button type="button" data-player-tools-retry="compare">重試</button></div>` : ''}
        ${data ? `
          <div class="player-compare-selectors">
            ${slots.map((id,index) => `<label><span>球員 ${index+1}</span><select data-player-compare-slot="${index}">${playerCompareOptions(rows,id)}</select></label>`).join('')}
          </div>
          <div class="player-compare-grid">
            <div class="player-compare-labels">
              <strong>指標</strong>
              ${defs.map(def => `<span>${def.label}</span>`).join('')}
            </div>
            <div class="player-compare-players">
              ${selected.length ? selected.map(row => `
                <div class="player-compare-column">
                  <strong title="${escapeHtml(String(row?.name || ''))}">${escapeHtml(String(row?.name || '—'))}<small>${escapeHtml(String(row?.team || ''))}</small></strong>
                  ${defs.map(def => `<span>${playerToolsFormat(row?.[def.key],def.fmt)}</span>`).join('')}
                </div>`).join('') : '<div class="player-tools-empty player-compare-empty">請先選擇至少兩名球員。</div>'}
            </div>
          </div>
          ${playerCompareSummary(selected, defs)}
          <div class="player-tools-note">比較頁保留所有有一軍球季成績的球員，不套用排行資格門檻。</div>
        ` : ''}
      `;

      els.playerComparePageContent.querySelectorAll('[data-player-compare-league]').forEach(btn => btn.addEventListener('click', () => {
        playerCompareLeague = String(btn.dataset.playerCompareLeague || 'cpbl');
        playerCompareIds = [];
        localStorage.setItem('playerCompareLeague', playerCompareLeague);
        renderPlayerComparePage();
        void loadPlayerToolsData(playerCompareLeague);
      }));
      els.playerComparePageContent.querySelectorAll('[data-player-compare-role]').forEach(btn => btn.addEventListener('click', () => {
        playerCompareRole = String(btn.dataset.playerCompareRole || 'hitter');
        playerCompareIds = [];
        localStorage.setItem('playerCompareRole', playerCompareRole);
        renderPlayerComparePage();
      }));
      els.playerComparePageContent.querySelectorAll('[data-player-compare-slot]').forEach(select => select.addEventListener('change', () => {
        const index = Number(select.dataset.playerCompareSlot);
        const value = String(select.value || '');
        const next = [...playerCompareIds];
        if (value) {
          next[index] = value;
          playerCompareIds = next.filter((id,i) => id && next.indexOf(id) === i).slice(0,4);
        } else {
          next[index] = '';
          playerCompareIds = next.filter(Boolean).slice(0,4);
        }
        renderPlayerComparePage();
      }));
      els.playerComparePageContent.querySelector('[data-player-tools-retry="compare"]')?.addEventListener('click', () => {
        playerToolsErrors.delete(key);
        void loadPlayerToolsData(playerCompareLeague, { force:true });
      });

      if (!data && !loading && !error) void loadPlayerToolsData(playerCompareLeague);
    }
