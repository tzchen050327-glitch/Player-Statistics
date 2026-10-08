    // Homepage roster refresh must not fail as one large all-or-nothing 4.5s batch.
    // Keep the startup roster decision authoritative for homepage A/D grouping.
    const refreshCurrentRosterStatusBeforeHomeBatchFix = refreshCurrentRosterStatus;
    const CPBL_ROSTER_REFRESH_TTL_MS = 30 * 60 * 1000;

    function cpblRosterStatusCacheFresh(linked) {
      const now = Date.now();
      return linked.every(player => {
        const level = String(player.cpblCurrentLevel || '').toUpperCase();
        const updatedAt = Number(player.cpblRosterUpdatedAt || 0);
        return ['A', 'D'].includes(level)
          && player.cpblRosterSource === 'advanced-player-page-live-v3'
          && updatedAt > 0
          && now - updatedAt < CPBL_ROSTER_REFRESH_TTL_MS;
      });
    }

    refreshCurrentRosterStatus = async function refreshCurrentRosterStatusWithLongerBatchWindow() {
      const linked = players.filter(player => player.cpblAcnt);
      if (!linked.length) return;
      if (cpblRosterStatusCacheFresh(linked)) return;

      try {
        const data = await promiseTimeout(
          cpblRequest('current-rosters', {
            acnts: linked.map(player => player.cpblAcnt)
          }),
          35000,
          '目前一二軍狀態查詢逾時'
        );
        const rows = Array.isArray(data.players) ? data.players : [];
        const byAcnt = new Map(rows.filter(row => row?.ok && row.acnt).map(row => [String(row.acnt), row]));

        for (const player of linked) {
          const current = byAcnt.get(String(player.cpblAcnt));
          if (!current || current.rosterSource !== 'advanced-player-page-live-v3') continue;
          const level = String(current.level || '').toUpperCase();
          if (level !== 'A' && level !== 'D') continue;

          // Store the current club and farm label together; keeping only the
          // parent club loses an important recovery signal when cloud sync
          // subsequently delivers an older cpblCurrentLevel.
          const parentTeam = normalizeTeamName(
            String(current.team || current.teamLabel || '').replace(/二軍\s*$/, '').trim()
          );
          if (!parentTeam) continue;
          const teamLabel = level === 'D' ? parentTeam + '二軍' : parentTeam;
          const teamCode = String(current.teamCode || player.cpblTeamCode || '').trim();
          const uniform = String(current.number || player.number || '').trim();
          const changed = player.cpblTeam !== teamLabel
            || player.cpblCurrentLevel !== level
            || String(player.cpblTeamCode || '') !== teamCode
            || String(player.number || '') !== uniform
            || player.cpblRosterSource !== 'advanced-player-page-live-v3';

          player.cpblTeam = teamLabel;
          if (teamCode) player.cpblTeamCode = teamCode;
          if (uniform) player.number = uniform;
          player.cpblCurrentLevel = level;
          const roleChanged = current.position
            ? repairStoredCpblPlayerType(player, current.position)
            : false;
          player.cpblRosterSource = 'advanced-player-page-live-v3';
          player.cpblRosterUpdatedAt = Date.now();

          if (roleChanged && player.id === selectedPlayerId) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }
          // Cloud sync uses updatedAt (not cpblRosterUpdatedAt) to resolve
          // concurrent copies. Advance it for actual roster changes only.
          // Skip unnecessary cloud writes when just refreshing the TTL.
          if (changed || roleChanged) {
            player.updatedAt = Date.now();
            await idbPut(STORES.players, player);
          }
        }
      } catch (error) {
        console.warn('目前一二軍名單更新失敗，沿用最近一次成功判定', error);
      }
    };
