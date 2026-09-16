    const NPB_SEASON_BRIDGE_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-season-bridge';

    function npbBridgeTokyoDate() {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit'
        }).format(new Date());
      } catch (_) {
        return localISODate();
      }
    }

    function isNpbSeasonBridgePlayer(player) {
      return Boolean(
        player
        && playerScope(player) === 'overseas'
        && String(player.externalProvider || '').toUpperCase() === 'NPB'
        && player.externalPlayerId
      );
    }

    function npbBridgeViewDate() {
      const recordDate = String(currentRecord?.date || '');
      if (recordDate) return recordDate;
      return String(els.gameDate?.value || npbBridgeTokyoDate());
    }

    function clearNpbStoredBridgeMeta(stats) {
      if (!stats || typeof stats !== 'object') return;
      delete stats.npbPregame;
      delete stats.npbBridgeActive;
      delete stats.npbOfficialCaughtUp;
      delete stats.npbBridgeGameId;
      delete stats.npbBridgeStatus;
      delete stats.npbBridgeDate;
      delete stats.npbBridgeCapturedAt;
      delete stats.npbBridgeAuthority;
    }

    function applyNpbBridgeMetaToPlayer(player, year, bridgeByRole = {}) {
      const pair = roleStatsPair(player, year, 'A');
      for (const role of ['hitter','pitcher']) {
        const stored = pair?.[role];
        if (!stored) continue;
        const bridge = bridgeByRole?.[role] || null;
        if (!bridge) {
          clearNpbStoredBridgeMeta(stored);
          continue;
        }
        stored.npbPregame = bridge.pregame ? { ...bridge.pregame } : null;
        stored.npbBridgeActive = bridge.active === true;
        stored.npbOfficialCaughtUp = bridge.officialCaughtUp === true;
        stored.npbBridgeGameId = String(bridge.gameId || '');
        stored.npbBridgeStatus = String(bridge.status || '');
        stored.npbBridgeDate = String(bridge.date || '');
        stored.npbBridgeCapturedAt = bridge.capturedAt || null;
        stored.npbBridgeAuthority = String(bridge.authority || '');
      }
    }

    async function npbSeasonBridgeRequest(player, {
      year = selectedSeason,
      date = npbBridgeViewDate()
    } = {}) {
      const response = await fetch(NPB_SEASON_BRIDGE_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          action:'status',
          id:String(player.externalPlayerId || ''),
          year:Number(year) || CURRENT_YEAR,
          date:String(date || npbBridgeTokyoDate()),
          team:String(player.externalTeam || player.externalCurrentTeam || ''),
          name:String(player.externalOfficialName || player.name || '')
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data?.stats) {
        throw new Error(data?.error || `NPB 賽前橋接查詢失敗（${response.status}）`);
      }
      return data;
    }

    async function refreshNpbSeasonBridgeForPlayer(player, {
      year = selectedSeason,
      date = npbBridgeViewDate(),
      saveRecordState = true
    } = {}) {
      if (!isNpbSeasonBridgePlayer(player)) return null;
      if (Number(year) !== Number(npbBridgeTokyoDate().slice(0, 4))) return null;
      if (String(date || '') !== npbBridgeTokyoDate()) return null;

      const data = await npbSeasonBridgeRequest(player, { year, date });
      applyExternalSeasonStats(player, data.stats, year, 'A');
      applyNpbBridgeMetaToPlayer(player, year, data.bridgeByRole || {});
      player.npbBridgeLastCheckedAt = Date.now();
      player.npbBridgeGameId = String(data.gameId || '');
      player.npbBridgeStatus = String(data.status || '');
      await savePlayer(player);

      if (currentRecord && String(currentRecord.date || '') === String(date)) {
        currentRecord.npbSeasonBridgeByRole = data.bridgeByRole || {};
        currentRecord.npbSeasonBridgeGameId = String(data.gameId || '');
        currentRecord.npbSeasonBridgeStatus = String(data.status || '');
        currentRecord.npbSeasonBridgeCheckedAt = Date.now();
        if (saveRecordState) await saveRecord();
      }
      return data;
    }

    const syncExternalSeasonBeforeNpbBridge = syncExternalSeason;
    syncExternalSeason = async function(player, requestedYear = selectedSeason, onProgress = null, level = selectedLevel) {
      const normalizedLevel = level === 'D' ? 'D' : 'A';
      const currentNpbYear = Number(npbBridgeTokyoDate().slice(0, 4));
      if (!isNpbSeasonBridgePlayer(player)
          || normalizedLevel !== 'A'
          || Number(requestedYear) !== currentNpbYear) {
        return await syncExternalSeasonBeforeNpbBridge(player, requestedYear, onProgress, level);
      }

      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch (_) {}
      };
      report(18, '正在確認 NPB 官方個人頁與賽前快照…');
      try {
        const data = await refreshNpbSeasonBridgeForPlayer(player, {
          year:requestedYear,
          date:npbBridgeTokyoDate(),
          saveRecordState:Boolean(currentRecord && String(currentRecord.date || '') === npbBridgeTokyoDate())
        });
        report(76, data?.bridgeActive
          ? 'NPB 個人頁尚未寫入本場，使用 Supabase 賽前快照暫算…'
          : '正在整理 NPB 官方球季資料…');
        report(94, '正在更新球員資料…');
        return data?.stats || null;
      } catch (error) {
        console.warn('NPB 賽前橋接失敗，回退一般球季同步', error);
        return await syncExternalSeasonBeforeNpbBridge(player, requestedYear, onProgress, level);
      }
    };

    const importExternalDailyBeforeNpbBridge = importExternalDaily;
    importExternalDaily = async function(player) {
      const imported = await importExternalDailyBeforeNpbBridge(player);
      if (!imported || !isNpbSeasonBridgePlayer(player)) return imported;
      if (String(els.gameDate?.value || '') !== npbBridgeTokyoDate()) return imported;
      if (String(currentRecord?.externalLeagueLevel || '一軍') !== '一軍') return imported;

      try {
        await refreshNpbSeasonBridgeForPlayer(player, {
          year:Number(els.gameDate.value.slice(0, 4)) || CURRENT_YEAR,
          date:els.gameDate.value,
          saveRecordState:true
        });
        renderAll();
        await renderCanvas();
      } catch (error) {
        console.warn('NPB 當日資料匯入後橋接狀態更新失敗', error);
      }
      return imported;
    };

    const seasonStatsForOutputRoleBeforeNpbBridge = seasonStatsForOutputRole;
    seasonStatsForOutputRole = function(player, role) {
      const level = supportsLeagueLevelTabs(player) ? selectedLevel : 'A';
      if (!isNpbSeasonBridgePlayer(player) || level !== 'A') {
        return seasonStatsForOutputRoleBeforeNpbBridge(player, role);
      }

      const pair = roleStatsPair(player, selectedSeason, level);
      const storedRole = role === 'pitcher' ? pair?.pitcher : pair?.hitter;
      const viewDate = String(currentRecord?.date || npbBridgeTokyoDate());
      const liveBridge = currentRecord?.npbSeasonBridgeByRole?.[role] || null;
      const storedBridgeCurrent = storedRole?.npbBridgeDate === viewDate;
      const pregame = liveBridge?.pregame
        || (storedBridgeCurrent ? storedRole?.npbPregame : null);
      const bridgeActive = liveBridge
        ? liveBridge.active === true && liveBridge.officialCaughtUp !== true
        : storedBridgeCurrent
          && storedRole?.npbBridgeActive === true
          && storedRole?.npbOfficialCaughtUp !== true;

      if (!bridgeActive || !pregame) {
        return seasonStatsForOutputRoleBeforeNpbBridge(player, role);
      }

      if (role === 'hitter') {
        const projected = { ...mergeStats(pregame, hitterDefaults) };
        const pas = Array.isArray(currentRecord?.hitterPAs) ? currentRecord.hitterPAs : [];
        const game = deriveHitterGame(pas);

        // NPB 個人頁只有 BB，沒有獨立 IBB 欄；橋接期間把故意四壞併回 BB。
        game.bb = (Number(game.bb) || 0) + (Number(game.ibb) || 0);
        game.ibb = 0;
        for (const key of Object.keys(emptyHitterContribution())) {
          projected[key] = (Number(projected[key]) || 0) + (Number(game[key]) || 0);
        }
        projected.k = (Number(projected.k) || 0)
          + pas.filter(pa => ['K','KREACH'].includes(String(pa?.code || '').toUpperCase())).length;

        const officialDaily = currentRecord?.externalRoleDaily?.hitter
          || currentRecord?.internationalHitterGame
          || liveBridge?.game
          || null;
        const officialRuns = Number(officialDaily?.runs);
        if (Number.isFinite(officialRuns)) {
          projected.runs = (Number(pregame.runs) || 0) + Math.max(0, officialRuns);
        }
        const officialErrors = Number(officialDaily?.errors);
        if (Number.isFinite(officialErrors)) {
          projected.errors = (Number(pregame.errors) || 0) + Math.max(0, officialErrors);
        }
        projected.npbBridgeActive = true;
        projected.npbOfficialCaughtUp = false;
        projected.npbBridgeAuthority = 'supabase-pregame+current-game-editor';
        return projected;
      }

      if (role === 'pitcher') {
        const projected = { ...mergeStats(pregame, pitcherDefaults) };
        const game = derivePitcherGame(currentRecord?.pitcherGame || {});
        for (const key of Object.keys(game)) {
          projected[key] = (Number(projected[key]) || 0) + (Number(game[key]) || 0);
        }
        delete projected.cpblEra;
        delete projected.cpblWhip;
        projected.cpblRatesOfficial = false;
        projected.npbBridgeActive = true;
        projected.npbOfficialCaughtUp = false;
        projected.npbBridgeAuthority = 'supabase-pregame+current-game-editor';
        return projected;
      }

      return seasonStatsForOutputRoleBeforeNpbBridge(player, role);
    };

    let npbSeasonBridgePollBusy = false;
    setInterval(async () => {
      if (npbSeasonBridgePollBusy || currentPage !== 'player') return;
      const player = selectedPlayer();
      if (!isNpbSeasonBridgePlayer(player) || selectedLevel !== 'A') return;
      if (!currentRecord || String(currentRecord.date || '') !== npbBridgeTokyoDate()) return;
      const bridgeActive = Object.values(currentRecord.npbSeasonBridgeByRole || {})
        .some(item => item?.active === true && item?.officialCaughtUp !== true);
      if (!bridgeActive && !currentRecord.externalReadOnlyImport) return;

      npbSeasonBridgePollBusy = true;
      try {
        const before = JSON.stringify(currentRecord.npbSeasonBridgeByRole || {});
        await refreshNpbSeasonBridgeForPlayer(player, {
          year:Number(currentRecord.date.slice(0, 4)) || CURRENT_YEAR,
          date:currentRecord.date,
          saveRecordState:true
        });
        const after = JSON.stringify(currentRecord.npbSeasonBridgeByRole || {});
        if (before !== after) {
          renderAll();
          await renderCanvas();
        }
      } catch (error) {
        console.warn('NPB 橋接背景檢查失敗', error);
      } finally {
        npbSeasonBridgePollBusy = false;
      }
    }, 60_000);
