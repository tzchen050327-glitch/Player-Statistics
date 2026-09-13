(() => {
  const TARGET_ID = 'homeGameDetailBody';
  const nativeInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!nativeInnerHTML?.get || !nativeInnerHTML?.set) return;

  const LISTENER_RESET_IDS = new Set([
    'homeGameDetailBack',
    'homeGameDetailRetry',
    'homeGameDetailPregameRefresh'
  ]);

  function isProtected(node) {
    return node?.nodeType === 1 && (
      node.classList?.contains('game-detail-enhanced-marker') ||
      [...(node.classList || [])].some(name => name.startsWith('gdx-'))
    );
  }

  function baseTeamSignature(root) {
    const row = root?.querySelector?.('.game-detail-score-card .game-detail-score-row');
    if (!row) return '';
    const teams = [...row.querySelectorAll(':scope > div > span')]
      .map(el => String(el.textContent || '').trim())
      .filter(Boolean);
    return teams.length >= 2 ? teams.slice(0, 2).join('|') : '';
  }

  function gameIdentity(root) {
    if (!root?.querySelector) return '';
    const league = String(root.querySelector('.game-detail-head-copy strong')?.textContent || '').trim();
    const meta = String(root.querySelector('.game-detail-head-copy span')?.textContent || '').trim();
    const teams = baseTeamSignature(root);
    if (!teams) return '';
    return [league, meta, teams].join('|');
  }

  function enhancedTeamSignature(root) {
    const teams = [...(root?.querySelectorAll?.('.gdx-landscape-team-head strong') || [])]
      .map(el => String(el.textContent || '').trim())
      .filter(Boolean);
    return teams.length >= 2 ? teams.slice(0, 2).join('|') : '';
  }

  function clearEnhancedNodes(target) {
    target?.querySelectorAll?.('.game-detail-enhanced-marker, [data-gdx]')?.forEach(node => node.remove());
    if (target?.dataset) delete target.dataset.gdxStamp;
  }

  function purgeMismatchedEnhanced(target) {
    const base = baseTeamSignature(target);
    const enhanced = enhancedTeamSignature(target);
    if (base && enhanced && base !== enhanced) {
      clearEnhancedNodes(target);
      return true;
    }
    return false;
  }

  function elementKey(node) {
    if (!node || node.nodeType !== 1) return '';
    if (node.id) return `#${node.id}`;
    const tag = node.tagName;
    if (tag === 'DETAILS' && node.classList.contains('game-detail-inning')) {
      const summary = node.querySelector(':scope > summary');
      const label = summary?.childNodes?.[0]?.textContent?.trim() || summary?.textContent?.trim() || '';
      return `DETAILS:${label}`;
    }
    const stableClass = [...node.classList].find(name =>
      name.startsWith('game-detail-') || name.startsWith('home-game-')
    );
    return stableClass ? `${tag}.${stableClass}` : tag;
  }

  function canMorph(a, b) {
    if (!a || !b || a.nodeType !== b.nodeType) return false;
    if (a.nodeType === Node.TEXT_NODE || a.nodeType === Node.COMMENT_NODE) return true;
    if (a.nodeType !== Node.ELEMENT_NODE) return true;
    if (a.tagName !== b.tagName) return false;
    if (a.id || b.id) return a.id === b.id;
    const ak = elementKey(a);
    const bk = elementKey(b);
    return !ak || !bk || ak === bk;
  }

  function syncAttributes(current, next) {
    const preserveDetailsOpen = current.tagName === 'DETAILS' ? current.open : null;
    for (const attr of [...current.attributes]) {
      if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    }
    for (const attr of [...next.attributes]) {
      if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    }
    if (preserveDetailsOpen !== null) current.open = preserveDetailsOpen;
  }

  function morphNode(current, next) {
    if (!canMorph(current, next)) {
      current.replaceWith(next.cloneNode(true));
      return;
    }
    if (current.nodeType === Node.TEXT_NODE || current.nodeType === Node.COMMENT_NODE) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      return;
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return;

    if (current.id && LISTENER_RESET_IDS.has(current.id)) {
      current.replaceWith(next.cloneNode(true));
      return;
    }

    syncAttributes(current, next);
    morphChildren(current, next);
  }

  function morphChildren(currentParent, nextParent) {
    const currentManaged = [...currentParent.childNodes].filter(node => !isProtected(node));
    const nextManaged = [...nextParent.childNodes].filter(node => !isProtected(node));
    const used = new Set();

    for (let i = 0; i < nextManaged.length; i++) {
      const desired = nextManaged[i];
      let current = currentManaged[i];

      if (!current || used.has(current) || !canMorph(current, desired)) {
        current = currentManaged.find((candidate, index) =>
          index >= i && !used.has(candidate) && canMorph(candidate, desired)
        );
      }

      if (!current) {
        const clone = desired.cloneNode(true);
        const nextAnchor = currentManaged.slice(i).find(node => !used.has(node) && node.parentNode === currentParent);
        if (nextAnchor) currentParent.insertBefore(clone, nextAnchor);
        else currentParent.appendChild(clone);
        used.add(clone);
        continue;
      }

      used.add(current);
      morphNode(current, desired);
    }

    for (const node of currentManaged) {
      if (!used.has(node) && node.parentNode === currentParent) node.remove();
    }
  }

  function staticPatch(target, html) {
    const sourceHtml = String(html ?? '');
    const template = document.createElement('template');
    nativeInnerHTML.set.call(template, sourceHtml);

    const currentIdentity = gameIdentity(target);
    const nextIdentity = gameIdentity(template.content);

    // Static patching is only safe while refreshing the exact same game.
    // When league/date/venue/teams change, rebuild the body once so no DOM
    // from a previously opened game can survive into the next game.
    if (currentIdentity && nextIdentity && currentIdentity !== nextIdentity) {
      nativeInnerHTML.set.call(target, sourceHtml);
      if (target.dataset) delete target.dataset.gdxStamp;
      const page = target.closest('.home-game-detail-page');
      const overlay = target.closest('.home-game-detail-overlay');
      if (page) { page.scrollTop = 0; page.scrollLeft = 0; }
      else if (overlay) { overlay.scrollTop = 0; overlay.scrollLeft = 0; }
      return;
    }

    const page = target.closest('.home-game-detail-page');
    const overlay = target.closest('.home-game-detail-overlay');
    const scrollTop = page?.scrollTop ?? overlay?.scrollTop ?? 0;
    const scrollLeft = page?.scrollLeft ?? overlay?.scrollLeft ?? 0;

    target.classList.add('is-static-patching');
    morphChildren(target, template.content);
    purgeMismatchedEnhanced(target);
    target.classList.remove('is-static-patching');

    if (page) {
      page.scrollTop = scrollTop;
      page.scrollLeft = scrollLeft;
    } else if (overlay) {
      overlay.scrollTop = scrollTop;
      overlay.scrollLeft = scrollLeft;
    }
  }

  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: nativeInnerHTML.configurable,
    enumerable: nativeInnerHTML.enumerable,
    get() {
      return nativeInnerHTML.get.call(this);
    },
    set(value) {
      if (this?.id === TARGET_ID && this.childNodes.length > 0) {
        try {
          staticPatch(this, value);
          return;
        } catch (error) {
          console.warn('Static live patch fallback', error);
        }
      }
      nativeInnerHTML.set.call(this, value);
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    #homeGameDetailBody.is-static-patching,
    #homeGameDetailBody.is-static-patching * {
      transition: none !important;
    }
  `;
  document.head.appendChild(style);
})();
