    function playerScope(player) {
      const scope = String(player?.scope || '').trim();
      return scope === 'international' || scope === 'overseas' ? scope : 'cpbl';
    }

    window.__getPlayerContext = () => {
      const player = selectedPlayer();
      return {
        player,
        selectedSeason,
        selectedTab,
        currentPage,
        careerYears: player ? {
          A: availableSeasonYears(player, 'A'),
          D: availableSeasonYears(player, 'D')
        } : { A:[], D:[] }
      };
    };
    window.addEventListener('postseason-open-game', event => {
      const detail = event?.detail || {};
      if (detail?.game && detail?.league && detail?.date) openHomeGameDetail(detail.game, detail.league, detail.date);
    });

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

    function playerDisplayTeam(player) {
      if (playerScope(player) === 'cpbl') return normalizeTeamName(player?.cpblTeam || '');
      if (isUsPlayer(player)) return mlbTeamZh(String(player?.externalCurrentOrganization || player?.externalCurrentTeam || player?.externalTeam || '').trim());
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
        const team = mlbTeamZh(String(player.externalCurrentOrganization || player.externalCurrentTeam || player.externalTeam || '').trim());
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
          ? [entry.year, mlbTeamZh(entry.organizationName || entry.teamName || '') || '球隊未提供', entry.level || 'MiLB'].filter(Boolean).join('｜')
          : '年份／球隊／層級尚未同步';
        const current = [
          mlbTeamZh(player.externalCurrentOrganization || player.externalCurrentTeam || player.externalTeam || ''),
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
