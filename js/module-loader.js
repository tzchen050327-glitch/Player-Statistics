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

  function setStartupStatus(message) {
    const el = document.getElementById('appUpdateStatus');
    if (el) el.textContent = message;
  }

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

      setStartupStatus('載入即時資料模組…');
      for (const path of beforeModules) await loadClassicScript(path);

      const order = await orderPromise;
      const modulePaths = order.map((name) => `./js/${name}`);
      preloadScripts([...modulePaths, ...afterModules]);

      for (let i = 0; i < modulePaths.length; i += 1) {
        setStartupStatus(`載入程式模組 ${i + 1}/${modulePaths.length}…`);
        await loadClassicScript(modulePaths[i]);
      }

      setStartupStatus('載入介面擴充模組…');
      for (const path of afterModules) await loadClassicScript(path);
    } catch (error) {
      console.error('[module-loader] app boot failed', error);
      setStartupStatus(`啟動失敗：${error?.message || error}`);
      document.documentElement.dataset.moduleBootFailed = 'true';
    }
  }

  bootModularApp();
})();
