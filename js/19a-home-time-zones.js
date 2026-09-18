(() => {
  const CLOCKS = [
    { key:'TW', zone:'Asia/Taipei', timeId:'homeTimeTW', dateId:'homeTimeDateTW' },
    { key:'JP_KR', zone:'Asia/Tokyo', timeId:'homeTimeJPKR', dateId:'homeTimeDateJPKR' },
    { key:'US', zone:'America/New_York', timeId:'homeTimeUS', dateId:'homeTimeDateUS' }
  ];

  let minuteTimer = 0;

  function parts(zone) {
    const values = new Intl.DateTimeFormat('zh-TW', {
      timeZone:zone,
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit',
      hour12:false,
      hourCycle:'h23'
    }).formatToParts(new Date());
    const get = type => values.find(part => part.type === type)?.value || '';
    return {
      time:`${get('hour')}:${get('minute')}`,
      date:`${get('month')}/${get('day')}`
    };
  }

  function activeKey() {
    if (typeof homeRootSection !== 'undefined' && homeRootSection !== 'pro') return '';
    const country = typeof homeProCountry !== 'undefined' ? String(homeProCountry || '') : '';
    if (country === 'TW') return 'TW';
    if (country === 'JP' || country === 'KR') return 'JP_KR';
    if (country === 'US') return 'US';
    return '';
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
    const active = activeKey();
    document.querySelectorAll('#homeTimeZonePanel [data-time-zone-key]').forEach(card => {
      card.classList.toggle('active', card.dataset.timeZoneKey === active);
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