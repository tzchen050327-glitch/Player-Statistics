    function playerScope(player) {
      const scope = String(player?.scope || '').trim();
      return scope === 'international' || scope === 'overseas' ? scope : 'cpbl';
    }

    function scopeLabel(scope) {
      if (scope === 'international') return '國際賽';
      if (scope === 'overseas') return '國外聯盟';
      return '中職';
    }

    function specialOptionsForScope(scope) {
      return scope === 'international'
        ? INTERNATIONAL_COMPETITIONS
        : scope === 'overseas'
          ? OVERSEAS_LEAGUES
          : [];
    }

    function playerSpecialCompetition(player) {
      if (isUsPlayer(player)) return '美國職棒';
      return String(player?.externalCompetition || '').trim();
    }

    function normalizeInternationalTeamName(value = '') {
      const raw = String(value || '').trim();
      return INTERNATIONAL_TEAM_NAME_MAP[raw] || raw;
    }

    function internationalEdition(player) {
      const year = Math.floor(Number(player?.externalYear) || 0);
      return year > 0 ? String(year) : '';
    }

    function internationalTeam(player) {
      return normalizeInternationalTeamName(player?.externalTeam || '');
    }

    function internationalRosterKey(competition, year, team) {
      return [String(competition||''),String(year||''),normalizeInternationalTeamName(team||'')].join('|');
    }

    function internationalTeamListKey(competition, year) {
      return [String(competition||''), String(year||'')].join('|');
    }

    async function loadInternationalTeams(competition, year) {
      const key=internationalTeamListKey(competition,year);
      if (!competition || !year || internationalTeamCache.has(key) || internationalTeamLoading.has(key)) return;
      internationalTeamLoading.add(key);
      try {
        const data=await baseballRequest('international-teams',{competition,year:Number(year)});
        const teams=Array.isArray(data?.teams) ? data.teams.map(normalizeInternationalTeamName).filter(Boolean) : [];
        internationalTeamCache.set(key,[...new Set(teams)]);
      } catch (error) {
        console.error('國際賽球隊載入失敗',error);
        internationalTeamCache.set(key,[]);
      } finally {
        internationalTeamLoading.delete(key);
        if (homeZone==='international' && homeSpecialFilter===competition && String(homeInternationalEditionFilter)===String(year)) {
          renderRecentPlayers();
        }
      }
    }

    async function syncStoredInternationalRosterMetadata(competition, year, team, entries = []) {
      const normalizedTeam = normalizeInternationalTeamName(team);
      for (const entry of entries || []) {
        const officialId = String(entry?.id || '');
        const officialName = String(entry?.name || '');
        const player = players.find(p =>
          playerScope(p) === 'international'
          && playerSpecialCompetition(p) === competition
          && internationalEdition(p) === String(year)
          && internationalTeam(p) === normalizedTeam
          && (
            (officialId && String(p.externalPlayerId || '') === officialId)
            || (officialName && String(p.externalOfficialName || '') === officialName)
          )
        );
        if (!player) continue;

        let changed = false;
        const number = String(entry?.number || '').trim();
        if (number && number !== '—' && String(player.number || '') !== number) {
          player.number = number;
          changed = true;
        }
        if (entry?.zhName && player.name !== entry.zhName) {
          player.name = entry.zhName;
          changed = true;
        }
        if (officialName && player.externalOfficialName !== officialName) {
          player.externalOfficialName = officialName;
          changed = true;
        }
        if (entry?.position && player.externalPosition !== entry.position) {
          player.externalPosition = entry.position;
          changed = true;
        }
        if (changed) {
          player.updatedAt = Date.now();
          await savePlayer(player);
        }
      }
    }

    async function loadInternationalRoster(competition, year, team) {
      const key=internationalRosterKey(competition,year,team);
      if (!competition || !year || !team || internationalRosterCache.has(key) || internationalRosterLoading.has(key)) return;
      internationalRosterLoading.add(key);
      try {
        const data=await baseballRequest('international-roster',{competition,year:Number(year),team});
        const roster=data.roster||{players:[]};
        internationalRosterCache.set(key,roster);
        await syncStoredInternationalRosterMetadata(competition,year,team,roster.players||[]);
      } catch (error) {
        console.error('國際賽 roster 載入失敗',error);
        internationalRosterCache.set(key,{players:[],error:error?.message||'球員名單載入失敗'});
      } finally {
        internationalRosterLoading.delete(key);
        if (homeZone==='international' && homeSpecialFilter===competition && String(homeInternationalEditionFilter)===String(year) && homeInternationalTeamFilter===team) {
          renderRecentPlayers();
        }
      }
    }

    async function openInternationalRosterPlayer(entry, competition, year, team) {
      if (!entry) return;
      const officialId=String(entry.id||'');
      let player=players.find(p =>
        playerScope(p)==='international'
        && playerSpecialCompetition(p)===competition
        && internationalEdition(p)===String(year)
        && internationalTeam(p)===normalizeInternationalTeamName(team)
        && (String(p.externalPlayerId||'')===officialId || String(p.externalOfficialName||'')===String(entry.name||''))
      );

      if (!player) {
        let type=entry.type==='pitcher'?'pitcher':'hitter';
        if (type==='pitcher' && !entry.pitcher && entry.hitter) type='hitter';
        if (type==='hitter' && !entry.hitter && entry.pitcher) type='pitcher';
        player={
          id:uid(),
          name:entry.zhName||entry.name||'未命名球員',
          number:String(entry.number||'—'),
          type,
          scope:'international',
          stats:type==='pitcher'
            ? externalPitcherStatsToLocal(entry.pitcher||{})
            : externalHitterStatsToLocal(entry.hitter||{}),
          pitcherLastMetric:type==='pitcher'?'wl':undefined,
          selectedPhotoId:null,photoTransforms:{},
          externalCompetition:competition,
          externalTeam:normalizeInternationalTeamName(team),
          externalYear:Number(year)||CURRENT_YEAR,
          externalProvider:'INT',
          externalPlayerId:officialId,
          externalOfficialName:entry.name||'',
          externalPosition:entry.position||'',
          internationalSource:'MLB International Baseball',
          createdAt:Date.now(),updatedAt:Date.now(),lastUsedAt:Date.now()
        };
        await savePlayer(player);
      } else {
        player.name=entry.zhName||player.name||entry.name;
        player.number=String(entry.number||player.number||'—');
        player.externalOfficialName=entry.name||player.externalOfficialName||'';
        player.externalPosition=entry.position||player.externalPosition||'';
        if (player.type==='pitcher' && entry.pitcher) player.stats=externalPitcherStatsToLocal(entry.pitcher);
        if (player.type==='hitter' && entry.hitter) player.stats=externalHitterStatsToLocal(entry.hitter);
        await savePlayer(player);
      }
      await selectPlayer(player.id);
    }
    function renderInternationalExplorer() {
      if (!els.homeInternationalExplorer) return;
      if (homeZone !== 'international') {
        els.homeInternationalExplorer.classList.add('hidden');
        els.homeInternationalExplorer.innerHTML = '';
        return;
      }

      const zonePlayers = players.filter(p => playerScope(p) === 'international');
      const competition = homeSpecialFilter || '';
      const years = competition ? (INTERNATIONAL_TOURNAMENT_YEARS[competition] || []) : [];
      if (homeInternationalEditionFilter && !years.map(String).includes(String(homeInternationalEditionFilter))) {
        homeInternationalEditionFilter = '';
      }

      const year = homeInternationalEditionFilter || '';
      const matchingYearPlayers = competition && year
        ? zonePlayers.filter(p => playerSpecialCompetition(p) === competition && internationalEdition(p) === String(year))
        : [];
      const teamListKey=competition&&year ? internationalTeamListKey(competition,year) : '';
      const catalogTeams = INTERNATIONAL_TEAM_CATALOG[`${competition}:${year}`] || [];
      const remoteTeams = teamListKey ? (internationalTeamCache.get(teamListKey) || []) : [];
      if (competition && year && !internationalTeamCache.has(teamListKey) && !internationalTeamLoading.has(teamListKey)) {
        void loadInternationalTeams(competition,year);
      }
      const teams = [...new Set([
        ...catalogTeams,
        ...remoteTeams,
        ...matchingYearPlayers.map(internationalTeam).filter(Boolean)
      ])].sort((a,b) => a.localeCompare(b,'zh-Hant'));
      if (homeInternationalTeamFilter && !teams.includes(homeInternationalTeamFilter)) {
        homeInternationalTeamFilter = '';
      }

      const team = homeInternationalTeamFilter || '';
      const localTeamPlayers = competition && year && team
        ? matchingYearPlayers.filter(p => internationalTeam(p) === team)
        : [];
      localTeamPlayers.sort((a,b) => String(a.number||'').localeCompare(String(b.number||''),'zh-Hant',{numeric:true}));
      const rosterKey=competition&&year&&team ? internationalRosterKey(competition,year,team) : '';
      const rosterData=rosterKey ? internationalRosterCache.get(rosterKey) : null;
      const remotePlayers=Array.isArray(rosterData?.players) ? rosterData.players : [];
      if (competition && year && team && !rosterData && !internationalRosterLoading.has(rosterKey)) {
        void loadInternationalRoster(competition,year,team);
      }

      const competitionOptions = ['<option value="">選擇賽事</option>']
        .concat(INTERNATIONAL_COMPETITIONS.map(key => {
          const meta=INTERNATIONAL_TOURNAMENT_META[key]||{name:key};
          return '<option value="'+escapeHtml(key)+'" '+(competition===key?'selected':'')+'>'+escapeHtml(meta.name)+'</option>';
        })).join('');
      const yearOptions = ['<option value="">選擇年份</option>']
        .concat(years.map(value => '<option value="'+value+'" '+(String(year)===String(value)?'selected':'')+'>'+value+'</option>')).join('');
      const teamOptions = ['<option value="">選擇球隊</option>']
        .concat(teams.map(value => '<option value="'+escapeHtml(value)+'" '+(team===value?'selected':'')+'>'+escapeHtml(value)+'</option>')).join('');
      let playerOptions = ['<option value="">'+(internationalRosterLoading.has(rosterKey)?'載入球員中…':'選擇球員')+'</option>'];
      if (remotePlayers.length) {
        playerOptions=playerOptions.concat(remotePlayers.map(player =>
          '<option value="remote:'+escapeHtml(player.id)+'">#'+escapeHtml(player.number||'—')+' '+escapeHtml(player.zhName||player.name)+'</option>'
        ));
      } else {
        playerOptions=playerOptions.concat(localTeamPlayers.map(player =>
          '<option value="local:'+escapeHtml(player.id)+'">#'+escapeHtml(player.number)+' '+escapeHtml(player.name)+'</option>'
        ));
      }
      playerOptions=playerOptions.join('');

      const path = [
        competition ? (INTERNATIONAL_TOURNAMENT_META[competition]?.name || competition) : '',
        year,
        team
      ].filter(Boolean).join(' → ');

      let emptyText='';
      if (competition && year && !teams.length) {
        emptyText=internationalTeamLoading.has(teamListKey)?'正在載入這屆參賽球隊…':'這個賽事年份目前沒有可用的球隊資料。';
      } else if (competition && year && team && rosterData?.error) {
        emptyText='球員名單讀取失敗：'+rosterData.error;
      } else if (competition && year && team && rosterData && !remotePlayers.length && !localTeamPlayers.length) {
        emptyText='官方來源目前沒有回傳這支代表隊的球員名單。';
      }

      els.homeInternationalExplorer.innerHTML =
        '<div class="intl-explorer-head"><strong>國際賽資料庫</strong><span>賽事 → 年份 → 球隊 → 球員</span></div>' +
        '<div class="intl-select-flow">' +
          '<label class="intl-select-step"><span>1．賽事</span><select id="intlCompetitionSelect">'+competitionOptions+'</select></label>' +
          '<label class="intl-select-step"><span>2．年份</span><select id="intlYearSelect" '+(!competition?'disabled':'')+'>'+yearOptions+'</select></label>' +
          '<label class="intl-select-step"><span>3．球隊</span><select id="intlTeamSelect" '+(!(competition&&year)?'disabled':'')+'>'+teamOptions+'</select></label>' +
          '<label class="intl-select-step"><span>4．球員</span><select id="intlPlayerSelect" '+(!(competition&&year&&team)?'disabled':'')+'>'+playerOptions+'</select></label>' +
        '</div>' +
        (path ? '<div class="intl-flow-path">'+escapeHtml(path)+'</div>' : '') +
        (emptyText ? '<div class="intl-flow-empty">'+escapeHtml(emptyText)+'</div>' : '');
      els.homeInternationalExplorer.classList.remove('hidden');

      const competitionSelect=document.getElementById('intlCompetitionSelect');
      const yearSelect=document.getElementById('intlYearSelect');
      const teamSelect=document.getElementById('intlTeamSelect');
      const playerSelect=document.getElementById('intlPlayerSelect');

      competitionSelect?.addEventListener('change', () => {
        homeSpecialFilter=competitionSelect.value||'';
        homeInternationalEditionFilter='';
        homeInternationalTeamFilter='';
        renderRecentPlayers();
      });
      yearSelect?.addEventListener('change', () => {
        homeInternationalEditionFilter=yearSelect.value||'';
        homeInternationalTeamFilter='';
        renderRecentPlayers();
      });
      teamSelect?.addEventListener('change', () => {
        homeInternationalTeamFilter=teamSelect.value||'';
        renderRecentPlayers();
      });
      playerSelect?.addEventListener('change', async () => {
        const value=playerSelect.value||'';
        if (!value) return;
        if (value.startsWith('local:')) {
          await selectPlayer(value.slice(6));
          return;
        }
        if (value.startsWith('remote:')) {
          const id=value.slice(7);
          const entry=remotePlayers.find(item => String(item.id)===id);
          if (entry) await openInternationalRosterPlayer(entry,competition,year,team);
        }
      });
    }
    function playerDisplayTeam(player) {
      if (playerScope(player) === 'cpbl') return normalizeTeamName(player?.cpblTeam || '');
      if (isUsPlayer(player)) return String(player?.externalCurrentOrganization || player?.externalCurrentTeam || player?.externalTeam || '').trim();
      return String(player?.externalTeam || '').trim();
    }

    function playerSourceMeta(player) {
      const scope = playerScope(player);
      if (scope === 'cpbl') {
        return [
          player.type === 'pitcher' ? '投手' : '打者',
          player.cpblDualRole ? '雙角色' : '',
          normalizeTeamName(player.cpblTeam || '')
        ].filter(Boolean).join('｜');
      }
      if (isUsPlayer(player)) {
        const team = String(player.externalCurrentOrganization || player.externalCurrentTeam || player.externalTeam || '').trim();
        const level = String(player.externalCurrentLevel || (
          String(player.externalProvider || '').toUpperCase() === 'MLB' ? 'MLB'
            : String(player.externalProvider || '').toUpperCase() === 'MILB' ? 'MiLB' : ''
        )).trim();
        return [team || '目前球隊未同步', level || 'MLB / MiLB'].filter(Boolean).join('｜');
      }
      return [
        player.type === 'pitcher' ? '投手' : '打者',
        (player.externalTwoWay || player.hasCrossRoleStats) ? '投打皆有紀錄' : '',
        playerSpecialCompetition(player),
        scope === 'international' ? internationalTeam(player) : String(player.externalTeam || '').trim(),
        Number(player.externalYear) || ''
      ].filter(Boolean).join('｜');
    }

    function playerSourceInfoHtml(player) {
      const scope = playerScope(player);
      if (scope === 'cpbl') {
        return player.cpblAcnt
          ? `<div class="small" style="margin-top:8px">中職：${escapeHtml(player.cpblTeam || '')}｜${selectedSeason} ${cpblLevelLabel(selectedLevel)}｜自動同步｜CPBL ID ${escapeHtml(player.cpblAcnt)}${(player.cpblLastUpdatedByProfile?.[statsProfileKey()] || player.cpblLastUpdatedAt) ? `｜上次更新 ${new Date(player.cpblLastUpdatedByProfile?.[statsProfileKey()] || player.cpblLastUpdatedAt).toLocaleString('zh-TW')}` : ''}</div>`
          : '';
      }

      if (isUsPlayer(player) && player.externalPlayerId) {
        const entry = currentUsCareerEntry(player);
        const selected = entry
          ? [entry.year, entry.organizationName || entry.teamName || '球隊未提供', entry.level || 'MiLB'].filter(Boolean).join('｜')
          : '年份／球隊／層級尚未同步';
        const current = [
          player.externalCurrentOrganization || player.externalCurrentTeam || player.externalTeam || '',
          player.externalCurrentLevel || ''
        ].filter(Boolean).join('｜');
        const synced = player.externalLastUpdatedAt
          ? `｜上次更新 ${new Date(player.externalLastUpdatedAt).toLocaleString('zh-TW')}`
          : '';
        return `<div class="small" style="margin-top:8px">美國職棒｜目前 ${escapeHtml(current || '未同步')}｜查看 ${escapeHtml(selected)}｜MLB ID ${escapeHtml(player.externalPlayerId)}${synced}</div>`;
      }

      const detail = [
        scopeLabel(scope),
        playerSpecialCompetition(player),
        String(player.externalTeam || '').trim(),
        Number(player.externalYear) || ''
      ].filter(Boolean).join('｜');
      if (scope === 'international') {
        const synced = player.externalLastUpdatedAt
          ? `｜上次同步 ${new Date(player.externalLastUpdatedAt).toLocaleString('zh-TW')}`
          : player.externalLastCheckedAt
            ? `｜上次檢查 ${new Date(player.externalLastCheckedAt).toLocaleString('zh-TW')}`
            : '';
        const source = player.internationalSource ? `｜來源 ${escapeHtml(player.internationalSource)}` : '';
        return `<div class="small" style="margin-top:8px">${escapeHtml(detail)}｜自動同步${source}${synced}</div>`;
      }
      if (scope === 'overseas' && player.externalProvider && player.externalPlayerId) {
        const synced = player.externalLastUpdatedAt
          ? `｜上次更新 ${new Date(player.externalLastUpdatedAt).toLocaleString('zh-TW')}`
          : '';
        return `<div class="small" style="margin-top:8px">${escapeHtml(detail)}｜自動同步｜${escapeHtml(overseasProviderLabel(player.externalProvider))} ID ${escapeHtml(player.externalPlayerId)}${synced}</div>`;
      }
      return `<div class="small" style="margin-top:8px">${escapeHtml(detail || scopeLabel(scope))}｜獨立資料，不與中職累積成績共用</div>`;
    }

    function homePlayerTeam(player) {
      const raw = normalizeTeamName(player?.cpblTeam || '').replace(/二軍$/, '').trim();
      return normalizeTeamName(raw);
    }

    function homePlayerLevel(player) {
      const team = homePlayerTeam(player);
      const recognized = OPPONENTS.some(item => item.name === team);

      // 未連結 CPBL 或不屬於六隊的球員，歸到「其他」。
      if (!player?.cpblAcnt || !recognized) return 'OTHER';

      if (player?.cpblCurrentLevel === 'D') return 'D';
      if (player?.cpblCurrentLevel === 'A') return 'A';
      return /二軍/.test(String(player?.cpblTeam || '')) ? 'D' : 'A';
    }

    function currentProLeague() {
      if (homeProCountry === 'TW') return 'CPBL';
      if (homeProCountry === 'US') return '美國職棒';
      if (homeProCountry === 'JP') return 'NPB';
      if (homeProCountry === 'KR') return 'KBO';
      return 'CPBL';
    }

    function applyHomeProSelection() {
      homeRootSection = 'pro';
      if (homeProCountry === 'TW') {
        homeZone = 'cpbl';
        homeSpecialFilter = '';
        return;
      }
      homeZone = 'overseas';
      homeSpecialFilter = currentProLeague();
    }

    function homeContextPlayers() {
      if (homeRootSection === 'international' || homeZone === 'international') {
        return players.filter(player => playerScope(player) === 'international');
      }
      if (homeProCountry === 'TW') {
        return players.filter(player => playerScope(player) === 'cpbl');
      }
      if (homeProCountry === 'US') {
        const list = players.filter(player => isUsPlayer(player));
        const seen = new Set();
        return list.filter(player => {
          const key = String(player.externalPlayerId || player.id || '');
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      const league = currentProLeague();
      return players.filter(player =>
        playerScope(player) === 'overseas'
        && String(playerSpecialCompetition(player) || player.externalProvider || '').toUpperCase() === league.toUpperCase()
      );
    }

    function homePageBreadcrumb() {
      if (homeRootSection === 'international') return '首頁｜國際賽';
      if (homeProCountry === 'TW') return '首頁｜各國職棒｜台灣';
      if (homeProCountry === 'US') return '首頁｜各國職棒｜美國';
      if (homeProCountry === 'JP') return '首頁｜各國職棒｜日本｜NPB';
      if (homeProCountry === 'KR') return '首頁｜各國職棒｜韓國｜KBO';
      return '首頁｜各國職棒';
    }

    function renderHomePlayerFilters() {
      const international = homeRootSection === 'international';
      if (international) homeZone = 'international';
      else applyHomeProSelection();

      els.homeZoneSwitch?.querySelectorAll('[data-home-root]').forEach(button => {
        button.classList.toggle('active', button.dataset.homeRoot === homeRootSection);
      });

      els.homeProCountrySwitch?.classList.toggle('hidden', international);
      els.homeProCountrySwitch?.querySelectorAll('[data-pro-country]').forEach(button => {
        button.classList.toggle('active', button.dataset.proCountry === homeProCountry);
      });

      els.homeUsLeagueSwitch?.classList.add('hidden');

      const cpbl = !international && homeProCountry === 'TW';
      els.homeDailyGames?.classList.toggle('hidden', international);
      els.homeSpecialFilters?.classList.add('hidden');
      els.homeInternationalExplorer?.classList.toggle('hidden', !international);
      document.querySelector('.home-player-head')?.classList.toggle('hidden', international);
      const homeActions = document.querySelector('.home-player-actions');
      homeActions?.classList.toggle('hidden', international);
      homeActions?.classList.remove('international-actions');
      document.getElementById('addPlayerBtn')?.classList.remove('hidden');
      els.recent?.classList.toggle('hidden', international);

      if (els.homePlayerTitle) {
        if (international) els.homePlayerTitle.textContent = '國際賽';
        else if (homeProCountry === 'TW') els.homePlayerTitle.textContent = '台灣｜中華職棒';
        else if (homeProCountry === 'US') els.homePlayerTitle.textContent = '美國｜MLB / MiLB';
        else if (homeProCountry === 'JP') els.homePlayerTitle.textContent = '日本｜NPB';
        else if (homeProCountry === 'KR') els.homePlayerTitle.textContent = '韓國｜KBO';
        else els.homePlayerTitle.textContent = '各國職棒';
      }

      if (els.homeZoneNote) {
        if (international) {
          els.homeZoneNote.classList.remove('hidden');
          els.homeZoneNote.textContent = '請依序選擇「賽事 → 年份 → 球隊 → 球員」。';
        } else {
          els.homeZoneNote.classList.add('hidden');
          els.homeZoneNote.textContent = '';
        }
      }

      renderInternationalExplorer();
    }

    const homeDailyGamesCache = new Map();
    const homeDailyGamesLoading = new Set();
    const homeGameDetailCache = new Map();
    const HOME_GAME_DETAIL_AUTO_LIMIT = 2400;
    const HOME_GAME_DETAIL_AUTO_STORAGE_KEY = 'home-game-detail-auto-budget-v1';
    let activeHomeGameDetail = null;
    let homeGameDetailRefreshTimer = 0;
    let homeGameDetailCountdownTimer = 0;
    let homeGameDetailNextRefreshAt = 0;
    let homeGameDetailErrorStreak = 0;
    const HOME_DAILY_GAMES_TTL = 30 * 1000;
    const HOME_DAILY_GAMES_FORCE_FLOOR = 15 * 1000;
    const HOME_DAILY_AUTO_REFRESH_LIMIT = 2400;
    const HOME_DAILY_AUTO_REFRESH_STORAGE_KEY = 'home-daily-games-auto-refresh-budget-v1';
    let homeDailyGamesRefreshTimer = 0;

    function homeDailyGamesAutoRefreshBudget() {
      const day = localISODate();
      try {
        const raw = JSON.parse(localStorage.getItem(HOME_DAILY_AUTO_REFRESH_STORAGE_KEY) || '{}');
        if (raw?.day === day) return { day, count:Math.max(0, Number(raw.count) || 0) };
      } catch {}
      return { day, count:0 };
    }

    function homeDailyGamesAutoRefreshAvailable() {
      return homeDailyGamesAutoRefreshBudget().count < HOME_DAILY_AUTO_REFRESH_LIMIT;
    }

    function consumeHomeDailyGamesAutoRefresh() {
      const state = homeDailyGamesAutoRefreshBudget();
      if (state.count >= HOME_DAILY_AUTO_REFRESH_LIMIT) return false;
      try {
        localStorage.setItem(HOME_DAILY_AUTO_REFRESH_STORAGE_KEY, JSON.stringify({ day:state.day, count:state.count + 1 }));
      } catch {}
      return true;
    }

    function homeDailyGamesHasLive(games = []) {
      return Array.isArray(games) && games.some(game => String(game?.status || '').toLowerCase() === 'live');
    }

    function homeDailyGamesStartMs(league, date, time) {
      const m = String(time || '').match(/(\d{1,2}):(\d{2})/);
      if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return NaN;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
      const offsetHours = league === 'NPB' || league === 'KBO' ? 9 : league === 'MLB' ? -4 : 8;
      const [y, mo, d] = String(date).split('-').map(Number);
      return Date.UTC(y, mo - 1, d, hh - offsetHours, mm, 0, 0);
    }

    function homeDailyGamesRefreshDelay(league, date, games = []) {
      if (String(date || '') !== localISODate()) return 0;
      if (homeDailyGamesHasLive(games)) {
        // MLB games span much more of the day, so poll it less aggressively.
        return league === 'MLB' ? 2 * 60 * 1000 : league === 'NPB' ? 45 * 1000 : 30 * 1000;
      }
      const scheduled = (Array.isArray(games) ? games : []).filter(game => String(game?.status || '').toLowerCase() === 'scheduled');
      if (!scheduled.length) return 0;
      const starts = scheduled.map(game => homeDailyGamesStartMs(league, date, game?.time)).filter(Number.isFinite);
      if (!starts.length) return 60 * 60 * 1000;
      const msUntil = Math.min(...starts) - Date.now();
      if (msUntil <= 15 * 60 * 1000) return 2 * 60 * 1000;
      if (msUntil <= 60 * 60 * 1000) return 10 * 60 * 1000;
      if (msUntil <= 3 * 60 * 60 * 1000) return 20 * 60 * 1000;
      return 60 * 60 * 1000;
    }

    function stopHomeDailyGamesAutoRefresh() {
      if (homeDailyGamesRefreshTimer) clearTimeout(homeDailyGamesRefreshTimer);
      homeDailyGamesRefreshTimer = 0;
    }

    function scheduleHomeDailyGamesAutoRefresh() {
      stopHomeDailyGamesAutoRefresh();
      if (activeHomeGameDetail) return;
      if (document.visibilityState !== 'visible' || currentPage !== 'home') return;
      const league = homeDailyGamesLeague();
      const date = String(els.gameDate?.value || localISODate());
      if (!league) return;
      const cached = homeDailyGamesCache.get(`${league}|${date}`);
      const games = Array.isArray(cached?.games) ? cached.games : [];
      let delay = homeDailyGamesRefreshDelay(league, date, games);
      // On upstream errors, slow down retries instead of hammering Supabase / official sites.
      if (cached?.error) delay = Math.max(delay || 0, 10 * 60 * 1000);
      if (!delay || !homeDailyGamesAutoRefreshAvailable()) return;
      if (globalThis.navigator?.connection?.saveData) delay *= 2;
      homeDailyGamesRefreshTimer = setTimeout(() => {
        homeDailyGamesRefreshTimer = 0;
        if (document.visibilityState !== 'visible' || currentPage !== 'home' || homeDailyGamesLeague() !== league || String(els.gameDate?.value || localISODate()) !== date) return;
        if (!consumeHomeDailyGamesAutoRefresh()) return;
        renderHomeDailyGames({ force:true });
      }, delay);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (activeHomeGameDetail) refreshActiveHomeGameDetail();
        // Reuse a still-fresh result instead of forcing another Edge Function invocation on every focus change.
        else if (currentPage === 'home') renderHomeDailyGames();
      } else {
        stopHomeDailyGamesAutoRefresh();
        stopHomeGameDetailRefresh();
      }
    });

    function homeDailyGamesLeague() {
      if (homeRootSection === 'international') return '';
      if (homeProCountry === 'TW') return 'CPBL';
      if (homeProCountry === 'JP') return 'NPB';
      if (homeProCountry === 'KR') return 'KBO';
      if (homeProCountry === 'US') return 'MLB';
      return '';
    }

    function homeDailyGamesLeagueLabel(league) {
      return ({ CPBL:'中華職棒', NPB:'日本職棒', KBO:'韓國職棒', MLB:'MLB' })[league] || league;
    }

    function homeDailyGameStatusLabel(game) {
      const status = String(game?.status || '').toLowerCase();
      if (status === 'final') return '已結束';
      if (status === 'live') return '比賽中';
      if (status === 'cancelled') return '取消／延期';
      return String(game?.time || '').trim() || '未開打';
    }

    function homeDailyGameScore(value) {
      if (value === null || value === undefined || value === '') return '—';
      const number = Number(value);
      return Number.isFinite(number) ? String(number) : '—';
    }

    async function leagueDailyGamesRequest(league, date) {
      const response = await fetch(league === 'NPB' ? NPB_GAMES_API_URL : LEAGUE_GAMES_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'daily-games',
          league,
          date
        })
      });
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text || '{}'); } catch {}
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || `當日賽事讀取失敗（${response.status}）`);
      }
      return Array.isArray(data.games) ? data.games : [];
    }


    function homeGameDetailSupported(league) {
      return league === 'CPBL' || league === 'NPB';
    }

    function homeGameDetailKey(league, date, game = {}) {
      return [league, date, String(game?.id || ''), String(game?.away || ''), String(game?.home || '')].join('|');
    }

    function homeGameDetailBudget() {
      const day = localISODate();
      try {
        const raw = JSON.parse(localStorage.getItem(HOME_GAME_DETAIL_AUTO_STORAGE_KEY) || '{}');
        if (raw?.day === day) return { day, count:Math.max(0, Number(raw.count) || 0) };
      } catch {}
      return { day, count:0 };
    }

    function homeGameDetailAutoAvailable() {
      return homeGameDetailBudget().count < HOME_GAME_DETAIL_AUTO_LIMIT;
    }

    function consumeHomeGameDetailAuto() {
      const state = homeGameDetailBudget();
      if (state.count >= HOME_GAME_DETAIL_AUTO_LIMIT) return false;
      try {
        localStorage.setItem(HOME_GAME_DETAIL_AUTO_STORAGE_KEY, JSON.stringify({ day:state.day, count:state.count + 1 }));
      } catch {}
      return true;
    }

    async function leagueGameDetailRequest(league, date, game) {
      const detailApiUrl = league === 'CPBL' ? CPBL_GAME_DETAIL_API_URL : LEAGUE_GAME_DETAIL_API_URL;
      const response = await fetch(detailApiUrl, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'game-detail',
          league,
          date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || ''),
          venue:String(game?.venue || ''),
          status:String(game?.status || '')
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `單場逐打席讀取失敗（${response.status}）`);
      return data;
    }

    async function pregameStarterRequest(league, date, game) {
      const endpoint = league === 'NPB'
        ? NPB_PREGAME_STARTERS_API_URL
        : (() => {
            const url = new URL(LEAGUE_GAME_DETAIL_API_URL);
            url.pathname = url.pathname.replace(/\/[^/]+$/, '/pregame-starters');
            return url.toString();
          })();
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'pregame-starters',
          league,
          date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || '')
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `先發投手資料讀取失敗（${response.status}）`);
      return data;
    }

    function homeGameDetailStatusLabel(detail) {
      const status = String(detail?.status || '').toLowerCase();
      if (status === 'live') return ['比賽中', detail?.game?.inningLabel || ''].filter(Boolean).join('｜');
      if (status === 'final') return '比賽結束';
      if (status === 'cancelled') return '延賽／取消';
      return '尚未開打';
    }

    function homeGameDetailScore(value) {
      const n = Number(value);
      return Number.isFinite(n) ? String(n) : '—';
    }

    function homeGameDetailOutLabel(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      if (/^\d+$/.test(raw)) return `${Number(raw)}出局`;
      return raw.replace(/(\d+)\s*アウト/g, '$1出局').replace(/(\d+)\s*outs?/gi, '$1出局');
    }

    function homeGameDetailBasesLabel(value) {
      let raw = String(value ?? '').trim();
      if (!raw) return '';
      raw = raw.replace(/走者なし|ランナーなし|no runners?/gi, '壘上無人')
        .replace(/一塁|1塁/g, '一壘')
        .replace(/二塁|2塁/g, '二壘')
        .replace(/三塁|3塁/g, '三壘');
      if (/壘上無人/.test(raw)) return '壘上無人';
      if (/滿壘/.test(raw)) return '一、二、三壘有人';
      const bases = [];
      if (/一壘|(?:^|[^0-9])1(?:[^0-9]|$)/.test(raw)) bases.push('一');
      if (/二壘|(?:^|[^0-9])2(?:[^0-9]|$)/.test(raw)) bases.push('二');
      if (/三壘|(?:^|[^0-9])3(?:[^0-9]|$)/.test(raw)) bases.push('三');
      if (bases.length) return `${[...new Set(bases)].join('、')}壘有人`;
      return /壘$/.test(raw) ? `${raw}有人` : raw;
    }

    function homeGameDetailRbiLabel(value) {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? `${Math.floor(n)}打點` : '';
    }

    function homeGameDetailMeta(play) {
      return [
        homeGameDetailOutLabel(play?.outs),
        homeGameDetailBasesLabel(play?.bases),
        homeGameDetailRbiLabel(play?.rbi)
      ].map(v => String(v || '').trim()).filter(Boolean).join('｜');
    }

    function homeGameDetailGroups(plays = []) {
      const map = new Map();
      for (const play of Array.isArray(plays) ? plays : []) {
        const inning = Math.max(0, Number(play?.inning) || 0);
        const half = String(play?.half || '');
        const key = `${inning}|${half}`;
        if (!map.has(key)) map.set(key, { inning, half, team:String(play?.team || ''), plays:[] });
        map.get(key).plays.push(play);
      }
      return [...map.values()].sort((a,b) => a.inning - b.inning || (a.half === 'top' ? -1 : 1));
    }

    function ensureHomeGameDetailOverlay() {
      let overlay = document.getElementById('homeGameDetailOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'homeGameDetailOverlay';
      overlay.className = 'home-game-detail-overlay hidden';
      overlay.innerHTML = '<div class="home-game-detail-page" role="dialog" aria-modal="true" aria-label="單場逐打席"><div id="homeGameDetailBody"></div></div>';
      document.body.appendChild(overlay);
      return overlay;
    }

    function detailRunsFromScoreboard(detail, side) {
      const values = Array.isArray(detail?.scoreboard?.[side]) ? detail.scoreboard[side] : [];
      let total = 0;
      let found = false;
      for (const value of values) {
        const raw = String(value ?? '').trim();
        if (!/^\d+$/.test(raw)) continue;
        total += Number(raw);
        found = true;
      }
      return found ? total : null;
    }

    function syncHomeDailyGameFromDetail(league, date, game, detail) {
      const info = detail?.game || {};
      const awayRuns = detailRunsFromScoreboard(detail, 'away');
      const homeRuns = detailRunsFromScoreboard(detail, 'home');
      const normalizedStatus = String(detail?.status || '').toLowerCase();
      const apply = target => {
        if (!target) return;
        const awayScore = awayRuns !== null ? awayRuns : Number(info?.awayScore);
        const homeScore = homeRuns !== null ? homeRuns : Number(info?.homeScore);
        if (Number.isFinite(awayScore)) target.awayScore = awayScore;
        if (Number.isFinite(homeScore)) target.homeScore = homeScore;
        if (normalizedStatus) target.status = normalizedStatus;
        if (info?.id && !target.id) target.id = info.id;
      };
      apply(game);
      const daily = homeDailyGamesCache.get(`${league}|${date}`);
      const games = Array.isArray(daily?.games) ? daily.games : [];
      const target = games.find(item =>
        (info?.id && item?.id && String(info.id) === String(item.id))
        || (String(item?.away || '') === String(info?.away || game?.away || '')
          && String(item?.home || '') === String(info?.home || game?.home || ''))
      );
      apply(target);
    }

    function updateHomeGameDetailRefreshCountdown() {
      const el = document.getElementById('homeGameDetailRefreshCountdown');
      if (!el) return;
      if (activeHomeGameDetail?.loading) {
        el.textContent = '更新中…';
        return;
      }
      if (!homeGameDetailNextRefreshAt) {
        el.textContent = '';
        return;
      }
      const seconds = Math.max(0, Math.ceil((homeGameDetailNextRefreshAt - Date.now()) / 1000));
      el.textContent = `${seconds}秒後更新`;
    }

    function startHomeGameDetailRefreshCountdown(delay) {
      if (homeGameDetailCountdownTimer) clearInterval(homeGameDetailCountdownTimer);
      homeGameDetailNextRefreshAt = Date.now() + Math.max(0, Number(delay) || 0);
      updateHomeGameDetailRefreshCountdown();
      homeGameDetailCountdownTimer = setInterval(updateHomeGameDetailRefreshCountdown, 1000);
    }

    function stopHomeGameDetailRefreshCountdown() {
      if (homeGameDetailCountdownTimer) clearInterval(homeGameDetailCountdownTimer);
      homeGameDetailCountdownTimer = 0;
      homeGameDetailNextRefreshAt = 0;
      updateHomeGameDetailRefreshCountdown();
    }

    function stopHomeGameDetailRefresh() {
      if (homeGameDetailRefreshTimer) clearTimeout(homeGameDetailRefreshTimer);
      homeGameDetailRefreshTimer = 0;
      stopHomeGameDetailRefreshCountdown();
    }

    function closeHomeGameDetail() {
      stopHomeGameDetailRefresh();
      activeHomeGameDetail = null;
      const overlay = document.getElementById('homeGameDetailOverlay');
      if (overlay) overlay.classList.add('hidden');
      document.body.classList.remove('home-game-detail-open');
      if (currentPage === 'home') scheduleHomeDailyGamesAutoRefresh();
    }

    function homeStarterStatItems(starter) {
      const stats = starter?.stats || {};
      const out = [];
      const win = String(stats.wins ?? '').trim();
      const loss = String(stats.losses ?? '').trim();
      if (win || loss) out.push(['勝敗', String(win || 0) + '-' + String(loss || 0)]);
      if (String(stats.era ?? '').trim()) out.push(['ERA', String(stats.era)]);
      if (String(stats.ip ?? '').trim()) out.push(['IP', String(stats.ip)]);
      if (String(stats.so ?? '').trim()) out.push(['SO', String(stats.so)]);
      if (String(stats.hits ?? '').trim()) out.push(['被安打', String(stats.hits)]);
      if (String(stats.homeRuns ?? '').trim()) out.push(['被全壘打', String(stats.homeRuns)]);
      if (String(stats.fourDead ?? '').trim()) out.push(['四死球', String(stats.fourDead)]);
      if (String(stats.whip ?? '').trim()) out.push(['WHIP', String(stats.whip)]);
      if (String(stats.games ?? '').trim()) out.push(['G', String(stats.games)]);
      return out.slice(0, 10);
    }

    function homeStarterCard(starter, teamName, sideLabel) {
      if (!starter) {
        return `<article class="game-detail-starter-card is-empty"><div class="game-detail-starter-team">${escapeHtml(teamName || sideLabel)}</div><div class="game-detail-starter-empty">先發投手尚未公布</div></article>`;
      }
      const statItems = homeStarterStatItems(starter);
      const meta = [
        starter?.number ? `#${starter.number}` : '',
        starter?.throws || '',
        starter?.stats?.year ? `${starter.stats.year} 球季` : ''
      ].filter(Boolean).join('｜');
      return `<article class="game-detail-starter-card">
        <div class="game-detail-starter-team">${escapeHtml(teamName || starter?.team || sideLabel)}</div>
        <div class="game-detail-starter-name">${escapeHtml(String(starter?.fullName || starter?.name || '—'))}</div>
        <div class="game-detail-starter-meta">${escapeHtml(meta || '預告先發')}</div>
        ${statItems.length ? `<div class="game-detail-starter-stats">${statItems.map(([label,value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : '<div class="game-detail-starter-no-stats">目前沒有可用的本季投球數據</div>'}
      </article>`;
    }

    function renderHomeGameDetail(detail, game, { loading = false, error = '' } = {}) {
      const overlay = ensureHomeGameDetailOverlay();
      const body = overlay.querySelector('#homeGameDetailBody');
      if (!body) return;
      const status = String(detail?.status || game?.status || 'scheduled').toLowerCase();
      const currentBatter = String(detail?.current?.batter?.name || '').trim();
      const currentPitcher = String(detail?.current?.pitcher?.name || '').trim();
      const groups = homeGameDetailGroups(detail?.plays || []);
      const gameInfo = detail?.game || game || {};
      const leagueLabel = activeHomeGameDetail?.league === 'CPBL' ? '中華職棒' : '日本職棒';
      const dateLabel = String(activeHomeGameDetail?.date || '').replaceAll('-', '/');
      const pregame = detail?.pregame || null;
      const starterSection = status === 'scheduled' ? `
        <section class="game-detail-pregame-section">
          <div class="game-detail-section-title game-detail-pregame-title">
            <div><strong>預告先發</strong><span>${escapeHtml(String(pregame?.source || (activeHomeGameDetail?.league === 'NPB' ? 'NPB 官方' : 'CPBL 官方')))}</span></div>
            <button id="homeGameDetailPregameRefresh" class="game-detail-pregame-refresh" type="button" ${loading ? 'disabled' : ''}>重新整理</button>
          </div>
          ${pregame?.error ? `<div class="game-detail-pregame-note error">${escapeHtml(String(pregame.error))}</div>` : ''}
          <div class="game-detail-starter-grid">
            ${homeStarterCard(pregame?.awayStarter || null, String(gameInfo?.away || game?.away || '客隊'), '客隊')}
            ${homeStarterCard(pregame?.homeStarter || null, String(gameInfo?.home || game?.home || '主隊'), '主隊')}
          </div>
          ${!pregame?.awayStarter && !pregame?.homeStarter ? '<div class="game-detail-pregame-note">聯盟公布預告先發後，重新整理就會自動帶入本季投球資料。</div>' : ''}
        </section>` : '';
      const matchup = status === 'live' ? `
        <div class="game-detail-current-grid">
          <div class="game-detail-current-card"><span>目前打者</span><strong>${escapeHtml(currentBatter || '等待下一位打者')}</strong></div>
          <div class="game-detail-current-card"><span>目前投手</span><strong>${escapeHtml(currentPitcher || '讀取中')}</strong></div>
        </div>` : '';
      const playsHtml = groups.length ? groups.map(group => `
        <details class="game-detail-inning" open>
          <summary>${group.inning || '—'}局${group.half === 'top' ? '上' : group.half === 'bottom' ? '下' : ''}${group.team ? `｜${escapeHtml(group.team)}` : ''}<span>${group.plays.length} 打席</span></summary>
          <div class="game-detail-pa-list">
            ${group.plays.map(play => `
              <div class="game-detail-pa-row">
                <div class="game-detail-pa-main"><strong>${escapeHtml(String(play?.batter || '未辨識打者'))}</strong><span>${escapeHtml(String(play?.result || '—'))}</span></div>
                <div class="game-detail-pa-meta">${escapeHtml(homeGameDetailMeta(play))}</div>
              </div>`).join('')}
          </div>
        </details>`).join('') : `<div class="game-detail-empty">${status === 'scheduled' ? '比賽尚未開始，開打後這裡會顯示逐打席。' : loading ? '正在讀取官方逐打席…' : '官方來源目前沒有可顯示的逐打席。'}</div>`;

      body.innerHTML = `
        <header class="game-detail-sticky-head">
          <button id="homeGameDetailBack" class="game-detail-back" type="button">← 返回賽事</button>
          <div class="game-detail-head-copy"><strong>${escapeHtml(leagueLabel)}</strong><span>${escapeHtml(dateLabel)}${gameInfo?.venue ? `｜${escapeHtml(String(gameInfo.venue))}` : ''}</span></div>
          ${status === 'live' ? `<span class="game-detail-live-dot ${loading ? 'is-refreshing' : ''}"><i></i>LIVE<span id="homeGameDetailRefreshCountdown" style="margin-left:6px;font-size:11px;font-weight:700;opacity:.72;white-space:nowrap">${loading ? '更新中…' : ''}</span></span>` : ''}
        </header>
        <main class="game-detail-content">
          <section class="game-detail-score-card">
            <div class="game-detail-status">${escapeHtml(homeGameDetailStatusLabel(detail || {status,game:gameInfo}))}${loading ? '｜更新中…' : ''}</div>
            <div class="game-detail-score-row">
              <div><span>${escapeHtml(String(gameInfo?.away || game?.away || '客隊'))}</span><strong>${homeGameDetailScore(gameInfo?.awayScore)}</strong></div>
              <b>－</b>
              <div><span>${escapeHtml(String(gameInfo?.home || game?.home || '主隊'))}</span><strong>${homeGameDetailScore(gameInfo?.homeScore)}</strong></div>
            </div>
            ${matchup}
          </section>
          ${error ? `<div class="game-detail-error">${escapeHtml(error)}<button id="homeGameDetailRetry" type="button">重新讀取</button></div>` : ''}
          ${starterSection}
          <section class="game-detail-play-section">
            <div class="game-detail-section-title"><strong>全場逐打席</strong><span>${detail?.plays?.length || 0} 筆</span></div>
            ${playsHtml}
          </section>
        </main>`;
      overlay.classList.remove('hidden');
      document.body.classList.add('home-game-detail-open');
      body.querySelector('#homeGameDetailBack')?.addEventListener('click', closeHomeGameDetail);
      body.querySelector('#homeGameDetailRetry')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));
      body.querySelector('#homeGameDetailPregameRefresh')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));
      updateHomeGameDetailRefreshCountdown();
    }

    function homeGameDetailCacheTtl(detail) {
      const status = String(detail?.status || '').toLowerCase();
      if (status === 'final' || status === 'cancelled') return 12 * 60 * 60 * 1000;
      if (status === 'scheduled') return 2 * 60 * 1000;
      return 45 * 1000;
    }

    function scheduleHomeGameDetailRefresh(detail) {
      stopHomeGameDetailRefresh();
      if (!activeHomeGameDetail || document.visibilityState !== 'visible') return;
      if (String(detail?.status || '').toLowerCase() !== 'live') return;
      if (!homeGameDetailAutoAvailable()) return;
      const delay = activeHomeGameDetail.league === 'NPB' ? 45 * 1000 : 30 * 1000;
      startHomeGameDetailRefreshCountdown(delay);
      homeGameDetailRefreshTimer = setTimeout(() => {
        homeGameDetailRefreshTimer = 0;
        stopHomeGameDetailRefreshCountdown();
        if (!activeHomeGameDetail || document.visibilityState !== 'visible' || !consumeHomeGameDetailAuto()) return;
        refreshActiveHomeGameDetail({ force:true, automatic:true });
      }, delay);
    }

    async function refreshActiveHomeGameDetail({ force = false, automatic = false } = {}) {
      if (!activeHomeGameDetail) return;
      const { league, date, game } = activeHomeGameDetail;
      const key = homeGameDetailKey(league, date, game);
      const cached = homeGameDetailCache.get(key);
      const age = cached ? Date.now() - Number(cached.at || 0) : Infinity;
      if (!force && cached && age < homeGameDetailCacheTtl(cached.detail)) {
        renderHomeGameDetail(cached.detail, game);
        scheduleHomeGameDetailRefresh(cached.detail);
        return;
      }
      if (activeHomeGameDetail.loading) return;
      activeHomeGameDetail.loading = true;
      if (cached?.detail) renderHomeGameDetail(cached.detail, game, { loading:true });
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      try {
        const detail = await leagueGameDetailRequest(league, date, game);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        if (String(detail?.status || '').toLowerCase() === 'scheduled' && (league === 'CPBL' || league === 'NPB')) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
          }
        }
        homeGameDetailCache.set(key, { at:Date.now(), detail });
        homeGameDetailErrorStreak = 0;
        syncHomeDailyGameFromDetail(league, date, game, detail);
        if (detail?.game?.id && !game.id) game.id = detail.game.id;
        renderHomeGameDetail(detail, game);
        scheduleHomeGameDetailRefresh(detail);
      } catch (error) {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        const detail = cached?.detail || { status:game?.status, game, plays:[] };
        renderHomeGameDetail(detail, game, { error:error?.message || '單場逐打席讀取失敗。' });
        if (automatic) {
          homeGameDetailErrorStreak = Math.min(homeGameDetailErrorStreak + 1, 5);
          const retryDelay = Math.min(10 * 60 * 1000, 60 * 1000 * (2 ** (homeGameDetailErrorStreak - 1)));
          stopHomeGameDetailRefresh();
          startHomeGameDetailRefreshCountdown(retryDelay);
          homeGameDetailRefreshTimer = setTimeout(() => {
            homeGameDetailRefreshTimer = 0;
            if (activeHomeGameDetail && document.visibilityState === 'visible') refreshActiveHomeGameDetail({ force:true, automatic:true });
          }, retryDelay);
        }
      } finally {
        if (activeHomeGameDetail && activeHomeGameDetail.key === key) activeHomeGameDetail.loading = false;
      }
    }

    function openHomeGameDetail(game, league, date) {
      if (!homeGameDetailSupported(league)) return;
      stopHomeDailyGamesAutoRefresh();
      const key = homeGameDetailKey(league, date, game);
      activeHomeGameDetail = { league, date, game, key, loading:false };
      const cached = homeGameDetailCache.get(key);
      if (cached?.detail) renderHomeGameDetail(cached.detail, game);
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      refreshActiveHomeGameDetail();
    }

    async function loadHomeDailyGames(league, date, { force = false } = {}) {
      const key = `${league}|${date}`;
      const now = Date.now();
      const cached = homeDailyGamesCache.get(key);
      const age = cached ? now - Number(cached.at || 0) : Infinity;
      if (!force && cached && age < HOME_DAILY_GAMES_TTL) return cached.games || [];
      // Even forced refreshes are coalesced for a short floor to avoid double-clicks / rapid tab changes.
      if (force && cached && age < HOME_DAILY_GAMES_FORCE_FLOOR) return cached.games || [];
      if (homeDailyGamesLoading.has(key)) return null;

      homeDailyGamesLoading.add(key);
      try {
        let games = await leagueDailyGamesRequest(league, date);

        // CPBL's schedule feed can keep a suspended/reserved game marked as live.
        // For games that the outer feed still calls live, verify against the authoritative
        // single-game detail endpoint before rendering the card.
        if (league === 'CPBL' && Array.isArray(games)) {
          const liveGames = games.filter(item => String(item?.status || '').toLowerCase() === 'live' && item?.id);
          if (liveGames.length) {
            await Promise.all(liveGames.map(async item => {
              try {
                const verified = await leagueGameDetailRequest('CPBL', date, item);
                const verifiedStatus = String(verified?.status || '').toLowerCase();
                if (verifiedStatus) item.status = verifiedStatus;
                if (verified?.game?.awayScore !== undefined && verified.game.awayScore !== null) item.awayScore = verified.game.awayScore;
                if (verified?.game?.homeScore !== undefined && verified.game.homeScore !== null) item.homeScore = verified.game.homeScore;
                if (verified?.game?.inningLabel) item.inningLabel = verified.game.inningLabel;
              } catch (error) {
                console.warn('CPBL 外層賽況驗證失敗', error);
              }
            }));
          }
        }

        homeDailyGamesCache.set(key, { at:Date.now(), games, error:'' });
        return games;
      } catch (error) {
        homeDailyGamesCache.set(key, {
          at:Date.now(),
          games:Array.isArray(cached?.games) ? cached.games : [],
          error:error?.message || '當日賽事讀取失敗。'
        });
        return null;
      } finally {
        homeDailyGamesLoading.delete(key);
        if (currentPage === 'home' && homeDailyGamesLeague() === league && String(els.gameDate?.value || '') === date) {
          renderHomeDailyGames({ skipLoad:true });
        }
      }
    }

    function renderHomeDailyGames({ force = false, skipLoad = false } = {}) {
      const host = els.homeDailyGames;
      if (!host) return;

      const league = homeDailyGamesLeague();
      const date = String(els.gameDate?.value || localISODate());
      if (!league || homeRootSection === 'international') {
        host.classList.add('hidden');
        host.innerHTML = '';
        return;
      }
      host.classList.remove('hidden');

      const key = `${league}|${date}`;
      const cached = homeDailyGamesCache.get(key) || null;
      const loading = homeDailyGamesLoading.has(key);
      const fresh = cached && Date.now() - Number(cached.at || 0) < HOME_DAILY_GAMES_TTL;
      const games = Array.isArray(cached?.games) ? cached.games : [];
      const error = String(cached?.error || '');
      const leagueLabel = homeDailyGamesLeagueLabel(league);
      const dateLabel = date.replaceAll('-', '/');

      let bodyHtml = '';
      if (!cached && !loading) {
        bodyHtml = '<div class="home-games-state">正在讀取官方賽程…</div>';
      } else if (loading && !games.length) {
        bodyHtml = '<div class="home-games-state"><span class="home-games-loading-dot"></span>正在讀取官方賽程…</div>';
      } else if (error && !games.length) {
        bodyHtml = `<div class="home-games-state error"><span>${escapeHtml(error)}</span><button class="press-btn home-games-retry" type="button">重新整理</button></div>`;
      } else if (!games.length) {
        bodyHtml = `<div class="home-games-state">這個日期沒有找到 ${escapeHtml(leagueLabel)} 比賽。</div>`;
      } else {
        bodyHtml = `<div class="home-games-scroller ${league === 'MLB' ? 'is-mlb' : ''}">${games.map((game, gameIndex) => {
          const status = String(game?.status || 'scheduled').toLowerCase();
          const statusLabel = homeDailyGameStatusLabel(game);
          const showScore = status === 'live' || status === 'final';
          const awayScore = showScore ? homeDailyGameScore(game?.awayScore) : '—';
          const homeScore = showScore ? homeDailyGameScore(game?.homeScore) : '—';
          const venue = String(game?.venue || '').trim();
          return `
            <article class="home-game-card status-${escapeAttr(status)} ${homeGameDetailSupported(league) ? 'is-detail-enabled' : ''}" ${homeGameDetailSupported(league) ? `data-game-detail-index="${gameIndex}" role="button" tabindex="0" aria-label="查看 ${escapeAttr(String(game?.away || ''))} 對 ${escapeAttr(String(game?.home || ''))} 全場逐打席"` : ''}>
              <div class="home-game-card-top">
                <span class="home-game-status status-${escapeAttr(status)}">${escapeHtml(statusLabel)}</span>
                ${game?.time && ['final','live'].includes(status) ? `<span class="home-game-time">${escapeHtml(String(game.time))}</span>` : ''}
              </div>
              <div class="home-game-team">
                <span class="home-game-team-name">${escapeHtml(String(game?.away || '客隊'))}</span>
                <strong class="home-game-score">${escapeHtml(awayScore)}</strong>
              </div>
              <div class="home-game-team">
                <span class="home-game-team-name">${escapeHtml(String(game?.home || '主隊'))}</span>
                <strong class="home-game-score">${escapeHtml(homeScore)}</strong>
              </div>
              <div class="home-game-venue">${escapeHtml(venue || '場地未提供')}</div>
            </article>`;
        }).join('')}</div>`;
      }

      scheduleHomeDailyGamesAutoRefresh();
      host.innerHTML = `
        <section class="home-daily-games-shell">
          <div class="home-daily-games-head">
            <div class="home-daily-games-title">
              <strong>當日賽事</strong>
              <span class="home-league-live-row">
                <span>${escapeHtml(leagueLabel)}</span>
                ${homeDailyGamesHasLive(games) && homeDailyGamesAutoRefreshAvailable() ? `<span class="home-live-battery ${loading ? 'is-refreshing' : ''}" title="比賽進行中，自動更新比分" aria-label="比賽進行中，自動更新比分">
                  <svg class="battery-player battery-pitcher battery-pitcher-formal" viewBox="0 0 44 44" aria-hidden="true">
                    <g class="battery-pitcher-figure">
                      <g class="battery-pitcher-core">
                        <path class="battery-cap" d="M9 8.7c1.2-4 4.4-6.2 8.4-5.5 2.8.5 4.7 2.1 5.8 4.7l-9.3 1.9Z"></path>
                        <circle class="battery-skin" cx="16.4" cy="10.8" r="4.2"></circle>
                        <path class="battery-uniform" d="M12.8 15.1c2-1.2 5.7-1.1 7.8.2l3.5 9.4-3.5 3.2-4-7.3-3.1 7.1-4-2.2Z"></path>
                      </g>
                      <path class="battery-drive-leg" d="M13.9 24.2 9.2 36.7l4.2 1.1 4.7-10.6-1.4-3.7Z"></path>
                      <path class="battery-stride-leg" d="M18.4 24.2c3.6 2.5 6 6.1 7.9 10.1l-3.8 1.9c-1.9-3.5-4.1-6.1-6.6-7.6Z"></path>
                      <g class="battery-throw-arm-formal">
                        <path d="M20 16.3c4.7.3 8.7 2.8 12.1 5.9l-2.4 3.1c-3-2.4-6.3-4-10.5-4.3Z"></path>
                        <circle class="battery-hand" cx="31.8" cy="23.5" r="1.7"></circle>
                      </g>
                      <g class="battery-glove-side-formal">
                        <path class="battery-glove-arm" d="M12.7 16.5 7 20.8l2 3.4 6.5-3.5Z"></path>
                        <ellipse class="battery-glove" cx="6.8" cy="22" rx="3.8" ry="3.1"></ellipse>
                      </g>
                    </g>
                  </svg>
                  <span class="battery-ball"><i></i></span>
                  <svg class="battery-player battery-catcher" viewBox="0 0 44 44" aria-hidden="true">
                    <g class="battery-catcher-crouch">
                      <path class="battery-mask" d="M14 5.6c2.2-2.1 6.4-2.4 9-.6l1.7 4.5-2.4 5.2-7.7-.4-2.1-5.1Z"></path>
                      <path class="battery-mask-line" d="M14.5 8.6h9.2M16.1 5.8l-.3 7.1M21.2 5.5l.7 7.4"></path>
                      <path class="battery-chest" d="M13.7 14.1c3-1.2 7.5-1 10 .5l2.2 10-5.3 2.8-4.2-1-4.6-2.4Z"></path>
                      <path class="battery-catcher-leg" d="m14 23.6-7 7.6 3.7 3.5 7.5-5.4 6.8 5.2 3.4-3.4-6.4-7.5Z"></path>
                      <path class="battery-receive-arm" d="M13.8 16.1 6.7 19l1.6 3.7 7.8-2.6Z"></path>
                      <ellipse class="battery-mitt" cx="5.7" cy="20.7" rx="4.2" ry="3.4"></ellipse>
                    </g>
                    <g class="battery-catcher-stand">
                      <path class="battery-mask" d="M14.8 3.8c2.2-2 6.2-2.2 8.8-.4l1.5 4.1-2.1 4.9-7.6-.3-2-4.9Z"></path>
                      <path class="battery-mask-line" d="M15.2 6.6h9M16.8 4l-.3 7M21.8 3.9l.6 7"></path>
                      <path class="battery-chest" d="M14.1 12.1c3.1-1.2 7.2-1.1 9.7.4l2 10.2-4.6 2.2-4.4-.5-4.2-2.8Z"></path>
                      <path class="battery-stand-leg" d="m15.3 22.1-3.7 14.7 4.1.8 3.5-10.7 4 10.5 4-1.2-4.1-14Z"></path>
                      <g class="battery-return-arm">
                        <path d="M22.8 13.5c4.9 1 8.3 4.1 10.7 7.1l-2.6 2.5c-2.8-2.8-5.8-4.7-9.4-5.2Z"></path>
                        <circle class="battery-hand" cx="33.4" cy="21.9" r="1.7"></circle>
                      </g>
                      <g class="battery-catcher-glove-side">
                        <path class="battery-glove-arm" d="M14.2 14.3 8.1 18l1.7 3.3 6.8-3.4Z"></path>
                        <ellipse class="battery-glove" cx="7.7" cy="19.4" rx="3.4" ry="2.9"></ellipse>
                      </g>
                    </g>
                  </svg>
                </span>` : ''}
              </span>
            </div>
            <div class="home-daily-games-meta">
              <span>${escapeHtml(dateLabel)}</span>
              ${games.length ? `<span>${games.length} 場</span>` : ''}
              ${loading && games.length ? '<span>更新中…</span>' : ''}
            </div>
          </div>
          ${bodyHtml}
        </section>`;

      host.querySelector('.home-games-retry')?.addEventListener('click', () => {
        homeDailyGamesCache.delete(key);
        renderHomeDailyGames({ force:true });
      });
      if (homeGameDetailSupported(league)) {
        host.querySelectorAll('[data-game-detail-index]').forEach(card => {
          const open = () => {
            const index = Number(card.dataset.gameDetailIndex);
            const game = games[index];
            if (game) openHomeGameDetail(game, league, date);
          };
          card.addEventListener('click', open);
          card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          });
        });
      }

      if (!skipLoad && (force || !cached || !fresh) && !loading) {
        void loadHomeDailyGames(league, date, { force }).then(() => {});
      }
    }

    function renderRecentPlayers() {
      renderHomePlayerFilters();
      els.homePage?.classList.toggle('international-home-mode', homeRootSection === 'international');
      renderHomeDailyGames();

      if (homeRootSection === 'international') {
        if (els.homePlayerCount) els.homePlayerCount.textContent = '';
        if (els.recent) els.recent.innerHTML = '';
        return;
      }

      const zonePlayers = homeContextPlayers();
      let list = [...zonePlayers];

      list.sort((a, b) => {
        const used = (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
        if (used) return used;
        return String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric: true });
      });

      if (els.homePlayerCount) {
        els.homePlayerCount.textContent = `${list.length} / ${zonePlayers.length} 名`;
      }

      els.recent.innerHTML = list.length ? list.map(p => {
        const meta = playerSourceMeta(p);
        return `
          <button class="player-btn home-player-card ${p.id === selectedPlayerId ? 'active' : ''}" data-player-id="${p.id}">
            <span class="home-player-number">#${escapeHtml(p.number)}</span>
            <span>
              <span class="home-player-name">${escapeHtml(p.name)}</span>
              <span class="home-player-meta">${escapeHtml(meta || '點擊進入球員設定')}</span>
            </span>
          </button>`;
      }).join('') : '<div class="empty" style="grid-column:1/-1">這個分類目前沒有符合條件的球員。</div>';

      els.recent.querySelectorAll('[data-player-id]').forEach(btn => {
        btn.addEventListener('click', () => selectPlayer(btn.dataset.playerId));
      });
    }

    function renderAllPlayersDialog() {
      let zonePlayers = homeContextPlayers();
      const cpblDialog = homeRootSection !== 'international' && homeProCountry === 'TW';

      els.allCpblFilters?.classList.toggle('hidden', !cpblDialog);
      if (cpblDialog) {
        if (els.allLevelFilters) els.allLevelFilters.value = homeLevelFilter;
        if (els.allTeamFilters) els.allTeamFilters.value = homeTeamFilter;
        syncAllFilterTriggerLabels();

        zonePlayers = zonePlayers.filter(player => {
          const levelOk = homeLevelFilter === 'ALL' || homePlayerLevel(player) === homeLevelFilter;
          const teamOk = !homeTeamFilter || homePlayerTeam(player) === homeTeamFilter;
          return levelOk && teamOk;
        });
      }

      const pitchers = zonePlayers.filter(p => p.type === 'pitcher');
      const hitters = zonePlayers.filter(p => p.type === 'hitter');

      const allPlayerDialogLines = p => {
        const scope = playerScope(p);
        const role = p.type === 'pitcher' ? '投手' : '打者';
        const competition = scope === 'cpbl' ? '中職' : playerSpecialCompetition(p);
        const team = scope === 'international'
          ? internationalTeam(p)
          : (scope === 'cpbl'
              ? normalizeTeamName(p.cpblTeam || '')
              : (isUsPlayer(p)
                  ? String(p.externalCurrentOrganization || p.externalCurrentTeam || p.externalTeam || '').trim()
                  : String(p.externalTeam || '').trim()));
        const crossRole = (p.externalTwoWay || p.hasCrossRoleStats || p.cpblDualRole) ? '投打皆有紀錄' : '';
        const year = scope === 'cpbl' ? '' : (Number(p.externalYear) || '');
        const cpblLevel = scope === 'cpbl'
          ? (String(p.cpblCurrentLevel || '').toUpperCase() === 'D' ? '二軍' : (p.cpblCurrentLevel ? '一軍' : ''))
          : '';
        return {
          first: `#${p.number || '—'} ${p.name || '未命名球員'}`,
          second: [role, competition, team].filter(Boolean).join('｜'),
          third: [crossRole, isUsPlayer(p) ? (p.externalCurrentLevel || '') : (year || cpblLevel)].filter(Boolean).join('｜') || ' '
        };
      };

      const make = list => list.length ? list.map(p => {
        const lines = allPlayerDialogLines(p);
        return `
          <button class="player-btn all-player-card ${p.id === selectedPlayerId ? 'active' : ''}" data-player-id="${p.id}">
            <span class="all-player-line all-player-line-main">${escapeHtml(lines.first)}</span>
            <span class="all-player-line all-player-line-meta">${escapeHtml(lines.second)}</span>
            <span class="all-player-line all-player-line-extra">${escapeHtml(lines.third)}</span>
          </button>`;
      }).join('') : '<div class="empty">目前沒有符合篩選條件的球員。</div>';

      els.allPitchers.innerHTML = make(pitchers);
      els.allHitters.innerHTML = make(hitters);
      els.allDialog.querySelectorAll('[data-player-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await selectPlayer(btn.dataset.playerId);
          els.allDialog.close();
        });
      });
    }

    function internationalGameSummaryText(player, record) {
      const partialSuffix = record?.internationalPartialGame ? '｜部分資料' : '';
      if (record?.internationalPartialGame && !record?.internationalHasVerifiedStats) {
        return '有出賽｜詳細 Box 待補';
      }
      if (player.type === 'hitter') {
        const official=record?.internationalHitterGame;
        if (official && !(record?.hitterPAs || []).length) {
          return `${Number(official.hits)||0}安／${Number(official.ab)||0}打數｜${Number(official.rbi)||0}打點｜${Number(official.runs)||0}得分${partialSuffix}`;
        }
        const game=deriveHitterGame(record?.hitterPAs || []);
        const hits=(Number(game.single)||0)+(Number(game.double)||0)+(Number(game.triple)||0)+(Number(game.hr)||0);
        const runs=Math.max(0,Number(record?.cpblGameSummary?.runs)||0);
        return `${hits}安／${game.ab||0}打數｜${game.rbi||0}打點｜${runs}得分${partialSuffix}`;
      }
      const game=derivePitcherGame(record?.pitcherGame || defaultGameRecord(player).pitcherGame);
      const innings=record?.pitcherGame?.innings || outsToIP(game.outs||0);
      return `${innings}局｜${game.k||0}K｜${game.h||0}H｜${game.bb||0}BB｜${game.er||0}ER${partialSuffix}`;
    }

    async function internationalPlayerGameRecords(player) {
      return (await idbGetAll(STORES.games))
        .filter(record => record?.playerId === player.id && record?.internationalOfficialImport)
        .sort((a,b) => String(a.date||'').localeCompare(String(b.date||'')));
    }

    async function syncInternationalGamesFromTab(player) {
      const competition = playerSpecialCompetition(player);
      const year = Number(player.externalYear) || CURRENT_YEAR;
      setSyncProgress(0, '重新同步 ' + competition + ' ' + year + '…');
      try {
        await syncInternationalTournamentStats(
          player,
          (percent,status) => setSyncProgress(Math.min(50, percent), status)
        );
        const games = await syncInternationalTournamentGames(
          player,
          (percent,status) => setSyncProgress(Math.max(52, percent), status)
        );
        internationalSelectedGameKey = '';
        renderAll();
        await finishSyncProgress('同步完成｜' + games.length + ' 場出賽資料');
      } catch (error) {
        console.warn('國際賽逐場同步失敗', error);
        setSyncProgress(100, error?.message || '國際賽逐場同步失敗', { error:true });
        await new Promise(resolve => setTimeout(resolve, 1200));
        hideSyncProgress();
      }
    }

    async function openInternationalGameRecord(player, key) {
      const record = await idbGet(STORES.games, key);
      if (!record || record.playerId !== player.id || !record.internationalOfficialImport) {
        setStatus('找不到這場國際賽紀錄，請重新同步。', true);
        return;
      }
      internationalSelectedGameKey = record.key;
      els.gameDate.value = record.date;
      selectedLevel = 'A';
      await loadRecord();
      selectedTab = 'today';
      renderAll();
    }

    async function renderInternationalGamesTab(player) {
      if (playerScope(player) !== 'international') return;

      if (internationalSelectedGameKey) {
        const selected = await idbGet(STORES.games, internationalSelectedGameKey);
        if (selected?.playerId === player.id && selected?.internationalOfficialImport) {
          els.gameDate.value = selected.date;
          currentRecord = selected;
          if (selected.internationalPartialGame && !selected.internationalHasVerifiedStats) {
            els.content.innerHTML =
              '<div class="intl-flow-empty">' +
                '<strong>這場已確認有出賽，但完整個人 Box Score 還在等待官方來源。</strong><br>' +
                '目前不會把未知欄位顯示成 0，也不會拿來計算整屆總成績。' +
              '</div>';
          } else {
            renderToday(player);
          }
          const opponent = normalizeInternationalTeamName(selected.opponent || '') || '對手未提供';
          const nav =
            '<div class="intl-game-detail-nav">' +
              '<button id="backInternationalGamesBtn" class="press-btn" type="button">← 返回逐場比賽</button>' +
              '<div class="intl-game-detail-date">' +
                escapeHtml(playerSpecialCompetition(player)) + ' ' +
                escapeHtml(internationalEdition(player)) + '｜' +
                escapeHtml(String(selected.date || '').replaceAll('-', '/')) + '｜VS ' +
                escapeHtml(opponent) +
                (selected.internationalPartialGame ? '｜部分資料' : '') +
              '</div>' +
            '</div>';
          els.content.insertAdjacentHTML('afterbegin', nav);
          document.getElementById('backInternationalGamesBtn')?.addEventListener('click', () => {
            internationalSelectedGameKey = '';
            renderAll();
          });
          return;
        }
        internationalSelectedGameKey = '';
      }

      els.content.innerHTML =
        '<div class="intl-games-tab-head">' +
          '<div>' +
            '<h2>#' + escapeHtml(player.number) + ' ' + escapeHtml(player.name) + '｜逐場比賽</h2>' +
            '<div class="intl-games-tab-meta">' +
              escapeHtml(playerSpecialCompetition(player)) + '｜' +
              escapeHtml(internationalEdition(player)) + '｜' +
              escapeHtml(internationalTeam(player)) +
            '</div>' +
          '</div>' +
          '<button id="refreshInternationalGamesBtn" class="press-btn" type="button">重新同步</button>' +
        '</div>' +
        '<div id="internationalGameArchive" class="intl-game-archive" style="margin-top:0"></div>';

      document.getElementById('refreshInternationalGamesBtn')?.addEventListener('click', () => {
        void syncInternationalGamesFromTab(player);
      });
      await renderInternationalGameArchive(player);
    }

    async function renderInternationalGameArchive(player) {
      const host=document.getElementById('internationalGameArchive');
      if (!host || playerScope(player) !== 'international') return;
      const records=await internationalPlayerGameRecords(player);

      if (!records.length) {
        host.innerHTML='<div class="intl-flow-empty">目前還沒有這名球員的逐場紀錄。可以按右上角「重新同步」再抓一次官方資料。</div>';
        return;
      }

      const rows=records.map(record => {
        const opponent=normalizeInternationalTeamName(record?.opponent || '') || '對手未提供';
        const summary=internationalGameSummaryText(player,record);
        const selectedClass=record.key===internationalSelectedGameKey?' is-selected':'';
        return '<div class="intl-game-card'+selectedClass+'">' +
          '<div class="intl-game-date">'+escapeHtml(String(record.date||'').replaceAll('-', '/'))+'</div>' +
          '<div class="intl-game-main"><strong>VS '+escapeHtml(opponent)+(record.internationalPartialGame?' <small>（部分資料）</small>':'')+'</strong><span>'+escapeHtml(summary)+'</span></div>' +
          '<button class="press-btn" type="button" data-intl-game-key="'+encodeURIComponent(record.key||'')+'">查看／輸出</button>' +
        '</div>';
      }).join('');

      host.innerHTML='<div class="intl-game-archive-head"><h3 style="margin:0">本屆每場比賽</h3><span class="small">共 '+records.length+' 場</span></div><div class="intl-game-archive-list">'+rows+'</div>';
      host.querySelectorAll('[data-intl-game-key]').forEach(button => {
        button.addEventListener('click', () => {
          const key=decodeURIComponent(button.dataset.intlGameKey||'');
          if (key) void openInternationalGameRecord(player,key);
        });
      });
    }
