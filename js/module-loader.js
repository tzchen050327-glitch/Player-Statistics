(() => {
  'use strict';

  const metaVersion = document.querySelector('meta[name="app-version"]')?.getAttribute('content')?.trim() || '';
  const versioned = (path) => {
    if (!metaVersion) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}v=${encodeURIComponent(metaVersion)}`;
  };

  const beforeModules = [
    './live-static-update.js',
    './cpbl-realtime.js',
    './npb-realtime.js'
  ];

  const afterModules = [
    './postseason-history.js',
    './cpbl-cache-router.js',
    './game-detail-enhancement.js',
    './report-layout.js'
  ];

  let bootProgressFloor = 3;
  let bootProgressGuardActive = true;

  const progressEls = () => ({
    percent: document.getElementById('appUpdatePercent'),
    status: document.getElementById('appUpdateStatus'),
    bar: document.getElementById('appUpdateBar')
  });

  function numericPercent(value) {
    const match = String(value || '').match(/(\d+(?:\.\d+)?)\s*%?/);
    return match ? Number(match[1]) : NaN;
  }

  function setStartupProgress(percent, message = '') {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    bootProgressFloor = Math.max(bootProgressFloor, value);
    const els = progressEls();
    if (els.percent) els.percent.textContent = `${bootProgressFloor}%`;
    if (els.status && message) els.status.textContent = message;
    if (els.bar) els.bar.style.width = `${bootProgressFloor}%`;
  }

  function setStartupStatus(message) {
    const el = document.getElementById('appUpdateStatus');
    if (el) el.textContent = message;
  }

  function phasePercent(start, end, index, count) {
    if (!count) return end;
    return Math.round(start + ((index + 1) / count) * (end - start));
  }

  // During first boot, older startup/update code may report a lower percentage
  // after the modular loader has already advanced farther. Keep the splash
  // monotonic so it never visually jumps backwards.
  const progressObserver = new MutationObserver(() => {
    if (!bootProgressGuardActive) return;
    const els = progressEls();
    const shown = numericPercent(els.percent?.textContent);
    if (Number.isFinite(shown)) {
      if (shown < bootProgressFloor) {
        if (els.percent) els.percent.textContent = `${bootProgressFloor}%`;
        if (els.bar) els.bar.style.width = `${bootProgressFloor}%`;
      } else {
        bootProgressFloor = shown;
      }
      if (shown >= 100) {
        bootProgressGuardActive = false;
        progressObserver.disconnect();
        return;
      }
    }

    const width = numericPercent(els.bar?.style?.width);
    if (Number.isFinite(width) && width < bootProgressFloor && els.bar) {
      els.bar.style.width = `${bootProgressFloor}%`;
    }
  });

  const initialEls = progressEls();
  if (initialEls.percent) progressObserver.observe(initialEls.percent, { childList:true, characterData:true, subtree:true });
  if (initialEls.bar) progressObserver.observe(initialEls.bar, { attributes:true, attributeFilter:['style'] });
  // Safety valve: the guard exists only for the initial splash, never forever.
  window.setTimeout(() => {
    if (!bootProgressGuardActive) return;
    bootProgressGuardActive = false;
    progressObserver.disconnect();
  }, 45000);

  function preloadScripts(paths) {
    for (const path of paths) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = versioned(path);
      document.head.appendChild(link);
    }
  }

  function loadClassicScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = versioned(path);
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`載入失敗：${path}`));
      document.body.appendChild(script);
    });
  }

  async function loadModuleOrder() {
    const response = await fetch(versioned('./js/module-order.txt'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`無法讀取 module-order.txt (${response.status})`);
    const text = await response.text();
    const order = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!order.length) throw new Error('module-order.txt 是空的');
    return order;
  }

  async function bootModularApp() {
    try {
      const orderPromise = loadModuleOrder();
      preloadScripts(beforeModules);

      for (let i = 0; i < beforeModules.length; i += 1) {
        setStartupStatus(`載入即時資料模組 ${i + 1}/${beforeModules.length}…`);
        await loadClassicScript(beforeModules[i]);
        setStartupProgress(
          phasePercent(3, 7, i, beforeModules.length),
          `即時資料模組 ${i + 1}/${beforeModules.length} 已載入`
        );
      }

      const order = await orderPromise;
      const modulePaths = order.map((name) => `./js/${name}`);
      preloadScripts([...modulePaths, ...afterModules]);

      for (let i = 0; i < modulePaths.length; i += 1) {
        const name = order[i];
        setStartupStatus(`載入程式模組 ${i + 1}/${modulePaths.length} · ${name}`);
        await loadClassicScript(modulePaths[i]);
        setStartupProgress(
          phasePercent(7, 76, i, modulePaths.length),
          `程式模組 ${i + 1}/${modulePaths.length} · ${name}`
        );
      }

      for (let i = 0; i < afterModules.length; i += 1) {
        const name = afterModules[i].split('/').pop();
        setStartupStatus(`載入介面擴充 ${i + 1}/${afterModules.length} · ${name}`);
        await loadClassicScript(afterModules[i]);
        setStartupProgress(
          phasePercent(76, 80, i, afterModules.length),
          `介面擴充 ${i + 1}/${afterModules.length} · ${name}`
        );
      }

      setStartupProgress(80, '程式模組載入完成，正在初始化資料…');
    } catch (error) {
      console.error('[module-loader] app boot failed', error);
      setStartupStatus(`啟動失敗：${error?.message || error}`);
      document.documentElement.dataset.moduleBootFailed = 'true';
    }
  }

  bootModularApp();
})();
