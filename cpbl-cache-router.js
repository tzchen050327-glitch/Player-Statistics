(() => {
  const CACHE_SUFFIX = '/cpbl-game-detail-cache';
  const SOURCE_RE = /\/cpbl-game-detail(?:\?|$)/i;
  const nativeFetch = window.fetch.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);

  function rewriteUrl(url) {
    const raw = String(url || '');
    if (!SOURCE_RE.test(raw)) return raw;
    return raw.replace(/\/cpbl-game-detail(?=\?|$)/i, CACHE_SUFFIX);
  }

  window.fetch = async (input, init) => {
    try {
      if (typeof input === 'string') {
        return nativeFetch(rewriteUrl(input), init);
      }
      if (input instanceof Request) {
        const nextUrl = rewriteUrl(input.url);
        if (nextUrl !== input.url) {
          const nextRequest = new Request(nextUrl, input);
          return nativeFetch(nextRequest, init);
        }
      }
    } catch (error) {
      console.warn('CPBL cache router fallback', error);
    }
    return nativeFetch(input, init);
  };

  // Fresh-install guard: an empty IndexedDB has no selected player yet, but
  // app.js still evaluates the season-report labels during renderAll().
  // Returning a harmless empty context prevents that first render from being
  // misreported as an IndexedDB-open failure.
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

  // game-detail-enhancement currently waits 60ms before patching the enhanced
  // live board. Collapse that one debounce so the base render is not exposed.
  window.setTimeout = (handler, timeout, ...args) => {
    const delay = Number(timeout) || 0;
    if (delay === 60 && typeof handler === 'function' && handler.name === 'enhanceGameDetail') {
      return nativeSetTimeout(handler, 0, ...args);
    }
    return nativeSetTimeout(handler, timeout, ...args);
  };
})();
