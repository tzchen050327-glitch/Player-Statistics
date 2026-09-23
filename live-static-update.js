(() => {
  const TARGET_ID = 'homeGameDetailBody';
  const nativeInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!nativeInnerHTML?.get || !nativeInnerHTML?.set) return;

  // Boot guard: the app must never wait for Service Worker registration.
  // Surface real runtime failures on the splash screen instead of freezing at 0%.
  const bootPercent = document.getElementById('appUpdatePercent');
  const bootStatus = document.getElementById('appUpdateStatus');
  const bootBar = document.getElementById('appUpdateBar');
  if (bootPercent) bootPercent.textContent = '3%';
  if (bootStatus) bootStatus.textContent = '正在載入主程式…';
  if (bootBar) bootBar.style.width = '3%';

  function showBootFailure(message) {
    const text = String(message || '未知錯誤').replace(/\s+/g, ' ').trim();
    if (bootPercent) bootPercent.textContent = '錯誤';
    if (bootStatus) bootStatus.textContent = `啟動錯誤：${text.slice(0, 180)}`;
    if (bootBar) bootBar.style.width = '100%';
  }

  window.addEventListener('error', event => {
    if (event?.message) showBootFailure(`${event.message}${event.lineno ? `（第 ${event.lineno} 行）` : ''}`);
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event?.reason;
    showBootFailure(reason?.message || reason || 'Promise rejected');
  });

  // v2.77 index.html and app.js drifted apart: the current HTML removed several
  // controls that app.js still binds synchronously during startup. Restore only
  // those controls before app.js executes so fresh browsers and cached browsers
  // use the same DOM contract.
  function ensureV271DomCompatibility() {
    const saveButton = document.getElementById('saveNewPlayerBtn');
    if (saveButton && !document.getElementById('createManualPlayerBtn')) {
      const actions = saveButton.closest('.section-actions');
      if (actions) {
        actions.innerHTML = `
          <button id="createManualPlayerBtn" class="press-btn">純新增</button>
          <button id="createCpblPlayerBtn" class="press-btn primary">搜尋中職資料</button>
          <button id="createExternalPlayerBtn" class="press-btn primary hidden">搜尋國外聯盟資料</button>`;
      }
    }

    const allDialog = document.getElementById('allPlayersDialog');
    if (allDialog && !document.getElementById('allSearchPlayerBtn')) {
      const head = allDialog.querySelector('.dialog-head');
      if (head) {
        const tools = document.createElement('div');
        tools.className = 'all-player-tools';
        tools.innerHTML = `
          <button id="allSearchPlayerBtn" class="press-btn">搜尋球員</button>
          <button id="batchReportBtn" class="press-btn primary">批量生成戰報</button>
          <button id="allDeletePlayerBtn" class="press-btn danger">刪除球員</button>`;
        head.insertAdjacentElement('afterend', tools);
      }
    }
  }

  ensureV271DomCompatibility();

  // Service Worker registration is owned by the bootstrap/update flow.
  // Keep the recovery path below only for genuinely stuck boots.

  const BOOT_RECOVERY_KEY = 'baseballBootRecoveryV271';
  const bootRecoveryTimer = window.setTimeout(async () => {
    const percent = String(document.getElementById('appUpdatePercent')?.textContent || '').trim();
    const status = String(document.getElementById('appUpdateStatus')?.textContent || '').trim();
    const stuck = percent === '0%' && (!status || /準備中/.test(status));
    if (!stuck || sessionStorage.getItem(BOOT_RECOVERY_KEY) === '1') return;

    sessionStorage.setItem(BOOT_RECOVERY_KEY, '1');
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      if (Array.isArray(regs)) await Promise.allSettled(regs.map(reg => reg.unregister()));
    } catch {}
    try {
      const keys = await caches.keys();
      await Promise.allSettled(keys
        .filter(key => key.startsWith('baseball-player-card-pwa-'))
        .map(key => caches.delete(key)));
    } catch {}

    const url = new URL(location.href);
    url.searchParams.set('__boot_recovery', Date.now().toString());
    location.replace(url.href);
  }, 6000);

  window.addEventListener('load', () => {
    window.setTimeout(() => {
      const percent = String(document.getElementById('appUpdatePercent')?.textContent || '').trim();
      if (percent !== '0%') window.clearTimeout(bootRecoveryTimer);
    }, 250);
  }, { once: true });

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
