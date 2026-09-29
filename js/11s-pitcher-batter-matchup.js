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
      pitcherBatterYears = [];
      pitcherBatterOpponent = '';
      pitcherBatterYear = 9999;
      pitcherBatterRows = [];
      pitcherBatterError = '';
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
      pitcherBatterPlayerAcnt = id;
      pitcherBatterPlayerProfile = null;
      pitcherBatterYears = [];
      pitcherBatterOpponent = '';
      pitcherBatterYear = 9999;
      pitcherBatterRows = [];
      pitcherBatterError = '';
      pitcherBatterHasQueried = false;
      renderPitcherBatterPage();
      try {
        const [profileData, historyData] = await Promise.all([
          cpblRequest('player-profile', { acnt:id }),
          cpblRequest('season-history', { acnt:id, kindCode:'A' })
        ]);
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterPlayerProfile = profileData?.player || null;
        pitcherBatterYears = (Array.isArray(historyData?.history?.years) ? historyData.history.years : [])
          .map(Number)
          .filter(year => Number.isInteger(year) && year >= 1990 && year <= CURRENT_YEAR)
          .sort((a,b) => b-a);
      } catch (error) {
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterError = error?.message || '球員資料讀取失敗。';
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
      pitcherBatterHasQueried = true;
      renderPitcherBatterPage();
      try {
        const data = await cpblRequest('fighting-score', {
          acnt:pitcherBatterPlayerAcnt,
          year:pitcherBatterYear,
          kindCode:'A',
          fightingTeamNo:pitcherBatterOpponent
        });
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterRows = Array.isArray(data?.matchup?.rows) ? data.matchup.rows : [];
      } catch (error) {
        if (seq !== pitcherBatterSeq) return;
        pitcherBatterError = error?.message || '投打對決資料讀取失敗。';
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
      document.getElementById('pitcherBatterTeamSelect')?.addEventListener('change', event => {
        pitcherBatterTeam = String(event.target.value || '');
        if (pitcherBatterTeam) void pitcherBatterLoadRoster(pitcherBatterTeam);
        else {
          pitcherBatterRoster = [];
          pitcherBatterPlayerAcnt = '';
          pitcherBatterPlayerProfile = null;
          pitcherBatterYears = [];
          pitcherBatterOpponent = '';
          pitcherBatterRows = [];
          renderPitcherBatterPage();
        }
      });

      document.getElementById('pitcherBatterPlayerSelect')?.addEventListener('change', event => {
        const acnt = String(event.target.value || '');
        pitcherBatterPlayerAcnt = acnt;
        if (acnt) void pitcherBatterLoadPlayer(acnt);
        else {
          pitcherBatterPlayerProfile = null;
          pitcherBatterYears = [];
          pitcherBatterOpponent = '';
          pitcherBatterRows = [];
          renderPitcherBatterPage();
        }
      });

      document.getElementById('pitcherBatterOpponentSelect')?.addEventListener('change', event => {
        pitcherBatterOpponent = String(event.target.value || '');
        pitcherBatterRows = [];
        pitcherBatterError = '';
        pitcherBatterHasQueried = false;
        renderPitcherBatterPage();
      });

      document.getElementById('pitcherBatterYearSelect')?.addEventListener('change', event => {
        const raw = String(event.target.value || '9999');
        pitcherBatterYear = raw === '9999' ? 9999 : Number(raw);
        pitcherBatterRows = [];
        pitcherBatterError = '';
        pitcherBatterHasQueried = false;
        renderPitcherBatterPage();
      });

      document.getElementById('pitcherBatterQueryBtn')?.addEventListener('click', () => {
        void pitcherBatterQuery();
      });
    }

    function renderPitcherBatterPage() {
      if (!els.pitcherBatterPageContent) return;
      const selectedRoster = pitcherBatterSelectedRosterPlayer();
      const opponentTeams = PITCHER_BATTER_TEAMS.filter(item => item.code !== pitcherBatterTeam);
      const selectedName = pitcherBatterCleanName(pitcherBatterPlayerProfile?.name || selectedRoster?.name || '');
      const selectedPosition = String(pitcherBatterPlayerProfile?.position || (selectedRoster?.role === 'pitcher' ? '投手' : selectedRoster?.role === 'hitter' ? '打者' : '')).trim();
      const periodLabel = pitcherBatterYear === 9999 ? '生涯' : `${pitcherBatterYear} 年`;

      els.pitcherBatterPageContent.innerHTML = `
        <section class="pitcher-batter-flow">
          <div class="pitcher-batter-flow-head">
            <strong>中職官方投打對決</strong>
            <span>依序選擇球隊、球員、對戰球隊與年度。</span>
          </div>
          <div class="pitcher-batter-select-grid">
            <label>
              <span><b>1</b> 球隊</span>
              <select id="pitcherBatterTeamSelect">
                <option value="">選擇球隊</option>
                ${PITCHER_BATTER_TEAMS.map(item => `<option value="${item.code}" ${pitcherBatterTeam === item.code ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
              </select>
            </label>
            <label>
              <span><b>2</b> 球員</span>
              <select id="pitcherBatterPlayerSelect" ${!pitcherBatterTeam || pitcherBatterRosterLoading ? 'disabled' : ''}>
                <option value="">${pitcherBatterRosterLoading ? '讀取球員中…' : pitcherBatterRosterError ? '名單讀取失敗' : '選擇球員'}</option>
                ${pitcherBatterRoster.map(item => `<option value="${escapeHtml(item.acnt)}" ${pitcherBatterPlayerAcnt === item.acnt ? 'selected' : ''}>${escapeHtml(item.name)}${item.role === 'pitcher' ? '｜投手' : item.role === 'hitter' ? '｜打者' : ''}</option>`).join('')}
              </select>
            </label>
            <label>
              <span><b>3</b> 對戰球隊</span>
              <select id="pitcherBatterOpponentSelect" ${!pitcherBatterPlayerAcnt ? 'disabled' : ''}>
                <option value="">選擇對戰球隊</option>
                ${opponentTeams.map(item => `<option value="${item.code}" ${pitcherBatterOpponent === item.code ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
              </select>
            </label>
            <label>
              <span><b>4</b> 年度</span>
              <select id="pitcherBatterYearSelect" ${!pitcherBatterPlayerAcnt ? 'disabled' : ''}>
                <option value="9999" ${pitcherBatterYear === 9999 ? 'selected' : ''}>生涯</option>
                ${pitcherBatterYears.map(year => `<option value="${year}" ${pitcherBatterYear === year ? 'selected' : ''}>${year}</option>`).join('')}
              </select>
            </label>
          </div>
          <button id="pitcherBatterQueryBtn" class="press-btn pitcher-batter-query" type="button" ${!pitcherBatterPlayerAcnt || !pitcherBatterOpponent || pitcherBatterLoading ? 'disabled' : ''}>
            ${pitcherBatterLoading ? '查詢中…' : '查詢投打對決'}
          </button>
          ${pitcherBatterRosterError ? `<div class="pitcher-batter-inline-error">${escapeHtml(pitcherBatterRosterError)}</div>` : ''}
        </section>

        ${selectedName ? `
          <section class="pitcher-batter-selection-summary">
            <div>
              <span>查看球員</span>
              <strong>${escapeHtml(selectedName)}</strong>
              <small>${escapeHtml([pitcherBatterTeamName(pitcherBatterTeam), selectedPosition].filter(Boolean).join('｜'))}</small>
            </div>
            <div>
              <span>對戰條件</span>
              <strong>${escapeHtml(pitcherBatterTeamName(pitcherBatterOpponent) || '尚未選擇')}</strong>
              <small>${escapeHtml(periodLabel)}｜一軍例行賽</small>
            </div>
          </section>
        ` : ''}

        ${pitcherBatterLoading ? `
          <div class="player-tools-empty">正在讀取 CPBL 官方投打對決…</div>
        ` : pitcherBatterError ? `
          <div class="player-tools-error">${escapeHtml(pitcherBatterError)}</div>
        ` : pitcherBatterHasQueried && !pitcherBatterRows.length ? `
          <div class="player-tools-empty">這個條件沒有投打對決紀錄。</div>
        ` : pitcherBatterRows.length ? `
          <div class="pitcher-batter-result-head">
            <div>
              <strong>${escapeHtml(selectedName)}</strong>
              <span>vs ${escapeHtml(pitcherBatterTeamName(pitcherBatterOpponent))}｜${escapeHtml(periodLabel)}</span>
            </div>
            <small>來源：CPBL 官方投打對決</small>
          </div>
          ${pitcherBatterIsPitcher() ? pitcherBatterPitcherTable(pitcherBatterRows) : pitcherBatterHitterTable(pitcherBatterRows)}
        ` : `
          <div class="pitcher-batter-empty">
            <strong>選完四個條件後查詢</strong>
            <span>會列出這位球員對指定球隊每一位對戰球員的官方累計數據。</span>
          </div>
        `}
      `;

      pitcherBatterBind();
    }
