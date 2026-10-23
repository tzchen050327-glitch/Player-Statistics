(() => {
  // Exactly three clocks. Clicking changes both continent and its league.
  const CLOCKS = [
    { key:'TW', continent:'ASIA', country:'TW', zone:'Asia/Taipei', timeId:'homeTimeTW', dateId:'homeTimeDateTW' },
    { key:'JP', continent:'ASIA', country:'JP', zone:'Asia/Tokyo', timeId:'homeTimeJPKR', dateId:'homeTimeDateJPKR' },
    { key:'US', continent:'AMERICA', country:'US', zone:'America/New_York', timeId:'homeTimeUS', dateId:'homeTimeDateUS' }
  ];
  let minuteTimer = 0;

  // A user's date choice is global across direct league/category navigation.
  // Only clicking a timezone clock resets this choice to that region's today.
  let lastAutomaticUsDate = '';
  let dateManuallySelected = false;

  function setUsGameDate(date) {
    if (homeRootSection !== 'pro' || homeProCountry !== 'US' || !els.gameDate) return;
    lastAutomaticUsDate = date;
    dateManuallySelected = false;
    if (els.gameDate.value === date) return;
    els.gameDate.value = date;
    if (typeof syncAppPickerLabels === 'function') syncAppPickerLabels();
    renderRecentPlayers();
  }

  function selectUsGameDate() {
    setUsGameDate(parts('America/New_York').iso);
  }

  function rolloverUsGameDate() {
    if (homeRootSection !== 'pro' || homeProCountry !== 'US' || !els.gameDate) return;
    if (!lastAutomaticUsDate || dateManuallySelected || els.gameDate.value !== lastAutomaticUsDate) return;
    const today = parts('America/New_York').iso;
    if (today !== lastAutomaticUsDate) setUsGameDate(today);
  }

  els.gameDate?.addEventListener('change', () => {
    dateManuallySelected = true;
  });

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
    // Refresh the active MLB date after New York midnight even if the app stayed open.
    rolloverUsGameDate();
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

    // Clock shortcuts explicitly return to "today", unlike league buttons.
    dateManuallySelected = false;
    const targetDate = parts(clock.zone).iso;
    if (els.gameDate && targetDate) {
      els.gameDate.value = targetDate;
      if (typeof syncAppPickerLabels === 'function') syncAppPickerLabels();
    }
    applyHomeProSelection();
    renderRecentPlayers();
    if (clock.country === 'US') selectUsGameDate();
    else lastAutomaticUsDate = '';
    renderClocks();
  }

  document.querySelectorAll('#homeTimeZonePanel [data-time-zone-key]').forEach(card => {
    card.addEventListener('click', () => switchLeagueFromClock(String(card.dataset.timeZoneKey || '')));
  });
  document.querySelectorAll('[data-pro-country],[data-home-root],[data-us-league]').forEach(button => {
    button.addEventListener('click', () => {
      refreshSoon();
      // A directly selected league must never discard a manually chosen date.
      if (dateManuallySelected) return;
      if (homeRootSection === 'pro' && homeProCountry === 'US') {
        selectUsGameDate();
      } else {
        // Switching back from the US must restore today's date for the
        // selected Asian league, rather than retaining yesterday's MLB date.
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