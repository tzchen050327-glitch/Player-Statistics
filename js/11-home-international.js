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

    function internationalTeamGamesKey(competition, year, team) {
      return [competition,String(year||''),normalizeInternationalTeamName(team)].join('|');
    }

    function internationalRemoteGameKey(game, team) {
      const id=String(game?.gameId||'').trim();
      const date=String(game?.date||'').slice(0,10);
      const opponent=normalizeInternationalTeamName(game?.opponent||'');
      return id ? `id:${id}` : `fallback:${date}|${normalizeInternationalTeamName(team)}|${opponent}`;
    }

    function internationalGameNumber(value) {
      const n=Number(value);
      return Number.isFinite(n) ? Math.max(0,n) : 0;
    }

    async function internationalRosterForGames(competition, year, team) {
      const key=internationalRosterKey(competition,year,team);
      if (!internationalRosterCache.has(key) && !internationalRosterLoading.has(key)) {
        await loadInternationalRoster(competition,year,team);
      }
      for (let i=0;i<60 && internationalRosterLoading.has(key);i++) {
        await new Promise(resolve => setTimeout(resolve,100));
      }
      return internationalRosterCache.get(key)||null;
    }

    async function loadInternationalTeamGameBoxes(competition, year, team, {force=false} = {}) {
      const normalizedTeam=normalizeInternationalTeamName(team);
      const cacheKey=internationalTeamGamesKey(competition,year,normalizedTeam);
      if (!competition || !year || !normalizedTeam) return [];
      if (!force && internationalTeamGamesCache.has(cacheKey)) return internationalTeamGamesCache.get(cacheKey);
      if (internationalTeamGamesLoading.has(cacheKey)) return null;

      internationalTeamGamesLoading.add(cacheKey);
      try {
        const roster=await internationalRosterForGames(competition,year,normalizedTeam);
        const entries=Array.isArray(roster?.players)?roster.players:[];
        if (!entries.length) {
          const empty={games:[],error:roster?.error||'這支球隊目前沒有可用球員名單。',updatedAt:Date.now()};
          internationalTeamGamesCache.set(cacheKey,empty);
          return empty;
        }

        const gameMap=new Map();
        let cursor=0;
        const workers=Math.min(4,entries.length);
        const work=async()=>{
          while (cursor<entries.length) {
            const entry=entries[cursor++];
            try {
              const data=await baseballRequest('international-player-games',{
                competition,
                year:Number(year),
                team:normalizedTeam,
                playerId:String(entry?.id||''),
                playerName:String(entry?.name||'').trim()
              });
              const games=Array.isArray(data?.games)?data.games:[];
              for (const game of games) {
                const date=String(game?.date||'').slice(0,10);
                if (!date) continue;
                const opponent=normalizeInternationalTeamName(game?.opponent||'');
                const key=internationalRemoteGameKey(game,normalizedTeam);
                if (!gameMap.has(key)) {
                  gameMap.set(key,{
                    key,
                    gameId:String(game?.gameId||''),
                    date,
                    team:normalizedTeam,
                    opponent,
                    partial:Boolean(game?.partial),
                    hitters:new Map(),
                    pitchers:new Map(),
                    sources:new Set()
                  });
                }
                const box=gameMap.get(key);
                box.partial=box.partial||Boolean(game?.partial);
                for (const source of Array.isArray(game?.sources)?game.sources:[]) {
                  if (source) box.sources.add(String(source));
                }
                const playerId=String(entry?.id||entry?.name||'');
                const playerName=String(entry?.zhName||entry?.name||'未命名球員');
                if (game?.hitter) {
                  const h=game.hitter;
                  box.hitters.set(playerId,{
                    id:playerId,
                    number:String(entry?.number||''),
                    name:playerName,
                    position:String(entry?.position||''),
                    pa:internationalGameNumber(h?.pa),
                    ab:internationalGameNumber(h?.ab),
                    r:internationalGameNumber(h?.runs),
                    h:internationalGameNumber(h?.hits)||(
                      internationalGameNumber(h?.single)+internationalGameNumber(h?.double)+internationalGameNumber(h?.triple)+internationalGameNumber(h?.hr)
                    ),
                    rbi:internationalGameNumber(h?.rbi),
                    bb:internationalGameNumber(h?.bb)+internationalGameNumber(h?.ibb),
                    k:internationalGameNumber(h?.k),
                    hr:internationalGameNumber(h?.hr),
                    errors:internationalGameNumber(h?.errors)
                  });
                }
                if (game?.pitcher) {
                  const p=game.pitcher;
                  box.pitchers.set(playerId,{
                    id:playerId,
                    number:String(entry?.number||''),
                    name:playerName,
                    innings:String(p?.innings||outsToIP(Number(p?.outs)||0)||'0.0'),
                    h:internationalGameNumber(p?.h),
                    r:internationalGameNumber(p?.r),
                    er:internationalGameNumber(p?.er),
                    bb:internationalGameNumber(p?.bb),
                    k:internationalGameNumber(p?.k),
                    pitches:internationalGameNumber(p?.pitchCount),
                    decision:internationalGameNumber(p?.w)>0?'W':internationalGameNumber(p?.l)>0?'L':internationalGameNumber(p?.sv)>0?'SV':internationalGameNumber(p?.hld)>0?'HLD':''
                  });
                }
              }
            } catch (error) {
              console.warn('國際賽球員逐場整合失敗',entry?.name,error);
            }
          }
        };
        await Promise.all(Array.from({length:workers},()=>work()));

        const games=[...gameMap.values()].map(box=>({
          ...box,
          hitters:[...box.hitters.values()],
          pitchers:[...box.pitchers.values()],
          sources:[...box.sources]
        })).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.gameId||'').localeCompare(String(a.gameId||'')));

        const result={games,error:'',updatedAt:Date.now()};
        internationalTeamGamesCache.set(cacheKey,result);
        return result;
      } finally {
        internationalTeamGamesLoading.delete(cacheKey);
      }
    }

    function internationalTeamBoxTotals(box) {
      const hitters=Array.isArray(box?.hitters)?box.hitters:[];
      return hitters.reduce((sum,row)=>({
        r:sum.r+internationalGameNumber(row?.r),
        h:sum.h+internationalGameNumber(row?.h),
        e:sum.e+internationalGameNumber(row?.errors)
      }),{r:0,h:0,e:0});
    }

    function internationalFindOpponentBox(competition, year, team, game) {
      const opponent=normalizeInternationalTeamName(game?.opponent||'');
      if (!opponent) return null;
      const data=internationalTeamGamesCache.get(internationalTeamGamesKey(competition,year,opponent));
      const games=Array.isArray(data?.games)?data.games:[];
      return games.find(item =>
        (game?.gameId && item?.gameId && String(item.gameId)===String(game.gameId))
        || (
          String(item?.date||'')===String(game?.date||'')
          && normalizeInternationalTeamName(item?.opponent||'')===normalizeInternationalTeamName(team)
        )
      )||null;
    }

    function internationalBoxTable(team, box, type) {
      const rows=Array.isArray(type==='pitcher'?box?.pitchers:box?.hitters)?(type==='pitcher'?box.pitchers:box.hitters):[];
      if (!rows.length) return '<div class="intl-team-box-empty">沒有可用紀錄</div>';
      if (type==='pitcher') {
        return '<div class="intl-team-box-scroll"><table class="intl-team-box-table"><thead><tr><th>投手</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>NP</th></tr></thead><tbody>'+
          rows.map(row=>'<tr><td><strong>'+escapeHtml(row.name||'—')+'</strong>'+ (row.decision?'<small>'+escapeHtml(row.decision)+'</small>':'') +'</td><td>'+escapeHtml(row.innings||'0.0')+'</td><td>'+row.h+'</td><td>'+row.r+'</td><td>'+row.er+'</td><td>'+row.bb+'</td><td>'+row.k+'</td><td>'+(row.pitches||'—')+'</td></tr>').join('')+
          '</tbody></table></div>';
      }
      const totals=internationalTeamBoxTotals(box);
      return '<div class="intl-team-box-scroll"><table class="intl-team-box-table"><thead><tr><th>打者</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>K</th><th>HR</th></tr></thead><tbody>'+
        rows.map(row=>'<tr><td><strong>'+escapeHtml(row.name||'—')+'</strong></td><td>'+row.ab+'</td><td>'+row.r+'</td><td>'+row.h+'</td><td>'+row.rbi+'</td><td>'+row.bb+'</td><td>'+row.k+'</td><td>'+row.hr+'</td></tr>').join('')+
        '<tr class="intl-team-box-total"><td>TOTAL</td><td>—</td><td>'+totals.r+'</td><td>'+totals.h+'</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>'+
        '</tbody></table></div>';
    }

    function internationalGameCenterDetailHtml(competition, year, team, game) {
      if (!game) return '';
      const opponentBox=internationalFindOpponentBox(competition,year,team,game);
      const ownTotals=internationalTeamBoxTotals(game);
      const oppTotals=internationalTeamBoxTotals(opponentBox);
      const opponent=normalizeInternationalTeamName(game?.opponent||'')||'對手';
      const opponentLoading=internationalTeamGamesLoading.has(internationalTeamGamesKey(competition,year,opponent));
      return '<div class="intl-team-game-detail">'+
        '<div class="intl-team-game-detail-head">'+
          '<button type="button" class="press-btn" data-intl-game-center-back>← 返回比賽</button>'+
          '<div><strong>'+escapeHtml(team)+' <b>'+ownTotals.r+'</b>：<b>'+(opponentBox?oppTotals.r:'—')+'</b> '+escapeHtml(opponent)+'</strong><span>'+escapeHtml(String(game.date||'').replaceAll('-','/'))+(game.partial?'｜部分資料':'')+'</span></div>'+
        '</div>'+
        '<div class="intl-team-game-score">'+
          '<span>'+escapeHtml(team)+'</span><b>'+ownTotals.r+'</b><em>R</em><b>'+ownTotals.h+'</b><em>H</em><b>'+ownTotals.e+'</b><em>E</em>'+
          '<span>'+escapeHtml(opponent)+'</span><b>'+(opponentBox?oppTotals.r:'—')+'</b><em>R</em><b>'+(opponentBox?oppTotals.h:'—')+'</b><em>H</em><b>'+(opponentBox?oppTotals.e:'—')+'</b><em>E</em>'+
        '</div>'+
        '<div class="intl-team-box-grid">'+
          '<section><h4>'+escapeHtml(team)+'｜打者</h4>'+internationalBoxTable(team,game,'hitter')+'</section>'+
          '<section><h4>'+escapeHtml(opponent)+'｜打者</h4>'+(opponentBox?internationalBoxTable(opponent,opponentBox,'hitter'):'<div class="intl-team-box-empty">'+(opponentLoading?'正在整理對手 Box…':'對手資料尚未載入')+'</div>')+'</section>'+
          '<section><h4>'+escapeHtml(team)+'｜投手</h4>'+internationalBoxTable(team,game,'pitcher')+'</section>'+
          '<section><h4>'+escapeHtml(opponent)+'｜投手</h4>'+(opponentBox?internationalBoxTable(opponent,opponentBox,'pitcher'):'<div class="intl-team-box-empty">'+(opponentLoading?'正在整理對手 Box…':'對手資料尚未載入')+'</div>')+'</section>'+
        '</div>'+
      '</div>';
    }

    function internationalGameCenterListHtml(competition, year, team) {
      const cacheKey=internationalTeamGamesKey(competition,year,team);
      const data=internationalTeamGamesCache.get(cacheKey);
      const loading=internationalTeamGamesLoading.has(cacheKey);
      if (loading && !data) return '<div class="intl-flow-empty">正在整合代表隊逐場 Box Score…第一次載入會稍久一點。</div>';
      if (data?.error) return '<div class="intl-flow-empty">'+escapeHtml(data.error)+'</div>';
      const games=Array.isArray(data?.games)?data.games:[];
      if (!games.length) return '<div class="intl-flow-empty">目前沒有可組成整場比賽的逐場資料。</div>';
      if (internationalSelectedTeamGameKey) {
        const selected=games.find(game=>game.key===internationalSelectedTeamGameKey);
        if (selected) return internationalGameCenterDetailHtml(competition,year,team,selected);
        internationalSelectedTeamGameKey='';
      }
      return '<div class="intl-team-games">'+
        '<div class="intl-game-archive-head"><h3 style="margin:0">整場比賽</h3><span class="small">共 '+games.length+' 場</span></div>'+
        '<div class="intl-game-archive-list">'+games.map(game=>{
          const totals=internationalTeamBoxTotals(game);
          return '<div class="intl-game-card">'+
            '<div class="intl-game-date">'+escapeHtml(String(game.date||'').replaceAll('-','/'))+'</div>'+
            '<div class="intl-game-main"><strong>'+escapeHtml(team)+' VS '+escapeHtml(game.opponent||'對手')+'</strong><span>'+totals.r+' 分｜'+totals.h+' 安'+(game.partial?'｜部分資料':'')+'</span></div>'+
            '<button type="button" class="press-btn" data-intl-team-game="'+escapeHtml(game.key)+'">查看整場</button>'+
          '</div>';
        }).join('')+'</div>'+
      '</div>';
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

      let gameCenterHtml='';
      if (homeInternationalViewMode==='games' && competition && year && team) {
        const gameCacheKey=internationalTeamGamesKey(competition,year,team);
        if (!internationalTeamGamesCache.has(gameCacheKey) && !internationalTeamGamesLoading.has(gameCacheKey)) {
          void loadInternationalTeamGameBoxes(competition,year,team).then(()=>renderInternationalExplorer());
        }
        gameCenterHtml=internationalGameCenterListHtml(competition,year,team);
      }

      els.homeInternationalExplorer.innerHTML =
        '<div class="intl-explorer-head"><strong>國際賽資料庫</strong><span>賽事 → 年份 → 球隊 → '+(homeInternationalViewMode==='games'?'比賽':'球員')+'</span></div>' +
        '<div class="intl-select-flow '+(homeInternationalViewMode==='games'?'is-game-mode':'')+'">' +
          '<label class="intl-select-step"><span>1．賽事</span><select id="intlCompetitionSelect">'+competitionOptions+'</select></label>' +
          '<label class="intl-select-step"><span>2．年份</span><select id="intlYearSelect" '+(!competition?'disabled':'')+'>'+yearOptions+'</select></label>' +
          '<label class="intl-select-step"><span>3．球隊</span><select id="intlTeamSelect" '+(!(competition&&year)?'disabled':'')+'>'+teamOptions+'</select></label>' +
          (homeInternationalViewMode==='players'
            ? '<label class="intl-select-step"><span>4．球員</span><select id="intlPlayerSelect" '+(!(competition&&year&&team)?'disabled':'')+'>'+playerOptions+'</select></label>'
            : '') +
        '</div>' +
        (competition&&year&&team
          ? '<div class="intl-view-toggle"><button type="button" class="'+(homeInternationalViewMode==='players'?'active':'')+'" data-intl-view="players">球員</button><button type="button" class="'+(homeInternationalViewMode==='games'?'active':'')+'" data-intl-view="games">比賽</button></div>'
          : '') +
        (path ? '<div class="intl-flow-path">'+escapeHtml(path)+'</div>' : '') +
        (emptyText && homeInternationalViewMode==='players' ? '<div class="intl-flow-empty">'+escapeHtml(emptyText)+'</div>' : '') +
        gameCenterHtml;
      els.homeInternationalExplorer.classList.remove('hidden');

      const competitionSelect=document.getElementById('intlCompetitionSelect');
      const yearSelect=document.getElementById('intlYearSelect');
      const teamSelect=document.getElementById('intlTeamSelect');
      const playerSelect=document.getElementById('intlPlayerSelect');

      competitionSelect?.addEventListener('change', () => {
        homeSpecialFilter=competitionSelect.value||'';
        homeInternationalEditionFilter='';
        homeInternationalTeamFilter='';
        internationalSelectedTeamGameKey='';
        renderRecentPlayers();
      });
      yearSelect?.addEventListener('change', () => {
        homeInternationalEditionFilter=yearSelect.value||'';
        homeInternationalTeamFilter='';
        internationalSelectedTeamGameKey='';
        renderRecentPlayers();
      });
      teamSelect?.addEventListener('change', () => {
        homeInternationalTeamFilter=teamSelect.value||'';
        internationalSelectedTeamGameKey='';
        renderRecentPlayers();
      });
      els.homeInternationalExplorer.querySelectorAll('[data-intl-view]').forEach(button => button.addEventListener('click', () => {
        homeInternationalViewMode=String(button.dataset.intlView||'players')==='games'?'games':'players';
        internationalSelectedTeamGameKey='';
        renderInternationalExplorer();
      }));
      els.homeInternationalExplorer.querySelectorAll('[data-intl-team-game]').forEach(button => button.addEventListener('click', async () => {
        internationalSelectedTeamGameKey=String(button.dataset.intlTeamGame||'');
        const data=internationalTeamGamesCache.get(internationalTeamGamesKey(competition,year,team));
        const selected=(Array.isArray(data?.games)?data.games:[]).find(game=>game.key===internationalSelectedTeamGameKey);
        renderInternationalExplorer();
        const opponent=normalizeInternationalTeamName(selected?.opponent||'');
        if (selected && opponent && !internationalFindOpponentBox(competition,year,team,selected)) {
          await loadInternationalTeamGameBoxes(competition,year,opponent);
          renderInternationalExplorer();
        }
      }));
      els.homeInternationalExplorer.querySelector('[data-intl-game-center-back]')?.addEventListener('click', () => {
        internationalSelectedTeamGameKey='';
        renderInternationalExplorer();
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
