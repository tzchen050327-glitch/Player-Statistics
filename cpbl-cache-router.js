(() => {
  const nativeSetTimeout = window.setTimeout.bind(window);

  // cpbl-game-detail already owns the shared Supabase cache, single-flight lock,
  // 30-second live TTL and stale fallback. Do not wrap it with another cache endpoint.

  // Fresh-install guard kept here for compatibility with the current bootstrap.
  const nativeAnnualSeasonContext = globalThis.annualSeasonContext;
  if (typeof nativeAnnualSeasonContext === 'function') {
    globalThis.annualSeasonContext = player => {
      if (!player) {
        return {
          year: new Date().getFullYear(),
          league: '',
          team: '',
          level: ''
        };
      }
      return nativeAnnualSeasonContext(player);
    };
  }

  // Collapse only the enhancement debounce so a live refresh does not expose
  // the unenhanced board between DOM patches.
  window.setTimeout = (handler, timeout, ...args) => {
    const delay = Number(timeout) || 0;
    if (delay === 60 && typeof handler === 'function' && handler.name === 'enhanceGameDetail') {
      return nativeSetTimeout(handler, 0, ...args);
    }
    return nativeSetTimeout(handler, timeout, ...args);
  };

  // ===== Postseason navigation / season picker ownership guard =====
  // app.js and postseason-history.js both touch #seasonSelect. When app.js
  // re-renders after the postseason scan, it can restore all regular-season
  // years. The guard below reapplies the cached postseason-only years before
  // the picker opens and after any competing DOM rewrite.
  const POSTSEASON_STORE_PREFIX = 'postseason-years-v2:';
  let postseasonUiGuard = false;
  let postseasonUiTimer = 0;

  function injectPostseasonSingleRowStyle() {
    if (document.getElementById('postseasonSingleRowOverride')) return;
    const style = document.createElement('style');
    style.id = 'postseasonSingleRowOverride';
    style.textContent = `
      .player-page-tabs.postseason-five-tabs{
        display:flex !important;
        grid-template-columns:none !important;
        flex-wrap:nowrap !important;
        align-items:stretch !important;
        overflow-x:auto !important;
        overflow-y:hidden !important;
        gap:6px !important;
      }
      .player-page-tabs.postseason-five-tabs > .tab-btn:not(.hidden){
        flex:1 1 0 !important;
        min-width:72px !important;
        width:auto !important;
      }
      .player-page-tabs.postseason-five-tabs > .tab-btn.hidden{
        display:none !important;
      }
      @media(max-width:640px){
        .player-page-tabs.postseason-five-tabs{
          gap:4px !important;
        }
        .player-page-tabs.postseason-five-tabs > .tab-btn:not(.hidden){
          flex:1 0 64px !important;
          min-width:64px !important;
          padding:7px 3px !important;
          font-size:11px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function postseasonLeagueFor(player) {
    if (!player) return '';
    const scope = String(player.scope || '').trim();
    if (scope !== 'overseas' && scope !== 'international') return 'CPBL';
    if (scope === 'overseas' && String(player.externalProvider || '').toUpperCase() === 'NPB') return 'NPB';
    return '';
  }

  function postseasonPlayerKey(ctx, league) {
    const player = ctx?.player;
    const playerId = league === 'CPBL'
      ? String(player?.cpblAcnt || '').trim()
      : String(player?.externalPlayerId || '').trim();
    const playerName = String(player?.externalOfficialName || player?.name || '').trim();
    return `${league}|${playerId}|${playerName}`;
  }

  function readPostseasonYearState(ctx, league) {
    const encoded = encodeURIComponent(postseasonPlayerKey(ctx, league));
    const prefix = `${POSTSEASON_STORE_PREFIX}${encoded}:`;
    let best = null;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const storageKey = localStorage.key(i);
        if (!storageKey || !storageKey.startsWith(prefix)) continue;
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const at = Number(parsed?.at || 0);
        const years = Array.isArray(parsed?.years)
          ? [...new Set(parsed.years.map(Number).filter(year => Number.isInteger(year) && year >= 1990 && year <= 2100))].sort((a,b)=>b-a)
          : [];
        if (!best || at > best.at) best = { found:true, at, years };
      }
    } catch (error) {
      console.warn('季後賽年份快取讀取失敗', error);
    }
    return best || { found:false, at:0, years:[] };
  }

  function sameYears(select, years) {
    const current = [...select.options]
      .map(option => Number(option.value))
      .filter(Number.isInteger);
    return current.length === years.length && current.every((year,index) => year === years[index]);
  }

  function enforcePostseasonSeasonOptions() {
    if (postseasonUiGuard) return false;
    const ctx = typeof window.__getPlayerContext === 'function' ? window.__getPlayerContext() : null;
    if (!ctx?.player || ctx.selectedTab !== 'postseason') return false;
    const league = postseasonLeagueFor(ctx.player);
    if (!league) return false;

    const select = document.getElementById('seasonSelect');
    const trigger = document.getElementById('seasonSelectButton');
    const label = document.getElementById('seasonSelectButtonText');
    if (!select) return false;

    const state = readPostseasonYearState(ctx, league);
    if (!state.found) return false;

    postseasonUiGuard = true;
    try {
      if (!state.years.length) {
        select.innerHTML = '<option value="">無季後賽出賽</option>';
        select.value = '';
        select.disabled = true;
        if (trigger) trigger.disabled = true;
        if (label) label.textContent = '無季後賽出賽';
        return true;
      }

      const oldValue = Number(select.value);
      const chosen = state.years.includes(oldValue) ? oldValue : state.years[0];
      if (!sameYears(select, state.years)) {
        select.innerHTML = state.years.map(year => `<option value="${year}">${year}</option>`).join('');
      }
      select.disabled = false;
      if (trigger) trigger.disabled = false;
      select.value = String(chosen);
      if (label) label.textContent = String(chosen);
      return true;
    } finally {
      postseasonUiGuard = false;
    }
  }

  function schedulePostseasonUiEnforce() {
    clearTimeout(postseasonUiTimer);
    postseasonUiTimer = nativeSetTimeout(() => {
      injectPostseasonSingleRowStyle();
      enforcePostseasonSeasonOptions();
    }, 0);
  }

  injectPostseasonSingleRowStyle();

  // Capture runs before app.js opens the custom season dialog, so the dialog is
  // built from postseason-only options rather than the regular-season list.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('#seasonSelectButton')) enforcePostseasonSeasonOptions();
    if (target?.closest('.tab-btn')) schedulePostseasonUiEnforce();
  }, true);

  const seasonSelect = document.getElementById('seasonSelect');
  if (seasonSelect) {
    const observer = new MutationObserver(() => {
      if (!postseasonUiGuard && document.body.classList.contains('postseason-history-mode')) {
        schedulePostseasonUiEnforce();
      }
    });
    observer.observe(seasonSelect, { childList:true });
  }

  const bodyObserver = new MutationObserver(() => {
    if (document.body.classList.contains('postseason-history-mode')) schedulePostseasonUiEnforce();
  });
  bodyObserver.observe(document.body, { attributes:true, attributeFilter:['class'] });

  window.addEventListener('pageshow', schedulePostseasonUiEnforce);
})();
