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

  // game-detail-enhancement 目前以 60ms debounce 等待畫面更新；
  // 這會讓主程式重畫後短暫露出未增強狀態。只針對該函式壓成 0ms。
  window.setTimeout = (handler, timeout, ...args) => {
    const delay = Number(timeout) || 0;
    if (delay === 60 && typeof handler === 'function' && handler.name === 'enhanceGameDetail') {
      return nativeSetTimeout(handler, 0, ...args);
    }
    return nativeSetTimeout(handler, timeout, ...args);
  };
})();
