    const APP_VERSION = 'v2.10';
    const appSplashVersionEl = document.getElementById('appSplashVersion');
    if (appSplashVersionEl) appSplashVersionEl.textContent = `VERSION ${APP_VERSION}`;
    const SERVICE_WORKER_URL = `./service-worker.js?v=${encodeURIComponent(APP_VERSION)}`;
    const DB_NAME = 'baseball-player-card-test-v1';
    const DB_VERSION = 1;
    const STORES = { players: 'players', photos: 'photos', games: 'games' };
    const CPBL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-client';
    const BASEBALL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/baseball-client';
    const DEFAULT_HITTER_PHOTO_URL = './assets/default-hitter.jpg?v=v2.10';
    const DEFAULT_PITCHER_PHOTO_URL = './assets/default-pitcher.jpg?v=v2.10';
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


