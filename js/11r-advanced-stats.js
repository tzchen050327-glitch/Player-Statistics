    let advancedStatsSearchTimer = 0;
    let advancedStatsSearchSeq = 0;
    let advancedStatsSuggestions = [];
    let advancedStatsSearchQuery = '';
    let advancedStatsSelectedPlayer = null;
    let advancedStatsRecentPlayers = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('advancedStatsRecentPlayers') || '[]');
        return Array.isArray(raw)
          ? raw.filter(item => item && item.acnt && item.name).slice(0, 8)
          : [];
      } catch {
        return [];
      }
    })();
    let advancedStatsRows = [];
    let advancedStatsLoading = false;
    let advancedStatsError = '';
    let advancedStatsGroup = '10';
    let advancedStatsPeriod = CURRENT_YEAR;

    const ADVANCED_STATS_GROUPS = [
      ['10', '打序'],
      ['4', '壘包情況'],
      ['5', '出局數'],
      ['3', '對戰類型'],
      ['1', '主客場'],
      ['6', '局數'],
      ['7', '比分'],
      ['8', '月份'],
      ['9', '球場']
    ];
    const ADVANCED_STATS_GROUP_LABELS = Object.fromEntries(ADVANCED_STATS_GROUPS);

    function advancedStatsRememberPlayer(player) {
      const acnt = String(player?.acnt || '').trim();
      const name = String(player?.name || '').trim();
      if (!acnt || !name) return;
      const next = {
        acnt,
        name,
        number:String(player?.number || '').trim(),
        team:String(player?.team || '').trim(),
        position:String(player?.position || '').trim(),
        isPitcher:Boolean(player?.isPitcher)
      };
      advancedStatsRecentPlayers = [
        next,
        ...advancedStatsRecentPlayers.filter(item => String(item?.acnt || '') !== acnt)
      ].slice(0, 8);
      try {
        localStorage.setItem('advancedStatsRecentPlayers', JSON.stringify(advancedStatsRecentPlayers));
      } catch {}
    }

    function advancedStatsNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }

    function advancedStatsRate(value, digits = 4) {
      if (value === '' || value === null || value === undefined) return '—';
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      return n.toFixed(digits).replace(/^0(?=\.)/, '');
    }

    function advancedStatsPitchRate(value) {
      if (value === '' || value === null || value === undefined) return '—';
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(2) : '—';
    }

    function advancedStatsInnings(row) {
      const whole = Math.max(0, Math.floor(advancedStatsNumber(row?.InningPitchedCnt)));
      const third = Math.max(0, Math.min(2, Math.floor(advancedStatsNumber(row?.InningPitchedDiv3Cnt))));
      return `${whole}.${third}`;
    }

    function advancedStatsAvailableGroups() {
      const seen = new Set(advancedStatsRows.map(row => String(row?.ItemGroupCode ?? '')).filter(Boolean));
      const known = ADVANCED_STATS_GROUPS.filter(([code]) => seen.has(code)).map(([code]) => code);
      const unknown = [...seen].filter(code => !ADVANCED_STATS_GROUP_LABELS[code]).sort((a,b) => Number(a) - Number(b));
      return [...known, ...unknown];
    }

    function advancedStatsGroupLabel(code) {
      return ADVANCED_STATS_GROUP_LABELS[String(code)] || `分項 ${code}`;
    }

    function advancedStatsRowsForGroup() {
      return advancedStatsRows.filter(row => String(row?.ItemGroupCode ?? '') === String(advancedStatsGroup));
    }

    function advancedStatsRenderSuggestions(stateText = '') {
      const box = document.getElementById('advancedStatsSearchResults');
      if (!box) return;
      const input = document.getElementById('advancedStatsSearchInput');
      input?.setAttribute('aria-expanded', advancedStatsSearchQuery ? 'true' : 'false');
      if (!advancedStatsSearchQuery) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
      }
      if (stateText) {
        box.innerHTML = `<div class="advanced-stats-search-state">${escapeHtml(stateText)}</div>`;
        box.classList.remove('hidden');
        return;
      }
      if (!advancedStatsSuggestions.length) {
        box.innerHTML = '<div class="advanced-stats-search-state">找不到符合的中職球員</div>';
        box.classList.remove('hidden');
        return;
      }
      box.innerHTML = advancedStatsSuggestions.map((item,index) => `
        <button type="button" class="advanced-stats-search-result" data-advanced-stats-player="${index}">
          <strong>${escapeHtml(item.name || '未命名球員')}</strong>
          <span>CPBL 官方球員</span>
        </button>
      `).join('');
      box.classList.remove('hidden');

      box.querySelectorAll('[data-advanced-stats-player]').forEach(button => {
        button.addEventListener('click', () => {
          const item = advancedStatsSuggestions[Number(button.dataset.advancedStatsPlayer)];
          if (item) void advancedStatsSelectPlayer(item);
        });
      });
    }

    async function advancedStatsRequestSuggestions(query, { selectExact = false } = {}) {
      const clean = String(query || '').trim();
      if (!clean) return;
      const requestId = ++advancedStatsSearchSeq;
      advancedStatsSearchQuery = clean;
      advancedStatsRenderSuggestions('搜尋中職球員…');
      try {
        const data = await cpblRequest('suggest-players', { query: clean, limit: 12 });
        if (requestId !== advancedStatsSearchSeq) return;
        advancedStatsSuggestions = Array.isArray(data?.players)
          ? data.players.map(item => ({
              acnt:String(item?.acnt || ''),
              name:String(item?.name || '').trim()
            })).filter(item => item.acnt && item.name)
          : [];
        if (selectExact) {
          const exact = advancedStatsSuggestions.find(item => item.name === clean)
            || (advancedStatsSuggestions.length === 1 ? advancedStatsSuggestions[0] : null);
          if (exact) {
            void advancedStatsSelectPlayer(exact);
            return;
          }
        }
        advancedStatsRenderSuggestions();
      } catch (error) {
        if (requestId !== advancedStatsSearchSeq) return;
        advancedStatsSuggestions = [];
        advancedStatsRenderSuggestions(error?.message || '球員搜尋失敗');
      }
    }

    async function advancedStatsLoadSplits() {
      const player = advancedStatsSelectedPlayer;
      if (!player?.acnt) return;
      const requestId = ++advancedStatsSearchSeq;
      advancedStatsLoading = true;
      advancedStatsError = '';
      renderAdvancedStatsPage();
      try {
        const position = player.isPitcher ? '02' : '01';
        const data = await cpblRequest('advanced-splits', {
          acnt: player.acnt,
          year: advancedStatsPeriod,
          kindCode: 'A',
          position
        });
        if (requestId !== advancedStatsSearchSeq) return;
        advancedStatsRows = Array.isArray(data?.splits?.rows) ? data.splits.rows : [];
        const groups = advancedStatsAvailableGroups();
        if (!groups.includes(String(advancedStatsGroup))) {
          advancedStatsGroup = groups.includes('10') ? '10' : (groups[0] || '');
        }
      } catch (error) {
        if (requestId !== advancedStatsSearchSeq) return;
        advancedStatsRows = [];
        advancedStatsError = error?.message || '中職分項成績讀取失敗。';
      } finally {
        if (requestId === advancedStatsSearchSeq) {
          advancedStatsLoading = false;
          renderAdvancedStatsPage();
        }
      }
    }

    async function advancedStatsSelectPlayer(item) {
      const acnt = String(item?.acnt || '').trim();
      if (!acnt) return;
      advancedStatsSearchSeq++;
      if (advancedStatsSearchTimer) clearTimeout(advancedStatsSearchTimer);
      advancedStatsSuggestions = [];
      advancedStatsSearchQuery = String(item?.name || '').trim();
      advancedStatsSelectedPlayer = {
        acnt,
        name:advancedStatsSearchQuery,
        number:'',
        team:'',
        position:'',
        isPitcher:false
      };
      advancedStatsRows = [];
      advancedStatsError = '';
      advancedStatsLoading = true;
      renderAdvancedStatsPage();

      const requestId = ++advancedStatsSearchSeq;
      try {
        const data = await cpblRequest('player-profile', { acnt });
        if (requestId !== advancedStatsSearchSeq) return;
        const official = data?.player || {};
        const position = String(official.position || '').trim();
        advancedStatsSelectedPlayer = {
          acnt,
          name:String(official.name || item?.name || '').trim(),
          number:String(official.number || '').trim(),
          team:normalizeTeamName(String(official.team || '').trim()),
          position,
          isPitcher:/投手/.test(position)
        };
        advancedStatsSearchQuery = advancedStatsSelectedPlayer.name;
        advancedStatsRememberPlayer(advancedStatsSelectedPlayer);
        advancedStatsLoading = false;
        await advancedStatsLoadSplits();
      } catch (error) {
        if (requestId !== advancedStatsSearchSeq) return;
        advancedStatsLoading = false;
        advancedStatsError = error?.message || '球員資料讀取失敗。';
        renderAdvancedStatsPage();
      }
    }

    function advancedStatsHitterTable(rows) {
      return `
        <div class="advanced-stats-table-wrap">
          <table class="advanced-stats-table">
            <thead><tr>
              <th>分項</th><th>PA</th><th>AB</th><th>H</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th><th>HR</th><th>RBI</th><th>BB</th><th>K</th>
            </tr></thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <th>${escapeHtml(String(row?.ItemName || '—').trim())}</th>
                  <td>${advancedStatsNumber(row?.PlateAppearances)}</td>
                  <td>${advancedStatsNumber(row?.HitCnt)}</td>
                  <td>${advancedStatsNumber(row?.HittingCnt)}</td>
                  <td class="is-rate">${advancedStatsRate(row?.Avg)}</td>
                  <td class="is-rate">${advancedStatsRate(row?.Obp)}</td>
                  <td class="is-rate">${advancedStatsRate(row?.Slg)}</td>
                  <td class="is-rate">${advancedStatsRate(row?.Ops, 3)}</td>
                  <td>${advancedStatsNumber(row?.HomeRunCnt)}</td>
                  <td>${advancedStatsNumber(row?.RunBattedINCnt)}</td>
                  <td>${advancedStatsNumber(row?.BasesONBallsCnt)}</td>
                  <td>${advancedStatsNumber(row?.StrikeOutCnt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function advancedStatsPitcherTable(rows) {
      const suppressedGroups = new Set(['3','5','6','7','8']);
      const officialOrDash = (row, value, formatter = advancedStatsNumber) => (
        suppressedGroups.has(String(row?.ItemGroupCode ?? '')) ? '—' : formatter(value)
      );
      return `
        <div class="advanced-stats-table-wrap">
          <table class="advanced-stats-table advanced-stats-pitcher-table">
            <thead><tr>
              <th>分項</th><th>W</th><th>L</th><th>ERA</th><th>SP</th><th>SV</th><th>IP</th><th>PA</th><th>H</th><th>HR</th><th>HBP</th><th>BB</th><th>K</th><th>R</th><th>ER</th><th>AVG</th><th>WHIP</th>
            </tr></thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <th>${escapeHtml(String(row?.ItemName || '—').trim())}</th>
                  <td>${officialOrDash(row, row?.GameResultWCnt)}</td>
                  <td>${officialOrDash(row, row?.GameResultLCnt)}</td>
                  <td class="is-rate">${officialOrDash(row, row?.Era, advancedStatsPitchRate)}</td>
                  <td>${officialOrDash(row, row?.SPCnt)}</td>
                  <td>${officialOrDash(row, row?.SaveOKCnt)}</td>
                  <td>${advancedStatsInnings(row)}</td>
                  <td>${advancedStatsNumber(row?.PlateAppearances)}</td>
                  <td>${advancedStatsNumber(row?.HittingCnt)}</td>
                  <td>${advancedStatsNumber(row?.HomeRunCnt)}</td>
                  <td>${advancedStatsNumber(row?.HitBYPitchCnt)}</td>
                  <td>${advancedStatsNumber(row?.BasesONBallsCnt)}</td>
                  <td>${advancedStatsNumber(row?.StrikeOutCnt)}</td>
                  <td>${officialOrDash(row, row?.RunCnt)}</td>
                  <td>${officialOrDash(row, row?.EarnedRunCnt)}</td>
                  <td class="is-rate">${advancedStatsRate(row?.Avg)}</td>
                  <td class="is-rate">${officialOrDash(row, row?.Whip, advancedStatsPitchRate)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function advancedStatsBindSearch() {
      const input = document.getElementById('advancedStatsSearchInput');
      if (!input) return;
      const unlockSearchInput = () => {
        if (!input.hasAttribute('readonly')) return;
        requestAnimationFrame(() => input.removeAttribute('readonly'));
      };
      input.addEventListener('pointerdown', unlockSearchInput, { once:true });
      input.addEventListener('focus', unlockSearchInput, { once:true });
      input.addEventListener('input', () => {
        advancedStatsSearchQuery = String(input.value || '').trim();
        advancedStatsSuggestions = [];
        advancedStatsSearchSeq++;
        if (advancedStatsSearchTimer) clearTimeout(advancedStatsSearchTimer);
        if (!advancedStatsSearchQuery) {
          advancedStatsRenderSuggestions();
          return;
        }
        advancedStatsRenderSuggestions('搜尋中職球員…');
        const query = advancedStatsSearchQuery;
        advancedStatsSearchTimer = setTimeout(() => {
          void advancedStatsRequestSuggestions(query);
        }, 280);
      });
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (advancedStatsSearchTimer) clearTimeout(advancedStatsSearchTimer);
        const query = String(input.value || '').trim();
        if (query) void advancedStatsRequestSuggestions(query, { selectExact:true });
      });
      input.addEventListener('focus', () => {
        if (advancedStatsSearchQuery && (advancedStatsSuggestions.length || document.getElementById('advancedStatsSearchResults')?.innerHTML)) {
          advancedStatsRenderSuggestions();
        }
      });
    }

    function advancedStatsBindContent() {
      document.querySelectorAll('[data-advanced-stats-recent]').forEach(button => {
        button.addEventListener('click', () => {
          const player = advancedStatsRecentPlayers.find(item => String(item?.acnt || '') === String(button.dataset.advancedStatsRecent || ''));
          if (player && !advancedStatsLoading) void advancedStatsSelectPlayer(player);
        });
      });
      document.querySelectorAll('[data-advanced-stats-group]').forEach(button => {
        button.addEventListener('click', () => {
          advancedStatsGroup = String(button.dataset.advancedStatsGroup || '');
          renderAdvancedStatsPage();
        });
      });
      document.querySelectorAll('[data-advanced-stats-period]').forEach(button => {
        button.addEventListener('click', () => {
          const raw = String(button.dataset.advancedStatsPeriod || '');
          const next = raw === 'career' ? 9999 : CURRENT_YEAR;
          if (next === advancedStatsPeriod || advancedStatsLoading) return;
          advancedStatsPeriod = next;
          void advancedStatsLoadSplits();
        });
      });
      document.getElementById('advancedStatsRetryBtn')?.addEventListener('click', () => {
        void advancedStatsLoadSplits();
      });
    }

    function renderAdvancedStatsPage() {
      if (!els.advancedStatsPageContent) return;
      const player = advancedStatsSelectedPlayer;
      const periodLabel = advancedStatsPeriod === 9999 ? '生涯' : `${CURRENT_YEAR} 球季`;
      const groups = advancedStatsAvailableGroups();
      if (groups.length && !groups.includes(String(advancedStatsGroup))) {
        advancedStatsGroup = groups.includes('10') ? '10' : groups[0];
      }
      const groupRows = advancedStatsRowsForGroup();

      els.advancedStatsPageContent.innerHTML = `
        <section class="advanced-stats-search-card">
          <div class="advanced-stats-search-copy">
            <strong>搜尋中職球員</strong>
            <span>輸入姓名，直接讀取 CPBL 官方分項成績。</span>
          </div>
          <div class="advanced-stats-search-wrap">
            <input id="advancedStatsSearchInput" name="dsAdvancedPlayerSearch" type="search" role="searchbox" aria-controls="advancedStatsSearchResults" aria-expanded="false" autocomplete="one-time-code" inputmode="search" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" readonly data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-protonpass-ignore="true" data-form-type="other" data-purpose="search" placeholder="輸入球員姓名" value="${escapeHtml(advancedStatsSearchQuery)}" />
            <div id="advancedStatsSearchResults" class="advanced-stats-search-results hidden" role="listbox"></div>
          </div>
        </section>

        ${advancedStatsRecentPlayers.length ? `
          <section class="advanced-stats-recent">
            <div class="advanced-stats-recent-head">
              <strong>最近查過</strong>
              <span>直接點球員即可開啟</span>
            </div>
            <div class="advanced-stats-recent-list">
              ${advancedStatsRecentPlayers.map(item => `
                <button type="button" class="${String(player?.acnt || '') === String(item.acnt) ? 'active' : ''}" data-advanced-stats-recent="${escapeHtml(item.acnt)}">
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>${escapeHtml([item.number ? '#' + item.number : '', item.team, item.position].filter(Boolean).join('｜') || 'CPBL')}</small>
                </button>
              `).join('')}
            </div>
          </section>
        ` : ''}

        ${player ? `
          <section class="advanced-stats-player-card">
            <div class="advanced-stats-player-main">
              <span class="advanced-stats-player-kicker">CPBL OFFICIAL</span>
              <strong>${player.number ? `#${escapeHtml(player.number)} ` : ''}${escapeHtml(player.name || '中職球員')}</strong>
              <small>${escapeHtml([player.team, player.position].filter(Boolean).join('｜') || 'CPBL')}</small>
            </div>
            <div class="advanced-stats-period" aria-label="統計期間">
              <button type="button" class="${advancedStatsPeriod === CURRENT_YEAR ? 'active' : ''}" data-advanced-stats-period="season">${CURRENT_YEAR}</button>
              <button type="button" class="${advancedStatsPeriod === 9999 ? 'active' : ''}" data-advanced-stats-period="career">生涯</button>
            </div>
          </section>
        ` : ''}

        ${advancedStatsLoading ? `
          <div class="player-tools-empty">正在讀取 CPBL 官方分項成績…</div>
        ` : advancedStatsError ? `
          <div class="player-tools-error">${escapeHtml(advancedStatsError)} <button id="advancedStatsRetryBtn" class="press-btn" type="button">重試</button></div>
        ` : player && !advancedStatsRows.length ? `
          <div class="player-tools-empty">${escapeHtml(periodLabel)}沒有可顯示的官方分項資料。</div>
        ` : player ? `
          <div class="advanced-stats-group-tabs" aria-label="分項類型">
            ${groups.map(code => `
              <button type="button" class="${String(code) === String(advancedStatsGroup) ? 'active' : ''}" data-advanced-stats-group="${escapeHtml(code)}">
                ${escapeHtml(advancedStatsGroupLabel(code))}
              </button>
            `).join('')}
          </div>
          <div class="advanced-stats-source">
            <span>${escapeHtml(periodLabel)}｜一軍例行賽</span>
            <span>來源：CPBL 官方分項成績</span>
          </div>
          ${groupRows.length
            ? (player.isPitcher ? advancedStatsPitcherTable(groupRows) : advancedStatsHitterTable(groupRows))
            : '<div class="player-tools-empty">這個分項沒有資料。</div>'}
        ` : `
          <div class="advanced-stats-empty">
            <strong>直接搜尋，不需要先把球員加入首頁</strong>
            <span>可查看打序、壘包情況、出局數、對戰類型、主客場、局數、比分、月份與球場等官方切分。</span>
          </div>
        `}
      `;

      advancedStatsBindSearch();
      advancedStatsBindContent();
    }
