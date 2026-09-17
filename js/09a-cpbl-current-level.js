    // Keep CPBL player-page level aligned with the official current roster when entering a player.
    // The base/minor tabs encode A/D in renderAll(), so selectedTab must move together with selectedLevel.
    const selectPlayerBeforeCpblCurrentLevelFix = selectPlayer;

    async function refreshSelectedCpblCurrentLevel(player) {
      if (!player || playerScope(player) !== 'cpbl' || !player.cpblAcnt) return;
      try {
        const data = await promiseTimeout(
          cpblRequest('current-roster', { acnt: player.cpblAcnt }),
          4500,
          '目前一二軍狀態查詢逾時'
        );
        const current = data?.player || null;
        if (!current) return;

        if (current.team) player.cpblTeam = normalizeTeamName(current.team);
        if (current.teamCode) player.cpblTeamCode = String(current.teamCode);
        if (current.number) player.number = String(current.number);
        const level = String(current.level || '').toUpperCase();
        if (level === 'A' || level === 'D') player.cpblCurrentLevel = level;
        repairStoredCpblPlayerType(player, current.position || '');
        player.cpblRosterUpdatedAt = Date.now();
        await savePlayer(player);
      } catch (error) {
        console.warn('進入球員頁時目前一二軍狀態更新失敗，沿用最近一次判定', error);
      }
    }

    async function alignSelectedCpblCurrentLevel(player) {
      if (!player || playerScope(player) !== 'cpbl') return;
      const level = String(player.cpblCurrentLevel || '').toUpperCase();
      if (level !== 'A' && level !== 'D') return;

      if (selectedLevel !== level) persistActiveStatsProfile(player);
      selectedLevel = level;
      selectedTab = level === 'D' ? 'minor' : 'base';

      const years = availableSeasonYears(player, level);
      selectedSeason = years[0] || CURRENT_YEAR;
      activatePlayerStatsProfile(player, selectedSeason, level);
      await loadRecord();
      renderAll();
    }

    selectPlayer = async function selectPlayerWithCpblCurrentLevel(id) {
      const enteringPlayer = players.find(player => player.id === id) || null;
      if (enteringPlayer && playerScope(enteringPlayer) === 'cpbl' && enteringPlayer.cpblAcnt) {
        await refreshSelectedCpblCurrentLevel(enteringPlayer);
      }

      await selectPlayerBeforeCpblCurrentLevelFix(id);

      const player = selectedPlayer();
      if (!player || player.id !== id || currentPage !== 'player') return;
      await alignSelectedCpblCurrentLevel(player);
    };
