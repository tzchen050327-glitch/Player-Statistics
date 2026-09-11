    function cpblLevelLabel(kindCode) {
      return kindCode === 'D' ? '二軍' : '一軍';
    }

    function promiseTimeout(promise, ms, message = '操作逾時') {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
      ]);
    }

    async function refreshCurrentRosterStatus() {
      const linked = players.filter(player => player.cpblAcnt);
      if (!linked.length) return;

      try {
        const data = await promiseTimeout(
          cpblRequest('current-rosters', {
            acnts: linked.map(player => player.cpblAcnt)
          }),
          4500,
          '目前一二軍狀態查詢逾時'
        );
        const rows = Array.isArray(data.players) ? data.players : [];
        const byAcnt = new Map(rows.filter(row => row?.ok && row.acnt).map(row => [String(row.acnt), row]));

        for (const player of linked) {
          const current = byAcnt.get(String(player.cpblAcnt));
          if (!current?.team) continue;

          player.cpblTeam = normalizeTeamName(current.team);
          if (current.teamCode) player.cpblTeamCode = String(current.teamCode);
          if (current.number) player.number = String(current.number);
          player.cpblCurrentLevel = current.level === 'D' ? 'D' : 'A';

          const roleChanged = repairStoredCpblPlayerType(player, current.position || '');
          player.cpblRosterUpdatedAt = Date.now();

          if (roleChanged && player.id === selectedPlayerId) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }
          await idbPut(STORES.players, player);
        }
      } catch (error) {
        console.warn('目前一二軍名單更新失敗', error);
      }
    }

    function pitcherInningsTextToOuts(value) {
      const text = String(value ?? '0.0');
      const m = text.match(/^(\d+)\.([012])$/);
      if (!m) return 0;
      return Number(m[1]) * 3 + Number(m[2]);
    }

    function applyCpblSeasonHistory(player, history, kindCode) {
      kindCode = kindCode === 'D' ? 'D' : 'A';
      player.cpblAvailableYears ||= { A: [], D: [] };
      player.cpblHistorySynced ||= { A: false, D: false };

      const sourceYears = Array.isArray(history?.years)
        ? history.years.map(Number).filter(year => Number.isInteger(year) && year >= 1990 && year <= CURRENT_YEAR).sort((a, b) => b - a)
        : [];

      const appliedYears = [];
      for (const season of history?.seasons || []) {
        const year = Number(season?.year);
        if (!Number.isInteger(year)) continue;
        try {
          applyCpblSeasonStatsToPlayer(player, season, year, kindCode);
          appliedYears.push(year);
        } catch (error) {
          console.warn(`略過 ${year} ${cpblLevelLabel(kindCode)}資料`, error);
        }
      }

      // 只有真的成功寫進 statsProfiles 的年份才提供給軍別／年份切換。
      player.cpblAvailableYears[kindCode] = [...new Set(appliedYears)].sort((a,b)=>b-a);
      player.cpblHistorySynced[kindCode] = sourceYears.length === 0 || appliedYears.length > 0;
    }

    function syncProgressTitleForPlayer(player = selectedPlayer()) {
      if (!player) return '正在同步資料';
      const scope = playerScope(player);
      if (scope === 'cpbl') return '正在同步中職資料';
      if (scope === 'international') return '正在同步國際賽資料';
      const provider = String(player.externalProvider || playerSpecialCompetition(player) || '').toUpperCase();
      if (provider === 'NPB') return '正在同步 NPB 日職資料';
      if (provider === 'KBO') return '正在同步 KBO 韓職資料';
      if (provider === 'MILB') return '正在同步 MiLB 小聯盟資料';
      if (provider === 'MLB') return '正在同步 MLB 資料';
      return '正在同步國外聯盟資料';
    }

    function setSyncProgress(percent, status, { error = false } = {}) {
      setSyncUiLocked(true);
      const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      if (els.syncProgressOverlay) els.syncProgressOverlay.classList.remove('hidden');
      if (els.syncProgressCard) els.syncProgressCard.classList.toggle('error', Boolean(error));
      if (els.syncProgressTitle) els.syncProgressTitle.textContent = syncProgressTitleForPlayer();
      if (els.syncProgressPercent) els.syncProgressPercent.textContent = `${value}%`;
      if (els.syncProgressStatus) els.syncProgressStatus.textContent = status || '';
      if (els.syncProgressBar) els.syncProgressBar.style.width = `${value}%`;
    }

    function hideSyncProgress() {
      els.syncProgressOverlay?.classList.add('hidden');
      els.syncProgressCard?.classList.remove('error');
      setSyncUiLocked(false);
    }

    async function finishSyncProgress(status = '同步完成') {
      setSyncProgress(100, status);
      await markSuccessfulSeasonSyncMeta();
      await new Promise(resolve => setTimeout(resolve, 420));
      hideSyncProgress();
    }

    async function syncPlayerCpblHistory(player, onProgress = null) {
      if (!player?.cpblAcnt) return;

      const report = (percent, status) => {
        try { onProgress?.(percent, status); } catch {}
      };

      report(12, '正在連線中職官網…');
      report(24, '正在一次抓取一軍＋二軍歷年資料…');

      const data = await cpblRequest('season-histories', { acnt: player.cpblAcnt });
      const histories = data?.histories || {};
      const remoteErrors = data?.errors || {};
      const errors = [];

      report(76, '正在整理一軍＋二軍賽季資料…');

      for (const kindCode of ['A', 'D']) {
        const history = histories[kindCode];
        if (history) {
          applyCpblSeasonHistory(player, history, kindCode);
        } else {
          player.cpblAvailableYears ||= { A: [], D: [] };
          player.cpblHistorySynced ||= { A: false, D: false };
          player.cpblHistorySynced[kindCode] = false;
          errors.push(`${cpblLevelLabel(kindCode)}：${remoteErrors[kindCode] || '資料取得失敗'}`);
        }
      }

      const majorYears = availableSeasonYears(player, 'A');
      const minorYears = availableSeasonYears(player, 'D');

      if (histories.D?.years?.length && !minorYears.length) {
        errors.push('二軍：官網有資料，但前端寫入失敗');
      }

      report(92, '正在儲存球員資料…');
      await savePlayer(player);
      report(97, `一軍 ${majorYears.length} 季／二軍 ${minorYears.length} 季`);

      return { partialErrors: errors, majorYears, minorYears };
    }

    async function updatePlayerFromCpbl(player, silent = false, year = selectedSeason, kindCode = selectedLevel) {
      if (!player?.cpblAcnt) throw new Error('此球員尚未連結中職官網。');
      year = Math.max(1990, Math.floor(Number(year) || CURRENT_YEAR));
      kindCode = kindCode === 'D' ? 'D' : 'A';

      const data = await cpblRequest('season-stats', { acnt: player.cpblAcnt, year, kindCode });
      applyCpblSeasonStatsToPlayer(player, data.stats, year, kindCode);
      await savePlayer(player);
      if (!silent) setStatus(`已更新 ${year} 年中職官網${cpblLevelLabel(kindCode)}累積成績。`);
      return data;
    }

    function applyCpblSeasonStatsToPlayer(player, stats, year, kindCode = selectedLevel) {
      kindCode = kindCode === 'D' ? 'D' : 'A';
      const official = player.type === 'hitter' ? stats?.batting : stats?.pitching;
      if (!official) throw new Error(`${year} 年找不到此球員的${cpblLevelLabel(kindCode)}例行賽成績。`);

      let next;
      if (player.type === 'hitter') {
        next = { ...hitterDefaults(), ...official };
      } else {
        next = { ...pitcherDefaults(), ...official };
        next.outs = Number.isFinite(Number(official.outs))
          ? Number(official.outs)
          : pitcherInningsTextToOuts(official.innings);
        delete next.innings;

        const rawPitching = stats?.raw?.pitching || null;
        const officialEra = Number(rawPitching?.Era);
        const officialWhip = Number(rawPitching?.Whip);
        if (Number.isFinite(officialEra) && Number.isFinite(officialWhip)) {
          next.cpblEra = officialEra;
          next.cpblWhip = officialWhip;
          next.cpblRatesOfficial = true;
        } else {
          delete next.cpblEra;
          delete next.cpblWhip;
          delete next.cpblRatesOfficial;
        }
      }

      const cpblHitterRole = stats?.batting
        ? { ...hitterDefaults(), ...stats.batting }
        : null;
      let cpblPitcherRole = null;
      if (stats?.pitching) {
        cpblPitcherRole = { ...pitcherDefaults(), ...stats.pitching };
        cpblPitcherRole.outs = Number.isFinite(Number(stats.pitching.outs))
          ? Number(stats.pitching.outs)
          : pitcherInningsTextToOuts(stats.pitching.innings);
        delete cpblPitcherRole.innings;
      }
      storeRoleStatsProfile(player, year, kindCode, cpblHitterRole, cpblPitcherRole);

      const profiles = ensureStatsProfiles(player);
      const key = statsProfileKey(year, kindCode);
      profiles[key] = { ...next };
      if (player.id === selectedPlayerId && Number(year) === Number(selectedSeason) && kindCode === selectedLevel) {
        player.stats = { ...next };
      }

      player.cpblLastUpdatedByProfile ||= {};
      player.cpblLastUpdatedByProfile[key] = Date.now();
      player.cpblLastUpdatedAt = Date.now();
    }

    function currentOfficialDailyRolePair() {
      const pair = currentRecord?.externalRoleDaily;
      return pair && typeof pair === 'object'
        ? { hitter: pair.hitter || null, pitcher: pair.pitcher || null }
        : { hitter:null, pitcher:null };
    }

    function todayAvailableRoles(player) {
      const pair = currentOfficialDailyRolePair();
      const roles = [];
      if (dailyHitterRoleHasData(pair.hitter)) roles.push('hitter');
      if (dailyPitcherRoleHasData(pair.pitcher)) roles.push('pitcher');
      return roles.length ? roles : [player?.type === 'pitcher' ? 'pitcher' : 'hitter'];
    }

    function activeTodayRole(player) {
      const roles = todayAvailableRoles(player);
      if (roles.includes(todayRoleView)) return todayRoleView;
      if (roles.includes(player?.type)) return player.type;
      return roles[0] || (player?.type === 'pitcher' ? 'pitcher' : 'hitter');
    }

    function projectedPlayerStatsForRole(player, role) {
      if (!player) return {};
      role = role === 'pitcher' ? 'pitcher' : 'hitter';

      const pair = currentOfficialDailyRolePair();
      const hasOfficialDailyRole = role === 'pitcher'
        ? dailyPitcherRoleHasData(pair.pitcher)
        : dailyHitterRoleHasData(pair.hitter);

      // Official daily imports are already included in the synced season totals.
      // When viewing the player's secondary role, use that role's season profile
      // instead of treating the primary-role stats object as the wrong shape.
      if (hasOfficialDailyRole) {
        return seasonStatsForOutputRole(player, role);
      }

      if (role === player.type) return projectedPlayerStats(player);

      const originalType = player.type;
      const originalStats = player.stats;
      try {
        player.type = role;
        player.stats = seasonStatsForOutputRole(player, role);
        return projectedPlayerStats(player);
      } finally {
        player.type = originalType;
        player.stats = originalStats;
      }
    }

    async function applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite = true } = {}) {
      const hitter = daily?.hitter || null;
      const pitcher = daily?.pitcher || null;

      currentRecord.externalRoleDaily = {
        hitter: hitter ? { ...hitter } : null,
        pitcher: pitcher ? { ...pitcher } : null
      };

      if (hitter) {
        const list = Array.isArray(hitter.plateAppearances) ? hitter.plateAppearances : [];
        if (confirmHitterOverwrite && list.length && currentRecord.hitterPAs.length) {
          const overwrite = await showAppConfirm(
            '目前已有逐打席紀錄。\n要用官方資料覆蓋目前紀錄嗎？',
            {
              title:'覆蓋逐打席紀錄',
              confirmText:'覆蓋資料',
              cancelText:'保留目前資料',
              tone:'warning'
            }
          );
          if (!overwrite) return false;
        }

        currentRecord.hitterAppearance.mode = 'bat';
        if (list.length) {
          currentRecord.hitterPAs = list.map(pa => ({
            id:uid(),
            code:pa.code || 'OUT',
            position:pa.position || '',
            rbi:Number(pa.rbi) || 0,
            cpblOfficialAction:pa.officialAction || ''
          }));
        }

        currentRecord.cpblGameSummary = {
          runs:Math.max(0,Number(hitter.runs)||0),
          hits:Math.max(0,Number(hitter.hits)||0),
          errors:Math.max(0,Number(hitter.errors)||0),
          official:true
        };

        // Keep the official aggregate as a fallback when the source has no
        // verifiable plate-appearance sequence.
        currentRecord.internationalHitterGame = { ...hitter };
      }

      if (pitcher) {
        const g = currentRecord.pitcherGame;
        g.innings = pitcher.innings || outsToIP(Number(pitcher.outs)||0) || '0.0';
        g.k = Number(pitcher.k)||0;
        g.bb = Number(pitcher.bb)||0;
        g.h = Number(pitcher.h)||0;
        g.hbp = Number(pitcher.hbp)||0;
        g.r = Number(pitcher.r)||0;
        g.er = Math.min(g.r,Math.max(0,Number(pitcher.er)||0));
        const pitchCount = Math.max(0,Math.min(150,Number(pitcher.pitchCount)||0));
        g.pitchTens = Math.floor(pitchCount/10);
        g.pitchOnes = pitchCount>=150 ? 0 : pitchCount%10;
        g.cg = Boolean(Number(pitcher.cg)||pitcher.cg);
        g.sho = Boolean(Number(pitcher.sho)||pitcher.sho);
        g.hld = Boolean(Number(pitcher.hld)||pitcher.hld);
        g.sv = Boolean(Number(pitcher.sv)||pitcher.sv);
        g.bsv = Boolean(Number(pitcher.bsv)||pitcher.bsv);
        g.decision = Number(pitcher.w)>0 ? 'W' : Number(pitcher.l)>0 ? 'L'
          : (['W','L'].includes(pitcher.decision) ? pitcher.decision : 'ND');
        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;
        currentRecord.externalWalksCombined = Boolean(pitcher.walksCombined);
        standardizePitcherSpecialRecords(g);
      }

      return true;
    }

    async function importExternalDaily(player) {
      if (playerScope(player) !== 'overseas' || !player?.externalProvider || !player?.externalPlayerId) {
        throw new Error('此球員尚未連結國外聯盟資料。');
      }

      const data = await baseballRequest('daily', {
        provider:isUsPlayer(player) ? 'US' : player.externalProvider,
        id:player.externalPlayerId,
        date:els.gameDate.value
      });
      const daily = data.daily;
      if (!daily?.found) {
        const requestedDate = String(els.gameDate.value || '').replaceAll('-', '/');
        let last = daily?.lastAppearance || null;
        if (!last && isUsPlayer(player)) {
          try {
            const lastData = await baseballRequest('last-appearance', {
              provider:'US',
              id:player.externalPlayerId,
              date:els.gameDate.value
            });
            last = lastData?.lastAppearance || null;
          } catch (error) {
            console.warn('MLB / MiLB 上一次出賽查詢失敗', error);
          }
        }
        if (last?.date) {
          const lastDate = String(last.date).replaceAll('-', '/');
          const lastLevel = String(last.leagueLevel || '');
          const lastOpponent = String(last.opponent || '').trim();
          const lastDetail = `${lastLevel ? `（${lastLevel}）` : ''}${lastOpponent ? `｜vs ${lastOpponent}` : ''}`;
          const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄。\n\n上一次出賽：${lastDate}${lastDetail}`;
          await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
          setStatus(`當日無出賽；上一次出賽為 ${lastDate}${lastDetail}。`);
          return false;
        }
        const message = `${requestedDate} 一軍、二軍都沒有此球員的出賽紀錄，近期也找不到可確認的上一次出賽資料。`;
        await showAppAlert(message, { title:'當日無出賽', tone:'warning' });
        setStatus('當日一軍、二軍皆無出賽資料。');
        return false;
      }

      currentRecord.externalLeagueLevel = String(daily.leagueLevel || '一軍');
      currentRecord.externalWalksCombined = false;
      currentRecord.externalRoleDaily = {
        hitter: daily.hitter ? { ...daily.hitter } : null,
        pitcher: daily.pitcher ? { ...daily.pitcher } : null
      };

      const localizedDailyName = String(daily.profile?.zhName || '').replace(/\s+/g, '');
      if (localizedDailyName && /[\u3400-\u9fff]/.test(localizedDailyName)) {
        const currentName = String(player.name || '').replace(/\s+/g, '');
        const preferredAliases = new Set(
          (Array.isArray(daily.profile?.zhNameAliases) ? daily.profile.zhNameAliases : [])
            .map(value => String(value || '').replace(/\s+/g, ''))
            .filter(Boolean)
        );
        if (!currentName
          || !/[\u3400-\u9fff]/.test(currentName)
          || localizedDailyName.includes(currentName)
          || (Boolean(daily.profile?.zhNamePreferred) && preferredAliases.has(currentName))) {
          player.name = localizedDailyName;
          player.externalOfficialName = daily.profile?.name || player.externalOfficialName || '';
          await savePlayer(player);
        }
      }

      if (daily.opponent) currentRecord.opponent = String(daily.opponent).trim();

      // If this date was already imported from an external provider, the old
      // record may contain a role that the corrected official parser no longer
      // reports. Clear only previously imported stale role data; manual records
      // that have not been imported remain untouched.
      if (currentRecord.externalReadOnlyImport) {
        if (!daily.hitter) {
          currentRecord.hitterPAs = [];
          currentRecord.internationalHitterGame = null;
          currentRecord.cpblGameSummary = {
            runs:0,hits:0,errors:0,official:false
          };
        }
        if (!daily.pitcher) {
          currentRecord.pitcherGame = {
            ...defaultGameRecord(player).pitcherGame
          };
        }
      }

      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });
      if (!appliedRoles) return false;

      currentRecord.externalReadOnlyImport = true;
      currentRecord.cpblReadOnlyImport = false;
      currentRecord.externalSource = player.externalProvider;
      currentRecord.externalImportedAt = Date.now();
      currentRecord.syncMeta = { source: officialDataSourceLabel(player), updatedAt: currentRecord.externalImportedAt };

      const importedHasHitter = dailyHitterRoleHasData(daily.hitter);
      const importedHasPitcher = dailyPitcherRoleHasData(daily.pitcher);
      if (importedHasPitcher && !importedHasHitter) todayRoleView = 'pitcher';
      else if (importedHasHitter && !importedHasPitcher) todayRoleView = 'hitter';

      currentRecord.committedStats = importedHasPitcher && !importedHasHitter
        ? derivePitcherGame(currentRecord.pitcherGame)
        : importedHasHitter
          ? deriveHitterGame(currentRecord.hitterPAs)
          : (player.type === 'hitter'
              ? deriveHitterGame(currentRecord.hitterPAs)
              : derivePitcherGame(currentRecord.pitcherGame));
      currentRecord.committedAt = Date.now();

      await saveRecord();
      renderAll();

      const noPa = importedHasHitter
        && !(Array.isArray(daily.hitter?.plateAppearances) && daily.hitter.plateAppearances.length);
      const sourceMode = String(daily.sourceMode || '');
      const levelLabel = String(daily.leagueLevel || '');
      const sourceLabel = `${overseasProviderLabel(player.externalProvider)}${levelLabel ? ` ${levelLabel}` : ''}`;
      const combinedNote = currentRecord.externalWalksCombined
        ? ' KBO Futures 官方 Box 僅提供四死球合計，戰報會以「四死球」標示。'
        : '';
      const roleNote = importedHasPitcher && !importedHasHitter
        ? ' 本場僅以投手身分出賽。'
        : importedHasHitter && !importedHasPitcher
          ? ' 本場以打者身分出賽。'
          : importedHasHitter && importedHasPitcher
            ? ' 本場同時有打擊與投球紀錄。'
            : '';
      setStatus(noPa
        ? sourceMode === 'eng-box'
          ? `已確認 ${els.gameDate.value} 有出賽並匯入 NPB 一軍官方英文 Box 彙總；日文詳細 Box 暫時無法讀取，所以逐打席未自動帶入。${roleNote}`
          : `已匯入 ${els.gameDate.value} 的 ${sourceLabel} 當日彙總；該來源未提供可解析的逐打席順序，可手動補逐打席。${roleNote}`
        : `已匯入 ${els.gameDate.value} 的 ${sourceLabel} 當日資料。${roleNote}${combinedNote}`);
      return true;
    }

    async function importCpblDaily(player) {
      if (!player?.cpblAcnt || !player?.cpblTeamCode) throw new Error('此球員尚未連結中職官網。');

      const gameYear = Number(els.gameDate.value?.slice(0, 4)) || CURRENT_YEAR;
      const levels = ['A','D'];
      let daily = null;
      let kindCode = 'A';
      let lastReason = '';

      for (const level of levels) {
        const knownYears = player?.cpblAvailableYears?.[level];
        if (Array.isArray(knownYears) && knownYears.length && !knownYears.includes(gameYear)) continue;

        try {
          const data = await cpblRequest('daily', {
            acnt: player.cpblAcnt,
            date: els.gameDate.value,
            teamCode: player.cpblTeamCode,
            kindCode: level
          });
          if (data?.daily?.found) {
            daily = data.daily;
            kindCode = level;
            break;
          }
          lastReason = data?.daily?.reason || lastReason;
        } catch (error) {
          lastReason = error?.message || lastReason;
        }
      }

      if (!daily?.found) {
        let last = null;
        try {
          const lastData = await cpblRequest('last-appearance', {
            acnt:player.cpblAcnt,
            date:els.gameDate.value,
            teamCode:player.cpblTeamCode
          });
          last = lastData?.lastAppearance || null;
        } catch (error) {
          console.warn('中職上一次出賽查詢失敗', error);
        }

        const requestedDate = els.gameDate.value.replaceAll('-', '/');
        if (last?.date) {
          const lastDate = String(last.date).replaceAll('-', '/');
          const lastLevel = String(last.leagueLevel || '');
          const lastOpponent = normalizeTeamName(String(last.opponent || '').trim());
          const lastDetail = `${lastLevel ? `（${lastLevel}）` : ''}${lastOpponent ? `｜vs ${lastOpponent}` : ''}`;
          await showAppAlert(
            `${requestedDate} 一軍、二軍都找不到此球員的出賽資料。\n\n上一次出賽：${lastDate}${lastDetail}`,
            { title:'當日無出賽', tone:'warning' }
          );
          setStatus(`當日無出賽；上一次出賽為 ${lastDate}${lastDetail}。`);
          return false;
        }

        await showAppAlert(
          `${requestedDate} 一軍、二軍都找不到此球員的出賽資料，近期也找不到可確認的上一次出賽資料。`,
          { title:'當日無出賽', tone:'warning' }
        );
        setStatus(lastReason || '當日一軍、二軍皆無出賽資料。');
        return false;
      }

      // 找到哪個軍別就自動切到該軍別的本機紀錄，不需使用者手動選。
      if (selectedLevel !== kindCode) {
        persistActiveStatsProfile(player);
        selectedLevel = kindCode;
        const years = availableSeasonYears(player, kindCode);
        selectedSeason = years.includes(gameYear) ? gameYear : (years[0] || gameYear);
        activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
        await loadRecord();
      }
      currentRecord.level = kindCode;

      if (daily.game?.opponent) currentRecord.opponent = normalizeTeamName(daily.game.opponent);

      const appliedRoles = await applyOfficialDailyRolesToRecord(daily, { confirmHitterOverwrite:true });
      if (!appliedRoles) return false;

      const isToday = els.gameDate.value === localISODate();
      currentRecord.cpblReadOnlyImport = !isToday;

      if (isToday) {
        try {
          await updatePlayerFromCpbl(player, true, gameYear, kindCode);
          currentRecord.committedStats = player.type === 'hitter'
            ? deriveHitterGame(currentRecord.hitterPAs)
            : derivePitcherGame(currentRecord.pitcherGame);
          currentRecord.committedAt = Date.now();
        } catch (error) {
          console.warn('CPBL cumulative sync after daily import failed', error);
        }
      } else {
        currentRecord.committedStats = player.type === 'hitter'
          ? deriveHitterGame(currentRecord.hitterPAs)
          : derivePitcherGame(currentRecord.pitcherGame);
        currentRecord.committedAt = Date.now();
      }

      currentRecord.cpblImportedAt = Date.now();
      currentRecord.syncMeta = { source: officialDataSourceLabel(player), updatedAt: currentRecord.cpblImportedAt };
      await saveRecord();
      renderAll();

      const levelLabel = kindCode === 'D' ? '二軍' : '一軍';
      setStatus(isToday
        ? `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料並同步今日累積數據。`
        : `已匯入 ${els.gameDate.value} 的中職${levelLabel}資料；歷史日期不會寫入球員累積數據。`);
      return true;
    }

    async function refreshCpblGameErrors(player, { quiet = false } = {}) {
      if (!player?.cpblAcnt) throw new Error('此球員尚未連結中職官網。');
      const date = String(els.gameDate.value || '').trim();
      if (!date) throw new Error('請先選擇日期。');

      const data = await cpblRequest('game-errors', {
        acnt: player.cpblAcnt,
        date,
        teamCode: player.cpblTeamCode || '',
        kindCode: currentRecord?.level || selectedLevel || 'A'
      });
      if (!data?.found) throw new Error(data?.reason || '找不到這場比賽的失誤資料。');

      currentRecord.cpblGameErrors = Array.isArray(data.errors)
        ? data.errors.map(item => ({
            acnt: String(item?.acnt || ''),
            name: String(item?.name || '').trim(),
            number: String(item?.number || '').trim(),
            teamCode: String(item?.teamCode || '').trim(),
            teamName: String(item?.teamName || '').trim(),
            count: Math.max(0, Number(item?.count) || 0)
          })).filter(item => item.count > 0)
        : [];
      currentRecord.cpblGameErrorsGame = data.game ? { ...data.game } : null;
      currentRecord.cpblGameErrorsFetchedAt = Date.now();
      delete currentRecord.cpblGameErrorsLoadError;
      await saveRecord();

      if (!quiet) {
        const total = currentRecord.cpblGameErrors.reduce((sum, item) => sum + item.count, 0);
        setStatus(total
          ? `已抓到本場 ${currentRecord.cpblGameErrors.length} 位球員、共 ${total} 次失誤。`
          : 'CPBL 官方記錄本場沒有失誤。');
      }
      if (selectedTab === 'errors') renderCpblErrorsPage(player);
      return currentRecord.cpblGameErrors;
    }

    function cpblErrorPlayerLabel(item) {
      const number = String(item?.number || '').trim();
      const name = String(item?.name || '').trim() || '未辨識球員';
      return `${number ? `#${number} ` : ''}${name}`;
    }

    async function openCpblErrorPlayer(item) {
      const acnt = String(item?.acnt || '').trim();
      if (!acnt) throw new Error('這筆官方失誤資料沒有球員 ID，暫時無法開啟。');

      const sourceDate = String(els.gameDate.value || '').trim();
      const sourceName = String(item?.name || '').trim();
      let player = players.find(p => playerScope(p) === 'cpbl' && String(p.cpblAcnt || '') === acnt) || null;

      // If the user already has an unlinked CPBL player with the exact same name,
      // link that record instead of creating a duplicate.
      if (!player && sourceName) {
        player = players.find(p =>
          playerScope(p) === 'cpbl'
          && !String(p.cpblAcnt || '').trim()
          && String(p.name || '').trim() === sourceName
        ) || null;
      }

      let official = null;
      try {
        const profileData = await cpblRequest('player-profile', { acnt });
        official = profileData?.player || null;
      } catch (error) {
        console.warn('失誤頁開啟球員時讀取 CPBL profile 失敗，改用單場資料建立', error);
      }

      const position = String(official?.position || '').trim();
      const type = /投手/.test(position) ? 'pitcher' : 'hitter';
      const now = Date.now();

      if (!player) {
        player = {
          id: uid(),
          name: String(official?.name || sourceName || '未命名球員').trim(),
          number: String(official?.number || item?.number || '—').trim() || '—',
          type,
          scope: 'cpbl',
          stats: type === 'pitcher' ? pitcherDefaults() : hitterDefaults(),
          pitcherLastMetric: type === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId: null,
          photoTransforms: {},
          cpblAcnt: acnt,
          cpblTeam: normalizeTeamName(official?.team || item?.teamName || ''),
          cpblTeamCode: String(official?.teamCode || item?.teamCode || '').trim(),
          cpblCurrentLevel: 'A',
          cpblPosition: position,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now
        };
        await savePlayer(player);
      } else {
        player.cpblAcnt = acnt;
        if (official?.name) player.name = String(official.name).trim();
        else if (!player.name && sourceName) player.name = sourceName;
        if (official?.number) player.number = String(official.number).trim();
        else if ((!player.number || player.number === '—') && item?.number) player.number = String(item.number).trim();
        if (official?.team) player.cpblTeam = normalizeTeamName(official.team);
        else if (!player.cpblTeam && item?.teamName) player.cpblTeam = normalizeTeamName(item.teamName);
        if (official?.teamCode) player.cpblTeamCode = String(official.teamCode).trim();
        else if (!player.cpblTeamCode && item?.teamCode) player.cpblTeamCode = String(item.teamCode).trim();
        if (position) {
          player.cpblPosition = position;
          repairStoredCpblPlayerType(player, position);
        }
        await savePlayer(player);
      }

      await selectPlayer(player.id);

      // Stay on the same game date and open the same error workspace for the
      // newly selected player, so another error card can be downloaded immediately.
      if (sourceDate) els.gameDate.value = sourceDate;
      selectedTab = 'errors';
      await loadRecord();
      renderAll();
      try {
        await refreshCpblGameErrors(player, { quiet:true });
      } catch (error) {
        currentRecord.cpblGameErrorsLoadError = error?.message || '抓取失誤資料失敗。';
        renderCpblErrorsPage(player);
        setStatus(currentRecord.cpblGameErrorsLoadError, true);
      }
    }

    function renderCpblErrorsPage(player) {
      const errors = Array.isArray(currentRecord?.cpblGameErrors) ? currentRecord.cpblGameErrors : null;
      const game = currentRecord?.cpblGameErrorsGame || null;
      const loadError = String(currentRecord?.cpblGameErrorsLoadError || '');
      const ownAcnt = String(player?.cpblAcnt || '');
      const own = errors?.find(item => String(item?.acnt || '') === ownAcnt) || null;
      const dateText = String(els.gameDate.value || '').replaceAll('-', '/');
      const matchup = [game?.visitingTeamName, game?.homeTeamName].filter(Boolean).join(' vs ');
      const gameMeta = [dateText, matchup, game?.field].filter(Boolean).join('｜');

      let listHtml = '';
      if (loadError) {
        listHtml = `<div class="error-page-empty error">${escapeHtml(loadError)}</div>`;
      } else if (errors === null) {
        listHtml = '<div class="error-page-empty">正在抓取 CPBL 官方本場失誤…</div>';
      } else if (!errors.length) {
        listHtml = '<div class="error-page-empty success">CPBL 官方紀錄：本場沒有任何球員被記失誤。</div>';
      } else {
        listHtml = errors.map(item => {
          const selected = String(item.acnt || '') === ownAcnt;
          const team = item.teamName || item.teamCode || '';
          return `
            <div class="error-player-card ${selected ? 'selected' : ''}">
              <div class="error-player-info">
                <button class="error-player-name error-player-name-link" type="button" data-error-player-acnt="${escapeAttr(String(item.acnt || ''))}" ${item.acnt ? '' : 'disabled'}>${escapeHtml(cpblErrorPlayerLabel(item))}</button>
                <div class="error-player-team">${escapeHtml(team || 'CPBL 官方紀錄')}${selected ? '｜目前球員' : ''}</div>
              </div>
              <div class="error-count-badge">${Math.max(0, Number(item.count) || 0)} 次</div>
            </div>`;
        }).join('');
      }

      els.content.innerHTML = `
        <div class="error-page-shell">
          <div class="error-page-head">
            <button id="backFromErrorsBtn" class="press-btn" type="button">← 返回今日戰績</button>
            <div class="error-page-actions">
              <button id="refreshGameErrorsBtn" class="press-btn" type="button">重新抓取官方失誤</button>
              <button id="downloadErrorCardBtn" class="press-btn primary" type="button">下載此球員失誤圖</button>
            </div>
          </div>
          <div class="error-page-title-row">
            <div>
              <div class="error-page-kicker">FIELDING ERRORS</div>
              <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜失誤紀錄</h2>
              <div class="subtle">${escapeHtml(gameMeta || dateText)}</div>
            </div>
            <div class="error-own-summary">
              <span>此球員本場</span>
              <strong>${own ? `${Math.max(0, Number(own.count) || 0)} 次失誤` : '0 次失誤'}</strong>
            </div>
          </div>
          <div class="error-page-note">資料來源為 CPBL 官方單場 BOX；下方列出這場比賽所有被記失誤的球員。</div>
          <div class="error-player-list">${listHtml}</div>
        </div>`;

      document.getElementById('backFromErrorsBtn')?.addEventListener('click', () => {
        selectedTab = 'today';
        renderAll();
      });
      document.querySelectorAll('[data-error-player-acnt]').forEach(button => {
        button.addEventListener('click', async event => {
          const target = event.currentTarget;
          const acnt = String(target.dataset.errorPlayerAcnt || '');
          const item = (errors || []).find(row => String(row.acnt || '') === acnt);
          if (!item) return;
          const original = target.textContent;
          target.disabled = true;
          target.textContent = `${original}｜開啟中…`;
          try {
            await openCpblErrorPlayer(item);
          } catch (error) {
            target.disabled = false;
            target.textContent = original;
            setStatus(error?.message || '開啟球員失敗。', true);
          }
        });
      });
      document.getElementById('downloadErrorCardBtn')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = '正在產生…';
        try {
          await downloadCpblErrorCard(player);
        } catch (error) {
          setStatus(error?.message || '下載失誤圖失敗。', true);
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });

      document.getElementById('refreshGameErrorsBtn')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = '正在抓取…';
        try {
          await refreshCpblGameErrors(player);
        } catch (error) {
          currentRecord.cpblGameErrorsLoadError = error?.message || '抓取失誤資料失敗。';
          renderCpblErrorsPage(player);
          setStatus(currentRecord.cpblGameErrorsLoadError, true);
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
    }

