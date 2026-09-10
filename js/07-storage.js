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

