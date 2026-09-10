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

