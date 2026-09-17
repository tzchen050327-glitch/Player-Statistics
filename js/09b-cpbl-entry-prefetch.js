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
      setSyncProgress(6, '正在同時讀取球員資料與一軍／二軍歷年成績…');

      try {
        return await task;
      } finally {
        if (cpblEntryPrefetchRequests.get(profileKey) === profilePromise) cpblEntryPrefetchRequests.delete(profileKey);
        if (cpblEntryPrefetchRequests.get(historiesKey) === historiesPromise) cpblEntryPrefetchRequests.delete(historiesKey);
      }
    };
