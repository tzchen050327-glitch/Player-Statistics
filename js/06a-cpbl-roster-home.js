    // Homepage roster refresh must not fail as one large all-or-nothing 4.5s batch.
    // Keep the startup roster decision authoritative for homepage A/D grouping.
    const refreshCurrentRosterStatusBeforeHomeBatchFix = refreshCurrentRosterStatus;

    refreshCurrentRosterStatus = async function refreshCurrentRosterStatusWithLongerBatchWindow() {
      const linked = players.filter(player => player.cpblAcnt);
      if (!linked.length) return;

      try {
        const data = await promiseTimeout(
          cpblRequest('current-rosters', {
            acnts: linked.map(player => player.cpblAcnt)
          }),
          12000,
          '目前一二軍狀態查詢逾時'
        );
        const rows = Array.isArray(data.players) ? data.players : [];
        const byAcnt = new Map(rows.filter(row => row?.ok && row.acnt).map(row => [String(row.acnt), row]));

        for (const player of linked) {
          const current = byAcnt.get(String(player.cpblAcnt));
          if (!current) continue;

          if (current.team) player.cpblTeam = normalizeTeamName(current.team);
          if (current.teamCode) player.cpblTeamCode = String(current.teamCode);
          if (current.number) player.number = String(current.number);
          const level = String(current.level || '').toUpperCase();
          if (level === 'A' || level === 'D') player.cpblCurrentLevel = level;

          const roleChanged = repairStoredCpblPlayerType(player, current.position || '');
          player.cpblRosterUpdatedAt = Date.now();

          if (roleChanged && player.id === selectedPlayerId) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }
          await idbPut(STORES.players, player);
        }
      } catch (error) {
        console.warn('目前一二軍名單更新失敗，沿用最近一次成功判定', error);
      }
    };
