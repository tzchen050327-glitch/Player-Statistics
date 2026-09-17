(() => {
  const MLB_SCHEDULE_API = 'https://statsapi.mlb.com/api/v1/schedule';
  const TIME_ZONE = 'America/New_York';
  const scheduleTimeCache = new Map();
  const loading = new Map();

  function formatNewYorkTime(value) {
    const ms = Date.parse(String(value || ''));
    if (!Number.isFinite(ms)) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(new Date(ms));
    } catch {
      return '';
    }
  }

  async function officialTimes(date) {
    const key = String(date || '');
    if (scheduleTimeCache.has(key)) return scheduleTimeCache.get(key);
    if (loading.has(key)) return loading.get(key);

    const task = (async () => {
      const url = `${MLB_SCHEDULE_API}?sportId=1&date=${encodeURIComponent(key)}`;
      const response = await fetch(url, { cache:'no-store' });
      if (!response.ok) throw new Error(`MLB schedule ${response.status}`);
      const data = await response.json();
      const map = new Map();
      for (const day of data?.dates || []) {
        for (const game of day?.games || []) {
          const id = String(game?.gamePk || '');
          const time = formatNewYorkTime(game?.gameDate);
          if (id && time) map.set(id, time);
        }
      }
      scheduleTimeCache.set(key, map);
      return map;
    })().finally(() => loading.delete(key));

    loading.set(key, task);
    return task;
  }

  async function hydrateCachedMlbTimes(date) {
    const key = `MLB|${date}`;
    const cached = homeDailyGamesCache.get(key);
    const games = Array.isArray(cached?.games) ? cached.games : [];
    if (!games.length || games.every(game => String(game?.time || '').trim())) return false;

    let times;
    try {
      times = await officialTimes(date);
    } catch (error) {
      console.warn('MLB 紐約時間補抓失敗', error);
      return false;
    }

    let changed = false;
    const next = games.map(game => {
      if (String(game?.time || '').trim()) return game;
      const time = times.get(String(game?.id || '')) || '';
      if (!time) return game;
      changed = true;
      return { ...game, time, timeZone:TIME_ZONE };
    });

    if (changed && cached) {
      cached.games = next;
      cached.at = Date.now();
      homeDailyGamesCache.set(key, cached);
    }
    return changed;
  }

  function paintScheduledTimes() {
    if (currentPage !== 'home' || homeDailyGamesLeague() !== 'MLB') return;
    const date = String(els.gameDate?.value || localISODate());
    const cached = homeDailyGamesCache.get(`MLB|${date}`);
    const games = Array.isArray(cached?.games) ? cached.games : [];
    const cards = els.homeDailyGames?.querySelectorAll?.('.home-game-card') || [];

    cards.forEach((card, index) => {
      const game = games[index];
      const time = String(game?.time || '').trim();
      if (!time) return;
      const top = card.querySelector('.home-game-card-top');
      if (!top) return;
      let node = top.querySelector('.home-game-time');
      if (!node) {
        node = document.createElement('span');
        node.className = 'home-game-time';
        top.appendChild(node);
      }
      node.textContent = time;
      node.title = '紐約時間';
    });
  }

  const renderBeforeMlbTime = renderHomeDailyGames;
  renderHomeDailyGames = function renderHomeDailyGamesWithMlbNewYorkTime(options = {}) {
    const result = renderBeforeMlbTime(options);
    if (currentPage === 'home' && homeDailyGamesLeague() === 'MLB') {
      const date = String(els.gameDate?.value || localISODate());
      paintScheduledTimes();
      void hydrateCachedMlbTimes(date).then(changed => {
        if (!changed) return;
        if (currentPage === 'home' && homeDailyGamesLeague() === 'MLB' && String(els.gameDate?.value || '') === date) {
          renderBeforeMlbTime({ skipLoad:true });
          paintScheduledTimes();
          scheduleHomeDailyGamesAutoRefresh();
        }
      });
    }
    return result;
  };
})();
