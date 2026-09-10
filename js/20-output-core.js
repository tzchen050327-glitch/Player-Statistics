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

