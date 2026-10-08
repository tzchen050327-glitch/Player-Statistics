(() => {
  // Sidebar clocks use the same two-level hierarchy as the homepage:
  // parent continent -> country / league, not the old combined Japan-Korea tile.
  const CLOCKS = [
    { key:'TW', continent:'ASIA', country:'TW', zone:'Asia/Taipei', timeId:'homeTimeTW', dateId:'homeTimeDateTW' },
    { key:'JP', continent:'ASIA', country:'JP', zone:'Asia/Tokyo', timeId:'homeTimeJP', dateId:'homeTimeDateJP' },
    { key:'KR', continent:'ASIA', country:'KR', zone:'Asia/Seoul', timeId:'homeTimeKR', dateId:'homeTimeDateKR' },
    { key:'AWB', continent:'ASIA', country:'AWB', zone:'Asia/Taipei', timeId:'homeTimeAWB', dateId:'homeTimeDateAWB' },
    { key:'US', continent:'AMERICA', country:'US', zone:'America/New_York', timeId:'homeTimeUS', dateId:'homeTimeDateUS' }
  ];
  const ASIA_COUNTRIES = new Set(['TW','JP','KR','AWB']);
  let lastAsiaCountry = ASIA_COUNTRIES.has(String(homeProCountry || '')) ? homeProCountry : 'TW';
  let minuteTimer = 0;

  function parts(zone) {
    const values = new Intl.DateTimeFormat('zh-TW', {
      timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hour12:false, hourCycle:'h23'
    }).formatToParts(new Date());
    const get = type => values.find(part => part.type === type)?.value || '';
    return {
      time:`${get('hour')}:${get('minute')}`,
      date:`${get('month')}/${get('day')}`,
      iso:`${get('year')}-${get('month')}-${get('day')}`
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
    const continent = homeProContinent === 'AMERICA' ? 'AMERICA' : 'ASIA';
    const proSelected = homeRootSection === 'pro';
    const asia = document.getElementById('homeTimeAsiaList');
    const america = document.getElementById('homeTimeAmericaList');
    if (asia) asia.classList.toggle('hidden', continent !== 'ASIA');
    if (america) america.classList.toggle('hidden', continent !== 'AMERICA');

    document.querySelectorAll('#homeTimeContinentSwitch [data-time-continent]').forEach(btn => {
      const active = btn.dataset.timeContinent === continent;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('#homeTimeZonePanel [data-time-zone-key]').forEach(card => {
      const active = proSelected && card.dataset.timeZoneKey === homeProCountry;
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
    queueMicrotask(() => {
      if (ASIA_COUNTRIES.has(String(homeProCountry || ''))) lastAsiaCountry = homeProCountry;
      renderClocks();
    });
  }

  function enterLeague(continent, country, zone) {
    if (!['ASIA','AMERICA'].includes(continent)) return;
    if (continent === 'ASIA' && !ASIA_COUNTRIES.has(country)) return;
    if (continent === 'AMERICA' && country !== 'US') return;

    homeRootSection = 'pro';
    homeProContinent = continent;
    homeProCountry = country;
    homeTeamFilter = '';
    if (continent === 'ASIA') lastAsiaCountry = country;
    if (country === 'US') homeUsLeague = 'MLB';

    const targetDate = parts(zone).iso;
    if (els.gameDate && targetDate) {
      els.gameDate.value = targetDate;
      if (typeof syncAppPickerLabels === 'function') syncAppPickerLabels();
    }
    applyHomeProSelection();
    renderRecentPlayers();
    renderClocks();
  }

  function switchContinentFromClock(continent) {
    if (continent === 'AMERICA') {
      if (ASIA_COUNTRIES.has(String(homeProCountry || ''))) lastAsiaCountry = homeProCountry;
      enterLeague('AMERICA','US','America/New_York');
    } else if (continent === 'ASIA') {
      const country = ASIA_COUNTRIES.has(lastAsiaCountry) ? lastAsiaCountry : 'TW';
      const clock = CLOCKS.find(item => item.country === country);
      enterLeague('ASIA',country,clock?.zone || 'Asia/Taipei');
    }
  }

  document.querySelectorAll('#homeTimeContinentSwitch [data-time-continent]').forEach(btn => {
    btn.addEventListener('click', () => switchContinentFromClock(String(btn.dataset.timeContinent || '')));
  });
  document.querySelectorAll('#homeTimeZonePanel [data-time-zone-key]').forEach(card => {
    card.addEventListener('click', () => {
      const clock = CLOCKS.find(item => item.key === card.dataset.timeZoneKey);
      if (clock) enterLeague(clock.continent,clock.country,clock.zone);
    });
  });
  document.querySelectorAll('[data-pro-country],[data-home-root],[data-us-league]').forEach(btn => {
    btn.addEventListener('click', refreshSoon);
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