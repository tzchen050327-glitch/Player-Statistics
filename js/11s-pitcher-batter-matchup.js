    const PITCHER_BATTER_TEAMS = [
      { code:'AAA', name:'味全龍' },
      { code:'ACN', name:'中信兄弟' },
      { code:'ADD', name:'統一獅' },
      { code:'AEO', name:'富邦悍將' },
      { code:'AJL', name:'樂天桃猿' },
      { code:'AKP', name:'台鋼雄鷹' }
    ];

    let pitcherBatterTeam = '';
    let pitcherBatterRoster = [];
    let pitcherBatterRosterLoading = false;
    let pitcherBatterRosterError = '';
    let pitcherBatterPlayerAcnt = '';
    let pitcherBatterPlayerProfile = null;
    let pitcherBatterYears = [];
    let pitcherBatterOpponent = '';
    let pitcherBatterYear = 9999;
    let pitcherBatterRows = [];
    let pitcherBatterLoading = false;
    let pitcherBatterError = '';
    let pitcherBatterHasQueried = false;
    let pitcherBatterSeq = 0;
    let pitcherBatterPlayerQuery = '';
    let pitcherBatterPlayerOpen = false;
    let pitcherBatterSource = '';
    let pitcherBatterHistoricalUnavailable = false;

    function pitcherBatterTeamName(code) {
      return PITCHER_BATTER_TEAMS.find(item => item.code === String(code || '').slice(0,3))?.name || '';
    }

    function pitcherBatterCleanName(value) {
      return String(value || '').replace(/^[#＃*＊\s]+/, '').trim();
    }

    function pitcherBatterRate(value, digits = 3) {
      if (value === null || value === undefined || value === '') return '—';
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      return n.toFixed(digits).replace(/^0(?=\.)/, '');
    }

    function pitcherBatterPct(value) {
      if (value === null || value === undefined || value === '') return '—';
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      return n.toFixed(2);
    }

    function pitcherBatterNum(row, key) {
      const n = Number(row?.[key]);
      return Number.isFinite(n) ? n : 0;
    }

    function pitcherBatterSelectedRosterPlayer() {
      return pitcherBatterRoster.find(item => String(item.acnt) === String(pitcherBatterPlayerAcnt)) || null;
    }

    function pitcherBatterRole() {
      const position = String(pitcherBatterPlayerProfile?.position || '');
      const roster = pitcherBatterSelectedRosterPlayer();
      if (/投手/.test(position)) return 'pitching';
      if (roster?.role === 'pitcher') return 'pitching';
      return 'batting';
    }

    function pitcherBatterFilteredPlayers() {
      const query = pitcherBatterCleanName(pitcherBatterPlayerQuery).toLocaleLowerCase('zh-Hant');
      const list = query
        ? pitcherBatterRoster.filter(item => pitcherBatterCleanName(item.name).toLocaleLowerCase('zh-Hant').includes(query))
        : pitcherBatterRoster;
      return list.slice(0, 14);
    }

    function pitcherBatterPlayerRoleLabel(player) {
      if (player?.role === 'pitcher') return '投手';
      if (player?.role === 'hitter') return '打者';
      if (player?.role === 'two-way') return '投打';
      return '球員';
    }

    function pitcherBatterRenderPlayerResults() {
      const box = document.getElementById('pitcherBatterPlayerResults');
      if (!box) return;
      const input = document.getElementById('pitcherBatterPlayerSearch');
      const players = pitcherBatterFilteredPlayers();
      const open = pitcherBatterPlayerOpen && pitcherBatterTeam && !pitcherBatterRosterLoading;
      box.classList.toggle('hidden', !open);
      input?.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) return;
      box.innerHTML = pitcherBatterRosterError
        ? `<div class="pitcher-batter-search-empty">${escapeHtml(pitcherBatterRosterError)}</div>`
        : !pitcherBatterRoster.length
          ? '<div class="pitcher-batter-search-empty">目前沒有可選球員。</div>'
          : !players.length
            ? `<div class="pitcher-batter-search-empty">找不到「${escapeHtml(pitcherBatterPlayerQuery)}」</div>`
            : players.map(item => `
                <button type="button" class="pitcher-batter-player-option ${String(item.acnt) === String(pitcherBatterPlayerAcnt) ? 'active' : ''}" data-pitcher-batter-player="${escapeHtml(item.acnt)}">
                  <span>
                    <strong>${escapeHtml(item.name)}</strong>
                    <small>${escapeHtml(pitcherBatterPlayerRoleLabel(item))}</small>
                  </span>
                  <em>${String(item.acnt) === String(pitcherBatterPlayerAcnt) ? '已選' : '選擇'}</em>
                </button>
              `).join('');
      box.querySelectorAll('[data-pitcher-batter-player]').forEach(button => {
        button.addEventListener('click', () => {
          const player = pitcherBatterRoster.find(item => String(item.acnt) === String(button.dataset.pitcherBatterPlayer || ''));
          if (!player) return;
          pitcherBatterPlayerQuery = player.name;
          pitcherBatterPlayerOpen = false;
          void pitcherBatterLoadPlayer(player.acnt);
        });
      });
    }

    function pitcherBatterIsPitcher() {
      const position = String(pitcherBatterPlayerProfile?.position || '');
      if (/投手/.test(position)) return true;
      if (pitcherBatterRows.some(row => String(row?.PitcherAcnt || '') === String(pitcherBatterPlayerAcnt))) return true;
      if (pitcherBatterRows.some(row => String(row?.HitterAcnt || '') === String(pitcherBatterPlayerAcnt))) return false;
      const roster = pitcherBatterSelectedRosterPlayer();
      return roster?.role === 'pitcher';
    }

    async function pitcherBatterLoadRoster(teamCode) {
      const team = String(teamCode || '').slice(0,3);
      if (!team) return;
      const seq = ++pitcherBatterSeq;
      pitcherBatterRosterLoading = true;
      pitcherBatterRosterError = '';
      pitcherBatterRoster = [];
      pitcherBatterPlayerAcnt = '';
      pitcherBatterPlayerProfile = null;
      pitcherBatterPlayerQuery = '';
      pitcherBatterPlayerOpen = false;
      pitcherBatterYears = [];
      pitcherBatterOpponent = '';
      pitcherBatterYear = 9999;
      pitcherBatterRows = [];
      pitcherBatterError = '';
      pitcherBatterSource = '';
      pitcherBatterHistoricalUnavailable = false;
      pitcherBatterHasQueried = false;
      renderPitcherBatterPage();
      try {
        const data = await cpblRequest('team-roster', { teamCode:team, year:CURRENT_YEAR });
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterRoster = (Array.isArray(data?.roster?.players) ? data.roster.players : [])
          .map(item => ({
            acnt:String(item?.acnt || ''),
            name:pitcherBatterCleanName(item?.name),
            role:String(item?.role || '')
          }))
          .filter(item => item.acnt && item.name)
          .sort((a,b) => a.name.localeCompare(b.name,'zh-Hant'));
      } catch (error) {
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterRosterError = error?.message || '球隊名單讀取失敗。';
      } finally {
        if (seq === pitcherBatterSeq) {
          pitcherBatterRosterLoading = false;
          renderPitcherBatterPage();
        }
      }
    }

    async function pitcherBatterLoadPlayer(acnt) {
      const id = String(acnt || '').trim();
      if (!id) return;
      const seq = ++pitcherBatterSeq;
      const rosterPlayer = pitcherBatterRoster.find(item => String(item.acnt) === id) || null;
      pitcherBatterPlayerAcnt = id;
      pitcherBatterPlayerQuery = rosterPlayer?.name || pitcherBatterPlayerQuery;
      pitcherBatterPlayerOpen = false;
      pitcherBatterPlayerProfile = rosterPlayer ? {
        acnt:id,
        name:rosterPlayer.name,
        position:rosterPlayer.role === 'pitcher' ? '投手' : ''
      } : null;
      pitcherBatterYears = [CURRENT_YEAR];
      pitcherBatterOpponent = '';
      pitcherBatterYear = 9999;
      pitcherBatterRows = [];
      pitcherBatterError = '';
      pitcherBatterSource = '';
      pitcherBatterHistoricalUnavailable = false;
      pitcherBatterHasQueried = false;
      renderPitcherBatterPage();
      try {
        const profileData = await cpblRequest('player-profile', { acnt:id });
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterPlayerProfile = profileData?.player || pitcherBatterPlayerProfile;
        const debut = Math.max(1990, Math.min(CURRENT_YEAR, Number(pitcherBatterPlayerProfile?.debutYear) || CURRENT_YEAR));
        pitcherBatterYears = Array.from({ length:CURRENT_YEAR - debut + 1 }, (_, index) => CURRENT_YEAR - index);
        pitcherBatterPlayerQuery = pitcherBatterCleanName(pitcherBatterPlayerProfile?.name || rosterPlayer?.name || pitcherBatterPlayerQuery);
      } catch (error) {
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterYears = [CURRENT_YEAR];
      } finally {
        if (seq === pitcherBatterSeq) renderPitcherBatterPage();
      }
    }

    async function pitcherBatterQuery() {
      if (!pitcherBatterPlayerAcnt || !pitcherBatterOpponent) return;
      const seq = ++pitcherBatterSeq;
      pitcherBatterLoading = true;
      pitcherBatterError = '';
      pitcherBatterRows = [];
      pitcherBatterSource = '';
      pitcherBatterHistoricalUnavailable = false;
      pitcherBatterHasQueried = true;
      renderPitcherBatterPage();
      try {
        const data = await cpblRequest('fighting-score', {
          acnt:pitcherBatterPlayerAcnt,
          year:pitcherBatterYear,
          kindCode:'A',
          fightingTeamNo:pitcherBatterOpponent,
          role:pitcherBatterRole()
        });
        if (seq !== pitcherBatterSeq) return;
        const matchup = data?.matchup || {};
        pitcherBatterRows = Array.isArray(matchup?.rows) ? matchup.rows : [];
        pitcherBatterSource = String(matchup?.source || '');
        pitcherBatterHistoricalUnavailable = Boolean(matchup?.historicalUnavailable);
      } catch (error) {
        if (seq !== pitcherBatterSeq) return;
        const message = String(error?.message || '');
        pitcherBatterError = /(?:404|CPBL GET|redirect)/i.test(message)
          ? 'CPBL 投打對決目前連線異常，請稍後再試。'
          : (message || '投打對決資料讀取失敗。');
      } finally {
        if (seq === pitcherBatterSeq) {
          pitcherBatterLoading = false;
          renderPitcherBatterPage();
        }
      }
    }

    function pitcherBatterHitterTable(rows) {
      return `
        <div class="pitcher-batter-table-wrap">
          <table class="pitcher-batter-table">
            <thead>
              <tr>
                <th>對戰投手</th><th>PA</th><th>AB</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>AVG</th><th>OBP</th><th>BB</th><th>IBB</th><th>HBP</th><th>K</th><th>GO/AO</th><th>好球率</th><th>壞球率</th><th>揮棒率</th><th>首球揮棒</th><th>揮空率</th><th>GB%</th><th>LD%</th><th>FB%</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <th>
                    <strong>${escapeHtml(pitcherBatterCleanName(row?.PitcherName) || '—')}</strong>
                    <small>${escapeHtml(String(row?.PitcherTeamName || pitcherBatterTeamName(pitcherBatterOpponent) || ''))}</small>
                  </th>
                  <td>${pitcherBatterNum(row,'PlateAppearances')}</td>
                  <td>${pitcherBatterNum(row,'HitCnt')}</td>
                  <td>${pitcherBatterNum(row,'HittingCnt')}</td>
                  <td>${pitcherBatterNum(row,'TwoBaseHitCnt')}</td>
                  <td>${pitcherBatterNum(row,'ThreeBaseHitCnt')}</td>
                  <td>${pitcherBatterNum(row,'HomeRunCnt')}</td>
                  <td>${pitcherBatterNum(row,'RunBattedINCnt')}</td>
                  <td class="is-rate">${pitcherBatterRate(row?.Avg)}</td>
                  <td class="is-rate">${pitcherBatterRate(row?.Obp)}</td>
                  <td>${pitcherBatterNum(row,'BasesONBallsCnt')}</td>
                  <td>${pitcherBatterNum(row,'IntentionalBasesONBallsCnt')}</td>
                  <td>${pitcherBatterNum(row,'HitBYPitchCnt')}</td>
                  <td>${pitcherBatterNum(row,'StrikeOutCnt')}</td>
                  <td>${pitcherBatterRate(row?.Goao)}</td>
                  <td>${pitcherBatterPct(row?.Strike_Pct)}</td>
                  <td>${pitcherBatterPct(row?.Ball_Pct)}</td>
                  <td>${pitcherBatterPct(row?.Swing_Pct)}</td>
                  <td>${pitcherBatterPct(row?.First_Pitch_Swing_Pct)}</td>
                  <td>${pitcherBatterPct(row?.Whiff_Pct)}</td>
                  <td>${pitcherBatterPct(row?.GB_Pct)}</td>
                  <td>${pitcherBatterPct(row?.LD_Pct)}</td>
                  <td>${pitcherBatterPct(row?.FB_Pct)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    function pitcherBatterPitcherTable(rows) {
      return `
        <div class="pitcher-batter-table-wrap">
          <table class="pitcher-batter-table pitcher-batter-pitcher-table">
            <thead>
              <tr>
                <th>對戰打者</th><th>PA</th><th>H</th><th>HR</th><th>HBP</th><th>BB</th><th>IBB</th><th>K</th><th>AVG</th><th>GO/AO</th><th>好球率</th><th>壞球率</th><th>揮棒率</th><th>首球揮棒</th><th>揮空率</th><th>GB%</th><th>LD%</th><th>FB%</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <th>
                    <strong>${escapeHtml(pitcherBatterCleanName(row?.HitterName) || '—')}</strong>
                    <small>${escapeHtml(String(row?.HitterTeamName || pitcherBatterTeamName(pitcherBatterOpponent) || ''))}</small>
                  </th>
                  <td>${pitcherBatterNum(row,'PlateAppearances')}</td>
                  <td>${pitcherBatterNum(row,'HittingCnt')}</td>
                  <td>${pitcherBatterNum(row,'HomeRunCnt')}</td>
                  <td>${pitcherBatterNum(row,'HitBYPitchCnt')}</td>
                  <td>${pitcherBatterNum(row,'BasesONBallsCnt')}</td>
                  <td>${pitcherBatterNum(row,'IntentionalBasesONBallsCnt')}</td>
                  <td>${pitcherBatterNum(row,'StrikeOutCnt')}</td>
                  <td class="is-rate">${pitcherBatterRate(row?.Avg)}</td>
                  <td>${pitcherBatterRate(row?.Goao)}</td>
                  <td>${pitcherBatterPct(row?.Strike_Pct)}</td>
                  <td>${pitcherBatterPct(row?.Ball_Pct)}</td>
                  <td>${pitcherBatterPct(row?.Swing_Pct)}</td>
                  <td>${pitcherBatterPct(row?.First_Pitch_Swing_Pct)}</td>
                  <td>${pitcherBatterPct(row?.Whiff_Pct)}</td>
                  <td>${pitcherBatterPct(row?.GB_Pct)}</td>
                  <td>${pitcherBatterPct(row?.LD_Pct)}</td>
                  <td>${pitcherBatterPct(row?.FB_Pct)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    function pitcherBatterBind() {
      document.querySelectorAll('[data-pitcher-batter-team]').forEach(button => {
        button.addEventListener('click', () => {
          const team = String(button.dataset.pitcherBatterTeam || '');
          if (!team || team === pitcherBatterTeam) return;
          pitcherBatterTeam = team;
          void pitcherBatterLoadRoster(team);
        });
      });

      const playerInput = document.getElementById('pitcherBatterPlayerSearch');
      playerInput?.addEventListener('focus', () => {
        pitcherBatterPlayerOpen = true;
        pitcherBatterRenderPlayerResults();
      });
      playerInput?.addEventListener('input', event => {
        pitcherBatterPlayerQuery = String(event.target.value || '');
        pitcherBatterPlayerOpen = true;
        pitcherBatterRenderPlayerResults();
      });
      playerInput?.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          pitcherBatterPlayerOpen = false;
          pitcherBatterRenderPlayerResults();
          playerInput.blur();
        }
      });
      document.getElementById('pitcherBatterPlayerClear')?.addEventListener('click', () => {
        pitcherBatterPlayerQuery = '';
        pitcherBatterPlayerAcnt = '';
        pitcherBatterPlayerProfile = null;
        pitcherBatterPlayerOpen = true;
        pitcherBatterYears = [];
        pitcherBatterOpponent = '';
        pitcherBatterYear = 9999;
        pitcherBatterRows = [];
        pitcherBatterError = '';
        pitcherBatterSource = '';
        pitcherBatterHistoricalUnavailable = false;
        pitcherBatterHasQueried = false;
        renderPitcherBatterPage();
        requestAnimationFrame(() => document.getElementById('pitcherBatterPlayerSearch')?.focus());
      });

      document.querySelectorAll('[data-pitcher-batter-opponent]').forEach(button => {
        button.addEventListener('click', () => {
          if (!pitcherBatterPlayerAcnt) return;
          pitcherBatterOpponent = String(button.dataset.pitcherBatterOpponent || '');
          pitcherBatterRows = [];
          pitcherBatterError = '';
          pitcherBatterSource = '';
          pitcherBatterHistoricalUnavailable = false;
          pitcherBatterHasQueried = false;
          renderPitcherBatterPage();
        });
      });

      document.querySelectorAll('[data-pitcher-batter-year]').forEach(button => {
        button.addEventListener('click', () => {
          if (!pitcherBatterPlayerAcnt) return;
          const raw = String(button.dataset.pitcherBatterYear || '9999');
          pitcherBatterYear = raw === '9999' ? 9999 : Number(raw);
          pitcherBatterRows = [];
          pitcherBatterError = '';
          pitcherBatterSource = '';
          pitcherBatterHistoricalUnavailable = false;
          pitcherBatterHasQueried = false;
          renderPitcherBatterPage();
        });
      });

      document.getElementById('pitcherBatterQueryBtn')?.addEventListener('click', () => {
        void pitcherBatterQuery();
      });

      pitcherBatterRenderPlayerResults();
    }

    function renderPitcherBatterPage() {
      if (!els.pitcherBatterPageContent) return;
      const selectedRoster = pitcherBatterSelectedRosterPlayer();
      const opponentTeams = PITCHER_BATTER_TEAMS.filter(item => item.code !== pitcherBatterTeam);
      const selectedName = pitcherBatterCleanName(pitcherBatterPlayerProfile?.name || selectedRoster?.name || '');
      const selectedPosition = String(pitcherBatterPlayerProfile?.position || (selectedRoster?.role === 'pitcher' ? '投手' : selectedRoster?.role === 'hitter' ? '打者' : '')).trim();
      const periodLabel = pitcherBatterYear === 9999 ? '生涯' : `${pitcherBatterYear} 年`;
      const sourceLabel = pitcherBatterSource === 'cpbl-official'
        ? '來源：CPBL 官方投打對決'
        : pitcherBatterSource
          ? '來源：CPBL 官方資料同步備援'
          : '';

      els.pitcherBatterPageContent.innerHTML = `
        <section class="pitcher-batter-flow">
          <div class="pitcher-batter-flow-head">
            <div>
              <strong>中職投打對決</strong>
              <span>球員可直接輸入姓名搜尋，不再使用系統下拉選單。</span>
            </div>
          </div>

          <div class="pitcher-batter-step">
            <div class="pitcher-batter-step-title"><b>1</b><span>選擇球隊</span></div>
            <div class="pitcher-batter-chip-grid pitcher-batter-team-grid">
              ${PITCHER_BATTER_TEAMS.map(item => `
                <button type="button" class="pitcher-batter-choice ${pitcherBatterTeam === item.code ? 'active' : ''}" data-pitcher-batter-team="${item.code}">
                  ${escapeHtml(item.name)}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="pitcher-batter-step">
            <div class="pitcher-batter-step-title">
              <b>2</b><span>搜尋球員</span>
              ${pitcherBatterTeam ? `<small>${escapeHtml(pitcherBatterTeamName(pitcherBatterTeam))}</small>` : ''}
            </div>
            <div class="pitcher-batter-combobox ${!pitcherBatterTeam ? 'disabled' : ''}">
              <div class="pitcher-batter-search-box">
                <span class="pitcher-batter-search-icon" aria-hidden="true">⌕</span>
                <input
                  id="pitcherBatterPlayerSearch"
                  name="pitcher-batter-player-query"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="pitcherBatterPlayerResults"
                  aria-expanded="false"
                  autocomplete="off"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  enterkeyhint="search"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  placeholder="${pitcherBatterRosterLoading ? '正在讀取球員…' : pitcherBatterTeam ? '輸入球員姓名' : '先選擇球隊'}"
                  value="${escapeHtml(pitcherBatterPlayerQuery)}"
                  ${!pitcherBatterTeam || pitcherBatterRosterLoading ? 'disabled' : ''}
                />
                ${pitcherBatterPlayerQuery ? '<button id="pitcherBatterPlayerClear" class="pitcher-batter-search-clear" type="button" aria-label="清除球員">×</button>' : ''}
              </div>
              <div id="pitcherBatterPlayerResults" class="pitcher-batter-player-results hidden"></div>
            </div>
            ${selectedName ? `
              <div class="pitcher-batter-selected-player">
                <span>已選球員</span>
                <strong>${escapeHtml(selectedName)}</strong>
                <em>${escapeHtml(selectedPosition || pitcherBatterPlayerRoleLabel(selectedRoster))}</em>
              </div>
            ` : ''}
            ${pitcherBatterRosterError ? `<div class="pitcher-batter-inline-error">${escapeHtml(pitcherBatterRosterError)}</div>` : ''}
          </div>

          <div class="pitcher-batter-step ${!pitcherBatterPlayerAcnt ? 'disabled' : ''}">
            <div class="pitcher-batter-step-title"><b>3</b><span>對戰球隊</span></div>
            <div class="pitcher-batter-chip-grid pitcher-batter-opponent-grid">
              ${opponentTeams.map(item => `
                <button type="button" class="pitcher-batter-choice ${pitcherBatterOpponent === item.code ? 'active' : ''}" data-pitcher-batter-opponent="${item.code}" ${!pitcherBatterPlayerAcnt ? 'disabled' : ''}>
                  ${escapeHtml(item.name)}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="pitcher-batter-step ${!pitcherBatterPlayerAcnt ? 'disabled' : ''}">
            <div class="pitcher-batter-step-title"><b>4</b><span>年度</span></div>
            <div class="pitcher-batter-year-strip">
              <button type="button" class="pitcher-batter-year ${pitcherBatterYear === 9999 ? 'active' : ''}" data-pitcher-batter-year="9999" ${!pitcherBatterPlayerAcnt ? 'disabled' : ''}>生涯</button>
              ${pitcherBatterYears.map(year => `
                <button type="button" class="pitcher-batter-year ${pitcherBatterYear === year ? 'active' : ''}" data-pitcher-batter-year="${year}" ${!pitcherBatterPlayerAcnt ? 'disabled' : ''}>${year}</button>
              `).join('')}
            </div>
          </div>

          <button id="pitcherBatterQueryBtn" class="press-btn pitcher-batter-query" type="button" ${!pitcherBatterPlayerAcnt || !pitcherBatterOpponent || pitcherBatterLoading ? 'disabled' : ''}>
            ${pitcherBatterLoading ? '查詢中…' : '查詢投打對決'}
          </button>
        </section>

        ${selectedName && pitcherBatterOpponent ? `
          <section class="pitcher-batter-selection-summary">
            <div>
              <span>查看球員</span>
              <strong>${escapeHtml(selectedName)}</strong>
              <small>${escapeHtml([pitcherBatterTeamName(pitcherBatterTeam), selectedPosition].filter(Boolean).join('｜'))}</small>
            </div>
            <div>
              <span>對戰條件</span>
              <strong>${escapeHtml(pitcherBatterTeamName(pitcherBatterOpponent))}</strong>
              <small>${escapeHtml(periodLabel)}｜一軍例行賽</small>
            </div>
          </section>
        ` : ''}

        ${pitcherBatterLoading ? `
          <div class="player-tools-empty">正在讀取投打對決資料…</div>
        ` : pitcherBatterError ? `
          <div class="player-tools-error">${escapeHtml(pitcherBatterError)}</div>
        ` : pitcherBatterHistoricalUnavailable ? `
          <div class="pitcher-batter-empty">
            <strong>${escapeHtml(String(pitcherBatterYear))} 年目前無法從雲端備援取得</strong>
            <span>CPBL 主站目前會阻擋雲端查詢；生涯與 ${CURRENT_YEAR} 單年度仍可查。主站恢復後會自動優先使用官方即時資料。</span>
          </div>
        ` : pitcherBatterHasQueried && !pitcherBatterRows.length ? `
          <div class="player-tools-empty">這個條件沒有投打對決紀錄。</div>
        ` : pitcherBatterRows.length ? `
          <div class="pitcher-batter-result-head">
            <div>
              <strong>${escapeHtml(selectedName)}</strong>
              <span>vs ${escapeHtml(pitcherBatterTeamName(pitcherBatterOpponent))}｜${escapeHtml(periodLabel)}</span>
            </div>
            <small>${escapeHtml(sourceLabel)}</small>
          </div>
          ${pitcherBatterIsPitcher() ? pitcherBatterPitcherTable(pitcherBatterRows) : pitcherBatterHitterTable(pitcherBatterRows)}
        ` : `
          <div class="pitcher-batter-empty">
            <strong>依序完成四個條件</strong>
            <span>選擇球隊後直接搜尋球員姓名，再選對戰球隊與年度。</span>
          </div>
        `}
      `;

      pitcherBatterBind();
    }

