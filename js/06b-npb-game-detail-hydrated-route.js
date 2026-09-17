(() => {
  const ORIGINAL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-game-detail';
  const HYDRATED = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-game-detail-hydrated';
  const nativeFetch = window.fetch.bind(window);

  window.fetch = function npbHydratedFetch(input, init) {
    try {
      const url = typeof input === 'string' ? input : String(input?.url || '');
      if (url === ORIGINAL) return nativeFetch(HYDRATED, init);
    } catch {}
    return nativeFetch(input, init);
  };
})();
