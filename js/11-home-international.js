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
    const HOME_DAILY_GAMES_TTL = 60 * 1000;

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
      const response = await fetch(LEAGUE_GAMES_API_URL, {
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

    async function loadHomeDailyGames(league, date, { force = false } = {}) {
      const key = `${league}|${date}`;
      const now = Date.now();
      const cached = homeDailyGamesCache.get(key);
      if (!force && cached && now - Number(cached.at || 0) < HOME_DAILY_GAMES_TTL) return cached.games || [];
      if (homeDailyGamesLoading.has(key)) return null;

      homeDailyGamesLoading.add(key);
      try {
        const games = await leagueDailyGamesRequest(league, date);
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
        bodyHtml = `<div class="home-games-scroller ${league === 'MLB' ? 'is-mlb' : ''}">${games.map(game => {
          const status = String(game?.status || 'scheduled').toLowerCase();
          const statusLabel = homeDailyGameStatusLabel(game);
          const showScore = status === 'live' || status === 'final';
          const awayScore = showScore ? homeDailyGameScore(game?.awayScore) : '—';
          const homeScore = showScore ? homeDailyGameScore(game?.homeScore) : '—';
          const venue = String(game?.venue || '').trim();
          return `
            <article class="home-game-card status-${escapeAttr(status)}">
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

      host.innerHTML = `
        <section class="home-daily-games-shell">
          <div class="home-daily-games-head">
            <div class="home-daily-games-title">
              <strong>當日賽事</strong>
              <span>${escapeHtml(leagueLabel)}</span>
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
