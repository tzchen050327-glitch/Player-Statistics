(() => {
  const REPORT_LAYOUT_VERSION = 'v2.77';

  function ensureFieldOverlay(root = document) {
    const cards = root.querySelectorAll?.('.gdx-field-card') || [];
    for (const card of cards) {
      const shape = card.querySelector('.gdx-field-shape');
      if (!shape) continue;

      let layer = card.querySelector(':scope > .gdx-fielders-layer');
      const fielders = [...shape.querySelectorAll(':scope > .gdx-fielder')];
      if (!fielders.length) continue;

      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'gdx-fielders-layer';
        layer.dataset.reportLayoutVersion = REPORT_LAYOUT_VERSION;
        shape.insertAdjacentElement('afterend', layer);
      }

      for (const fielder of fielders) layer.appendChild(fielder);
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      ensureFieldOverlay(document);
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.('.gdx-field-card, .gdx-field-shape, .gdx-landscape-board') ||
            node.querySelector?.('.gdx-field-card, .gdx-field-shape, .gdx-landscape-board')) {
          schedule();
          return;
        }
      }
    }
  });

  function start() {
    ensureFieldOverlay(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

// Homepage live-game badge: prefer the current inning/half over the generic "比賽中" label.
(() => {
  if (typeof homeDailyGameStatusLabel !== 'function') return;
  const fallbackStatusLabel = homeDailyGameStatusLabel;

  function normalizeInningLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(上|表|초|top)$/i);
    if (m) return `${m[1]}局上`;
    m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(下|裏|말|bottom)$/i);
    if (m) return `${m[1]}局下`;
    m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(?:上半|top\s*half)$/i);
    if (m) return `${m[1]}局上`;
    m = raw.match(/^(\d+)\s*(?:局|回|회)?\s*(?:下半|bottom\s*half)$/i);
    if (m) return `${m[1]}局下`;
    return raw;
  }

  homeDailyGameStatusLabel = function(game) {
    const status = String(game?.status || '').toLowerCase();
    if (status === 'live') {
      const inning = normalizeInningLabel(game?.inningLabel);
      if (inning) return inning;
    }
    return fallbackStatusLabel(game);
  };

  // app.js may have rendered the first frame before this late-loaded enhancement runs.
  if (typeof renderHomeDailyGames === 'function') {
    queueMicrotask(() => {
      try { renderHomeDailyGames({ force:false }); } catch {}
    });
  }
})();
