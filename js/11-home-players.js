    function renderHomePlayerFilters() {
      const international = homeRootSection === 'international';
      const special = homeRootSection === 'special';
      if (international) homeZone = 'international';
      else if (special) homeZone = 'special';
      else applyHomeProSelection();

      els.homeZoneSwitch?.querySelectorAll('[data-home-root]').forEach(button => {
        button.classList.toggle('active', button.dataset.homeRoot === homeRootSection);
      });

      els.homeContinentSwitch?.classList.toggle('hidden', international || special);
      els.homeContinentSwitch?.querySelectorAll('[data-pro-continent]').forEach(button => {
        button.classList.toggle('active', button.dataset.proContinent === homeProContinent);
      });
      els.homeProCountrySwitch?.classList.toggle('hidden', international || special);
      els.homeProCountrySwitch?.querySelectorAll('[data-pro-country]').forEach(button => {
        const country = button.dataset.proCountry;
        button.classList.toggle('hidden', homeProContinent === 'AMERICA' ? country !== 'US' : country === 'US');
        button.classList.toggle('active', country === homeProCountry);
      });

      els.homeUsLeagueSwitch?.classList.add('hidden');

      const cpblRosterClosed = !international && !special && homeProCountry === 'TW' && !homeCpblRosterOpen;
      els.homePage?.classList.toggle('cpbl-roster-closed', cpblRosterClosed);
      els.homeCpblRosterBtn?.classList.toggle('active', !cpblRosterClosed && !international && !special && homeProCountry === 'TW' && homeCpblRosterOpen);
      els.homeCpblRosterBtn?.setAttribute('aria-pressed', String(!cpblRosterClosed && !international && !special && homeProCountry === 'TW' && homeCpblRosterOpen));
      const cpbl = !international && !special && homeProCountry === 'TW';
      els.homeDailyGames?.classList.toggle('hidden', international || special);
      els.homeSpecialFilters?.classList.add('hidden');
      els.homeInternationalExplorer?.classList.toggle('hidden', !international);
      els.homeSpecialGamesExplorer?.classList.toggle('hidden', !special);
      document.querySelector('.home-player-head')?.classList.toggle('hidden', international || special);
      const homeActions = document.querySelector('.home-player-actions');
      homeActions?.classList.toggle('hidden', international || special);
      homeActions?.classList.remove('international-actions');
      document.getElementById('addPlayerBtn')?.classList.remove('hidden');
      els.recent?.classList.toggle('hidden', international || special);

      if (els.homePlayerTitle) {
        if (international) els.homePlayerTitle.textContent = '國際賽';
        else if (special) els.homePlayerTitle.textContent = '作者收藏';
        else if (homeProCountry === 'TW') els.homePlayerTitle.textContent = '台灣｜中華職棒';
        else if (homeProCountry === 'US') els.homePlayerTitle.textContent = '美國｜MLB / MiLB';
        else if (homeProCountry === 'JP') els.homePlayerTitle.textContent = '日本｜NPB';
        else if (homeProCountry === 'KR') els.homePlayerTitle.textContent = '韓國｜KBO';
        else if (homeProCountry === 'AWB') els.homePlayerTitle.textContent = '亞洲冬季棒球聯盟｜AWB';
        else els.homePlayerTitle.textContent = '各國職棒';
      }

      if (els.homeZoneNote) {
        if (international) {
          els.homeZoneNote.classList.remove('hidden');
          els.homeZoneNote.textContent = '請依序選擇「賽事 → 年份 → 球隊 → 球員」。';
        } else if (special) {
          els.homeZoneNote.classList.remove('hidden');
          els.homeZoneNote.textContent = '作者整理收錄的特殊紀錄與比賽。';
        } else if (homeProCountry === 'AWB') {
          els.homeZoneNote.classList.remove('hidden');
          els.homeZoneNote.textContent = '冬盟入口已建立；即時比分、逐打席及球員資料尚待官方來源串接。';
        } else {
          els.homeZoneNote.classList.add('hidden');
          els.homeZoneNote.textContent = '';
        }
      }

      renderInternationalExplorer();
      if (typeof renderSpecialGamesExplorer === 'function') renderSpecialGamesExplorer();
    }

    function renderRecentPlayers() {
      renderHomePlayerFilters();
      if (els.pageSubtitle && currentPage === 'home') {
        els.pageSubtitle.textContent = homePageBreadcrumb();
      }
      els.homePage?.classList.toggle('international-home-mode', homeRootSection === 'international');
      els.homePage?.classList.toggle('special-home-mode', homeRootSection === 'special');
      renderHomeDailyGames();

      if (homeRootSection === 'international' || homeRootSection === 'special') {
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
                  ? mlbTeamZh(String(p.externalCurrentOrganization || p.externalCurrentTeam || p.externalTeam || '').trim())
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
