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

    const STANDINGS_CACHE_MS = 5 * 60 * 1000;
    let standingsOfficialCache = null;
    let standingsOfficialCacheAt = 0;
    let standingsOfficialLoading = false;
    let standingsOfficialError = '';
    let standingsAutoRefreshTimer = null;

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

    function standingsCurrentOfficialSection() {
      if (!standingsOfficialCache) return null;
      if (standingsUiState.league === 'cpbl') {
        return standingsOfficialCache?.cpbl?.[standingsUiState.cpblView] || null;
      }
      return standingsOfficialCache?.npb?.[standingsUiState.npbView] || null;
    }

    function standingsCurrentMeta() {
      if (!standingsOfficialCache?.meta) return null;
      return standingsUiState.league === 'cpbl'
        ? (standingsOfficialCache.meta.cpbl || null)
        : (standingsOfficialCache.meta.npb || null);
    }

    function standingsDisplayRows() {
      const section = standingsCurrentOfficialSection();
      if (Array.isArray(section?.rows) && section.rows.length) {
        return section.rows.map(row => ({ ...row, official:true }));
      }
      return standingsPreviewRows().map((team,index) => ({
        rank:index + 1,
        team,
        games:0,
        wins:null,
        losses:null,
        ties:null,
        pct:null,
        gb:null,
        official:false
      }));
    }

    function standingsRecord(row) {
      if (!row?.official) return '—';
      return `${Number(row.wins) || 0}-${Number(row.losses) || 0}-${Number(row.ties) || 0}`;
    }

    function standingsPct(row) {
      if (!row?.official || !Number.isFinite(Number(row.pct))) return '—';
      return Number(row.pct).toFixed(3).replace(/^0/, '');
    }

    function standingsGb(row) {
      if (!row?.official) return '—';
      const value = String(row.gb ?? '-').trim();
      return value || '-';
    }

    function standingsFetchedTime() {
      const raw = standingsOfficialCache?.fetchedAt;
      if (!raw) return '';
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('zh-TW', {
        month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false
      });
    }

    function standingsStatusMeta() {
      if (standingsOfficialLoading && !standingsOfficialCache) {
        return { title:'正在讀取戰績', detail:'正在讀取官方基準與即時結算狀態…', state:'loading' };
      }
      if (standingsOfficialError && !standingsOfficialCache) {
        return { title:'戰績讀取失敗', detail:standingsOfficialError, state:'error' };
      }

      const section = standingsCurrentOfficialSection();
      const meta = standingsCurrentMeta();
      const league = standingsUiState.league === 'cpbl' ? 'CPBL' : 'NPB';
      const officialDate = String(section?.officialDate || '').trim();
      const fetched = standingsFetchedTime();
      const state = String(meta?.status || 'official-only');
      const applied = Number(meta?.appliedGames || 0);
      const scheduled = Number(meta?.scheduledGames || 0);

      if (state === 'base') {
        return {
          title:`${league} 今日官方基準已建立`,
          detail:`Final 已結算 ${applied} / ${scheduled || '—'} 場｜基準不會在比賽中重抓`,
          state:'ok'
        };
      }
      if (state === 'live') {
        return {
          title:`${league} 今日戰績即時結算中`,
          detail:`Final 已結算 ${applied} / ${scheduled || '—'} 場｜每場 Final 後直接加勝敗和`,
          state:'ok'
        };
      }
      if (state === 'pending_reconcile') {
        return {
          title:`${league} 今日賽事已完成`,
          detail:`已結算 ${applied} / ${scheduled || applied} 場｜等待跨日與官網核對`,
          state:'ok'
        };
      }
      if (state === 'confirmed') {
        return {
          title:`${league} 已與官方戰績核對一致`,
          detail:meta?.reconciledAt ? `核對完成 ${new Date(meta.reconciledAt).toLocaleString('zh-TW',{hour12:false})}` : '跨日核對完成',
          state:'ok'
        };
      }
      if (state === 'mismatch') {
        const count = Number(meta?.mismatch?.count || 0);
        return {
          title:`${league} 官方戰績與本地結算有差異`,
          detail:`目前有 ${count || '未知'} 筆差異，後端會延後再次核對，不會直接覆蓋本地結果`,
          state:'error'
        };
      }
      if (section) {
        return {
          title:`${league} 官方戰績已載入`,
          detail:officialDate
            ? `官網資料截至 ${officialDate.replaceAll('-', '/')}｜尚未進入今日 T-30 基準`
            : `抓取時間 ${fetched || '剛剛'}｜尚未進入今日 T-30 基準`,
          state:'ok'
        };
      }
      return { title:'等待戰績資料', detail:'尚未完成首次讀取。', state:'idle' };
    }

    function scheduleStandingsAutoRefresh() {
      if (standingsAutoRefreshTimer) clearTimeout(standingsAutoRefreshTimer);
      standingsAutoRefreshTimer = null;
      if (currentPage !== 'standings') return;
      const state = String(standingsCurrentMeta()?.status || 'official-only');
      if (state === 'official-only') return;
      standingsAutoRefreshTimer = setTimeout(() => {
        if (currentPage !== 'standings') return;
        void loadOfficialStandings({ force:true });
      }, 120000);
    }

    async function loadOfficialStandings({ force = false } = {}) {
      const now = Date.now();
      if (!force && standingsOfficialCache && now - standingsOfficialCacheAt < STANDINGS_CACHE_MS) return standingsOfficialCache;
      if (standingsOfficialLoading) return null;
      standingsOfficialLoading = true;
      standingsOfficialError = '';
      renderStandingsPage();
      try {
        const response = await fetch(LEAGUE_STANDINGS_API_URL, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body:JSON.stringify({ appKey:CPBL_APP_KEY, league:'ALL' })
        });
        const text = await response.text();
        let data = {};
        try { data = JSON.parse(text || '{}'); } catch {}
        if (!response.ok || data?.ok !== true) {
          throw new Error(data?.error || `官方戰績讀取失敗（${response.status}）`);
        }
        standingsOfficialCache = data;
        standingsOfficialCacheAt = Date.now();
        standingsOfficialError = '';
        return data;
      } catch (error) {
        standingsOfficialError = error?.message || '官方戰績讀取失敗。';
        return null;
      } finally {
        standingsOfficialLoading = false;
        if (currentPage === 'standings') renderStandingsPage();
      }
    }

    function renderStandingsPage() {
      if (!els.standingsPageContent) return;
      const isCpbl = standingsUiState.league === 'cpbl';
      const rows = standingsDisplayRows();
      const status = standingsStatusMeta();
      const hasOfficial = rows.some(row => row.official);
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
          <div class="standings-secondary-tabs ${isCpbl ? 'is-three' : 'is-two'}" aria-label="${isCpbl ? '中職季別' : '日職聯盟'}">
            ${secondary}
          </div>
        </div>

        <div class="standings-overview">
          <div class="standings-overview-copy">
            <span class="standings-overview-label">${isCpbl ? 'CPBL' : 'NPB'} 2026</span>
            <strong>${standingsSubTitle()}戰績</strong>
          </div>
          <span class="standings-preview-badge">${hasOfficial ? (['live','pending_reconcile'].includes(String(standingsCurrentMeta()?.status || '')) ? '即時結算' : '官方資料') : (standingsOfficialLoading ? '讀取中' : '待載入')}</span>
        </div>

        <div class="standings-sync-status standings-sync-status-${status.state}" role="status">
          <span class="standings-sync-dot" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(status.title)}</strong>
            <span>${escapeHtml(status.detail)}</span>
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
            ${rows.map(row => `
              <div class="standings-team-row">
                <span class="standings-rank">${escapeHtml(String(row.rank ?? '—'))}</span>
                <span class="standings-team-name">${escapeHtml(String(row.team || ''))}</span>
                <span class="standings-record">${escapeHtml(standingsRecord(row))}</span>
                <span class="standings-pct">${escapeHtml(standingsPct(row))}</span>
                <span class="standings-gb">${escapeHtml(standingsGb(row))}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="standings-flow-note">
          <span class="standings-flow-icon" aria-hidden="true">✓</span>
          <span>目前已接官方基準資料。下一步可接：比賽 Final 後直接加勝敗，再於跨日與官方戰績核對。</span>
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

      if (!standingsOfficialCache && !standingsOfficialLoading) {
        void loadOfficialStandings();
      }
      scheduleStandingsAutoRefresh();
    }
