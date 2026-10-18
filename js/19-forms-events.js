    function competitionOptionsHtml(scope, selected = '') {
      const options = specialOptionsForScope(scope);
      return options.map(option =>
        `<option value="${escapeHtml(option)}" ${selected === option ? 'selected' : ''}>${escapeHtml(option)}</option>`
      ).join('');
    }

    function updateAddPlayerScopeUI(scope = homeZone) {
      scope = scope === 'international' || scope === 'overseas' ? scope : 'cpbl';
      if (els.newPlayerScope) els.newPlayerScope.value = scope;
      const external = scope !== 'cpbl';
      els.newPlayerExternalFields?.classList.toggle('hidden', !external);

      if (els.newPlayerCompetition) {
        const previous = String(els.newPlayerCompetition.value || '');
        const options = specialOptionsForScope(scope);
        els.newPlayerCompetition.innerHTML = external ? competitionOptionsHtml(scope, previous) : '';
        if (external && options.includes(previous)) els.newPlayerCompetition.value = previous;
      }
      if (els.newPlayerExternalYear && !els.newPlayerExternalYear.value) {
        els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      }

      const competition = String(els.newPlayerCompetition?.value || '');
      const provider = overseasProvider(competition);

      if (els.newPlayerCompetitionLabel?.childNodes?.[0]) {
        els.newPlayerCompetitionLabel.childNodes[0].nodeValue = scope === 'international' ? '賽事\n          ' : '聯盟\n          ';
      }
      if (els.newPlayerTeamLabel?.childNodes?.[0]) {
        els.newPlayerTeamLabel.childNodes[0].nodeValue = scope === 'international' ? '代表隊\n          ' : '球隊\n          ';
      }
      if (els.newPlayerYearLabel?.childNodes?.[0]) {
        els.newPlayerYearLabel.childNodes[0].nodeValue = scope === 'international' ? '屆別年份\n          ' : '賽季年份\n          ';
      }
      if (els.newPlayerExternalTeam) {
        els.newPlayerExternalTeam.placeholder = scope === 'international'
          ? '例如：中華台北、日本、韓國'
          : '例如：Los Angeles Dodgers';
      }

      const cpblButton = document.getElementById('createCpblPlayerBtn');
      const externalButton = document.getElementById('createExternalPlayerBtn');
      const manualButton = document.getElementById('createManualPlayerBtn');

      cpblButton?.classList.toggle('hidden', scope !== 'cpbl');
      externalButton?.classList.toggle('hidden', !(scope === 'overseas' && provider));
      if (externalButton && provider) externalButton.textContent = `搜尋 ${overseasProviderLabel(provider)} 資料`;

      if (manualButton) {
        manualButton.textContent = scope === 'cpbl' ? '純新增' : scope === 'overseas' && provider ? '手動建立' : '建立球員';
      }

      if (els.newPlayerScopeHelp) {
        els.newPlayerScopeHelp.textContent = scope === 'overseas' && provider
          ? `可直接用中文／英文／日文／韓文姓名搜尋 ${overseasProviderLabel(provider)}；建立後會自動同步賽季資料，當日資料可在球員頁匯入。`
          : scope === 'international'
            ? '國際賽以「賽事 → 屆別 → 代表隊」獨立保存；同一位球員可以在不同屆賽事各自建立紀錄。'
            : external
              ? '此球員會建立在獨立專區，成績、戰報與中職資料分開保存。'
              : '純新增不連結中職；搜尋中職資料會用姓名＋背號查詢。連結官網後會以官方守位決定主要分類；若球員實際有投打兩種紀錄，會自動整合在同一位球員內。';
      }

      if (scope === 'international' || (scope === 'overseas' && !provider)) {
        hideNewPlayerSuggestions();
      }
    }

    function prepareAddPlayerDialog() {
      clearNewPlayerForm();
      updateAddPlayerScopeUI(homeZone);

      if (homeZone === 'international') {
        if (homeSpecialFilter && els.newPlayerCompetition) {
          els.newPlayerCompetition.value = homeSpecialFilter;
          updateAddPlayerScopeUI('international');
        }
        if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = homeInternationalEditionFilter || String(CURRENT_YEAR);
        if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = homeInternationalTeamFilter || '';
      } else if (homeZone === 'overseas') {
        if (els.newPlayerCompetition && homeSpecialFilter) {
          els.newPlayerCompetition.value = homeSpecialFilter;
          updateAddPlayerScopeUI('overseas');
          els.newPlayerCompetition.value = homeSpecialFilter;
          updateAddPlayerScopeUI('overseas');
        }
        if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = '';
        if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      } else {
        if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = '';
        if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      }
      els.addDialog.showModal();
    }

    document.getElementById('addPlayerBtn').addEventListener('click', prepareAddPlayerDialog);

    els.homeZoneSwitch?.querySelectorAll('[data-home-root]').forEach(button => {
      button.addEventListener('click', () => {
        const chosenRoot = button.dataset.homeRoot;
        const homepage = document.getElementById('homePage');
        if (chosenRoot === 'combined') {
          if (homepage) { homepage.classList.add('combined-home-mode'); homepage.dataset.combinedView = 'landing'; }
          homeRootSection = 'reels';
          homeZone = 'reels';
          renderRecentPlayers();
          document.getElementById('combinedCompetitionCards')?.classList.remove('hidden');
          document.getElementById('combinedCompetitionBack')?.classList.add('hidden');
          document.getElementById('combinedCompetitionHub')?.classList.remove('hidden');
          return;
        }
        if (homepage) { homepage.classList.remove('combined-home-mode'); delete homepage.dataset.combinedView; }
        // Leaving the combined hub must also hide its DOM, not just remove the
        // layout class; otherwise cards remain visible beneath pro league tabs.
        document.getElementById('combinedCompetitionHub')?.classList.add('hidden');
        document.getElementById('combinedCompetitionCards')?.classList.remove('hidden');
        document.getElementById('combinedCompetitionBack')?.classList.add('hidden');
        document.getElementById('combinedInternationalDetail')?.classList.add('hidden');
        homeRootSection = ['international','special','reels'].includes(chosenRoot) ? chosenRoot : 'pro';
        if (chosenRoot === 'asia' || chosenRoot === 'america') {
          homeProContinent = chosenRoot === 'america' ? 'AMERICA' : 'ASIA';
          if (homeProContinent === 'AMERICA') homeProCountry = 'US';
          else if (!['TW','JP','KR'].includes(homeProCountry)) homeProCountry = 'TW';
        }
        if (homeRootSection === 'international') {
          homeZone = 'international';
          homeSpecialFilter = '';
          homeInternationalEditionFilter = '';
          homeInternationalTeamFilter = '';
        } else if (homeRootSection === 'reels') {
          homeZone = 'reels';
        } else if (homeRootSection === 'special') {
          homeZone = 'special';
          homeSpecialFilter = '';
          if (typeof authorCollectionSection !== 'undefined') authorCollectionSection = '';
          if (els.homeSpecialGamesExplorer) els.homeSpecialGamesExplorer.scrollTop = 0;
        } else {
          applyHomeProSelection();
        }
        homeTeamFilter = '';
        renderRecentPlayers();
      });
    });

    // Standalone tournament UI shares the existing roster/individual player path.
    const dsIntlPage = document.getElementById('dsInternationalPage');
    const dsIntlTitle = document.getElementById('dsIntlPageTitle');
    const dsIntlYear = document.getElementById('dsIntlYear');
    const dsIntlHero = document.getElementById('dsIntlHero');
    const dsIntlTabs = document.getElementById('dsIntlTabs');
    const dsIntlBody = document.getElementById('dsIntlPageBody');
    let dsIntlCompetition = '';
    let dsIntlTab = 'schedule';
    let dsIntlTeam = '';
    let dsIntlOpenToken = 0;
    const dsIntlLabels = {schedule:'賽程',teams:'球隊',venues:'場地',rankings:'球隊排名'};
    // Verified official tournament snapshots only. No synthesized schedules or standings.
    const dsIntlOfficial = {
      'WBC:2026':{
        source:'https://www.2026wbc.jp/schedule/',
        venues:['東京巨蛋（日本東京）','Hiram Bithorn Stadium（波多黎各聖胡安）','Daikin Park（美國休士頓）','loanDepot park（美國邁阿密）'],
        games:[
          ['03/05','澳洲','中華台北',3,0,'東京巨蛋'],
          ['03/05','韓國','捷克',11,4,'東京巨蛋'],
          ['03/06','捷克','澳洲',1,5,'東京巨蛋'],
          ['03/06','中華台北','日本',0,13,'東京巨蛋'],
          ['03/07','捷克','中華台北',0,14,'東京巨蛋'],
          ['03/07','日本','韓國',8,6,'東京巨蛋'],
          ['03/08','韓國','中華台北',4,5,'東京巨蛋'],
          ['03/08','日本','澳洲',4,3,'東京巨蛋'],
          ['03/09','澳洲','韓國',2,7,'東京巨蛋'],
          ['03/10','日本','捷克',9,0,'東京巨蛋']
        ]
      },
      'WBCQ:2025':{
        source:'https://www.mlb.com/world-baseball-classic/qualifiers',
        venues:['臺北大巨蛋（臺灣臺北）','Kino Veterans Memorial Stadium（美國圖森）'],
        games:[
          ['02/21','西班牙','中華台北',12,5,'臺北大巨蛋'],
          ['02/22','中華台北','南非',9,1,'臺北大巨蛋'],
          ['02/23','尼加拉瓜','中華台北',6,0,'臺北大巨蛋'],
          ['02/25','中華台北','西班牙',6,3,'臺北大巨蛋'],
          ['03/02','德國','中國',12,2,'圖森'],
          ['03/02','哥倫比亞','巴西',5,0,'圖森'],
          ['03/06','巴西','德國',6,4,'圖森']
        ],
        standings:[
          ['臺北組','尼加拉瓜',3,0],['臺北組','中華台北',2,2],['臺北組','西班牙',2,2],['臺北組','南非',0,3],
          ['圖森組','哥倫比亞',3,0],['圖森組','巴西',3,1],['圖森組','德國',1,3],['圖森組','中國',0,3]
        ]
      },
      '世界12強:2024':{
        source:'https://www.koreabaseball.com/Schedule/International/Etc/Premier2024.aspx',
        venues:['東京巨蛋（日本東京，複賽與決賽）']
      },
      '亞錦賽:2025':{
        source:'https://www.japan-baseball.jp/en/team/amateur/2025/asianchampionship/overview.html',
        venues:['Pingtan Park（中國平潭）','Baseball Park（中國平潭）'],
        games:[
          ['09/22','菲律賓','日本',1,18,'Baseball Park'],
          ['09/22','中國','巴基斯坦',10,0,'Pingtan Park'],
          ['09/22','巴勒斯坦','中華台北',0,14,'Pingtan Park'],
          ['09/22','韓國','香港',16,1,'Baseball Park'],
          ['09/23','中國','菲律賓',4,2,'Pingtan Park'],
          ['09/23','中華台北','韓國',10,0,'Pingtan Park'],
          ['09/24','日本','中國',13,0,'Pingtan Park'],
          ['09/24','中華台北','香港',11,0,'Baseball Park']
        ],
        standings:[['A組','日本',3,0],['A組','中國',2,1],['A組','菲律賓',1,2],['A組','巴基斯坦',0,3]]
      }
    };

    // Official final places / first-round group positions, NOT a sort of aggregate wins.
    // Primary sources: WBSC (Premier12), MLB/WBCI (World Baseball Classic).
    const dsIntlVerifiedRankings = {
      '世界12強:2024':{kind:'final',source:'https://federation-staging-0.wbsc.org/zh/events/2024-premier12/standings',rows:[
        [1,'中華台北',6,3],[2,'日本',8,1],[3,'美國',5,4],[4,'委內瑞拉',5,4],
        [5,'韓國',3,2],[5,'巴拿馬',3,2],[7,'澳洲',1,4],[7,'墨西哥',2,3],
        [9,'多明尼加',1,4],[9,'荷蘭',2,3],[11,'古巴',1,4],[11,'波多黎各',1,4]
      ]},
      '世界12強:2019':{kind:'final',source:'https://www.japan-baseball.jp/jp/games/2019premier12/',rows:[
        [1,'日本',7,1],[2,'韓國',5,3],[3,'墨西哥',6,2],[4,'美國',4,4],
        [5,'中華台北',4,3],[6,'澳洲',2,5],[7,'加拿大',1,2],[7,'多明尼加',1,2],
        [7,'委內瑞拉',1,2],[10,'古巴',1,2],[10,'荷蘭',0,3],[10,'波多黎各',0,3]
      ]},
      '世界12強:2015':{kind:'final',source:'https://s3.eu-west-1.amazonaws.com/static.wbsc.org/assets/documents/202106_Tokyo2020_mediaguide_DEFfinal.pdf',rows:[
        [1,'韓國',6,2],[2,'美國',5,3],[3,'日本',7,1],[4,'墨西哥',3,5],
        [5,'加拿大',5,1],[6,'古巴',3,3],[7,'荷蘭',3,3],[8,'波多黎各',2,4],
        [9,'中華台北',2,3],[10,'委內瑞拉',2,3],[11,'多明尼加',0,5],[12,'義大利',0,5]
      ]},
      'WBC:2026':{kind:'wbc',source:'https://www.mlb.com/world-baseball-classic/history/2026',
        top:['委內瑞拉','美國','多明尼加','義大利'],groups:[
          ['A組｜聖胡安',[['加拿大',3,1,1],['波多黎各',3,1,1],['古巴',2,2],['哥倫比亞',1,3],['巴拿馬',1,3]]],
          ['B組｜休士頓',[['義大利',4,0,1],['美國',3,1,1],['墨西哥',2,2],['英國',1,3],['巴西',0,4]]],
          ['C組｜東京',[['日本',4,0,1],['韓國',2,2,1],['澳洲',2,2],['中華台北',2,2],['捷克',0,4]]],
          ['D組｜邁阿密',[['多明尼加',4,0,1],['委內瑞拉',3,1,1],['以色列',2,2],['荷蘭',1,3],['尼加拉瓜',0,4]]]
        ]},
      'WBC:2023':{kind:'wbc',source:'https://www.mlb.com/world-baseball-classic/history/2023',
        top:['日本','美國','墨西哥','古巴'],groups:[
          ['A組｜臺中',[['古巴',2,2,1],['義大利',2,2,1],['荷蘭',2,2],['巴拿馬',2,2],['中華台北',2,2]]],
          ['B組｜東京',[['日本',4,0,1],['澳洲',3,1,1],['韓國',2,2],['捷克',1,3],['中國',0,4]]],
          ['C組｜鳳凰城',[['墨西哥',3,1,1],['美國',3,1,1],['加拿大',2,2],['英國',1,3],['哥倫比亞',1,3]]],
          ['D組｜邁阿密',[['委內瑞拉',4,0,1],['波多黎各',3,1,1],['多明尼加',2,2],['以色列',1,3],['尼加拉瓜',0,4]]]
        ]},
      'WBC:2017':{kind:'wbc',source:'https://www.mlb.com/world-baseball-classic/history/2017',
        top:['美國','波多黎各','日本','荷蘭'],groups:[
          ['A組｜首爾',[['以色列',3,0,1],['荷蘭',2,1,1],['韓國',1,2],['中華台北',0,3]]],
          ['B組｜東京',[['日本',3,0,1],['古巴',2,1,1],['澳洲',1,2],['中國',0,3]]],
          ['C組｜邁阿密',[['多明尼加',3,0,1],['美國',2,1,1],['哥倫比亞',1,2],['加拿大',0,3]]],
          ['D組｜哈利斯科',[['波多黎各',3,0,1],['委內瑞拉',2,2,1],['義大利',1,3],['墨西哥',1,2]]]
        ]},
      'WBC:2013':{kind:'wbc',source:'https://www.mlb.com/world-baseball-classic/history/2013',
        top:['多明尼加','波多黎各','日本','荷蘭'],groups:[
          ['A組｜福岡',[['古巴',3,0,1],['日本',2,1,1],['中國',1,2],['巴西',0,3]]],
          ['B組｜臺中',[['中華台北',2,1,1],['荷蘭',2,1,1],['韓國',2,1],['澳洲',0,3]]],
          ['C組｜聖胡安',[['多明尼加',3,0,1],['波多黎各',2,1,1],['委內瑞拉',1,2],['西班牙',0,3]]],
          ['D組｜亞利桑那',[['美國',2,1,1],['義大利',2,1,1],['加拿大',1,2],['墨西哥',1,2]]]
        ]},
      'WBC:2009':{kind:'wbc',source:'https://www.mlb.com/world-baseball-classic/history/2009',
        top:['日本','韓國','美國','委內瑞拉'],groups:[
          ['A組｜東京',[['韓國',3,1,1],['日本',2,1,1],['中華台北',1,2],['中國',0,2]]],
          ['B組｜墨西哥城',[['古巴',3,0,1],['墨西哥',2,2,1],['澳洲',1,2],['南非',0,2]]],
          ['C組｜多倫多',[['委內瑞拉',3,1,1],['美國',2,1,1],['義大利',1,2],['加拿大',0,2]]],
          ['D組｜聖胡安',[['波多黎各',3,0,1],['荷蘭',2,2,1],['多明尼加',1,2],['巴拿馬',0,2]]]
        ]},
      'WBC:2006':{kind:'wbc',source:'https://www.mlb.com/world-baseball-classic/history/2006',
        top:['日本','古巴','韓國','多明尼加'],groups:[
          ['A組｜東京',[['韓國',3,0,1],['日本',2,1,1],['中華台北',1,2],['中國',0,3]]],
          ['B組｜亞利桑那',[['墨西哥',2,1,1],['美國',2,1,1],['加拿大',2,1],['南非',0,3]]],
          ['C組｜聖胡安',[['波多黎各',3,0,1],['古巴',2,1,1],['荷蘭',1,2],['巴拿馬',0,3]]],
          ['D組｜佛羅里達',[['多明尼加',3,0,1],['委內瑞拉',2,1,1],['義大利',1,2],['澳洲',0,3]]]
        ]}
    };


    function renderIntlOfficialRankings(data){
      if(!data)return '';
      const link='<p class="ds-intl-source">官方資料：<a href="'+escapeHtml(data.source)+'" target="_blank" rel="noopener noreferrer">查看賽事排名來源 ↗</a></p>';
      if(data.kind==='final'){
        return '<p class="ds-intl-source">官方賽事最終排名（並列名次依官方原序顯示）。勝敗為整屆戰績，不用勝率重排名次。</p>'+
          data.rows.map(t=>'<article class="ds-intl-game"><small>第 '+Number(t[0])+' 名</small><strong>'+
          escapeHtml(intlLocalizeTeam(t[1]))+'　'+Number(t[2])+'勝 '+Number(t[3])+'敗</strong></article>').join('')+link;
      }
      if(data.kind==='wbc'){
        const labels=['冠軍','亞軍','四強（並列）','四強（並列）'];
        let html='<h4 class="ds-intl-standing-heading">淘汰賽最終結果</h4>'+
          '<p class="ds-intl-source">經典賽沒有季軍戰；兩支四強止步球隊不分第三、第四名。</p>'+
          data.top.map((team,i)=>'<article class="ds-intl-game"><small>'+labels[i]+'</small><strong>'+
            escapeHtml(intlLocalizeTeam(team))+'</strong></article>').join('')+
          '<h4 class="ds-intl-standing-heading">官方首輪分組排名</h4>'+
          '<p class="ds-intl-source">依 WBC 官方排序及同組比較規則，並非用總勝率自行重排。</p>';
        for(const [group,teams] of data.groups){
          html+='<h4 class="ds-intl-standing-heading">'+escapeHtml(group)+'</h4>'+
            teams.map((t,i)=>'<article class="ds-intl-game"><small>第 '+(i+1)+' 名'+
              (t[3]?' · 晉級次輪':'')+'</small><strong>'+escapeHtml(intlLocalizeTeam(t[0]))+
              '　'+Number(t[1])+'勝 '+Number(t[2])+'敗</strong></article>').join('');
        }
        return html+link;
      }
      return '';
    }

    // Share the same country-name normalization used by international player records.
    const intlLocalizeTeam = name => normalizeInternationalTeamName(name);
    const intlVenueNames = {
      'Tokyo Dome':'東京巨蛋','Taipei Dome':'臺北大巨蛋','Taipei Tianmu Baseball Stadium':'臺北天母棒球場',
      'Tianmu Baseball Stadium':'臺北天母棒球場','Taichung Intercontinental Baseball Stadium':'臺中洲際棒球場',
      'Taoyuan International Baseball Stadium':'桃園國際棒球場','Gocheok Sky Dome':'高尺天空巨蛋',
      'Jamsil Baseball Stadium':'蠶室棒球場','Kyocera Dome Osaka':'大阪京瓷巨蛋',
      'Hiram Bithorn Stadium':'席然畢松球場','Daikin Park':'大金公園球場（休士頓）',
      'loanDepot park':'貸得寶球場（邁阿密）','Kino Veterans Memorial Stadium':'基諾退伍軍人紀念球場',
      'Pingtan Park':'平潭棒球場'
    };
    const intlLocalizeVenue = name => {
      const raw=String(name||'').trim();
      const key=raw.toLowerCase().replace(/\s+/g,' ');
      const found=Object.entries(intlVenueNames).find(([en])=>en.toLowerCase()===key);
      return found?found[1]:raw;
    };
    function intlLocalizeGameStatus(status) {
      const raw=String(status||'').trim();
      if(!raw) return '';
      if(/^(final|completed|finished|game over)(\s*\/\s*\d+)?$/i.test(raw))return '比賽結束'+(raw.match(/\/\s*\d+/)?.[0]||'');
      if(/^(scheduled|preview|pre-game|not started|not yet started|upcoming)$/i.test(raw))return '未開賽';
      if(/^(live|in progress|playing|ongoing)$/i.test(raw))return '進行中';
      if(/^(postponed|ppd)$/i.test(raw))return '延賽';
      if(/^(cancelled|canceled)$/i.test(raw))return '取消';
      if(/^(suspended|interrupted)$/i.test(raw))return '暫停';
      if(/^(delayed|delay)$/i.test(raw))return '延遲';
      return raw;
    }
    const intlStoredGamesCache = new Map();
    async function readIntlStoredGames(competition,year){
      const key=competition+':'+year;
      try{
        const records=await idbGetAll(STORES.games);
        const localPlayers=new Map(players.filter(p=>playerScope(p)==='international' &&
          playerSpecialCompetition(p)===competition && String(internationalEdition(p))===String(year))
          .map(p=>[String(p.id),p]));
        const dedup=new Map();
        for(const rec of records){
          if(!rec?.internationalOfficialImport || !localPlayers.has(String(rec.playerId)))continue;
          const player=localPlayers.get(String(rec.playerId));
          const team=intlLocalizeTeam(internationalTeam(player));
          const opponent=intlLocalizeTeam(rec.opponent||'');
          if(!team||!opponent||!rec.date)continue;
          const id=String(rec.internationalGameId||'');
          const names=[team,opponent].sort().join('|');
          const dedupKey=id?'id:'+id:'date:'+rec.date+':'+names;
          const prior=dedup.get(dedupKey);
          if(prior){prior.playerCount++;continue;}
          dedup.set(dedupKey,{id,date:String(rec.date).slice(0,10),away:team,home:opponent,
            awayScore:null,homeScore:null,venue:'',status:'球員逐場紀錄',playerCount:1,fromPlayer:true});
        }
        const games=[...dedup.values()].sort((a,b)=>a.date.localeCompare(b.date));
        intlStoredGamesCache.set(key,games);
        if(!dsIntlPage.classList.contains('hidden')&&dsIntlCompetition===competition&&String(dsIntlYear.value)===String(year))
          renderStandaloneIntl();
      }catch(err){console.warn('[International saved games]',err)}
    }
    const intlScheduleCache = new Map();
    const intlSchedulePending = new Set();
    const intlScheduleRetryAfter = new Map();
    function requestIntlSchedule(competition,year){
      if(!['WBC','WBCQ','世界12強','亞洲運動會','U18亞青','亞錦賽'].includes(competition)||!year)return;
      const key=competition+':'+year;
      if(intlScheduleCache.has(key)||intlSchedulePending.has(key)||Date.now()<(intlScheduleRetryAfter.get(key)||0))return;
      intlSchedulePending.add(key);
      fetch('https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/international-tournament-schedule?competition='+encodeURIComponent(competition)+'&year='+encodeURIComponent(year),{signal:AbortSignal.timeout(14000)})
        .then(r=>{if(!r.ok)throw new Error('schedule '+r.status);return r.json();})
        .then(data=>{
          if(!Array.isArray(data.games)||!data.games.length)throw new Error('empty schedule');
          intlScheduleCache.set(key,data);
        })
        .catch(err=>{intlScheduleRetryAfter.set(key,Date.now()+300000);console.warn('[International schedule]',key,err);})
        .finally(()=>{
          intlSchedulePending.delete(key);
          if(!dsIntlPage.classList.contains('hidden')&&dsIntlCompetition===competition&&dsIntlYear.value===String(year))renderStandaloneIntl();
        });
    }
    function closeStandaloneIntl() {
      ++dsIntlOpenToken;
      dsIntlPage?.classList.add('hidden');
      document.body.style.overflow = '';
    }
    function showStandaloneIntl(competition) {
      if (!INTERNATIONAL_COMPETITIONS.includes(competition)) return;
      dsIntlCompetition = competition;
      dsIntlTeam = '';
      dsIntlTab = 'schedule';
      homeSpecialFilter = competition;
      homeInternationalEditionFilter = String((INTERNATIONAL_TOURNAMENT_YEARS[competition] || [])[0] || '');
      homeInternationalTeamFilter = '';
      dsIntlYear.innerHTML = (INTERNATIONAL_TOURNAMENT_YEARS[competition] || []).map(y =>
        '<option value="'+y+'">'+y+'</option>').join('');
      dsIntlYear.value = homeInternationalEditionFilter;
      dsIntlPage.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      renderStandaloneIntl();
    }
    function renderStandaloneIntl() {
      if (!dsIntlCompetition || dsIntlPage.classList.contains('hidden')) return;
      const version = ++dsIntlOpenToken;
      const year = String(dsIntlYear.value || '');
      const title = INTERNATIONAL_TOURNAMENT_META[dsIntlCompetition]?.name || dsIntlCompetition;
      dsIntlTitle.textContent = title;
      dsIntlHero.innerHTML = '<h2>'+escapeHtml(title)+'</h2><p>'+escapeHtml(year)+' 年度賽事｜賽程・球隊・場地・球隊排名</p>';
      dsIntlTabs.innerHTML = Object.entries(dsIntlLabels).map(([id,label]) =>
        '<button type="button" data-intl-tab="'+id+'" class="'+(dsIntlTab===id?'active':'')+'">'+label+'</button>').join('');
      if (dsIntlTab === 'teams') {
        if (dsIntlTeam) {
          dsIntlBody.innerHTML = '<button class="press-btn" data-intl-team-back type="button">← 返回球隊</button><h3>'+escapeHtml(dsIntlTeam)+'</h3><div class="ds-intl-empty">正在讀取球員名單…</div>';
          const key = internationalRosterKey(dsIntlCompetition,year,dsIntlTeam);
          const apply = () => {
            if (version !== dsIntlOpenToken) return;
            const data = internationalRosterCache.get(key);
            const roster = Array.isArray(data?.players) ? data.players : [];
            const stored = players.filter(p => playerScope(p)==='international'
              && playerSpecialCompetition(p)===dsIntlCompetition
              && internationalEdition(p)===year && internationalTeam(p)===dsIntlTeam);
            const list = roster.length ? roster.map((p,i)=>'<button type="button" data-intl-roster-index="'+i+'">#'+escapeHtml(p.number||'—')+'　'+escapeHtml(p.zhName||p.name||'球員')+'</button>').join('')
              : stored.map(p=>'<button type="button" data-intl-local-player="'+escapeHtml(p.id)+'">#'+escapeHtml(p.number||'—')+'　'+escapeHtml(p.name||'球員')+'</button>').join('');
            dsIntlBody.innerHTML = '<button class="press-btn" data-intl-team-back type="button">← 返回球隊</button><h3>'+escapeHtml(dsIntlTeam)+'</h3><div class="ds-intl-roster">'+(list||'<div class="ds-intl-empty">本屆球員名單尚未取得。</div>')+'</div>';
          };
          if (internationalRosterCache.has(key)) apply();
          else void loadInternationalRoster(dsIntlCompetition,year,dsIntlTeam).then(apply);
          return;
        }
        const key = internationalTeamListKey(dsIntlCompetition,year);
        const stored = players.filter(p=>playerScope(p)==='international'
          && playerSpecialCompetition(p)===dsIntlCompetition && internationalEdition(p)===year).map(internationalTeam);
        const draw = () => {
          if (version !== dsIntlOpenToken) return;
          const teams = [...new Set([...(INTERNATIONAL_TEAM_CATALOG[dsIntlCompetition+':'+year]||[]),
            ...(internationalTeamCache.get(key)||[]),...stored].map(intlLocalizeTeam).filter(Boolean))];
          dsIntlBody.innerHTML='<h3>參賽球隊</h3><div class="ds-intl-team-list">'+
            (teams.map(t=>'<button data-intl-team="'+escapeHtml(t)+'" type="button">'+escapeHtml(t)+' →</button>').join('')||
            '<div class="ds-intl-empty">尚未取得該屆參賽隊伍。</div>')+'</div>';
        };
        if (internationalTeamCache.has(key)) draw();
        else { draw(); void loadInternationalTeams(dsIntlCompetition,year).then(draw); }
        return;
      }
      const snapshot = dsIntlOfficial[dsIntlCompetition+':'+year];
      const liveSchedule = intlScheduleCache.get(dsIntlCompetition+':'+year);
      const savedGames = intlStoredGamesCache.get(dsIntlCompetition+':'+year)||[];
      const scheduleKey = dsIntlCompetition+':'+year;
      const scheduleLoading = intlSchedulePending.has(scheduleKey);
      const scheduleRetryAt = intlScheduleRetryAfter.get(scheduleKey)||0;
      if(dsIntlTab!=='teams'&&!liveSchedule)requestIntlSchedule(dsIntlCompetition,year);
      if(dsIntlTab==='schedule'&&!intlStoredGamesCache.has(dsIntlCompetition+':'+year)){
        intlStoredGamesCache.set(dsIntlCompetition+':'+year,[]);
        void readIntlStoredGames(dsIntlCompetition,year);
      }
      const messages = {
        schedule:'此屆逐場比賽資料尚未匯入，資料不足時不產生虛構比分。',
        venues:'此屆官方球場資料尚未匯入。',
        rankings:'此屆官方球隊戰績或排名尚未匯入。'
      };
      const verifiedRankings = dsIntlVerifiedRankings[dsIntlCompetition+':'+year];
      const source = dsIntlTab==='rankings' && verifiedRankings ? '' : snapshot?.source ? '<p class="ds-intl-source">資料來源：<a href="'+escapeHtml(snapshot.source)+'" target="_blank" rel="noopener">官方賽事紀錄 ↗</a></p>' : '';
      let body = '';
      const officialGames = liveSchedule?.games||[];
      const knownIds = new Set(officialGames.map(g=>String(g.id||'')).filter(Boolean));
      const knownPairs = new Set(officialGames.map(g=>String(g.date||'').slice(0,10)+':'+[intlLocalizeTeam(g.away),intlLocalizeTeam(g.home)].sort().join('|')));
      const extraGames=savedGames.filter(g=>!knownIds.has(String(g.id||''))&&!knownPairs.has(g.date+':'+[g.away,g.home].sort().join('|')));
      const displayedGames=[...officialGames,...extraGames].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
      if(dsIntlTab==='schedule' && displayedGames.length) {
        body='<p class="ds-intl-source">'+officialGames.length+' 場官方賽程'+(extraGames.length?' · '+extraGames.length+' 場球員逐場紀錄（未驗證比分）':'')+'</p>'+
          displayedGames.map(g=>'<article class="ds-intl-game"><small>'+escapeHtml(g.date||'')+' · '+escapeHtml(intlLocalizeVenue(g.venue||''))+' · '+escapeHtml(intlLocalizeGameStatus(g.status||''))+'</small><strong>'+
          escapeHtml(intlLocalizeTeam(g.away||'待定'))+' <span class="score">'+escapeHtml(String(g.awayScore??'—'))+'</span> — <span class="score">'+escapeHtml(String(g.homeScore??'—'))+'</span> '+escapeHtml(intlLocalizeTeam(g.home||'待定'))+'</strong></article>').join('');
      } else if(dsIntlTab==='venues' && liveSchedule?.games?.length) {
        body=[...new Set(liveSchedule.games.map(g=>intlLocalizeVenue(g.venue)).filter(Boolean))].map(v=>'<article class="ds-intl-game"><strong>'+escapeHtml(v)+'</strong></article>').join('');
      } else if(dsIntlTab==='schedule' && snapshot?.games?.length) {
        body = '<p class="ds-intl-source">已核對場次（部分紀錄，持續補齊其他分組）</p>'+
          snapshot.games.map(g=>'<article class="ds-intl-game"><small>'+year+'/'+g[0]+' · '+escapeHtml(intlLocalizeVenue(g[5]))+'</small><strong>'+escapeHtml(g[1])+
          ' <span class="score">'+g[3]+'</span> — <span class="score">'+g[4]+'</span> '+escapeHtml(g[2])+'</strong></article>').join('');
      } else if(dsIntlTab==='venues' && snapshot?.venues?.length) {
        body = snapshot.venues.map(v=>'<article class="ds-intl-game"><strong>'+escapeHtml(v)+'</strong></article>').join('');
      } else if(dsIntlTab==='rankings' && verifiedRankings) {
        body=renderIntlOfficialRankings(verifiedRankings);
      } else if(dsIntlTab==='rankings' && liveSchedule?.games?.length && !snapshot?.standings?.length) {
        const rows=new Map();
        for(const g of liveSchedule.games){
          const a=Number(g.awayScore),h=Number(g.homeScore);
          if(g.awayScore==null||g.homeScore==null||!Number.isFinite(a)||!Number.isFinite(h)||a===h)continue;
          const away=intlLocalizeTeam(g.away),home=intlLocalizeTeam(g.home);
          if(!away||!home||away===home)continue;
          for(const team of [away,home])if(!rows.has(team))rows.set(team,{team,w:0,l:0,rf:0,ra:0});
          const A=rows.get(away),H=rows.get(home);
          A.w+=a>h?1:0;A.l+=a<h?1:0;A.rf+=a;A.ra+=h;
          H.w+=h>a?1:0;H.l+=h<a?1:0;H.rf+=h;H.ra+=a;
        }
        const ranked=[...rows.values()].sort((a,b)=>
          b.w/(b.w+b.l)-a.w/(a.w+a.l)||b.w-a.w||(b.rf-b.ra)-(a.rf-a.ra)||a.team.localeCompare(b.team,'zh-Hant'));
        if(ranked.length){
          body='<p class="ds-intl-source">依已取得的完整比分計算之勝敗統計；不等同官方分組排名、晉級資格或最終名次。</p>'+
            ranked.map(t=>'<article class="ds-intl-game"><strong>'+escapeHtml(t.team)+
            '　'+t.w+'勝 '+t.l+'敗 · 勝率 '+(t.w/(t.w+t.l)).toFixed(3)+
            '</strong><small>得分 '+t.rf+' · 失分 '+t.ra+'</small></article>').join('');
        }else body='<div class="ds-intl-empty">目前沒有足夠的完整比分可以計算戰績。</div>';
      } else if(dsIntlTab==='rankings' && snapshot?.standings?.length) {
        const isFinalQualifiers=dsIntlCompetition==='WBCQ'&&year==='2025';
        const advanced=new Set(['尼加拉瓜','中華台北','哥倫比亞','巴西']);
        const groupIndex=new Map();
        body='<p class="ds-intl-source">'+(isFinalQualifiers?
          '2025 經典賽資格賽官方最終排名（含附加賽）；標示「晉級」的球隊取得經典賽正賽資格。':
          '已核對分組戰績，非賽事最終排名。')+'</p>'+
          snapshot.standings.map(t=>{
            const group=String(t[0]||'');
            const index=(groupIndex.get(group)||0)+1;
            groupIndex.set(group,index);
            const team=intlLocalizeTeam(t[1]);
            return '<article class="ds-intl-game"><small>'+escapeHtml(group)+' · 第 '+index+' 名</small><strong>'+
              escapeHtml(team)+'　'+Number(t[2])+'勝 '+Number(t[3])+'敗'+
              (isFinalQualifiers&&advanced.has(team)?' · 晉級':'')+'</strong></article>';
          }).join('');
      } else {
        body='<div class="ds-intl-empty">'+(scheduleLoading && (dsIntlTab==='schedule'||dsIntlTab==='venues')?'正在向官方來源讀取賽事資料…':scheduleRetryAt>Date.now() && (dsIntlTab==='schedule'||dsIntlTab==='venues')?'官方賽程暫時無法取得，稍後重試；這不代表該屆沒有比賽。':messages[dsIntlTab])+'</div>';
      }
      dsIntlBody.innerHTML='<h3>'+dsIntlLabels[dsIntlTab]+'</h3>'+body+source;
    }
    dsIntlYear?.addEventListener('change',()=> {
      homeInternationalEditionFilter=dsIntlYear.value;
      homeInternationalTeamFilter='';
      dsIntlTeam='';
      renderStandaloneIntl();
    });
    dsIntlTabs?.addEventListener('click', e=>{
      const tab=e.target.closest('[data-intl-tab]')?.dataset.intlTab;
      if(!tab)return;
      dsIntlTab=tab;dsIntlTeam='';renderStandaloneIntl();
    });
    dsIntlBody?.addEventListener('click', async e=>{
      const team=e.target.closest('[data-intl-team]')?.dataset.intlTeam;
      if(team){dsIntlTeam=team;homeInternationalTeamFilter=team;renderStandaloneIntl();return;}
      if(e.target.closest('[data-intl-team-back]')){dsIntlTeam='';renderStandaloneIntl();return;}
      const idx=e.target.closest('[data-intl-roster-index]')?.dataset.intlRosterIndex;
      if(idx!==undefined){
        const roster=internationalRosterCache.get(internationalRosterKey(dsIntlCompetition,dsIntlYear.value,dsIntlTeam))?.players||[];
        const entry=roster[Number(idx)];
        if(entry){closeStandaloneIntl();await openInternationalRosterPlayer(entry,dsIntlCompetition,dsIntlYear.value,dsIntlTeam);}
      }
      const local=e.target.closest('[data-intl-local-player]')?.dataset.intlLocalPlayer;
      if(local){closeStandaloneIntl();await selectPlayer(local);}
    });
    document.getElementById('dsIntlBack')?.addEventListener('click',closeStandaloneIntl);
    // The combined competition entry reuses existing International, Panther Cup
    // and Winter League views without replacing their underlying data.
    const combinedHub = document.getElementById('combinedCompetitionHub');
    const combinedCards = document.getElementById('combinedCompetitionCards');
    const combinedBack = document.getElementById('combinedCompetitionBack');
    function openCombinedLanding() {
      document.querySelector('#homeZoneSwitch [data-home-root="combined"]')?.click();
    }
    combinedHub?.addEventListener('click', event => {
      const item = event.target.closest('[data-combined-open]');
      if (!item) return;
      const section = item.dataset.combinedOpen;
      const page = document.getElementById('homePage');
      page.classList.add('combined-home-mode');
      page.dataset.combinedView = section === 'youth' ? 'landing' : section;
      if (section === 'youth') {
        document.getElementById('dsCupEntry')?.click();
        return;
      }
      if (section === 'international') {
        showStandaloneIntl(String(item.dataset.competition || ''));
        return;
      }
      homeRootSection = section === 'international' ? 'international' : 'pro';
      if (section === 'international') {
        homeZone = 'international';
        const competition = String(item.dataset.competition || '');
        if (INTERNATIONAL_COMPETITIONS.includes(competition)) {
          homeSpecialFilter = competition;
          homeInternationalEditionFilter = String((INTERNATIONAL_TOURNAMENT_YEARS[competition] || [])[0] || '');
          homeInternationalTeamFilter = '';
        }
      } else {
        homeProContinent = 'ASIA';
        homeProCountry = 'AWB';
        applyHomeProSelection();
      }
      renderRecentPlayers();
      combinedCards?.classList.add('hidden');
      combinedBack?.classList.remove('hidden');
    });
    combinedBack?.addEventListener('click', openCombinedLanding);

    document.getElementById('homeAuthorCollectionBtn')?.addEventListener('click', () => {
      homeRootSection = 'special';
      homeZone = 'special';
      homeSpecialFilter = '';
      if (typeof authorCollectionSection !== 'undefined') authorCollectionSection = '';
      renderRecentPlayers();
      document.querySelector('.home-main-panel')?.scrollTo({top:0,behavior:'instant'});
    });

    els.homeProCountrySwitch?.querySelectorAll('[data-pro-country]').forEach(button => {
      button.addEventListener('click', () => {
        const country = button.dataset.proCountry;
        homeProCountry = ['TW','US','JP','KR'].includes(country) ? country : 'TW';
        homeRootSection = 'pro';
        homeProContinent = homeProCountry === 'US' ? 'AMERICA' : 'ASIA';
        homeTeamFilter = '';
        applyHomeProSelection();
        renderRecentPlayers();
        // Country changes replace the main content. Do not inherit a previous
        // league's scroll position and clip the root navigation tabs.
        const mainPanel = els.homeProCountrySwitch?.closest('.home-main-panel');
        if (mainPanel) { mainPanel.scrollTop = 0; requestAnimationFrame(() => { mainPanel.scrollTop = 0; }); }
      });
    });

    els.homeUsLeagueSwitch?.querySelectorAll('[data-us-league]').forEach(button => {
      button.addEventListener('click', () => {
        homeUsLeague = button.dataset.usLeague === 'MiLB' ? 'MiLB' : 'MLB';
        homeRootSection = 'pro';
        homeProCountry = 'US';
        applyHomeProSelection();
        renderRecentPlayers();
      });
    });
    document.getElementById('homeSearchPlayerBtn').addEventListener('click', openPlayerSearch);
    document.getElementById('allSearchPlayerBtn').addEventListener('click', openPlayerSearch);
    document.getElementById('batchReportBtn').addEventListener('click', openBatchReportDialog);
    els.playerSearchInput?.addEventListener('input', renderPlayerSearchResults);
    document.getElementById('batchReportSelectAllBtn').addEventListener('click', () => {
      document.querySelectorAll('[data-batch-report-player]').forEach(input => input.checked = true);
    });
    document.getElementById('batchReportClearBtn').addEventListener('click', () => {
      document.querySelectorAll('[data-batch-report-player]').forEach(input => input.checked = false);
    });
    els.batchReportGenerateBtn?.addEventListener('click', () => generateBatchReports({ refreshStats:true, refreshDaily:true }));
    els.batchReportDownloadAllBtn?.addEventListener('click', downloadAllBatchReports);

    let activeAllFilterSelect = null;
    let appToastTimer = null;
    let datePickerView = null;
    let datePickerYearMode = false;

    function formatPickerDate(value) {
      const raw = String(value || '');
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[1]}/${match[2]}/${match[3]}` : '選擇日期';
    }

    function syncAppPickerLabels() {
      if (els.gameDateButtonText) {
        els.gameDateButtonText.textContent = formatPickerDate(els.gameDate?.value);
      }
      if (els.seasonSelectButtonText) {
        els.seasonSelectButtonText.textContent = selectedOptionLabel(els.seasonSelect) || '選擇賽季';
      }
      if (els.seasonSelectButton) {
        els.seasonSelectButton.disabled = Boolean(els.seasonSelect?.disabled || !els.seasonSelect?.options?.length);
      }
    }

    function localCalendarDate(value = '') {
      const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const date = new Date(year, month, day);
      return Number.isFinite(date.getTime()) ? date : null;
    }

    function calendarIso(year, month, day) {
      return [
        String(year).padStart(4,'0'),
        String(month + 1).padStart(2,'0'),
        String(day).padStart(2,'0')
      ].join('-');
    }

    function renderDatePickerYearGrid() {
      if (!els.datePickerYearGrid || !(datePickerView instanceof Date)) return;
      const activeYear = datePickerView.getFullYear();
      const minYear = Math.min(1990, activeYear);
      const maxYear = Math.max(CURRENT_YEAR, activeYear);
      const years = [];
      for (let year = maxYear; year >= minYear; year--) years.push(year);

      els.datePickerYearGrid.innerHTML = years.map(year => {
        const active = year === activeYear;
        return `<button class="app-date-year-option ${active ? 'is-selected' : ''}" type="button" role="option" data-picker-year="${year}" aria-selected="${active}">${year}</button>`;
      }).join('');

      els.datePickerYearGrid.querySelectorAll('[data-picker-year]').forEach(button => {
        button.addEventListener('click', () => {
          const year = Number(button.dataset.pickerYear);
          if (!Number.isInteger(year) || !(datePickerView instanceof Date)) return;
          datePickerView = new Date(year, datePickerView.getMonth(), 1);
          datePickerYearMode = false;
          renderDatePicker();
        });
      });

      requestAnimationFrame(() => {
        els.datePickerYearGrid?.querySelector('.is-selected')?.scrollIntoView({ block:'center' });
      });
    }

    function syncDatePickerMode() {
      els.datePickerBody?.classList.toggle('is-year-mode', datePickerYearMode);
      els.datePickerYearGrid?.classList.toggle('hidden', !datePickerYearMode);
      els.datePickerWeekdays?.classList.toggle('hidden', datePickerYearMode);
      els.datePickerGrid?.classList.toggle('hidden', datePickerYearMode);
      els.datePickerYearButton?.setAttribute('aria-expanded', String(datePickerYearMode));
      if (datePickerYearMode) renderDatePickerYearGrid();
    }

    function renderDatePicker() {
      if (!els.datePickerGrid || !els.datePickerMonthLabel) return;
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      if (!(datePickerView instanceof Date) || !Number.isFinite(datePickerView.getTime())) {
        datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      }

      const year = datePickerView.getFullYear();
      const month = datePickerView.getMonth();
      if (els.datePickerYearLabel) els.datePickerYearLabel.textContent = `${year} 年`;
      els.datePickerMonthLabel.textContent = `${month + 1} 月`;
      syncDatePickerMode();

      const firstDay = new Date(year, month, 1).getDay();
      const days = new Date(year, month + 1, 0).getDate();
      const selectedIso = String(els.gameDate?.value || '');
      const todayIso = localISODate();
      const cells = [];

      for (let i = 0; i < firstDay; i++) {
        cells.push('<span class="app-date-empty" aria-hidden="true"></span>');
      }
      for (let day = 1; day <= days; day++) {
        const iso = calendarIso(year, month, day);
        const classes = [
          'app-date-day',
          iso === todayIso ? 'is-today' : '',
          iso === selectedIso ? 'is-selected' : ''
        ].filter(Boolean).join(' ');
        cells.push(`<button class="${classes}" type="button" role="gridcell" data-picker-date="${iso}" aria-selected="${iso === selectedIso}">${day}</button>`);
      }

      els.datePickerGrid.innerHTML = cells.join('');
      els.datePickerGrid.querySelectorAll('[data-picker-date]').forEach(button => {
        button.addEventListener('click', () => {
          const value = String(button.dataset.pickerDate || '');
          if (!value || !els.gameDate) return;
          els.gameDate.value = value;
          syncAppPickerLabels();
          els.datePickerDialog?.close();
          els.gameDate.dispatchEvent(new Event('change', { bubbles:true }));
        });
      });
    }

    function openDatePicker() {
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      datePickerYearMode = false;
      renderDatePicker();
      if (els.datePickerDialog && !els.datePickerDialog.open) els.datePickerDialog.showModal();
    }

    function openSeasonPicker() {
      if (!els.seasonSelect || !els.seasonPickerDialog || !els.seasonPickerList || els.seasonSelect.disabled) return;
      const options = Array.from(els.seasonSelect.options);
      els.seasonPickerList.innerHTML = options.length ? options.map((option,index) => {
        const active = option.value === els.seasonSelect.value;
        return `
          <button class="filter-choice-option ${active ? 'active' : ''}" type="button"
                  data-season-option-index="${index}" role="option" aria-selected="${active}">
            <span>${escapeHtml(option.textContent || '')}</span>
            <span class="filter-choice-radio" aria-hidden="true"></span>
          </button>`;
      }).join('') : '<div class="empty">目前沒有可選賽季。</div>';

      els.seasonPickerList.querySelectorAll('[data-season-option-index]').forEach(button => {
        button.addEventListener('click', () => {
          const option = els.seasonSelect?.options?.[Number(button.dataset.seasonOptionIndex)];
          if (!option || !els.seasonSelect) return;
          els.seasonSelect.value = option.value;
          syncAppPickerLabels();
          els.seasonPickerDialog.close();
          els.seasonSelect.dispatchEvent(new Event('change', { bubbles:true }));
        });
      });

      if (!els.seasonPickerDialog.open) els.seasonPickerDialog.showModal();
    }

    function selectedOptionLabel(select) {
      return String(select?.selectedOptions?.[0]?.textContent || '').trim();
    }

    function syncAllFilterTriggerLabels() {
      const levelLabel = els.allLevelFilterButton?.querySelector('[data-filter-label]');
      const teamLabel = els.allTeamFilterButton?.querySelector('[data-filter-label]');
      if (levelLabel) levelLabel.textContent = selectedOptionLabel(els.allLevelFilters) || '全部';
      if (teamLabel) teamLabel.textContent = selectedOptionLabel(els.allTeamFilters) || '全部球隊';
    }

    function openAllFilterChoice(select, title) {
      if (!select || !els.filterChoiceDialog || !els.filterChoiceList) return;
      activeAllFilterSelect = select;
      if (els.filterChoiceTitle) els.filterChoiceTitle.textContent = title;

      els.filterChoiceList.innerHTML = Array.from(select.options).map((option, index) => {
        const active = option.value === select.value;
        return `
          <button class="filter-choice-option ${active ? 'active' : ''}" type="button"
                  data-filter-option-index="${index}" role="option" aria-selected="${active}">
            <span>${escapeHtml(option.textContent || '')}</span>
            <span class="filter-choice-radio" aria-hidden="true"></span>
          </button>`;
      }).join('');

      els.filterChoiceList.querySelectorAll('[data-filter-option-index]').forEach(button => {
        button.addEventListener('click', () => {
          const index = Number(button.dataset.filterOptionIndex);
          const option = activeAllFilterSelect?.options?.[index];
          if (!option || !activeAllFilterSelect) return;
          activeAllFilterSelect.value = option.value;
          activeAllFilterSelect.dispatchEvent(new Event('change', { bubbles:true }));
          els.filterChoiceDialog.close();
        });
      });

      if (!els.filterChoiceDialog.open) els.filterChoiceDialog.showModal();
    }

    function showAppToast(message, duration = 1800) {
      if (!els.appToast || !els.appToastText) return;
      clearTimeout(appToastTimer);
      els.appToastText.textContent = String(message || '已完成');
      els.appToast.classList.remove('show');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => els.appToast.classList.add('show'));
      });
      appToastTimer = setTimeout(() => {
        els.appToast?.classList.remove('show');
      }, Math.max(900, Number(duration) || 1800));
    }

    els.allLevelFilters?.addEventListener('change', () => {
      const value = String(els.allLevelFilters.value || 'ALL');
      homeLevelFilter = ['A','D','OTHER'].includes(value) ? value : 'ALL';
      syncAllFilterTriggerLabels();
      renderAllPlayersDialog();
    });

    els.allTeamFilters?.addEventListener('change', () => {
      homeTeamFilter = String(els.allTeamFilters.value || '');
      syncAllFilterTriggerLabels();
      renderAllPlayersDialog();
    });

    els.allLevelFilterButton?.addEventListener('click', () => openAllFilterChoice(els.allLevelFilters, '選擇類別'));
    els.allTeamFilterButton?.addEventListener('click', () => openAllFilterChoice(els.allTeamFilters, '選擇球隊'));
    els.filterChoiceDialog?.addEventListener('click', event => {
      if (event.target === els.filterChoiceDialog) els.filterChoiceDialog.close();
    });

    els.gameDate?.addEventListener('change', () => {
      if (currentPage === 'home' && homeRootSection !== 'international') renderHomeDailyGames({ force:true });
    });
    els.gameDateButton?.addEventListener('click', openDatePicker);
    els.datePickerYearButton?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerYearMode = !datePickerYearMode;
      syncDatePickerMode();
    });
    els.datePickerPrev?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() - 1, 1);
      datePickerYearMode = false;
      renderDatePicker();
    });
    els.datePickerNext?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() + 1, 1);
      datePickerYearMode = false;
      renderDatePicker();
    });
    els.datePickerToday?.addEventListener('click', () => {
      if (!els.gameDate) return;
      els.gameDate.value = localISODate();
      syncAppPickerLabels();
      els.datePickerDialog?.close();
      els.gameDate.dispatchEvent(new Event('change', { bubbles:true }));
    });
    els.datePickerDialog?.addEventListener('click', event => {
      if (event.target === els.datePickerDialog) els.datePickerDialog.close();
    });

    els.seasonSelectButton?.addEventListener('click', openSeasonPicker);
    els.seasonPickerDialog?.addEventListener('click', event => {
      if (event.target === els.seasonPickerDialog) els.seasonPickerDialog.close();
    });

    syncAllFilterTriggerLabels();
    syncAppPickerLabels();

    document.getElementById('allPlayersBtn').addEventListener('click', () => {
      renderAllPlayersDialog();
      els.allDialog.showModal();
    });
    document.getElementById('allDeletePlayerBtn').addEventListener('click', () => {
      renderDeletePlayerList();
      els.allDialog.close();
      els.deletePlayerDialog?.showModal();
    });
    document.querySelectorAll('.dialog-close').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
    els.batchReportDialog?.addEventListener('close', () => {
      // 生成結果的 blob URL 只在視窗開啟期間保留。
      clearBatchReportOutputs();
    });

    function newPlayerFormValues() {
      const scope = els.newPlayerScope?.value === 'international' || els.newPlayerScope?.value === 'overseas'
        ? els.newPlayerScope.value
        : 'cpbl';
      return {
        name: document.getElementById('newPlayerName').value.trim(),
        number: document.getElementById('newPlayerNumber').value.trim(),
        selectedType: document.getElementById('newPlayerType').value,
        scope,
        competition: scope === 'cpbl' ? '' : String(els.newPlayerCompetition?.value || '').trim(),
        externalTeam: scope === 'cpbl' ? '' : String(els.newPlayerExternalTeam?.value || '').trim(),
        externalYear: scope === 'cpbl' ? CURRENT_YEAR : Math.floor(Number(els.newPlayerExternalYear?.value) || CURRENT_YEAR)
      };
    }

    function validateNewPlayer(name, number, scope = 'cpbl', competition = '', deferLinkedDuplicate = false) {
      if (!name || (scope !== 'overseas' && !number)) {
        setStatus(scope === 'overseas' ? '球員名稱要填寫。' : '球員名稱與背號都要填寫。', true);
        return false;
      }
      if (scope !== 'cpbl' && !competition) {
        setStatus('請先選擇賽事／聯盟。', true);
        return false;
      }
      if (!deferLinkedDuplicate && players.some(p =>
        p.name === name
        && p.number === number
        && playerScope(p) === scope
        && (scope === 'cpbl' || playerSpecialCompetition(p) === competition)
      )) {
        setStatus('這個專區已經有相同球員。', true);
        return false;
      }
      return true;
    }

    function hideNewPlayerSuggestions() {
      if (!els.newPlayerSuggestions) return;
      els.newPlayerSuggestions.classList.add('hidden');
      els.newPlayerSuggestions.innerHTML = '';
    }

    function renderNewPlayerSuggestions(items, stateText = '') {
      if (!els.newPlayerSuggestions) return;
      newPlayerSuggestionItems = Array.isArray(items) ? items : [];
      if (stateText) {
        els.newPlayerSuggestions.innerHTML = `<div class="new-player-suggestion-state">${escapeHtml(stateText)}</div>`;
        els.newPlayerSuggestions.classList.remove('hidden');
        return;
      }
      if (!newPlayerSuggestionItems.length) {
        hideNewPlayerSuggestions();
        return;
      }

      els.newPlayerSuggestions.innerHTML = newPlayerSuggestionItems.map((item,index) => {
        const displayName = item.zhName || item.name || '';
        const officialName = item.name && item.name !== displayName ? ` · ${item.name}` : '';
        const meta = item.source === 'cpbl'
          ? ['中職', item.team, item.number ? `#${item.number}` : '', item.position].filter(Boolean).join('｜')
          : [overseasProviderLabel(item.provider), item.twoWay ? '二刀流' : '', item.team, item.number ? `#${item.number}` : '', item.position].filter(Boolean).join('｜');
        return `
          <button type="button" class="new-player-suggestion" role="option" data-suggest-index="${index}">
            <strong>${escapeHtml(displayName)}${escapeHtml(officialName)}</strong>
            <span>${escapeHtml(meta || (item.source === 'cpbl' ? '中職球員' : '國外聯盟球員'))}</span>
          </button>
        `;
      }).join('');
      els.newPlayerSuggestions.classList.remove('hidden');

      els.newPlayerSuggestions.querySelectorAll('[data-suggest-index]').forEach(button => {
        button.addEventListener('click', async () => {
          const item = newPlayerSuggestionItems[Number(button.dataset.suggestIndex)];
          if (!item) return;
          newPlayerSuggestionPicked = true;

          if (item.source === 'cpbl') {
            const acnt = String(item.id || '');
            if (!acnt) return;
            const expectedName = String(item.name || '');
            els.newPlayerName.value = expectedName;
            renderNewPlayerSuggestions([], '正在讀取球員資料…');
            try {
              const data = await cpblRequest('player-profile', { acnt });
              const official = data.player;
              if (!official) throw new Error('讀不到球員資料');
              els.newPlayerName.value = official.name || expectedName;
              els.newPlayerNumber.value = official.number || '';
              if (official.position) {
                els.newPlayerType.value = official.position.includes('投手') ? 'pitcher' : 'hitter';
                newPlayerTypeTouched = false;
              }
              hideNewPlayerSuggestions();
              els.newPlayerNumber.focus();
            } catch (error) {
              hideNewPlayerSuggestions();
              setStatus(error?.message || '球員資料讀取失敗。', true);
            }
            return;
          }

          const provider = String(item.provider || '');
          const id = String(item.id || '');
          if (!provider || !id) return;
          const displayName = item.zhName || item.name || String(els.newPlayerName.value || '').trim();
          els.newPlayerName.value = displayName;
          renderNewPlayerSuggestions([], `正在讀取 ${overseasProviderLabel(provider)} 球員資料…`);

          try {
            const data = await baseballRequest('player-profile', { provider, id });
            const official = data.player || {};
            newExternalSelected = {
              provider,
              id,
              zhName: item.zhName || (/[㐀-鿿]/.test(displayName) ? displayName : ''),
              officialName: official.name || item.name || '',
              name: displayName,
              number: official.number || item.number || '',
              team: official.team || item.team || '',
              position: official.position || item.position || '',
              type: official.type || item.type || 'hitter',
              twoWay: Boolean(official.twoWay || item.twoWay)
            };
            els.newPlayerName.value = newExternalSelected.zhName || newExternalSelected.name || newExternalSelected.officialName;
            els.newPlayerNumber.value = newExternalSelected.number || '';
            if (!newExternalSelected.twoWay) {
              els.newPlayerType.value = newExternalSelected.type === 'pitcher' ? 'pitcher' : 'hitter';
            }
            if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = newExternalSelected.team || '';
            hideNewPlayerSuggestions();
            document.getElementById('createExternalPlayerBtn')?.focus();
          } catch (error) {
            newExternalSelected = null;
            hideNewPlayerSuggestions();
            setStatus(error?.message || '國外聯盟球員資料讀取失敗。', true);
          }
        });
      });
    }

    async function requestNewPlayerSuggestions(query) {
      const requestId = ++newPlayerSuggestRequestId;
      const scope = els.newPlayerScope?.value || 'cpbl';

      try {
        let items = [];
        let emptyText = '';

        if (scope === 'cpbl') {
          const data = await cpblRequest('suggest-players', { query, limit: 10 });
          items = (data.players || []).map(item => ({
            source:'cpbl',
            id:item.acnt || '',
            name:item.name || '',
            number:item.number || '',
            team:item.team || '',
            position:item.position || ''
          }));
          emptyText = '找不到符合的中職球員';
        } else if (scope === 'overseas') {
          const provider = overseasProvider(els.newPlayerCompetition?.value);
          if (!provider) {
            hideNewPlayerSuggestions();
            return;
          }
          const data = await baseballRequest('search-player', {
            provider,
            query,
            year: Number(els.newPlayerExternalYear?.value) || CURRENT_YEAR
          });
          items = (data.players || []).map(item => ({
            source:'external',
            provider:item.provider || provider,
            id:item.id || '',
            name:item.name || '',
            zhName:item.zhName || '',
            number:item.number || '',
            team:item.team || '',
            position:item.position || '',
            type:item.type || '',
            twoWay:Boolean(item.twoWay)
          }));
          emptyText = `找不到符合的 ${overseasProviderLabel(provider)} 球員`;
        } else {
          hideNewPlayerSuggestions();
          return;
        }

        if (requestId !== newPlayerSuggestRequestId) return;
        const latest = String(els.newPlayerName?.value || '').trim();
        if (latest !== query || !latest) return;
        renderNewPlayerSuggestions(items, items.length ? '' : emptyText);
      } catch (error) {
        if (requestId !== newPlayerSuggestRequestId) return;
        hideNewPlayerSuggestions();
        console.warn('球員即時建議失敗', error);
      }
    }

    function clearNewPlayerForm() {
      document.getElementById('newPlayerName').value = '';
      document.getElementById('newPlayerNumber').value = '';
      if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = '';
      if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      newPlayerSuggestionPicked = false;
      newExternalSelected = null;
      newPlayerTypeTouched = false;
      newPlayerSuggestionItems = [];
      newPlayerSuggestRequestId++;
      if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
      hideNewPlayerSuggestions();
    }

    document.getElementById('newPlayerType')?.addEventListener('change', () => {
      newPlayerTypeTouched = true;
    });

    els.newPlayerName?.addEventListener('input', () => {
      newPlayerSuggestionPicked = false;
      newExternalSelected = null;
      const scope = els.newPlayerScope?.value || 'cpbl';
      const query = String(els.newPlayerName.value || '').trim();
      const provider = scope === 'overseas' ? overseasProvider(els.newPlayerCompetition?.value) : '';

      if (scope === 'international' || (scope === 'overseas' && !provider)) {
        hideNewPlayerSuggestions();
        return;
      }

      newPlayerSuggestRequestId++;
      if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
      if (!query) {
        hideNewPlayerSuggestions();
        return;
      }

      renderNewPlayerSuggestions([], scope === 'cpbl'
        ? '搜尋中職球員…'
        : `搜尋 ${overseasProviderLabel(provider)} 球員…`);
      newPlayerSuggestTimer = setTimeout(() => requestNewPlayerSuggestions(query), 300);
    });

    els.newPlayerScope?.addEventListener('change', () => {
      newExternalSelected = null;
      updateAddPlayerScopeUI(els.newPlayerScope.value);
    });

    els.newPlayerCompetition?.addEventListener('change', () => {
      newExternalSelected = null;
      hideNewPlayerSuggestions();
      updateAddPlayerScopeUI(els.newPlayerScope?.value || homeZone);
      const query = String(els.newPlayerName?.value || '').trim();
      if (query && els.newPlayerScope?.value === 'overseas' && overseasProvider(els.newPlayerCompetition.value)) {
        renderNewPlayerSuggestions([], `搜尋 ${els.newPlayerCompetition.value} 球員…`);
        if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
        newPlayerSuggestTimer = setTimeout(() => requestNewPlayerSuggestions(query), 250);
      }
    });

    els.newPlayerName?.addEventListener('focus', () => {
      const query = String(els.newPlayerName.value || '').trim();
      if (query && !newPlayerSuggestionPicked && els.newPlayerSuggestions?.innerHTML) {
        els.newPlayerSuggestions.classList.remove('hidden');
      }
    });

    document.addEventListener('pointerdown', event => {
      if (!els.addDialog?.open || !els.newPlayerSuggestions) return;
      if (event.target === els.newPlayerName || els.newPlayerSuggestions.contains(event.target)) return;
      hideNewPlayerSuggestions();
    });

    els.addDialog?.addEventListener('close', () => {
      newPlayerSuggestRequestId++;
      if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
      hideNewPlayerSuggestions();
    });

    document.getElementById('createManualPlayerBtn').addEventListener('click', async () => {
      const { name, number, selectedType, scope, competition, externalTeam, externalYear } = newPlayerFormValues();
      if (!validateNewPlayer(name, number, scope, competition)) return;
      const btn = document.getElementById('createManualPlayerBtn');
      btn.disabled = true;
      try {
        const player = {
          id: uid(), name, number, type: selectedType,
          stats: selectedType === 'hitter' ? hitterDefaults() : pitcherDefaults(),
          pitcherLastMetric: selectedType === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId: null, photoTransforms: {},
          scope,
          externalCompetition: competition,
          externalTeam: scope === 'international' ? normalizeInternationalTeamName(externalTeam) : externalTeam,
          externalYear,
          cpblAcnt: '', cpblTeam: '', cpblTeamCode: '', cpblPosition: '',
          createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now()
        };
        await savePlayer(player);
        clearNewPlayerForm();
        els.addDialog.close();
        await selectPlayer(player.id);
        setStatus(scope === 'cpbl'
          ? '球員已純新增，未連結中職官網。'
          : `已建立${scopeLabel(scope)}球員資料。`);
      } catch (error) {
        setStatus(error.message || '建立球員失敗。', true);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('createExternalPlayerBtn').addEventListener('click', async () => {
      const { name, number, selectedType, scope, competition, externalYear } = newPlayerFormValues();
      const provider = overseasProvider(competition);
      if (scope !== 'overseas' || !provider) {
        setStatus('請先選擇美國職棒、NPB 或 KBO。', true);
        return;
      }
      if (!validateNewPlayer(name, number, scope, competition, true)) return;

      const btn = document.getElementById('createExternalPlayerBtn');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = `搜尋 ${overseasProviderLabel(provider)}…`;

      try {
        let picked = newExternalSelected;
        if (!picked || picked.provider !== provider) {
          const result = await baseballRequest('search-player', {
            provider,
            query: name,
            year: externalYear
          });
          const candidates = result.players || [];
          if (!candidates.length) throw new Error(`${overseasProviderLabel(provider)} 找不到「${name}」。`);

          const exact = candidates.find(item =>
            String(item.zhName || '').trim() === name || String(item.name || '').trim() === name
          );
          const candidate = exact || (candidates.length === 1 ? candidates[0] : null);
          if (!candidate) {
            renderNewPlayerSuggestions(candidates.map(item => ({
              source:'external',
              provider:item.provider || provider,
              id:item.id || '',
              name:item.name || '',
              zhName:item.zhName || '',
              number:item.number || '',
              team:item.team || '',
              position:item.position || '',
              type:item.type || '',
              twoWay:Boolean(item.twoWay)
            })));
            throw new Error('找到多位同名／相近球員，請先從姓名下方選擇正確球員。');
          }

          picked = {
            provider,
            id:String(candidate.id || ''),
            zhName:candidate.zhName || '',
            officialName:candidate.name || '',
            name:candidate.zhName || candidate.name || name,
            number:candidate.number || '',
            team:candidate.team || '',
            position:candidate.position || '',
            type:candidate.type || selectedType,
            twoWay:Boolean(candidate.twoWay)
          };
        }

        if (!picked?.id) throw new Error('找不到球員識別資料。');

        btn.textContent = '同步賽季資料…';
        const profileData = await baseballRequest('player-profile', {
          provider,
          id:picked.id
        });
        const official = profileData.player || {};

        let remote = null;
        let seasonSyncError = '';
        try {
          const seasonData = await baseballRequest('season-stats', {
            provider,
            id:picked.id,
            year:externalYear
          });
          remote = seasonData.stats || null;
          if (!remote) seasonSyncError = '讀不到賽季成績。';
        } catch (error) {
          seasonSyncError = error?.message || '賽季成績同步失敗。';
          if (provider !== 'MILB') throw error;
        }

        const isTwoWay = Boolean(
          official.twoWay
          || picked.twoWay
          || remote?.profile?.twoWay
        );
        const officialPosition = official.position || official.jpPosition || picked.position || '';
        const positionType = externalPositionType(officialPosition);
        let type = official.type || positionType || picked.type || selectedType;
        if (type !== 'pitcher' && type !== 'hitter') type = selectedType;

        const typedChineseName = /[㐀-鿿]/.test(name) ? name : '';
        const displayName = picked.zhName || typedChineseName || picked.name || official.name || name;
        const player = {
          id:uid(),
          name:displayName,
          number:official.number || picked.number || number || '—',
          type,
          primaryType:type,
          scope:'overseas',
          stats:type === 'hitter' ? hitterDefaults() : pitcherDefaults(),
          pitcherLastMetric:type === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId:null,
          photoTransforms:{},
          externalCompetition:competition,
          externalProvider:provider,
          externalPlayerId:String(picked.id),
          externalTwoWay:isTwoWay,
          externalOfficialName:official.name || picked.officialName || picked.name || '',
          externalPosition:official.position || official.jpPosition || picked.position || '',
          externalTeam:official.team || picked.team || '',
          externalCurrentTeam:official.team || picked.team || '',
          externalCurrentOrganization:official.currentOrganization || official.organization || '',
          externalCurrentLevel:official.currentLevel || (provider === 'MLB' ? 'MLB' : provider === 'MILB' ? 'MiLB' : ''),
          externalCurrentSportId:Number(official.sportId)||0,
          externalYear,
          externalAvailableYears:[],
          externalSeasonSyncPending:Boolean(provider === 'MILB' && seasonSyncError),
          externalSeasonSyncError:provider === 'MILB' ? seasonSyncError : '',
          cpblAcnt:'',cpblTeam:'',cpblTeamCode:'',cpblPosition:'',
          createdAt:Date.now(),updatedAt:Date.now(),lastUsedAt:Date.now()
        };

        if (remote) applyExternalSeasonStats(player, remote, externalYear);
        const sameLinkedPlayers = players.filter(p => playerScope(p) === 'overseas'
          && String(p.externalPlayerId || '') === String(player.externalPlayerId)
          && (provider === 'US' ? isUsPlayer(p) : p.externalProvider === provider));
        if (sameLinkedPlayers.length) {
          throw new Error('這位球員已經存在；現在同一筆球員資料會自動整合投球與打擊成績，不需要再建立另一個角色版本。');
        }

        await savePlayer(player);
        newExternalSelected = null;
        clearNewPlayerForm();
        els.addDialog.close();
        await selectPlayer(player.id);
        setStatus(seasonSyncError && provider === 'MILB'
          ? `已建立 ${player.name}；MiLB 賽季累積同步暫時失敗，但仍可抓指定日期單場資料。`
          : `已從 ${overseasProviderLabel(provider)} 建立：${player.name}｜${player.externalTeam || '球隊未提供'}`);
      } catch (error) {
        setStatus(error?.message || '搜尋國外聯盟資料失敗。', true);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
        updateAddPlayerScopeUI(els.newPlayerScope?.value || homeZone);
      }
    });

    document.getElementById('createCpblPlayerBtn').addEventListener('click', async () => {
      const { name, number, selectedType } = newPlayerFormValues();
      if (!validateNewPlayer(name, number, 'cpbl', '', true)) return;
      const btn = document.getElementById('createCpblPlayerBtn');
      const directAcnt = String(btn.dataset.musicCpblAcnt || '').trim();
      // The music roster stores the official CPBL player ID; use it directly.
      // Manual additions continue through the existing name/number search.
      delete btn.dataset.musicCpblAcnt;
      if (directAcnt && !/^\d{4,12}$/.test(directAcnt)) {
        setStatus('中職球員 ID 格式不正確，無法自動連結。', true);
        return;
      }
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = directAcnt ? '依中職 ID 讀取球員…' : '搜尋中職官網…';
      try {
        const searchName = String(name || '').trim();
        const found = directAcnt
          ? await cpblRequest('player-profile', { acnt: directAcnt })
          : await cpblRequest('search-player', { name: searchName, number });
        const official = found.player;
        if (!official) throw new Error(directAcnt ? '中職官網找不到指定 ID 的球員。' : `中職官網找不到「${searchName} #${number}」。`);
        if (directAcnt && String(official.acnt || directAcnt) !== directAcnt) throw new Error('中職回傳球員 ID 不一致，已取消新增。');

        let type = cpblOfficialTypeFromPosition(official.position) || selectedType;

        const sameLinkedPlayers = players.filter(p =>
          playerScope(p) === 'cpbl'
          && String(p.cpblAcnt || '') === String(official.acnt || '')
        );
        if (sameLinkedPlayers.length) {
          throw new Error('這位球員已經存在；現在同一筆球員資料會依官方守位分類，投打紀錄會自動整合，不需要再建立另一個角色版本。');
        }

        const player = {
          id: uid(), name: official.name || name, number: official.number || number, type,
          primaryType:type,
          scope: 'cpbl',
          stats: type === 'hitter' ? hitterDefaults() : pitcherDefaults(),
          pitcherLastMetric: type === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId: null, photoTransforms: {},
          cpblAcnt: official.acnt || '',
          cpblTeam: official.team || '',
          cpblTeamCode: official.teamCode || '',
          cpblPosition: official.position || '',
          cpblDualRole: sameLinkedPlayers.length > 0,
          createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now()
        };
        ensureStatsProfiles(player);
        try { await syncPlayerCpblHistory(player); }
        catch (error) { console.warn('CPBL season history import failed', error); }
        try {
          const roster = await cpblRequest('current-roster', { acnt: player.cpblAcnt });
          if (roster?.player?.team) {
            player.cpblTeam = normalizeTeamName(roster.player.team);
            if (roster.player.teamCode) player.cpblTeamCode = String(roster.player.teamCode);
            if (roster.player.number) player.number = String(roster.player.number);
            if (['A','D'].includes(String(roster.player.level || '').toUpperCase())) player.cpblCurrentLevel = String(roster.player.level).toUpperCase();
            repairStoredCpblPlayerType(player, roster.player.position || official.position || '');
            player.cpblRosterUpdatedAt = Date.now();
            await savePlayer(player);
          }
        } catch (error) {
          console.warn('CPBL current roster import failed', error);
        }
        clearNewPlayerForm();
        els.addDialog.close();
        await selectPlayer(player.id);
        setStatus(`已從中職官網建立：${official.team} #${official.number} ${official.name || name}`);
      } catch (error) {
        setStatus(error.message || '搜尋中職資料失敗。', true);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    els.homePlayerRankingBtn?.addEventListener('click', () => {
      currentPage = 'player-ranking';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.playerRankingBackHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.homeScheduleBtn?.addEventListener('click', () => {
      // Always open the left-side League Schedule entry on the league's current day.
      // In-page date navigation remains unchanged until the next entry.
      schedulePageDate = schedulePageLeagueToday(schedulePageLeague);
      localStorage.setItem('schedulePageDate', schedulePageDate);
      currentPage = 'schedule';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.scheduleBackHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.homePitcherBatterBtn?.addEventListener('click', () => {
      currentPage = 'pitcher-batter';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.pitcherBatterBackHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.customNotificationBackHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    function syncLeagueHubLeague(league) {
      const value = ['cpbl','npb','kbo','mlb'].includes(String(league)) ? String(league) : 'cpbl';
      leagueHubLeague = value;
      predictionUiState.league = value;
      standingsUiState.league = value;
      predictionGameSlideIndex = 0;
      standingsSelectedTeam = '';
      standingsTeamDetailError = '';
      localStorage.setItem('leagueHubLeague', value);
      localStorage.setItem('predictionLeague', value);
      localStorage.setItem('standingsLeague', value);
    }

    function openLeagueHub(view = leagueHubView) {
      const requestedView = ['schedule','prediction','standings','postseason'].includes(view) ? view : 'prediction';
      const nextView = requestedView === 'schedule' && !['cpbl','npb'].includes(leagueHubLeague) ? 'prediction' : requestedView;
      leagueHubView = nextView;
      localStorage.setItem('leagueHubView', nextView);
      syncLeagueHubLeague(leagueHubLeague);
      if (nextView === 'schedule') {
        schedulePageLeague = leagueHubLeague === 'npb' ? 'NPB' : 'CPBL';
        schedulePageDate = schedulePageLeagueToday(schedulePageLeague);
        localStorage.setItem('schedulePageLeague', schedulePageLeague);
        localStorage.setItem('schedulePageDate', schedulePageDate);
      }
      currentPage = nextView;
      renderAll();
      if (nextView === 'standings') void loadOfficialStandings({ force:true });
      window.scrollTo({ top:0, behavior:'instant' });
    }

    els.homeLeagueHubBtn?.addEventListener('click', () => {
      openLeagueHub(leagueHubView);
    });

    els.leagueHubCountrySwitch?.querySelectorAll('[data-league-hub-league]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncLeagueHubLeague(btn.dataset.leagueHubLeague);
        if (currentPage === 'schedule') {
          if (leagueHubLeague !== 'cpbl' && leagueHubLeague !== 'npb') {
            openLeagueHub('prediction');
            return;
          }
          schedulePageLeague = leagueHubLeague === 'npb' ? 'NPB' : 'CPBL';
          schedulePageDate = schedulePageLeagueToday(schedulePageLeague);
          localStorage.setItem('schedulePageLeague', schedulePageLeague);
          localStorage.setItem('schedulePageDate', schedulePageDate);
        }
        renderAll();
        if (currentPage === 'standings') void loadOfficialStandings({ force:true });
      });
    });

    els.leagueHubViewSwitch?.querySelectorAll('[data-league-hub-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        openLeagueHub(btn.dataset.leagueHubView);
      });
    });

    els.leagueHubBackHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.homeAdvancedStatsBtn?.addEventListener('click', () => {
      currentPage = 'advanced-stats';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    els.advancedStatsBackHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top:0, behavior:'instant' });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const player = selectedPlayer();
        let nextTab = btn.dataset.tab;

        if (nextTab === 'secondary' && supportsUsDualRoleTabs(player)) {
          selectedLevel = 'A';
          selectedTab = 'secondary';
          localStorage.setItem('baseballSelectedTab', selectedTab);
          renderAll();
          return;
        }

        if (supportsLeagueLevelTabs(player) && (nextTab === 'base' || nextTab === 'minor')) {
          const level = nextTab === 'minor' ? 'D' : 'A';
          selectedRoleView = 'primary';
          selectedTab = nextTab;
          localStorage.setItem('baseballSelectedTab', selectedTab);

          if (playerScope(player) === 'cpbl') {
            if (selectedLevel !== level) switchPlayerLevel(level);
            else {
              selectedLevel = level;
              const years = availableSeasonYears(player, level);
              if (!years.includes(selectedSeason)) selectedSeason = years[0] || CURRENT_YEAR;
              activatePlayerStatsProfile(player, selectedSeason, level);
              renderAll();
            }
            return;
          }

          await switchOverseasLeagueLevel(level);
          return;
        }

        if (nextTab === 'today' && supportsLeagueLevelTabs(player)) {
          selectedLevel = 'A';
          await loadRecord();
        }

        selectedTab = nextTab;
        if (selectedTab === 'today' && playerScope(player) === 'international') {
          internationalSelectedGameKey = '';
        }
        localStorage.setItem('baseballSelectedTab', selectedTab);
        renderAll();
      });
    });

    els.gameDate.addEventListener('change', async () => {
      syncAppPickerLabels();
      const player=selectedPlayer();
      if (playerScope(player) === 'international' && !internationalSelectedGameKey) {
        renderAll();
        return;
      }
      await loadRecord();
      renderAll();
    });

    window.addEventListener('resize', () => requestAnimationFrame(updateHomePaneHeight));
    window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(updateHomePaneHeight));

    els.canvas.addEventListener('pointerdown', async event => {
      const player = selectedPlayer();
      if (!player) return;
      const photo = photos.find(p => p.id === player.selectedPhotoId && p.playerId === player.id);
      const point = canvasPoint(event);
      if (!photo || !pointInPhotoFrame(point)) return;
      try {
        const image = await getPhotoImage(photo);
        const transform = clampPhotoTransform(image, getPhotoTransform(player, photo.id));
        photoDrag = {
          pointerId: event.pointerId,
          playerId: player.id,
          photoId: photo.id,
          image,
          startPoint: point,
          startTransform: { ...transform }
        };
        els.canvas.setPointerCapture(event.pointerId);
        els.canvas.style.cursor = 'grabbing';
        event.preventDefault();
      } catch {
        setStatus('照片載入失敗。', true);
      }
    });

    els.canvas.addEventListener('pointermove', event => {
      const point = canvasPoint(event);
      if (!photoDrag) {
        const player = selectedPlayer();
        const hasPhoto = player && photos.some(p => p.id === player.selectedPhotoId && p.playerId === player.id);
        els.canvas.style.cursor = hasPhoto && pointInPhotoFrame(point) ? 'grab' : 'default';
        return;
      }
      if (event.pointerId !== photoDrag.pointerId) return;
      const player = players.find(p => p.id === photoDrag.playerId);
      if (!player || player.selectedPhotoId !== photoDrag.photoId) return;
      const next = {
        x: photoDrag.startTransform.x + point.x - photoDrag.startPoint.x,
        y: photoDrag.startTransform.y + point.y - photoDrag.startPoint.y,
        scale: photoDrag.startTransform.scale
      };
      ensurePhotoTransforms(player)[photoDrag.photoId] = clampPhotoTransform(photoDrag.image, next);
      renderCanvas();
      event.preventDefault();
    });

    async function finishPhotoDrag(event) {
      if (!photoDrag || event.pointerId !== photoDrag.pointerId) return;
      const player = players.find(p => p.id === photoDrag.playerId);
      photoDrag = null;
      els.canvas.style.cursor = 'grab';
      try { els.canvas.releasePointerCapture(event.pointerId); } catch {}
      if (player) {
        await savePlayer(player);
        setStatus('照片位置已保存。');
      }
    }

    els.canvas.addEventListener('pointerup', finishPhotoDrag);
    els.canvas.addEventListener('pointercancel', finishPhotoDrag);
    els.canvas.addEventListener('pointerleave', event => {
      if (!photoDrag) els.canvas.style.cursor = 'default';
    });

    els.canvas.addEventListener('wheel', async event => {
      const player = selectedPlayer();
      if (!player) return;
      const photo = photos.find(p => p.id === player.selectedPhotoId && p.playerId === player.id);
      const point = canvasPoint(event);
      if (!photo || !pointInPhotoFrame(point)) return;
      event.preventDefault();
      try {
        const image = await getPhotoImage(photo);
        const current = clampPhotoTransform(image, getPhotoTransform(player, photo.id));
        const direction = event.deltaY < 0 ? 1 : -1;
        const next = clampPhotoTransform(image, {
          ...current,
          scale: current.scale + direction * 0.1
        });
        ensurePhotoTransforms(player)[photo.id] = next;
        renderCanvas();
        if (selectedTab === 'photos') {
          const zoomInput = document.getElementById('photoZoom');
          const zoomValue = document.getElementById('photoZoomValue');
          if (zoomInput) zoomInput.value = String(Math.round(next.scale * 100));
          if (zoomValue) zoomValue.textContent = `${Math.round(next.scale * 100)}%`;
        }
        clearTimeout(photoZoomSaveTimer);
        photoZoomSaveTimer = setTimeout(() => savePlayer(player), 250);
      } catch {
        setStatus('照片載入失敗。', true);
      }
    }, { passive: false });

