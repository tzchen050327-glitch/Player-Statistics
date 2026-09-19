    const standingsUiState = {
      league: localStorage.getItem('standingsLeague') === 'npb' ? 'npb' : 'cpbl',
      cpblView: ['first','second','annual'].includes(localStorage.getItem('standingsCpblView'))
        ? localStorage.getItem('standingsCpblView')
        : 'annual',
      npbView: localStorage.getItem('standingsNpbView') === 'pacific' ? 'pacific' : 'central'
    };

    const STANDINGS_PREVIEW_TEAMS = {
      cpbl:[
        '中信兄弟','統一7-ELEVEn獅','樂天桃猿','味全龍','富邦悍將','台鋼雄鷹'
      ],
      central:[
        '阪神虎','橫濱DeNA灣星','讀賣巨人','中日龍','廣島東洋鯉魚','東京養樂多燕子'
      ],
      pacific:[
        '福岡軟銀鷹','北海道日本火腿鬥士','歐力士猛牛','東北樂天金鷲','埼玉西武獅','千葉羅德海洋'
      ]
    };

    function standingsPreviewRows() {
      if (standingsUiState.league === 'cpbl') return STANDINGS_PREVIEW_TEAMS.cpbl;
      return standingsUiState.npbView === 'pacific'
        ? STANDINGS_PREVIEW_TEAMS.pacific
        : STANDINGS_PREVIEW_TEAMS.central;
    }

    function standingsSubTitle() {
      if (standingsUiState.league === 'cpbl') {
        return standingsUiState.cpblView === 'first'
          ? '上半季'
          : (standingsUiState.cpblView === 'second' ? '下半季' : '全年度');
      }
      return standingsUiState.npbView === 'pacific' ? '洋聯' : '央聯';
    }

    function standingsButton(label, value, active, attr) {
      return `<button class="standings-switch-btn ${active ? 'active' : ''}" type="button" ${attr}="${value}">${label}</button>`;
    }

    function renderStandingsPage() {
      if (!els.standingsPageContent) return;
      const isCpbl = standingsUiState.league === 'cpbl';
      const teams = standingsPreviewRows();
      const secondary = isCpbl
        ? [
            standingsButton('上半季','first',standingsUiState.cpblView === 'first','data-standings-cpbl'),
            standingsButton('下半季','second',standingsUiState.cpblView === 'second','data-standings-cpbl'),
            standingsButton('全年度','annual',standingsUiState.cpblView === 'annual','data-standings-cpbl')
          ].join('')
        : [
            standingsButton('央聯','central',standingsUiState.npbView === 'central','data-standings-npb'),
            standingsButton('洋聯','pacific',standingsUiState.npbView === 'pacific','data-standings-npb')
          ].join('');

      els.standingsPageContent.innerHTML = `
        <div class="standings-controls">
          <div class="standings-primary-tabs" aria-label="聯盟">
            ${standingsButton('中華職棒','cpbl',isCpbl,'data-standings-league')}
            ${standingsButton('日本職棒','npb',!isCpbl,'data-standings-league')}
          </div>
          <div class="standings-secondary-tabs" aria-label="${isCpbl ? '中職季別' : '日職聯盟'}">
            ${secondary}
          </div>
        </div>

        <div class="standings-overview">
          <div class="standings-overview-copy">
            <span class="standings-overview-label">${isCpbl ? 'CPBL' : 'NPB'} 2026</span>
            <strong>${standingsSubTitle()}戰績</strong>
          </div>
          <span class="standings-preview-badge">版型預覽</span>
        </div>

        <div class="standings-sync-status" role="status">
          <span class="standings-sync-dot" aria-hidden="true"></span>
          <div>
            <strong>尚未接官方戰績資料</strong>
            <span>正式串接後會顯示官方基準、當日 Final 結算與跨日核對狀態</span>
          </div>
        </div>

        <div class="standings-table-card">
          <div class="standings-table-head" aria-hidden="true">
            <span>排名</span>
            <span>球隊</span>
            <span>戰績</span>
            <span>勝率</span>
            <span>勝差</span>
          </div>
          <div class="standings-table-body">
            ${teams.map((team,index) => `
              <div class="standings-team-row">
                <span class="standings-rank">${index + 1}</span>
                <span class="standings-team-name">${escapeHtml(team)}</span>
                <span class="standings-record">—</span>
                <span class="standings-pct">—</span>
                <span class="standings-gb">—</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="standings-flow-note">
          <span class="standings-flow-icon" aria-hidden="true">✓</span>
          <span>預計流程：賽前抓官方基準 → 比賽 Final 後直接加勝敗 → 跨日再與官方戰績核對。</span>
        </div>
      `;

      els.standingsPageContent.querySelectorAll('[data-standings-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          standingsUiState.league = btn.dataset.standingsLeague === 'npb' ? 'npb' : 'cpbl';
          localStorage.setItem('standingsLeague', standingsUiState.league);
          renderStandingsPage();
        });
      });
      els.standingsPageContent.querySelectorAll('[data-standings-cpbl]').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = btn.dataset.standingsCpbl;
          if (!['first','second','annual'].includes(value)) return;
          standingsUiState.cpblView = value;
          localStorage.setItem('standingsCpblView', value);
          renderStandingsPage();
        });
      });
      els.standingsPageContent.querySelectorAll('[data-standings-npb]').forEach(btn => {
        btn.addEventListener('click', () => {
          standingsUiState.npbView = btn.dataset.standingsNpb === 'pacific' ? 'pacific' : 'central';
          localStorage.setItem('standingsNpbView', standingsUiState.npbView);
          renderStandingsPage();
        });
      });
    }
