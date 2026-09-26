    const standingsUiState = {
      league: ['cpbl','npb','kbo','mlb'].includes(localStorage.getItem('standingsLeague'))
        ? localStorage.getItem('standingsLeague')
        : 'cpbl',
      cpblView: ['first','second','annual'].includes(localStorage.getItem('standingsCpblView'))
        ? localStorage.getItem('standingsCpblView')
        : 'annual',
      npbView: localStorage.getItem('standingsNpbView') === 'pacific' ? 'pacific' : 'central',
      kboView: 'regular',
      mlbView: ['alEast','alCentral','alWest','nlEast','nlCentral','nlWest'].includes(localStorage.getItem('standingsMlbView'))
        ? localStorage.getItem('standingsMlbView')
        : 'alEast'
    };

    const STANDINGS_PREVIEW_TEAMS = {
      cpbl:['中信兄弟','統一7-ELEVEn獅','樂天桃猿','味全龍','富邦悍將','台鋼雄鷹'],
      central:['阪神虎','橫濱DeNA灣星','讀賣巨人','中日龍','廣島東洋鯉魚','東京養樂多燕子'],
      pacific:['福岡軟銀鷹','北海道日本火腿鬥士','歐力士猛牛','東北樂天金鷲','埼玉西武獅','千葉羅德海洋'],
      kbo:['KT巫師','三星獅','LG雙子','KIA虎','斗山熊','NC恐龍','SSG登陸者','樂天巨人','韓華鷹','培證英雄'],
      alEast:['洋基','紅襪','藍鳥','光芒','金鶯'],
      alCentral:['守護者','老虎','皇家','雙城','白襪'],
      alWest:['水手','太空人','遊騎兵','天使','運動家'],
      nlEast:['費城人','大都會','勇士','馬林魚','國民'],
      nlCentral:['釀酒人','小熊','紅雀','紅人','海盜'],
      nlWest:['道奇','教士','巨人','響尾蛇','洛磯']
    };

    const MLB_STANDINGS_ZH = new Map([
      ['Arizona Diamondbacks','響尾蛇'],['Diamondbacks','響尾蛇'],['D-backs','響尾蛇'],
      ['Atlanta Braves','勇士'],['Braves','勇士'],['Baltimore Orioles','金鶯'],['Orioles','金鶯'],
      ['Boston Red Sox','紅襪'],['Red Sox','紅襪'],['Chicago Cubs','小熊'],['Cubs','小熊'],
      ['Chicago White Sox','白襪'],['White Sox','白襪'],['Cincinnati Reds','紅人'],['Reds','紅人'],
      ['Cleveland Guardians','守護者'],['Guardians','守護者'],['Colorado Rockies','洛磯'],['Rockies','洛磯'],
      ['Detroit Tigers','老虎'],['Tigers','老虎'],['Houston Astros','太空人'],['Astros','太空人'],
      ['Kansas City Royals','皇家'],['Royals','皇家'],['Los Angeles Angels','天使'],['Angels','天使'],
      ['Los Angeles Dodgers','道奇'],['Dodgers','道奇'],['Miami Marlins','馬林魚'],['Marlins','馬林魚'],
      ['Milwaukee Brewers','釀酒人'],['Brewers','釀酒人'],['Minnesota Twins','雙城'],['Twins','雙城'],
      ['New York Mets','大都會'],['Mets','大都會'],['New York Yankees','洋基'],['Yankees','洋基'],
      ['Athletics','運動家'],['Oakland Athletics','運動家'],['Sacramento Athletics','運動家'],
      ['Philadelphia Phillies','費城人'],['Phillies','費城人'],['Pittsburgh Pirates','海盜'],['Pirates','海盜'],
      ['San Diego Padres','教士'],['Padres','教士'],['San Francisco Giants','巨人'],['Giants','巨人'],
      ['Seattle Mariners','水手'],['Mariners','水手'],['St. Louis Cardinals','紅雀'],['Cardinals','紅雀'],
      ['Tampa Bay Rays','光芒'],['Rays','光芒'],['Texas Rangers','遊騎兵'],['Rangers','遊騎兵'],
      ['Toronto Blue Jays','藍鳥'],['Blue Jays','藍鳥'],['Washington Nationals','國民'],['Nationals','國民']
    ]);

    function mlbStandingsTeamZh(value) {
      const raw = String(value || '').trim();
      return MLB_STANDINGS_ZH.get(raw) || raw;
    }
    const MLB_STANDINGS_FULL_ZH = new Map([
      ['響尾蛇','亞利桑那響尾蛇'],
      ['勇士','亞特蘭大勇士'],
      ['金鶯','巴爾的摩金鶯'],
      ['紅襪','波士頓紅襪'],
      ['小熊','芝加哥小熊'],
      ['白襪','芝加哥白襪'],
      ['紅人','辛辛那提紅人'],
      ['守護者','克里夫蘭守護者'],
      ['洛磯','科羅拉多洛磯'],
      ['老虎','底特律老虎'],
      ['太空人','休士頓太空人'],
      ['皇家','堪薩斯市皇家'],
      ['天使','洛杉磯天使'],
      ['道奇','洛杉磯道奇'],
      ['馬林魚','邁阿密馬林魚'],
      ['釀酒人','密爾瓦基釀酒人'],
      ['雙城','明尼蘇達雙城'],
      ['大都會','紐約大都會'],
      ['洋基','紐約洋基'],
      ['運動家','運動家'],
      ['費城人','費城費城人'],
      ['海盜','匹茲堡海盜'],
      ['教士','聖地牙哥教士'],
      ['巨人','舊金山巨人'],
      ['水手','西雅圖水手'],
      ['紅雀','聖路易紅雀'],
      ['光芒','坦帕灣光芒'],
      ['遊騎兵','德州遊騎兵'],
      ['藍鳥','多倫多藍鳥'],
      ['國民','華盛頓國民']
    ]);

    function standingsTeamTableLabel(row) {
      const raw = String(row?.team || '').trim();
      if (standingsUiState.league !== 'mlb') return raw;
      const zh = mlbStandingsTeamZh(raw || row?.sourceTeam);
      return MLB_STANDINGS_FULL_ZH.get(zh) || zh;
    }
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
    let standingsAutoRefreshTimer = null;

    function ensureStandingsAutoRefresh() {
      if (standingsAutoRefreshTimer) return;
      standingsAutoRefreshTimer = setInterval(() => {
        if (currentPage !== 'standings') return;
        if (!['cpbl','npb'].includes(standingsUiState.league)) return;
        const state = String(standingsCurrentMeta()?.status || '');
        if (!['base','live','pending_reconcile'].includes(state)) return;
        void loadOfficialStandings({ force:true });
      }, 60 * 1000);
    }

    function standingsLeagueCode() {
      return ({ cpbl:'CPBL', npb:'NPB', kbo:'KBO', mlb:'MLB' })[standingsUiState.league] || 'CPBL';
    }

    function standingsPreviewRows() {
      if (standingsUiState.league === 'cpbl') return STANDINGS_PREVIEW_TEAMS.cpbl;
      if (standingsUiState.league === 'npb') return STANDINGS_PREVIEW_TEAMS[standingsUiState.npbView] || STANDINGS_PREVIEW_TEAMS.central;
      if (standingsUiState.league === 'kbo') return STANDINGS_PREVIEW_TEAMS.kbo;
      return STANDINGS_PREVIEW_TEAMS[standingsUiState.mlbView] || STANDINGS_PREVIEW_TEAMS.alEast;
    }

    function standingsSubTitle() {
      if (standingsUiState.league === 'cpbl') {
        return standingsUiState.cpblView === 'first'
          ? '上半季'
          : (standingsUiState.cpblView === 'second' ? '下半季' : '全年度');
      }
      if (standingsUiState.league === 'npb') return standingsUiState.npbView === 'pacific' ? '洋聯' : '央聯';
      if (standingsUiState.league === 'kbo') return '例行賽';
      return ({
        alEast:'美國東區', alCentral:'美國中區', alWest:'美國西區',
        nlEast:'國家東區', nlCentral:'國家中區', nlWest:'國家西區'
      })[standingsUiState.mlbView] || '美聯東區';
    }

    function standingsButton(label, value, active, attr) {
      return `<button class="standings-switch-btn ${active ? 'active' : ''}" type="button" ${attr}="${value}">${label}</button>`;
    }

    function standingsCurrentOfficialSection() {
      if (!standingsOfficialCache) return null;
      if (standingsUiState.league === 'cpbl') return standingsOfficialCache?.cpbl?.[standingsUiState.cpblView] || null;
      if (standingsUiState.league === 'npb') return standingsOfficialCache?.npb?.[standingsUiState.npbView] || null;
      if (standingsUiState.league === 'kbo') return standingsOfficialCache?.kbo?.regular || null;
      return standingsOfficialCache?.mlb?.[standingsUiState.mlbView] || null;
    }

    function standingsCurrentMeta() {
      if (!standingsOfficialCache?.meta) return null;
      return standingsOfficialCache.meta?.[standingsUiState.league] || null;
    }

    function standingsSeasonYear() {
      const league = standingsUiState.league;
      const perLeague = Number(standingsOfficialCache?.years?.[league]);
      const shared = Number(standingsOfficialCache?.year);
      return Number.isInteger(perLeague) && perLeague >= 1900
        ? perLeague
        : (Number.isInteger(shared) && shared >= 1900 ? shared : CURRENT_YEAR);
    }

    function standingsDisplayRows() {
      const section = standingsCurrentOfficialSection();
      if (Array.isArray(section?.rows) && section.rows.length) {
        return section.rows.map(row => standingsUiState.league === 'mlb' ? ({ ...row, team:mlbStandingsTeamZh(row?.team || row?.sourceTeam), official:true }) : ({ ...row, official:true }));
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

    function standingsExpectedGames() {
      if (standingsUiState.league === 'cpbl') return standingsUiState.cpblView === 'annual' ? 120 : 60;
      if (standingsUiState.league === 'npb') return 143;
      if (standingsUiState.league === 'kbo') return 144;
      return 162;
    }

    function standingsMinFinalPct(row) {
      const expected = standingsExpectedGames();
      const games = Math.max(0, Number(row?.games) || 0);
      const wins = Math.max(0, Number(row?.wins) || 0);
      const losses = Math.max(0, Number(row?.losses) || 0);
      const remaining = Math.max(0, expected - games);
      const denominator = wins + losses + remaining;
      return denominator > 0 ? wins / denominator : 0;
    }

    function standingsMaxFinalPct(row) {
      const expected = standingsExpectedGames();
      const games = Math.max(0, Number(row?.games) || 0);
      const wins = Math.max(0, Number(row?.wins) || 0);
      const losses = Math.max(0, Number(row?.losses) || 0);
      const remaining = Math.max(0, expected - games);
      const denominator = wins + losses + remaining;
      return denominator > 0 ? (wins + remaining) / denominator : 0;
    }

    function standingsClinchLabel(row, rows) {
      if (!row?.official || Number(row?.rank) !== 1 || !Array.isArray(rows) || rows.length < 2) return '';
      const leaderMin = standingsMinFinalPct(row);
      const rivals = rows.filter(other => other !== row && other?.official);
      if (!rivals.length) return '';
      const clinched = rivals.every(other => leaderMin > standingsMaxFinalPct(other) + 1e-12);
      if (!clinched) return '';

      if (standingsUiState.league === 'cpbl') {
        if (standingsUiState.cpblView === 'first') return '上半季封王';
        if (standingsUiState.cpblView === 'second') return '下半季封王';
        return '年度第一確定';
      }
      if (standingsUiState.league === 'npb') return standingsUiState.npbView === 'pacific' ? '洋聯封王' : '央聯封王';
      if (standingsUiState.league === 'kbo') return '例行賽第一確定';
      return `${standingsSubTitle()}封王`;
    }

    function standingsRecord(row) {
      if (!row?.official) return '—';
      return `${Number(row.wins) || 0}-${Number(row.losses) || 0}-${Number(row.ties) || 0}`;
    }

    function standingsPct(row) {
      if (!row?.official || !Number.isFinite(Number(row.pct))) return '—';
      return Number(row.pct).toFixed(3).replace(/^0/, '');
    }

    function standingsMagicNumber(row, rows) {
      if (!row?.official || Number(row?.rank) !== 1 || !Array.isArray(rows) || rows.length < 2) return '';
      const expected = standingsExpectedGames();
      const leaderWins = Math.max(0, Number(row?.wins) || 0);
      const rivals = rows.filter(other => other !== row && other?.official);
      if (!rivals.length) return '';
      const magic = Math.max(...rivals.map(other => {
        const losses = Math.max(0, Number(other?.losses) || 0);
        const ties = Math.max(0, Number(other?.ties) || 0);
        return Math.max(0, expected + 1 - leaderWins - losses - ties);
      }));
      return `M${magic}`;
    }

    function standingsGb(row, rows) {
      if (!row?.official) return '—';
      const magic = standingsMagicNumber(row, rows);
      if (magic) return magic;
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
        const liveBaseline = ['cpbl','npb'].includes(standingsUiState.league);
        return { title:'正在讀取戰績', detail:liveBaseline ? '正在讀取官方基準與即時結算狀態…' : '正在讀取官方戰績…', state:'loading' };
      }
      if (standingsOfficialError && !standingsOfficialCache) {
        return { title:'戰績讀取失敗', detail:standingsOfficialError, state:'error' };
      }

      const section = standingsCurrentOfficialSection();
      const meta = standingsCurrentMeta();
      const league = standingsLeagueCode();
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
        const liveBaseline = ['cpbl','npb'].includes(standingsUiState.league);
        if (!liveBaseline) {
          return {
            title:`${league} 官方戰績已載入`,
            detail:officialDate
              ? `官網資料截至 ${officialDate.replaceAll('-', '/')}｜例行賽進行中`
              : `抓取時間 ${fetched || '剛剛'}｜官方戰績定期更新`,
            state:'ok'
          };
        }
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

        const selectedKey = standingsUiState.league;
        const selectedSection = selectedKey === 'cpbl'
          ? data?.cpbl?.[standingsUiState.cpblView]
          : selectedKey === 'npb'
            ? data?.npb?.[standingsUiState.npbView]
            : selectedKey === 'kbo'
              ? data?.kbo?.regular
              : data?.mlb?.[standingsUiState.mlbView];

        if (!selectedSection) {
          const retryResponse = await fetch(LEAGUE_STANDINGS_API_URL, {
            method:'POST',
            headers:{ 'content-type':'application/json' },
            body:JSON.stringify({ appKey:CPBL_APP_KEY, league:standingsLeagueCode() })
          });
          const retryText = await retryResponse.text();
          let retryData = {};
          try { retryData = JSON.parse(retryText || '{}'); } catch {}
          if (retryResponse.ok && retryData?.ok === true && retryData?.[selectedKey]) {
            data = {
              ...data,
              [selectedKey]:retryData[selectedKey],
              years:{
                ...(data?.years || {}),
                [selectedKey]:Number(retryData?.years?.[selectedKey] || retryData?.year) || CURRENT_YEAR
              },
              meta:{
                ...(data?.meta || {}),
                [selectedKey]:retryData?.meta?.[selectedKey] || null
              },
              fetchedAt:retryData?.fetchedAt || data?.fetchedAt
            };
          }
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
      if (standingsUiState.league === 'cpbl') return standingsUiState.cpblView;
      if (standingsUiState.league === 'npb') return standingsUiState.npbView;
      if (standingsUiState.league === 'kbo') return 'regular';
      return standingsUiState.mlbView;
    }

    function standingsTeamDetailKey(team) {
      return `${standingsUiState.league}|${standingsSeasonYear()}|${standingsCurrentView()}|${team}`;
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
      const interleague = Array.isArray(data?.interleague) ? data.interleague : [];
      const divisionH2h = data?.divisionH2h && typeof data.divisionH2h === 'object' ? data.divisionH2h : {};
      const summary = data?.summary || null;
      const recent = Array.isArray(data?.recent) ? data.recent : [];
      const upcoming = Array.isArray(data?.upcoming) ? data.upcoming : [];

      let body = '';
      if (standingsTeamDetailLoading && !data) {
        body = `<div class="standings-team-detail-empty">正在讀取 ${escapeHtml(team)} 的資料…</div>`;
      } else if (standingsTeamDetailError && !data) {
        body = `<div class="standings-team-detail-empty error">${escapeHtml(standingsTeamDetailError)}</div>`;
      } else if (standingsTeamTab === 'h2h') {
        const h2hRows = (list, mode = 'default') => {
          const expectedFor = item => {
            const explicit = Number(item?.expectedGames);
            if (Number.isFinite(explicit) && explicit > 0) return explicit;
            if (standingsUiState.league === 'cpbl') return standingsUiState.cpblView === 'annual' ? 24 : 12;
            if (standingsUiState.league === 'npb') return mode === 'interleague' ? 3 : 25;
            if (standingsUiState.league === 'kbo') return 16;
            return 0;
          };
          return `
            <div class="standings-h2h-table">
              <div class="standings-h2h-head" aria-hidden="true">
                <span>球隊</span><span>應/已賽</span><span>勝率</span><span>戰績</span>
              </div>
              <div class="standings-h2h-list">${list.map(item => {
                const wins = Number(item?.wins) || 0;
                const losses = Number(item?.losses) || 0;
                const ties = Number(item?.ties) || 0;
                const played = Number.isFinite(Number(item?.playedGames)) ? Number(item.playedGames) : wins + losses + ties;
                const expected = expectedFor(item);
                const pctNumber = wins + losses > 0 ? wins / (wins + losses) : 0;
                const pct = pctNumber.toFixed(3).replace(/^0/, '');
                const pctTone = wins > losses
                  ? 'is-above'
                  : (wins < losses ? 'is-below' : 'is-equal');
                return `
                  <div class="standings-h2h-row">
                    <span class="standings-h2h-opponent">${escapeHtml(item.opponent)}</span>
                    <span class="standings-h2h-value">${expected || '—'}/${played}</span>
                    <span class="standings-h2h-value standings-h2h-pct ${pctTone}">${pct}</span>
                    <span class="standings-h2h-value standings-h2h-record">${wins}-${losses}-${ties}</span>
                  </div>
                `;
              }).join('')}</div>
            </div>
          `;
        };
        if (standingsUiState.league === 'npb') {
          body = `
            <div class="standings-h2h-section">
              <span class="standings-h2h-section-title">${standingsSubTitle()}對戰</span>
              ${h2h.length ? h2hRows(h2h) : '<div class="standings-team-detail-empty compact">目前沒有同聯盟對戰資料。</div>'}
            </div>
            <div class="standings-h2h-section">
              <span class="standings-h2h-section-title">交流賽</span>
              ${interleague.length ? h2hRows(interleague, 'interleague') : '<div class="standings-team-detail-empty compact">目前沒有交流賽資料。</div>'}
            </div>
          `;
        } else if (standingsUiState.league === 'mlb') {
          const divisions = [
            ['alEast','美國東區'],
            ['alCentral','美國中區'],
            ['alWest','美國西區'],
            ['nlEast','國家東區'],
            ['nlCentral','國家中區'],
            ['nlWest','國家西區']
          ];
          body = divisions.map(([key,label]) => {
            const rows = Array.isArray(divisionH2h?.[key]) ? divisionH2h[key] : [];
            return `
              <div class="standings-h2h-section">
                <span class="standings-h2h-section-title">${label}</span>
                ${rows.length ? h2hRows(rows) : '<div class="standings-team-detail-empty compact">目前沒有對戰資料。</div>'}
              </div>
            `;
          }).join('');
        } else {
          body = h2h.length
            ? h2hRows(h2h)
            : `<div class="standings-team-detail-empty">目前沒有可顯示的官方對戰戰績。</div>`;
        }
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

        const scheduledUpcomingHtml = upcoming.length
          ? upcoming.map(game => `
              <div class="standings-schedule-row">
                <div class="standings-schedule-date"><strong>${escapeHtml(String(game.date||'').slice(5).replace('-','/'))}</strong><span>${escapeHtml(game.time||'')}</span></div>
                <div class="standings-schedule-match"><strong>${escapeHtml(standingsGameOpponent(game,team))}</strong><span>${standingsGameSide(game,team)}場・${escapeHtml(game.venue||'')}</span></div>
                <div class="standings-schedule-result upcoming ${String(game.status||'')==='live'?'is-live':''}"><strong>${String(game.status||'')==='live'?'LIVE':'未開打'}</strong><span></span></div>
              </div>
            `).join('')
          : '';

        const expectedGames = Math.max(0, Number(summary?.expectedGames) || standingsExpectedGames());
        const playedGames = Math.max(0, Number(summary?.playedGames) || 0);
        const remainingGames = Math.max(0, expectedGames - playedGames);
        const scheduledRemaining = upcoming.filter(game => !['final','cancelled','canceled'].includes(String(game?.status || '').toLowerCase())).length;
        const missingScheduled = Math.max(0, remainingGames - scheduledRemaining);
        const scheduleCoveragePct = remainingGames > 0
          ? Math.min(100, Math.round((scheduledRemaining / remainingGames) * 100))
          : 100;

        let pendingScheduleHtml = '';
        let opponentPendingCount = 0;
        if (standingsUiState.league === 'npb') {
          const scheduledByOpponent = new Map();
          for (const game of upcoming) {
            const opponent = standingsGameOpponent(game, team);
            if (!opponent) continue;
            scheduledByOpponent.set(opponent, (scheduledByOpponent.get(opponent) || 0) + 1);
          }
          const pending = [];
          const collectPending = (list, fallbackExpected) => {
            for (const item of list) {
              const opponent = String(item?.opponent || '').trim();
              if (!opponent) continue;
              const wins = Number(item?.wins) || 0;
              const losses = Number(item?.losses) || 0;
              const ties = Number(item?.ties) || 0;
              const played = Number.isFinite(Number(item?.playedGames)) ? Number(item.playedGames) : wins + losses + ties;
              const explicitExpected = Number(item?.expectedGames);
              const expected = Number.isFinite(explicitExpected) && explicitExpected > 0 ? explicitExpected : fallbackExpected;
              const remaining = Math.max(0, expected - played);
              const scheduled = Number(scheduledByOpponent.get(opponent) || 0);
              const unscheduled = Math.max(0, remaining - scheduled);
              if (unscheduled > 0) pending.push({ opponent, count:unscheduled });
            }
          };
          collectPending(h2h, 25);
          collectPending(interleague, 3);
          opponentPendingCount = pending.reduce((sum,item) => sum + Number(item.count || 0), 0);
          pendingScheduleHtml = pending.map(item => `
            <div class="standings-schedule-row is-pending">
              <div class="standings-schedule-date"><strong>待定</strong><span>${item.count} 場</span></div>
              <div class="standings-schedule-match"><strong>${escapeHtml(item.opponent)}</strong><span>尚未取得確切比賽日期</span></div>
              <div class="standings-schedule-result upcoming"><strong>待排定</strong><span></span></div>
            </div>
          `).join('');
        }

        const unresolvedGeneric = Math.max(0, missingScheduled - opponentPendingCount);
        if (unresolvedGeneric > 0) {
          pendingScheduleHtml += `
            <div class="standings-schedule-row is-missing">
              <div class="standings-schedule-date"><strong>缺 ${unresolvedGeneric}</strong><span>場</span></div>
              <div class="standings-schedule-match"><strong>尚未取得賽程</strong><span>可能尚未排定，或來源目前少抓資料</span></div>
              <div class="standings-schedule-result upcoming"><strong>待補齊</strong><span></span></div>
            </div>
          `;
        }

        const upcomingHtml = scheduledUpcomingHtml || pendingScheduleHtml
          ? `${scheduledUpcomingHtml}${pendingScheduleHtml}`
          : `<div class="standings-team-detail-empty compact">目前沒有抓到接下來的賽程。</div>`;

        const coverageState = missingScheduled > 0 ? 'is-incomplete' : 'is-complete';
        body = `
          <div class="standings-schedule-dashboard">
            <div><span>應賽</span><strong>${expectedGames || '—'}</strong></div>
            <div><span>已賽</span><strong>${playedGames}</strong></div>
            <div><span>剩餘</span><strong>${remainingGames}</strong></div>
            <div><span>已取得</span><strong>${scheduledRemaining}</strong></div>
          </div>
          <div class="standings-schedule-coverage ${coverageState}">
            <div>
              <strong>${missingScheduled > 0 ? `賽程缺 ${missingScheduled} 場` : '剩餘賽程已完整取得'}</strong>
              <span>${remainingGames > 0 ? `目前已取得 ${scheduledRemaining}/${remainingGames} 場（${scheduleCoveragePct}%）` : '本季已無剩餘例行賽'}</span>
            </div>
            <b>${scheduleCoveragePct}%</b>
          </div>
          <div class="standings-schedule-section"><span class="standings-schedule-section-title">已完成賽事</span>${recentHtml}</div>
          <div class="standings-schedule-section"><span class="standings-schedule-section-title">剩餘賽程・已取得 ${scheduledRemaining}/${remainingGames}</span>${upcomingHtml}</div>
        `;
      }

      return `
        <section class="standings-team-detail" id="standingsTeamDetail">
          <div class="standings-team-detail-head">
            <div class="standings-team-detail-heading">
              <span>${standingsLeagueCode()} ${Number(data?.seasonYear) || standingsSeasonYear()}・${standingsSubTitle()}</span>
              <div class="standings-team-title-line">
                <strong>${escapeHtml(team)}</strong>
                ${summary ? `<span class="standings-team-game-count"><b>應賽 ${Number(summary.expectedGames)||0}</b><i></i><b>已賽 ${Number(summary.playedGames)||0}</b></span>` : ''}
              </div>
            </div>
            <button type="button" class="standings-team-detail-close" data-standings-team-close aria-label="關閉球隊詳情">×</button>
          </div>
          <div class="standings-team-detail-tabs">
            <button type="button" class="${standingsTeamTab==='h2h'?'active':''}" data-standings-team-tab="h2h">對戰成績</button>
            <button type="button" class="${standingsTeamTab==='schedule'?'active':''}" data-standings-team-tab="schedule">賽程中心</button>
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
            view:standingsCurrentView(),
            force:Boolean(force)
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
      const league = standingsUiState.league;
      const isCpbl = league === 'cpbl';
      const isNpb = league === 'npb';
      const isKbo = league === 'kbo';
      const isMlb = league === 'mlb';
      const rows = standingsDisplayRows();
      const status = standingsStatusMeta();
      const hasOfficial = rows.some(row => row.official);

      let secondary = '';
      let secondaryClass = 'is-one';
      let secondaryLabel = '聯盟分區';
      if (isCpbl) {
        secondaryClass = 'is-three';
        secondaryLabel = '中職季別';
        secondary = [
          standingsButton('上半季','first',standingsUiState.cpblView === 'first','data-standings-cpbl'),
          standingsButton('下半季','second',standingsUiState.cpblView === 'second','data-standings-cpbl'),
          standingsButton('全年度','annual',standingsUiState.cpblView === 'annual','data-standings-cpbl')
        ].join('');
      } else if (isNpb) {
        secondaryClass = 'is-two';
        secondaryLabel = '日職聯盟';
        secondary = [
          standingsButton('央聯','central',standingsUiState.npbView === 'central','data-standings-npb'),
          standingsButton('洋聯','pacific',standingsUiState.npbView === 'pacific','data-standings-npb')
        ].join('');
      } else if (isKbo) {
        secondaryLabel = '韓職聯盟';
        secondary = standingsButton('例行賽','regular',true,'data-standings-kbo');
      } else {
        secondaryClass = 'is-six';
        secondaryLabel = '美職分區';
        secondary = [
          standingsButton('美國東區','alEast',standingsUiState.mlbView === 'alEast','data-standings-mlb'),
          standingsButton('美國中區','alCentral',standingsUiState.mlbView === 'alCentral','data-standings-mlb'),
          standingsButton('美國西區','alWest',standingsUiState.mlbView === 'alWest','data-standings-mlb'),
          standingsButton('國家東區','nlEast',standingsUiState.mlbView === 'nlEast','data-standings-mlb'),
          standingsButton('國家中區','nlCentral',standingsUiState.mlbView === 'nlCentral','data-standings-mlb'),
          standingsButton('國家西區','nlWest',standingsUiState.mlbView === 'nlWest','data-standings-mlb')
        ].join('');
      }

      els.standingsPageContent.innerHTML = `
        <div class="standings-controls">
          <div class="standings-primary-tabs" aria-label="聯盟">
            ${standingsButton('中華職棒','cpbl',isCpbl,'data-standings-league')}
            ${standingsButton('日本職棒','npb',isNpb,'data-standings-league')}
            ${standingsButton('韓國職棒','kbo',isKbo,'data-standings-league')}
            ${standingsButton('美國職棒','mlb',isMlb,'data-standings-league')}
          </div>
          <div class="standings-secondary-tabs ${secondaryClass}" aria-label="${secondaryLabel}">
            ${secondary}
          </div>
        </div>

        <div class="standings-overview">
          <div class="standings-overview-copy">
            <span class="standings-overview-label">${standingsLeagueCode()} ${standingsSeasonYear()}</span>
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
            <span>排名</span><span>球隊</span><span>戰績</span><span>勝率</span><span>勝差</span>
          </div>
          <div class="standings-table-body">
            ${rows.map(row => `
              <button type="button" class="standings-team-row ${standingsSelectedTeam === String(row.team || '') ? 'selected' : ''}" data-standings-team="${escapeHtml(String(row.team || ''))}">
                <span class="standings-rank">${escapeHtml(String(row.rank ?? '—'))}</span>
                <span class="standings-team-name">
                  <span class="standings-team-name-text">${escapeHtml(standingsTeamTableLabel(row))}</span>
                  ${standingsClinchLabel(row, rows) ? `<span class="standings-clinch-badge">${escapeHtml(standingsClinchLabel(row, rows))}</span>` : ''}
                </span>
                <span class="standings-record">${escapeHtml(standingsRecord(row))}</span>
                <span class="standings-pct">${escapeHtml(standingsPct(row))}</span>
                <span class="standings-gb ${standingsMagicNumber(row, rows) ? 'is-magic' : ''}">${escapeHtml(standingsGb(row, rows))}</span>
              </button>
            `).join('')}
          </div>
        </div>

        ${standingsTeamDetailHtml(standingsSelectedTeam)}

        <div class="standings-flow-note">
          <span class="standings-flow-icon" aria-hidden="true">✓</span>
          <span>${isCpbl || isNpb
            ? '官方基準由 B 後端保存；比賽 Final 後直接更新勝敗和，跨日再與官方戰績核對。'
            : '官方戰績由 B 後端集中快取；韓職與美職目前以官方排名定期刷新。'}</span>
        </div>
      `;

      els.standingsPageContent.querySelectorAll('[data-standings-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = String(btn.dataset.standingsLeague || '');
          if (!['cpbl','npb','kbo','mlb'].includes(value)) return;
          standingsUiState.league = value;
          standingsSelectedTeam = '';
          standingsTeamDetailError = '';
          localStorage.setItem('standingsLeague', standingsUiState.league);
          renderStandingsPage();
          if (!standingsCurrentOfficialSection()) void loadOfficialStandings({ force:true });
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
      els.standingsPageContent.querySelectorAll('[data-standings-mlb]').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = String(btn.dataset.standingsMlb || '');
          if (!['alEast','alCentral','alWest','nlEast','nlCentral','nlWest'].includes(value)) return;
          standingsUiState.mlbView = value;
          standingsSelectedTeam = '';
          standingsTeamDetailError = '';
          localStorage.setItem('standingsMlbView', value);
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
          void loadStandingsTeamDetail(team, { force:false });
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

      if (!standingsOfficialCache && !standingsOfficialLoading) void loadOfficialStandings();
      ensureStandingsAutoRefresh();
    }
