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

