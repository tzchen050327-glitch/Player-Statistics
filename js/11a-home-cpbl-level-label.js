    // Homepage display should make CPBL current level visible in the team label.
    // Keep filtering/team identity normalized to the parent club, but append 二軍 for D players.
    const playerDisplayTeamBeforeCpblLevelLabel = playerDisplayTeam;
    const playerSourceMetaBeforeCpblLevelLabel = playerSourceMeta;

    function homeCpblDisplayTeam(player) {
      const team = homePlayerTeam(player) || normalizeTeamName(player?.cpblTeam || '').replace(/二軍\s*$/, '').trim();
      if (!team) return '';
      return homePlayerLevel(player) === 'D' ? `${team}二軍` : team;
    }

    playerDisplayTeam = function playerDisplayTeamWithCpblLevel(player) {
      if (playerScope(player) === 'cpbl') return homeCpblDisplayTeam(player);
      return playerDisplayTeamBeforeCpblLevelLabel(player);
    };

    playerSourceMeta = function playerSourceMetaWithCpblLevel(player) {
      if (playerScope(player) !== 'cpbl') return playerSourceMetaBeforeCpblLevelLabel(player);
      return [
        player.type === 'pitcher' ? '投手' : '打者',
        player.cpblDualRole ? '雙角色' : '',
        homeCpblDisplayTeam(player)
      ].filter(Boolean).join('｜');
    };
