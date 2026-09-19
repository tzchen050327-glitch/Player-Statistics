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
    let standingsSelectedTeam = '';
    let standingsTeamTab = 'h2h';
    let standingsTeamDetailLoading = false;
    let standingsTeamDetailError = '';
    const standingsTeamDetailCache = new Map();

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

    function standingsCurrentView() {
      return standingsUiState.league === 'cpbl' ? standingsUiState.cpblView : standingsUiState.npbView;
    }

    function standingsTeamDetailKey(team) {
      return `${standingsUiState.league}|${standingsCurrentView()}|${team}`;
    }

    function standingsGameOpponent(game, team) {
      return String(game?.away || '') === team ? String(game?.home || '') : String(game?.away || '');
    }

    function standingsGameSide(game, team) {
      return String(game?.away || '') === team ? '客' : '主';
    }

    function standingsGameScore(game, team) {
      if (game?.awayScore === null || game?.awayScore === undefined || game?.homeScore === null || game?.homeScore === undefined) return '';
      const mine = String(game?.away || '') === team ? Number(game.awayScore) : Number(game.homeScore);
      const other = String(game?.away || '') === team ? Number(game.homeScore) : Number(game.awayScore);
      return `${mine} : ${other}`;
    }

    function standingsTeamDetailHtml(team) {
      if (!team) return '';
      const key = standingsTeamDetailKey(team);
      const data = standingsTeamDetailCache.get(key) || null;
      const h2h = Array.isArray(data?.h2h) ? data.h2h : [];
      const recent = Array.isArray(data?.recent) ? data.recent : [];
      const upcoming = Array.isArray(data?.upcoming) ? data.upcoming : [];

      let body = '';
      if (standingsTeamDetailLoading && !data) {
        body = `<div class="standings-team-detail-empty">正在讀取 ${escapeHtml(team)} 的資料…</div>`;
      } else if (standingsTeamDetailError && !data) {
        body = `<div class="standings-team-detail-empty error">${escapeHtml(standingsTeamDetailError)}</div>`;
      } else if (standingsTeamTab === 'h2h') {
        body = h2h.length
          ? `<div class="standings-h2h-list">${h2h.map(item => `
              <div class="standings-h2h-row">
                <span class="standings-h2h-opponent">${escapeHtml(item.opponent)}</span>
                <span class="standings-h2h-record"><b>${Number(item.wins)||0}</b>勝 <b>${Number(item.losses)||0}</b>敗 <b>${Number(item.ties)||0}</b>和</span>
              </div>
            `).join('')}</div>`
          : `<div class="standings-team-detail-empty">目前沒有可顯示的官方對戰戰績。</div>`;
      } else {
        const recentHtml = recent.length
          ? recent.map(game => `
              <div class="standings-schedule-row">
                <div class="standings-schedule-date"><strong>${escapeHtml(String(game.date||'').slice(5).replace('-','/'))}</strong><span>${escapeHtml(game.time||'')}</span></div>
                <div class="standings-schedule-match"><strong>${escapeHtml(standingsGameOpponent(game,team))}</strong><span>${standingsGameSide(game,team)}場・${escapeHtml(game.venue||'')}</span></div>
                <div class="standings-schedule-result is-${String(game.result||'').toLowerCase()}"><strong>${escapeHtml(standingsGameScore(game,team))}</strong><span>${game.result==='W'?'勝':game.result==='L'?'敗':game.result==='T'?'和':''}</span></div>
              </div>
            `).join('')
          : `<div class="standings-team-detail-empty compact">沒有近期已結束賽事。</div>`;

        const upcomingHtml = upcoming.length
          ? upcoming.map(game => `
              <div class="standings-schedule-row">
                <div class="standings-schedule-date"><strong>${escapeHtml(String(game.date||'').slice(5).replace('-','/'))}</strong><span>${escapeHtml(game.time||'')}</span></div>
                <div class="standings-schedule-match"><strong>${escapeHtml(standingsGameOpponent(game,team))}</strong><span>${standingsGameSide(game,team)}場・${escapeHtml(game.venue||'')}</span></div>
                <div class="standings-schedule-result upcoming"><strong>${String(game.status||'')==='live'?'LIVE':'未開打'}</strong><span></span></div>
              </div>
            `).join('')
          : `<div class="standings-team-detail-empty compact">目前沒有抓到接下來的賽程。</div>`;

        body = `
          <div class="standings-schedule-section"><span class="standings-schedule-section-title">最近賽果</span>${recentHtml}</div>
          <div class="standings-schedule-section"><span class="standings-schedule-section-title">接下來賽程</span>${upcomingHtml}</div>
        `;
      }

      return `
        <section class="standings-team-detail" id="standingsTeamDetail">
          <div class="standings-team-detail-head">
            <div><span>${standingsUiState.league==='cpbl'?'CPBL':'NPB'} 2026</span><strong>${escapeHtml(team)}</strong></div>
            <button type="button" class="standings-team-detail-close" data-standings-team-close aria-label="關閉球隊詳情">×</button>
          </div>
          <div class="standings-team-detail-tabs">
            <button type="button" class="${standingsTeamTab==='h2h'?'active':''}" data-standings-team-tab="h2h">對戰成績</button>
            <button type="button" class="${standingsTeamTab==='schedule'?'active':''}" data-standings-team-tab="schedule">賽程</button>
          </div>
          <div class="standings-team-detail-body">${body}</div>
        </section>
      `;
    }

    async function loadStandingsTeamDetail(team, { force = false } = {}) {
      if (!team) return null;
      const key = standingsTeamDetailKey(team);
      if (!force && standingsTeamDetailCache.has(key)) return standingsTeamDetailCache.get(key);
      if (standingsTeamDetailLoading) return null;
      standingsTeamDetailLoading = true;
      standingsTeamDetailError = '';
      renderStandingsPage();
      try {
        const response = await fetch(LEAGUE_TEAM_DETAIL_API_URL, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body:JSON.stringify({
            appKey:CPBL_APP_KEY,
            league:standingsUiState.league.toUpperCase(),
            team,
            view:standingsCurrentView()
          })
        });
        const text = await response.text();
        let data = {};
        try { data = JSON.parse(text || '{}'); } catch {}
        if (!response.ok || data?.ok !== true) throw new Error(data?.error || `球隊資料讀取失敗（${response.status}）`);
        standingsTeamDetailCache.set(key, data);
        return data;
      } catch (error) {
        standingsTeamDetailError = error?.message || '球隊資料讀取失敗。';
        return null;
      } finally {
        standingsTeamDetailLoading = false;
        if (currentPage === 'standings' && standingsSelectedTeam === team) renderStandingsPage();
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
              <button type="button" class="standings-team-row ${standingsSelectedTeam === String(row.team || '') ? 'selected' : ''}" data-standings-team="${escapeHtml(String(row.team || ''))}">
                <span class="standings-rank">${escapeHtml(String(row.rank ?? '—'))}</span>
                <span class="standings-team-name">${escapeHtml(String(row.team || ''))}</span>
                <span class="standings-record">${escapeHtml(standingsRecord(row))}</span>
                <span class="standings-pct">${escapeHtml(standingsPct(row))}</span>
                <span class="standings-gb">${escapeHtml(standingsGb(row))}</span>
              </button>
            `).join('')}
          </div>
        </div>

        ${standingsTeamDetailHtml(standingsSelectedTeam)}

        <div class="standings-flow-note">
          <span class="standings-flow-icon" aria-hidden="true">✓</span>
          <span>官方基準由後端保存；比賽 Final 後直接更新勝敗和，跨日再與官方戰績核對。</span>
        </div>
      `;

      els.standingsPageContent.querySelectorAll('[data-standings-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          standingsUiState.league = btn.dataset.standingsLeague === 'npb' ? 'npb' : 'cpbl';
          standingsSelectedTeam = '';
          standingsTeamDetailError = '';
          localStorage.setItem('standingsLeague', standingsUiState.league);
          renderStandingsPage();
        });
      });
      els.standingsPageContent.querySelectorAll('[data-standings-cpbl]').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = btn.dataset.standingsCpbl;
          if (!['first','second','annual'].includes(value)) return;
          standingsUiState.cpblView = value;
          standingsSelectedTeam = '';
          standingsTeamDetailError = '';
          localStorage.setItem('standingsCpblView', value);
          renderStandingsPage();
        });
      });
      els.standingsPageContent.querySelectorAll('[data-standings-npb]').forEach(btn => {
        btn.addEventListener('click', () => {
          standingsUiState.npbView = btn.dataset.standingsNpb === 'pacific' ? 'pacific' : 'central';
          standingsSelectedTeam = '';
          standingsTeamDetailError = '';
          localStorage.setItem('standingsNpbView', standingsUiState.npbView);
          renderStandingsPage();
        });
      });

      els.standingsPageContent.querySelectorAll('[data-standings-team]').forEach(btn => {
        btn.addEventListener('click', () => {
          const team = String(btn.dataset.standingsTeam || '');
          if (!team) return;
          standingsSelectedTeam = team;
          standingsTeamTab = 'h2h';
          standingsTeamDetailError = '';
          renderStandingsPage();
          void loadStandingsTeamDetail(team);
          requestAnimationFrame(() => document.getElementById('standingsTeamDetail')?.scrollIntoView({ behavior:'smooth', block:'start' }));
        });
      });
      els.standingsPageContent.querySelectorAll('[data-standings-team-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          standingsTeamTab = btn.dataset.standingsTeamTab === 'schedule' ? 'schedule' : 'h2h';
          renderStandingsPage();
        });
      });
      els.standingsPageContent.querySelector('[data-standings-team-close]')?.addEventListener('click', () => {
        standingsSelectedTeam = '';
        standingsTeamDetailError = '';
        renderStandingsPage();
      });

      if (!standingsOfficialCache && !standingsOfficialLoading) {
        void loadOfficialStandings();
      }
    }
