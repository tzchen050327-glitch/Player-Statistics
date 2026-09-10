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
      const seasonReportActive = statsTabActive && (playerScopeCode !== 'international' || selectedTab === 'base');
      const dailyReportActive = selectedTab === 'today';
      els.seasonSelect?.closest('.season-field')?.classList.toggle('hidden', levelTabs && !statsTabActive);
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === selectedTab));

      els.downloadBtn?.classList.toggle('hidden', !dailyReportActive);
      els.seasonReportBtn?.classList.toggle('hidden', !seasonReportActive);

      if (els.downloadBtn) {
        const officialReadOnly = Boolean(currentRecord?.cpblReadOnlyImport || currentRecord?.externalReadOnlyImport);
        els.downloadBtn.textContent = officialReadOnly
          ? '生成當天戰報（官方單場資料）'
          : '生成當天戰報';
      }
      if (els.seasonReportBtn) {
        const context = seasonReportActive ? annualSeasonContext(player) : null;
        const internationalTotal = playerScopeCode === 'international' && selectedTab === 'base';
        const levelText = supportsLeagueLevelTabs(player)
          ? (selectedLevel === 'D' ? '二軍' : '一軍')
          : (context?.league || '');
        els.seasonReportBtn.textContent = context
          ? (internationalTotal
              ? `輸出 ${context.year} ${context.league || '國際賽'}總戰績圖`
              : `輸出 ${context.year} ${levelText}整季戰報`)
          : '輸出這個年度成績';
      }
      if (els.canvasPreviewTitle) {
        if (seasonReportActive) {
          const context = annualSeasonContext(player);
          const internationalTotal = playerScopeCode === 'international' && selectedTab === 'base';
          const levelText = supportsLeagueLevelTabs(player)
            ? (selectedLevel === 'D' ? '二軍' : '一軍')
            : (context.league || '');
          els.canvasPreviewTitle.textContent = internationalTotal
            ? `${context.year} ${context.league || '國際賽'}總戰績預覽`
            : `${context.year} ${levelText}整季戰報預覽`.trim();
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
          && selectedTab === 'today' && !internationalSelectedGameKey;
        document.querySelector('#playerPage .workspace')?.classList.toggle('international-overview', internationalOverview);
        renderContent();

        if (!internationalOverview) {
          if (seasonReportActive) {
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

