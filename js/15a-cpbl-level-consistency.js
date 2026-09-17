    // renderAll historically treated the tab as A/D authority, but it only changed selectedLevel.
    // If player.stats still belonged to the other level, the form could show D numbers under A
    // while the annual canvas (which reads the keyed profile) remained correct.
    const renderAllBeforeCpblLevelConsistency = renderAll;

    function synchronizeRenderedLeagueLevel() {
      const player = selectedPlayer();
      if (!player || currentPage !== 'player' || !supportsLeagueLevelTabs(player)) return;

      let expectedLevel = '';

      if (
        playerScope(player) === 'cpbl'
        && cpblEntryPreferredLevelState
        && cpblEntryPreferredLevelState.playerId === player.id
        && ['A','D'].includes(cpblEntryPreferredLevelState.level)
      ) {
        expectedLevel = cpblEntryPreferredLevelState.level;
        selectedTab = expectedLevel === 'D' ? 'minor' : 'base';
      } else if (selectedTab === 'base') {
        expectedLevel = 'A';
      } else if (selectedTab === 'minor') {
        expectedLevel = 'D';
      } else if (selectedTab === 'secondary' && supportsUsDualRoleTabs(player)) {
        expectedLevel = 'A';
      }

      if (!expectedLevel || selectedLevel === expectedLevel) return;

      selectedLevel = expectedLevel;
      const years = availableSeasonYears(player, expectedLevel);
      if (!years.includes(selectedSeason)) {
        selectedSeason = years.includes(CURRENT_YEAR) ? CURRENT_YEAR : (years[0] || CURRENT_YEAR);
      }
      activatePlayerStatsProfile(player, selectedSeason, expectedLevel);
    }

    renderAll = function renderAllWithCpblLevelConsistency() {
      synchronizeRenderedLeagueLevel();
      return renderAllBeforeCpblLevelConsistency();
    };
