(() => {
  // Exactly three clocks. Clicking changes both continent and its league.
  const CLOCKS = [
    { key:'TW', continent:'ASIA', country:'TW', zone:'Asia/Taipei', timeId:'homeTimeTW', dateId:'homeTimeDateTW' },
    { key:'JP', continent:'ASIA', country:'JP', zone:'Asia/Tokyo', timeId:'homeTimeJPKR', dateId:'homeTimeDateJPKR' },
    { key:'US', continent:'AMERICA', country:'US', zone:'America/New_York', timeId:'homeTimeUS', dateId:'homeTimeDateUS' }
  ];
  let minuteTimer = 0;

  // The MLB scoreboard stays on the previous New York game date until noon,
  // or while one of that day's games is still actively unfinished.
  const MLB_SCHEDULE_URL = 'https://statsapi.mlb.com/api/v1/schedule';
  const usScheduleCache = new Map();
  let usDateSelectionToken = 0;

  function yesterdayISO(iso) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  function newYorkHour() {
    return Number(new Intl.DateTimeFormat('en-GB', {
      timeZone:'America/New_York', hour:'2-digit', hourCycle:'h23'
    }).format(new Date()));
  }

  async function previousMlbDayStillLive(date) {
    const cached = usScheduleCache.get(date);
    if (cached && Date.now() - cached.at < 60000) return cached.live;
    // Reuse already-fetched game records when possible, avoiding an extra request.
    const localCache = typeof homeDailyGamesCache !== 'undefined'
      ? homeDailyGamesCache.get(`MLB|${date}`) : null;
    if (Array.isArray(localCache?.games) && localCache.games.length
        && Date.now() - Number(localCache.at || 0) < 60000) {
      const live = localCache.games.some(game =>
        ['live','in_progress','in progress','suspended','delayed'].includes(
          String(game?.status || '').toLowerCase()
        )
      );
      if (live) return true;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const url = `${MLB_SCHEDULE_URL}?sportId=1&date=${encodeURIComponent(date)}`;
      const response = await fetch(url, {signal:controller.signal});
      if (!response.ok) throw new Error(`MLB schedule ${response.status}`);
      const json = await response.json();
      const live = (json.dates || []).some(day => (day.games || []).some(game => {
        const status = game.status || {};
        const code = String(status.statusCode || '').toUpperCase();
        return status.abstractGameState === 'Live'
          || ['I','M','N','D','S'].includes(code)
          || /in progress|delayed|suspended/i.test(String(status.detailedState || ''));
      }));
      usScheduleCache.set(date, {at:Date.now(),live});
      return live;
    } catch (error) {
      console.warn('[MLB date] schedule check unavailable',error);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  function setUsGameDate(date) {
    if (homeRootSection !== 'pro' || homeProCountry !== 'US' || !els.gameDate) return;
    if (els.gameDate.value === date) return;
    els.gameDate.value = date;
    if (typeof syncAppPickerLabels === 'function') syncAppPickerLabels();
    renderRecentPlayers();
  }

  async function selectUsGameDate() {
    const token = ++usDateSelectionToken;
    const today = parts('America/New_York').iso;
    const previous = yesterdayISO(today);
    // The previous date is selected immediately before local noon.
    if (newYorkHour() < 12) {
      setUsGameDate(previous);
      return;
    }
    // Keep the already chosen date visible until the schedule check returns.
    const live = await previousMlbDayStillLive(previous);
    if (token !== usDateSelectionToken) return;
    setUsGameDate(live ? previous : today);
  }

  // Don't replace a date the user deliberately selects from the calendar.
  els.gameDate?.addEventListener('change', () => { usDateSelectionToken++; });


  function parts(zone) {
    const values = new Intl.DateTimeFormat('zh-TW', {
      timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hour12:false, hourCycle:'h23'
    }).formatToParts(new Date());
    const get = type => values.find(part => part.type === type)?.value || '';
    return {
      time:[get('hour'),get('minute')].join(':'),
      date:[get('month'),get('day')].join('/'),
      iso:[get('year'),get('month'),get('day')].join('-')
    };
  }

  function renderClocks() {
    for (const clock of CLOCKS) {
      const value = parts(clock.zone);
      const time = document.getElementById(clock.timeId);
      const date = document.getElementById(clock.dateId);
      if (time) {
        time.textContent = value.time;
        time.dateTime = value.time;
      }
      if (date) date.textContent = value.date;
    }
    document.querySelectorAll('#homeTimeZonePanel [data-time-zone-key]').forEach(card => {
      const active = homeRootSection === 'pro' && card.dataset.timeZoneKey === (['KR'].includes(homeProCountry) ? 'JP' : homeProCountry === 'AWB' ? 'TW' : homeProCountry);
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', String(active));
    });
  }

  function scheduleNextMinute() {
    if (minuteTimer) clearTimeout(minuteTimer);
    const now = new Date();
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 25;
    minuteTimer = window.setTimeout(() => {
      renderClocks();
      scheduleNextMinute();
    }, Math.max(250, delay));
  }

  function refreshSoon() {
    queueMicrotask(renderClocks);
  }

  function switchLeagueFromClock(key) {
    const clock = CLOCKS.find(item => item.key === key);
    if (!clock) return;
    homeRootSection = 'pro';
    homeProContinent = clock.continent;
    homeProCountry = clock.country;
    homeTeamFilter = '';
    if (clock.country === 'US') homeUsLeague = 'MLB';

    const targetDate = clock.country === 'US' && newYorkHour() < 12
      ? yesterdayISO(parts(clock.zone).iso) : parts(clock.zone).iso;
    if (els.gameDate && targetDate) {
      els.gameDate.value = targetDate;
      if (typeof syncAppPickerLabels === 'function') syncAppPickerLabels();
    }
    applyHomeProSelection();
    renderRecentPlayers();
    if (clock.country === 'US') void selectUsGameDate();
    else usDateSelectionToken++;
    renderClocks();
  }

  document.querySelectorAll('#homeTimeZonePanel [data-time-zone-key]').forEach(card => {
    card.addEventListener('click', () => switchLeagueFromClock(String(card.dataset.timeZoneKey || '')));
  });
  document.querySelectorAll('[data-pro-country],[data-home-root],[data-us-league]').forEach(button => {
    button.addEventListener('click', () => {
      refreshSoon();
      if (homeRootSection === 'pro' && homeProCountry === 'US') {
        void selectUsGameDate();
      } else {
        // Switching back from the US must restore today's date for the
        // selected Asian league, rather than retaining yesterday's MLB date.
        usDateSelectionToken++;
        if (homeRootSection === 'pro') {
          const zone = homeProCountry === 'JP' ? 'Asia/Tokyo'
            : homeProCountry === 'KR' ? 'Asia/Seoul' : 'Asia/Taipei';
          const today = parts(zone).iso;
          if (els.gameDate && els.gameDate.value !== today) {
            els.gameDate.value = today;
            if (typeof syncAppPickerLabels === 'function') syncAppPickerLabels();
            renderRecentPlayers();
          }
        }
      }
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderClocks();
      scheduleNextMinute();
    }
  });
  window.addEventListener('focus', renderClocks);
  window.addEventListener('pageshow', renderClocks);
  renderClocks();
  scheduleNextMinute();
})();