(() => {
  // Exactly three clocks. Clicking changes both continent and its league.
  const CLOCKS = [
    { key:'TW', continent:'ASIA', country:'TW', zone:'Asia/Taipei', timeId:'homeTimeTW', dateId:'homeTimeDateTW' },
    { key:'JP', continent:'ASIA', country:'JP', zone:'Asia/Tokyo', timeId:'homeTimeJPKR', dateId:'homeTimeDateJPKR' },
    { key:'US', continent:'AMERICA', country:'US', zone:'America/New_York', timeId:'homeTimeUS', dateId:'homeTimeDateUS' }
  ];
  let minuteTimer = 0;

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
      const active = homeRootSection === 'pro' && card.dataset.timeZoneKey === (homeProCountry === 'KR' ? 'JP' : homeProCountry);
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

    const targetDate = parts(clock.zone).iso;
    if (els.gameDate && targetDate) {
      els.gameDate.value = targetDate;
      if (typeof syncAppPickerLabels === 'function') syncAppPickerLabels();
    }
    applyHomeProSelection();
    renderRecentPlayers();
    renderClocks();
  }

  document.querySelectorAll('#homeTimeZonePanel [data-time-zone-key]').forEach(card => {
    card.addEventListener('click', () => switchLeagueFromClock(String(card.dataset.timeZoneKey || '')));
  });
  document.querySelectorAll('[data-pro-country],[data-home-root],[data-us-league]').forEach(button => {
    button.addEventListener('click', refreshSoon);
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