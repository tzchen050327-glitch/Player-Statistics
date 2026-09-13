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
})();
