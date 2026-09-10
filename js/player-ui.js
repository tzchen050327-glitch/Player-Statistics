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

