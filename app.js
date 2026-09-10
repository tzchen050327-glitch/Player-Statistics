    const APP_VERSION = 'v2.06';
    const appSplashVersionEl = document.getElementById('appSplashVersion');
    if (appSplashVersionEl) appSplashVersionEl.textContent = `VERSION ${APP_VERSION}`;
    const SERVICE_WORKER_URL = `./service-worker.js?v=${encodeURIComponent(APP_VERSION)}`;
    const DB_NAME = 'baseball-player-card-test-v1';
    const DB_VERSION = 1;
    const STORES = { players: 'players', photos: 'photos', games: 'games' };
    const CPBL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-client';
    const BASEBALL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/baseball-client';
    const CPBL_APP_KEY = 'TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
    const CPBL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqbmRuc3p0YmNwbWtoaWN0amtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDgxMDcsImV4cCI6MjEwMzU4NDEwN30.oB0Qq2eF3Tnrhg209rzPMNUhQPPEREmJwWxMFxCZLYU';

    const els = {
      gameDate: document.getElementById('gameDate'),
      gameDateButton: document.getElementById('gameDateButton'),
      gameDateButtonText: document.getElementById('gameDateButtonText'),
      datePickerDialog: document.getElementById('datePickerDialog'),
      datePickerGrid: document.getElementById('datePickerGrid'),
      datePickerMonthLabel: document.getElementById('datePickerMonthLabel'),
      datePickerPrev: document.getElementById('datePickerPrev'),
      datePickerNext: document.getElementById('datePickerNext'),
      datePickerToday: document.getElementById('datePickerToday'),
      content: document.getElementById('contentPanel'),
      recent: document.getElementById('recentPlayers'),
      selectedPlayerText: document.getElementById('selectedPlayerText'),
      pageSubtitle: document.getElementById('pageSubtitle'),
      homePage: document.getElementById('homePage'),
      playerPage: document.getElementById('playerPage'),
      homeTemplateGrid: document.getElementById('homeTemplateGrid'),
      homePlayerCount: document.getElementById('homePlayerCount'),
      homePlayerTitle: document.getElementById('homePlayerTitle'),
      homeZoneSwitch: document.getElementById('homeZoneSwitch'),
      homeProCountrySwitch: document.getElementById('homeProCountrySwitch'),
      homeUsLeagueSwitch: document.getElementById('homeUsLeagueSwitch'),
      homeZoneNote: document.getElementById('homeZoneNote'),
      homeLevelFilters: document.getElementById('homeLevelFilters'),
      homeTeamFilters: document.getElementById('homeTeamFilters'),
      homeCpblFilters: document.getElementById('homeCpblFilters'),
      homeSpecialFilters: document.getElementById('homeSpecialFilters'),
      homeInternationalExplorer: document.getElementById('homeInternationalExplorer'),
      newPlayerCompetitionLabel: document.getElementById('newPlayerCompetitionLabel'),
      newPlayerTeamLabel: document.getElementById('newPlayerTeamLabel'),
      newPlayerYearLabel: document.getElementById('newPlayerYearLabel'),
      homeHeaderDateControl: document.getElementById('homeHeaderDateControl'),
      playerPageDate: document.getElementById('playerPageDate'),
      backHomeBtn: document.getElementById('backHomeBtn'),
      playerLevelSwitch: document.getElementById('playerLevelSwitch'),
      externalScopeBadge: document.getElementById('externalScopeBadge'),
      majorLevelBtn: document.getElementById('majorLevelBtn'),
      minorLevelBtn: document.getElementById('minorLevelBtn'),
      seasonSelect: document.getElementById('seasonSelect'),
      seasonSelectButton: document.getElementById('seasonSelectButton'),
      seasonSelectButtonText: document.getElementById('seasonSelectButtonText'),
      seasonPickerDialog: document.getElementById('seasonPickerDialog'),
      seasonPickerList: document.getElementById('seasonPickerList'),
      syncProgressOverlay: document.getElementById('syncProgressOverlay'),
      syncProgressCard: document.getElementById('syncProgressCard'),
      syncProgressTitle: document.getElementById('syncProgressTitle'),
      syncProgressPercent: document.getElementById('syncProgressPercent'),
      syncProgressStatus: document.getElementById('syncProgressStatus'),
      syncProgressBar: document.getElementById('syncProgressBar'),
      canvas: document.getElementById('cardCanvas'),
      canvasPreviewTitle: document.getElementById('canvasPreviewTitle'),
      downloadBtn: document.getElementById('downloadBtn'),
      seasonReportBtn: document.getElementById('seasonReportBtn'),
      outputDialog: document.getElementById('outputDialog'),
      outputDialogTitle: document.getElementById('outputDialogTitle'),
      downloadPreparedBtn: document.getElementById('downloadPreparedBtn'),
      downloadPreparedLabel: document.getElementById('downloadPreparedLabel'),
      sharePreparedBtn: document.getElementById('sharePreparedBtn'),
      sharePreparedLabel: document.getElementById('sharePreparedLabel'),
      outputBackgroundBtn: document.getElementById('outputBackgroundBtn'),
      quickTemplateDialog: document.getElementById('quickTemplateDialog'),
      quickTemplateGrid: document.getElementById('quickTemplateGrid'),
      appUpdateOverlay: document.getElementById('appUpdateOverlay'),
      appUpdateCard: document.getElementById('appUpdateCard'),
      appUpdatePercent: document.getElementById('appUpdatePercent'),
      appUpdateStatus: document.getElementById('appUpdateStatus'),
      appUpdateBar: document.getElementById('appUpdateBar'),
      addDialog: document.getElementById('addPlayerDialog'),
      newPlayerName: document.getElementById('newPlayerName'),
      newPlayerNumber: document.getElementById('newPlayerNumber'),
      newPlayerType: document.getElementById('newPlayerType'),
      newPlayerScope: document.getElementById('newPlayerScope'),
      newPlayerCompetition: document.getElementById('newPlayerCompetition'),
      newPlayerExternalTeam: document.getElementById('newPlayerExternalTeam'),
      newPlayerExternalYear: document.getElementById('newPlayerExternalYear'),
      newPlayerExternalFields: document.getElementById('newPlayerExternalFields'),
      newPlayerScopeHelp: document.getElementById('newPlayerScopeHelp'),
      newPlayerSuggestions: document.getElementById('newPlayerSuggestions'),
      allDialog: document.getElementById('allPlayersDialog'),
      allCpblFilters: document.getElementById('allCpblFilters'),
      allLevelFilters: document.getElementById('allLevelFilters'),
      allTeamFilters: document.getElementById('allTeamFilters'),
      allLevelFilterButton: document.getElementById('allLevelFilterButton'),
      allTeamFilterButton: document.getElementById('allTeamFilterButton'),
      filterChoiceDialog: document.getElementById('filterChoiceDialog'),
      filterChoiceTitle: document.getElementById('filterChoiceTitle'),
      filterChoiceList: document.getElementById('filterChoiceList'),
      appToast: document.getElementById('appToast'),
      appToastText: document.getElementById('appToastText'),
      allPitchers: document.getElementById('allPitchers'),
      allHitters: document.getElementById('allHitters'),
      deletePlayerDialog: document.getElementById('deletePlayerDialog'),
      deletePlayerList: document.getElementById('deletePlayerList'),
      playerSearchDialog: document.getElementById('playerSearchDialog'),
      playerSearchInput: document.getElementById('playerSearchInput'),
      playerSearchResults: document.getElementById('playerSearchResults'),
      batchReportDialog: document.getElementById('batchReportDialog'),
      batchReportDate: document.getElementById('batchReportDate'),
      batchReportList: document.getElementById('batchReportList'),
      batchReportGenerateBtn: document.getElementById('batchReportGenerateBtn'),
      batchReportDownloadAllBtn: document.getElementById('batchReportDownloadAllBtn'),
      batchReportProgress: document.getElementById('batchReportProgress'),
      batchReportResults: document.getElementById('batchReportResults')
    };

    let db;
    let players = [];
    let photos = [];
    let selectedPlayerId = null;
    let selectedTab = 'base';
    let currentPage = 'home';
    const CURRENT_YEAR = new Date().getFullYear();
    let selectedSeason = CURRENT_YEAR;
    let selectedLevel = 'A';
    let selectedRoleView = 'primary';
    let todayRoleView = '';
    let homeLevelFilter = 'ALL';
    let homeTeamFilter = '';
    let homeZone = 'cpbl';
    let homeRootSection = 'pro';
    let homeProCountry = 'TW';
    let homeUsLeague = 'MLB';
    let homeSpecialFilter = '';
    let homeInternationalEditionFilter = '';
    let homeInternationalTeamFilter = '';
    let currentRecord = null;
    let internationalSelectedGameKey = '';

    let syncUiLocked = false;

    function setSyncUiLocked(locked) {
      syncUiLocked = Boolean(locked);
      document.body?.classList.toggle('sync-ui-locked', syncUiLocked);
      if (syncUiLocked) document.body?.setAttribute('aria-busy', 'true');
      else document.body?.removeAttribute('aria-busy');
    }

    function officialDataSourceLabel(player) {
      if (!player) return '本機資料';
      const scope = playerScope(player);
      if (scope === 'cpbl') return 'CPBL 官方';
      if (scope === 'international') {
        const competition = playerSpecialCompetition(player) || '國際賽';
        return `${competition} 官方資料`;
      }
      if (scope === 'overseas') {
        if (isUsPlayer(player)) return 'MLB / MiLB 官方';
        const provider = overseasProviderLabel(player.externalProvider || playerSpecialCompetition(player));
        return `${provider || '國外聯盟'} 官方`;
      }
      return '本機手動資料';
    }

    function formatSyncMetaTime(value) {
      const time = Number(value) || 0;
      if (!time) return '尚未記錄';
      const d = new Date(time);
      if (Number.isNaN(d.getTime())) return '尚未記錄';
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function ensureSyncMetaProfiles(player) {
      if (!player.syncMetaProfiles || typeof player.syncMetaProfiles !== 'object' || Array.isArray(player.syncMetaProfiles)) {
        player.syncMetaProfiles = {};
      }
      return player.syncMetaProfiles;
    }

    async function markSuccessfulSeasonSyncMeta() {
      const player = selectedPlayer();
      if (!player) return;
      try {
        const now = Date.now();
        const key = statsProfileKey(selectedSeason, selectedLevel);
        const source = officialDataSourceLabel(player);
        ensureSyncMetaProfiles(player)[key] = { source, updatedAt: now };
        player.lastOfficialSyncAt = now;
        await savePlayer(player);
      } catch (error) {
        console.warn('同步來源資訊儲存失敗', error);
      }
    }

    function syncMetaForCurrentView(player) {
      const source = officialDataSourceLabel(player);
      if (selectedTab === 'today') {
        const meta = currentRecord?.syncMeta || null;
        const updatedAt = Number(meta?.updatedAt)
          || Number(currentRecord?.cpblImportedAt)
          || Number(currentRecord?.externalImportedAt)
          || (currentRecord?.internationalOfficialImport ? Number(currentRecord?.updatedAt) : 0);
        return { source: meta?.source || source, updatedAt };
      }
      const key = statsProfileKey(selectedSeason, selectedLevel);
      const meta = player?.syncMetaProfiles?.[key] || null;
      const localOnly = playerScope(player) === 'local';
      return {
        source: meta?.source || source,
        updatedAt: Number(meta?.updatedAt) || Number(player?.lastOfficialSyncAt) || (localOnly ? Number(player?.updatedAt) : 0)
      };
    }

    function renderSyncMetaBanner(player) {
      if (!els.content || !player || selectedTab === 'photos') return;
      if (els.content.querySelector('.sync-source-meta')) return;
      const meta = syncMetaForCurrentView(player);
      const levelText = supportsLeagueLevelTabs(player) && selectedTab !== 'today'
        ? `｜${selectedLevel === 'D' ? '二軍' : '一軍'}`
        : '';
      els.content.insertAdjacentHTML('afterbegin', `
        <div class="sync-source-meta" aria-label="資料來源與最後同步時間">
          <span>資料來源 <strong>${escapeHtml(meta.source || '未提供')}</strong>${escapeHtml(levelText)}</span>
          <span>最後同步 <strong class="${meta.updatedAt ? '' : 'sync-meta-muted'}">${escapeHtml(formatSyncMetaTime(meta.updatedAt))}</strong></span>
        </div>`);
    }

    // All providers end here: normalize CG / SHO / no-walk-HBP with one rule set.
    function standardizePitcherSpecialRecords(game = {}) {
      let cg = Boolean(Number(game.cg) || game.cg);
      let sho = Boolean(Number(game.sho) || game.sho);
      if (sho) cg = true;
      if (cg && Number(game.r || 0) === 0) sho = true;
      const noWalkHbp = Boolean(Number(game.noWalkHbp) || game.noWalkHbp)
        || (cg && Number(game.bb || 0) === 0 && Number(game.hbp || 0) === 0);
      game.cg = cg;
      game.sho = sho;
      game.noWalkHbp = noWalkHbp;
      return game;
    }


    const INTERNATIONAL_COMPETITIONS = ['WBC', 'WBCQ', '世界12強', '亞洲運動會', 'U18亞青', '亞錦賽'];
    const INTERNATIONAL_TOURNAMENT_META = {
      'WBC': { code:'WBC', name:'世界棒球經典賽' },
      'WBCQ': { code:'WBCQ', name:'經典賽資格賽' },
      '世界12強': { code:'P12', name:'世界12強' },
      '亞洲運動會': { code:'AG', name:'亞洲運動會' },
      'U18亞青': { code:'BFAU18', name:'U18亞洲青棒錦標賽' },
      '亞錦賽': { code:'ABC', name:'亞洲棒球錦標賽' }
    };
    const INTERNATIONAL_TOURNAMENT_YEARS = {
      'WBC': [2026,2023,2017,2013,2009,2006],
      'WBCQ': [2025,2022,2016,2012],
      '世界12強': [2024,2019,2015],
      '亞洲運動會': [2026,2023,2018,2014,2010,2006,2002,1998,1994],
      'U18亞青': [2026],
      '亞錦賽': [2025,2023,2019,2017,2015,2012,2009,2007,2005,2003,2001]
    };
    const INTERNATIONAL_TEAM_NAME_MAP = {
      'Chinese Taipei':'中華台北','Chinese-Taipei':'中華台北','Taiwan':'中華台北','中華隊':'中華台北','TPE':'中華台北',
      'Japan':'日本','JPN':'日本','Korea':'韓國','South Korea':'韓國','KOR':'韓國',
      'United States':'美國','USA':'美國','Spain':'西班牙','ESP':'西班牙',
      'China':'中國','CHN':'中國','Hong Kong':'香港','HKG':'香港',
      'Philippines':'菲律賓','PHI':'菲律賓','Sri Lanka':'斯里蘭卡','SRI':'斯里蘭卡',
      'Singapore':'新加坡','SGP':'新加坡','Thailand':'泰國','THA':'泰國',
      'Pakistan':'巴基斯坦','PAK':'巴基斯坦','Palestine':'巴勒斯坦','PLE':'巴勒斯坦',
      'Laos':'寮國','LAO':'寮國','Indonesia':'印尼','INA':'印尼','Mongolia':'蒙古','MGL':'蒙古'
    };
    const INTERNATIONAL_TEAM_CATALOG = {
      'WBC:2026': ['中華台北','日本','韓國','澳洲','捷克','美國','墨西哥','義大利','英國','巴西','加拿大','哥倫比亞','古巴','巴拿馬','波多黎各','多明尼加','以色列','荷蘭','尼加拉瓜','委內瑞拉'],
      'WBC:2023': ['中華台北','日本','韓國','澳洲','中國','捷克','美國','墨西哥','哥倫比亞','加拿大','英國','古巴','多明尼加','以色列','義大利','荷蘭','尼加拉瓜','巴拿馬','波多黎各','委內瑞拉'],
      'WBC:2017': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','哥倫比亞','加拿大','古巴','多明尼加','以色列','義大利','荷蘭','波多黎各','委內瑞拉'],
      'WBC:2013': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','加拿大','古巴','多明尼加','義大利','荷蘭','波多黎各','西班牙','巴西','委內瑞拉'],
      'WBC:2009': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','加拿大','古巴','多明尼加','義大利','荷蘭','巴拿馬','波多黎各','南非','委內瑞拉'],
      'WBC:2006': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','加拿大','古巴','多明尼加','義大利','荷蘭','巴拿馬','波多黎各','南非','委內瑞拉'],

      'WBCQ:2025': ['中華台北','西班牙','尼加拉瓜','南非','哥倫比亞','巴西','德國','中國'],
      'WBCQ:2022': ['捷克','德國','西班牙','英國','法國','南非','巴拿馬','尼加拉瓜','巴西','阿根廷','紐西蘭','巴基斯坦'],
      'WBCQ:2016': ['澳洲','紐西蘭','菲律賓','南非','墨西哥','捷克','德國','尼加拉瓜','巴拿馬','哥倫比亞','法國','西班牙','以色列','英國','巴西','巴基斯坦'],
      'WBCQ:2012': ['中華台北','紐西蘭','菲律賓','泰國','加拿大','德國','捷克','英國','巴西','巴拿馬','哥倫比亞','尼加拉瓜','西班牙','以色列','法國','南非'],

      '世界12強:2024': ['中華台北','日本','韓國','澳洲','古巴','多明尼加','墨西哥','荷蘭','巴拿馬','波多黎各','美國','委內瑞拉'],
      '世界12強:2019': ['中華台北','日本','韓國','澳洲','加拿大','古巴','多明尼加','墨西哥','荷蘭','波多黎各','美國','委內瑞拉'],
      '世界12強:2015': ['中華台北','日本','韓國','加拿大','古巴','多明尼加','義大利','墨西哥','荷蘭','波多黎各','美國','委內瑞拉'],

      'U18亞青:2026': ['日本','菲律賓','香港','斯里蘭卡','中華台北','韓國','泰國','新加坡'],
      '亞洲運動會:2026': ['日本','中國','菲律賓','巴勒斯坦','中華台北','韓國','香港','泰國'],
      '亞洲運動會:2023': ['日本','韓國','中華台北','中國','菲律賓','香港','泰國','寮國','新加坡'],
      '亞錦賽:2025': ['日本','中國','菲律賓','巴基斯坦','中華台北','韓國','香港','巴勒斯坦'],
      '亞錦賽:2023': ['日本','韓國','中華台北','泰國','菲律賓','巴基斯坦','巴勒斯坦','香港']
    };
    const OVERSEAS_LEAGUES = ['美國職棒', 'NPB', 'KBO', '其他海外聯盟'];    const PREFERRED_EXTERNAL_NAME_FIXES = {
      'KBO:52605': { name: '金倒永', aliases: ['金道英'] },
      'MLB:660271': { name: '大谷翔平', aliases: ['大谷'] },
      'MLB:808967': { name: '山本由伸', aliases: ['山本'] },
      'US:660271': { name: '大谷翔平', aliases: ['大谷'] },
      'US:808967': { name: '山本由伸', aliases: ['山本'] }
    };
    const PREFERRED_EXTERNAL_TEAM_FIXES = {
      'NPB:21925136': 'Fukuoka SoftBank Hawks',
      'NPB:33935152': 'Saitama Seibu Lions'
    };

    function applyStoredPreferredExternalName(player) {
      const key = `${String(player?.externalProvider || '').toUpperCase()}:${String(player?.externalPlayerId || '')}`;
      const fix = PREFERRED_EXTERNAL_NAME_FIXES[key];
      if (!fix) return false;
      const currentName = String(player?.name || '').replace(/\s+/g, '');
      if (!(fix.aliases || []).includes(currentName)) return false;
      player.name = fix.name;
      return true;
    }

    function applyStoredPreferredExternalTeam(player) {
      const key = `${String(player?.externalProvider || '').toUpperCase()}:${String(player?.externalPlayerId || '')}`;
      const preferredTeam = PREFERRED_EXTERNAL_TEAM_FIXES[key];
      if (!preferredTeam || player?.externalTeam === preferredTeam) return false;
      player.externalTeam = preferredTeam;
      return true;
    }
    let renderToken = 0;
    let photoDrag = null;
    let photoZoomSaveTimer = null;
    let preparedOutput = null;
    let preparedOutputs = [];
    let preparedOutputKind = 'daily';
    let batchReportOutputs = [];
    let batchReportPreferences = {};
    let newPlayerSuggestTimer = null;
    let newPlayerSuggestRequestId = 0;
    let newPlayerSuggestionPicked = false;
    let newPlayerSuggestionItems = [];
    let newExternalSelected = null;
    let newPlayerTypeTouched = false;
    const internationalRosterCache = new Map();
    const internationalRosterLoading = new Set();
    const internationalTeamCache = new Map();
    const internationalTeamLoading = new Set();
    const photoImageCache = new Map();
    const TEMPLATES = {
      bg1: {
        label: '預設',
        enabled: true,
        innerBg: '#152238',
        frameSize: 18,
        header: { x: 54, y: 44, w: 972, h: 116, r: 24, bg: '#20324f' },
        metricCards: [
          { x: 54,  y: 184, w: 312, h: 150, r: 22, bg: '#243957', label: '#cbd5e1', value: '#ffffff' },
          { x: 384, y: 184, w: 312, h: 150, r: 22, bg: '#d7ad52', label: '#172033', value: '#172033' },
          { x: 714, y: 184, w: 312, h: 150, r: 22, bg: '#243957', label: '#cbd5e1', value: '#ffffff' }
        ],
        detail: { x: 54, y: 370, w: 454, h: 656, r: 26, bg: '#f4f6f9' },
        photo: { x: 548, y: 370, w: 478, h: 530, r: 26, bg: '#314766' },
        name: {
          textX: 568,
          textY: 995,
          lineX: 568,
          lineY: 1010,
          lineW: 430,
          typeX: 570,
          typeY: 1036
        },
        fonts: {
          headerVs: 46,
          headerDate: 34,
          metricLabel: 30,
          metricValue: 58,
          paNumber: 28,
          paResult: 42,
          paRbi: 24,
          pitcherTitle: 42,
          pitcherLabel: 25,
          pitcherValue: 34,
          playerName: 50,
          playerType: 24,
          tagText: 30
        },
        decorHeads: { enabled: true }
      },

      // 第二個背景接口：之後把 enabled 改成 true，再修改下面座標／顏色即可啟用。
bg2: {
        label: '棒球Q版',
        enabled: true,
        style: 'baseball-q',
        frameSize: 0,
        innerBg: '#f4f1ed',

        // 左上深色三角：VS 對手 + 日期
        header: {
          drawBox: false,
          vsX: 34,
          vsY: 70,
          dateX: 34,
          dateY: 120,
          textColor: '#ffffff',
          dateColor: '#ffffff'
        },

        // Q版棒球用具下方的三圍
        metricCards: [
          { x: 380, y: 292, w: 210, h: 112, r: 0, bg: 'rgba(255,255,255,.82)', label: '#10284a', value: '#10284a' },
          { x: 606, y: 292, w: 210, h: 112, r: 0, bg: 'rgba(255,255,255,.82)', label: '#10284a', value: '#10284a' },
          { x: 832, y: 292, w: 210, h: 112, r: 0, bg: 'rgba(255,255,255,.82)', label: '#10284a', value: '#10284a' }
        ],

        // 左側直接疊在背景上，不畫白框
        detail: {
          drawBox: false,
          x: 62,
          y: 458,
          w: 492,
          h: 500,
          headingX: 160,
          headingY: 421,
          underlineX: 160,
          underlineY: 438,
          underlineW: 410,
          paStartY: 493,
          paStep: 58,
          paNumberX: 92,
          paTextX: 142,
          dividerX1: 70,
          dividerX2: 548,
          pitcherLabelX: 82,
          pitcherValueX: 545,
          pitcherStartY: 500,
          pitcherStep: 52,
          tagsX: 70,
          tagsBottom: 955,
          tagsW: 480
        },

        // 右側照片，上緣與逐打席下方線對齊，左右斜切
        photo: {
          x: 604,
          y: 438,
          w: 438,
          h: 545,
          r: 0,
          bg: 'rgba(255,255,255,.58)',
          border: '#ef4f43',
          borderWidth: 3,
          cutTopLeft: 74,
          cutBottomRight: 150
        },

        // 右下斜角區球員名稱
        name: {
          textX: 715,
          textY: 1034,
          lineX: 715,
          lineY: 1046,
          lineW: 300,
          typeX: 718,
          typeY: 1070,
          maxWidth: 310,
          color: '#10284a',
          typeColor: '#52657d',
          lineColor: '#ef4f43'
        },

        // 第二背景完全獨立的字體大小
        fonts: {
          headerVs: 34,
          headerDate: 24,
          metricLabel: 23,
          metricValue: 43,
          paNumber: 23,
          paResult: 34,
          paRbi: 20,
          pitcherTitle: 34,
          pitcherLabel: 22,
          pitcherValue: 30,
          playerName: 42,
          playerType: 19,
          tagText: 25
        },

        decorHeads: { enabled: false }
      },

      bg3: {
        label: '球場夜戰',
        enabled: true,
        style: 'stadium-night',
        frameSize: 0,
        innerBg: '#081522',
        header: {
          drawBox: false,
          vsX: 62, vsY: 92,
          dateX: 1015, dateY: 91,
          dateAlign: 'right',
          textColor: '#ffffff',
          dateColor: '#e7c66a'
        },
        metricCards: [
          { x: 54,  y: 142, w: 306, h: 116, r: 18, bg: 'rgba(7,25,42,.82)', border: 'rgba(255,255,255,.18)', label: '#a9bdd0', value: '#ffffff', labelOffset: 37, valueOffset: 88 },
          { x: 387, y: 142, w: 306, h: 116, r: 18, bg: 'rgba(190,145,48,.92)', border: 'rgba(255,255,255,.26)', label: '#11263b', value: '#0c2034', labelOffset: 37, valueOffset: 88 },
          { x: 720, y: 142, w: 306, h: 116, r: 18, bg: 'rgba(7,25,42,.82)', border: 'rgba(255,255,255,.18)', label: '#a9bdd0', value: '#ffffff', labelOffset: 37, valueOffset: 88 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 54, y: 292, w: 470, h: 690, r: 24,
          bg: 'rgba(6,20,34,.88)',
          textColor: '#f5f8fb',
          mutedColor: '#9fb1c2',
          accentColor: '#e7c66a',
          dividerColor: 'rgba(255,255,255,.16)',
          paCircle: '#d5a43e',
          paCircleAlt: '#173a5d',
          paCircleText: '#0b1d2e',
          paCircleAltText: '#ffffff',
          rbiColor: '#f1ce70',
          headingX: 82, headingY: 344,
          underlineX: 82, underlineY: 360, underlineW: 410,
          paStartY: 408, paStep: 68,
          paNumberX: 91, paTextX: 140,
          dividerX1: 76, dividerX2: 500,
          pitcherLabelX: 82, pitcherValueX: 492,
          pitcherStartY: 416, pitcherStep: 61,
          tagsX: 72, tagsBottom: 958, tagsW: 430,
          appearanceFontSize: 27
        },
        photo: {
          x: 558, y: 292, w: 468, h: 600, r: 26,
          bg: '#10263a',
          border: 'rgba(255,255,255,.46)',
          borderWidth: 3
        },
        name: {
          textX: 580, textY: 948,
          lineX: 580, lineY: 968, lineW: 420, lineH: 4,
          typeX: 582, typeY: 1002,
          maxWidth: 420, minFont: 28,
          color: '#ffffff',
          typeColor: '#a9bdd0',
          lineColor: '#e7c66a'
        },
        fonts: {
          headerVs: 39, headerDate: 27,
          metricLabel: 24, metricValue: 46,
          paNumber: 23, paResult: 33, paRbi: 20,
          pitcherTitle: 32, pitcherLabel: 23, pitcherValue: 31,
          playerName: 46, playerType: 20, tagText: 25
        },
        decorHeads: { enabled: false }
      },

      bg4: {
        label: '棒球縫線',
        enabled: true,
        style: 'baseball-seam',
        frameSize: 0,
        innerBg: '#f3eee5',
        header: {
          drawBox: false,
          vsX: 60, vsY: 92,
          dateX: 1010, dateY: 90,
          dateAlign: 'right',
          textColor: '#12304b',
          dateColor: '#a42e2e'
        },
        metricCards: [
          { x: 498, y: 154, w: 168, h: 118, r: 18, bg: 'rgba(255,255,255,.88)', border: '#d8cbbb', label: '#6d7884', value: '#15324d', labelOffset: 38, valueOffset: 90 },
          { x: 678, y: 154, w: 168, h: 118, r: 18, bg: '#173a59', border: '#173a59', label: '#d9e4ee', value: '#ffffff', labelOffset: 38, valueOffset: 90 },
          { x: 858, y: 154, w: 168, h: 118, r: 18, bg: 'rgba(255,255,255,.88)', border: '#d8cbbb', label: '#6d7884', value: '#15324d', labelOffset: 38, valueOffset: 90 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 500, y: 304, w: 526, h: 656, r: 24,
          bg: 'rgba(255,255,255,.86)',
          textColor: '#17324b',
          mutedColor: '#6d7884',
          accentColor: '#b83a35',
          dividerColor: 'rgba(23,50,75,.16)',
          paCircle: '#b83a35',
          paCircleAlt: '#173a59',
          paCircleText: '#ffffff',
          paCircleAltText: '#ffffff',
          rbiColor: '#a67826',
          headingX: 532, headingY: 356,
          underlineX: 532, underlineY: 373, underlineW: 455,
          paStartY: 421, paStep: 64,
          paNumberX: 537, paTextX: 584,
          dividerX1: 520, dividerX2: 1000,
          pitcherLabelX: 532, pitcherValueX: 992,
          pitcherStartY: 428, pitcherStep: 58,
          tagsX: 520, tagsBottom: 936, tagsW: 480,
          appearanceFontSize: 27
        },
        photo: {
          x: 54, y: 270, w: 410, h: 600, r: 28,
          bg: '#ded5c7',
          border: '#b83a35',
          borderWidth: 4
        },
        name: {
          textX: 72, textY: 925,
          lineX: 72, lineY: 945, lineW: 365, lineH: 4,
          typeX: 74, typeY: 980,
          maxWidth: 372, minFont: 27,
          color: '#17324b',
          typeColor: '#6f7880',
          lineColor: '#b83a35'
        },
        fonts: {
          headerVs: 38, headerDate: 26,
          metricLabel: 22, metricValue: 42,
          paNumber: 22, paResult: 31, paRbi: 19,
          pitcherTitle: 31, pitcherLabel: 22, pitcherValue: 30,
          playerName: 44, playerType: 19, tagText: 24
        },
        decorHeads: { enabled: false }
      },

      bg5: {
        label: '牛棚練習場',
        enabled: true,
        style: 'bullpen',
        frameSize: 0,
        innerBg: '#1c2824',
        header: {
          drawBox: false,
          vsX: 58, vsY: 90,
          dateX: 1015, dateY: 89,
          dateAlign: 'right',
          textColor: '#f5f1e7',
          dateColor: '#dcc38a'
        },
        metricCards: [
          { x: 54,  y: 152, w: 164, h: 112, r: 14, bg: 'rgba(21,37,32,.90)', border: '#aa9468', label: '#b8c4bc', value: '#ffffff', labelOffset: 36, valueOffset: 86 },
          { x: 232, y: 152, w: 164, h: 112, r: 14, bg: '#c7a866', border: '#e1ca94', label: '#25342e', value: '#17241f', labelOffset: 36, valueOffset: 86 },
          { x: 410, y: 152, w: 164, h: 112, r: 14, bg: 'rgba(21,37,32,.90)', border: '#aa9468', label: '#b8c4bc', value: '#ffffff', labelOffset: 36, valueOffset: 86 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 54, y: 308, w: 520, h: 660, r: 18,
          bg: 'rgba(18,31,27,.82)',
          textColor: '#f6f4ee',
          mutedColor: '#aebbb3',
          accentColor: '#d9bd7a',
          dividerColor: 'rgba(223,210,180,.15)',
          paCircle: '#c7a866',
          paCircleAlt: '#355346',
          paCircleText: '#17241f',
          paCircleAltText: '#ffffff',
          rbiColor: '#e7ca82',
          headingX: 82, headingY: 360,
          underlineX: 82, underlineY: 377, underlineW: 458,
          paStartY: 425, paStep: 65,
          paNumberX: 88, paTextX: 136,
          dividerX1: 74, dividerX2: 550,
          pitcherLabelX: 80, pitcherValueX: 550,
          pitcherStartY: 432, pitcherStep: 58,
          tagsX: 72, tagsBottom: 944, tagsW: 472,
          appearanceFontSize: 27
        },
        photo: {
          x: 610, y: 220, w: 416, h: 650, r: 18,
          bg: '#253a32',
          border: '#c9b27e',
          borderWidth: 4
        },
        name: {
          plateX: 606, plateY: 880, plateW: 424, plateH: 116, plateR: 16,
          plateBg: 'rgba(8,20,16,.92)',
          plateBorder: 'rgba(209,187,135,.72)',
          textX: 626, textY: 925,
          lineX: 626, lineY: 945, lineW: 372, lineH: 4,
          typeX: 628, typeY: 980,
          maxWidth: 380, minFont: 27,
          color: '#f7f3e9',
          typeColor: '#c7d0ca',
          lineColor: '#c7a866'
        },
        fonts: {
          headerVs: 38, headerDate: 26,
          metricLabel: 22, metricValue: 42,
          paNumber: 22, paResult: 31, paRbi: 19,
          pitcherTitle: 31, pitcherLabel: 22, pitcherValue: 30,
          playerName: 44, playerType: 19, tagText: 24
        },
        decorHeads: { enabled: false }
      },

      bg6: {
        label: '記分板科技風',
        enabled: true,
        style: 'scoreboard-tech',
        frameSize: 0,
        innerBg: '#071018',
        header: {
          drawBox: false,
          vsX: 58, vsY: 92,
          dateX: 1018, dateY: 91,
          dateAlign: 'right',
          textColor: '#dcecff',
          dateColor: '#ffcc4d'
        },
        metricCards: [
          { x: 54,  y: 156, w: 196, h: 118, r: 10, bg: 'rgba(8,23,34,.94)', border: '#2b607b', label: '#78a8be', value: '#f6fbff', labelOffset: 38, valueOffset: 91 },
          { x: 266, y: 156, w: 196, h: 118, r: 10, bg: 'rgba(255,193,57,.94)', border: '#ffd36a', label: '#17212a', value: '#111920', labelOffset: 38, valueOffset: 91 },
          { x: 478, y: 156, w: 196, h: 118, r: 10, bg: 'rgba(8,23,34,.94)', border: '#2b607b', label: '#78a8be', value: '#f6fbff', labelOffset: 38, valueOffset: 91 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 54, y: 316, w: 500, h: 650, r: 16,
          bg: 'rgba(5,16,24,.91)',
          border: 'rgba(49,116,148,.72)',
          borderWidth: 2,
          textColor: '#eaf6ff',
          mutedColor: '#83a4b4',
          accentColor: '#ffca45',
          dividerColor: 'rgba(80,155,188,.22)',
          paCircle: '#ffca45',
          paCircleAlt: '#123b50',
          paCircleText: '#17212a',
          paCircleAltText: '#ffffff',
          rbiColor: '#ffd86b',
          headingX: 82, headingY: 368,
          underlineX: 82, underlineY: 385, underlineW: 438,
          paStartY: 434, paStep: 64,
          paNumberX: 90, paTextX: 138,
          dividerX1: 74, dividerX2: 530,
          pitcherLabelX: 82, pitcherValueX: 530,
          pitcherStartY: 440, pitcherStep: 58,
          tagsX: 72, tagsBottom: 944, tagsW: 452,
          appearanceFontSize: 27
        },
        photo: {
          x: 590, y: 316, w: 436, h: 532, r: 12,
          bg: '#0a1c29',
          border: '#3d83a3',
          borderWidth: 3
        },
        name: {
          plateX: 586, plateY: 870, plateW: 444, plateH: 112, plateR: 12,
          plateBg: 'rgba(4,13,20,.95)',
          plateBorder: 'rgba(255,202,69,.72)',
          textX: 610, textY: 916,
          lineX: 610, lineY: 936, lineW: 394, lineH: 3,
          typeX: 612, typeY: 970,
          maxWidth: 396, minFont: 27,
          color: '#f5fbff',
          typeColor: '#75a2b7',
          lineColor: '#ffca45'
        },
        fonts: {
          headerVs: 38, headerDate: 26,
          metricLabel: 22, metricValue: 42,
          paNumber: 22, paResult: 31, paRbi: 19,
          pitcherTitle: 31, pitcherLabel: 22, pitcherValue: 30,
          playerName: 44, playerType: 19, tagText: 24
        },
        decorHeads: { enabled: false }
      }
    };

    let currentTemplate = localStorage.getItem('baseballCardTemplate') || 'bg1';
    if (!TEMPLATES[currentTemplate]?.enabled) currentTemplate = 'bg1';

    function getCurrentTemplate() {
      return TEMPLATES[currentTemplate] || TEMPLATES.bg1;
    }

    function getPhotoFrame() {
      return getCurrentTemplate().photo;
    }

    const DECOR_HEAD_1 = 'data:image/png;base64,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';
    const DECOR_HEAD_2 = 'data:image/png;base64,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';
    const decorImageCache = new Map();
    const OPPONENTS = [
      { name: '富邦悍將', color: '#005BAC' },
      { name: '台鋼雄鷹', color: '#008C4A' },
      { name: '中信兄弟', color: '#F2C500' },
      { name: '樂天桃猿', color: '#8B1E3F' },
      { name: '統一7-ELEVEn獅', color: '#F58220' },
      { name: '味全龍', color: '#D71920' }
    ];

    function normalizeTeamName(name = '') {
      const raw = String(name || '').trim();
      const compact = raw.replace(/[\s　_-]+/g, '').toLowerCase();
      if (['統一獅','統一7-11獅','統一7eleven獅','統一7elev en獅'.replace(/\s/g,'')].map(v => v.replace(/[\s　_-]+/g, '').toLowerCase()).includes(compact)) {
        return '統一7-ELEVEn獅';
      }
      return raw;
    }

    function opponentColor(name) {
      const normalized = normalizeTeamName(name);
      return OPPONENTS.find(team => team.name === normalized)?.color || '#ffffff';
    }

    function opponentOptions(selected = '') {
      const normalizedSelected = normalizeTeamName(selected);
      return [
        `<option value="" ${normalizedSelected ? '' : 'selected'}>請選擇對手</option>`,
        ...OPPONENTS.map(team => `<option value="${escapeAttr(team.name)}" style="color:${team.color};font-weight:800" ${normalizedSelected === team.name ? 'selected' : ''}>${escapeHtml(team.name)}</option>`)
      ].join('');
    }

    function syncOpponentSelectColor(select) {
      if (!select) return;
      select.style.color = select.value ? opponentColor(select.value) : 'var(--muted)';
      select.style.fontWeight = select.value ? '800' : '400';
    }

    const hitterDefaults = () => ({
      pa: 0, ab: 0, rbi: 0, runs: 0,
      single: 0, double: 0, triple: 0, hr: 0,
      sacBunt: 0, sacFly: 0, bb: 0, ibb: 0, hbp: 0
    });

    const pitcherDefaults = () => ({
      cg: 0, sho: 0, noWalkHbp: 0,
      w: 0, l: 0, sv: 0, bsv: 0, hld: 0,
      outs: 0, h: 0, bb: 0, hbp: 0, k: 0, er: 0
    });

    const PITCHER_LAST_METRIC_OPTIONS = [
      ['wl', '勝敗'],
      ['hld', '中繼成功'],
      ['sv', '救援成功'],
      ['w_hld', '勝／中繼成功'],
      ['w_sv', '勝／救援成功']
    ];

    function normalizePitcherLastMetric(value) {
      return PITCHER_LAST_METRIC_OPTIONS.some(([key]) => key === value) ? value : 'wl';
    }

    function pitcherLastMetricOptions(selected = 'wl') {
      const value = normalizePitcherLastMetric(selected);
      return PITCHER_LAST_METRIC_OPTIONS.map(([key, label]) =>
        `<option value="${key}" ${value === key ? 'selected' : ''}>${label}</option>`
      ).join('');
    }

    function pitcherLastMetric(player, stats) {
      const mode = normalizePitcherLastMetric(player?.pitcherLastMetric);
      const s = mergeStats(stats, pitcherDefaults);
      switch (mode) {
        case 'hld': return ['中繼成功', String(s.hld)];
        case 'sv': return ['救援成功', String(s.sv)];
        case 'w_hld': return ['勝／中繼成功', `${s.w}／${s.hld}`];
        case 'w_sv': return ['勝／救援成功', `${s.w}／${s.sv}`];
        default: return ['勝／敗', `${s.w}／${s.l}`];
      }
    }

    async function cpblRequest(action, payload = {}) {
      const response = await fetch(CPBL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          appKey: CPBL_APP_KEY,
          anonKey: CPBL_ANON_KEY,
          action,
          ...payload
        })
      });
      let data = null;
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data?.ok) throw new Error(data?.error || `中職官網連線失敗（${response.status}）`);
      return data;
    }

    async function baseballRequest(action, payload = {}) {
      const response = await fetch(BASEBALL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          appKey: CPBL_APP_KEY,
          anonKey: CPBL_ANON_KEY,
          action,
          ...payload
        })
      });
      let data = null;
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `國外聯盟資料連線失敗（${response.status}）`);
      }
      return data;
    }

    function overseasProvider(competition = '') {
      const value = String(competition || '').trim();
      if (value === '美國職棒') return 'US';
      if (value === 'MLB') return 'MLB';
      if (value === 'MiLB') return 'MILB';
      if (value === 'NPB') return 'NPB';
      if (value === 'KBO') return 'KBO';
      return '';
    }

    function overseasProviderLabel(provider = '') {
      const value = String(provider || '').toUpperCase();
      if (value === 'US') return 'MLB / MiLB';
      return value === 'MILB' ? 'MiLB' : value;
    }

    function isUsPlayer(player) {
      if (!player || playerScope(player) !== 'overseas') return false;
      const provider = String(player.externalProvider || '').toUpperCase();
      const competition = String(player.externalCompetition || '').trim();
      return ['US','MLB','MILB'].includes(provider)
        || ['美國職棒','MLB','MiLB'].includes(competition);
    }

    function usCareerEntries(player) {
      return Array.isArray(player?.usCareerEntries) ? player.usCareerEntries : [];
    }

    function currentUsCareerEntry(player) {
      const entries = usCareerEntries(player);
      if (!entries.length) return null;
      const selectedKey = String(player?.usSelectedCareerKey || '');
      return entries.find(entry => String(entry.key) === selectedKey) || entries[0] || null;
    }

    function usCareerOptionLabel(entry) {
      if (!entry) return '';
      return [
        Number(entry.year) || '',
        String(entry.organizationName || entry.teamName || '').trim() || '球隊未提供',
        String(entry.level || '').trim() || 'MiLB'
      ].filter(Boolean).join('｜');
    }

    function applyUsCareerEntry(player, entry) {
      if (!player || !entry) return null;
      const year = Number(entry.year) || CURRENT_YEAR;
      const hitterLocal = entry.hitter ? externalHitterStatsToLocal(entry.hitter) : null;
      const pitcherLocal = entry.pitcher ? externalPitcherStatsToLocal(entry.pitcher) : null;

      player.usSelectedCareerKey = String(entry.key || '');
      player.externalYear = year;
      selectedSeason = year;
      selectedLevel = 'A';

      storeRoleStatsProfile(player, year, 'A', hitterLocal, pitcherLocal);
      const nextStats = player.type === 'pitcher'
        ? (pitcherLocal || pitcherDefaults())
        : (hitterLocal || hitterDefaults());
      ensureStatsProfiles(player)[statsProfileKey(year, 'A')] = { ...nextStats };
      player.stats = { ...nextStats };
      return entry;
    }

    async function syncUsCareer(player, onProgress = null, preferredYear = null) {
      if (!isUsPlayer(player) || !player?.externalPlayerId) return null;
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      report(12, '正在同步 MLB / MiLB 生涯球隊與層級…');
      const data = await baseballRequest('career-stats', {
        provider:'US',
        id:player.externalPlayerId
      });
      const career = data?.career || {};
      const profile = career.profile || {};
      const current = career.current || {};
      const entries = Array.isArray(career.entries) ? career.entries : [];

      player.externalCompetition = '美國職棒';
      player.externalCurrentTeam = String(current.team || profile.team || player.externalCurrentTeam || player.externalTeam || '').trim();
      player.externalCurrentOrganization = String(current.organization || profile.currentOrganization || profile.organization || player.externalCurrentOrganization || '').trim();
      player.externalCurrentLevel = String(current.level || profile.currentLevel || player.externalCurrentLevel || '').trim();
      player.externalCurrentSportId = Number(current.sportId || profile.sportId || player.externalCurrentSportId || 0) || 0;
      player.externalTeam = player.externalCurrentTeam || player.externalTeam || '';
      player.externalPosition = profile.position || player.externalPosition || '';
      player.externalOfficialName = profile.name || player.externalOfficialName || '';
      if (profile.number) player.number = String(profile.number);

      player.usCareerEntries = entries.map(entry => ({
        ...entry,
        key:String(entry.key || [entry.year,entry.sportId,entry.teamId||entry.teamName||''].join('|')),
        year:Number(entry.year)||0,
        sportId:Number(entry.sportId)||0,
        level:String(entry.level||''),
        teamId:String(entry.teamId||''),
        teamName:String(entry.teamName||''),
        organizationName:String(entry.organizationName||'')
      })).filter(entry => entry.year && (entry.hitter || entry.pitcher));

      player.externalAvailableYears = [...new Set(
        player.usCareerEntries.map(entry => Number(entry.year)).filter(Number.isInteger)
      )].sort((a,b)=>b-a);

      const oldKey = String(player.usSelectedCareerKey || '');
      let active = player.usCareerEntries.find(entry => entry.key === oldKey) || null;
      const targetYear = Number(preferredYear) || 0;
      if (!active && targetYear) {
        active = player.usCareerEntries.find(entry => Number(entry.year) === targetYear) || null;
      }
      if (!active) {
        active = player.usCareerEntries.find(entry => Number(entry.year) === CURRENT_YEAR)
          || player.usCareerEntries[0]
          || null;
      }
      if (active) applyUsCareerEntry(player, active);

      player.externalLastUpdatedAt = Date.now();
      await savePlayer(player);
      report(94, `已整理 ${player.usCareerEntries.length} 筆年份／球隊／層級成績…`);
      return career;
    }

    function externalHitterStatsToLocal(stats = {}) {
      const next = hitterDefaults();
      for (const key of ['pa','ab','rbi','runs','single','double','triple','hr','sacBunt','sacFly','bb','ibb','hbp','k','errors']) {
        next[key] = Math.max(0, Number(stats?.[key]) || 0);
      }
      return next;
    }

    function cpblOfficialTypeFromPosition(position = '') {
      const value = String(position || '').trim();
      if (/投手/.test(value)) return 'pitcher';

      // CPBL 官方球員頁常回傳實際守位名稱，而不一定是「內野手／外野手」大分類。
      // 所有非投手守備位置都應歸為 hitter 主分類。
      if (/(?:捕手|一壘手|二壘手|三壘手|游擊手|左外野手|中外野手|右外野手|內野手|内野手|外野手|指定打擊|DH|工具人)/i.test(value)) {
        return 'hitter';
      }
      return '';
    }

    function rebuildCpblPrimaryProfilesFromRoles(player, officialType) {
      const roleProfiles = ensureRoleStatsProfiles(player);
      const profiles = ensureStatsProfiles(player);
      let wrote = false;

      for (const [key, pair] of Object.entries(roleProfiles)) {
        const roleStats = officialType === 'pitcher' ? pair?.pitcher : pair?.hitter;
        const hasData = officialType === 'pitcher'
          ? pitcherRoleHasData(roleStats)
          : hitterRoleHasData(roleStats);
        if (!hasData) continue;
        profiles[key] = { ...roleStats };
        wrote = true;
      }

      const activeKey = statsProfileKey(selectedSeason, selectedLevel);
      if (profiles[activeKey]) {
        player.stats = { ...profiles[activeKey] };
      } else if (wrote) {
        const first = Object.keys(profiles)
          .sort((a,b) => String(b).localeCompare(String(a)))
          .find(key => profiles[key]);
        player.stats = first ? { ...profiles[first] } : (officialType === 'pitcher' ? pitcherDefaults() : hitterDefaults());
      } else {
        player.stats = officialType === 'pitcher' ? pitcherDefaults() : hitterDefaults();
      }
    }

    function repairStoredCpblPlayerType(player, officialPosition = '') {
      if (!player || playerScope(player) !== 'cpbl' || !player.cpblAcnt) return false;

      const position = String(officialPosition || player.cpblPosition || '').trim();
      const officialType = cpblOfficialTypeFromPosition(position);
      let changed = false;

      if (position && player.cpblPosition !== position) {
        player.cpblPosition = position;
        changed = true;
      }
      if (position) player.cpblPositionSource = 'CPBL 官方球員頁';
      if (!officialType) return changed;

      if (player.primaryType !== officialType) {
        player.primaryType = officialType;
        changed = true;
      }

      if (player.type !== officialType) {
        player.type = officialType;
        rebuildCpblPrimaryProfilesFromRoles(player, officialType);
        if (officialType === 'pitcher') {
          player.pitcherLastMetric = normalizePitcherLastMetric(player.pitcherLastMetric);
        }
        player.cpblRoleCorrectedAt = Date.now();
        changed = true;
      }
      return changed;
    }

    function externalPositionType(position = '') {
      const value = String(position || '').trim();
      if (/投手|pitcher|투수/i.test(value)) return 'pitcher';
      if (/捕手|内野手|外野手|catcher|infielder|outfielder|포수|내야수|외야수/i.test(value)) return 'hitter';
      return '';
    }

    function officialExternalPlayerType(player, profile = {}) {
      if (['pitcher','hitter'].includes(player?.primaryType)) return player.primaryType;
      const explicit = ['pitcher','hitter'].includes(profile?.type) ? profile.type : '';
      return explicit || externalPositionType(
        profile?.position || profile?.jpPosition || player?.externalPosition || ''
      ) || (['pitcher','hitter'].includes(player?.type) ? player.type : '');
    }

    function repairStoredExternalPlayerType(player) {
      if (!player || playerScope(player) !== 'overseas') return false;
      const officialType = externalPositionType(player.externalPosition || '') || player.primaryType || '';
      let changed = false;
      if (officialType && player.primaryType !== officialType) {
        player.primaryType = officialType;
        changed = true;
      }
      if (officialType && player.type !== officialType) {
        player.type = officialType;
        player.stats = officialType === 'pitcher' ? pitcherDefaults() : hitterDefaults();
        if (officialType === 'pitcher') player.pitcherLastMetric = normalizePitcherLastMetric(player.pitcherLastMetric);
        changed = true;
      }
      return changed;
    }

    function externalPitcherStatsToLocal(stats = {}) {
      const next = pitcherDefaults();
      for (const key of ['cg','sho','noWalkHbp','w','l','sv','bsv','hld','outs','h','bb','hbp','k','er']) {
        next[key] = Math.max(0, Math.round(Number(stats?.[key]) || 0));
      }
      const era = Number(stats?.era);
      const whip = Number(stats?.whip);
      if (Number.isFinite(era) && Number.isFinite(whip)) {
        next.cpblEra = era;
        next.cpblWhip = whip;
        next.cpblRatesOfficial = true;
      }
      return next;
    }

    function ensureRoleStatsProfiles(player) {
      if (!player.roleStatsProfiles || typeof player.roleStatsProfiles !== 'object' || Array.isArray(player.roleStatsProfiles)) {
        player.roleStatsProfiles = {};
      }
      return player.roleStatsProfiles;
    }

    function roleStatsPair(player, year = selectedSeason, level = selectedLevel) {
      return ensureRoleStatsProfiles(player)[statsProfileKey(year, level)] || { hitter:null, pitcher:null };
    }

    function hitterRoleHasData(stats) {
      if (!stats) return false;
      return ['pa','ab','rbi','runs','single','double','triple','hr','sacBunt','sacFly','bb','ibb','hbp']
        .some(key => Number(stats?.[key]) > 0);
    }

    function pitcherRoleHasData(stats) {
      if (!stats) return false;
      return ['cg','sho','w','l','sv','bsv','hld','outs','h','bb','hbp','k','er']
        .some(key => Number(stats?.[key]) > 0);
    }

    function storeRoleStatsProfile(player, year, level, hitterStats = null, pitcherStats = null) {
      const profiles = ensureRoleStatsProfiles(player);
      profiles[statsProfileKey(year, level)] = {
        hitter: hitterStats ? { ...hitterStats } : null,
        pitcher: pitcherStats ? { ...pitcherStats } : null
      };
      player.hasCrossRoleStats = Boolean(
        player.hasCrossRoleStats
        || (player.type === 'pitcher' && hitterRoleHasData(hitterStats))
        || (player.type === 'hitter' && pitcherRoleHasData(pitcherStats))
      );
    }

    function readonlyStatField(label, value) {
      return `<label class="field">${escapeHtml(label)}<input type="text" value="${escapeAttr(String(value ?? 0))}" readonly /></label>`;
    }

    function secondarySeasonStatsHtml(player) {
      if (!player || !supportsLeagueLevelTabs(player)) return '';
      const pair = roleStatsPair(player);
      const secondaryType = player.type === 'pitcher' ? 'hitter' : 'pitcher';
      const stats = pair?.[secondaryType] || null;

      if (secondaryType === 'hitter') {
        if (!hitterRoleHasData(stats)) return '';
        const d = hitterDerived(stats);
        return `
          <div class="dual-role-season-block">
            <div class="dual-role-season-head">
              <h3>同季打擊成績</h3>
              <span class="small">主要守位仍為投手</span>
            </div>
            <div class="metrics">
              <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
              <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
              <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
            </div>
            <div class="grid four">
              ${readonlyStatField('打席', stats.pa)}
              ${readonlyStatField('打數', stats.ab)}
              ${readonlyStatField('安打', d.hits)}
              ${readonlyStatField('得分', stats.runs)}
              ${readonlyStatField('打點', stats.rbi)}
              ${readonlyStatField('一安', stats.single)}
              ${readonlyStatField('二安', stats.double)}
              ${readonlyStatField('三安', stats.triple)}
              ${readonlyStatField('全壘打', stats.hr)}
              ${readonlyStatField('四壞球', stats.bb)}
              ${readonlyStatField('死球', stats.hbp)}
              ${readonlyStatField('犧牲短打', stats.sacBunt)}
            </div>
          </div>`;
      }

      if (!pitcherRoleHasData(stats)) return '';
      const d = pitcherDerived(stats);
      return `
        <div class="dual-role-season-block">
          <div class="dual-role-season-head">
            <h3>同季投球成績</h3>
            <span class="small">主要守位仍為打者</span>
          </div>
          <div class="metrics">
            <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
            <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
            <div class="metric"><span>勝／敗</span><strong>${stats.w || 0}／${stats.l || 0}</strong></div>
          </div>
          <div class="grid four">
            ${readonlyStatField('投球局數', outsToIP(stats.outs || 0))}
            ${readonlyStatField('被安打', stats.h)}
            ${readonlyStatField('保送', stats.bb)}
            ${readonlyStatField('死球', stats.hbp)}
            ${readonlyStatField('三振', stats.k)}
            ${readonlyStatField('自責分', stats.er)}
            ${readonlyStatField('完投', stats.cg)}
            ${readonlyStatField('完封', stats.sho)}
            ${readonlyStatField('救援成功', stats.sv)}
            ${readonlyStatField('中繼成功', stats.hld)}
          </div>
        </div>`;
    }

    function secondaryRoleAvailableYears(player) {
      if (!player || !supportsLeagueLevelTabs(player)) return [];
      const years = new Set([
        ...availableSeasonYears(player, 'A'),
        ...availableSeasonYears(player, 'D')
      ]);
      const profiles = ensureRoleStatsProfiles(player);
      for (const [key, pair] of Object.entries(profiles)) {
        const [yearText] = String(key).split(':');
        const year = Number(yearText);
        if (!Number.isInteger(year)) continue;
        const secondary = player.type === 'pitcher' ? pair?.hitter : pair?.pitcher;
        if ((player.type === 'pitcher' ? hitterRoleHasData(secondary) : pitcherRoleHasData(secondary))) years.add(year);
      }
      return [...years].filter(y => Number.isInteger(y) && y >= 1990 && y <= 2100).sort((a,b)=>b-a);
    }

    function crossRoleLevelHtml(player, year, level) {
      const pair = roleStatsPair(player, year, level);
      const secondaryType = player.type === 'pitcher' ? 'hitter' : 'pitcher';
      const stats = pair?.[secondaryType] || null;
      const levelLabel = level === 'D' ? '二軍' : '一軍';

      if (secondaryType === 'hitter') {
        if (!hitterRoleHasData(stats)) {
          return `<section class="cross-role-level-card"><h3>${levelLabel}</h3><div class="cross-role-empty">${year} 年目前沒有可確認的打擊紀錄。</div></section>`;
        }
        const d = hitterDerived(stats);
        return `
          <section class="cross-role-level-card">
            <h3>${levelLabel}｜打擊成績</h3>
            <div class="metrics">
              <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
              <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
              <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
            </div>
            <div class="grid four">
              ${readonlyStatField('打席', stats.pa || 0)}
              ${readonlyStatField('打數', stats.ab || 0)}
              ${readonlyStatField('安打', d.hits || 0)}
              ${readonlyStatField('得分', stats.runs || 0)}
              ${readonlyStatField('打點', stats.rbi || 0)}
              ${readonlyStatField('一安', stats.single || 0)}
              ${readonlyStatField('二安', stats.double || 0)}
              ${readonlyStatField('三安', stats.triple || 0)}
              ${readonlyStatField('全壘打', stats.hr || 0)}
              ${readonlyStatField('四壞球', stats.bb || 0)}
              ${readonlyStatField('故意四壞', stats.ibb || 0)}
              ${readonlyStatField('死球', stats.hbp || 0)}
              ${readonlyStatField('三振', stats.k || 0)}
              ${readonlyStatField('犧牲短打', stats.sacBunt || 0)}
              ${readonlyStatField('犧牲高飛', stats.sacFly || 0)}
            </div>
          </section>`;
      }

      if (!pitcherRoleHasData(stats)) {
        return `<section class="cross-role-level-card"><h3>${levelLabel}</h3><div class="cross-role-empty">${year} 年目前沒有可確認的投球紀錄。</div></section>`;
      }
      const d = pitcherDerived(stats);
      return `
        <section class="cross-role-level-card">
          <h3>${levelLabel}｜投球成績</h3>
          <div class="metrics">
            <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
            <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
            <div class="metric"><span>勝／敗</span><strong>${stats.w || 0}／${stats.l || 0}</strong></div>
          </div>
          <div class="grid four">
            ${readonlyStatField('投球局數', outsToIP(stats.outs || 0))}
            ${readonlyStatField('被安打', stats.h || 0)}
            ${readonlyStatField('保送', stats.bb || 0)}
            ${readonlyStatField('死球', stats.hbp || 0)}
            ${readonlyStatField('三振', stats.k || 0)}
            ${readonlyStatField('自責分', stats.er || 0)}
            ${readonlyStatField('勝場', stats.w || 0)}
            ${readonlyStatField('敗場', stats.l || 0)}
            ${readonlyStatField('完投', stats.cg || 0)}
            ${readonlyStatField('完封', stats.sho || 0)}
            ${readonlyStatField('救援成功', stats.sv || 0)}
            ${readonlyStatField('中繼成功', stats.hld || 0)}
          </div>
        </section>`;
    }

    function renderSecondaryRolePage(player) {
      const secondaryLabel = player.type === 'pitcher' ? '打擊成績' : '投球成績';
      const primaryLabel = player.type === 'pitcher' ? '投手' : '野手';
      els.content.innerHTML = `
        <div class="cross-role-page-head">
          <div>
            <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${secondaryLabel}</h2>
            <div class="small" style="margin-top:6px">主要守位仍為${primaryLabel}；這一頁只整理正式比賽中出現的另一種角色成績，不會改變球員身分。</div>
          </div>
          <div class="small">${selectedSeason} 年</div>
        </div>
        <div class="cross-role-level-grid">
          ${crossRoleLevelHtml(player, selectedSeason, 'A')}
          ${crossRoleLevelHtml(player, selectedSeason, 'D')}
        </div>
        ${playerSourceInfoHtml(player)}`;
    }

    async function syncSecondaryRoleSeason(player, year = selectedSeason, onProgress = null) {
      if (!player || playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) return;
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      const provider = String(player.externalProvider || '').toUpperCase();

      if (['NPB','KBO'].includes(provider)) {
        const lastChecked = Number(player?.externalLevelYearsCheckedAt?.D || 0);
        const historyStale = !lastChecked || (Date.now() - lastChecked > 24 * 60 * 60 * 1000);
        if (historyStale) {
          report(8, `正在確認 ${provider} 二軍歷年出賽…`);
          try { await syncExternalLevelYears(player, 'D', (p,s)=>report(Math.min(35, Math.round(p * .7)), s)); }
          catch (error) { console.warn(`${provider} 跨角色頁二軍年份同步失敗`, error); }
        }
      }

      const jobs = [];
      const majorYears = availableSeasonYears(player, 'A');
      const farmYears = availableSeasonYears(player, 'D');
      if (majorYears.includes(Number(year))) jobs.push('A');
      if (farmYears.includes(Number(year))) jobs.push('D');
      if (!jobs.length) jobs.push('A');

      let completed = 0;
      for (const level of jobs) {
        try {
          await syncExternalSeason(player, year, null, level);
        } catch (error) {
          console.warn(`跨角色頁 ${year} ${level} 同步失敗`, error);
        }
        completed++;
        report(40 + Math.round(completed / jobs.length * 48), `正在整理 ${year} ${level === 'D' ? '二軍' : '一軍'}投打資料…`);
      }
      await savePlayer(player);
    }

    function secondaryDailyRoleHtml(player) {
      const pair = currentRecord?.externalRoleDaily;
      if (!player || !pair) return '';
      if (player.type === 'pitcher') {
        const h = pair.hitter;
        if (!h || !(
          Number(h.pa)>0 || Number(h.ab)>0 || Number(h.hits)>0 || Number(h.runs)>0 || Number(h.rbi)>0
          || Number(h.bb)>0 || Number(h.hbp)>0 || Number(h.hr)>0
        )) return '';
        return `
          <div class="dual-role-season-block">
            <div class="dual-role-season-head"><h3>本場打擊成績</h3><span class="small">同一場投打紀錄合併顯示</span></div>
            <div class="grid four">
              ${readonlyStatField('打席', h.pa || 0)}
              ${readonlyStatField('打數', h.ab || 0)}
              ${readonlyStatField('安打', h.hits || 0)}
              ${readonlyStatField('得分', h.runs || 0)}
              ${readonlyStatField('打點', h.rbi || 0)}
              ${readonlyStatField('全壘打', h.hr || 0)}
              ${readonlyStatField('保送', h.bb || 0)}
              ${readonlyStatField('死球', h.hbp || 0)}
              ${readonlyStatField('三振', h.k || 0)}
            </div>
          </div>`;
      }

      const p = pair.pitcher;
      if (!p || !(
        Number(p.outs)>0 || String(p.innings || '0.0') !== '0.0' || Number(p.h)>0 || Number(p.k)>0
        || Number(p.bb)>0 || Number(p.hbp)>0 || Number(p.r)>0 || Number(p.er)>0
      )) return '';
      return `
        <div class="dual-role-season-block">
          <div class="dual-role-season-head"><h3>本場投球成績</h3><span class="small">同一場投打紀錄合併顯示</span></div>
          <div class="grid four">
            ${readonlyStatField('投球局數', p.innings || outsToIP(Number(p.outs)||0) || '0.0')}
            ${readonlyStatField('被安打', p.h || 0)}
            ${readonlyStatField('保送', p.bb || 0)}
            ${readonlyStatField('死球', p.hbp || 0)}
            ${readonlyStatField('三振', p.k || 0)}
            ${readonlyStatField('失分', p.r || 0)}
            ${readonlyStatField('自責分', p.er || 0)}
            ${readonlyStatField('用球數', p.pitchCount || 0)}
          </div>
        </div>`;
    }

    function applyExternalSeasonStats(player, remote, requestedYear, level = selectedLevel) {
      if (!player || !remote) throw new Error('國外聯盟賽季資料格式錯誤。');
      level = level === 'D' ? 'D' : 'A';

      const profile = remote.profile || {};
      const hitter = remote.hitter || null;
      const pitcher = remote.pitcher || null;

      player.externalTwoWay = Boolean(player.externalTwoWay || profile.twoWay);

      // type/primaryType 只代表主要守位；同一球員可同時保存打擊與投球資料。
      const officialType = officialExternalPlayerType(player, profile);
      if (officialType) {
        player.primaryType = officialType;
        player.type = officialType;
      } else if (!player.primaryType) {
        player.primaryType = player.type;
      }

      if (!hitter && !pitcher) {
        throw new Error(`${requestedYear} 年找不到此球員的例行賽成績。`);
      }

      const hitterLocal = hitter ? externalHitterStatsToLocal(hitter) : null;
      const pitcherLocal = pitcher ? externalPitcherStatsToLocal(pitcher) : null;
      storeRoleStatsProfile(player, requestedYear, level, hitterLocal, pitcherLocal);

      const official = player.type === 'pitcher' ? pitcher : hitter;
      const nextStats = player.type === 'pitcher'
        ? (pitcherLocal || pitcherDefaults())
        : (hitterLocal || hitterDefaults());

      const profiles = ensureStatsProfiles(player);
      profiles[statsProfileKey(requestedYear, level)] = { ...nextStats };
      if (player.id === selectedPlayerId && Number(requestedYear) === Number(selectedSeason) && level === selectedLevel) {
        player.stats = { ...nextStats };
      }

      player.externalTeam = profile.team || player.externalTeam || '';
      player.externalPosition = profile.position || player.externalPosition || '';
      player.externalOfficialName = profile.name || player.externalOfficialName || '';

      const localizedName = String(profile.zhName || '').replace(/\s+/g, '');
      if (localizedName && /[\u3400-\u9fff]/.test(localizedName)) {
        const currentName = String(player.name || '').replace(/\s+/g, '');
        const preferredAliases = new Set(
          (Array.isArray(profile.zhNameAliases) ? profile.zhNameAliases : [])
            .map(value => String(value || '').replace(/\s+/g, ''))
            .filter(Boolean)
        );
        const shouldUpgradeName = !currentName
          || !/[\u3400-\u9fff]/.test(currentName)
          || localizedName === currentName
          || localizedName.includes(currentName)
          || currentName === String(player.externalOfficialName || '').replace(/\s+/g, '')
          || (Boolean(profile.zhNamePreferred) && preferredAliases.has(currentName));
        if (shouldUpgradeName) player.name = localizedName;
      }

      const remoteYears = Array.isArray(profile.years)
        ? profile.years.map(Number).filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100)
        : [];
      player.externalAvailableYears = [...new Set([
        ...remoteYears,
        ...(Array.isArray(player.externalAvailableYears) ? player.externalAvailableYears.map(Number) : []),
        Number(requestedYear)
      ].filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100))].sort((a,b)=>b-a);

      player.externalAvailableYearsByLevel ||= { A: [], D: [] };
      const providerCode = String(player.externalProvider || '').toUpperCase();
      const levelYears = (level === 'A' || (level === 'D' && providerCode === 'KBO'))
        ? remoteYears
        : [Number(requestedYear)];
      player.externalAvailableYearsByLevel[level] = [...new Set([
        ...(Array.isArray(player.externalAvailableYearsByLevel[level]) ? player.externalAvailableYearsByLevel[level].map(Number) : []),
        ...levelYears,
        Number(requestedYear)
      ].filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100))].sort((a,b)=>b-a);

      player.externalYear = Number(requestedYear) || player.externalYear || CURRENT_YEAR;
      player.externalLastSyncSource = remote?.sourceMode || '';
      player.externalLastUpdatedAt = Date.now();
      return official;
    }

    async function syncExternalLevelYears(player, level = 'D', onProgress = null) {
      if (playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) return [];
      level = level === 'D' ? 'D' : 'A';
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      report(10, `正在搜尋 ${overseasProviderLabel(player.externalProvider)} ${level === 'D' ? '二軍' : '一軍'}歷年出賽…`);
      const data = await baseballRequest('season-years', {
        provider:player.externalProvider,
        id:player.externalPlayerId,
        level
      });
      const years = Array.isArray(data?.history?.years)
        ? data.history.years.map(Number).filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100)
        : [];
      player.externalAvailableYearsByLevel ||= { A:[], D:[] };
      player.externalAvailableYearsByLevel[level] = [...new Set(years)].sort((a,b)=>b-a);
      player.externalLevelYearsCheckedAt ||= {};
      player.externalLevelYearsCheckedAt[level] = Date.now();
      report(48, `${level === 'D' ? '二軍' : '一軍'}找到 ${years.length} 個有出賽的賽季…`);
      await savePlayer(player);
      return player.externalAvailableYearsByLevel[level];
    }

    async function syncExternalSeason(player, requestedYear = selectedSeason, onProgress = null, level = selectedLevel) {
      if (playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) return null;
      if (isUsPlayer(player)) {
        return await syncUsCareer(player, onProgress, requestedYear);
      }
      level = level === 'D' ? 'D' : 'A';
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      report(18, `正在連線 ${overseasProviderLabel(player.externalProvider)}…`);
      const data = await baseballRequest('season-stats', {
        provider: player.externalProvider,
        id: player.externalPlayerId,
        year: requestedYear,
        level: supportsLeagueLevelTabs(player) ? level : 'A'
      });
      report(76, `正在整理 ${requestedYear} 賽季資料…`);
      const remote = data.stats;
      applyExternalSeasonStats(player, remote, requestedYear, level);
      await savePlayer(player);
      report(94, '正在更新球員資料…');
      return remote;
    }

    async function syncInternationalTournamentStats(player, onProgress = null) {
      if (playerScope(player) !== 'international') return null;
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      const competition = playerSpecialCompetition(player);
      const year = Number(player.externalYear) || CURRENT_YEAR;
      const team = internationalTeam(player);
      const playerName = String(player.externalOfficialName || player.name || '').trim();

      report(12, `正在連線 ${competition} ${year} 賽事資料…`);
      const data = await baseballRequest('international-player-stats', {
        competition,
        year,
        team,
        playerId: String(player.externalPlayerId || ''),
        playerName
      });
      report(42, `正在整理 ${player.name} 的賽事成績…`);

      const remote = data?.stats || {};
      const hitter = remote?.hitter || null;
      const pitcher = remote?.pitcher || null;

      // 有官方資料時才覆蓋，避免尚未開打／來源暫時沒資料時把既有成績洗成 0。
      if (hitter || pitcher) {
        if (player.type === 'pitcher' && !pitcher && hitter) player.type = 'hitter';
        if (player.type === 'hitter' && !hitter && pitcher) player.type = 'pitcher';

        const official = player.type === 'pitcher' ? pitcher : hitter;
        if (official) {
          player.stats = player.type === 'pitcher'
            ? externalPitcherStatsToLocal(official)
            : externalHitterStatsToLocal(official);
        }

        player.internationalSource = remote.source || player.internationalSource || '';
        player.internationalSourceUrl = remote.sourceUrl || player.internationalSourceUrl || '';
        player.externalLastUpdatedAt = Date.now();
        player.internationalStatsFound = true;
        await savePlayer(player);
      } else {
        player.internationalSource = remote.source || player.internationalSource || '';
        player.internationalSourceUrl = remote.sourceUrl || player.internationalSourceUrl || '';
        player.externalLastCheckedAt = Date.now();
        player.internationalStatsFound = false;
        await savePlayer(player);
      }

      report(52, '賽事總成績已整理完成…');
      return remote;
    }


    function internationalHitterTotalsFromGames(games = []) {
      const next = hitterDefaults();
      for (const game of games) {
        const h = game?.hitter;
        if (!h) continue;
        for (const key of ['pa','ab','rbi','runs','single','double','triple','hr','sacBunt','sacFly','bb','ibb','hbp']) {
          next[key] += Math.max(0, Number(h?.[key]) || 0);
        }
      }
      return next;
    }

    function internationalPitcherTotalsFromGames(games = []) {
      const next = pitcherDefaults();
      let totalRuns = 0;
      for (const game of games) {
        const p = game?.pitcher;
        if (!p) continue;
        for (const key of ['cg','sho','w','l','sv','bsv','hld','outs','h','bb','hbp','k','er']) {
          next[key] += Math.max(0, Number(p?.[key]) || 0);
        }
        totalRuns += Math.max(0, Number(p?.r) || 0);
      }
      next.noWalkHbp = 0;
      return next;
    }

    function internationalGameRecordFromRemote(player, game) {
      const date = String(game?.date || '').slice(0, 10);
      if (!date) return null;

      const record = {
        key: `${date}:${player.id}:A`,
        playerId: player.id,
        date,
        level: 'A',
        opponent: normalizeInternationalTeamName(game?.opponent || ''),
        hitterPAs: [],
        hitterAppearance: {
          mode: 'bat',
          inning: '1',
          half: 'top',
          battingOrder: '1',
          continueDefense: false,
          position: '游擊'
        },
        pitcherGame: {
          innings: '0.0', k: 0, bb: 0, h: 0, hbp: 0, otherReach: 0, r: 0, er: 0,
          pitchTens: 0, pitchOnes: 0,
          cg: false, sho: false, noWalkHbp: false,
          hld: false, sv: false, bsv: false, rainCalled: false,
          decision: 'ND', result: 'ND'
        },
        cpblGameSummary: {
          runs: 0,
          hits: 0,
          errors: 0,
          official: true
        },
        committedStats: null,
        committedAt: Date.now(),
        cpblReadOnlyImport: false,
        externalReadOnlyImport: true,
        internationalOfficialImport: true,
        internationalGameId: String(game?.gameId || ''),
        internationalPartialGame: Boolean(game?.partial),
        internationalHasVerifiedStats: Boolean(game?.hitter || game?.pitcher),
        internationalSources: Array.isArray(game?.sources) ? game.sources : [],
        externalSource: `INT:${game?.source || player.internationalSource || 'international'}`,
        externalImportedAt: Date.now(),
        updatedAt: Date.now()
      };

      if (game?.hitter) {
        const h = game.hitter;
        const list = Array.isArray(h.plateAppearances) ? h.plateAppearances : [];
        record.hitterPAs = list.map(pa => ({
          id: uid(),
          code: pa.code || 'OUT',
          position: pa.position || '',
          rbi: Math.max(0, Number(pa.rbi) || 0),
          cpblOfficialAction: pa.officialAction || ''
        }));
        record.internationalHitterGame = {
          pa: Math.max(0, Number(h.pa) || 0),
          ab: Math.max(0, Number(h.ab) || 0),
          runs: Math.max(0, Number(h.runs) || 0),
          hits: Math.max(0, Number(h.hits) || (
            (Number(h.single)||0)+(Number(h.double)||0)+(Number(h.triple)||0)+(Number(h.hr)||0)
          )),
          single: Math.max(0, Number(h.single) || 0),
          double: Math.max(0, Number(h.double) || 0),
          triple: Math.max(0, Number(h.triple) || 0),
          hr: Math.max(0, Number(h.hr) || 0),
          rbi: Math.max(0, Number(h.rbi) || 0),
          bb: Math.max(0, Number(h.bb) || 0),
          ibb: Math.max(0, Number(h.ibb) || 0),
          hbp: Math.max(0, Number(h.hbp) || 0),
          k: Math.max(0, Number(h.k) || 0),
          sacBunt: Math.max(0, Number(h.sacBunt) || 0),
          sacFly: Math.max(0, Number(h.sacFly) || 0),
          errors: Math.max(0, Number(h.errors) || 0)
        };
        record.cpblGameSummary = {
          runs: record.internationalHitterGame.runs,
          hits: record.internationalHitterGame.hits,
          errors: record.internationalHitterGame.errors,
          official: true
        };
        record.committedStats = record.hitterPAs.length
          ? deriveHitterGame(record.hitterPAs)
          : {
              pa:record.internationalHitterGame.pa,
              ab:record.internationalHitterGame.ab,
              rbi:record.internationalHitterGame.rbi,
              runs:record.internationalHitterGame.runs,
              single:record.internationalHitterGame.single,
              double:record.internationalHitterGame.double,
              triple:record.internationalHitterGame.triple,
              hr:record.internationalHitterGame.hr,
              sacBunt:record.internationalHitterGame.sacBunt,
              sacFly:record.internationalHitterGame.sacFly,
              bb:record.internationalHitterGame.bb,
              ibb:record.internationalHitterGame.ibb,
              hbp:record.internationalHitterGame.hbp
            };
      }

      if (game?.pitcher) {
        const p = game.pitcher;
        const g = record.pitcherGame;
        g.innings = p.innings || outsToIP(Number(p.outs)||0) || '0.0';
        g.k = Math.max(0, Number(p.k) || 0);
        g.bb = Math.max(0, Number(p.bb) || 0);
        g.h = Math.max(0, Number(p.h) || 0);
        g.hbp = Math.max(0, Number(p.hbp) || 0);
        g.r = Math.max(0, Number(p.r) || 0);
        g.er = Math.min(g.r, Math.max(0, Number(p.er) || 0));
        const pitchCount = Math.max(0, Number(p.pitchCount) || 0);
        g.pitchTens = Math.floor(Math.min(159, pitchCount) / 10);
        g.pitchOnes = Math.min(159, pitchCount) % 10;
        g.cg = Boolean(Number(p.cg) || p.cg);
        g.sho = Boolean(Number(p.sho) || p.sho);
        g.hld = Boolean(Number(p.hld) || p.hld);
        g.sv = Boolean(Number(p.sv) || p.sv);
        g.bsv = Boolean(Number(p.bsv) || p.bsv);
        g.decision = Number(p.w)>0 ? 'W' : Number(p.l)>0 ? 'L' : 'ND';
        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;
        record.committedStats = derivePitcherGame(g);
      }

      return record;
    }

    async function syncInternationalTournamentGames(player, onProgress = null) {
      if (playerScope(player) !== 'international') return [];
      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };
      const competition = playerSpecialCompetition(player);
      const year = Number(player.externalYear) || CURRENT_YEAR;
      const team = internationalTeam(player);

      report(58, '正在搜尋本屆每場出賽資料…');
      const data = await baseballRequest('international-player-games', {
        competition,
        year,
        team,
        playerId: String(player.externalPlayerId || ''),
        playerName: String(player.externalOfficialName || player.name || '').trim()
      });
      const games = Array.isArray(data?.games) ? data.games : [];
      report(82, `找到 ${games.length} 場出賽，正在寫入單場戰績…`);

      let saved = 0;
      for (const game of games) {
        const record = internationalGameRecordFromRemote(player, game);
        if (!record) continue;
        const existing = await idbGet(STORES.games, record.key);
        // 使用者自己手動建立的同日紀錄不覆蓋；只更新我們自己的官方國際賽匯入。
        if (existing && !existing.internationalOfficialImport) continue;
        await idbPut(STORES.games, record);
        saved += 1;
      }

      // 只有完整官方逐場 Box 才可拿來回填整屆總成績。
      // 新聞交叉驗證 fallback 只顯示單場，不參與賽事總成績加總。
      const completeGames = games.filter(game => !game?.partial);
      if (!player.internationalStatsFound && completeGames.length) {
        const hitterGames = completeGames.filter(game => game?.hitter);
        const pitcherGames = completeGames.filter(game => game?.pitcher);
        if (player.type === 'pitcher' && pitcherGames.length) {
          player.stats = internationalPitcherTotalsFromGames(pitcherGames);
          player.internationalStatsFound = true;
          player.internationalSource = '官方逐場 Box 合計';
          player.externalLastUpdatedAt = Date.now();
          await savePlayer(player);
        } else if (player.type === 'hitter' && hitterGames.length) {
          player.stats = internationalHitterTotalsFromGames(hitterGames);
          player.internationalStatsFound = true;
          player.internationalSource = '官方逐場 Box 合計';
          player.externalLastUpdatedAt = Date.now();
          await savePlayer(player);
        }
      }

      player.internationalGamesLastCheckedAt = Date.now();
      player.internationalGameCount = saved;
      await savePlayer(player);
      report(94, `單場戰績已更新｜${saved} 場`);
      return games;
    }

    function cpblLevelLabel(kindCode) {
      return kindCode === 'D' ? '二軍' : '一軍';
    }

    function promiseTimeout(promise, ms, message = '操作逾時') {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
      ]);
    }

    async function refreshCurrentRosterStatus() {
      const linked = players.filter(player => player.cpblAcnt);
      if (!linked.length) return;

      try {
        const data = await promiseTimeout(
          cpblRequest('current-rosters', {
            acnts: linked.map(player => player.cpblAcnt)
          }),
          4500,
          '目前一二軍狀態查詢逾時'
        );
        const rows = Array.isArray(data.players) ? data.players : [];
        const byAcnt = new Map(rows.filter(row => row?.ok && row.acnt).map(row => [String(row.acnt), row]));

        for (const player of linked) {
          const current = byAcnt.get(String(player.cpblAcnt));
          if (!current?.team) continue;

          player.cpblTeam = normalizeTeamName(current.team);
          if (current.teamCode) player.cpblTeamCode = String(current.teamCode);
          if (current.number) player.number = String(current.number);
          player.cpblCurrentLevel = current.level === 'D' ? 'D' : 'A';

          const roleChanged = repairStoredCpblPlayerType(player, current.position || '');
          player.cpblRosterUpdatedAt = Date.now();

          if (roleChanged && player.id === selectedPlayerId) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }
          await idbPut(STORES.players, player);
        }
      } catch (error) {
        console.warn('目前一二軍名單更新失敗', error);
      }
    }

    function pitcherInningsTextToOuts(value) {
      const text = String(value ?? '0.0');
      const m = text.match(/^(\d+)\.([012])$/);
      if (!m) return 0;
      return Number(m[1]) * 3 + Number(m[2]);
    }

    function applyCpblSeasonHistory(player, history, kindCode) {
      kindCode = kindCode === 'D' ? 'D' : 'A';
      player.cpblAvailableYears ||= { A: [], D: [] };
      player.cpblHistorySynced ||= { A: false, D: false };

      const sourceYears = Array.isArray(history?.years)
        ? history.years.map(Number).filter(year => Number.isInteger(year) && year >= 1990 && year <= CURRENT_YEAR).sort((a, b) => b - a)
        : [];

      const appliedYears = [];
      for (const season of history?.seasons || []) {
        const year = Number(season?.year);
        if (!Number.isInteger(year)) continue;
        try {
          applyCpblSeasonStatsToPlayer(player, season, year, kindCode);
          appliedYears.push(year);
        } catch (error) {
          console.warn(`略過 ${year} ${cpblLevelLabel(kindCode)}資料`, error);
        }
      }

      // 只有真的成功寫進 statsProfiles 的年份才提供給軍別／年份切換。
      player.cpblAvailableYears[kindCode] = [...new Set(appliedYears)].sort((a,b)=>b-a);
      player.cpblHistorySynced[kindCode] = sourceYears.length === 0 || appliedYears.length > 0;
    }

    function syncProgressTitleForPlayer(player = selectedPlayer()) {
      if (!player) return '正在同步資料';
      const scope = playerScope(player);
      if (scope === 'cpbl') return '正在同步中職資料';
      if (scope === 'international') return '正在同步國際賽資料';
      const provider = String(player.externalProvider || playerSpecialCompetition(player) || '').toUpperCase();
      if (provider === 'NPB') return '正在同步 NPB 日職資料';
      if (provider === 'KBO') return '正在同步 KBO 韓職資料';
      if (provider === 'MILB') return '正在同步 MiLB 小聯盟資料';
      if (provider === 'MLB') return '正在同步 MLB 資料';
      return '正在同步國外聯盟資料';
    }

    function setSyncProgress(percent, status, { error = false } = {}) {
      setSyncUiLocked(true);
      const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      if (els.syncProgressOverlay) els.syncProgressOverlay.classList.remove('hidden');
      if (els.syncProgressCard) els.syncProgressCard.classList.toggle('error', Boolean(error));
      if (els.syncProgressTitle) els.syncProgressTitle.textContent = syncProgressTitleForPlayer();
      if (els.syncProgressPercent) els.syncProgressPercent.textContent = `${value}%`;
      if (els.syncProgressStatus) els.syncProgressStatus.textContent = status || '';
      if (els.syncProgressBar) els.syncProgressBar.style.width = `${value}%`;
    }

    function hideSyncProgress() {
      els.syncProgressOverlay?.classList.add('hidden');
      els.syncProgressCard?.classList.remove('error');
      setSyncUiLocked(false);
    }

    async function finishSyncProgress(status = '同步完成') {
      setSyncProgress(100, status);
      await markSuccessfulSeasonSyncMeta();
      await new Promise(resolve => setTimeout(resolve, 420));
      hideSyncProgress();
    }

    async function syncPlayerCpblHistory(player, onProgress = null) {
      if (!player?.cpblAcnt) return;

      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };

      report(12, '正在連線中職官網…');
      report(24, '正在一次抓取一軍＋二軍歷年資料…');

      const data = await cpblRequest('season-histories', { acnt: player.cpblAcnt });
      const histories = data?.histories || {};
      const remoteErrors = data?.errors || {};
      const errors = [];

      report(76, '正在整理一軍＋二軍賽季資料…');

      for (const kindCode of ['A', 'D']) {
        const history = histories[kindCode];
        if (history) {
          applyCpblSeasonHistory(player, history, kindCode);
        } else {
          player.cpblAvailableYears ||= { A: [], D: [] };
          player.cpblHistorySynced ||= { A: false, D: false };
          player.cpblHistorySynced[kindCode] = false;
          errors.push(`${cpblLevelLabel(kindCode)}：${remoteErrors[kindCode] || '資料取得失敗'}`);
        }
      }

      const majorYears = availableSeasonYears(player, 'A');
      const minorYears = availableSeasonYears(player, 'D');

      if (histories.D?.years?.length && !minorYears.length) {
        errors.push('二軍：官網有資料，但前端寫入失敗');
      }

      report(92, '正在儲存球員資料…');
      await savePlayer(player);
      report(97, `一軍 ${majorYears.length} 季／二軍 ${minorYears.length} 季`);

      return { partialErrors: errors, majorYears, minorYears };
    }

    async function updatePlayerFromCpbl(player, silent = false, year = selectedSeason, kindCode = selectedLevel) {
      if (!player?.cpblAcnt) throw new Error('此球員尚未連結中職官網。');
      year = Math.max(1990, Math.floor(Number(year) || CURRENT_YEAR));
      kindCode = kindCode === 'D' ? 'D' : 'A';

      const data = await cpblRequest('season-stats', { acnt: player.cpblAcnt, year, kindCode });
      applyCpblSeasonStatsToPlayer(player, data.stats, year, kindCode);
      await savePlayer(player);
      if (!silent) setStatus(`已更新 ${year} 年中職官網${cpblLevelLabel(kindCode)}累積成績。`);
      return data;
    }

    function applyCpblSeasonStatsToPlayer(player, stats, year, kindCode = selectedLevel) {
      kindCode = kindCode === 'D' ? 'D' : 'A';
      const official = player.type === 'hitter' ? stats?.batting : stats?.pitching;
      if (!official) throw new Error(`${year} 年找不到此球員的${cpblLevelLabel(kindCode)}例行賽成績。`);

      let next;
      if (player.type === 'hitter') {
        next = { ...hitterDefaults(), ...official };
      } else {
        next = { ...pitcherDefaults(), ...official };
        next.outs = Number.isFinite(Number(official.outs))
          ? Number(official.outs)
          : pitcherInningsTextToOuts(official.innings);
        delete next.innings;

        const rawPitching = stats?.raw?.pitching || null;
        const officialEra = Number(rawPitching?.Era);
        const officialWhip = Number(rawPitching?.Whip);
        if (Number.isFinite(officialEra) && Number.isFinite(officialWhip)) {
          next.cpblEra = officialEra;
          next.cpblWhip = officialWhip;
          next.cpblRatesOfficial = true;
        } else {
          delete next.cpblEra;
          delete next.cpblWhip;
          delete next.cpblRatesOfficial;
        }
      }

      const cpblHitterRole = stats?.batting
        ? { ...hitterDefaults(), ...stats.batting }
        : null;
      let cpblPitcherRole = null;
      if (stats?.pitching) {
        cpblPitcherRole = { ...pitcherDefaults(), ...stats.pitching };
        cpblPitcherRole.outs = Number.isFinite(Number(stats.pitching.outs))
          ? Number(stats.pitching.outs)
          : pitcherInningsTextToOuts(stats.pitching.innings);
        delete cpblPitcherRole.innings;
      }
      storeRoleStatsProfile(player, year, kindCode, cpblHitterRole, cpblPitcherRole);

      const profiles = ensureStatsProfiles(player);
      const key = statsProfileKey(year, kindCode);
      profiles[key] = { ...next };
      if (player.id === selectedPlayerId && Number(year) === Number(selectedSeason) && kindCode === selectedLevel) {
        player.stats = { ...next };
      }

      player.cpblLastUpdatedByProfile ||= {};
      player.cpblLastUpdatedByProfile[key] = Date.now();
      player.cpblLastUpdatedAt = Date.now();
    }

    function currentOfficialDailyRolePair() {
      const pair = currentRecord?.externalRoleDaily;
      return pair && typeof pair === 'object'
        ? { hitter: pair.hitter || null, pitcher: pair.pitcher || null }
        : { hitter:null, pitcher:null };
    }

    function todayAvailableRoles(player) {
      const pair = currentOfficialDailyRolePair();
      const roles = [];
      if (dailyHitterRoleHasData(pair.hitter)) roles.push('hitter');
      if (dailyPitcherRoleHasData(pair.pitcher)) roles.push('pitcher');
      return roles.length ? roles : [player?.type === 'pitcher' ? 'pitcher' : 'hitter'];
    }

    function activeTodayRole(player) {
      const roles = todayAvailableRoles(player);
      if (roles.includes(todayRoleView)) return todayRoleView;
      if (roles.includes(player?.type)) return player.type;
      return roles[0] || (player?.type === 'pitcher' ? 'pitcher' : 'hitter');
    }

    function projectedPlayerStatsForRole(player, role) {
      if (!player) return {};
      role = role === 'pitcher' ? 'pitcher' : 'hitter';

      const pair = currentOfficialDailyRolePair();
      const hasOfficialDailyRole = role === 'pitcher'
        ? dailyPitcherRoleHasData(pair.pitcher)
        : dailyHitterRoleHasData(pair.hitter);

      // Official daily imports are already included in the synced season totals.
      // When viewing the player's secondary role, use that role's season profile
      // instead of treating the primary-role stats object as the wrong shape.
      if (hasOfficialDailyRole) {
        return seasonStatsForOutputRole(player, role);
      }

      if (role === player.type) return projectedPlayerStats(player);

      const originalType = player.type;
      const originalStats = player.stats;
      try {
        player.type = role;
        player.stats = seasonStatsForOutputRole(player, role);
        return projectedPlayerStats(player);
      } finally {
        player.type = originalType;
        player.stats = originalStats;
      }
    }

    async function applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite = true } = {}) {
      const hitter = daily?.hitter || null;
      const pitcher = daily?.pitcher || null;

      currentRecord.externalRoleDaily = {
        hitter: hitter ? { ...hitter } : null,
        pitcher: pitcher ? { ...pitcher } : null
      };

      if (hitter) {
        const list = Array.isArray(hitter.plateAppearances) ? hitter.plateAppearances : [];
        if (confirmHitterOverwrite && list.length && currentRecord.hitterPAs.length) {
          const overwrite = await showAppConfirm(
            '目前已有逐打席紀錄。\n要用官方資料覆蓋目前紀錄嗎？',
            {
              title:'覆蓋逐打席紀錄',
              confirmText:'覆蓋資料',
              cancelText:'保留目前資料',
              tone:'warning'
            }
          );
          if (!overwrite) return false;
        }

        currentRecord.hitterAppearance.mode = 'bat';
        if (list.length) {
          currentRecord.hitterPAs = list.map(pa => ({
            id:uid(),
            code:pa.code || 'OUT',
            position:pa.position || '',
            rbi:Number(pa.rbi) || 0,
            cpblOfficialAction:pa.officialAction || ''
          }));
        }

        currentRecord.cpblGameSummary = {
          runs:Math.max(0,Number(hitter.runs)||0),
          hits:Math.max(0,Number(hitter.hits)||0),
          errors:Math.max(0,Number(hitter.errors)||0),
          official:true
        };

        // Keep the official aggregate as a fallback when the source has no
        // verifiable plate-appearance sequence.
        currentRecord.internationalHitterGame = { ...hitter };
      }

      if (pitcher) {
        const g = currentRecord.pitcherGame;
        g.innings = pitcher.innings || outsToIP(Number(pitcher.outs)||0) || '0.0';
        g.k = Number(pitcher.k)||0;
        g.bb = Number(pitcher.bb)||0;
        g.h = Number(pitcher.h)||0;
        g.hbp = Number(pitcher.hbp)||0;
        g.r = Number(pitcher.r)||0;
        g.er = Math.min(g.r,Math.max(0,Number(pitcher.er)||0));
        const pitchCount = Math.max(0,Math.min(150,Number(pitcher.pitchCount)||0));
        g.pitchTens = Math.floor(pitchCount/10);
        g.pitchOnes = pitchCount>=150 ? 0 : pitchCount%10;
        g.cg = Boolean(Number(pitcher.cg)||pitcher.cg);
        g.sho = Boolean(Number(pitcher.sho)||pitcher.sho);
        g.hld = Boolean(Number(pitcher.hld)||pitcher.hld);
        g.sv = Boolean(Number(pitcher.sv)||pitcher.sv);
        g.bsv = Boolean(Number(pitcher.bsv)||pitcher.bsv);
        g.decision = Number(pitcher.w)>0 ? 'W' : Number(pitcher.l)>0 ? 'L'
          : (['W','L'].includes(pitcher.decision) ? pitcher.decision : 'ND');
        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;
        currentRecord.externalWalksCombined = Boolean(pitcher.walksCombined);
        standardizePitcherSpecialRecords(g);
      }

      return true;
    }

    async function importExternalDaily(player) {
      if (playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) {
        throw new Error('此球員尚未連結國外聯盟資料。');
      }

      const data = await baseballRequest('daily', {
        provider:isUsPlayer(player) ? 'US' : player.externalProvider,
        id:player.externalPlayerId,
        date:els.gameDate.value
      });
      const daily = data.daily;
      if (!daily?.found) {
        const requestedDate = String(els.gameDate.value || '').replaceAll('-', '/');
        const last = daily?.lastAppearance;
        if (last?.date) {
          const lastDate = String(last.date).replaceAll('-', '/');
          const lastLevel = String(last.leagueLevel || '');
          const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄。\n\n上一次出賽：${lastDate}${lastLevel ? `（${lastLevel}）` : ''}`;
          await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
          setStatus(`當日無出賽；上一次出賽為 ${lastDate}${lastLevel ? `（${lastLevel}）` : ''}。`);
          return false;
        }
        const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄，近期也找不到可確認的上一次出賽資料。`;
        await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
        setStatus('當日一軍、二軍皆無出賽資料。');
        return false;
      }

      currentRecord.externalLeagueLevel = String(daily.leagueLevel || '一軍');
      currentRecord.externalWalksCombined = false;
      currentRecord.externalRoleDaily = {
        hitter: daily.hitter ? { ...daily.hitter } : null,
        pitcher: daily.pitcher ? { ...daily.pitcher } : null
      };

      const localizedDailyName = String(daily.profile?.zhName || '').replace(/\s+/g, '');
      if (localizedDailyName && /[\u3400-\u9fff]/.test(localizedDailyName)) {
        const currentName = String(player.name || '').replace(/\s+/g, '');
        const preferredAliases = new Set(
          (Array.isArray(daily.profile?.zhNameAliases) ? daily.profile.zhNameAliases : [])
            .map(value => String(value || '').replace(/\s+/g, ''))
            .filter(Boolean)
        );
        if (!currentName
          || !/[\u3400-\u9fff]/.test(currentName)
          || localizedDailyName.includes(currentName)
          || (Boolean(daily.profile?.zhNamePreferred) && preferredAliases.has(currentName))) {
          player.name = localizedDailyName;
          player.externalOfficialName = daily.profile?.name || player.externalOfficialName || '';
          await savePlayer(player);
        }
      }

      if (daily.opponent) currentRecord.opponent = String(daily.opponent).trim();

      // If this date was already imported from an external provider, the old
      // record may contain a role that the corrected official parser no longer
      // reports. Clear only previously imported stale role data; manual records
      // that have not been imported remain untouched.
      if (currentRecord.externalReadOnlyImport) {
        if (!daily.hitter) {
          currentRecord.hitterPAs = [];
          currentRecord.internationalHitterGame = null;
          currentRecord.cpblGameSummary = {
            runs:0,hits:0,errors:0,official:false
          };
        }
        if (!daily.pitcher) {
          currentRecord.pitcherGame = {
            ...defaultGameRecord(player).pitcherGame
          };
        }
      }

      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });
      if (!appliedRoles) return false;

      currentRecord.externalReadOnlyImport = true;
      currentRecord.cpblReadOnlyImport = false;
      currentRecord.externalSource = player.externalProvider;
      currentRecord.externalImportedAt = Date.now();
      currentRecord.syncMeta = { source: officialDataSourceLabel(player), updatedAt: currentRecord.externalImportedAt };

      const importedHasHitter = dailyHitterRoleHasData(daily.hitter);
      const importedHasPitcher = dailyPitcherRoleHasData(daily.pitcher);
      if (importedHasPitcher && !importedHasHitter) todayRoleView = 'pitcher';
      else if (importedHasHitter && !importedHasPitcher) todayRoleView = 'hitter';

      currentRecord.committedStats = importedHasPitcher && !importedHasHitter
        ? derivePitcherGame(currentRecord.pitcherGame)
        : importedHasHitter
          ? deriveHitterGame(currentRecord.hitterPAs)
          : (player.type === 'hitter'
              ? deriveHitterGame(currentRecord.hitterPAs)
              : derivePitcherGame(currentRecord.pitcherGame));
      currentRecord.committedAt = Date.now();

      await saveRecord();
      renderAll();

      const noPa = importedHasHitter
        && !(Array.isArray(daily.hitter?.plateAppearances) && daily.hitter.plateAppearances.length);
      const sourceMode = String(daily.sourceMode || '');
      const levelLabel = String(daily.leagueLevel || '');
      const sourceLabel = `${overseasProviderLabel(player.externalProvider)}${levelLabel ? ` ${levelLabel}` : ''}`;
      const combinedNote = currentRecord.externalWalksCombined
        ? ' KBO Futures 官方 Box 僅提供四死球合計，戰報會以「四死球」標示。'
        : '';
      const roleNote = importedHasPitcher && !importedHasHitter
        ? ' 本場僅以投手身分出賽。'
        : importedHasHitter && !importedHasPitcher
          ? ' 本場以打者身分出賽。'
          : importedHasHitter && importedHasPitcher
            ? ' 本場同時有打擊與投球紀錄。'
            : '';
      setStatus(noPa
        ? sourceMode === 'eng-box'
          ? `已確認 ${els.gameDate.value} 有出賽並匯入 NPB 一軍官方英文 Box 彙總；日文詳細 Box 暫時無法讀取，所以逐打席未自動帶入。${roleNote}`
          : `已匯入 ${els.gameDate.value} 的 ${sourceLabel} 當日彙總；該來源未提供可解析的逐打席順序，可手動補逐打席。${roleNote}`
        : `已匯入 ${els.gameDate.value} 的 ${sourceLabel} 當日資料。${roleNote}${combinedNote}`);
      return true;
    }

    async function importCpblDaily(player) {
      if (!player?.cpblAcnt || !player?.cpblTeamCode) throw new Error('此球員尚未連結中職官網。');

      const gameYear = Number(els.gameDate.value?.slice(0, 4)) || CURRENT_YEAR;
      const levels = ['A','D'];
      let daily = null;
      let kindCode = 'A';
      let lastReason = '';

      for (const level of levels) {
        const knownYears = player?.cpblAvailableYears?.[level];
        if (Array.isArray(knownYears) && knownYears.length && !knownYears.includes(gameYear)) continue;

        try {
          const data = await cpblRequest('daily', {
            acnt: player.cpblAcnt,
            date: els.gameDate.value,
            teamCode: player.cpblTeamCode,
            kindCode: level
          });
          if (data?.daily?.found) {
            daily = data.daily;
            kindCode = level;
            break;
          }
          lastReason = data?.daily?.reason || lastReason;
        } catch (error) {
          lastReason = error?.message || lastReason;
        }
      }

      if (!daily?.found) {
        await showAppAlert(
          `${els.gameDate.value.replaceAll('-', '/')} 一軍、二軍都找不到此球員的出賽資料。`,
          { title:'當日無出賽', tone:'warning' }
        );
        setStatus(lastReason || '當日一軍、二軍皆無出賽資料。');
        return false;
      }

      // 找到哪個軍別就自動切到該軍別的本機紀錄，不需使用者手動選。
      if (selectedLevel !== kindCode) {
        persistActiveStatsProfile(player);
        selectedLevel = kindCode;
        const years = availableSeasonYears(player, kindCode);
        selectedSeason = years.includes(gameYear) ? gameYear : (years[0] || gameYear);
        activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
        await loadRecord();
      }
      currentRecord.level = kindCode;

      if (daily.game?.opponent) currentRecord.opponent = normalizeTeamName(daily.game.opponent);

      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });
      if (!appliedRoles) return false;

      const isToday = els.gameDate.value === localISODate();
      currentRecord.cpblReadOnlyImport = !isToday;

      if (isToday) {
        try {
          await updatePlayerFromCpbl(player, true, gameYear, kindCode);
          currentRecord.committedStats = player.type === 'hitter'
            ? deriveHitterGame(currentRecord.hitterPAs)
            : derivePitcherGame(currentRecord.pitcherGame);
          currentRecord.committedAt = Date.now();
        } catch (error) {
          console.warn('CPBL cumulative sync after daily import failed', error);
        }
      } else {
        currentRecord.committedStats = player.type === 'hitter'
          ? deriveHitterGame(currentRecord.hitterPAs)
          : derivePitcherGame(currentRecord.pitcherGame);
        currentRecord.committedAt = Date.now();
      }

      currentRecord.cpblImportedAt = Date.now();
      currentRecord.syncMeta = { source: officialDataSourceLabel(player), updatedAt: currentRecord.cpblImportedAt };
      await saveRecord();
      renderAll();

      const levelLabel = kindCode === 'D' ? '二軍' : '一軍';
      setStatus(isToday
        ? `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料並同步今日累積數據。`
        : `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料；歷史日期不會寫入球員累積數據。`);
      return true;
    }

    function uid() {
      return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function localISODate() {
      const d = new Date();
      const offset = d.getTimezoneOffset();
      return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
    }

    function openDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORES.players)) {
            database.createObjectStore(STORES.players, { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains(STORES.photos)) {
            database.createObjectStore(STORES.photos, { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains(STORES.games)) {
            database.createObjectStore(STORES.games, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    function idbGetAll(storeName) {
      return new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    function idbGet(storeName, key) {
      return new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    function idbPut(storeName, value) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => resolve(value);
        tx.onerror = () => reject(tx.error);
      });
    }

    function idbDelete(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }

    function selectedPlayer() {
      return players.find(p => p.id === selectedPlayerId) || null;
    }

    function supportsLeagueLevelTabs(player) {
      if (!player) return false;
      if (playerScope(player) === 'cpbl') return true;
      if (playerScope(player) !== 'overseas') return false;
      const provider = String(player.externalProvider || '').toUpperCase();
      return provider === 'NPB' || provider === 'KBO';
    }

    function supportsUsDualRoleTabs(player, year = selectedSeason) {
      if (!player || playerScope(player) !== 'overseas' || !isUsPlayer(player)) return false;
      const pair = roleStatsPair(player, year, 'A');
      return hitterRoleHasData(pair?.hitter) && pitcherRoleHasData(pair?.pitcher);
    }

    function selectedStatsTabLevel() {
      return selectedTab === 'minor' ? 'D' : 'A';
    }

    function statsProfileKey(year = selectedSeason, level = selectedLevel) {
      const safeYear = Math.max(1990, Math.floor(Number(year) || CURRENT_YEAR));
      const safeLevel = level === 'D' ? 'D' : 'A';
      return `${safeYear}:${safeLevel}`;
    }

    function emptyStatsForPlayer(player) {
      return player?.type === 'pitcher' ? pitcherDefaults() : hitterDefaults();
    }

    function ensureStatsProfiles(player) {
      if (!player.statsProfiles || typeof player.statsProfiles !== 'object' || Array.isArray(player.statsProfiles)) {
        player.statsProfiles = {};
      }

      // 舊版只有 player.stats：第一次升級時視為「今年一軍」保留。
      if (!Object.keys(player.statsProfiles).length && player.stats && typeof player.stats === 'object') {
        player.statsProfiles[statsProfileKey(CURRENT_YEAR, 'A')] = { ...player.stats };
      }
      return player.statsProfiles;
    }

    function hasStatsProfile(player, year = selectedSeason, level = selectedLevel) {
      return Boolean(ensureStatsProfiles(player)[statsProfileKey(year, level)]);
    }

    function activatePlayerStatsProfile(player, year = selectedSeason, level = selectedLevel) {
      const profiles = ensureStatsProfiles(player);
      const key = statsProfileKey(year, level);
      player.stats = { ...emptyStatsForPlayer(player), ...(profiles[key] || {}) };
      return player.stats;
    }

    function persistActiveStatsProfile(player) {
      if (!player || player.id !== selectedPlayerId) return;
      const profiles = ensureStatsProfiles(player);
      profiles[statsProfileKey()] = { ...player.stats };
    }

    function profileYearsForLevel(player, level = selectedLevel) {
      const profiles = ensureStatsProfiles(player);
      return Object.keys(profiles)
        .map(key => {
          const [yearText, levelCode] = String(key).split(':');
          return levelCode === level ? Number(yearText) : NaN;
        })
        .filter(year => Number.isInteger(year) && year >= 1990 && year <= CURRENT_YEAR)
        .sort((a, b) => b - a);
    }

    function availableSeasonYears(player, level = selectedLevel) {
      if (isUsPlayer(player)) {
        const years = usCareerEntries(player)
          .map(entry => Number(entry.year))
          .filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100);
        if (years.length) return [...new Set(years)].sort((a,b)=>b-a);
      }

      if (playerScope(player) !== 'cpbl') {
        if (supportsLeagueLevelTabs(player)) {
          const remoteByLevel = Array.isArray(player?.externalAvailableYearsByLevel?.[level])
            ? player.externalAvailableYearsByLevel[level].map(Number).filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100)
            : [];
          const provider = String(player?.externalProvider || '').toUpperCase();

          if (level === 'D' && ['NPB','KBO'].includes(provider) && player?.externalLevelYearsCheckedAt?.D) {
            return [...new Set(remoteByLevel)].sort((a,b)=>b-a);
          }

          const localByLevel = profileYearsForLevel(player, level);
          const combined = [...new Set([...remoteByLevel, ...localByLevel])].sort((a,b)=>b-a);
          if (combined.length) return combined;

          if (level === 'A' && Array.isArray(player?.externalAvailableYears)) {
            const linkedYears = player.externalAvailableYears.map(Number).filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100);
            if (linkedYears.length) return [...new Set(linkedYears)].sort((a,b)=>b-a);
          }
        } else {
          const linkedYears = playerScope(player) === 'overseas' && Array.isArray(player?.externalAvailableYears)
            ? player.externalAvailableYears.map(Number).filter(y => Number.isInteger(y) && y >= 1900 && y <= 2100)
            : [];
          if (linkedYears.length) return [...new Set(linkedYears)].sort((a,b)=>b-a);
        }
        const year = Math.floor(Number(player?.externalYear) || CURRENT_YEAR);
        return [Math.min(2100, Math.max(1900, year))];
      }
      const official = player?.cpblAvailableYears?.[level];
      if (Array.isArray(official)) {
        return [...new Set(official.map(Number).filter(year => Number.isInteger(year) && year >= 1990 && year <= CURRENT_YEAR))]
          .sort((a, b) => b - a);
      }
      const local = profileYearsForLevel(player, level);
      return local.length ? local : [CURRENT_YEAR];
    }

    function seasonOptionsHtml(player) {
      if (isUsPlayer(player)) {
        const entries = usCareerEntries(player);
        if (!entries.length) return '<option value="">同步後顯示年份／球隊／層級</option>';
        const activeKey = String(player.usSelectedCareerKey || entries[0]?.key || '');
        return entries.map(entry =>
          `<option value="${escapeAttr(entry.key)}" ${String(entry.key) === activeKey ? 'selected' : ''}>${escapeHtml(usCareerOptionLabel(entry))}</option>`
        ).join('');
      }
      const years = availableSeasonYears(player, selectedLevel);
      if (!years.length) return '<option value="">無出賽資料</option>';
      return years.map(year =>
        `<option value="${year}" ${year === selectedSeason ? 'selected' : ''}>${year}</option>`
      ).join('');
    }

    function reportPlayerName(player) {
      const base = String(player?.name || '').trim();
      const scope = playerScope(player);
      if (scope === 'overseas') {
        return currentRecord?.externalLeagueLevel === '二軍' ? `${base}(二軍)` : base;
      }
      if (scope !== 'cpbl') return base;
      return (currentRecord?.level || selectedLevel) === 'D' ? `${base}(二軍)` : base;
    }

    function ensurePhotoTransforms(player) {
      if (!player.photoTransforms || typeof player.photoTransforms !== 'object') player.photoTransforms = {};
      return player.photoTransforms;
    }

    function getPhotoTransform(player, photoId) {
      const transforms = ensurePhotoTransforms(player);
      if (!transforms[photoId]) transforms[photoId] = { x: 0, y: 0, scale: 1 };
      transforms[photoId].x = Number(transforms[photoId].x) || 0;
      transforms[photoId].y = Number(transforms[photoId].y) || 0;
      transforms[photoId].scale = clamp(transforms[photoId].scale ?? 1, 1, 3);
      return transforms[photoId];
    }

    function playerPhotos(player) {
      return photos.filter(photo => photo.playerId === player.id);
    }

    function gameKey() {
      return `${els.gameDate.value}:${selectedPlayerId}:${selectedLevel}`;
    }

    function legacyGameKey() {
      return `${els.gameDate.value}:${selectedPlayerId}`;
    }

    function defaultGameRecord(player) {
      return {
        key: gameKey(),
        playerId: player.id,
        date: els.gameDate.value,
        level: selectedLevel,
        opponent: '',
        hitterPAs: [],
        hitterAppearance: {
          mode: 'bat',
          inning: '1',
          half: 'top',
          battingOrder: '1',
          continueDefense: false,
          position: '游擊'
        },
        pitcherGame: {
          innings: '0.0', k: 0, bb: 0, h: 0, hbp: 0, otherReach: 0, r: 0, er: 0,
          pitchTens: 0, pitchOnes: 0,
          cg: false, sho: false, noWalkHbp: false,
          hld: false, sv: false, bsv: false, rainCalled: false,
          decision: 'ND', result: 'ND'
        },
        cpblGameSummary: {
          runs: 0,
          hits: 0,
          errors: 0,
          official: false
        },
        committedStats: null,
        committedAt: null,
        cpblReadOnlyImport: false,
        externalReadOnlyImport: false,
        externalSource: '',
        externalLeagueLevel: '',
        externalWalksCombined: false,
        externalRoleDaily: null,
        updatedAt: Date.now()
      };
    }

    function mergeStats(base, defaults) {
      return { ...defaults(), ...(base || {}) };
    }

    async function loadRecord() {
      const player = selectedPlayer();
      if (!player) {
        currentRecord = null;
        return;
      }
      let stored = await idbGet(STORES.games, gameKey());
      // 一軍相容舊版未帶層級的日期紀錄；讀到後會在下次儲存轉成新 key。
      if (!stored && selectedLevel === 'A') stored = await idbGet(STORES.games, legacyGameKey());

      // CPBL 軍別不再由使用者手動切換：目前軍別沒紀錄時，自動讀另一軍別。
      if (!stored && playerScope(player) === 'cpbl') {
        const otherLevel = selectedLevel === 'D' ? 'A' : 'D';
        stored = await idbGet(STORES.games, `${els.gameDate.value}:${selectedPlayerId}:${otherLevel}`);
        if (!stored && otherLevel === 'A') stored = await idbGet(STORES.games, legacyGameKey());
        if (stored) {
          selectedLevel = otherLevel;
          const gameYear = Number(els.gameDate.value?.slice(0,4)) || CURRENT_YEAR;
          const years = availableSeasonYears(player, selectedLevel);
          selectedSeason = years.includes(gameYear) ? gameYear : (years[0] || gameYear);
          activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
        }
      }

      currentRecord = stored || defaultGameRecord(player);
      currentRecord.key = gameKey();
      currentRecord.playerId = player.id;
      currentRecord.date = els.gameDate.value;
      currentRecord.level = selectedLevel;
      currentRecord.opponent = normalizeTeamName(currentRecord.opponent || '');
      currentRecord.hitterPAs ||= [];
      currentRecord.hitterAppearance = {
        ...defaultGameRecord(player).hitterAppearance,
        ...(currentRecord.hitterAppearance || {})
      };
      if (!['bat', 'runner', 'defense'].includes(currentRecord.hitterAppearance.mode)) currentRecord.hitterAppearance.mode = 'bat';
      currentRecord.hitterAppearance.inning = String(Math.max(1, Math.floor(Number(currentRecord.hitterAppearance.inning) || 1)));
      currentRecord.hitterAppearance.half = currentRecord.hitterAppearance.half === 'bottom' ? 'bottom' : 'top';
      currentRecord.hitterAppearance.battingOrder = String(Math.min(9, Math.max(1, Math.floor(Number(currentRecord.hitterAppearance.battingOrder) || 1))));
      currentRecord.hitterAppearance.continueDefense = Boolean(currentRecord.hitterAppearance.continueDefense);
      currentRecord.pitcherGame = {
        ...defaultGameRecord(player).pitcherGame,
        ...(currentRecord.pitcherGame || {})
      };
      currentRecord.cpblGameSummary = {
        ...defaultGameRecord(player).cpblGameSummary,
        ...(currentRecord.cpblGameSummary || {})
      };
      currentRecord.externalLeagueLevel = String(currentRecord.externalLeagueLevel || '');
      currentRecord.externalWalksCombined = Boolean(currentRecord.externalWalksCombined);
      currentRecord.externalRoleDaily = currentRecord.externalRoleDaily || null;
      if (!['SV','HLD','W','L','ND'].includes(currentRecord.pitcherGame.result)) {
        currentRecord.pitcherGame.result = currentRecord.pitcherGame.sv ? 'SV'
          : currentRecord.pitcherGame.hld ? 'HLD'
          : ['W','L','ND'].includes(currentRecord.pitcherGame.decision) ? currentRecord.pitcherGame.decision
          : 'ND';
      }
      currentRecord.pitcherGame.bsv = Boolean(currentRecord.pitcherGame.bsv);
      if (['SV','HLD'].includes(currentRecord.pitcherGame.result)) currentRecord.pitcherGame.bsv = false;
      currentRecord.pitcherGame.r = Math.max(0, Number(currentRecord.pitcherGame.r) || 0);
      currentRecord.pitcherGame.er = Math.min(
        currentRecord.pitcherGame.r,
        Math.max(0, Number(currentRecord.pitcherGame.er) || 0)
      );
    }

    async function saveRecord() {
      if (!currentRecord) return;
      currentRecord.updatedAt = Date.now();
      await idbPut(STORES.games, currentRecord);
    }

    async function savePlayer(player) {
      if (player?.id === selectedPlayerId && (playerScope(player) === 'cpbl' || supportsLeagueLevelTabs(player))) persistActiveStatsProfile(player);
      player.updatedAt = Date.now();
      await idbPut(STORES.players, player);
      const index = players.findIndex(p => p.id === player.id);
      if (index >= 0) players[index] = player;
      else players.push(player);
    }

    function numberOptions(max, selected = 0) {
      let html = '';
      for (let i = 0; i <= max; i++) html += `<option value="${i}" ${Number(selected) === i ? 'selected' : ''}>${i}</option>`;
      return html;
    }

    const DEFENSIVE_POSITIONS = ['投手','捕手','一壘','二壘','三壘','游擊','左外野','中外野','右外野','DH'];

    function ensureHitterAppearance() {
      if (!currentRecord) return null;

      // 必須維持同一個物件參照。
      // 表單事件與 Canvas 都要讀寫同一份 hitterAppearance，
      // 不能每次呼叫都建立新物件，否則左側欄位會改到舊物件、右側預覽卻讀到新物件。
      if (!currentRecord.hitterAppearance || typeof currentRecord.hitterAppearance !== 'object') {
        currentRecord.hitterAppearance = {};
      }

      const appearance = currentRecord.hitterAppearance;
      if (!['bat', 'runner', 'defense'].includes(appearance.mode)) appearance.mode = 'bat';
      if (!appearance.inning) appearance.inning = '1';
      appearance.inning = String(appearance.inning);
      if (!['top', 'bottom'].includes(appearance.half)) appearance.half = 'top';
      if (!appearance.battingOrder) appearance.battingOrder = '1';
      appearance.battingOrder = String(appearance.battingOrder);
      if (typeof appearance.continueDefense !== 'boolean') appearance.continueDefense = false;
      if (!DEFENSIVE_POSITIONS.includes(appearance.position)) appearance.position = '游擊';

      return appearance;
    }

    function substitutionInningOptions(selected = '1') {
      const value = String(selected || '1');
      const preset = Array.from({ length: 12 }, (_, i) => String(i + 1));
      return [
        ...preset.map(item => `<option value="${item}" ${value === item ? 'selected' : ''}>${item}</option>`),
        `<option value="__other__" ${preset.includes(value) ? '' : 'selected'}>其他</option>`
      ].join('');
    }

    function battingOrderOptions(selected = '1') {
      const value = String(selected || '1');
      return Array.from({ length: 9 }, (_, i) => {
        const order = String(i + 1);
        return `<option value="${order}" ${value === order ? 'selected' : ''}>第${order}棒</option>`;
      }).join('');
    }

    function defensivePositionOptions(selected = '游擊') {
      return DEFENSIVE_POSITIONS.map(position => `<option value="${position}" ${selected === position ? 'selected' : ''}>${position}</option>`).join('');
    }

    function pitcherInningsPresetValues() {
      const values = ['0.0', '0.1', '0.2'];
      for (let inning = 1; inning <= 11; inning++) {
        values.push(`${inning}.0`, `${inning}.1`, `${inning}.2`);
      }
      values.push('12.0');
      return values;
    }

    function pitcherInningsOptions(selected = '0.0') {
      const value = String(selected ?? '0.0');
      const preset = pitcherInningsPresetValues();
      return [
        ...preset.map(item => `<option value="${item}" ${value === item ? 'selected' : ''}>${item}局</option>`),
        `<option value="__other__" ${preset.includes(value) ? '' : 'selected'}>其他</option>`
      ].join('');
    }

    function isPresetPitcherInnings(value) {
      return pitcherInningsPresetValues().includes(String(value));
    }

    function getPitcherInningsFromUI() {
      const preset = document.getElementById('pInnings');
      if (!preset) return '0.0';
      if (preset.value !== '__other__') return preset.value;
      return document.getElementById('pInningsOther')?.value.trim() || '';
    }

    function ipToOuts(ip) {
      const match = String(ip).trim().match(/^(\d+)(?:\.([012]))?$/);
      if (!match) return null;
      return Number(match[1]) * 3 + Number(match[2] || 0);
    }

    function outsToIP(outs) {
      const safe = Math.max(0, Math.round(Number(outs) || 0));
      return `${Math.floor(safe / 3)}.${safe % 3}`;
    }

    function fmtBatRate(value) {
      if (!Number.isFinite(value)) return '.000';
      const s = value.toFixed(3);
      return value < 1 ? s.replace(/^0/, '') : s;
    }

    function fmtTwo(value) {
      return Number.isFinite(value) ? value.toFixed(2) : '0.00';
    }

    function hitterDerived(stats) {
      const s = mergeStats(stats, hitterDefaults);
      const hits = s.single + s.double + s.triple + s.hr;
      const tb = s.single + s.double * 2 + s.triple * 3 + s.hr * 4;
      const avg = s.ab ? hits / s.ab : 0;
      const obpDen = s.ab + s.bb + s.ibb + s.hbp + s.sacFly;
      const obp = obpDen ? (hits + s.bb + s.ibb + s.hbp) / obpDen : 0;
      const slg = s.ab ? tb / s.ab : 0;
      return { hits, tb, avg, obp, slg };
    }

    function pitcherDerived(stats) {
      const s = mergeStats(stats, pitcherDefaults);
      const innings = s.outs / 3;
      const computedWhip = innings ? (s.h + s.bb) / innings : 0;
      const computedEra = innings ? (s.er * 9) / innings : 0;
      const officialWhip = Number(s.cpblWhip);
      const officialEra = Number(s.cpblEra);
      const truncateTwo = value => Math.trunc(value * 100) / 100;
      const useOfficial = s.cpblRatesOfficial === true;
      return {
        whip: useOfficial && Number.isFinite(officialWhip) ? truncateTwo(officialWhip) : computedWhip,
        era: useOfficial && Number.isFinite(officialEra) ? truncateTwo(officialEra) : computedEra
      };
    }

    function emptyHitterContribution() {
      return { pa: 0, ab: 0, rbi: 0, single: 0, double: 0, triple: 0, hr: 0, sacBunt: 0, sacFly: 0, bb: 0, ibb: 0, hbp: 0 };
    }

    function deriveHitterGame(pas) {
      const out = emptyHitterContribution();
      for (const pa of pas || []) {
        out.rbi += Number(pa.rbi) || 0;
        switch (pa.code) {
          case '1B': out.pa++; out.ab++; out.single++; break;
          case '2B': out.pa++; out.ab++; out.double++; break;
          case '3B': out.pa++; out.ab++; out.triple++; break;
          case 'HR': out.pa++; out.ab++; out.hr++; break;
          case 'BB': out.pa++; out.bb++; break;
          case 'IBB': out.pa++; out.ibb++; break;
          case 'HBP': out.pa++; out.hbp++; break;
          case 'CI': out.pa++; break;
          case 'SH': out.pa++; out.sacBunt++; break;
          case 'SF': out.pa++; out.sacFly++; break;
          case 'FC':
          case 'E':
          case 'OBS':
          case 'K':
          case 'KREACH':
          case 'GO':
          case 'FO':
          case 'DP':
          case 'TP':
          case 'INT':
          case 'OUT':
            out.pa++; out.ab++; break;
        }
      }
      return out;
    }

    function pitcherResult(game) {
      if (['SV','HLD','W','L','ND'].includes(game?.result)) return game.result;
      if (game?.sv) return 'SV';
      if (game?.hld) return 'HLD';
      return ['W','L','ND'].includes(game?.decision) ? game.decision : 'ND';
    }

    function derivePitcherGame(game) {
      const outs = ipToOuts(game.innings) || 0;
      const result = pitcherResult(game);
      return {
        cg: game.cg ? 1 : 0,
        sho: game.sho ? 1 : 0,
        noWalkHbp: game.noWalkHbp ? 1 : 0,
        w: result === 'W' ? 1 : 0,
        l: result === 'L' ? 1 : 0,
        sv: result === 'SV' ? 1 : 0,
        bsv: game.bsv ? 1 : 0,
        hld: result === 'HLD' ? 1 : 0,
        outs,
        h: Number(game.h) || 0,
        bb: Number(game.bb) || 0,
        hbp: Number(game.hbp) || 0,
        k: Number(game.k) || 0,
        er: Number(game.er) || 0
      };
    }

    function addDelta(base, current, previous, keys) {
      const result = { ...base };
      for (const key of keys) {
        result[key] = Math.max(0, (Number(base[key]) || 0) + (Number(current[key]) || 0) - (Number(previous?.[key]) || 0));
      }
      return result;
    }

    function projectedPlayerStats(player) {
      if (!currentRecord) return player.stats;
      // 官方匯入的單場資料只呈現該場，不重複加到已同步的累積賽季資料。
      if (currentRecord.cpblReadOnlyImport || currentRecord.externalReadOnlyImport) return player.stats;
      if (player.type === 'hitter') {
        const base = mergeStats(player.stats, hitterDefaults);
        const appearance = ensureHitterAppearance();
        const current = appearance.mode === 'bat' ? deriveHitterGame(currentRecord.hitterPAs) : emptyHitterContribution();
        return addDelta(base, current, currentRecord.committedStats, Object.keys(emptyHitterContribution()));
      }
      const base = mergeStats(player.stats, pitcherDefaults);
      const current = derivePitcherGame(currentRecord.pitcherGame);
      const keys = Object.keys(current);
      const projected = addDelta(base, current, currentRecord.committedStats, keys);
      const hasLocalDelta = keys.some(key =>
        (Number(current[key]) || 0) !== (Number(currentRecord.committedStats?.[key]) || 0)
      );
      if (hasLocalDelta) {
        delete projected.cpblEra;
        delete projected.cpblWhip;
        delete projected.cpblRatesOfficial;
      }
      return projected;
    }

    function paPositionFromText(raw, fallback = '') {
      const normalizePos = value => {
        const key = String(value || '').trim().charAt(0);
        const map = { '投':'投', '捕':'捕', '一':'一', '二':'二', '三':'三', '遊':'游', '游':'游', '左':'左', '中':'中', '右':'右' };
        return map[key] || '';
      };
      const fallbackPos = normalizePos(fallback);
      if (fallbackPos) return fallbackPos;
    
      const text = String(raw || '').normalize('NFKC');
      const tests = [
        ['投', /投手|(?:^|[\s,，、])投(?:ゴロ|飛|直|失|安)|\bpitcher\b|투수/i],
        ['捕', /捕手|(?:^|[\s,，、])捕(?:ゴロ|飛|直|失|安)|\bcatcher\b|포수/i],
        ['一', /一塁手|(?:^|[\s,，、])一(?:ゴロ|飛|直|失|安)|\bfirst baseman\b|1루수/i],
        ['二', /二塁手|(?:^|[\s,，、])二(?:ゴロ|飛|直|失|安)|\bsecond baseman\b|2루수/i],
        ['三', /三塁手|(?:^|[\s,，、])三(?:ゴロ|飛|直|失|安)|\bthird baseman\b|3루수/i],
        ['游', /遊撃手|游撃手|(?:^|[\s,，、])(?:遊|游)(?:ゴロ|飛|直|失|安)|\bshortstop\b|유격수/i],
        ['左', /左翼手|(?:^|[\s,，、])左(?:飛|直|失|安)|\bleft fielder\b|좌익수/i],
        ['中', /中堅手|(?:^|[\s,，、])中(?:飛|直|失|安)|\bcenter fielder\b|중견수/i],
        ['右', /右翼手|(?:^|[\s,，、])右(?:飛|直|失|安)|\bright fielder\b|우익수/i]
      ];
      let bestPos = '';
      let bestIndex = Infinity;
      for (const [pos, re] of tests) {
        const match = re.exec(text);
        if (match && match.index < bestIndex) {
          bestIndex = match.index;
          bestPos = pos;
        }
      }
      return bestPos;
    }

    function paHitDirectionFromText(raw) {
      const text = String(raw || '').normalize('NFKC');
      const tests = [
        ['左中', /左中|left[\s-]?center|좌중간/i],
        ['右中', /右中|right[\s-]?center|우중간/i],
        ['左', /(?:^|[\s,，、])左(?:前|線|越)?(?:安|2|3|二|三|本)|\bleft field\b|좌전|좌익/i],
        ['中', /(?:^|[\s,，、])中(?:前|越)?(?:安|2|3|二|三|本)|\bcenter field\b|중전|중견/i],
        ['右', /(?:^|[\s,，、])右(?:前|線|越)?(?:安|2|3|二|三|本)|\bright field\b|우전|우익/i]
      ];
      let best = '';
      let bestIndex = Infinity;
      for (const [label, re] of tests) {
        const match = re.exec(text);
        if (match && match.index < bestIndex) {
          bestIndex = match.index;
          best = label;
        }
      }
      return best;
    }

    function localizePaAction(pa) {
      const code = String(pa?.code || 'OUT').toUpperCase();
      const raw = String(pa?.cpblOfficialAction || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
      const compact = raw.replace(/\s+/g, '');
      const lower = raw.toLowerCase();
    
      const preserved = new Set([
        '內安','場安','內二','場二','內三','場三','全打','內全',
        '四壞','故意四壞','死球','野選','失誤','投失','捕失','一失','二失','三失','游失','左失','中失','右失','雙誤',
        '礙打','不死三振','礙跑','三振','滾地出局','飛球出局','內飛','界飛','雙殺','三殺',
        '犧牲短打','犧短','犧短誤','犧選','犧選誤','犧牲高飛','犧飛','界犧飛','犧飛誤',
        '礙守','裁決','違規','觸球','觸傳球','三呎線'
      ]);
      if (preserved.has(raw)) return raw;

      // MLB may classify a strikeout + caught-stealing sequence as strikeout_double_play.
      // For batter-facing PA reports, the batter result is still a strikeout, not a GIDP.
      if (code === 'DP' && /三振|strike\s*out|strikeout|called\s+out\s+on\s+strikes|struck\s+out|삼진/i.test(raw)) return '三振';
    
      const position = paPositionFromText(raw, pa?.position || '');
      const direction = paHitDirectionFromText(raw);
      const foul = /邪飛|ファウル(?:フライ|飛|アウト)|foul(?:\s+territory)?(?:\s+fly|\s+out|\s+pop)|파울(?:플라이|뜬공|아웃)/i.test(raw);
      const lineDrive = /直(?:球|飛)?|ライナー|line(?:s|d)?\s+out|lineout|직선타/i.test(raw);
      const infieldFly = /内飛|內飛|infield\s+fly|내야\s*(?:플라이|뜬공)/i.test(raw);
    
      if (code === '1B') {
        // Preserve the field/direction when the source provides it: 投安、游安、左安、中安、右安…
        if (position) return `${position}安`;
        if (direction) return `${direction}安`;
        return '一安';
      }
      if (code === '2B') return direction ? `${direction}二` : '二安';
      if (code === '3B') return direction ? `${direction}三` : '三安';
      if (code === 'HR') return direction ? `${direction}本` : '全壘打';
      if (code === 'BB') return '四壞';
      if (code === 'IBB') return '故意四壞';
      if (code === 'HBP') return '死球';
      if (code === 'CI') return '礙打';
      if (code === 'FC') return '野選';
      if (code === 'E') return position ? `${position}失` : '失誤';
      if (code === 'OBS') return '礙跑';
      if (code === 'K') return '三振';
      if (code === 'KREACH') return '不死三振';
      if (code === 'DP') return '雙殺';
      if (code === 'TP') return '三殺';
      if (code === 'SH') return '犧短';
      if (code === 'SF') return foul ? '界犧飛' : '犧飛';
      if (code === 'INT') return '礙守';
      if (code === 'GO') return position ? `${position}滾` : '滾地出局';
      if (code === 'FO') {
        if (foul) return '界飛';
        if (infieldFly) return '內飛';
        if (lineDrive && position) return `${position}直`;
        return position ? `${position}飛` : '飛球出局';
      }
      if (code === 'OUT') {
        if (/三振|strike\s*out|strikeout|삼진/i.test(raw)) return '三振';
        if (/併打|double\s*play|병살/i.test(raw)) return '雙殺';
        if (/ゴロ|ground(?:s|ed)?\s*out|groundout|땅볼/i.test(raw)) return position ? `${position}滾` : '滾地出局';
        if (foul) return '界飛';
        if (/飛|フライ|fly(?:\s*out)?|pop(?:s|ped)?\s*out|뜬공|플라이/i.test(raw)) return position ? `${position}飛` : '飛球出局';
        return '出局';
      }
    
      return raw || code;
    }

    function paLabel(pa) {
      const official = String(pa?.cpblOfficialAction || '').trim();
      if (official) return localizePaAction(pa);
      if (pa.code === 'GO') return pa.position ? `${pa.position === '遊' ? '游' : pa.position}滾` : '滾地出局';
      if (pa.code === 'FO') return pa.position ? `${pa.position === '遊' ? '游' : pa.position}飛` : '飛球出局';
      const map = {
        '1B': '一安', '2B': '二安', '3B': '三安', 'HR': '全壘打',
        'BB': '四壞', 'IBB': '故意四壞', 'HBP': '死球', 'CI': '礙打',
        'FC': '野選', 'E': '失誤', 'OBS': '礙跑',
        'K': '三振', 'KREACH': '不死三振', 'DP': '雙殺', 'TP': '三殺',
        'SH': '犧牲短打', 'SF': '犧牲高飛', 'INT': '礙守', 'OUT': '出局'
      };
      return map[pa.code] || pa.code;
    }

    const APP_MESSAGE_ICONS = {
      info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 10v6M12 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4 21 20H3L12 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      danger: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none"><path d="m7 12 3.2 3.2L17.5 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>'
    };

    let appMessageQueue = Promise.resolve();

    function openAppMessageDialog(options = {}) {
      return new Promise(resolve => {
        const dialog = document.getElementById('appMessageDialog');
        const titleEl = document.getElementById('appMessageTitle');
        const textEl = document.getElementById('appMessageText');
        const iconEl = document.getElementById('appMessageIcon');
        const inputWrap = document.getElementById('appMessageInputWrap');
        const input = document.getElementById('appMessageInput');
        const cancelBtn = document.getElementById('appMessageCancelBtn');
        const confirmBtn = document.getElementById('appMessageConfirmBtn');
        const closeBtn = document.getElementById('appMessageCloseBtn');

        const mode = options.mode || 'alert';
        const tone = ['info','warning','danger','success'].includes(options.tone) ? options.tone : 'info';
        const hasCancel = mode !== 'alert';
        const hasInput = mode === 'prompt';
        let settled = false;

        dialog.dataset.tone = tone;
        titleEl.textContent = options.title || (tone === 'danger' ? '操作確認' : tone === 'warning' ? '請確認' : '提示');
        textEl.textContent = String(options.message ?? '');
        iconEl.innerHTML = APP_MESSAGE_ICONS[tone] || APP_MESSAGE_ICONS.info;
        confirmBtn.textContent = options.confirmText || '確定';
        cancelBtn.textContent = options.cancelText || '取消';
        cancelBtn.classList.toggle('hidden', !hasCancel);
        inputWrap.classList.toggle('hidden', !hasInput);
        input.value = hasInput ? String(options.defaultValue ?? '') : '';
        input.placeholder = hasInput ? String(options.placeholder ?? '') : '';

        const finish = value => {
          if (settled) return;
          settled = true;
          dialog.removeEventListener('cancel', onCancel);
          confirmBtn.removeEventListener('click', onConfirm);
          cancelBtn.removeEventListener('click', onCancelClick);
          closeBtn.removeEventListener('click', onCancelClick);
          input.removeEventListener('keydown', onInputKey);
          if (dialog.open) dialog.close();
          resolve(value);
        };

        const onConfirm = () => finish(hasInput ? input.value : true);
        const onCancelClick = () => finish(hasInput ? null : false);
        const onCancel = event => {
          event.preventDefault();
          finish(hasInput ? null : false);
        };
        const onInputKey = event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onConfirm();
          }
        };

        dialog.addEventListener('cancel', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancelClick);
        closeBtn.addEventListener('click', onCancelClick);
        input.addEventListener('keydown', onInputKey);

        dialog.showModal();
        requestAnimationFrame(() => {
          if (hasInput) {
            input.focus();
            input.select();
          } else {
            confirmBtn.focus();
          }
        });
      });
    }

    function queueAppMessage(options) {
      const task = () => openAppMessageDialog(options);
      const result = appMessageQueue.then(task, task);
      appMessageQueue = result.catch(() => {});
      return result;
    }

    async function showAppAlert(message, options = {}) {
      await queueAppMessage({
        ...options,
        mode: 'alert',
        message
      });
    }

    async function showAppConfirm(message, options = {}) {
      return Boolean(await queueAppMessage({
        ...options,
        mode: 'confirm',
        message
      }));
    }

    async function showAppPrompt(message, defaultValue = '', options = {}) {
      return await queueAppMessage({
        ...options,
        mode: 'prompt',
        message,
        defaultValue
      });
    }

    function setStatus(message, isError = false) {
      if (isError) void showAppAlert(message || '操作失敗。', {
        title: '操作失敗',
        tone: 'danger'
      });
    }

    function normalizedPlayerSearchText(player) {
      const typeLabel = player?.type === 'pitcher' ? '投手 pitcher' : '打者 野手 hitter';
      return [
        player?.name,
        player?.number,
        `#${player?.number || ''}`,
        normalizeTeamName(player?.cpblTeam || ''),
        player?.cpblTeamCode,
        player?.cpblPosition,
        player?.externalCompetition,
        player?.externalTeam,
        player?.externalCurrentTeam,
        player?.externalCurrentLevel,
        player?.externalYear,
        scopeLabel(playerScope(player)),
        typeLabel
      ].filter(Boolean).join(' ').toLowerCase();
    }

    function searchPlayers(query) {
      const q = String(query || '').trim().toLowerCase();
      const zonePlayers = homeRootSection === 'international'
        ? players.filter(player => playerScope(player) === 'international')
        : homeContextPlayers();
      if (!q) return [...zonePlayers].sort((a,b) => String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric:true }));
      const compact = q.replace(/^#/, '');
      return zonePlayers.filter(player => {
        const haystack = normalizedPlayerSearchText(player);
        return haystack.includes(q)
          || (compact !== q && haystack.includes(compact))
          || String(player.number || '').includes(compact);
      }).sort((a,b) => {
        const aName = String(a.name || '').toLowerCase();
        const bName = String(b.name || '').toLowerCase();
        const aExact = aName === q || String(a.number || '') === compact ? 0 : 1;
        const bExact = bName === q || String(b.number || '') === compact ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric:true });
      });
    }

    function renderPlayerSearchResults() {
      const list = searchPlayers(els.playerSearchInput?.value || '');
      if (!els.playerSearchResults) return;
      els.playerSearchResults.innerHTML = list.length ? list.map(player => {
        const meta = playerScope(player) === 'cpbl'
          ? [
              player.type === 'pitcher' ? '投手' : '打者',
              normalizeTeamName(player.cpblTeam || ''),
              player.cpblPosition || ''
            ].filter(Boolean).join('｜')
          : playerSourceMeta(player);
        return `
          <button class="press-btn player-search-result" type="button" data-search-player-id="${player.id}">
            <span class="result-number">#${escapeHtml(player.number)}</span>
            <span class="result-main">
              <span class="result-name">${escapeHtml(player.name)}</span>
              <span class="result-meta">${escapeHtml(meta || '未連結中職資料')}</span>
            </span>
          </button>`;
      }).join('') : '<div class="empty">找不到符合條件的球員。</div>';

      els.playerSearchResults.querySelectorAll('[data-search-player-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          els.playerSearchDialog?.close();
          els.allDialog?.close();
          await selectPlayer(btn.dataset.searchPlayerId);
        });
      });
    }

    function openPlayerSearch() {
      if (!els.playerSearchDialog) return;
      els.playerSearchInput.value = '';
      renderPlayerSearchResults();
      els.playerSearchDialog.showModal();
      setTimeout(() => els.playerSearchInput?.focus(), 60);
    }

    async function selectPlayer(id) {
      const player = players.find(p => p.id === id);
      if (!player) return;

      selectedPlayerId = id;
      homeZone = playerScope(player);
      homeSpecialFilter = playerScope(player) === 'cpbl' ? '' : playerSpecialCompetition(player);
      homeInternationalEditionFilter = playerScope(player) === 'international' ? internationalEdition(player) : '';
      homeInternationalTeamFilter = playerScope(player) === 'international' ? internationalTeam(player) : '';

      if (homeZone === 'international') {
        homeRootSection = 'international';
      } else {
        homeRootSection = 'pro';
        if (homeZone === 'cpbl') {
          homeProCountry = 'TW';
        } else {
          const provider = String(playerSpecialCompetition(player) || player.externalProvider || '').toUpperCase();
          if (provider === 'NPB') homeProCountry = 'JP';
          else if (provider === 'KBO') homeProCountry = 'KR';
          else homeProCountry = 'US';
        }
      }
      selectedTab = 'base';
      selectedLevel = 'A';
      selectedRoleView = 'primary';
      todayRoleView = '';
      {
        const years = availableSeasonYears(player, 'A');
        const linkedYear = Math.floor(Number(player.externalYear) || 0);
        const provider = String(player.externalProvider || playerSpecialCompetition(player) || '').toUpperCase();
        const preferCurrentExternalYear = playerScope(player) === 'overseas'
          && ['NPB','KBO','US','MLB','MILB'].includes(provider)
          && (linkedYear === CURRENT_YEAR || years.includes(CURRENT_YEAR));
        selectedSeason = preferCurrentExternalYear
          ? CURRENT_YEAR
          : (linkedYear && years.includes(linkedYear) ? linkedYear : (years[0] || linkedYear || CURRENT_YEAR));
      }
      internationalSelectedGameKey = '';

      if (playerScope(player) === 'cpbl') {
        activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
      }

      player.lastUsedAt = Date.now();
      await savePlayer(player);
      localStorage.setItem('baseballSelectedPlayerId', id);
      await loadRecord();
      currentPage = 'player';
      renderAll();

      if (playerScope(player) === 'international') {
        const competition = playerSpecialCompetition(player);
        const year = Number(player.externalYear) || CURRENT_YEAR;
        setSyncProgress(0, `準備同步 ${competition} ${year} 賽事成績…`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try {
          const remote = await syncInternationalTournamentStats(
            player,
            (percent,status) => setSyncProgress(percent,status)
          );
          const games = await syncInternationalTournamentGames(
            player,
            (percent,status) => setSyncProgress(percent,status)
          );
          selectedSeason = year;
          await loadRecord();
          renderAll();
          if (remote?.found || games.length) {
            await finishSyncProgress(`同步完成｜${competition} ${year}｜${games.length} 場單場資料`);
          } else {
            await finishSyncProgress(`目前尚無可用的 ${competition} ${year} 官方賽事成績`);
          }
        } catch (error) {
          console.warn('國際賽成績同步失敗', error);
          setSyncProgress(100, error?.message || '國際賽成績同步失敗', { error:true });
          await new Promise(resolve => setTimeout(resolve, 1200));
          hideSyncProgress();
        }
        return;
      }

      if (playerScope(player) === 'overseas' && player.externalProvider && player.externalPlayerId) {
        setSyncProgress(0, `準備同步 ${isUsPlayer(player) ? 'MLB / MiLB' : overseasProviderLabel(player.externalProvider)} 資料…`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try {
          const provider = String(player.externalProvider || '').toUpperCase();
          const linkedYear = Math.floor(Number(player.externalYear) || 0);
          const currentSeasonCandidate = ['NPB','KBO','US','MLB','MILB'].includes(provider)
            && (linkedYear === CURRENT_YEAR || selectedSeason === CURRENT_YEAR);
          const targetYear = currentSeasonCandidate
            ? CURRENT_YEAR
            : (selectedSeason || linkedYear || CURRENT_YEAR);
          selectedLevel = 'A';
          if (selectedTab === 'minor') selectedTab = 'base';
          if (!supportsUsDualRoleTabs(player) && selectedTab === 'secondary') selectedTab = 'base';
          selectedRoleView = 'primary';

          if (isUsPlayer(player)) {
            await syncUsCareer(
              player,
              (percent,status) => setSyncProgress(percent,status),
              targetYear
            );
            const active = currentUsCareerEntry(player);
            if (active) selectedSeason = Number(active.year) || targetYear;
          } else {
            await syncExternalSeason(
              player,
              targetYear,
              (percent,status) => setSyncProgress(percent,status),
              'A'
            );
            activatePlayerStatsProfile(player, targetYear, 'A');
            selectedSeason = targetYear;
          }

          await loadRecord();
          renderAll();
          const active = isUsPlayer(player) ? currentUsCareerEntry(player) : null;
          await finishSyncProgress(isUsPlayer(player)
            ? `同步完成｜${active ? usCareerOptionLabel(active) : 'MLB / MiLB'}`
            : `同步完成｜${overseasProviderLabel(player.externalProvider)} ${targetYear}`);
        } catch (error) {
          console.warn('國外聯盟賽季同步失敗', error);
          setSyncProgress(100, error?.message || '國外聯盟資料同步失敗', { error:true });
          await new Promise(resolve => setTimeout(resolve, 1200));
          hideSyncProgress();
        }
        return;
      }

      if (playerScope(player) !== 'cpbl' || !player.cpblAcnt) return;

      try {
        const profileData = await cpblRequest('player-profile', { acnt: player.cpblAcnt });
        const official = profileData?.player || null;
        if (official) {
          if (official.name) player.name = official.name;
          if (official.number) player.number = String(official.number);
          if (official.team) player.cpblTeam = normalizeTeamName(official.team);
          if (official.teamCode) player.cpblTeamCode = String(official.teamCode);
          repairStoredCpblPlayerType(player, official.position || '');
          await savePlayer(player);
        }
      } catch (error) {
        console.warn('中職官方守位確認失敗，沿用目前分類', error);
      }

      setSyncProgress(0, `準備同步 #${player.number} ${player.name}…`);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      try {
        const result = await syncPlayerCpblHistory(
          player,
          (percent, status) => setSyncProgress(percent, status)
        );

        const majorYears = result?.majorYears?.length ? result.majorYears : availableSeasonYears(player, 'A');
        const minorYears = result?.minorYears?.length ? result.minorYears : availableSeasonYears(player, 'D');
        selectedLevel = majorYears.length ? 'A' : (minorYears.length ? 'D' : 'A');
        const preferredYears = selectedLevel === 'D' ? minorYears : majorYears;
        selectedSeason = preferredYears[0] || CURRENT_YEAR;
        activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
        await loadRecord();
        renderAll();

        const partialCount = result?.partialErrors?.length || 0;
        const summary = `一軍 ${majorYears.length} 季／二軍 ${minorYears.length} 季`;
        await finishSyncProgress(partialCount ? `同步完成（部分失敗）｜${summary}` : `同步完成｜${summary}`);
      } catch (error) {
        console.warn('進入球員頁自動同步失敗', error);
        setSyncProgress(100, error?.message || '中職官網同步失敗', { error: true });
        await new Promise(resolve => setTimeout(resolve, 1200));
        hideSyncProgress();
      }
    }

    function switchPlayerLevel(level) {
      level = level === 'D' ? 'D' : 'A';
      selectedRoleView = 'primary';
      if (level === selectedLevel) return;
      const player = selectedPlayer();
      if (!player) return;

      persistActiveStatsProfile(player);
      selectedLevel = level;

      const years = availableSeasonYears(player, selectedLevel);
      selectedSeason = years[0] ?? CURRENT_YEAR;
      activatePlayerStatsProfile(player, selectedSeason, selectedLevel);

      currentRecord = defaultGameRecord(player);
      renderAll();

      const targetPlayerId = player.id;
      const targetLevel = level;

      player.updatedAt = Date.now();
      idbPut(STORES.players, player).catch(error => {
        console.warn('切換軍別時儲存球員資料失敗', error);
      });

      Promise.resolve()
        .then(() => loadRecord())
        .then(() => {
          if (selectedPlayerId !== targetPlayerId || selectedLevel !== targetLevel) return;
          renderAll();
        })
        .catch(error => {
          console.warn('切換軍別時背景讀取當日紀錄失敗', error);
        });

      // 保險：如果初次同步真的沒把這個軍別寫進本機，背景補抓一次，不再顯示 0~100%。
      const officialYears = player?.cpblAvailableYears?.[level];
      const hasAnyProfile = Array.isArray(officialYears)
        && officialYears.some(year => hasStatsProfile(player, year, level));
      if (player.cpblAcnt && (!Array.isArray(officialYears) || !officialYears.length || !hasAnyProfile)) {
        cpblRequest('season-history', { acnt: player.cpblAcnt, kindCode: level })
          .then(data => {
            if (!data?.history) return;
            applyCpblSeasonHistory(player, data.history, level);
            return idbPut(STORES.players, player);
          })
          .then(() => {
            if (selectedPlayerId !== targetPlayerId || selectedLevel !== targetLevel) return;
            const repairedYears = availableSeasonYears(player, level);
            selectedSeason = repairedYears[0] ?? CURRENT_YEAR;
            activatePlayerStatsProfile(player, selectedSeason, level);
            renderAll();
          })
          .catch(error => {
            console.warn(`背景補抓${cpblLevelLabel(level)}資料失敗`, error);
          });
      }
    }

    async function switchOverseasLeagueLevel(level) {
      const player = selectedPlayer();
      if (!player || !supportsLeagueLevelTabs(player) || playerScope(player) !== 'overseas') return;
      level = level === 'D' ? 'D' : 'A';
      selectedRoleView = 'primary';

      let historyOverlayOpen = false;
      const provider = String(player.externalProvider || '').toUpperCase();
      const lastChecked = Number(player?.externalLevelYearsCheckedAt?.[level] || 0);
      const historyStale = !lastChecked || (Date.now() - lastChecked > 24 * 60 * 60 * 1000);
      if (level === 'D' && ['NPB','KBO'].includes(provider) && historyStale) {
        setSyncProgress(0, `準備搜尋 ${provider} 二軍歷年出賽資料…`);
        historyOverlayOpen = true;
        try {
          await syncExternalLevelYears(player, 'D', (percent,status)=>setSyncProgress(percent,status));
        } catch (error) {
          console.warn(`${provider} 二軍歷年年份搜尋失敗`, error);
        }
      }

      if (selectedLevel !== level) persistActiveStatsProfile(player);
      selectedLevel = level;

      const years = availableSeasonYears(player, level);
      selectedSeason = years[0] || Number(player.externalYear) || CURRENT_YEAR;

      const hasRolePair = Boolean(ensureRoleStatsProfiles(player)[statsProfileKey(selectedSeason, level)]);
      if (hasStatsProfile(player, selectedSeason, level) && selectedSeason !== CURRENT_YEAR && hasRolePair) {
        activatePlayerStatsProfile(player, selectedSeason, level);
        await loadRecord();
        renderAll();
        if (historyOverlayOpen) await finishSyncProgress(`二軍歷年資料已更新｜${years.length} 個賽季`);
        return;
      }

      if (level === 'D' && ['NPB','KBO'].includes(provider) && !years.length) {
        activatePlayerStatsProfile(player, selectedSeason, level);
        renderAll();
        await finishSyncProgress(`${provider} 官網未找到這位球員的二軍出賽賽季`);
        return;
      }

      activatePlayerStatsProfile(player, selectedSeason, level);
      renderAll();
      setSyncProgress(historyOverlayOpen ? 52 : 0, `準備同步 ${overseasProviderLabel(player.externalProvider)} ${selectedSeason} ${level === 'D' ? '二軍' : '一軍'}…`);
      try {
        await syncExternalSeason(
          player,
          selectedSeason,
          (percent,status)=>setSyncProgress(percent,status),
          level
        );
        activatePlayerStatsProfile(player, selectedSeason, level);
        await loadRecord();
        renderAll();
        await finishSyncProgress(`同步完成｜${overseasProviderLabel(player.externalProvider)} ${selectedSeason} ${level === 'D' ? '二軍' : '一軍'}`);
      } catch (error) {
        setSyncProgress(100, error?.message || '軍別資料同步失敗', { error:true });
        await new Promise(resolve => setTimeout(resolve, 900));
        hideSyncProgress();
        renderAll();
      }
    }

    async function switchPlayerSeason(value) {
      const player = selectedPlayer();
      if (!player) return;

      if (isUsPlayer(player)) {
        const entry = usCareerEntries(player).find(item => String(item.key) === String(value));
        if (!entry || String(entry.key) === String(player.usSelectedCareerKey || '')) return;
        selectedRoleView = 'primary';
        applyUsCareerEntry(player, entry);
        await savePlayer(player);
        renderAll();
        return;
      }

      const allowedYears = availableSeasonYears(player, selectedLevel);
      const year = Math.floor(Number(value));
      if (!allowedYears.includes(year) || year === selectedSeason) return;
      selectedRoleView = 'primary';

      if (playerScope(player) === 'overseas' && player.externalProvider && player.externalPlayerId) {
        selectedSeason = year;
        player.externalYear = year;
        setSyncProgress(0, `準備同步 ${overseasProviderLabel(player.externalProvider)} ${year}…`);
        try {
          await syncExternalSeason(player, year, (percent,status)=>setSyncProgress(percent,status), selectedLevel);
          await loadRecord();
          renderAll();
          await finishSyncProgress(`同步完成｜${overseasProviderLabel(player.externalProvider)} ${year}`);
        } catch (error) {
          setSyncProgress(100, error?.message || '賽季同步失敗', { error:true });
          await new Promise(resolve => setTimeout(resolve, 1200));
          hideSyncProgress();
          renderAll();
        }
        return;
      }

      if (playerScope(player) !== 'cpbl') return;

      await savePlayer(player);
      selectedSeason = year;
      activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
      renderAll();
    }

    function clearBatchReportOutputs() {
      for (const output of batchReportOutputs) {
        if (output?.url) URL.revokeObjectURL(output.url);
      }
      batchReportOutputs = [];
      els.batchReportDownloadAllBtn?.classList.add('hidden');
      if (els.batchReportResults) els.batchReportResults.innerHTML = '';
    }

    function renderBatchReportSelection() {
      if (!els.batchReportList) return;
      const list = players
        .filter(player => playerScope(player) === homeZone)
        .sort((a,b) => String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric:true }));
      els.batchReportList.innerHTML = list.length ? list.map(player => {
        const meta = playerSourceMeta(player);
        return `
          <label class="batch-report-row">
            <input type="checkbox" value="${player.id}" data-batch-report-player />
            <span>
              <span class="batch-report-name">#${escapeHtml(player.number)} ${escapeHtml(player.name)}</span>
              <span class="batch-report-meta">${escapeHtml(meta || '未連結中職資料')}</span>
            </span>
          </label>`;
      }).join('') : '<div class="empty">目前沒有球員。</div>';
    }

    function openBatchReportDialog() {
      clearBatchReportOutputs();
      batchReportPreferences = {};
      if (els.batchReportDate) els.batchReportDate.textContent = els.gameDate.value.replaceAll('-', '/');
      if (els.batchReportProgress) els.batchReportProgress.textContent = '';
      renderBatchReportSelection();
      els.allDialog?.close();
      els.batchReportDialog?.showModal();
    }

    function batchReportSelectedIds() {
      return [...document.querySelectorAll('[data-batch-report-player]:checked')].map(input => input.value);
    }

    async function readSavedGameForBatch(playerId) {
      const date = els.gameDate.value;
      let record = await idbGet(STORES.games, `${date}:${playerId}:A`);
      if (!record) record = await idbGet(STORES.games, `${date}:${playerId}`);
      if (record) return { record, level:'A' };

      record = await idbGet(STORES.games, `${date}:${playerId}:D`);
      if (record) return { record, level:'D' };

      return { record:null, level:'A' };
    }

    function hasUsableBatchRecord(record, player) {
      if (!record || !String(record.opponent || '').trim()) return false;
      if (player.type === 'hitter') {
        const mode = record.hitterAppearance?.mode || 'bat';
        if (mode !== 'bat') return true;
        return Array.isArray(record.hitterPAs) && record.hitterPAs.length > 0;
      }
      const g = record.pitcherGame || {};
      return String(g.innings || '0.0') !== '0.0'
        || Number(g.k) > 0 || Number(g.h) > 0 || Number(g.bb) > 0
        || Number(g.hbp) > 0 || Number(g.er) > 0 || Number(g.r) > 0;
    }

    function batchRecordFromCpblDaily(player, daily, level) {
      if (!daily?.found) return null;
      const record = {
        ...defaultGameRecord(player),
        key: `${els.gameDate.value}:${player.id}:${level}`,
        playerId: player.id,
        date: els.gameDate.value,
        level,
        opponent: normalizeTeamName(daily.game?.opponent || ''),
        cpblReadOnlyImport: els.gameDate.value !== localISODate(),
        cpblImportedAt: Date.now()
      };

      if (player.type === 'hitter') {
        const list = daily.hitter?.plateAppearances || [];
        if (!list.length) return null;
        record.hitterAppearance.mode = 'bat';
        record.hitterPAs = list.map(pa => ({
          id: uid(),
          code: pa.code,
          position: pa.position || '',
          rbi: Number(pa.rbi) || 0,
          cpblOfficialAction: pa.officialAction || ''
        }));
        record.cpblGameSummary = {
          runs: Math.max(0, Number(daily.hitter?.runs) || 0),
          hits: Math.max(0, Number(daily.hitter?.hits) || 0),
          errors: Math.max(0, Number(daily.hitter?.errors) || 0),
          official: true
        };
        record.committedStats = deriveHitterGame(record.hitterPAs);
      } else {
        const p = daily.pitcher;
        if (!p) return null;
        const g = record.pitcherGame;
        g.innings = p.innings || '0.0';
        g.k = Number(p.k) || 0;
        g.bb = Number(p.bb) || 0;
        g.h = Number(p.h) || 0;
        g.hbp = Number(p.hbp) || 0;
        g.r = Number(p.r) || 0;
        g.er = Number(p.er) || 0;
        const pitchCount = Number(p.pitchCount) || 0;
        g.pitchTens = Math.floor(pitchCount / 10);
        g.pitchOnes = pitchCount % 10;
        g.cg = Boolean(p.cg);
        g.sho = Boolean(p.sho);
        g.hld = Boolean(p.hld);
        g.sv = Boolean(p.sv);
        g.bsv = Boolean(p.bsv);
        g.decision = ['W','L'].includes(p.decision) ? p.decision : 'ND';
        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;
        record.committedStats = derivePitcherGame(g);
      }

      record.committedAt = Date.now();
      return record;
    }

    async function fetchBatchGameFromCpbl(player) {
      if (playerScope(player) !== 'cpbl') {
        return { record:null, level:'A', reason:'國際賽／國外聯盟球員只使用已儲存的當日戰報資料' };
      }
      if (!player?.cpblAcnt || !player?.cpblTeamCode) {
        return { record:null, level:'A', reason:'此球員尚未連結中職官網' };
      }

      const levels = ['A','D'];
      let lastReason = '';
      for (const level of levels) {
        const knownYears = player?.cpblAvailableYears?.[level];
        const year = Number(els.gameDate.value.slice(0,4));
        if (Array.isArray(knownYears) && knownYears.length && !knownYears.includes(year)) continue;

        try {
          const data = await cpblRequest('daily', {
            acnt: player.cpblAcnt,
            date: els.gameDate.value,
            teamCode: player.cpblTeamCode,
            kindCode: level
          });
          const daily = data.daily;
          if (!daily?.found) {
            lastReason = daily?.reason || lastReason;
            continue;
          }

          const record = batchRecordFromCpblDaily(player, daily, level);
          if (!record) {
            lastReason = player.type === 'hitter'
              ? '官網顯示有出賽，但沒有可用的逐打席資料'
              : '官網顯示有出賽，但沒有可用的投球資料';
            continue;
          }

          await idbPut(STORES.games, record);
          return { record, level, fetched:true };
        } catch (error) {
          lastReason = error?.message || String(error);
        }
      }

      return { record:null, level:'A', reason:lastReason || '官網查不到當天出賽資料' };
    }

    async function refreshBatchSeasonStats(player, year, level) {
      const scope = playerScope(player);
      try {
        if (scope === 'cpbl') {
          if (!player?.cpblAcnt) {
            return { ok:false, skipped:true, reason:'尚未連結中職官網' };
          }
          await updatePlayerFromCpbl(player, true, year, level);
          activatePlayerStatsProfile(player, year, level);
          return { ok:true };
        }

        if (scope === 'overseas') {
          if (!player?.externalProvider || !player?.externalPlayerId) {
            return { ok:false, skipped:true, reason:'尚未連結國外聯盟資料' };
          }
          await syncExternalSeason(player, year, null, level);
          activatePlayerStatsProfile(player, year, level);
          return { ok:true };
        }

        if (scope === 'international') {
          if (!playerSpecialCompetition(player)) {
            return { ok:false, skipped:true, reason:'尚未連結國際賽資料' };
          }
          await syncInternationalTournamentStats(player);
          return { ok:true };
        }

        return { ok:false, skipped:true, reason:'此球員沒有可同步的官方來源' };
      } catch (error) {
        console.warn('批次戰報累積數據更新失敗', player?.name, error);
        return { ok:false, skipped:false, reason:error?.message || '累積數據更新失敗' };
      }
    }

    async function generateBatchReports({ refreshStats = true, refreshDaily = false } = {}) {
      const ids = batchReportSelectedIds();
      if (!ids.length) {
        setStatus('請至少勾選一名球員。', true);
        return;
      }

      clearBatchReportOutputs();
      els.batchReportGenerateBtn.disabled = true;

      const savedState = {
        selectedPlayerId,
        selectedLevel,
        selectedSeason,
        currentRecord,
        currentPage,
        currentTemplate
      };

      const results = [];
      try {
        for (let index = 0; index < ids.length; index++) {
          const player = players.find(item => item.id === ids[index]);
          if (!player) continue;

          if (els.batchReportProgress) {
            els.batchReportProgress.textContent = `正在生成 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
          }

          let savedGame = await readSavedGameForBatch(player.id);
          let record = savedGame.record;
          let reportLevel = savedGame.level;
          let dailyRefreshWarning = '';

          if (refreshDaily && playerScope(player) === 'cpbl') {
            if (els.batchReportProgress) {
              els.batchReportProgress.textContent = `正在更新單場資料 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
            }
            const fetched = await fetchBatchGameFromCpbl(player);
            if (hasUsableBatchRecord(fetched.record, player)) {
              record = fetched.record;
              reportLevel = fetched.level;
            } else if (hasUsableBatchRecord(record, player)) {
              dailyRefreshWarning = fetched.reason || '單場資料更新失敗，已使用本機快取';
            } else {
              results.push({ player, ok:false, reason:fetched.reason || '這一天查不到出賽資料' });
              continue;
            }
          } else if (!hasUsableBatchRecord(record, player)) {
            if (els.batchReportProgress) {
              els.batchReportProgress.textContent = `正在查官網 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
            }
            const fetched = await fetchBatchGameFromCpbl(player);
            record = fetched.record;
            reportLevel = fetched.level;

            if (!hasUsableBatchRecord(record, player)) {
              results.push({ player, ok:false, reason:fetched.reason || '這一天查不到出賽資料' });
              continue;
            }
          }

          selectedPlayerId = player.id;
          selectedLevel = reportLevel;
          const preferredTemplate = batchReportPreferences[player.id]?.templateKey;
          currentTemplate = preferredTemplate && TEMPLATES[preferredTemplate]?.enabled
            ? preferredTemplate
            : savedState.currentTemplate;

          const reportYear = Number(els.gameDate.value.slice(0,4)) || CURRENT_YEAR;
          const scope = playerScope(player);
          const years = availableSeasonYears(player, reportLevel);
          selectedSeason = scope === 'international'
            ? (Number(player.externalYear) || reportYear)
            : (years.includes(reportYear) ? reportYear : (years[0] || reportYear));

          let statsRefresh = { ok:false, skipped:true, reason:'' };
          if (refreshStats) {
            if (els.batchReportProgress) {
              els.batchReportProgress.textContent = `正在更新累積數據 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
            }
            statsRefresh = await refreshBatchSeasonStats(player, selectedSeason, selectedLevel);
          }

          if (scope !== 'international') {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }

          currentRecord = {
            ...defaultGameRecord(player),
            ...record,
            key: `${els.gameDate.value}:${player.id}:${reportLevel}`,
            playerId: player.id,
            date: els.gameDate.value,
            level: reportLevel,
            hitterPAs: Array.isArray(record.hitterPAs) ? record.hitterPAs : [],
            hitterAppearance: {
              ...defaultGameRecord(player).hitterAppearance,
              ...(record.hitterAppearance || {})
            },
            pitcherGame: {
              ...defaultGameRecord(player).pitcherGame,
              ...(record.pitcherGame || {})
            },
            cpblGameSummary: {
              ...defaultGameRecord(player).cpblGameSummary,
              ...(record.cpblGameSummary || {})
            }
          };

          await renderCanvas();
          const blob = await new Promise(resolve => els.canvas.toBlob(resolve, 'image/png'));
          if (!blob) {
            results.push({ player, ok:false, reason:'圖片產生失敗' });
            continue;
          }

          const fileName = currentOutputFileName();
          const url = URL.createObjectURL(blob);
          const refreshWarning = [
            dailyRefreshWarning,
            (!statsRefresh.ok && !statsRefresh.skipped ? statsRefresh.reason : '')
          ].filter(Boolean).join('；');
          const output = {
            playerId:player.id,
            player,
            blob,
            fileName,
            url,
            templateKey:currentTemplate,
            refreshWarning,
            statsRefreshed:Boolean(statsRefresh.ok)
          };
          batchReportOutputs.push(output);
          results.push({ player, ok:true, output });

          await new Promise(resolve => setTimeout(resolve, 60));
        }
      } finally {
        selectedPlayerId = savedState.selectedPlayerId;
        selectedLevel = savedState.selectedLevel;
        selectedSeason = savedState.selectedSeason;
        currentRecord = savedState.currentRecord;
        currentPage = savedState.currentPage;
        currentTemplate = savedState.currentTemplate;
        const restoredPlayer = selectedPlayer();
        if (restoredPlayer) activatePlayerStatsProfile(restoredPlayer, selectedSeason, selectedLevel);
        els.batchReportGenerateBtn.disabled = false;
        renderAll();
      }

      if (els.batchReportProgress) {
        const okCount = results.filter(item => item.ok).length;
        els.batchReportProgress.textContent = `完成：生成 ${okCount} 張，跳過 ${results.length - okCount} 名。`;
      }

      if (els.batchReportResults) {
        els.batchReportResults.innerHTML = results.map(item => {
          if (!item.ok) {
            return `
              <div class="batch-report-result failed">
                <div class="result-text">
                  <strong>#${escapeHtml(item.player.number)} ${escapeHtml(item.player.name)}</strong>
                  ${escapeHtml(item.reason)}
                </div>
              </div>`;
          }

          const templateButtons = Object.entries(TEMPLATES)
            .filter(([, template]) => template.enabled)
            .map(([key, template]) => `
              <button type="button"
                class="batch-template-chip ${item.output.templateKey === key ? 'active' : ''}"
                data-batch-template-player="${item.player.id}"
                data-batch-template-key="${key}">
                ${escapeHtml(template.label)}
              </button>`).join('');

          return `
            <div class="batch-report-result" data-batch-result-player="${item.player.id}">
              <div class="batch-result-main">
                <div class="result-text">
                  <strong>#${escapeHtml(item.player.number)} ${escapeHtml(item.player.name)}</strong>
                  ${item.output.refreshWarning
                    ? `已生成｜更新提醒：${escapeHtml(item.output.refreshWarning)}`
                    : (item.output.statsRefreshed ? '已生成｜最新累積數據已同步' : '已生成')}
                </div>
                <div class="batch-result-controls">
                  <button class="press-btn" type="button" data-batch-download="${item.player.id}">下載</button>
                  <button class="press-btn" type="button" data-batch-bg-toggle="${item.player.id}">背景選擇</button>
                  <button class="press-btn" type="button" data-batch-photo-trigger="${item.player.id}">圖片上傳</button>
                  <input class="hidden" type="file" accept="image/*" data-batch-photo-input="${item.player.id}" />
                </div>
                <div class="batch-result-template-panel hidden" data-batch-template-panel="${item.player.id}">
                  ${templateButtons}
                </div>
              </div>
            </div>`;
        }).join('');

        els.batchReportResults.querySelectorAll('[data-batch-download]').forEach(button => {
          button.addEventListener('click', async () => {
            const playerId = button.dataset.batchDownload;
            button.disabled = true;
            try {
              if (els.batchReportProgress) {
                els.batchReportProgress.textContent = '下載前正在同步最新數據並重新產圖…';
              }
              const outputs = await generateBatchReports({ refreshStats:true, refreshDaily:true });
              const output = outputs.find(item => item.playerId === playerId);
              if (!output) throw new Error('找不到這名球員可下載的戰報。');

              const link = document.createElement('a');
              link.href = output.url;
              link.download = output.fileName;
              document.body.appendChild(link);
              link.click();
              link.remove();

              if (els.batchReportProgress) {
                els.batchReportProgress.textContent = `已更新最新數據並下載：#${output.player.number} ${output.player.name}`;
              }
              showAppToast('已下載');
            } catch (error) {
              setStatus(error?.message || '批次戰報下載失敗。', true);
            }
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-bg-toggle]').forEach(button => {
          button.addEventListener('click', () => {
            const playerId = button.dataset.batchBgToggle;
            const panel = els.batchReportResults.querySelector(`[data-batch-template-panel="${playerId}"]`);
            panel?.classList.toggle('hidden');
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-template-player]').forEach(button => {
          button.addEventListener('click', async () => {
            const playerId = button.dataset.batchTemplatePlayer;
            const templateKey = button.dataset.batchTemplateKey;
            if (!TEMPLATES[templateKey]?.enabled) return;
            batchReportPreferences[playerId] = {
              ...(batchReportPreferences[playerId] || {}),
              templateKey
            };
            await generateBatchReports({ refreshStats:false, refreshDaily:false });
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-photo-trigger]').forEach(button => {
          button.addEventListener('click', () => {
            const input = els.batchReportResults.querySelector(`[data-batch-photo-input="${button.dataset.batchPhotoTrigger}"]`);
            input?.click();
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-photo-input]').forEach(input => {
          input.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
              setStatus('請選擇圖片檔。', true);
              return;
            }

            const player = players.find(item => item.id === event.target.dataset.batchPhotoInput);
            if (!player) return;

            event.target.disabled = true;
            try {
              const photo = {
                id: uid(),
                playerId: player.id,
                name: file.name,
                blob: file,
                createdAt: Date.now()
              };
              await idbPut(STORES.photos, photo);
              photos.push(photo);
              player.selectedPhotoId = photo.id;
              ensurePhotoTransforms(player)[photo.id] = { x: 0, y: 0, scale: 1 };
              await savePlayer(player);
              await generateBatchReports({ refreshStats:false, refreshDaily:false });
            } catch (error) {
              setStatus(error?.message || '圖片上傳失敗。', true);
            }
          });
        });
      }

      const hasOutputs = batchReportOutputs.length > 0;
      els.batchReportDownloadAllBtn?.classList.toggle('hidden', !hasOutputs);
      return batchReportOutputs.slice();
    }

    async function downloadAllBatchReports() {
      if (!batchReportOutputs.length) {
        setStatus('目前沒有可下載的批次戰報。', true);
        return;
      }

      els.batchReportDownloadAllBtn.disabled = true;
      try {
        if (els.batchReportProgress) {
          els.batchReportProgress.textContent = '全部下載前正在同步最新數據並重新產圖…';
        }

        const outputs = await generateBatchReports({ refreshStats:true, refreshDaily:true });
        if (!outputs.length) throw new Error('更新後沒有可下載的戰報。');

        for (let i = 0; i < outputs.length; i++) {
          const output = outputs[i];
          const link = document.createElement('a');
          link.href = output.url;
          link.download = output.fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          if (i < outputs.length - 1) await new Promise(resolve => setTimeout(resolve, 250));
        }

        if (els.batchReportProgress) {
          els.batchReportProgress.textContent = `已同步最新數據並下載 ${outputs.length} 張戰報。`;
        }
        showAppToast(`已下載 ${outputs.length} 張圖片`);
      } catch (error) {
        setStatus(error?.message || '批次下載失敗。', true);
      } finally {
        els.batchReportDownloadAllBtn.disabled = false;
      }
    }

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

    function renderRecentPlayers() {
      renderHomePlayerFilters();
      els.homePage?.classList.toggle('international-home-mode', homeRootSection === 'international');

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
    function selectedLevelSecondaryStats(player) {
      if (!player) return null;
      const level = supportsLeagueLevelTabs(player) ? selectedLevel : 'A';
      const pair = roleStatsPair(player, selectedSeason, level);
      return player.type === 'pitcher' ? pair?.hitter || null : pair?.pitcher || null;
    }

    function selectedLevelHasSecondaryRole(player) {
      const stats = selectedLevelSecondaryStats(player);
      return player?.type === 'pitcher' ? hitterRoleHasData(stats) : pitcherRoleHasData(stats);
    }

    function renderSelectedLevelSecondaryRole(player) {
      const stats = selectedLevelSecondaryStats(player);
      const levelLabel = selectedLevel === 'D' ? '二軍' : '一軍';
      const roleHeadingPrefix = supportsLeagueLevelTabs(player)
        ? `${selectedSeason} ${levelLabel}`
        : `${selectedSeason} `;

      if (player.type === 'pitcher') {
        const d = hitterDerived(stats || hitterDefaults());
        els.content.innerHTML = `
          <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${roleHeadingPrefix}打擊成績</h2>
          <div class="metrics">
            <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
            <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
            <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
          </div>
          <div class="grid four">
            ${readonlyStatField('打席', stats?.pa || 0)}
            ${readonlyStatField('打數', stats?.ab || 0)}
            ${readonlyStatField('安打', d.hits || 0)}
            ${readonlyStatField('得分', stats?.runs || 0)}
            ${readonlyStatField('打點', stats?.rbi || 0)}
            ${readonlyStatField('一安', stats?.single || 0)}
            ${readonlyStatField('二安', stats?.double || 0)}
            ${readonlyStatField('三安', stats?.triple || 0)}
            ${readonlyStatField('全壘打', stats?.hr || 0)}
            ${readonlyStatField('四壞球', stats?.bb || 0)}
            ${readonlyStatField('故意四壞', stats?.ibb || 0)}
            ${readonlyStatField('死球', stats?.hbp || 0)}
            ${readonlyStatField('三振', stats?.k || 0)}
            ${readonlyStatField('犧牲短打', stats?.sacBunt || 0)}
            ${readonlyStatField('犧牲高飛', stats?.sacFly || 0)}
          </div>
          ${playerSourceInfoHtml(player)}`;
        return;
      }

      const d = pitcherDerived(stats || pitcherDefaults());
      els.content.innerHTML = `
        <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${roleHeadingPrefix}投球成績</h2>
        <div class="metrics">
          <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
          <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
          <div class="metric"><span>勝／敗</span><strong>${stats?.w || 0}／${stats?.l || 0}</strong></div>
        </div>
        <div class="grid four">
          ${readonlyStatField('投球局數', outsToIP(stats?.outs || 0))}
          ${readonlyStatField('被安打', stats?.h || 0)}
          ${readonlyStatField('保送', stats?.bb || 0)}
          ${readonlyStatField('死球', stats?.hbp || 0)}
          ${readonlyStatField('三振', stats?.k || 0)}
          ${readonlyStatField('自責分', stats?.er || 0)}
          ${readonlyStatField('勝場', stats?.w || 0)}
          ${readonlyStatField('敗場', stats?.l || 0)}
          ${readonlyStatField('完投', stats?.cg || 0)}
          ${readonlyStatField('完封', stats?.sho || 0)}
          ${readonlyStatField('救援成功', stats?.sv || 0)}
          ${readonlyStatField('中繼成功', stats?.hld || 0)}
        </div>
        ${playerSourceInfoHtml(player)}`;
    }

    function injectSelectedLevelRoleSwitch(player) {
      if (!selectedLevelHasSecondaryRole(player)) {
        selectedRoleView = 'primary';
        return;
      }

      const primaryLabel = player.type === 'pitcher' ? '投球成績' : '打擊成績';
      const secondaryLabel = player.type === 'pitcher' ? '打擊成績' : '投球成績';
      els.content.insertAdjacentHTML('afterbegin', `
        <div class="level-role-switch" aria-label="成績類型">
          <button type="button" class="level-role-btn ${selectedRoleView === 'primary' ? 'active' : ''}" data-role-view="primary">${primaryLabel}</button>
          <button type="button" class="level-role-btn ${selectedRoleView === 'secondary' ? 'active' : ''}" data-role-view="secondary">${secondaryLabel}</button>
        </div>`);

      els.content.querySelectorAll('[data-role-view]').forEach(button => {
        button.addEventListener('click', () => {
          const next = button.dataset.roleView === 'secondary' ? 'secondary' : 'primary';
          if (next === selectedRoleView) return;
          selectedRoleView = next;
          renderAll();
        });
      });
    }

    function renderLeagueLevelStatsPage(player) {
      if (!supportsLeagueLevelTabs(player)) {
        renderBaseSettings(player);
        return;
      }

      if (!selectedLevelHasSecondaryRole(player)) selectedRoleView = 'primary';

      if (selectedRoleView === 'secondary') renderSelectedLevelSecondaryRole(player);
      else renderBaseSettings(player);

      injectSelectedLevelRoleSwitch(player);
    }

    function renderBaseSettings(player) {
      const levelHeading = supportsLeagueLevelTabs(player)
        ? `${selectedSeason} ${selectedLevel === 'D' ? '二軍' : '一軍'}總成績`
        : '';
      const usEntry = isUsPlayer(player) ? currentUsCareerEntry(player) : null;
      const usCareerHeading = usEntry
        ? `${usEntry.year} ${usEntry.organizationName || usEntry.teamName || '球隊未提供'} ${usEntry.level || 'MiLB'} 總成績`
        : '';
      const usDualHeading = supportsUsDualRoleTabs(player)
        ? `${selectedSeason} ${player.type === 'pitcher' ? '投球成績' : '打擊成績'}`
        : '';
      if (player.type === 'hitter') {
        const s = mergeStats(player.stats, hitterDefaults);
        const d = hitterDerived(s);
        els.content.innerHTML = `
          <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${playerScope(player) === 'international' ? `${escapeHtml(playerSpecialCompetition(player))} ${escapeHtml(internationalEdition(player))} 總成績` : (levelHeading || usCareerHeading || usDualHeading || '打者基礎設定')}</h2>
          <div class="metrics">
            <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
            <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
            <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
          </div>
          <div class="grid four">
            ${hitterInput('打席', 'pa', s.pa)}
            ${hitterInput('打數', 'ab', s.ab)}
            ${hitterInput('打點', 'rbi', s.rbi)}
            ${hitterInput('得分', 'runs', s.runs)}
            ${hitterReadonly('安打', d.hits)}
            ${hitterInput('一安', 'single', s.single)}
            ${hitterInput('二安', 'double', s.double)}
            ${hitterInput('三安', 'triple', s.triple)}
            ${hitterInput('全壘打', 'hr', s.hr)}
            ${hitterReadonly('壘打數', d.tb)}
            ${hitterInput('犧牲短打', 'sacBunt', s.sacBunt)}
            ${hitterInput('犧牲高飛', 'sacFly', s.sacFly)}
            ${hitterInput('四壞球', 'bb', s.bb)}
            ${hitterInput('故意四壞球', 'ibb', s.ibb)}
            ${hitterInput('死球', 'hbp', s.hbp)}
          </div>
          <div class="section-actions">
            <button id="deletePlayerBtn" class="press-btn danger">刪除球員</button>
            <button id="saveBaseBtn" class="press-btn primary">儲存基礎設定</button>
          </div>
          ${playerSourceInfoHtml(player)}`;
      } else {
        const s = mergeStats(player.stats, pitcherDefaults);
        const d = pitcherDerived(s);
        els.content.innerHTML = `
          <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${playerScope(player) === 'international' ? `${escapeHtml(playerSpecialCompetition(player))} ${escapeHtml(internationalEdition(player))} 總成績` : (levelHeading || usCareerHeading || usDualHeading || '投手基礎設定')}</h2>
          <div class="metrics">
            <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
            <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
            <div class="metric"><span>勝／敗</span><strong>${s.w}／${s.l}</strong></div>
          </div>
          <div class="grid four">
            ${pitcherInput('完投', 'cg', s.cg)}
            ${pitcherInput('完封', 'sho', s.sho)}
            ${pitcherInput('無四死球', 'noWalkHbp', s.noWalkHbp)}
            ${pitcherInput('勝場', 'w', s.w)}
            ${pitcherInput('敗場', 'l', s.l)}
            ${pitcherInput('救援成功', 'sv', s.sv)}
            ${pitcherInput('救援失敗', 'bsv', s.bsv)}
            ${pitcherInput('中繼成功', 'hld', s.hld)}
            <label class="field">投球局數<input id="base-outs" type="text" value="${outsToIP(s.outs)}" /></label>
            ${pitcherInput('安打', 'h', s.h)}
            ${pitcherInput('保送', 'bb', s.bb)}
            ${pitcherInput('死球', 'hbp', s.hbp)}
            ${pitcherInput('三振', 'k', s.k)}
            ${pitcherInput('自責分', 'er', s.er)}
          </div>
          <div class="section-actions">
            <button id="deletePlayerBtn" class="press-btn danger">刪除球員</button>
            <button id="saveBaseBtn" class="press-btn primary">儲存基礎設定</button>
          </div>
          ${playerSourceInfoHtml(player)}`;
      }

      document.getElementById('saveBaseBtn').addEventListener('click', async () => {
        try {
          if (player.type === 'hitter') {
            const next = hitterDefaults();
            Object.keys(next).forEach(key => next[key] = readNonNegative(`base-${key}`));
            validateHitterBaseStats(next);
            player.stats = next;
          } else {
            const next = pitcherDefaults();
            Object.keys(next).filter(k => k !== 'outs').forEach(key => next[key] = readNonNegative(`base-${key}`));
            const outs = ipToOuts(document.getElementById('base-outs').value);
            if (outs === null) throw new Error('投球局數格式必須是「整數.0、.1 或 .2」');
            next.outs = outs;
            player.stats = next;
          }
          await savePlayer(player);
          setStatus('基礎設定已儲存。');
          renderAll();
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      document.getElementById('deletePlayerBtn').addEventListener('click', async () => {
        try {
          await deleteSelectedPlayer();
        } catch (error) {
          setStatus(error.message || '刪除球員失敗。', true);
        }
      });
    }

    async function deletePlayerById(playerId) {
      const player = players.find(item => item.id === playerId);
      if (!player) return false;

      const firstConfirm = await showAppConfirm(
        `確定要刪除 #${player.number} ${player.name} 嗎？\n會一併刪除球員資料、照片與所有日期戰報。`,
        {
          title: '刪除球員',
          confirmText: '繼續',
          cancelText: '取消',
          tone: 'danger'
        }
      );
      if (!firstConfirm) return false;

      const secondConfirm = await showAppConfirm(
        `再次確認：永久刪除 #${player.number} ${player.name}？\n此操作無法復原。`,
        {
          title: '永久刪除確認',
          confirmText: '永久刪除',
          cancelText: '取消',
          tone: 'danger'
        }
      );
      if (!secondConfirm) return false;

      const gameRecords = await idbGetAll(STORES.games);
      const relatedGames = gameRecords.filter(record => record.playerId === player.id);
      const relatedPhotos = photos.filter(photo => photo.playerId === player.id);

      await Promise.all([
        idbDelete(STORES.players, player.id),
        ...relatedGames.map(record => idbDelete(STORES.games, record.key)),
        ...relatedPhotos.map(photo => idbDelete(STORES.photos, photo.id))
      ]);

      relatedPhotos.forEach(photo => photoImageCache.delete(photo.id));
      photos = photos.filter(photo => photo.playerId !== player.id);
      players = players.filter(item => item.id !== player.id);

      if (selectedPlayerId === player.id) {
        selectedPlayerId = [...players]
          .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))[0]?.id || null;
        currentRecord = null;
        currentPage = 'home';

        if (selectedPlayerId) {
          localStorage.setItem('baseballSelectedPlayerId', selectedPlayerId);
          selectedLevel = 'A';
          const nextPlayer = selectedPlayer();
          selectedSeason = availableSeasonYears(nextPlayer, 'A')[0] || CURRENT_YEAR;
          activatePlayerStatsProfile(nextPlayer, selectedSeason, selectedLevel);
          await loadRecord();
        } else {
          localStorage.removeItem('baseballSelectedPlayerId');
        }
      }

      renderAll();
      renderDeletePlayerList();
      setStatus(`已刪除球員 #${player.number} ${player.name}。`);
      return true;
    }

    async function deleteSelectedPlayer() {
      const player = selectedPlayer();
      if (!player) return;
      await deletePlayerById(player.id);
    }

    function renderDeletePlayerList() {
      if (!els.deletePlayerList) return;
      const list = [...players].sort((a,b) => String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric:true }));
      els.deletePlayerList.innerHTML = list.length ? list.map(player => {
        const meta = playerSourceMeta(player);
        return `
          <button class="press-btn player-search-result" type="button" data-delete-player-id="${player.id}">
            <span class="result-number">#${escapeHtml(player.number)}</span>
            <span class="result-main">
              <span class="result-name">${escapeHtml(player.name)}</span>
              <span class="result-meta">${escapeHtml(meta || '未連結中職資料')}</span>
            </span>
          </button>`;
      }).join('') : '<div class="empty">目前沒有球員。</div>';

      els.deletePlayerList.querySelectorAll('[data-delete-player-id]').forEach(button => {
        button.addEventListener('click', async () => {
          await deletePlayerById(button.dataset.deletePlayerId);
          if (!players.length) els.deletePlayerDialog?.close();
        });
      });
    }

    function hitterInput(label, key, value) {
      return `<label class="field">${label}<input id="base-${key}" type="number" min="0" step="1" value="${Number(value) || 0}" /></label>`;
    }

    function pitcherInput(label, key, value) { return hitterInput(label, key, value); }
    function hitterReadonly(label, value) {
      return `<label class="field">${label}<input type="number" value="${Number(value) || 0}" readonly /></label>`;
    }

    function readNonNegative(id) {
      const el = document.getElementById(id);
      const value = Number(el?.value || 0);
      if (!Number.isFinite(value) || value < 0) throw new Error('數值不可小於 0');
      return Math.floor(value);
    }

    function validateHitterBaseStats(stats) {
      if (stats.hr > stats.rbi) throw new Error('全壘打數不可大於打點');
      if (stats.hr > stats.runs) throw new Error('全壘打數不可大於得分');

      const recordedPlateAppearances =
        stats.ab + stats.bb + stats.ibb + stats.hbp + stats.sacBunt + stats.sacFly;
      if (recordedPlateAppearances > stats.pa) {
        throw new Error('打數、四壞、故意四壞、死球與兩種犧牲的合計不可大於打席');
      }
    }

    function renderToday(player) {
      const todayRole = activeTodayRole(player);
      todayRoleView = todayRole;

      const projected = projectedPlayerStatsForRole(player, todayRole);
      const stats = todayRole === 'hitter' ? hitterDerived(projected) : pitcherDerived(projected);
      const metricHtml = todayRole === 'hitter'
        ? `<div class="metric"><span>打擊率</span><strong>${fmtBatRate(stats.avg)}</strong></div>
           <div class="metric"><span>上壘率</span><strong>${fmtBatRate(stats.obp)}</strong></div>
           <div class="metric"><span>長打率</span><strong>${fmtBatRate(stats.slg)}</strong></div>`
        : `<div class="metric"><span>WHIP</span><strong>${fmtTwo(stats.whip)}</strong></div>
           <div class="metric"><span>防禦率</span><strong>${fmtTwo(stats.era)}</strong></div>
           <div class="metric"><span>勝／敗</span><strong>${projected.w || 0}／${projected.l || 0}</strong></div>`;

      const appearance = todayRole === 'hitter' ? ensureHitterAppearance() : null;
      const appearanceHtml = todayRole === 'hitter'
        ? `<label class="field" style="margin-top:10px">出賽方式
             <select id="hitterAppearanceMode">
               <option value="bat" ${appearance.mode === 'bat' ? 'selected' : ''}>先發／代打</option>
               <option value="runner" ${appearance.mode === 'runner' ? 'selected' : ''}>代跑</option>
               <option value="defense" ${appearance.mode === 'defense' ? 'selected' : ''}>純代守</option>
             </select>
           </label>`
        : '';

      const scope = playerScope(player);
      const linkedOverseas = scope === 'overseas' && player.externalProvider && player.externalPlayerId;
      const opponentField = scope === 'overseas'
        ? `<label class="field">今日對手
             <input id="opponentInput" type="text" maxlength="60" value="${escapeAttr(currentRecord.opponent || '')}" placeholder="輸入對手球隊" />
           </label>`
        : `<label class="field">今日對手
             <select id="opponentInput">${opponentOptions(currentRecord.opponent || '')}</select>
           </label>`;

      const importButton = player.cpblAcnt
        ? `<div class="section-actions" style="margin-top:8px"><button id="importCpblDailyBtn" class="press-btn primary">抓取 ${escapeHtml(els.gameDate.value.replaceAll('-', '/'))} 中職資料</button></div>
           <div class="small" style="margin-top:6px">會先查一軍，當日一軍無出賽再自動查二軍；若同場有打擊與投球，兩邊會一次匯入。${els.gameDate.value !== localISODate() ? ' 歷史日期只匯入該場資料，不會寫入球員累積數據。' : ''}</div>`
        : linkedOverseas
          ? `<div class="section-actions" style="margin-top:8px"><button id="importExternalDailyBtn" class="press-btn primary">抓取 ${escapeHtml(els.gameDate.value.replaceAll('-', '/'))} ${escapeHtml(overseasProviderLabel(player.externalProvider))} 資料</button></div>
             <div class="small" style="margin-top:6px">${['NPB','KBO'].includes(String(player.externalProvider||'').toUpperCase()) ? '會先查一軍，當日一軍無出賽再自動查二軍。' : ''} 若同場同時有打擊與投球，兩邊會一次匯入；單場資料不會重複累加到已同步的賽季成績。</div>`
          : '';

      const roles = todayAvailableRoles(player);
      const roleSwitchHtml = roles.length > 1
        ? `<div class="level-role-switch" style="margin-top:14px" aria-label="當日成績類型">
             ${roles.map(role => `
               <button type="button"
                 class="level-role-btn ${role === todayRole ? 'active' : ''}"
                 data-today-role="${role}">
                 ${role === 'pitcher' ? '投球成績' : '打擊成績'}
               </button>`).join('')}
           </div>`
        : '';

      els.content.innerHTML = `
        <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜今日狀況</h2>
        ${opponentField}
        ${importButton}
        ${roleSwitchHtml}
        ${appearanceHtml}
        <div class="metrics">${metricHtml}</div>
        <div id="todaySpecific"></div>`;

      const opponentInput = document.getElementById('opponentInput');
      if (scope !== 'overseas') syncOpponentSelectColor(opponentInput);
      opponentInput.addEventListener('change', async () => {
        currentRecord.opponent = opponentInput.value;
        if (scope !== 'overseas') syncOpponentSelectColor(opponentInput);
        await saveRecord();
        await renderCanvas();
      });
      if (scope === 'overseas') {
        opponentInput.addEventListener('input', () => {
          currentRecord.opponent = opponentInput.value;
          renderCanvas();
        });
      }

      document.querySelectorAll('[data-today-role]').forEach(button => {
        button.addEventListener('click', async () => {
          const nextRole = button.dataset.todayRole === 'pitcher' ? 'pitcher' : 'hitter';
          if (nextRole === todayRoleView) return;
          todayRoleView = nextRole;
          renderToday(player);
          await renderCanvas();
        });
      });

      document.getElementById('importCpblDailyBtn')?.addEventListener('click', async () => {
        try {
          await importCpblDaily(player);
        } catch (error) {
          setStatus(error.message || '抓取當日中職資料失敗。', true);
        }
      });

      document.getElementById('importExternalDailyBtn')?.addEventListener('click', async event => {
        const btn = event.currentTarget;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '正在抓取…';
        try {
          await importExternalDaily(player);
        } catch (error) {
          setStatus(error?.message || '抓取國外聯盟當日資料失敗。', true);
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });

      const appearanceMode = document.getElementById('hitterAppearanceMode');
      if (appearanceMode) {
        appearanceMode.addEventListener('change', async () => {
          const appearance = ensureHitterAppearance();
          appearance.mode = appearanceMode.value;
          await saveRecord();
          renderHitterToday();
          await renderCanvas();
        });
      }

      if (todayRole === 'hitter') renderHitterToday();
      else renderPitcherToday();
    }

    function renderHitterSubstitutionToday() {
      const host = document.getElementById('todaySpecific');
      const appearance = ensureHitterAppearance();
      const isRunner = appearance.mode === 'runner';
      const customInning = Number(appearance.inning) > 12 ? appearance.inning : '';
      const positionField = isRunner
        ? `<label id="subPositionWrap" class="field ${appearance.continueDefense ? '' : 'hidden'}">守備位置
             <select id="subPosition">${defensivePositionOptions(appearance.position)}</select>
           </label>`
        : `<label class="field">守備位置
             <select id="subPosition">${defensivePositionOptions(appearance.position)}</select>
           </label>`;

      host.innerHTML = `
        <h3>${isRunner ? '代跑紀錄' : '純代守紀錄'}</h3>
        <div class="panel" style="box-shadow:none;padding:14px;background:#f8fafc">
          <div class="grid four">
            <label class="field">局數
              <select id="subInning">${substitutionInningOptions(appearance.inning)}</select>
            </label>
            <label id="subOtherInningWrap" class="field ${Number(appearance.inning) > 12 ? '' : 'hidden'}">其他局數
              <input id="subOtherInning" type="number" min="1" step="1" inputmode="numeric" value="${escapeAttr(customInning)}" />
            </label>
            <label class="field">上／下半局
              <div class="half-switch">
                <button type="button" class="half-btn ${appearance.half === 'top' ? 'active' : ''}" data-sub-half="top">上半</button>
                <button type="button" class="half-btn ${appearance.half === 'bottom' ? 'active' : ''}" data-sub-half="bottom">下半</button>
              </div>
            </label>
            <label class="field">原棒次
              <select id="subBattingOrder">${battingOrderOptions(appearance.battingOrder)}</select>
            </label>
            ${positionField}
          </div>
          ${isRunner ? `<label class="check sub-check"><input id="subContinueDefense" type="checkbox" ${appearance.continueDefense ? 'checked' : ''} /> 下一個半局接替守備</label>` : ''}
        </div>`;

      const inningSelect = document.getElementById('subInning');
      const otherWrap = document.getElementById('subOtherInningWrap');
      const otherInput = document.getElementById('subOtherInning');

      inningSelect.addEventListener('change', async () => {
        if (inningSelect.value === '__other__') {
          otherWrap.classList.remove('hidden');
          if (!otherInput.value) otherInput.value = Number(appearance.inning) > 12 ? appearance.inning : '13';
          appearance.inning = otherInput.value;
        } else {
          otherWrap.classList.add('hidden');
          appearance.inning = inningSelect.value;
        }
        await saveRecord();
        await renderCanvas();
      });

      otherInput.addEventListener('input', () => {
        const value = Math.floor(Number(otherInput.value));
        if (Number.isFinite(value) && value >= 1) {
          appearance.inning = String(value);
          renderCanvas();
        }
      });

      otherInput.addEventListener('change', async () => {
        const value = Math.floor(Number(otherInput.value));
        if (!Number.isFinite(value) || value < 1) {
          await showAppAlert('其他局數請輸入正整數。', { title: '輸入有誤', tone: 'warning' });
          otherInput.value = Number(appearance.inning) > 12 ? appearance.inning : '13';
          return;
        }
        appearance.inning = String(value);
        otherInput.value = String(value);
        await saveRecord();
        await renderCanvas();
      });

      document.querySelectorAll('[data-sub-half]').forEach(button => {
        button.addEventListener('click', async () => {
          appearance.half = button.dataset.subHalf;
          document.querySelectorAll('[data-sub-half]').forEach(item => item.classList.toggle('active', item === button));
          await saveRecord();
          await renderCanvas();
        });
      });

      document.getElementById('subBattingOrder').addEventListener('change', async event => {
        appearance.battingOrder = event.target.value;
        await saveRecord();
        await renderCanvas();
      });

      document.getElementById('subPosition').addEventListener('change', async event => {
        appearance.position = event.target.value;
        await saveRecord();
        await renderCanvas();
      });

      const continueDefense = document.getElementById('subContinueDefense');
      if (continueDefense) {
        continueDefense.addEventListener('change', async () => {
          appearance.continueDefense = continueDefense.checked;
          document.getElementById('subPositionWrap').classList.toggle('hidden', !continueDefense.checked);
          await saveRecord();
          await renderCanvas();
        });
      }
    }

    function officialHitterRbiSummary(record = currentRecord) {
      const official = Math.max(0, Number(record?.internationalHitterGame?.rbi) || 0);
      const attributed = (Array.isArray(record?.hitterPAs) ? record.hitterPAs : [])
        .reduce((sum, pa) => sum + Math.max(0, Number(pa?.rbi) || 0), 0);
      return {
        official,
        attributed,
        unattributed: Math.max(0, official - attributed)
      };
    }

    function kboHitterRbiNeedsAggregateFallback(player, record = currentRecord) {
      if (!player || playerScope(player) !== 'overseas') return false;
      if (String(player.externalProvider || '').toUpperCase() !== 'KBO') return false;
      const summary = officialHitterRbiSummary(record);
      return summary.official > 0 && summary.unattributed > 0;
    }

    function renderHitterToday() {
      const player = selectedPlayer();
      const appearance = ensureHitterAppearance();
      if (appearance.mode !== 'bat') {
        renderHitterSubstitutionToday();
        return;
      }
      const host = document.getElementById('todaySpecific');
      const officialBox = currentRecord?.internationalHitterGame;
      const aggregateOnly = Boolean(currentRecord?.externalReadOnlyImport && officialBox && !currentRecord.hitterPAs.length);
      const aggregateFields = aggregateOnly ? [
        ['打席', officialBox.pa], ['打數', officialBox.ab], ['安打', officialBox.hits], ['打點', officialBox.rbi],
        ['得分', officialBox.runs], ['全壘打', officialBox.hr], ['保送', officialBox.bb], ['死球', officialBox.hbp],
        ['三振', officialBox.k], ['二安', officialBox.double], ['三安', officialBox.triple], ['失誤', officialBox.errors]
      ] : [];
      const officialAggregateHtml = aggregateOnly ? `
        <h3>官方單場打擊成績</h3>
        <div class="small" style="margin-bottom:10px">目前來源只確認到 Box Score 彙總；你仍可在下方手動補逐打席，補完後戰報會改用逐打席顯示。</div>
        <div class="grid four" style="margin-bottom:14px">
          ${aggregateFields.map(([label,value]) => `<label class="field">${escapeHtml(label)}<input type="text" value="${escapeAttr(String(Number(value)||0))}" readonly /></label>`).join('')}
        </div>` : '';
      const rows = currentRecord.hitterPAs.map((pa, index) => `
        <div class="pa-row">
          <div class="pa-no">${index + 1}</div>
          <div class="pa-result">${escapeHtml(paLabel(pa))}</div>
          <div class="pa-rbi">${pa.rbi ? `${pa.rbi} 打點` : ''}</div>
          <button class="press-btn edit-btn" data-edit-pa="${index}">編輯</button>
          <button class="press-btn danger" data-delete-pa="${index}">刪除</button>
        </div>`).join('');

      const rbiSummary = officialHitterRbiSummary(currentRecord);
      const kboRbiNote = kboHitterRbiNeedsAggregateFallback(player, currentRecord)
        ? `<div class="small" style="margin:-2px 2px 12px;color:#8b651f;font-weight:800">KBO 官方 Box：本場共 ${rbiSummary.official} 打點；其中 ${rbiSummary.attributed} 打點可對應到特定打席，其餘以官方總打點顯示。</div>`
        : '';

      host.innerHTML = `
        ${officialAggregateHtml}
        <h3>${aggregateOnly ? '手動補逐打席' : '逐打席紀錄'}</h3>
        <div class="pa-list">${rows || '<div class="small" style="padding:8px 2px 12px">目前沒有逐打席，可直接在下方新增。</div>'}</div>
        ${kboRbiNote}
        <div class="panel" style="box-shadow:none;padding:14px;background:#f8fafc">
          <h3 style="margin-top:0">第 ${currentRecord.hitterPAs.length + 1} 打席</h3>
          <div class="grid four">
            <label class="field">大分類
              <select id="paMajor">
                <option value="onbase">上壘</option>
                <option value="out">出局</option>
              </select>
            </label>
            <label class="field">小分類
              <select id="paResult"></select>
            </label>
            <label id="paPositionWrap" class="field hidden">守備位置
              <select id="paPosition"></select>
            </label>
            <label class="field">打點
              <select id="paRbi">${numberOptions(4, 0)}</select>
            </label>
          </div>
          <div class="section-actions">
            <button id="confirmPaBtn" class="press-btn primary">確定此打席</button>
          </div>
        </div>`;

      const major = document.getElementById('paMajor');
      const result = document.getElementById('paResult');
      const posWrap = document.getElementById('paPositionWrap');
      const pos = document.getElementById('paPosition');
      const rbi = document.getElementById('paRbi');

      function selectedPaParts() {
        const [code, ...officialParts] = String(result.value || '').split('::');
        return { code, officialAction: officialParts.join('::') };
      }

      function refreshRbiOptions() {
        const previous = Number(rbi.value) || 0;
        const { code } = selectedPaParts();
        let min = 0;
        let max = 4;
        const noRbiResults = new Set(['K', 'KREACH', 'DP', 'TP', 'INT', 'OUT']);
        if (['BB', 'IBB', 'HBP', 'CI'].includes(code)) max = 1;
        if (code === 'HR') min = 1;
        if (noRbiResults.has(code)) min = max = 0;

        let html = '';
        for (let value = min; value <= max; value++) {
          html += `<option value="${value}">${value}</option>`;
        }
        rbi.innerHTML = html;
        rbi.value = String(Math.min(max, Math.max(min, previous)));
        rbi.disabled = noRbiResults.has(code);
      }

      function refreshResults() {
        const onbase = [
          ['1B','一安'],['1B::內安','內安'],['1B::場安','場安'],
          ['2B','二安'],['2B::內二','內二'],['2B::場二','場二'],
          ['3B','三安'],['3B::內三','內三'],['3B::場三','場三'],
          ['HR','全壘打'],['HR::全打','全打'],['HR::內全','內全'],
          ['BB','四壞'],['IBB','故意四壞'],['HBP','死球'],
          ['FC','野選'],
          ['E','失誤'],['E::投失','投失'],['E::捕失','捕失'],['E::一失','一失'],['E::二失','二失'],['E::三失','三失'],['E::游失','游失'],['E::左失','左失'],['E::中失','中失'],['E::右失','右失'],['E::雙誤','雙誤'],
          ['CI::礙打','礙打'],['KREACH::不死三振','不死三振'],['OBS','礙跑']
        ];
        const out = [
          ['K','三振'],['GO','滾地出局'],['FO','飛球出局'],['FO::內飛','內飛'],['FO::界飛','界飛'],
          ['DP','雙殺'],['TP','三殺'],
          ['SH','犧牲短打'],['SH::犧短','犧短'],['SH::犧短誤','犧短誤'],['SH::犧選','犧選'],['SH::犧選誤','犧選誤'],
          ['SF','犧牲高飛'],['SF::犧飛','犧飛'],['SF::界犧飛','界犧飛'],['SF::犧飛誤','犧飛誤'],
          ['INT','礙守'],['OUT::裁決','裁決'],['OUT::違規','違規'],['OUT::觸球','觸球'],['OUT::觸傳球','觸傳球'],['OUT::三呎線','三呎線']
        ];
        const list = major.value === 'onbase' ? onbase : out;
        result.innerHTML = list.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
        refreshPosition();
        refreshRbiOptions();
      }

      function refreshPosition() {
        const { code, officialAction } = selectedPaParts();
        const needs = (code === 'GO' || code === 'FO') && !officialAction;
        posWrap.classList.toggle('hidden', !needs);
        if (!needs) return;
        const positions = code === 'FO'
          ? [['一','一飛'],['二','二飛'],['三','三飛'],['投','投飛'],['捕','捕飛'],['游','游飛'],['左','左飛'],['中','中飛'],['右','右飛'],['內','內飛'],['界','界飛']]
          : [['一','一滾'],['二','二滾'],['三','三滾'],['投','投滾'],['捕','捕滾'],['游','游滾'],['左','左滾'],['中','中滾'],['右','右滾']];
        pos.innerHTML = positions.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
      }

      major.addEventListener('change', refreshResults);
      result.addEventListener('change', () => {
        refreshPosition();
        refreshRbiOptions();
      });
      refreshResults();

      document.getElementById('confirmPaBtn').addEventListener('click', async () => {
        const { code, officialAction } = selectedPaParts();
        const rbiValue = Number(rbi.value) || 0;
        if (['BB', 'IBB', 'HBP', 'CI'].includes(code) && rbiValue > 1) {
          await showAppAlert('此上壘方式最多只能有 1 打點。', { title: '打點設定有誤', tone: 'warning' });
          return;
        }
        if (code === 'HR' && rbiValue < 1) {
          await showAppAlert('全壘打至少要有 1 打點。', { title: '打點設定有誤', tone: 'warning' });
          return;
        }
        if (['K', 'KREACH', 'DP', 'TP', 'INT', 'OUT'].includes(code) && rbiValue !== 0) {
          await showAppAlert('此出局／特殊結果不可設定打點。', { title: '打點設定有誤', tone: 'warning' });
          return;
        }
        currentRecord.hitterPAs.push({
          id: uid(), code,
          position: ((code === 'GO' || code === 'FO') && !officialAction) ? pos.value : '',
          rbi: rbiValue,
          cpblOfficialAction: officialAction
        });
        await saveRecord();
        renderAll();
      });

      host.querySelectorAll('[data-delete-pa]').forEach(btn => {
        btn.addEventListener('click', async () => {
          currentRecord.hitterPAs.splice(Number(btn.dataset.deletePa), 1);
          await saveRecord();
          renderAll();
        });
      });

      host.querySelectorAll('[data-edit-pa]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const index = Number(btn.dataset.editPa);
          const pa = currentRecord.hitterPAs[index];
          currentRecord.hitterPAs.splice(index, 1);
          await saveRecord();
          renderAll();
          setTimeout(() => fillPaForm(pa), 0);
        });
      });
    }

    function fillPaForm(pa) {
      const onbaseCodes = ['1B','2B','3B','HR','BB','IBB','HBP','CI','FC','E','KREACH','OBS'];
      const major = document.getElementById('paMajor');
      const result = document.getElementById('paResult');
      if (!major || !result) return;
      major.value = onbaseCodes.includes(pa.code) ? 'onbase' : 'out';
      major.dispatchEvent(new Event('change'));
      const officialValue = pa.cpblOfficialAction ? `${pa.code}::${pa.cpblOfficialAction}` : pa.code;
      result.value = Array.from(result.options).some(option => option.value === officialValue) ? officialValue : pa.code;
      result.dispatchEvent(new Event('change'));
      const pos = document.getElementById('paPosition');
      if (pos && pa.position) pos.value = pa.position;
      document.getElementById('paRbi').value = pa.rbi || 0;
    }

    function renderPitcherToday() {
      const player = selectedPlayer();
      const g = currentRecord.pitcherGame;
      const result = pitcherResult(g);
      const combinedFreePasses = Boolean(currentRecord?.externalWalksCombined);
      const host = document.getElementById('todaySpecific');
      host.innerHTML = `
        <h3>投球戰績</h3>
        <div class="grid four">
          <label class="field">投球局數
            <select id="pInnings">${pitcherInningsOptions(g.innings)}</select>
          </label>
          <label id="pInningsOtherWrap" class="field ${isPresetPitcherInnings(g.innings) ? 'hidden' : ''}">其他局數
            <input id="pInningsOther" type="text" inputmode="decimal" placeholder="例如 0.2、13.1" value="${isPresetPitcherInnings(g.innings) ? '' : escapeAttr(g.innings)}" />
          </label>
          <label class="field">三振<select id="pK">${numberOptions(36, g.k)}</select></label>
          <label class="field">${combinedFreePasses ? '四死球合計（KBO二軍）' : '保送(故意四壞球)'}<select id="pBB">${numberOptions(36, g.bb)}</select></label>
          <label class="field">被安打<select id="pH">${numberOptions(36, g.h)}</select></label>
          <label class="field">${combinedFreePasses ? '死球（已含於四死球合計）' : '死球'}<select id="pHBP" ${combinedFreePasses ? 'disabled' : ''}>${numberOptions(10, g.hbp)}</select></label>
          <label class="field">其他上壘(判斷完全比賽用)<select id="pOtherReach">${numberOptions(10, g.otherReach || 0)}</select></label>
          <label class="field">失分<select id="pR">${numberOptions(15, g.r)}</select></label>
          <label class="field">自責分<select id="pER">${numberOptions(Math.min(15, Number(g.r) || 0), Math.min(Number(g.er) || 0, Number(g.r) || 0))}</select></label>
          <label class="field">用球數（前段）<select id="pPitchTens">${numberOptions(15, g.pitchTens)}</select></label>
          <label class="field">用球數（個位）<select id="pPitchOnes">${numberOptions(9, g.pitchOnes)}</select></label>
          <label class="field">最後一格顯示
            <select id="pLastMetric">${pitcherLastMetricOptions(player?.pitcherLastMetric)}</select>
          </label>
        </div>

        <h3>特殊紀錄</h3>
        <div class="inline-checks">
          ${checkHtml('pCG','完投',g.cg)}
          ${checkHtml('pSHO','完封',g.sho)}
          ${checkHtml('pNoWH','無四死球',g.noWalkHbp)}
        </div>

        <h3>投手結果（五選一）</h3>
        <div class="inline-checks">
          ${resultRadioHtml('pResultSV','SV','救援成功',result)}
          ${resultRadioHtml('pResultHLD','HLD','中繼成功',result)}
          ${resultRadioHtml('pResultW','W','勝',result)}
          ${resultRadioHtml('pResultL','L','敗',result)}
          ${resultRadioHtml('pResultND','ND','無關勝敗',result)}
        </div>

        <h3>其他結果</h3>
        <div class="inline-checks">
          ${checkHtml('pBSV','救援失敗',g.bsv)}
          ${checkHtml('pRainCalled','因雨提前裁定',g.rainCalled)}
        </div>`;

      const inningPreset = document.getElementById('pInnings');
      const inningOther = document.getElementById('pInningsOther');
      const inningOtherWrap = document.getElementById('pInningsOtherWrap');
      inningPreset.addEventListener('change', async () => {
        const isOther = inningPreset.value === '__other__';
        inningOtherWrap.classList.toggle('hidden', !isOther);
        if (isOther) {
          if (isPresetPitcherInnings(g.innings)) inningOther.value = '';
          inningOther.focus();
          return;
        }
        await updatePitcherGameFromUI();
      });
      inningOther.addEventListener('change', async () => {
        if (ipToOuts(inningOther.value) === null) {
          await showAppAlert('投球局數請輸入整數，或以 .1／.2 表示未滿一局，例如 0.2、13.1。', { title: '投球局數格式錯誤', tone: 'warning' });
          inningOther.value = g.innings;
          return;
        }
        await updatePitcherGameFromUI();
      });
      const lastMetricSelect = document.getElementById('pLastMetric');
      lastMetricSelect.addEventListener('change', async () => {
        if (!player) return;
        player.pitcherLastMetric = normalizePitcherLastMetric(lastMetricSelect.value);
        await savePlayer(player);
        await renderCanvas();
      });

      const ids = ['pK','pBB','pH','pHBP','pOtherReach','pR','pER','pPitchTens','pPitchOnes'];
      ids.forEach(id => document.getElementById(id).addEventListener('change', updatePitcherGameFromUI));
      ['pCG','pSHO','pNoWH','pBSV','pRainCalled'].forEach(id => document.getElementById(id).addEventListener('change', async () => {
        syncPitcherDependencies(id);
        await updatePitcherGameFromUI();
      }));
      document.querySelectorAll('input[name="pitcherResult"]').forEach(r => r.addEventListener('change', async event => {
        syncPitcherDependencies(event.target.id);
        await updatePitcherGameFromUI();
      }));
      syncPitcherDependencies();
      if (Number(g.pitchTens) === 15) document.getElementById('pPitchOnes').disabled = true;
    }

    function checkHtml(id, label, checked) {
      return `<label class="check"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''} /> ${label}</label>`;
    }

    function radioHtml(name, value, label, selected) {
      return `<label class="check"><input type="radio" name="${name}" value="${value}" ${selected === value ? 'checked' : ''} /> ${label}</label>`;
    }

    function resultRadioHtml(id, value, label, selected) {
      return `<label class="check"><input id="${id}" type="radio" name="pitcherResult" value="${value}" ${selected === value ? 'checked' : ''} /> ${label}</label>`;
    }

    function syncPitcherDependencies(changedId = '') {
      const cg = document.getElementById('pCG');
      const sho = document.getElementById('pSHO');
      const noWH = document.getElementById('pNoWH');
      const resultSV = document.getElementById('pResultSV');
      const resultHLD = document.getElementById('pResultHLD');
      const resultND = document.getElementById('pResultND');
      const bsv = document.getElementById('pBSV');
      const inningsInput = document.getElementById('pInnings');
      const runsInput = document.getElementById('pR');
      const erInput = document.getElementById('pER');
      const rainCalled = document.getElementById('pRainCalled');
      if (!cg || !sho || !noWH || !resultSV || !resultHLD || !resultND || !bsv || !inningsInput || !runsInput || !erInput) return;

      const outs = ipToOuts(getPitcherInningsFromUI()) || 0;
      const runs = Number(runsInput.value) || 0;
      const cgEligible = outs >= 15;
      const shoEligible = cg.checked && outs >= 15 && runs === 0;
      const rainCalledEligible = cg.checked && outs >= 15;

      if (!rainCalledEligible) rainCalled.checked = false;
      rainCalled.disabled = !rainCalledEligible;

      if (!cgEligible) cg.checked = false;
      cg.disabled = !cgEligible;

      if (!shoEligible) sho.checked = false;
      sho.disabled = !shoEligible;

      if (!cg.checked) { sho.checked = false; noWH.checked = false; }
      if (!sho.checked) noWH.checked = false;
      noWH.disabled = !sho.checked;

      if (cg.checked && (resultSV.checked || resultHLD.checked)) resultND.checked = true;
      resultSV.disabled = cg.checked;
      resultHLD.disabled = cg.checked;

      if (cg.checked) bsv.checked = false;
      bsv.disabled = cg.checked;

      if (changedId === 'pBSV' && bsv.checked && (resultSV.checked || resultHLD.checked)) {
        resultND.checked = true;
      }
      if ((changedId === 'pResultSV' || changedId === 'pResultHLD') && (resultSV.checked || resultHLD.checked)) {
        bsv.checked = false;
      }
      if (resultSV.checked || resultHLD.checked) bsv.checked = false;

      if ((Number(erInput.value) || 0) > runs) erInput.value = String(runs);
    }

    async function updatePitcherGameFromUI() {
      const g = currentRecord.pitcherGame;
      const inningsValue = getPitcherInningsFromUI();
      if (ipToOuts(inningsValue) === null) return;
      g.innings = inningsValue;
      g.k = Number(document.getElementById('pK').value);
      g.bb = Number(document.getElementById('pBB').value);
      g.h = Number(document.getElementById('pH').value);
      g.hbp = Number(document.getElementById('pHBP').value);
      g.otherReach = Number(document.getElementById('pOtherReach').value);
      g.r = Number(document.getElementById('pR').value);
      g.er = Math.min(g.r, Number(document.getElementById('pER').value));
      g.pitchTens = Number(document.getElementById('pPitchTens').value);
      g.pitchOnes = Number(document.getElementById('pPitchOnes').value);
      if (g.pitchTens === 15) {
        g.pitchOnes = 0;
        document.getElementById('pPitchOnes').value = '0';
        document.getElementById('pPitchOnes').disabled = true;
      } else {
        document.getElementById('pPitchOnes').disabled = false;
      }
      syncPitcherDependencies('metrics');
      g.cg = document.getElementById('pCG').checked;
      g.sho = document.getElementById('pSHO').checked;
      g.noWalkHbp = document.getElementById('pNoWH').checked;
      g.result = document.querySelector('input[name="pitcherResult"]:checked')?.value || 'ND';
      g.hld = g.result === 'HLD';
      g.sv = g.result === 'SV';
      g.bsv = document.getElementById('pBSV').checked && !g.hld && !g.sv;
      g.rainCalled = document.getElementById('pRainCalled').checked;
      g.decision = ['W','L','ND'].includes(g.result) ? g.result : 'ND';
      await saveRecord();
      renderAll();
    }

    function renderPhotos(player) {
      const selectedPhoto = photos.find(photo => photo.id === player.selectedPhotoId && photo.playerId === player.id);
      const selectedTransform = selectedPhoto ? getPhotoTransform(player, selectedPhoto.id) : null;
      const zoomPercent = selectedTransform ? Math.round(selectedTransform.scale * 100) : 100;

      els.content.innerHTML = `
        <h2>照片</h2>
        <label class="field">上傳照片
          <input id="photoUpload" type="file" accept="image/*" />
        </label>
        ${selectedPhoto ? `
          <div class="panel" style="box-shadow:none;padding:14px;margin-top:14px;background:#f8fafc">
            <label class="field">照片縮放
              <div style="display:flex;align-items:center;gap:12px">
                <input id="photoZoom" type="range" min="100" max="300" step="5" value="${zoomPercent}" style="flex:1" />
                <strong id="photoZoomValue" style="min-width:58px;text-align:right">${zoomPercent}%</strong>
              </div>
            </label>
            <div class="section-actions" style="margin-top:10px">
              <button id="resetPhotoTransformBtn" class="press-btn">重設位置與縮放</button>
            </div>
          </div>` : ''}
        <div id="photoGrid" class="photo-grid"></div>`;

      document.getElementById('photoUpload').addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return setStatus('請選擇圖片檔。', true);
        const photo = { id: uid(), playerId: player.id, name: file.name, blob: file, createdAt: Date.now() };
        await idbPut(STORES.photos, photo);
        photos.push(photo);
        if (!player.selectedPhotoId) {
          player.selectedPhotoId = photo.id;
          getPhotoTransform(player, photo.id);
          await savePlayer(player);
        }
        setStatus('照片已保存到目前球員。');
        renderPhotos(player);
        await renderCanvas();
      });

      if (selectedPhoto) {
        const zoomInput = document.getElementById('photoZoom');
        const zoomValue = document.getElementById('photoZoomValue');
        zoomInput.addEventListener('input', async () => {
          try {
            const image = await getPhotoImage(selectedPhoto);
            const current = getPhotoTransform(player, selectedPhoto.id);
            const next = clampPhotoTransform(image, {
              ...current,
              scale: Number(zoomInput.value) / 100
            });
            ensurePhotoTransforms(player)[selectedPhoto.id] = next;
            zoomValue.textContent = `${Math.round(next.scale * 100)}%`;
            renderCanvas();
          } catch {
            setStatus('照片載入失敗。', true);
          }
        });
        zoomInput.addEventListener('change', async () => {
          await savePlayer(player);
          setStatus('照片縮放比例已保存。');
        });

        document.getElementById('resetPhotoTransformBtn').addEventListener('click', async () => {
          ensurePhotoTransforms(player)[selectedPhoto.id] = { x: 0, y: 0, scale: 1 };
          await savePlayer(player);
          renderPhotos(player);
          renderCanvas();
          setStatus('照片位置與縮放已重設。');
        });
      }

      renderPhotoGrid(player);
    }

    function renderPhotoGrid(player) {
      const grid = document.getElementById('photoGrid');
      if (!grid) return;
      const ownedPhotos = playerPhotos(player).sort((a,b) => b.createdAt - a.createdAt);
      if (!ownedPhotos.length) {
        grid.innerHTML = '';
        return;
      }
      grid.innerHTML = '';
      for (const photo of ownedPhotos) {
        const url = URL.createObjectURL(photo.blob);
        const card = document.createElement('div');
        card.className = `photo-card ${player.selectedPhotoId === photo.id ? 'selected' : ''}`;
        card.innerHTML = `
          <img alt="${escapeAttr(photo.name)}" />
          <div class="subtle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(photo.name)}</div>
          <div class="photo-actions">
            <button class="press-btn select-photo">選用</button>
            <button class="press-btn danger delete-photo">刪除</button>
          </div>`;
        card.querySelector('img').src = url;
        card.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
        card.querySelector('.select-photo').addEventListener('click', async () => {
          player.selectedPhotoId = photo.id;
          getPhotoTransform(player, photo.id);
          await savePlayer(player);
          renderPhotos(player);
          renderCanvas();
        });
        card.querySelector('.delete-photo').addEventListener('click', async () => {
          await idbDelete(STORES.photos, photo.id);
          photos = photos.filter(p => p.id !== photo.id);
          photoImageCache.delete(photo.id);
          if (player.selectedPhotoId === photo.id) player.selectedPhotoId = null;
          if (player.photoTransforms) delete player.photoTransforms[photo.id];
          await savePlayer(player);
          renderPhotos(player);
          renderCanvas();
        });
        grid.appendChild(card);
      }
    }

    function renderHomeTemplates() {
      if (!els.homeTemplateGrid) return;
      els.homeTemplateGrid.innerHTML = '';
      Object.entries(TEMPLATES).forEach(([key, template]) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `template-card ${currentTemplate === key ? 'selected' : ''}`;
        card.disabled = !template.enabled;
        card.innerHTML = `
          <canvas class="template-preview" width="300" height="300" aria-label="${escapeAttr(template.label)}預覽"></canvas>
          <div class="template-card-title">
            <span>${escapeHtml(template.label)}</span>
            <span class="template-card-status">${template.enabled ? (currentTemplate === key ? '使用中' : '選用') : '預留'}</span>
          </div>`;
        drawTemplatePreview(card.querySelector('.template-preview'), template, !template.enabled);
        if (template.enabled) {
          card.addEventListener('click', () => {
            currentTemplate = key;
            localStorage.setItem('baseballCardTemplate', currentTemplate);
            renderHomeTemplates();
            if (selectedPlayer()) renderCanvas();
          });
        }
        els.homeTemplateGrid.appendChild(card);
      });
    }

    function renderQuickTemplates() {
      if (!els.quickTemplateGrid) return;
      els.quickTemplateGrid.innerHTML = '';
      Object.entries(TEMPLATES).forEach(([key, template]) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `template-card ${currentTemplate === key ? 'selected' : ''}`;
        card.disabled = !template.enabled;
        card.innerHTML = `
          <canvas class="template-preview" width="320" height="320" aria-label="${escapeAttr(template.label)}預覽"></canvas>
          <div class="template-card-title">
            <span>${escapeHtml(template.label)}</span>
            <span class="template-card-status">${template.enabled ? (currentTemplate === key ? '使用中' : '選用') : '預留'}</span>
          </div>`;
        drawTemplatePreview(card.querySelector('.template-preview'), template, !template.enabled);
        if (template.enabled) {
          card.addEventListener('click', async () => {
            currentTemplate = key;
            localStorage.setItem('baseballCardTemplate', currentTemplate);
            renderHomeTemplates();
            renderQuickTemplates();
            try {
              await refreshPreparedOutputFromCanvas();
              els.quickTemplateDialog?.close();
              showAppToast('背景已更換');
            } catch (error) {
              setStatus(error?.message || '背景切換失敗。', true);
            }
          });
        }
        els.quickTemplateGrid.appendChild(card);
      });
    }

    function renderTemplates() {
      els.content.innerHTML = `
        <h2>背景</h2>
        <div class="subtle">點選縮圖切換背景。每個背景的版面、照片裁切與字體大小皆獨立設定。</div>
        <div id="templateGrid" class="template-grid"></div>`;

      const grid = document.getElementById('templateGrid');
      Object.entries(TEMPLATES).forEach(([key, template]) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `template-card ${currentTemplate === key ? 'selected' : ''}`;
        card.disabled = !template.enabled;
        card.innerHTML = `
          <canvas class="template-preview" width="360" height="360" aria-label="${escapeAttr(template.label)}預覽"></canvas>
          <div class="template-card-title">
            <span>${escapeHtml(template.label)}</span>
            <span class="template-card-status">${template.enabled ? (currentTemplate === key ? '使用中' : '可選用') : '預留'}</span>
          </div>`;

        drawTemplatePreview(card.querySelector('.template-preview'), template, !template.enabled);

        if (template.enabled) {
          card.addEventListener('click', () => {
            currentTemplate = key;
            localStorage.setItem('baseballCardTemplate', currentTemplate);
            renderTemplates();
            renderCanvas();
          });
        }
        grid.appendChild(card);
      });
    }

    function drawTemplatePreview(canvas, template, placeholder = false) {
      const ctx = canvas.getContext('2d');
      const scale = canvas.width / 1080;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (template.style) {
        ctx.save();
        ctx.scale(scale, scale);
        drawStyledTemplateBackground(ctx, template, '#d7ad52');
        if (template.style === 'baseball-q') drawBg2Header(ctx, template, '對手', '2026.09.06', '#d7ad52');
        else drawStyledHeader(ctx, template, '對手', '2026.09.06', '#d7ad52');

        template.metricCards.forEach(card => {
          if (template.style === 'baseball-q') drawBg2MetricFrame(ctx, card);
          else drawStyledMetricFrame(ctx, card);
        });

        if (template.detail?.drawBox !== false) {
          roundRect(ctx, template.detail.x, template.detail.y, template.detail.w, template.detail.h, template.detail.r || 0, template.detail.bg);
        }
        if (template.detail?.positioned) {
          drawStyledDetailHeading(ctx, '逐打席', template.detail);
        }

        drawPhotoFrameBase(ctx, template.photo);
        if (template.name.plateBg) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(
            template.name.plateX,
            template.name.plateY,
            template.name.plateW,
            template.name.plateH,
            template.name.plateR || 0
          );
          ctx.fillStyle = template.name.plateBg;
          ctx.fill();
          if (template.name.plateBorder) {
            ctx.strokeStyle = template.name.plateBorder;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.fillStyle = template.name.color || '#ffffff';
        ctx.font = `900 ${template.fonts.playerName || 42}px "Microsoft JhengHei", Arial, sans-serif`;
        ctx.fillText('#81 球員名字', template.name.textX, template.name.textY);
        ctx.fillStyle = template.name.lineColor || '#d7ad52';
        ctx.fillRect(template.name.lineX, template.name.lineY, template.name.lineW, template.name.lineH || 3);
        ctx.restore();
      } else {
        const S = value => value * scale;
        const frameSize = template.frameSize || 18;

        ctx.fillStyle = '#d7ad52';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = template.innerBg;
        ctx.fillRect(S(frameSize), S(frameSize), canvas.width - S(frameSize * 2), canvas.height - S(frameSize * 2));

        const drawBox = box => {
          if (!box || box.drawBox === false) return;
          ctx.fillStyle = box.bg;
          ctx.beginPath();
          ctx.roundRect(S(box.x), S(box.y), S(box.w), S(box.h), S(box.r || 0));
          ctx.fill();
        };

        drawBox(template.header);
        template.metricCards.forEach(drawBox);
        drawBox(template.detail);
        drawBox(template.photo);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(S(template.name.textX), S(template.name.textY - 22), S(240), S(12));
        ctx.fillStyle = '#d7ad52';
        ctx.fillRect(S(template.name.lineX), S(template.name.lineY), S(template.name.lineW), Math.max(2, S(5)));
      }

      if (placeholder) {
        ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(canvas.width * 0.055)}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText('預留', canvas.width / 2, canvas.height / 2);
      }
    }

    function renderContent() {
      const player = selectedPlayer();
      setTimeout(() => {
        if (currentPage === 'player' && selectedPlayerId === player?.id) renderSyncMetaBanner(player);
      }, 0);
      els.selectedPlayerText.textContent = player ? `#${player.number} ${player.name}（${player.type === 'pitcher' ? '投手' : '打者'}）` : '';
      if (!player) {
        els.content.innerHTML = '';
        return;
      }
      if (selectedTab === 'base' || selectedTab === 'minor') renderLeagueLevelStatsPage(player);
      if (selectedTab === 'secondary' && supportsUsDualRoleTabs(player)) renderSelectedLevelSecondaryRole(player);
      if (selectedTab === 'today') {
        if (playerScope(player) === 'international') {
          els.content.innerHTML = '<div class="intl-flow-empty">正在讀取本屆逐場比賽…</div>';
          void renderInternationalGamesTab(player);
        } else {
          renderToday(player);
        }
      }
      if (selectedTab === 'photos') renderPhotos(player);
    }

    function updateHomePaneHeight() {
      const layout = document.querySelector('#homePage .home-layout');
      if (!layout || currentPage !== 'home') return;
      const viewportHeight = Number(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
      if (!viewportHeight) return;
      const top = layout.getBoundingClientRect().top;
      const safeBottom = 8;
      const height = Math.max(320, Math.floor(viewportHeight - top - safeBottom));
      layout.style.height = `${height}px`;
    }

    function renderAll() {
      const player = selectedPlayer();
      const playerPageActive = currentPage === 'player' && Boolean(player);

      els.homePage?.classList.toggle('hidden', playerPageActive);
      els.playerPage?.classList.toggle('hidden', !playerPageActive);
      if (els.pageSubtitle) {
        els.pageSubtitle.textContent = playerPageActive
          ? (playerScope(player) === 'international'
              ? `${playerSpecialCompetition(player)}｜${internationalEdition(player)}｜${internationalTeam(player)}`
              : `球員設定｜${scopeLabel(playerScope(player))}`)
          : homePageBreadcrumb();
      }
      if (els.selectedPlayerText) {
        els.selectedPlayerText.textContent = playerPageActive
          ? `#${player.number} ${player.name}（${player.type === 'pitcher' ? '投手' : '打者'}｜${scopeLabel(playerScope(player))}）`
          : '';
      }
      els.homeHeaderDateControl?.classList.toggle('hidden', playerPageActive);
      const playerScopeCode = player ? playerScope(player) : 'cpbl';
      if (els.playerPageDate) {
        if (playerScopeCode === 'international') {
          const gameDate = internationalSelectedGameKey && currentRecord?.internationalOfficialImport
            ? String(currentRecord.date || '')
            : '';
          els.playerPageDate.textContent = gameDate ? `比賽日期｜${gameDate.replaceAll('-', '/')}` : '';
        } else {
          els.playerPageDate.textContent = els.gameDate.value ? `日期｜${els.gameDate.value.replaceAll('-', '/')}` : '';
        }
      }
      const externalPlayer = playerScopeCode !== 'cpbl';
      els.playerLevelSwitch?.classList.add('hidden');
      els.externalScopeBadge?.classList.toggle('hidden', !externalPlayer);
      if (els.externalScopeBadge && externalPlayer && player) {
        els.externalScopeBadge.className = `external-scope-badge ${playerScopeCode}`;
        const usEntry = isUsPlayer(player) ? currentUsCareerEntry(player) : null;
        els.externalScopeBadge.textContent = usEntry
          ? ['美國職棒', usEntry.year, usEntry.organizationName || usEntry.teamName, usEntry.level].filter(Boolean).join('｜')
          : [
              scopeLabel(playerScopeCode),
              playerSpecialCompetition(player),
              playerScopeCode === 'international' ? internationalTeam(player) : (player.externalTeam || ''),
              Number(selectedSeason || player.externalYear) || ''
            ].filter(Boolean).join('｜');
      }
      els.majorLevelBtn?.classList.toggle('active', selectedLevel === 'A');
      els.minorLevelBtn?.classList.toggle('active', selectedLevel === 'D');
      if (els.seasonSelect && player) {
        const linkedOverseas = playerScopeCode === 'overseas' && Boolean(player.externalProvider && player.externalPlayerId);
        if (isUsPlayer(player)) {
          const entries = usCareerEntries(player);
          const active = currentUsCareerEntry(player);
          if (active) selectedSeason = Number(active.year) || selectedSeason;
          els.seasonSelect.innerHTML = seasonOptionsHtml(player);
          els.seasonSelect.disabled = !linkedOverseas || entries.length === 0;
          els.seasonSelect.value = active ? String(active.key) : '';
        } else {
          const years = availableSeasonYears(player, selectedLevel);
          if (years.length && !years.includes(selectedSeason)) selectedSeason = years[0];
          els.seasonSelect.innerHTML = seasonOptionsHtml(player);
          els.seasonSelect.disabled = years.length === 0 || (externalPlayer && !linkedOverseas);
          els.seasonSelect.value = years.length ? String(selectedSeason) : '';
        }
      }

      syncAppPickerLabels();

      const baseTab = document.querySelector('.tab-btn[data-tab="base"]');
      const minorTab = document.querySelector('.tab-btn[data-tab="minor"]');
      const secondaryTab = document.querySelector('.tab-btn[data-tab="secondary"]');
      const todayTab = document.querySelector('.tab-btn[data-tab="today"]');
      const photosTab = document.querySelector('.tab-btn[data-tab="photos"]');
      const levelTabs = supportsLeagueLevelTabs(player);
      const usDualTabs = supportsUsDualRoleTabs(player);
      const tabsHost = document.querySelector('.player-page-tabs');
      tabsHost?.classList.toggle('league-level-tabs', levelTabs);
      tabsHost?.classList.toggle('us-dual-role-tabs', usDualTabs);

      if (baseTab) {
        baseTab.textContent = playerScopeCode === 'international'
          ? '賽事總成績'
          : (levelTabs
              ? '一軍'
              : (usDualTabs ? (player.type === 'pitcher' ? '投球成績' : '打擊成績') : '球員基礎設定'));
      }
      minorTab?.classList.toggle('hidden', !levelTabs);
      if (minorTab) minorTab.textContent = '二軍';
      secondaryTab?.classList.toggle('hidden', !usDualTabs);
      if (secondaryTab && usDualTabs) secondaryTab.textContent = player.type === 'pitcher' ? '打擊成績' : '投球成績';
      if (todayTab) {
        todayTab.textContent = playerScopeCode === 'international'
          ? '逐場比賽'
          : (levelTabs ? '今日戰績' : (usDualTabs ? '今日狀況' : '球員今日狀況'));
      }
      if (photosTab) photosTab.textContent = '照片';

      if (levelTabs && selectedTab === 'base') selectedLevel = 'A';
      if (levelTabs && selectedTab === 'minor') selectedLevel = 'D';
      if (!levelTabs && selectedTab === 'minor') selectedTab = 'base';
      if (!usDualTabs && selectedTab === 'secondary') selectedTab = 'base';
      if (usDualTabs && selectedTab === 'secondary') selectedLevel = 'A';

      const statsTabActive = selectedTab === 'base' || selectedTab === 'minor' || selectedTab === 'secondary';
      const proSeasonStatsActive = statsTabActive && playerScopeCode !== 'international';
      const dailyReportActive = selectedTab === 'today';
      els.seasonSelect?.closest('.season-field')?.classList.toggle('hidden', levelTabs && !statsTabActive);
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === selectedTab));

      els.downloadBtn?.classList.toggle('hidden', !dailyReportActive);
      els.seasonReportBtn?.classList.toggle('hidden', !proSeasonStatsActive);

      if (els.downloadBtn) {
        const officialReadOnly = Boolean(currentRecord?.cpblReadOnlyImport || currentRecord?.externalReadOnlyImport);
        els.downloadBtn.textContent = officialReadOnly
          ? '生成當天戰報（官方單場資料）'
          : '生成當天戰報';
      }
      if (els.seasonReportBtn) {
        const context = proSeasonStatsActive ? annualSeasonContext(player) : null;
        const levelText = supportsLeagueLevelTabs(player)
          ? (selectedLevel === 'D' ? '二軍' : '一軍')
          : (context?.league || '');
        els.seasonReportBtn.textContent = context
          ? `輸出 ${context.year} ${levelText}整季戰報`
          : '輸出這個年度成績';
      }
      if (els.canvasPreviewTitle) {
        if (proSeasonStatsActive) {
          const context = annualSeasonContext(player);
          const levelText = supportsLeagueLevelTabs(player)
            ? (selectedLevel === 'D' ? '二軍' : '一軍')
            : (context.league || '');
          els.canvasPreviewTitle.textContent = `${context.year} ${levelText}整季戰報預覽`.trim();
        } else if (dailyReportActive) {
          els.canvasPreviewTitle.textContent = '當天戰報預覽';
        } else {
          els.canvasPreviewTitle.textContent = '戰報預覽';
        }
      }

      renderRecentPlayers();
      renderAllPlayersDialog();
      renderHomeTemplates();
      if (!playerPageActive) requestAnimationFrame(updateHomePaneHeight);

      if (playerPageActive) {
        const internationalOverview = playerScopeCode === 'international'
          && (selectedTab === 'base' || (selectedTab === 'today' && !internationalSelectedGameKey));
        document.querySelector('#playerPage .workspace')?.classList.toggle('international-overview', internationalOverview);
        renderContent();

        if (!internationalOverview) {
          if (proSeasonStatsActive) {
            void renderAnnualSeasonCanvas(activeSeasonReportRole(player), player);
          } else {
            void renderCanvas();
          }
        }
      }
    }

    async function commitCurrentGame() {
      const player = selectedPlayer();
      if (!player || !currentRecord) throw new Error('請先選擇球員');
      if (!currentRecord.opponent.trim()) throw new Error('請先輸入今日對手');

      if (player.type === 'hitter') {
        const appearance = ensureHitterAppearance();
        if (appearance.mode === 'bat' && !currentRecord.hitterPAs.length
          && !(currentRecord.externalReadOnlyImport && currentRecord.cpblGameSummary?.official)) {
          throw new Error('至少要有一個已確定的打席');
        }
        if (appearance.mode !== 'bat') {
          const inning = Math.floor(Number(appearance.inning));
          if (!Number.isFinite(inning) || inning < 1) throw new Error('請先設定有效的出賽局數');
          if (!['top','bottom'].includes(appearance.half)) throw new Error('請先選擇上半或下半局');
          if (!(Number(appearance.battingOrder) >= 1 && Number(appearance.battingOrder) <= 9)) throw new Error('請先選擇原棒次');
          if ((appearance.mode === 'defense' || appearance.continueDefense) && !DEFENSIVE_POSITIONS.includes(appearance.position)) {
            throw new Error('請先選擇守備位置');
          }
        }
        const current = appearance.mode === 'bat' ? deriveHitterGame(currentRecord.hitterPAs) : emptyHitterContribution();
        if (!currentRecord.cpblReadOnlyImport && !currentRecord.externalReadOnlyImport) {
          const base = mergeStats(player.stats, hitterDefaults);
          player.stats = addDelta(base, current, currentRecord.committedStats, Object.keys(emptyHitterContribution()));
        }
        currentRecord.committedStats = current;
      } else {
        const game = currentRecord.pitcherGame;
        const outs = ipToOuts(game.innings) || 0;
        if (outs < 24) game.cg = false;
        if (outs < 27 || Number(game.r) !== 0 || !game.cg) game.sho = false;
        if (!game.sho) game.noWalkHbp = false;
        const current = derivePitcherGame(game);
        if (!currentRecord.cpblReadOnlyImport && !currentRecord.externalReadOnlyImport) {
          const base = mergeStats(player.stats, pitcherDefaults);
          const keys = Object.keys(current);
          const nextStats = addDelta(base, current, currentRecord.committedStats, keys);
          const hasLocalDelta = keys.some(key =>
            (Number(current[key]) || 0) !== (Number(currentRecord.committedStats?.[key]) || 0)
          );
          if (hasLocalDelta) {
            delete nextStats.cpblEra;
            delete nextStats.cpblWhip;
            delete nextStats.cpblRatesOfficial;
          }
          player.stats = nextStats;
        }
        currentRecord.committedStats = current;
      }

      currentRecord.committedAt = Date.now();
      if (!currentRecord.cpblReadOnlyImport && !currentRecord.externalReadOnlyImport) await savePlayer(player);
      await saveRecord();
      return player;
    }

    function halfLabel(half) {
      return half === 'bottom' ? '下半' : '上半';
    }

    function nextHalfInning(inning, half) {
      const n = Math.max(1, Math.floor(Number(inning) || 1));
      return half === 'bottom'
        ? { inning: n + 1, half: 'top' }
        : { inning: n, half: 'bottom' };
    }

    function hitterAppearanceHeading(appearance) {
      if (appearance.mode === 'runner') return appearance.continueDefense ? '代跑後接替守備' : '純代跑';
      if (appearance.mode === 'defense') return '純代守';
      return '逐打席';
    }

    function hitterAppearanceLines(appearance) {
      const inning = Math.max(1, Math.floor(Number(appearance.inning) || 1));
      const order = Math.min(9, Math.max(1, Math.floor(Number(appearance.battingOrder) || 1)));
      const half = halfLabel(appearance.half);
      if (appearance.mode === 'runner') {
        const lines = [`${inning}局${half}｜接替原第${order}棒打者代跑`];
        if (appearance.continueDefense) {
          const next = nextHalfInning(inning, appearance.half);
          lines.push(`${next.inning}局${halfLabel(next.half)}｜接替${appearance.position}守備`);
        }
        return lines;
      }
      if (appearance.mode === 'defense') {
        return [`${inning}局${half}｜接替原第${order}棒打者，守${appearance.position}`];
      }
      return [];
    }

    function drawWrappedCanvasText(ctx, text, x, y, maxWidth, font, lineHeight) {
      ctx.font = font;
      let line = '';
      let currentY = y;
      for (const char of String(text)) {
        const test = line + char;
        if (line && ctx.measureText(test).width > maxWidth) {
          ctx.fillText(line, x, currentY);
          line = char;
          currentY += lineHeight;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, x, currentY);
      return currentY + lineHeight;
    }

    function drawHitterAppearanceDetail(ctx, layout, positioned, detail, appearance) {
      const heading = hitterAppearanceHeading(appearance);
      const lines = hitterAppearanceLines(appearance);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';
      let y;
      if (positioned) {
        y = detail.paStartY + 10;
      } else {
        ctx.font = `900 ${Math.min(38, layout.fonts.pitcherTitle)}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText(heading, 88, 430);
        y = 500;
      }
      const x = positioned ? detail.dividerX1 + 10 : 88;
      const maxWidth = positioned ? detail.dividerX2 - detail.dividerX1 - 20 : 390;
      const fontSize = positioned ? (detail.appearanceFontSize || 27) : 30;
      for (const line of lines) {
        y = drawWrappedCanvasText(ctx, line, x, y, maxWidth, `900 ${fontSize}px "Microsoft JhengHei", sans-serif`, fontSize + 16) + 14;
      }
      ctx.restore();
    }

    async function renderCanvas() {
      const token = ++renderToken;
      const ctx = els.canvas.getContext('2d');
      const player = selectedPlayer();
      const effectiveType = player && selectedTab === 'today' ? activeTodayRole(player) : player?.type;
      const W = els.canvas.width;
      const H = els.canvas.height;

      ctx.clearRect(0, 0, W, H);
      const frameColor = currentRecord?.opponent
        ? opponentColor(currentRecord.opponent)
        : '#d7ad52';
      const layout = getCurrentTemplate();
      const isBg2 = layout.style === 'baseball-q';
      const positioned = isBg2 || Boolean(layout.detail?.positioned);

      if (layout.style) {
        drawStyledTemplateBackground(ctx, layout, frameColor);
      } else {
        const frameSize = layout.frameSize;
        ctx.fillStyle = frameColor;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = layout.innerBg;
        ctx.fillRect(frameSize, frameSize, W - frameSize * 2, H - frameSize * 2);
      }

      if (!player || !currentRecord) return;

      const projected = projectedPlayerStatsForRole(player, effectiveType);
      const opponent = currentRecord.opponent || '今日對手';
      const dateText = currentRecord.date.replaceAll('-', '.');

      // 區塊 1：對手與日期
      if (isBg2) {
        drawBg2Header(ctx, layout, opponent, dateText, frameColor);
      } else if (positioned) {
        drawStyledHeader(ctx, layout, opponent, dateText, frameColor);
      } else {
        roundRect(ctx, layout.header.x, layout.header.y, layout.header.w, layout.header.h, layout.header.r, layout.header.bg);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${layout.fonts.headerVs}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText('VS ', 86, 112);
        const vsWidth = ctx.measureText('VS ').width;
        ctx.fillStyle = currentRecord.opponent ? opponentColor(currentRecord.opponent) : '#ffffff';
        ctx.fillText(opponent, 86 + vsWidth, 112);
        const opponentWidth = ctx.measureText(opponent).width;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#d7ad52';
        ctx.font = `700 ${layout.fonts.headerDate}px sans-serif`;
        ctx.fillText(dateText, 994, 112);
        const dateWidth = ctx.measureText(dateText).width;

        if (layout.decorHeads?.enabled) {
          try {
            const [decorHead1, decorHead2] = await Promise.all([
              loadEmbeddedImage(DECOR_HEAD_1),
              loadEmbeddedImage(DECOR_HEAD_2)
            ]);
            if (token !== renderToken) return;
            const gapStart = 86 + vsWidth + opponentWidth + 18;
            const gapEnd = 994 - dateWidth - 18;
            const availableW = Math.max(150, gapEnd - gapStart);
            const areaW = Math.min(330, availableW);
            const areaX = gapStart + Math.max(0, (availableW - areaW) / 2);
            const head1Box = { x: areaX + areaW * 0.48, y: 38, w: areaW * 0.50, h: 82 };
            const head2Box = { x: areaX + areaW * 0.00, y: 60, w: areaW * 0.42, h: 62 };
            drawContain(ctx, decorHead2, head2Box.x, head2Box.y, head2Box.w, head2Box.h);
            drawContain(ctx, decorHead1, head1Box.x, head1Box.y, head1Box.w, head1Box.h);
          } catch {}
        }
      }

      // 區塊 2：三圍
      const metrics = effectiveType === 'hitter'
        ? (() => { const d = hitterDerived(projected); return [['打擊率', fmtBatRate(d.avg)], ['上壘率', fmtBatRate(d.obp)], ['長打率', fmtBatRate(d.slg)]]; })()
        : (() => {
            const d = pitcherDerived(projected);
            return [['WHIP', fmtTwo(d.whip)], ['防禦率', fmtTwo(d.era)], pitcherLastMetric(player, projected)];
          })();

      metrics.forEach((metric, index) => {
        const card = layout.metricCards[index];
        if (isBg2) drawBg2MetricFrame(ctx, card);
        else if (positioned) drawStyledMetricFrame(ctx, card);
        else roundRect(ctx, card.x, card.y, card.w, card.h, card.r, card.bg);

        ctx.textAlign = 'center';
        ctx.fillStyle = card.label;
        ctx.font = `700 ${layout.fonts.metricLabel}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText(metric[0], card.x + card.w / 2, card.y + (card.labelOffset ?? (isBg2 ? 39 : 51)));

        ctx.fillStyle = card.value;
        ctx.font = `900 ${layout.fonts.metricValue}px Arial, sans-serif`;
        ctx.fillText(metric[1], card.x + card.w / 2, card.y + (card.valueOffset ?? (isBg2 ? 91 : 121)));
      });

      // 區塊 4：照片
      const frame = layout.photo;
      drawPhotoFrameBase(ctx, frame);
      const photo = photos.find(p => p.id === player.selectedPhotoId && p.playerId === player.id);
      if (photo) {
        try {
          const image = await getPhotoImage(photo);
          if (token !== renderToken) return;
          const transform = clampPhotoTransform(image, getPhotoTransform(player, photo.id));
          player.photoTransforms[photo.id] = transform;
          drawPhotoImageInFrame(ctx, image, frame, transform);
        } catch {
          drawPhotoPlaceholderFrame(ctx, frame);
        }
      } else {
        drawPhotoPlaceholderFrame(ctx, frame);
      }

      // 區塊 3：逐打席或投球戰績
      if (layout.detail.drawBox !== false) {
        roundRect(ctx, layout.detail.x, layout.detail.y, layout.detail.w, layout.detail.h, layout.detail.r, layout.detail.bg);
        if (positioned && layout.detail.border) {
          ctx.save();
          ctx.strokeStyle = layout.detail.border;
          ctx.lineWidth = layout.detail.borderWidth || 2;
          ctx.beginPath();
          ctx.roundRect(layout.detail.x, layout.detail.y, layout.detail.w, layout.detail.h, layout.detail.r || 0);
          ctx.stroke();
          ctx.restore();
        }
      }

      const detail = layout.detail;
      if (positioned) {
        const detailHeading = effectiveType === 'hitter' ? hitterAppearanceHeading(ensureHitterAppearance()) : '投球成績';
        if (isBg2) drawBg2DetailHeading(ctx, detailHeading, detail);
        else drawStyledDetailHeading(ctx, detailHeading, detail);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';

      if (effectiveType === 'hitter') {
        const appearance = ensureHitterAppearance();
        if (appearance.mode === 'bat') {
          const officialBox = currentRecord?.internationalHitterGame;
          const pas = currentRecord.hitterPAs.slice(0, 8);
          if (currentRecord?.externalReadOnlyImport && officialBox && !pas.length) {
            const hits = Number(officialBox.hits) || 0;
            const summaryLines = [
              ['打數', Number(officialBox.ab)||0],
              ['安打', hits],
              ['打點', Number(officialBox.rbi)||0],
              ['得分', Number(officialBox.runs)||0],
              ['保送', Number(officialBox.bb)||0],
              ['三振', Number(officialBox.k)||0],
              ['全壘打', Number(officialBox.hr)||0]
            ];
            summaryLines.forEach((line, index) => {
              const y = positioned ? detail.pitcherStartY + index * detail.pitcherStep : 492 + index * 52;
              ctx.fillStyle = positioned ? (detail.mutedColor || '#52657d') : '#6d7688';
              ctx.font = `700 ${layout.fonts.pitcherLabel}px "Microsoft JhengHei", sans-serif`;
              ctx.fillText(line[0], positioned ? detail.pitcherLabelX : 90, y);
              ctx.textAlign = 'right';
              ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';
              ctx.font = `900 ${layout.fonts.pitcherValue}px Arial, sans-serif`;
              ctx.fillText(String(line[1]), positioned ? detail.pitcherValueX : 470, y);
              ctx.textAlign = 'left';
            });
          } else {
          pas.forEach((pa, index) => {
            const y = positioned ? detail.paStartY + index * detail.paStep : 425 + index * 78;
            const numberX = positioned ? detail.paNumberX : 106;
            const textX = positioned ? detail.paTextX : 158;
            const radius = positioned ? (detail.paRadius || 22) : 28;

            ctx.save();
            ctx.fillStyle = index % 2 ? (detail.paCircleAlt || '#20324f') : (detail.paCircle || '#d7ad52');
            ctx.beginPath();
            ctx.arc(numberX, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = index % 2 ? (detail.paCircleAltText || '#ffffff') : (detail.paCircleText || '#172033');
            ctx.textAlign = 'center';
            ctx.font = `900 ${layout.fonts.paNumber}px Arial, sans-serif`;
            ctx.fillText(String(index + 1), numberX, y + (positioned ? 8 : 10));
            ctx.restore();

            ctx.textAlign = 'left';
            ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';
            ctx.font = `900 ${layout.fonts.paResult}px "Microsoft JhengHei", sans-serif`;
            ctx.fillText(paLabel(pa), textX, y + (positioned ? 11 : 14));
            if (pa.rbi) {
              const width = ctx.measureText(paLabel(pa)).width;
              ctx.fillStyle = positioned ? (detail.rbiColor || '#b5811b') : '#b5811b';
              ctx.font = `900 ${layout.fonts.paRbi}px Arial, sans-serif`;
              ctx.fillText(String(pa.rbi), textX + 8 + width, y - (positioned ? 11 : 13));
            }
            if (index < pas.length - 1) {
              ctx.strokeStyle = positioned ? (detail.dividerColor || 'rgba(16,40,74,.20)') : '#d7dce5';
              ctx.lineWidth = positioned ? 1.5 : 2;
              ctx.beginPath();
              ctx.moveTo(positioned ? detail.dividerX1 : 76, y + (positioned ? 29 : 39));
              ctx.lineTo(positioned ? detail.dividerX2 : 486, y + (positioned ? 29 : 39));
              ctx.stroke();
            }
          });

          const paCodes = currentRecord.hitterPAs.map(pa => pa.code);
          const cycle = paCodes.includes('1B') && paCodes.includes('2B') && paCodes.includes('3B') && paCodes.includes('HR');
          const hitterTags = [];
          if (cycle) hitterTags.push('完全打擊');
          if (kboHitterRbiNeedsAggregateFallback(player, currentRecord)) {
            hitterTags.push(`打點 ${officialHitterRbiSummary(currentRecord).official}`);
          }
          if (hitterTags.length) {
            if (positioned) drawTags(ctx, hitterTags, detail.tagsX, detail.tagsBottom, detail.tagsW, detail.accentColor || '#d4af37');
            else drawTags(ctx, hitterTags, 72, 1008, 418, '#d4af37');
          }
          }
        } else {
          drawHitterAppearanceDetail(ctx, layout, positioned, detail, appearance);
        }
      } else {
        const g = currentRecord.pitcherGame;
        const pitches = Math.min(150, Number(g.pitchTens) * 10 + Number(g.pitchOnes));

        if (!positioned) {
          ctx.fillStyle = '#172033';
          ctx.font = `900 ${layout.fonts.pitcherTitle}px "Microsoft JhengHei", sans-serif`;
          ctx.fillText('投球戰績', 88, 430);
        }

        const lines = currentRecord?.externalWalksCombined
          ? [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['四死球', g.bb],
              ['被安打', g.h],
              ['失分', g.r],
              ['自責分', g.er],
              ['用球數', pitches]
            ]
          : [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['保送', g.bb],
              ['被安打', g.h],
              ['死球', g.hbp],
              ['自責分', g.er],
              ['用球數', pitches]
            ];
        lines.forEach((line, index) => {
          const y = positioned ? detail.pitcherStartY + index * detail.pitcherStep : 492 + index * 52;
          ctx.fillStyle = positioned ? (detail.mutedColor || '#52657d') : '#6d7688';
          ctx.font = `700 ${layout.fonts.pitcherLabel}px "Microsoft JhengHei", sans-serif`;
          ctx.fillText(line[0], positioned ? detail.pitcherLabelX : 90, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = positioned ? (detail.textColor || '#172033') : '#172033';
          ctx.font = `900 ${layout.fonts.pitcherValue}px Arial, sans-serif`;
          ctx.fillText(String(line[1]), positioned ? detail.pitcherValueX : 470, y);
          ctx.textAlign = 'left';
        });

        standardizePitcherSpecialRecords(g);
        const result = pitcherResult(g);
        const outs = ipToOuts(g.innings) || 0;
        let specialRecord = '';

        if (g.cg && outs >= 27 && Number(g.h) === 0 && Number(g.bb) === 0 && Number(g.hbp) === 0 && Number(g.otherReach || 0) === 0) {
          specialRecord = '完全比賽';
        } else if (g.cg && outs >= 27 && Number(g.h) === 0) {
          specialRecord = '無安打比賽';
        } else if (g.cg && g.sho && result === 'W' && outs >= 27 && pitches < 100) {
          specialRecord = 'Maddux 完封勝';
        }

        const tagX = positioned ? detail.tagsX : 72;
        const tagBottom = positioned ? detail.tagsBottom : 1008;
        const tagW = positioned ? detail.tagsW : 418;

        if (specialRecord) {
          drawTags(ctx, [specialRecord], tagX, tagBottom, tagW, '#d4af37');
        } else {
          const tags = [];
          if (g.cg) tags.push('完投');
          if (g.sho) tags.push('完封');
          if (g.noWalkHbp) tags.push('無四死球');
          if (result === 'HLD') tags.push('中繼成功');
          if (result === 'SV') tags.push('救援成功');
          if (g.bsv) tags.push('救援失敗');
          if (g.rainCalled) tags.push('因雨提前裁定');
          if (result === 'W') tags.push('勝');
          if (result === 'L') tags.push('敗');
          drawTags(ctx, tags, tagX, tagBottom, tagW);
        }
      }

      // 區塊 5：背號與名字
      if (layout.name.plateBg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(
          layout.name.plateX,
          layout.name.plateY,
          layout.name.plateW,
          layout.name.plateH,
          layout.name.plateR || 0
        );
        ctx.fillStyle = layout.name.plateBg;
        ctx.fill();
        if (layout.name.plateBorder) {
          ctx.strokeStyle = layout.name.plateBorder;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      const playerTitle = `#${player.number} ${reportPlayerName(player)}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = layout.name.color || '#ffffff';
      let playerNameFontSize = Number(layout.fonts.playerName) || 42;
      ctx.font = `900 ${playerNameFontSize}px "Microsoft JhengHei", Arial, sans-serif`;
      const nameMaxWidth = layout.name.maxWidth || 438;
      const nameMinSize = layout.name.minFont || (positioned ? 28 : 32);
      while (ctx.measureText(playerTitle).width > nameMaxWidth && playerNameFontSize > nameMinSize) {
        playerNameFontSize = Math.max(nameMinSize, playerNameFontSize - 2);
        ctx.font = `900 ${playerNameFontSize}px "Microsoft JhengHei", Arial, sans-serif`;
      }
      ctx.fillText(playerTitle, layout.name.textX, layout.name.textY);

      ctx.fillStyle = layout.name.lineColor || frameColor;
      ctx.fillRect(layout.name.lineX, layout.name.lineY, layout.name.lineW, layout.name.lineH || (positioned ? 3 : 5));

      ctx.fillStyle = layout.name.typeColor || '#94a3b8';
      ctx.font = `700 ${layout.fonts.playerType}px Arial, sans-serif`;
      ctx.fillText(effectiveType === 'pitcher' ? 'PITCHER' : 'HITTER', layout.name.typeX, layout.name.typeY);

      if (layout.style === 'scoreboard-tech') {
        drawScoreboardPlayerFooter(ctx, { ...player, type:effectiveType }, currentRecord);
      }
    }

    function drawStyledTemplateBackground(ctx, layout, frameColor = '#d7ad52') {
      switch (layout.style) {
        case 'baseball-q': return drawBg2Background(ctx, frameColor);
        case 'stadium-night': return drawStadiumNightBackground(ctx, frameColor);
        case 'baseball-seam': return drawBaseballSeamBackground(ctx, frameColor);
        case 'bullpen': return drawBullpenBackground(ctx, frameColor);
        case 'scoreboard-tech': return drawScoreboardTechBackground(ctx, frameColor);
      }
      ctx.fillStyle = layout.innerBg || '#152238';
      ctx.fillRect(0, 0, 1080, 1080);
    }

    function drawStyledHeader(ctx, layout, opponent, dateText, frameColor) {
      const h = layout.header;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = h.textColor || '#ffffff';
      ctx.font = `900 ${layout.fonts.headerVs}px "Microsoft JhengHei", sans-serif`;
      ctx.fillText('VS ', h.vsX, h.vsY);
      const vsW = ctx.measureText('VS ').width;
      ctx.fillStyle = frameColor || h.textColor || '#ffffff';
      ctx.fillText(opponent, h.vsX + vsW, h.vsY);
      ctx.textAlign = h.dateAlign === 'right' ? 'right' : 'left';
      ctx.fillStyle = h.dateColor || '#d7ad52';
      ctx.font = `800 ${layout.fonts.headerDate}px Arial, "Microsoft JhengHei", sans-serif`;
      ctx.fillText(dateText, h.dateX, h.dateY);
      ctx.restore();
    }

    function drawStyledMetricFrame(ctx, card) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, card.r || 0);
      ctx.fillStyle = card.bg || 'rgba(255,255,255,.88)';
      ctx.fill();
      if (card.border) {
        ctx.strokeStyle = card.border;
        ctx.lineWidth = card.borderWidth || 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawStyledDetailHeading(ctx, text, detail) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = detail.accentColor || '#d7ad52';
      ctx.fillRect(detail.headingX - 14, detail.headingY - 27, 5, 30);
      ctx.fillStyle = detail.textColor || '#172033';
      ctx.font = '900 31px "Microsoft JhengHei", sans-serif';
      ctx.fillText(text, detail.headingX, detail.headingY);
      ctx.strokeStyle = detail.dividerColor || 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(detail.underlineX, detail.underlineY);
      ctx.lineTo(detail.underlineX + detail.underlineW, detail.underlineY);
      ctx.stroke();
      ctx.restore();
    }

    function drawOpponentFrame(ctx, frameColor, inset = 10, width = 10) {
      ctx.save();
      ctx.strokeStyle = frameColor || '#d7ad52';
      ctx.lineWidth = width;
      ctx.strokeRect(inset, inset, 1080 - inset * 2, 1080 - inset * 2);
      ctx.restore();
    }

    function drawStadiumNightBackground(ctx, frameColor = '#d7ad52') {
      const g = ctx.createLinearGradient(0, 0, 0, 1080);
      g.addColorStop(0, '#071523');
      g.addColorStop(.56, '#0e2940');
      g.addColorStop(1, '#07131f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 1080);

      // 看台與夜空光暈
      ctx.save();
      for (const [x,y,r] of [[110,120,180],[950,120,180],[535,70,130]]) {
        const glow = ctx.createRadialGradient(x,y,0,x,y,r);
        glow.addColorStop(0,'rgba(255,247,214,.34)');
        glow.addColorStop(.25,'rgba(201,219,231,.13)');
        glow.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // 球場燈
      ctx.save();
      for (const baseX of [70, 1010]) {
        ctx.strokeStyle = 'rgba(158,178,194,.46)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(baseX, 285); ctx.lineTo(baseX, 92); ctx.stroke();
        for (let r=0;r<3;r++) for(let col=0;col<4;col++) {
          const x = baseX + (baseX < 500 ? -24 : -45) + col*16;
          const y = 64 + r*16;
          const light = ctx.createRadialGradient(x,y,1,x,y,12);
          light.addColorStop(0,'#fffbe7');
          light.addColorStop(.35,'rgba(255,248,214,.9)');
          light.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle = light;
          ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();

      // 遠端看台
      ctx.fillStyle = '#0a1b2a';
      ctx.beginPath();
      ctx.moveTo(0,710); ctx.quadraticCurveTo(540,570,1080,710);
      ctx.lineTo(1080,830); ctx.lineTo(0,830); ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.globalAlpha=.24;
      for(let y=690;y<805;y+=18){
        for(let x=12;x<1070;x+=22){
          ctx.fillStyle=((x+y)/2)%3<1?'#e3c76d':'#91a8ba';
          ctx.fillRect(x,y,3,3);
        }
      }
      ctx.restore();

      // 草地
      const grass=ctx.createLinearGradient(0,760,0,1080);
      grass.addColorStop(0,'#294a35');
      grass.addColorStop(1,'#102d21');
      ctx.fillStyle=grass;ctx.fillRect(0,780,1080,300);
      ctx.save();ctx.globalAlpha=.14;
      for(let x=0;x<1080;x+=72){
        ctx.fillStyle=(x/72)%2?'#9ab077':'#071c16';
        ctx.fillRect(x,780,36,300);
      }
      ctx.restore();

      // 內野線條 / 本壘
      ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(540,1035);ctx.lineTo(292,785);ctx.moveTo(540,1035);ctx.lineTo(788,785);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.52)';
      ctx.beginPath();ctx.moveTo(540,1012);ctx.lineTo(566,1028);ctx.lineTo(556,1058);ctx.lineTo(524,1058);ctx.lineTo(514,1028);ctx.closePath();ctx.fill();

      // 資訊區暗部
      const shade=ctx.createLinearGradient(0,260,590,980);
      shade.addColorStop(0,'rgba(0,0,0,.02)');shade.addColorStop(1,'rgba(0,0,0,.22)');
      ctx.fillStyle=shade;ctx.fillRect(35,275,1010,720);

      drawOpponentFrame(ctx,frameColor,10,10);
      ctx.strokeStyle='rgba(255,255,255,.20)';ctx.lineWidth=2;ctx.strokeRect(21,21,1038,1038);
    }

    function drawBaseballSeamBackground(ctx, frameColor = '#d7ad52') {
      const paper=ctx.createLinearGradient(0,0,1080,1080);
      paper.addColorStop(0,'#faf7f0');
      paper.addColorStop(1,'#e9e1d4');
      ctx.fillStyle=paper;ctx.fillRect(0,0,1080,1080);

      // 紙張點狀紋理
      ctx.save();ctx.globalAlpha=.08;ctx.fillStyle='#6c6258';
      for(let y=12;y<1080;y+=27) for(let x=14+((y/27)%2)*9;x<1080;x+=33){
        ctx.beginPath();ctx.arc(x,y,1.15,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();

      // 巨型棒球輪廓與縫線
      ctx.save();
      ctx.globalAlpha=.16;
      ctx.strokeStyle='#b53a35';ctx.lineWidth=6;
      ctx.beginPath();ctx.arc(120,555,395,-1.18,1.20);ctx.stroke();
      ctx.beginPath();ctx.arc(960,555,395,Math.PI-1.20,Math.PI+1.18);ctx.stroke();
      for(let a=-1.08;a<1.10;a+=.12){
        const x=120+Math.cos(a)*395,y=555+Math.sin(a)*395;
        ctx.beginPath();ctx.moveTo(x-10,y-8);ctx.lineTo(x+10,y+8);ctx.stroke();
      }
      for(let a=Math.PI-1.10;a<Math.PI+1.08;a+=.12){
        const x=960+Math.cos(a)*395,y=555+Math.sin(a)*395;
        ctx.beginPath();ctx.moveTo(x-10,y+8);ctx.lineTo(x+10,y-8);ctx.stroke();
      }
      ctx.restore();

      // 頂部記分板帶
      ctx.fillStyle='#173a59';ctx.fillRect(0,0,1080,124);
      ctx.fillStyle='#b83a35';ctx.fillRect(0,118,1080,6);
      ctx.save();ctx.globalAlpha=.12;ctx.strokeStyle='#ffffff';ctx.lineWidth=1;
      for(let x=380;x<1050;x+=58){ctx.beginPath();ctx.moveTo(x,18);ctx.lineTo(x,106);ctx.stroke();}
      ctx.restore();

      // 左下本壘板浮水印
      ctx.save();ctx.globalAlpha=.10;ctx.fillStyle='#173a59';
      ctx.beginPath();ctx.moveTo(110,945);ctx.lineTo(190,945);ctx.lineTo(214,985);ctx.lineTo(150,1040);ctx.lineTo(86,985);ctx.closePath();ctx.fill();
      ctx.restore();

      drawOpponentFrame(ctx,frameColor,10,10);
    }

    function drawScoreboardTechBackground(ctx, frameColor = '#d7ad52') {
      const W=1080,H=1080;

      // 深色電子記分板底
      const bg=ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#061019');
      bg.addColorStop(.52,'#0a1b27');
      bg.addColorStop(1,'#040b11');
      ctx.fillStyle=bg;
      ctx.fillRect(0,0,W,H);

      // LED 點陣
      ctx.save();
      ctx.globalAlpha=.13;
      ctx.fillStyle='#4ea1c5';
      for(let y=26;y<H;y+=20){
        for(let x=28;x<W;x+=20){
          ctx.beginPath();
          ctx.arc(x,y,1.35,0,Math.PI*2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 頂部主記分板框
      ctx.save();
      ctx.fillStyle='rgba(3,10,15,.94)';
      ctx.strokeStyle='#2b6a88';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.roundRect(34,34,1012,86,12);
      ctx.fill();
      ctx.stroke();

      // 中央 LED 模組：固定放在對手名稱與日期之間，避免和日期重疊。
      const ledBox=(x,label,value,accent='#7ed6f2')=>{
        const boxW=104;
        ctx.fillStyle='rgba(9,29,42,.95)';
        ctx.strokeStyle='rgba(63,132,162,.72)';
        ctx.lineWidth=2;
        ctx.beginPath();ctx.roundRect(x,46,boxW,60,8);ctx.fill();ctx.stroke();
        ctx.textAlign='center';
        ctx.fillStyle='#7097aa';
        ctx.font='700 11px Arial, sans-serif';
        ctx.fillText(label,x+boxW/2,66);
        ctx.fillStyle=accent;
        ctx.font='900 22px "Courier New", monospace';
        ctx.fillText(value,x+boxW/2,94);
      };
      ledBox(500,'INNING','9');
      ledBox(616,'OUT','2','#ffca45');
      ledBox(732,'COUNT','3-2','#ff7f6b');
      ctx.restore();

      // 中段跑馬燈
      ctx.save();
      ctx.fillStyle='#0d2533';
      ctx.fillRect(0,126,W,6);
      ctx.fillStyle='rgba(13,37,51,.80)';
      ctx.fillRect(0,286,W,10);
      ctx.globalAlpha=.72;
      ctx.fillStyle='#2c718e';
      for(let x=0;x<W;x+=48) ctx.fillRect(x,288,28,6);
      ctx.restore();

      // 右上方球場數據格線
      ctx.save();
      ctx.globalAlpha=.14;
      ctx.strokeStyle='#6db2d0';
      ctx.lineWidth=1;
      for(let x=700;x<1040;x+=42){
        ctx.beginPath();ctx.moveTo(x,138);ctx.lineTo(x,292);ctx.stroke();
      }
      for(let y=138;y<292;y+=31){
        ctx.beginPath();ctx.moveTo(700,y);ctx.lineTo(1040,y);ctx.stroke();
      }
      ctx.restore();

      // 右下電子面板輪廓，照片區後方仍看得到
      ctx.save();
      ctx.strokeStyle='rgba(53,132,166,.28)';
      ctx.lineWidth=2;
      for(const off of [0,12,24]){
        ctx.strokeRect(572+off,304+off,474-off*2,692-off*2);
      }
      ctx.restore();

      // 底部 scoreboard strip
      ctx.save();
      ctx.fillStyle='rgba(2,9,14,.94)';
      ctx.fillRect(0,1000,W,80);
      ctx.strokeStyle='#2c6f8c';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,1000);ctx.lineTo(W,1000);ctx.stroke();

      ctx.fillStyle='#ffca45';
      ctx.font='900 18px "Courier New", monospace';
      ctx.textAlign='left';
      ctx.fillText('PLAYER DATA',46,1048);
      ctx.restore();

      // 科技斜線
      ctx.save();
      ctx.globalAlpha=.22;
      ctx.strokeStyle='#2a7190';
      ctx.lineWidth=2;
      for(let x=-160;x<1080;x+=150){
        ctx.beginPath();
        ctx.moveTo(x,1080);
        ctx.lineTo(x+310,770);
        ctx.stroke();
      }
      ctx.restore();

      drawOpponentFrame(ctx,frameColor,10,10);
      ctx.strokeStyle='rgba(96,175,205,.24)';
      ctx.lineWidth=2;
      ctx.strokeRect(22,22,1036,1036);
    }

    function drawScoreboardPlayerFooter(ctx, player, record) {
      if (!player || !record) return;

      let items;
      let descriptor;
      if (player.type === 'pitcher') {
        const g = record.pitcherGame || {};
        items = [
          ['IP', String(g.innings || '0.0')],
          ['SO', String(Math.max(0, Number(g.k) || 0))],
          ['ER', String(Math.max(0, Number(g.er) || 0))]
        ];
        descriptor = 'PITCHER';
      } else {
        const derived = deriveHitterGame(record.hitterPAs || []);
        const summary = record.cpblGameSummary || {};
        const official = Boolean(summary.official);
        items = [
          ['R', String(official ? Math.max(0, Number(summary.runs) || 0) : 0)],
          ['H', String(official ? Math.max(0, Number(summary.hits) || 0) : Math.max(0, Number(derived.single || 0) + Number(derived.double || 0) + Number(derived.triple || 0) + Number(derived.hr || 0)))],
          ['E', String(official ? Math.max(0, Number(summary.errors) || 0) : 0)]
        ];
        descriptor = 'HITTER';
      }

      ctx.save();
      ctx.fillStyle='rgba(2,9,14,.98)';
      ctx.fillRect(0,1000,1080,80);
      ctx.strokeStyle='#2c6f8c';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,1000);ctx.lineTo(1080,1000);ctx.stroke();

      items.forEach((item,i)=>{
        const x=740+i*92;
        ctx.textAlign='center';
        ctx.fillStyle='#6f95a8';
        ctx.font='700 15px Arial, sans-serif';
        ctx.fillText(item[0],x,1027);
        ctx.fillStyle='#dff6ff';
        ctx.font='900 28px "Courier New", monospace';
        ctx.fillText(item[1],x,1060);
      });

      ctx.fillStyle='#ffca45';
      ctx.font='900 18px "Courier New", monospace';
      ctx.textAlign='left';
      ctx.fillText(`PLAYER DATA // ${descriptor}`,46,1048);
      ctx.restore();
    }

    function drawBullpenBackground(ctx, frameColor = '#d7ad52') {
      const wall=ctx.createLinearGradient(0,0,1080,1080);
      wall.addColorStop(0,'#14231d');
      wall.addColorStop(.56,'#2a4036');
      wall.addColorStop(1,'#101a16');
      ctx.fillStyle=wall;
      ctx.fillRect(0,0,1080,1080);

      // 明顯牛棚鐵網
      ctx.save();
      ctx.globalAlpha=.23;
      ctx.strokeStyle='#d2ddd5';
      ctx.lineWidth=1.7;
      const step=36;
      for(let x=-1080;x<1080;x+=step){
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+1080,1080);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x,1080);ctx.lineTo(x+1080,0);ctx.stroke();
      }
      ctx.restore();

      // 上方鋼樑與遮棚
      ctx.fillStyle='rgba(5,13,10,.78)';
      ctx.fillRect(0,0,1080,130);
      ctx.strokeStyle='rgba(205,190,150,.42)';
      ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(0,130);ctx.lineTo(1080,130);ctx.stroke();
      for(let x=70;x<1080;x+=175){
        ctx.strokeStyle='rgba(178,190,181,.24)';
        ctx.lineWidth=7;
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+58,130);ctx.stroke();
      }

      // 右上 BULLPEN 標牌，避開 VS / 三圍
      ctx.save();
      ctx.fillStyle='rgba(7,18,14,.90)';
      ctx.strokeStyle='#c6ad70';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.roundRect(650,146,330,58,10);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign='center';
      ctx.fillStyle='#ead8a5';
      ctx.font='900 37px Arial, sans-serif';
      ctx.fillText('BULLPEN',815,187);
      ctx.restore();

      // 暖色牛棚頂燈
      const light=ctx.createRadialGradient(836,88,8,836,88,250);
      light.addColorStop(0,'rgba(255,231,174,.34)');
      light.addColorStop(.34,'rgba(222,198,143,.11)');
      light.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=light;
      ctx.fillRect(570,0,510,360);

      // 後方長椅
      ctx.fillStyle='rgba(103,70,39,.90)';
      ctx.fillRect(16,758,560,28);
      ctx.fillStyle='rgba(61,40,24,.92)';
      ctx.fillRect(48,786,20,84);
      ctx.fillRect(520,786,20,84);
      ctx.strokeStyle='rgba(222,184,124,.30)';
      ctx.lineWidth=2;
      for(let x=32;x<560;x+=70){
        ctx.beginPath();ctx.moveTo(x,762);ctx.lineTo(x+56,762);ctx.stroke();
      }

      // 草皮與投手練投區
      const grass=ctx.createLinearGradient(0,775,0,1080);
      grass.addColorStop(0,'#4d684e');
      grass.addColorStop(1,'#203a2b');
      ctx.fillStyle=grass;
      ctx.fillRect(0,780,1080,300);
      ctx.save();
      ctx.globalAlpha=.18;
      for(let x=0;x<1080;x+=58){
        ctx.fillStyle=(x/58)%2?'#809774':'#284432';
        ctx.fillRect(x,780,29,300);
      }
      ctx.restore();

      // 牛棚土丘
      const dirt=ctx.createRadialGradient(790,940,45,790,940,310);
      dirt.addColorStop(0,'#b0875e');
      dirt.addColorStop(.58,'rgba(144,101,65,.92)');
      dirt.addColorStop(1,'rgba(108,76,49,0)');
      ctx.fillStyle=dirt;
      ctx.beginPath();
      ctx.ellipse(790,940,330,125,0,0,Math.PI*2);
      ctx.fill();

      // 投手板
      ctx.fillStyle='#f1ead8';
      ctx.strokeStyle='rgba(80,67,48,.35)';
      ctx.lineWidth=2;
      ctx.fillRect(742,900,100,17);
      ctx.strokeRect(742,900,100,17);

      // 左下球桶，刻意放在數據框下方可視區
      ctx.save();
      const bucketGrad=ctx.createLinearGradient(74,975,168,1060);
      bucketGrad.addColorStop(0,'#263e5a');
      bucketGrad.addColorStop(1,'#14283c');
      ctx.fillStyle=bucketGrad;
      ctx.strokeStyle='#9fb0be';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.roundRect(72,986,114,78,12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle='#dbe4e8';
      ctx.font='900 17px Arial, sans-serif';
      ctx.textAlign='center';
      ctx.fillText('BASEBALL',129,1043);

      // 桶裡棒球
      for(const [x,y] of [[91,980],[117,974],[144,979],[166,986]]){
        ctx.fillStyle='#f6f1e5';
        ctx.strokeStyle='#b9b4aa';
        ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#c64843';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(x-7,y,13,-1.1,1.1);ctx.stroke();
        ctx.beginPath();ctx.arc(x+7,y,13,Math.PI-1.1,Math.PI+1.1);ctx.stroke();
      }
      ctx.restore();

      // 底部球棒架
      ctx.save();
      ctx.strokeStyle='#5c3d24';
      ctx.lineWidth=7;
      ctx.beginPath();
      ctx.moveTo(220,1062);ctx.lineTo(220,985);
      ctx.moveTo(338,1062);ctx.lineTo(338,985);
      ctx.moveTo(210,1025);ctx.lineTo(348,1025);
      ctx.stroke();

      const bats=[
        {x:242,rot:-.09,c:'#d7a55f'},
        {x:274,rot:.05,c:'#c9904b'},
        {x:307,rot:-.04,c:'#e1b775'}
      ];
      for(const bat of bats){
        ctx.save();
        ctx.translate(bat.x,1021);
        ctx.rotate(bat.rot);
        ctx.fillStyle=bat.c;
        ctx.strokeStyle='#604426';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.roundRect(-7,-78,14,91,7);
        ctx.fill();ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // 右側窄邊直式牛棚字樣，照片旁仍看得到
      ctx.save();
      ctx.translate(1052,630);
      ctx.rotate(-Math.PI/2);
      ctx.textAlign='center';
      ctx.fillStyle='rgba(234,216,165,.52)';
      ctx.font='900 24px Arial, sans-serif';
      ctx.fillText('PITCHING AREA • BULLPEN',0,0);
      ctx.restore();

      drawOpponentFrame(ctx,frameColor,10,10);
      ctx.strokeStyle='rgba(226,211,172,.28)';
      ctx.lineWidth=2;
      ctx.strokeRect(22,22,1036,1036);
    }
    function drawBg2Background(ctx, frameColor = '#d7ad52') {
      const W = 1080;
      const H = 1080;

      // 暖白底
      const paper = ctx.createLinearGradient(0, 0, W, H);
      paper.addColorStop(0, '#f8f5f0');
      paper.addColorStop(1, '#e9e5df');
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);

      // 淡淡紙張顆粒（固定位置，不會閃）
      ctx.save();
      ctx.globalAlpha = .10;
      ctx.fillStyle = '#64748b';
      for (let y = 18; y < 1060; y += 34) {
        for (let x = 16 + ((y / 34) % 2) * 11; x < 1060; x += 43) {
          const r = 1 + ((x + y) % 3) * .35;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 左上深藍三角區
      ctx.fillStyle = '#061a2d';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(370, 0);
      ctx.lineTo(0, 545);
      ctx.closePath();
      ctx.fill();

      // 三角區內深淺層次
      ctx.fillStyle = 'rgba(15,52,84,.65)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(315, 0);
      ctx.lineTo(0, 455);
      ctx.closePath();
      ctx.fill();

      // 紅色動感斜線
      ctx.strokeStyle = '#e1282d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(330, 0);
      ctx.lineTo(22, 478);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(300, 0);
      ctx.lineTo(5, 435);
      ctx.stroke();

      ctx.fillStyle = '#e1282d';
      ctx.beginPath();
      ctx.moveTo(78, 318);
      ctx.lineTo(156, 282);
      ctx.lineTo(118, 346);
      ctx.lineTo(48, 375);
      ctx.closePath();
      ctx.fill();

      // 左側球場燈
      ctx.save();
      ctx.globalAlpha = .85;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const x = 18 + col * 23;
          const y = 170 + row * 22;
          const g = ctx.createRadialGradient(x, y, 1, x, y, 15);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(.25, '#f8fbff');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 左下球場看台（淡化）
      ctx.save();
      ctx.globalAlpha = .28;
      ctx.strokeStyle = '#52657d';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 660 + i * 22);
        ctx.quadraticCurveTo(280, 620 + i * 18, 610, 675 + i * 18);
        ctx.stroke();
      }
      ctx.globalAlpha = .14;
      ctx.fillStyle = '#263b52';
      for (let y = 680; y < 820; y += 18) {
        for (let x = 10; x < 575; x += 21) {
          ctx.beginPath();
          ctx.arc(x + ((y / 18) % 2) * 7, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 草地
      const grass = ctx.createLinearGradient(0, 790, 0, 900);
      grass.addColorStop(0, 'rgba(81,112,50,.20)');
      grass.addColorStop(1, 'rgba(54,83,35,.65)');
      ctx.fillStyle = grass;
      ctx.fillRect(0, 800, 615, 105);
      ctx.save();
      ctx.globalAlpha = .16;
      for (let x = 0; x < 615; x += 34) {
        ctx.fillStyle = (x / 34) % 2 ? '#90a85f' : '#49662f';
        ctx.fillRect(x, 800, 17, 105);
      }
      ctx.restore();

      // 內野泥土
      const dirt = ctx.createLinearGradient(0, 900, 0, 1080);
      dirt.addColorStop(0, '#a95e2d');
      dirt.addColorStop(1, '#653416');
      ctx.fillStyle = dirt;
      ctx.fillRect(0, 900, 650, 180);
      ctx.save();
      ctx.globalAlpha = .22;
      ctx.fillStyle = '#2d160b';
      for (let y = 910; y < 1080; y += 13) {
        for (let x = 4; x < 650; x += 17) {
          ctx.fillRect(x + ((x + y) % 7), y, 2, 2);
        }
      }
      ctx.restore();

      // 白色界外線
      ctx.strokeStyle = 'rgba(255,255,255,.88)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 958);
      ctx.lineTo(585, 1080);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 915);
      ctx.lineTo(560, 1000);
      ctx.stroke();

      // 淡棒球縫線浮水印
      ctx.save();
      ctx.globalAlpha = .065;
      ctx.strokeStyle = '#9a765e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(735, 600, 245, -1.1, 1.35);
      ctx.stroke();
      for (let a = -1.0; a < 1.25; a += .18) {
        const x = 735 + Math.cos(a) * 245;
        const y = 600 + Math.sin(a) * 245;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 7);
        ctx.lineTo(x + 8, y + 7);
        ctx.stroke();
      }
      ctx.restore();

      // 右下姓名斜角帶
      ctx.fillStyle = '#f6f4f1';
      ctx.beginPath();
      ctx.moveTo(575, 1080);
      ctx.lineTo(1080, 805);
      ctx.lineTo(1080, 1080);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#10284a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(605, 1078);
      ctx.lineTo(1080, 820);
      ctx.stroke();
      ctx.strokeStyle = '#e1282d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(635, 1080);
      ctx.lineTo(1080, 842);
      ctx.stroke();

      // 最底部深藍帶
      ctx.fillStyle = '#071d32';
      ctx.beginPath();
      ctx.moveTo(705, 1080);
      ctx.lineTo(1080, 880);
      ctx.lineTo(1080, 1080);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e1282d';
      ctx.beginPath();
      ctx.moveTo(930, 1080);
      ctx.lineTo(1080, 975);
      ctx.lineTo(1080, 1010);
      ctx.lineTo(988, 1080);
      ctx.closePath();
      ctx.fill();

      // 再蓋一層淺色姓名帶，讓文字清楚
      ctx.fillStyle = 'rgba(248,246,243,.94)';
      ctx.beginPath();
      ctx.moveTo(620, 1080);
      ctx.lineTo(1080, 835);
      ctx.lineTo(1080, 1050);
      ctx.lineTo(1025, 1080);
      ctx.closePath();
      ctx.fill();

      // 小隊色裝飾線
      ctx.strokeStyle = frameColor || '#d7ad52';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(635, 1065);
      ctx.lineTo(1035, 1065);
      ctx.stroke();

      drawBg2QEquipment(ctx);

      // 外圍對手色框線
      ctx.save();
      ctx.strokeStyle = frameColor || '#d7ad52';
      ctx.lineWidth = 18;
      ctx.lineJoin = 'round';
      ctx.strokeRect(9, 9, W - 18, H - 18);
      ctx.strokeStyle = 'rgba(255,255,255,.72)';
      ctx.lineWidth = 2;
      ctx.strokeRect(21, 21, W - 42, H - 42);
      ctx.restore();
    }

    function drawBg2QEquipment(ctx) {
      // 陰影
      ctx.save();
      ctx.globalAlpha = .14;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(740, 238, 285, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Q版球棒
      ctx.save();
      ctx.translate(465, 152);
      ctx.rotate(-0.18);
      const batGrad = ctx.createLinearGradient(0, 0, 280, 0);
      batGrad.addColorStop(0, '#d99a4b');
      batGrad.addColorStop(.55, '#f0c477');
      batGrad.addColorStop(1, '#c27b32');
      ctx.fillStyle = batGrad;
      ctx.strokeStyle = '#5c371c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(22, -14);
      ctx.quadraticCurveTo(80, -24, 245, -22);
      ctx.quadraticCurveTo(282, -20, 286, 0);
      ctx.quadraticCurveTo(282, 20, 245, 22);
      ctx.quadraticCurveTo(80, 24, 22, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#172033';
      ctx.beginPath();
      ctx.roundRect(-18, -14, 52, 28, 10);
      ctx.fill();
      ctx.strokeStyle = '#667085';
      ctx.lineWidth = 2;
      for (let x = -10; x < 27; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, -13);
        ctx.lineTo(x, 13);
        ctx.stroke();
      }
      ctx.fillStyle = '#d99a4b';
      ctx.strokeStyle = '#5c371c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-20, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Q版手套
      ctx.save();
      ctx.translate(690, 170);
      ctx.fillStyle = '#bd7432';
      ctx.strokeStyle = '#603416';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-58, 48);
      ctx.quadraticCurveTo(-68, 5, -38, -18);
      ctx.quadraticCurveTo(-22, -32, -8, -18);
      ctx.quadraticCurveTo(5, -42, 22, -25);
      ctx.quadraticCurveTo(34, -42, 48, -20);
      ctx.quadraticCurveTo(68, -25, 73, 0);
      ctx.quadraticCurveTo(87, 18, 71, 50);
      ctx.quadraticCurveTo(44, 79, 3, 76);
      ctx.quadraticCurveTo(-39, 77, -58, 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#f2c184';
      ctx.lineWidth = 3;
      for (const x of [-30, -8, 15, 38]) {
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.quadraticCurveTo(x - 3, 22, x + 2, 48);
        ctx.stroke();
      }
      ctx.strokeStyle = '#6b3b1c';
      ctx.beginPath();
      ctx.arc(8, 43, 30, .2, Math.PI - .15);
      ctx.stroke();
      ctx.restore();

      // Q版棒球（有表情）
      ctx.save();
      ctx.translate(832, 178);
      ctx.fillStyle = '#fffdf8';
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 43, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#d52b31';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-24, 0, 33, -1.15, 1.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(24, 0, 33, Math.PI - 1.15, Math.PI + 1.15);
      ctx.stroke();
      for (let t = -20; t <= 20; t += 10) {
        ctx.beginPath();
        ctx.moveTo(-31, t - 4);
        ctx.lineTo(-22, t + 2);
        ctx.moveTo(31, t - 4);
        ctx.lineTo(22, t + 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#172033';
      ctx.beginPath(); ctx.arc(-11, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#172033';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 5, 10, .2, Math.PI - .2); ctx.stroke();
      ctx.fillStyle = '#f19aa0';
      ctx.beginPath(); ctx.arc(-21, 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(21, 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Q版打擊頭盔
      ctx.save();
      ctx.translate(955, 160);
      const helmetGrad = ctx.createLinearGradient(-55, -55, 60, 60);
      helmetGrad.addColorStop(0, '#263f63');
      helmetGrad.addColorStop(1, '#07192f');
      ctx.fillStyle = helmetGrad;
      ctx.strokeStyle = '#020b15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-58, 20);
      ctx.quadraticCurveTo(-58, -52, 5, -62);
      ctx.quadraticCurveTo(65, -57, 68, 8);
      ctx.lineTo(55, 42);
      ctx.quadraticCurveTo(20, 60, -28, 45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(40, 10);
      ctx.quadraticCurveTo(88, 12, 105, 34);
      ctx.quadraticCurveTo(76, 48, 34, 40);
      ctx.closePath();
      ctx.fillStyle = '#10284a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.beginPath();
      ctx.ellipse(-8, -33, 22, 8, -.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 小星星
      const stars = [[546,108,'#e1282d'], [613,133,'#10284a'], [787,94,'#e1282d'], [1010,92,'#d7ad52']];
      for (const [x,y,c] of stars) {
        ctx.save();
        ctx.translate(x,y);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0,-9); ctx.lineTo(3,-3); ctx.lineTo(9,0); ctx.lineTo(3,3); ctx.lineTo(0,9); ctx.lineTo(-3,3); ctx.lineTo(-9,0); ctx.lineTo(-3,-3); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    function drawBg2Header(ctx, layout, opponent, dateText, frameColor) {
      const h = layout.header;
      ctx.textAlign = 'left';
      ctx.font = `900 ${layout.fonts.headerVs}px "Microsoft JhengHei", sans-serif`;
      ctx.fillStyle = h.textColor || '#ffffff';
      ctx.fillText('VS ', h.vsX, h.vsY);
      const vsW = ctx.measureText('VS ').width;
      ctx.fillStyle = frameColor || '#ffffff';
      ctx.fillText(opponent, h.vsX + vsW, h.vsY);

      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.dateX, h.dateY - 24);
      ctx.lineTo(205, h.dateY - 24);
      ctx.stroke();

      ctx.fillStyle = h.dateColor || '#ffffff';
      ctx.font = `800 ${layout.fonts.headerDate}px Arial, "Microsoft JhengHei", sans-serif`;
      ctx.fillText(dateText, h.dateX, h.dateY);
      ctx.fillStyle = '#e1282d';
      ctx.fillRect(215, h.dateY - 22, 4, 25);
    }

    function drawBg2MetricFrame(ctx, card) {
      ctx.save();
      ctx.fillStyle = card.bg || 'rgba(255,255,255,.82)';
      ctx.fillRect(card.x, card.y, card.w, card.h);
      ctx.strokeStyle = '#ef4f43';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(card.x, card.y, card.w, card.h);
      ctx.strokeStyle = 'rgba(239,79,67,.65)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(card.x + 7, card.y + 7, card.w - 14, card.h - 14);
      ctx.restore();
    }

    function drawBg2DetailHeading(ctx, text, detail) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e1282d';
      ctx.fillRect(detail.headingX - 15, detail.headingY - 26, 5, 29);
      ctx.fillStyle = '#10284a';
      ctx.font = '900 31px "Microsoft JhengHei", sans-serif';
      ctx.fillText(text, detail.headingX, detail.headingY);
      ctx.strokeStyle = 'rgba(16,40,74,.42)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(detail.underlineX, detail.underlineY);
      ctx.lineTo(detail.underlineX + detail.underlineW, detail.underlineY);
      ctx.stroke();
      ctx.restore();
    }

    function tracePhotoFramePath(ctx, frame) {
      const { x, y, w, h, r = 0, cutTopLeft = 0, cutBottomRight = 0 } = frame;
      ctx.beginPath();
      if (cutTopLeft || cutBottomRight) {
        ctx.moveTo(x + cutTopLeft, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - cutBottomRight);
        ctx.lineTo(x + w - cutBottomRight, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + cutTopLeft);
        ctx.closePath();
      } else {
        ctx.roundRect(x, y, w, h, r);
      }
    }

    function drawPhotoFrameBase(ctx, frame) {
      ctx.save();
      tracePhotoFramePath(ctx, frame);
      ctx.fillStyle = frame.bg || '#314766';
      ctx.fill();
      if (frame.border) {
        ctx.strokeStyle = frame.border;
        ctx.lineWidth = frame.borderWidth || 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPhotoImageInFrame(ctx, img, frame, transform = { x: 0, y: 0, scale: 1 }) {
      const { x, y, w, h } = frame;
      const safeTransform = clampPhotoTransform(img, transform);
      const scale = Math.max(w / img.width, h / img.height) * safeTransform.scale;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2 + safeTransform.x;
      const drawY = y + (h - drawH) / 2 + safeTransform.y;
      ctx.save();
      tracePhotoFramePath(ctx, frame);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
      if (frame.border) {
        ctx.save();
        tracePhotoFramePath(ctx, frame);
        ctx.strokeStyle = frame.border;
        ctx.lineWidth = frame.borderWidth || 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawPhotoPlaceholderFrame(ctx, frame) {
      ctx.save();
      tracePhotoFramePath(ctx, frame);
      ctx.fillStyle = frame.bg || '#314766';
      ctx.fill();
      ctx.clip();
      if (frame.cutTopLeft || frame.cutBottomRight) {
        ctx.fillStyle = 'rgba(16,40,74,.05)';
        for (let x = frame.x - frame.h; x < frame.x + frame.w + frame.h; x += 44) {
          ctx.fillRect(x, frame.y, 18, frame.h);
        }
      }
      ctx.restore();
      if (frame.border) {
        ctx.save();
        tracePhotoFramePath(ctx, frame);
        ctx.strokeStyle = frame.border;
        ctx.lineWidth = frame.borderWidth || 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    function roundRect(ctx, x, y, w, h, r, fill) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }


    function loadEmbeddedImage(src) {
      if (!decorImageCache.has(src)) {
        decorImageCache.set(src, new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('裝飾圖片載入失敗'));
          img.src = src;
        }));
      }
      return decorImageCache.get(src);
    }

    function drawContain(ctx, img, x, y, w, h) {
      const scale = Math.min(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2;
      const drawY = y + (h - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    function drawPhotoPlaceholder(ctx, x, y, w, h) {
      ctx.save();
      ctx.fillStyle = '#314766';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    function blobToImage(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片載入失敗')); };
        img.src = url;
      });
    }

    function getPhotoImage(photo) {
      if (!photoImageCache.has(photo.id)) {
        const promise = blobToImage(photo.blob).catch(error => {
          photoImageCache.delete(photo.id);
          throw error;
        });
        photoImageCache.set(photo.id, promise);
      }
      return photoImageCache.get(photo.id);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, Number(value) || 0));
    }

    function clampPhotoTransform(img, transform = { x: 0, y: 0, scale: 1 }) {
      const { w, h } = getPhotoFrame();
      const zoom = clamp(transform.scale ?? 1, 1, 3);
      const coverScale = Math.max(w / img.width, h / img.height);
      const scale = coverScale * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const baseX = (w - drawW) / 2;
      const baseY = (h - drawH) / 2;
      return {
        x: clamp(transform.x, baseX, -baseX),
        y: clamp(transform.y, baseY, -baseY),
        scale: zoom
      };
    }

    function drawImageCover(ctx, img, x, y, w, h, r, transform = { x: 0, y: 0, scale: 1 }) {
      const safeTransform = clampPhotoTransform(img, transform);
      const scale = Math.max(w / img.width, h / img.height) * safeTransform.scale;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (w - drawW) / 2 + safeTransform.x;
      const drawY = y + (h - drawH) / 2 + safeTransform.y;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    function canvasPoint(event) {
      const rect = els.canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * els.canvas.width / rect.width,
        y: (event.clientY - rect.top) * els.canvas.height / rect.height
      };
    }

    function pointInPhotoFrame(point) {
      const frame = getPhotoFrame();
      const { x, y, w, h, cutTopLeft = 0, cutBottomRight = 0 } = frame;
      if (point.x < x || point.x > x + w || point.y < y || point.y > y + h) return false;
      const lx = point.x - x;
      const ly = point.y - y;
      if (cutTopLeft && lx + ly < cutTopLeft) return false;
      if (cutBottomRight && lx + ly > w + h - cutBottomRight) return false;
      return true;
    }

    function drawTags(ctx, tags, boxX, boxBottom, maxWidth, bgColor = '#20324f') {
      if (!tags.length) return;

      const layout = getCurrentTemplate();
      ctx.font = `900 ${layout.fonts.tagText}px "Microsoft JhengHei", sans-serif`;
      const gap = 10;
      const rowGap = 10;
      const tagHeight = 52;
      const rows = [];
      let currentRow = [];
      let currentWidth = 0;

      for (const tag of tags) {
        const width = ctx.measureText(tag).width + 40;
        const nextWidth = currentRow.length ? currentWidth + gap + width : width;
        if (currentRow.length && nextWidth > maxWidth) {
          rows.push(currentRow);
          currentRow = [];
          currentWidth = 0;
        }
        currentRow.push({ tag, width });
        currentWidth += (currentRow.length > 1 ? gap : 0) + width;
      }
      if (currentRow.length) rows.push(currentRow);

      const totalHeight = rows.length * tagHeight + (rows.length - 1) * rowGap;
      let y = boxBottom - totalHeight;

      for (const row of rows) {
        const rowWidth = row.reduce((sum, item) => sum + item.width, 0) + gap * (row.length - 1);
        let x = boxX + maxWidth - rowWidth;
        for (const item of row) {
          roundRect(ctx, x, y, item.width, tagHeight, 20, bgColor);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.font = `900 ${layout.fonts.tagText}px "Microsoft JhengHei", sans-serif`;
          ctx.fillText(item.tag, x + 20, y + 36);
          x += item.width + gap;
        }
        y += tagHeight + rowGap;
      }
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    }

    function escapeAttr(value) { return escapeHtml(value); }

    els.backHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    els.majorLevelBtn?.addEventListener('click', () => switchPlayerLevel('A'));
    els.minorLevelBtn?.addEventListener('click', () => switchPlayerLevel('D'));
    els.seasonSelect?.addEventListener('change', () => {
      syncAppPickerLabels();
      switchPlayerSeason(els.seasonSelect.value);
    });

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
        homeRootSection = button.dataset.homeRoot === 'international' ? 'international' : 'pro';
        if (homeRootSection === 'international') {
          homeZone = 'international';
          homeSpecialFilter = '';
          homeInternationalEditionFilter = '';
          homeInternationalTeamFilter = '';
        } else {
          applyHomeProSelection();
        }
        homeTeamFilter = '';
        renderRecentPlayers();
      });
    });

    els.homeProCountrySwitch?.querySelectorAll('[data-pro-country]').forEach(button => {
      button.addEventListener('click', () => {
        const country = button.dataset.proCountry;
        homeProCountry = ['TW','US','JP','KR'].includes(country) ? country : 'TW';
        homeRootSection = 'pro';
        homeTeamFilter = '';
        applyHomeProSelection();
        renderRecentPlayers();
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

    function renderDatePicker() {
      if (!els.datePickerGrid || !els.datePickerMonthLabel) return;
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      if (!(datePickerView instanceof Date) || !Number.isFinite(datePickerView.getTime())) {
        datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      }

      const year = datePickerView.getFullYear();
      const month = datePickerView.getMonth();
      els.datePickerMonthLabel.textContent = `${year} 年 ${month + 1} 月`;

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

    els.gameDateButton?.addEventListener('click', openDatePicker);
    els.datePickerPrev?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() - 1, 1);
      renderDatePicker();
    });
    els.datePickerNext?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() + 1, 1);
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
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '搜尋中職官網…';
      try {
        const searchName = String(name || '').trim();
        const found = await cpblRequest('search-player', { name: searchName, number });
        const official = found.player;
        if (!official) throw new Error(`中職官網找不到「${searchName} #${number}」。`);

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
            player.cpblCurrentLevel = roster.player.level === 'D' ? 'D' : 'A';
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

    function currentOutputFileName(roleOverride = '') {
      const player = selectedPlayer();
      if (!player || !currentRecord) return 'player-stat.png';
      const role = roleOverride === 'pitcher' || roleOverride === 'hitter' ? roleOverride : player.type;
      const hitterAppearance = role === 'hitter' ? ensureHitterAppearance() : null;
      const hitterFileType = hitterAppearance?.mode === 'runner'
        ? (hitterAppearance.continueDefense ? '代跑後接替守備' : '純代跑')
        : hitterAppearance?.mode === 'defense' ? '純代守' : '打擊戰績';
      return `${currentRecord.date}_${reportPlayerName(player)}_${role === 'pitcher' ? '投球戰績' : hitterFileType}.png`;
    }

    function dailyHitterRoleHasData(hitter) {
      if (!hitter) return false;
      if (Array.isArray(hitter.plateAppearances) && hitter.plateAppearances.length) return true;
      return ['pa','ab','hits','runs','rbi','bb','hbp','hr','k']
        .some(key => Number(hitter?.[key]) > 0);
    }

    function dailyPitcherRoleHasData(pitcher) {
      if (!pitcher) return false;
      const innings = String(pitcher.innings || '');
      if (innings && innings !== '0' && innings !== '0.0') return true;
      return ['outs','h','bb','hbp','k','r','er','pitchCount','w','l','sv','hld']
        .some(key => Number(pitcher?.[key]) > 0);
    }

    function currentDualDailyRoles() {
      const pair = currentRecord?.externalRoleDaily;
      if (!pair) return [];
      const roles = [];
      if (dailyHitterRoleHasData(pair.hitter)) roles.push('hitter');
      if (dailyPitcherRoleHasData(pair.pitcher)) roles.push('pitcher');
      return roles;
    }

    function seasonStatsForOutputRole(player, role) {
      const level = supportsLeagueLevelTabs(player) ? selectedLevel : 'A';
      const pair = roleStatsPair(player, selectedSeason, level);
      if (role === 'hitter') {
        if (hitterRoleHasData(pair?.hitter)) return { ...pair.hitter };
        return player.type === 'hitter' ? { ...mergeStats(player.stats, hitterDefaults) } : hitterDefaults();
      }
      if (pitcherRoleHasData(pair?.pitcher)) return { ...pair.pitcher };
      return player.type === 'pitcher' ? { ...mergeStats(player.stats, pitcherDefaults) } : pitcherDefaults();
    }

    function annualSeasonContext(player) {
      const scope = playerScope(player);
      if (isUsPlayer(player)) {
        const entry = currentUsCareerEntry(player);
        return {
          year:Number(entry?.year || selectedSeason || CURRENT_YEAR),
          team:String(entry?.organizationName || entry?.teamName || player.externalCurrentOrganization || player.externalCurrentTeam || player.externalTeam || '球隊未提供').trim(),
          league:String(entry?.level || player.externalCurrentLevel || 'MLB / MiLB').trim(),
          detail:String(entry?.teamName || '').trim()
        };
      }
      if (scope === 'cpbl') {
        return {
          year:Number(selectedSeason || CURRENT_YEAR),
          team:normalizeTeamName(String(player.cpblTeam || '').replace(/二軍$/,'').trim()) || '球隊未提供',
          league:`CPBL ${cpblLevelLabel(selectedLevel)}`,
          detail:''
        };
      }
      if (scope === 'overseas') {
        const provider=overseasProviderLabel(player.externalProvider || playerSpecialCompetition(player));
        const hasLevels=supportsLeagueLevelTabs(player);
        return {
          year:Number(selectedSeason || player.externalYear || CURRENT_YEAR),
          team:String(player.externalTeam || playerDisplayTeam(player) || '球隊未提供').trim(),
          league:[provider, hasLevels ? cpblLevelLabel(selectedLevel) : ''].filter(Boolean).join(' '),
          detail:''
        };
      }
      if (scope === 'international') {
        return {
          year:Number(player.externalYear || selectedSeason || CURRENT_YEAR),
          team:internationalTeam(player) || '代表隊未提供',
          league:playerSpecialCompetition(player) || '國際賽',
          detail:''
        };
      }
      return {
        year:Number(selectedSeason || CURRENT_YEAR),
        team:playerDisplayTeam(player) || '球隊未提供',
        league:'',
        detail:''
      };
    }

    function activeSeasonReportRole(player) {
      if (!player) return 'hitter';

      if (supportsUsDualRoleTabs(player) && selectedTab === 'secondary') {
        return player.type === 'pitcher' ? 'hitter' : 'pitcher';
      }

      if (supportsLeagueLevelTabs(player)
          && selectedRoleView === 'secondary'
          && selectedLevelHasSecondaryRole(player)) {
        return player.type === 'pitcher' ? 'hitter' : 'pitcher';
      }

      return player.type === 'pitcher' ? 'pitcher' : 'hitter';
    }

    function annualSeasonRoles(player) {
      const level = supportsLeagueLevelTabs(player) ? selectedLevel : 'A';
      const pair = roleStatsPair(player, selectedSeason, level);
      const roles = [];
      if (hitterRoleHasData(pair?.hitter)) roles.push('hitter');
      if (pitcherRoleHasData(pair?.pitcher)) roles.push('pitcher');

      if (isUsPlayer(player)) {
        const entry=currentUsCareerEntry(player);
        if (entry?.hitter && !roles.includes('hitter')) roles.push('hitter');
        if (entry?.pitcher && !roles.includes('pitcher')) roles.push('pitcher');
      }
      return roles.length ? ['hitter','pitcher'].filter(role=>roles.includes(role)) : [player.type];
    }

    function annualTextFit(ctx, text, maxWidth, startSize, minSize = 18, weight = 900, family = '"Microsoft JhengHei", Arial, sans-serif') {
      let size = Number(startSize) || 30;
      ctx.font = `${weight} ${size}px ${family}`;
      while (ctx.measureText(String(text)).width > maxWidth && size > minSize) {
        size -= 2;
        ctx.font = `${weight} ${size}px ${family}`;
      }
      return size;
    }

    function annualPanel(ctx, x, y, w, h, { fill='rgba(5,18,29,.94)', border='rgba(55,139,179,.72)', radius=14, lineWidth=2 } = {}) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x,y,w,h,radius);
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.strokeStyle=border;
      ctx.lineWidth=lineWidth;
      ctx.stroke();
      ctx.restore();
    }

    function annualDrawBackground(ctx) {
      const W=1080,H=1080;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#06121c';
      ctx.fillRect(0,0,W,H);

      const glow=ctx.createRadialGradient(850,220,40,850,220,620);
      glow.addColorStop(0,'rgba(18,87,123,.20)');
      glow.addColorStop(1,'rgba(18,87,123,0)');
      ctx.fillStyle=glow;
      ctx.fillRect(0,0,W,H);

      ctx.save();
      ctx.strokeStyle='rgba(45,112,145,.14)';
      ctx.lineWidth=1;
      for(let x=24;x<W;x+=24){
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
      }
      for(let y=24;y<H;y+=24){
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle='rgba(65,151,190,.78)';
      ctx.lineWidth=3;
      ctx.strokeRect(18,18,W-36,H-36);
      ctx.strokeStyle='rgba(255,204,77,.80)';
      ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(18,18);ctx.lineTo(330,18);ctx.stroke();
      ctx.restore();
    }

    function annualDrawMetricRow(ctx, metrics) {
      const x=38,y=170,totalW=1004,gap=12;
      const w=(totalW-gap*3)/4;
      metrics.forEach((metric,index)=>{
        const mx=x+index*(w+gap);
        const active=index===1;
        annualPanel(ctx,mx,y,w,118,{
          fill:active?'#f2bc38':'rgba(5,20,32,.94)',
          border:active?'#ffd56a':'rgba(61,140,178,.78)',
          radius:13,lineWidth:2
        });
        ctx.textAlign='center';
        ctx.fillStyle=active?'#102031':'#89b6ca';
        ctx.font='800 22px "Microsoft JhengHei", sans-serif';
        ctx.fillText(metric[0],mx+w/2,y+38);
        ctx.fillStyle=active?'#07131f':'#f5fbff';
        annualTextFit(ctx,metric[1],w-24,46,30,900,'Arial, sans-serif');
        ctx.fillText(metric[1],mx+w/2,y+91);
      });
    }

    function annualDrawStatGrid(ctx, role, stats) {
      const panel={x:38,y:318,w:610,h:644};
      annualPanel(ctx,panel.x,panel.y,panel.w,panel.h,{
        fill:'rgba(4,16,25,.94)',
        border:'rgba(54,139,180,.72)',
        radius:16,lineWidth:2
      });

      ctx.fillStyle='#ffca45';
      ctx.fillRect(panel.x+18,panel.y+18,5,34);
      ctx.textAlign='left';
      ctx.fillStyle='#f5fbff';
      ctx.font='900 29px "Microsoft JhengHei", sans-serif';
      ctx.fillText(role==='pitcher'?'本季成績（投手）':'本季打擊成績',panel.x+34,panel.y+46);
      ctx.textAlign='right';
      ctx.fillStyle='#7fb0c7';
      ctx.font='700 14px Arial, sans-serif';
      ctx.fillText(`${selectedSeason} SEASON TOTALS`,panel.x+panel.w-20,panel.y+42);

      ctx.strokeStyle='rgba(74,142,172,.28)';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(panel.x+18,panel.y+66);
      ctx.lineTo(panel.x+panel.w-18,panel.y+66);
      ctx.stroke();

      const s = role==='pitcher' ? mergeStats(stats,pitcherDefaults) : mergeStats(stats,hitterDefaults);
      const hd = role==='hitter' ? hitterDerived(s) : null;
      const items = role==='hitter'
        ? [
            ['打席','PA',s.pa],['打數','AB',s.ab],['安打','H',hd.hits],['得分','R',s.runs],
            ['打點','RBI',s.rbi],['一壘打','1B',s.single],['二壘打','2B',s.double],['三壘打','3B',s.triple],
            ['全壘打','HR',s.hr],['四壞球','BB',s.bb],['故意四壞','IBB',s.ibb],['觸身球','HBP',s.hbp],
            ['三振','SO',s.k],['犧牲短打','SH',s.sacBunt],['犧牲飛球','SF',s.sacFly],['失誤','E',s.errors]
          ]
        : [
            ['勝投','W',s.w],['敗投','L',s.l],['救援成功','SV',s.sv],
            ['中繼成功','HLD',s.hld],['完投','CG',s.cg],['完封','SHO',s.sho],
            ['被安打','H',s.h],['四壞球','BB',s.bb],['死球','HBP',s.hbp],
            ['奪三振','K',s.k],['自責分','ER',s.er]
          ];

      const cols=role==='hitter'?4:3;
      const rows=Math.ceil(items.length/cols);
      const gridX=panel.x+18;
      const gridY=panel.y+84;
      const gridW=panel.w-36;
      const gapX=10,gapY=10;
      const cellW=(gridW-gapX*(cols-1))/cols;
      const usableH=panel.h-106;
      const cellH=(usableH-gapY*(rows-1))/rows;

      items.forEach((item,index)=>{
        const col=index%cols,row=Math.floor(index/cols);
        const x=gridX+col*(cellW+gapX);
        const y=gridY+row*(cellH+gapY);
        annualPanel(ctx,x,y,cellW,cellH,{
          fill:'rgba(6,22,34,.88)',
          border:'rgba(46,111,143,.72)',
          radius:10,lineWidth:1.5
        });
        ctx.textAlign='center';
        ctx.fillStyle='#86bfd9';
        ctx.font=`800 ${role==='hitter'?16:18}px "Microsoft JhengHei", sans-serif`;
        ctx.fillText(item[0],x+cellW/2,y+27);
        ctx.fillStyle='#76aeca';
        ctx.font='700 13px Arial, sans-serif';
        ctx.fillText(item[1],x+cellW/2,y+47);
        ctx.fillStyle='#f7fbff';
        annualTextFit(ctx,String(item[2] ?? 0),cellW-18,34,22,900,'Arial, sans-serif');
        ctx.fillText(String(item[2] ?? 0),x+cellW/2,y+cellH-22);
      });
    }

    async function annualDrawPhotoAndName(ctx, player, role, context) {
      const frame={x:674,y:318,w:368,h:506,r:16};
      annualPanel(ctx,frame.x,frame.y,frame.w,frame.h,{
        fill:'#0a1d2a',border:'rgba(64,149,189,.82)',radius:16,lineWidth:3
      });

      const photo=photos.find(p=>p.id===player.selectedPhotoId && p.playerId===player.id);
      if(photo){
        try{
          const img=await getPhotoImage(photo);
          const scale=Math.max(frame.w/img.width,frame.h/img.height);
          const drawW=img.width*scale,drawH=img.height*scale;
          const drawX=frame.x+(frame.w-drawW)/2;
          const drawY=frame.y+(frame.h-drawH)/2;
          ctx.save();
          ctx.beginPath();ctx.roundRect(frame.x,frame.y,frame.w,frame.h,frame.r);ctx.clip();
          ctx.drawImage(img,drawX,drawY,drawW,drawH);
          const shade=ctx.createLinearGradient(0,frame.y,0,frame.y+frame.h);
          shade.addColorStop(0,'rgba(3,13,21,.02)');
          shade.addColorStop(1,'rgba(3,13,21,.28)');
          ctx.fillStyle=shade;ctx.fillRect(frame.x,frame.y,frame.w,frame.h);
          ctx.restore();
        }catch{}
      }

      const plate={x:674,y:842,w:368,h:120};
      annualPanel(ctx,plate.x,plate.y,plate.w,plate.h,{
        fill:'rgba(4,14,22,.97)',border:'rgba(255,202,69,.80)',radius:12,lineWidth:2
      });
      const title=`#${player.number || ''} ${reportPlayerName(player)}`.trim();
      ctx.textAlign='left';
      ctx.fillStyle='#f7fbff';
      annualTextFit(ctx,title,plate.w-38,40,25,900);
      ctx.fillText(title,plate.x+20,plate.y+48);
      ctx.fillStyle='#ffca45';
      ctx.fillRect(plate.x+20,plate.y+66,plate.w-40,3);
      ctx.fillStyle='#87b7cb';
      ctx.font='800 18px Arial, sans-serif';
      ctx.fillText(role==='pitcher'?'PITCHER':'HITTER',plate.x+20,plate.y+98);

      ctx.textAlign='right';
      ctx.fillStyle='#7eaec4';
      ctx.font='700 13px "Microsoft JhengHei", sans-serif';
      const detail=context.detail && context.detail!==context.team ? context.detail : '';
      if(detail) ctx.fillText(detail,plate.x+plate.w-20,plate.y+98);
    }

    async function renderAnnualSeasonCanvas(role, player=selectedPlayer()) {
      if(!player) throw new Error('請先選擇球員。');
      role=role==='pitcher'?'pitcher':'hitter';

      const stats=seasonStatsForOutputRole(player,role);
      const context=annualSeasonContext(player);
      const ctx=els.canvas.getContext('2d');
      annualDrawBackground(ctx);

      ctx.textAlign='left';
      ctx.fillStyle='#f7fbff';
      ctx.font='900 48px Arial, sans-serif';
      ctx.fillText(String(context.year),48,88);
      ctx.fillStyle='#ffca45';
      ctx.fillText(' SEASON REPORT',ctx.measureText(String(context.year)).width+48,88);

      const subtitle=[context.team,context.league].filter(Boolean).join('｜');
      ctx.fillStyle='#e6f2f8';
      annualTextFit(ctx,subtitle,960,24,16,800);
      ctx.fillText(subtitle,48,126);

      ctx.textAlign='right';
      ctx.fillStyle='#7eafc5';
      ctx.font='700 12px Arial, sans-serif';
      ctx.fillText('PLAYER DATA // SEASON',1036,60);
      ctx.fillStyle='#ffca45';
      ctx.fillRect(970,76,66,3);

      if(role==='hitter'){
        const d=hitterDerived(stats);
        annualDrawMetricRow(ctx,[
          ['打擊率',fmtBatRate(d.avg)],
          ['上壘率',fmtBatRate(d.obp)],
          ['長打率',fmtBatRate(d.slg)],
          ['OPS',fmtBatRate(d.obp+d.slg)]
        ]);
      }else{
        const d=pitcherDerived(stats);
        annualDrawMetricRow(ctx,[
          ['防禦率',fmtTwo(d.era)],
          ['WHIP',fmtTwo(d.whip)],
          ['投球局數',outsToIP(stats.outs)],
          ['奪三振',String(Number(stats.k)||0)]
        ]);
      }

      annualDrawStatGrid(ctx,role,stats);
      await annualDrawPhotoAndName(ctx,player,role,context);

      ctx.fillStyle='rgba(3,13,20,.98)';
      ctx.fillRect(18,982,1044,72);
      ctx.strokeStyle='rgba(54,132,168,.52)';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(18,982);ctx.lineTo(1062,982);ctx.stroke();

      ctx.textAlign='left';
      ctx.fillStyle='#ffca45';
      ctx.font='800 15px Arial, sans-serif';
      ctx.fillText(`PLAYER DATA // ${role==='pitcher'?'PITCHER':'HITTER'}`,44,1025);

      ctx.textAlign='right';
      ctx.fillStyle='#85b5ca';
      ctx.font='700 14px "Microsoft JhengHei", sans-serif';
      annualTextFit(ctx,[context.team,context.league].filter(Boolean).join('｜'),500,14,11,700);
      ctx.fillText([context.team,context.league].filter(Boolean).join('｜'),1034,1025);

      return {role,stats,context};
    }

    function annualSeasonFileName(player,role,context) {
      const team=String(context?.team||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'');
      const league=String(context?.league||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,'');
      return `${context?.year || selectedSeason}_${reportPlayerName(player)}_${team}${league ? '_'+league : ''}_${role==='pitcher'?'年度投球戰報':'年度打擊戰報'}.png`;
    }

    async function captureAnnualSeasonOutput(role) {
      const player=selectedPlayer();
      if(!player) throw new Error('請先選擇球員。');
      const result=await renderAnnualSeasonCanvas(role,player);
      const blob=await new Promise(resolve=>els.canvas.toBlob(resolve,'image/png'));
      if(!blob) throw new Error('年度戰報圖片產生失敗。');
      const fileName=annualSeasonFileName(player,role,result.context);
      return {
        role,
        kind:'season',
        blob,
        fileName,
        file:new File([blob],fileName,{type:'image/png'})
      };
    }

    async function prepareAnnualSeasonReports() {
      const player=selectedPlayer();
      if(!player) throw new Error('請先選擇球員。');

      const roles=annualSeasonRoles(player);
      const outputs=[];
      for(const role of roles){
        outputs.push(await captureAnnualSeasonOutput(role));
      }
      preparedOutputKind='season';
      preparedOutputs=outputs;
      preparedOutput=outputs[0]||null;
      updatePreparedOutputDialog();

      if(outputs[0]) await renderAnnualSeasonCanvas(outputs[0].role,player);
      return outputs;
    }

    function outputRecordForRole(baseRecord, role) {
      const next = {
        ...baseRecord,
        hitterPAs: Array.isArray(baseRecord?.hitterPAs) ? baseRecord.hitterPAs.map(pa => ({ ...pa })) : [],
        hitterAppearance: {
          ...defaultGameRecord(selectedPlayer()).hitterAppearance,
          ...(baseRecord?.hitterAppearance || {})
        },
        pitcherGame: {
          ...defaultGameRecord(selectedPlayer()).pitcherGame,
          ...(baseRecord?.pitcherGame || {})
        },
        cpblGameSummary: {
          ...defaultGameRecord(selectedPlayer()).cpblGameSummary,
          ...(baseRecord?.cpblGameSummary || {})
        }
      };

      const pair = baseRecord?.externalRoleDaily || null;
      if (!pair) return next;

      // v1.91: prepared/download output must match the visible preview exactly.
      // Never overwrite an already-populated currentRecord with a thinner raw
      // provider payload, because some providers omit derived/manual flags such
      // as CG/SHO and express decisions as "decision:L" instead of w/l.
      if (role === 'hitter' && pair.hitter) {
        const existingHitter = dailyHitterRoleHasData({
          ...(next.internationalHitterGame || {}),
          plateAppearances: next.hitterPAs
        });

        if (!existingHitter) {
          const h = pair.hitter;
          const list = Array.isArray(h.plateAppearances) ? h.plateAppearances : [];
          next.hitterAppearance.mode = 'bat';
          next.hitterPAs = list.map(pa => ({
            id: uid(),
            code: pa.code || 'OUT',
            position: pa.position || '',
            rbi: Number(pa.rbi) || 0,
            cpblOfficialAction: pa.officialAction || ''
          }));
          next.cpblGameSummary = {
            runs: Math.max(0, Number(h.runs) || 0),
            hits: Math.max(0, Number(h.hits) || 0),
            errors: Math.max(0, Number(h.errors) || 0),
            official: true
          };
          next.internationalHitterGame = { ...h };
        }
      }

      if (role === 'pitcher' && pair.pitcher) {
        const existingPitcher = dailyPitcherRoleHasData(next.pitcherGame);
        if (!existingPitcher) {
          const p = pair.pitcher;
          const pitchCount = Math.max(0, Math.min(150, Number(p.pitchCount) || 0));
          const decision = ['W','L'].includes(String(p.decision || '').toUpperCase())
            ? String(p.decision).toUpperCase()
            : (Number(p.w) > 0 ? 'W' : Number(p.l) > 0 ? 'L' : (next.pitcherGame.decision || 'ND'));

          next.pitcherGame = {
            ...next.pitcherGame,
            innings: p.innings || outsToIP(Number(p.outs) || 0) || next.pitcherGame.innings || '0.0',
            k: Number(p.k) || 0,
            bb: Number(p.bb) || 0,
            h: Number(p.h) || 0,
            hbp: Number(p.hbp) || 0,
            r: Number(p.r) || 0,
            er: Math.min(Math.max(0, Number(p.r) || 0), Math.max(0, Number(p.er) || 0)),
            pitchTens: Math.floor(pitchCount / 10),
            pitchOnes: pitchCount >= 150 ? 0 : pitchCount % 10,
            cg: p.cg === undefined ? Boolean(next.pitcherGame.cg) : Boolean(Number(p.cg) || p.cg),
            sho: p.sho === undefined ? Boolean(next.pitcherGame.sho) : Boolean(Number(p.sho) || p.sho),
            hld: p.hld === undefined ? Boolean(next.pitcherGame.hld) : Boolean(Number(p.hld) || p.hld),
            sv: p.sv === undefined ? Boolean(next.pitcherGame.sv) : Boolean(Number(p.sv) || p.sv),
            bsv: p.bsv === undefined ? Boolean(next.pitcherGame.bsv) : Boolean(Number(p.bsv) || p.bsv),
            decision,
            result: Boolean(Number(p.sv) || p.sv) ? 'SV'
              : Boolean(Number(p.hld) || p.hld) ? 'HLD'
              : decision
          };
          next.externalWalksCombined = Boolean(p.walksCombined);
        }
      }

      return next;
    }

    async function capturePreparedOutputForRole(role) {
      const player = selectedPlayer();
      if (!player || !currentRecord) throw new Error('請先選擇球員與戰報日期。');

      const originalType = player.type;
      const originalStats = player.stats;
      const originalRecord = currentRecord;
      const originalTodayRoleView = todayRoleView;
      try {
        player.type = role;
        player.stats = seasonStatsForOutputRole(player, role);
        currentRecord = outputRecordForRole(originalRecord, role);
        todayRoleView = role;

        await renderCanvas();
        const blob = await new Promise(resolve => els.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('圖片產生失敗。');

        const fileName = currentOutputFileName(role);
        return {
          role,
          blob,
          fileName,
          file: new File([blob], fileName, { type:'image/png' })
        };
      } finally {
        player.type = originalType;
        player.stats = originalStats;
        currentRecord = originalRecord;
        todayRoleView = originalTodayRoleView;
      }
    }

    function updatePreparedOutputDialog() {
      const count = preparedOutputs.length || (preparedOutput ? 1 : 0);
      const annual = preparedOutputKind === 'season';
      if (els.outputDialogTitle) {
        els.outputDialogTitle.textContent = annual
          ? (count > 1 ? `${count} 張年度戰報已準備完成` : '年度戰報已準備完成')
          : (count > 1 ? `${count} 張圖片已準備完成` : '圖片已準備完成');
      }
      if (els.downloadPreparedLabel) els.downloadPreparedLabel.textContent = count > 1 ? `下載 ${count} 張圖片` : '下載圖片';
      if (els.sharePreparedLabel) els.sharePreparedLabel.textContent = count > 1 ? `分享 ${count} 張圖片` : '分享圖片';
      els.outputBackgroundBtn?.classList.toggle('hidden', annual);
    }

    async function generatePreparedOutputsFromCanvas() {
      preparedOutputKind = 'daily';
      const player = selectedPlayer();
      if (!player || !currentRecord) throw new Error('請先選擇球員。');

      const officialRoles = currentDualDailyRoles();
      const roles = officialRoles.length
        ? ['hitter','pitcher'].filter(role => officialRoles.includes(role))
        : [player.type];
      const outputs = [];

      for (const role of roles) {
        outputs.push(await capturePreparedOutputForRole(role));
      }

      preparedOutputs = outputs;
      preparedOutput = outputs[0] || null;
      updatePreparedOutputDialog();

      // 輸出完成後把右側預覽還原成球員目前主要角色。
      await renderCanvas();
      return outputs;
    }

    async function refreshPreparedOutputFromCanvas() {
      return await generatePreparedOutputsFromCanvas();
    }

    async function prepareOutputImage() {
      const player = selectedPlayer();
      const shouldRefreshKboPlateAppearances = Boolean(
        player
        && playerScope(player) === 'overseas'
        && String(player.externalProvider || '').toUpperCase() === 'KBO'
        && player.type === 'hitter'
        && currentRecord?.externalReadOnlyImport
        && currentRecord?.cpblGameSummary?.official
        && !(Array.isArray(currentRecord?.hitterPAs) && currentRecord.hitterPAs.length)
      );
      if (shouldRefreshKboPlateAppearances) {
        try {
          await importExternalDaily(player);
        } catch (error) {
          console.warn('KBO 逐打席重新抓取失敗', error);
        }
      }
      await commitCurrentGame();
      return await generatePreparedOutputsFromCanvas();
    }

    async function downloadPreparedOutput() {
      const outputs = preparedOutputs.length ? preparedOutputs : (preparedOutput ? [preparedOutput] : []);
      if (!outputs.length) throw new Error('請先產生圖片。');

      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i];
        const url = URL.createObjectURL(output.blob);
        const link = document.createElement('a');
        link.download = output.fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
        if (i < outputs.length - 1) await new Promise(resolve => setTimeout(resolve, 260));
      }
    }

    async function sharePreparedOutput() {
      const outputs = preparedOutputs.length ? preparedOutputs : (preparedOutput ? [preparedOutput] : []);
      if (!outputs.length) throw new Error('請先產生圖片。');

      const files = outputs.map(output => output.file);
      const canShareFiles = Boolean(
        navigator.share
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files })
      );

      if (!canShareFiles) {
        throw new Error('這台裝置／瀏覽器不支援一次分享這些圖片，請改用「下載圖片」。');
      }

      await navigator.share({
        files,
        title: outputs.length > 1 ? '球員投打戰績圖片' : '球員戰績圖片'
      });
    }

    els.downloadBtn.addEventListener('click', async () => {
      try {
        if (selectedTab !== 'today') throw new Error('請到「今日戰績」產生當天戰報。');
        setStatus('正在更新當天數據並產生戰報…');
        const outputs = await prepareOutputImage();
        els.outputDialog?.showModal();
        const count = outputs.length;
        setStatus(count > 1
          ? `投球與打擊戰報已分開產生，共 ${count} 張圖片。`
          : ((currentRecord.cpblReadOnlyImport || currentRecord.externalReadOnlyImport)
              ? '圖片已準備完成；官方單場資料不會重複更新球員累積數據。'
              : '圖片已準備完成，球員基礎數據已同步更新。'));
        renderAll();
      } catch (error) {
        setStatus(error?.message || '圖片產生失敗。', true);
      }
    });

    els.seasonReportBtn?.addEventListener('click', async () => {
      try {
        const player=selectedPlayer();
        if(!player) throw new Error('請先選擇球員。');
        if (!['base','minor','secondary'].includes(selectedTab) || playerScope(player) === 'international') {
          throw new Error('請到一軍／二軍整季成績頁輸出年度戰報。');
        }
        const context=annualSeasonContext(player);
        const levelText=supportsLeagueLevelTabs(player) ? (selectedLevel==='D'?'二軍':'一軍') : (context.league||'');
        setStatus(`正在產生 ${context.year} ${levelText}整季戰報…`);
        const outputs=await prepareAnnualSeasonReports();
        els.outputDialog?.showModal();
        setStatus(outputs.length>1
          ? `已產生 ${outputs.length} 張年度戰報（打擊＋投球）。`
          : `${context.year} 年度戰報已準備完成。`);
      } catch (error) {
        setStatus(error?.message || '年度戰報產生失敗。', true);
      }
    });

    els.downloadPreparedBtn?.addEventListener('click', async () => {
      try {
        const count = preparedOutputs.length || (preparedOutput ? 1 : 0);
        await downloadPreparedOutput();
        els.outputDialog?.close();
        showAppToast(count > 1 ? `已下載 ${count} 張圖片` : '已下載');
        setStatus(count > 1 ? `已下載 ${count} 張圖片。` : '圖片已下載。');
      } catch (error) {
        setStatus(error?.message || '下載失敗。', true);
      }
    });

    els.sharePreparedBtn?.addEventListener('click', async () => {
      try {
        await sharePreparedOutput();
        setStatus('已開啟系統分享器。');
      } catch (error) {
        if (error?.name === 'AbortError') {
          setStatus('已取消分享。');
          return;
        }
        setStatus(error?.message || '分享失敗。', true);
      }
    });

    els.outputBackgroundBtn?.addEventListener('click', () => {
      if (preparedOutputKind === 'season') return;
      els.outputDialog?.close();
      renderQuickTemplates();
      els.quickTemplateDialog?.showModal();
    });

    async function init() {
      try {
        db = await openDB();
        players = await idbGetAll(STORES.players);
        photos = await idbGetAll(STORES.photos);
        for (const player of players) {
          ensurePhotoTransforms(player);
          const fixedName = applyStoredPreferredExternalName(player);
          const fixedTeam = applyStoredPreferredExternalTeam(player);
          const fixedExternalRole = repairStoredExternalPlayerType(player);
          const fixedCpblRole = repairStoredCpblPlayerType(player);
          if (fixedName || fixedTeam || fixedExternalRole || fixedCpblRole) await idbPut(STORES.players, player);
        }
        for (const photo of photos) {
          if (!photo.playerId) {
            const owner = players.find(player => player.selectedPhotoId === photo.id);
            if (owner) {
              photo.playerId = owner.id;
              await idbPut(STORES.photos, photo);
            }
          }
        }
        els.gameDate.value = localISODate();
        syncAppPickerLabels();
        selectedTab = localStorage.getItem('baseballSelectedTab') || 'base';
        if (!['base', 'minor', 'secondary', 'today', 'photos'].includes(selectedTab)) selectedTab = 'base';
        currentPage = 'home';
        const savedPlayerId = localStorage.getItem('baseballSelectedPlayerId');
        selectedPlayerId = players.some(p => p.id === savedPlayerId) ? savedPlayerId : (players[0]?.id || null);

        // 先完成本機資料載入；CPBL 目前軍別改成背景更新，不能卡住啟動。
        selectedLevel = 'A';
        if (selectedPlayerId) {
          const player = selectedPlayer();
          selectedSeason = availableSeasonYears(player, 'A')[0] || CURRENT_YEAR;
          if (playerScope(player) === 'cpbl' || supportsLeagueLevelTabs(player)) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }
          await savePlayer(player);
          await loadRecord();
        }
        renderAll();
      } catch (error) {
        console.error(error);
        setStatus('無法開啟瀏覽器資料庫。', true);
      }
    }


    let serviceWorkerRegistration = null;
    let appRefreshing = false;
    let appUpdateProgressVisible = false;

    function setVersionBadge(text = APP_VERSION, checking = false) {
      const badge = document.getElementById('appVersionBadge');
      if (!badge) return;
      badge.textContent = text;
      badge.classList.toggle('checking', checking);
    }

    function setAppUpdateProgress(percent, status, { error = false } = {}) {
      const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      appUpdateProgressVisible = true;
      els.appUpdateOverlay?.classList.remove('hidden');
      els.appUpdateCard?.classList.toggle('error', Boolean(error));
      if (els.appUpdatePercent) els.appUpdatePercent.textContent = `${value}%`;
      if (els.appUpdateStatus) els.appUpdateStatus.textContent = status || '';
      if (els.appUpdateBar) els.appUpdateBar.style.width = `${value}%`;
    }

    function hideAppUpdateProgress() {
      appUpdateProgressVisible = false;
      els.appUpdateOverlay?.classList.add('hidden');
      els.appUpdateCard?.classList.remove('error');
    }

    async function appUpdateStep(percent, status, delay = 110) {
      setAppUpdateProgress(percent, status);
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    }

    async function finishAppUpdateProgress(status, { keepOpen = false } = {}) {
      setAppUpdateProgress(100, status);
      if (keepOpen) return;
      await new Promise(resolve => setTimeout(resolve, 520));
      hideAppUpdateProgress();
    }

    function waitForWorkerSettle(worker, timeout = 9000) {
      return new Promise(resolve => {
        if (!worker || ['installed','activated','redundant'].includes(worker.state)) {
          resolve(worker?.state || 'none');
          return;
        }

        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          worker.removeEventListener('statechange', onState);
          resolve(worker.state);
        };
        const onState = () => {
          if (['installed','activated','redundant'].includes(worker.state)) done();
        };
        worker.addEventListener('statechange', onState);
        setTimeout(done, timeout);
      });
    }

    async function activateWaitingWorker(registration) {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      return false;
    }

    async function checkAppUpdate({ manual = false, showProgress = false, keepProgressOpen = false } = {}) {
      if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
        if (showProgress) {
          await appUpdateStep(0, '準備檢查更新…', 80);
          await finishAppUpdateProgress('本機檔案模式，不需檢查更新', { keepOpen: keepProgressOpen });
        }
        if (manual) {
          setStatus('目前是本機檔案模式；自動更新需要用 HTTPS 網址／PWA 開啟。', true);
        }
        return { activated:false };
      }

      setVersionBadge(`${APP_VERSION} · 檢查中`, true);

      try {
        if (showProgress) await appUpdateStep(0, '準備檢查更新…', 90);
        if (showProgress) await appUpdateStep(15, `目前版本 ${APP_VERSION}`, 110);

        const reg = serviceWorkerRegistration
          || await navigator.serviceWorker.getRegistration()
          || await navigator.serviceWorker.register(SERVICE_WORKER_URL, { updateViaCache: 'none' });
        serviceWorkerRegistration = reg;

        if (showProgress) await appUpdateStep(32, '正在連線檢查新版…', 110);

        // 直接向線上 index.html 比對版本。這不依賴 service worker 檔案本身有沒有改動，
        // 可避免「網站已部署新版，但舊頁面一直停在舊 APP_VERSION」。
        try {
          const versionUrl = new URL('./index.html', location.href);
          versionUrl.searchParams.set('__version_check', Date.now().toString());
          const versionResponse = await fetch(versionUrl.href, { cache: 'no-store' });
          if (versionResponse.ok) {
            const remoteHtml = await versionResponse.text();
            const metaMatch = remoteHtml.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);
            const legacyMatch = remoteHtml.match(/const APP_VERSION = '([^']+)'/);
            const remoteVersion = String(metaMatch?.[1] || legacyMatch?.[1] || '').trim();
            if (remoteVersion && remoteVersion !== APP_VERSION) {
              if (showProgress) setAppUpdateProgress(82, `找到新版 ${remoteVersion}，正在重新載入…`);
              if (manual) setStatus(`找到新版 ${remoteVersion}，正在重新載入…`);
              appRefreshing = true;
              sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');
              const reloadUrl = new URL(location.href);
              reloadUrl.searchParams.set('__app_version', remoteVersion);
              setTimeout(() => location.replace(reloadUrl.href), 120);
              return { activated:true, remoteVersion };
            }
          }
        } catch (versionError) {
          console.warn('線上版本比對失敗：', versionError);
        }

        await promiseTimeout(
          reg.update(),
          manual ? 8000 : 2500,
          '更新伺服器回應逾時'
        );

        if (showProgress) await appUpdateStep(55, '正在比對程式版本…', 100);

        const installing = reg.installing;
        if (installing) {
          if (showProgress) await appUpdateStep(70, '找到新版，正在下載…', 80);
          await waitForWorkerSettle(installing, manual ? 9000 : 3500);
        } else if (showProgress) {
          await appUpdateStep(72, '版本確認完成…', 100);
        }

        const activated = await activateWaitingWorker(reg);
        if (activated) {
          if (showProgress) setAppUpdateProgress(92, '正在套用新版…');
          if (manual) setStatus('找到新版，正在套用更新…');
          return { activated:true };
        }

        if (showProgress) {
          await appUpdateStep(90, '正在整理程式快取…', 100);
          if (keepProgressOpen) {
            setAppUpdateProgress(86, '更新檢查完成，正在載入球員資料…');
          } else {
            await finishAppUpdateProgress('目前已是最新版本');
          }
        }
        return { activated:false };
      } catch (error) {
        console.error('更新檢查失敗：', error);
        if (showProgress) {
          if (keepProgressOpen) {
            setAppUpdateProgress(82, '更新檢查失敗，正在載入目前資料…', { error: true });
          } else {
            setAppUpdateProgress(100, '更新檢查失敗，使用目前版本', { error: true });
            await new Promise(resolve => setTimeout(resolve, 950));
            hideAppUpdateProgress();
          }
        }
        if (manual) setStatus('檢查更新失敗，請確認網路後再試。', true);
        return { activated:false };
      } finally {
        if (!appRefreshing) {
          setTimeout(() => setVersionBadge(APP_VERSION, false), 500);
        }
      }
    }

    async function setupAppUpdate() {
      const badge = document.getElementById('appVersionBadge');
      if (badge) {
        badge.textContent = APP_VERSION;
        badge.addEventListener('click', () => checkAppUpdate({ manual: true, showProgress: true }));
      }

      const skipStartupSplash = sessionStorage.getItem('baseballSkipStartupSplashOnce') === '1';
      if (skipStartupSplash) sessionStorage.removeItem('baseballSkipStartupSplashOnce');

      if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
        if (!skipStartupSplash) {
          await checkAppUpdate({ showProgress: true, keepProgressOpen: true });
        } else {
          setAppUpdateProgress(86, '正在載入球員資料…');
        }
        return false;
      }

      try {
        const reg = await promiseTimeout(
          navigator.serviceWorker.register(SERVICE_WORKER_URL, {
            updateViaCache: 'none'
          }),
          2500,
          'Service Worker 註冊逾時'
        );
        serviceWorkerRegistration = reg;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (appRefreshing) return;
          appRefreshing = true;
          sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');

          if (appUpdateProgressVisible) {
            setAppUpdateProgress(100, '新版已就緒，正在重新開啟…');
            setTimeout(() => location.reload(), 280);
          } else {
            location.reload();
          }
        });

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          if (appUpdateProgressVisible) setAppUpdateProgress(68, '找到新版，正在下載…');

          worker.addEventListener('statechange', async () => {
            if (appUpdateProgressVisible && worker.state === 'installed') {
              setAppUpdateProgress(88, '新版下載完成，正在套用…');
            }
          });
        });

        let updateResult = { activated:false };
        if (!skipStartupSplash) {
          updateResult = await checkAppUpdate({ showProgress: true, keepProgressOpen: true });
        } else {
          setAppUpdateProgress(86, '新版已套用，正在載入球員資料…');
        }

        setInterval(() => checkAppUpdate(), 15 * 60 * 1000);

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkAppUpdate();
        });

        if (updateResult?.activated) {
          // controllerchange 正常會立刻重新載入；留一個 fallback 避免瀏覽器漏事件。
          setTimeout(() => {
            if (appRefreshing) return;
            appRefreshing = true;
            sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');
            location.reload();
          }, 1300);
          return true;
        }

        return appRefreshing;
      } catch (error) {
        console.error('Service Worker 設定失敗：', error);
        setAppUpdateProgress(82, '更新檢查失敗，正在載入目前資料…', { error: true });
        return false;
      }
    }

    async function bootApp() {
      // 本機資料和更新檢查同時跑；首頁顯示前再確認一次所有已連結球員目前軍別。
      const initPromise = init();
      const updatePromise = setupAppUpdate();

      const willReloadForUpdate = await updatePromise;
      if (willReloadForUpdate) return;

      setAppUpdateProgress(88, '正在準備球員資料…');
      await initPromise;

      setAppUpdateProgress(94, '正在確認球員目前一軍／二軍狀態…');
      await refreshCurrentRosterStatus();
      renderAll();

      setAppUpdateProgress(100, '資料已準備完成');
      await new Promise(resolve => setTimeout(resolve, 220));
      hideAppUpdateProgress();
    }

    bootApp();
  
