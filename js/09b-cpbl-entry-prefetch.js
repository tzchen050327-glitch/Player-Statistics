    // Start the two slow CPBL entry requests together and let the existing
    // player-navigation flow reuse the same in-flight promises. This keeps the
    // original parsing/application order intact while removing the idle gap
    // before the sync overlay appears.
    const cpblRequestBeforeEntryPrefetch = cpblRequest;
    const selectPlayerBeforeEntryPrefetch = selectPlayer;
    const cpblEntryPrefetchRequests = new Map();

    function cpblEntryPrefetchKey(action, extra = {}) {
      if (!['player-profile', 'season-histories'].includes(String(action || ''))) return '';
      const acnt = String(extra?.acnt || '').trim();
      return acnt ? `${action}|${acnt}` : '';
    }

    cpblRequest = function cpblRequestWithEntryPrefetch(action, extra = {}) {
      const key = cpblEntryPrefetchKey(action, extra);
      if (key && cpblEntryPrefetchRequests.has(key)) return cpblEntryPrefetchRequests.get(key);
      return cpblRequestBeforeEntryPrefetch(action, extra);
    };

    selectPlayer = async function selectPlayerWithCpblEntryPrefetch(id) {
      const enteringPlayer = players.find(player => player.id === id) || null;
      const isLinkedCpbl = Boolean(
        enteringPlayer
        && playerScope(enteringPlayer) === 'cpbl'
        && enteringPlayer.cpblAcnt
      );

      if (!isLinkedCpbl) return selectPlayerBeforeEntryPrefetch(id);

      const acnt = String(enteringPlayer.cpblAcnt);
      const profileKey = cpblEntryPrefetchKey('player-profile', { acnt });
      const historiesKey = cpblEntryPrefetchKey('season-histories', { acnt });

      const profilePromise = cpblRequestBeforeEntryPrefetch('player-profile', { acnt });
      const historiesPromise = cpblRequestBeforeEntryPrefetch('season-histories', { acnt });
      // Attach handlers immediately so an unusually fast failure cannot surface
      // as an unhandled rejection before the original flow reaches its await.
      profilePromise.catch(() => {});
      historiesPromise.catch(() => {});
      cpblEntryPrefetchRequests.set(profileKey, profilePromise);
      cpblEntryPrefetchRequests.set(historiesKey, historiesPromise);

      // Calling the existing async selector runs its synchronous setup first,
      // including selectedPlayerId assignment, before it reaches IndexedDB await.
      const task = selectPlayerBeforeEntryPrefetch(id);
      setSyncProgress(0, `準備同步 #${enteringPlayer.number} ${enteringPlayer.name}…`);
      setSyncProgress(
        6,
        '正在同時讀取球員資料與一軍／二軍歷年成績…',
        { autoAdvanceTo:28, autoAdvanceMs:5000 }
      );

      // The two requests really are parallel, so surface their actual completion
      // independently. Between real milestones, setSyncProgress only estimates
      // forward movement and never reaches the next milestone on its own.
      let profileReady = false;
      let historiesReady = false;
      const updatePrefetchProgress = () => {
        if (profileReady && historiesReady) {
          setSyncProgress(70, '球員資料與一軍／二軍歷年成績已讀取，正在整理…');
        } else if (profileReady) {
          setSyncProgress(
            36,
            '球員資料已讀取，正在等待一軍／二軍歷年成績…',
            { autoAdvanceTo:52, autoAdvanceMs:4500 }
          );
        } else if (historiesReady) {
          setSyncProgress(
            48,
            '一軍／二軍歷年成績已讀取，正在等待球員資料…',
            { autoAdvanceTo:62, autoAdvanceMs:4500 }
          );
        }
      };
      profilePromise.then(() => {
        profileReady = true;
        updatePrefetchProgress();
      }, () => {});
      historiesPromise.then(() => {
        historiesReady = true;
        updatePrefetchProgress();
      }, () => {});

      try {
        return await task;
      } finally {
        if (cpblEntryPrefetchRequests.get(profileKey) === profilePromise) cpblEntryPrefetchRequests.delete(profileKey);
        if (cpblEntryPrefetchRequests.get(historiesKey) === historiesPromise) cpblEntryPrefetchRequests.delete(historiesKey);
      }
    };
