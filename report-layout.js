(() => {
  const REPORT_LAYOUT_VERSION = 'v2.59';

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
