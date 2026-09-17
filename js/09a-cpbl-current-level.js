    // CPBL current roster is already refreshed on app startup for the homepage.
    // Reuse that cached result when opening a player instead of issuing another roster request.
    // While the original navigation/sync runs, render-controller consistency code keeps
    // selectedTab / selectedLevel / player.stats on the same A/D profile.
    const selectPlayerBeforeCpblCurrentLevelFix = selectPlayer;
    let cpblEntryPreferredLevelState = null;

    function cpblCachedCurrentLevel(player) {
      if (!player || playerScope(player) !== 'cpbl') return '';
      const level = String(player.cpblCurrentLevel || '').toUpperCase();
      return level === 'A' || level === 'D' ? level : '';
    }

    async function alignSelectedCpblCurrentLevel(player, level = cpblCachedCurrentLevel(player)) {
      if (!player || playerScope(player) !== 'cpbl' || (level !== 'A' && level !== 'D')) return;

      selectedLevel = level;
      selectedTab = level === 'D' ? 'minor' : 'base';

      const years = availableSeasonYears(player, level);
      selectedSeason = years.includes(CURRENT_YEAR) ? CURRENT_YEAR : (years[0] || CURRENT_YEAR);
      activatePlayerStatsProfile(player, selectedSeason, level);
      await loadRecord();
      renderAll();
    }

    selectPlayer = async function selectPlayerWithCpblCurrentLevel(id) {
      const enteringPlayer = players.find(player => player.id === id) || null;
      const preferredLevel = cpblCachedCurrentLevel(enteringPlayer);

      cpblEntryPreferredLevelState = preferredLevel
        ? { playerId: id, level: preferredLevel }
        : null;

      try {
        await selectPlayerBeforeCpblCurrentLevelFix(id);

        const player = selectedPlayer();
        if (!player || player.id !== id || currentPage !== 'player') return;

        // Re-assert the homepage roster decision after season-history sync finishes.
        // This prevents a final render from showing D stats inside the A form (or vice versa).
        await alignSelectedCpblCurrentLevel(player, cpblCachedCurrentLevel(player) || preferredLevel);
      } finally {
        cpblEntryPreferredLevelState = null;
      }
    };
