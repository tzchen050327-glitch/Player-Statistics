    async function init() {
      try {
        db = await openDB();
        players = await idbGetAll(STORES.players);
        photos = await idbGetAll(STORES.photos);
        for (const player of players) {
          ensurePhotoTransforms(player);
          const fixedName = applyStoredPreferredExternalName(player);
          const fixedTeam = applyStoredPreferredExternalTeam(player);
          const fixedExternalRole = repairStoredExternalPlayerType(player);
          const fixedCpblRole = repairStoredCpblPlayerType(player);
          if (fixedName || fixedTeam || fixedExternalRole || fixedCpblRole) await idbPut(STORES.players, player);
        }
        for (const photo of photos) {
          if (!photo.playerId) {
            const owner = players.find(player => player.selectedPhotoId === photo.id);
            if (owner) {
              photo.playerId = owner.id;
              await idbPut(STORES.photos, photo);
            }
          }
        }
        els.gameDate.value = localISODate();
        syncAppPickerLabels();
        selectedTab = localStorage.getItem('baseballSelectedTab') || 'base';
        if (!['base', 'minor', 'secondary', 'today', 'photos'].includes(selectedTab)) selectedTab = 'base';
        currentPage = 'home';
        const savedPlayerId = localStorage.getItem('baseballSelectedPlayerId');
        selectedPlayerId = players.some(p => p.id === savedPlayerId) ? savedPlayerId : (players[0]?.id || null);

        // 先完成本機資料載入；CPBL 目前軍別改成背景更新，不能卡住啟動。
        selectedLevel = 'A';
        if (selectedPlayerId) {
          const player = selectedPlayer();
          selectedSeason = availableSeasonYears(player, 'A')[0] || CURRENT_YEAR;
          if (playerScope(player) === 'cpbl' || supportsLeagueLevelTabs(player)) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }
          await savePlayer(player);
          await loadRecord();
        }
        renderAll();
      } catch (error) {
        console.error(error);
        setStatus('無法開啟瀏覽器資料庫。', true);
      }
    }


    let serviceWorkerRegistration = null;
    let appRefreshing = false;
    let appUpdateProgressVisible = false;

    function setVersionBadge(text = APP_VERSION, checking = false) {
      const badge = document.getElementById('appVersionBadge');
      if (!badge) return;
      badge.textContent = text;
      badge.classList.toggle('checking', checking);
    }

    function setAppUpdateProgress(percent, status, { error = false } = {}) {
      const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      appUpdateProgressVisible = true;
      els.appUpdateOverlay?.classList.remove('hidden');
      els.appUpdateCard?.classList.toggle('error', Boolean(error));
      if (els.appUpdatePercent) els.appUpdatePercent.textContent = `${value}%`;
      if (els.appUpdateStatus) els.appUpdateStatus.textContent = status || '';
      if (els.appUpdateBar) els.appUpdateBar.style.width = `${value}%`;
    }

    function hideAppUpdateProgress() {
      appUpdateProgressVisible = false;
      els.appUpdateOverlay?.classList.add('hidden');
      els.appUpdateCard?.classList.remove('error');
    }

    async function appUpdateStep(percent, status, delay = 110) {
      setAppUpdateProgress(percent, status);
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    }

    async function finishAppUpdateProgress(status, { keepOpen = false } = {}) {
      setAppUpdateProgress(100, status);
      if (keepOpen) return;
      await new Promise(resolve => setTimeout(resolve, 520));
      hideAppUpdateProgress();
    }

    function waitForWorkerSettle(worker, timeout = 9000) {
      return new Promise(resolve => {
        if (!worker || ['installed','activated','redundant'].includes(worker.state)) {
          resolve(worker?.state || 'none');
          return;
        }

        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          worker.removeEventListener('statechange', onState);
          resolve(worker.state);
        };
        const onState = () => {
          if (['installed','activated','redundant'].includes(worker.state)) done();
        };
        worker.addEventListener('statechange', onState);
        setTimeout(done, timeout);
      });
    }

    async function activateWaitingWorker(registration) {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      return false;
    }

    async function checkAppUpdate({ manual = false, showProgress = false, keepProgressOpen = false } = {}) {
      if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
        if (showProgress) {
          await appUpdateStep(0, '準備檢查更新…', 80);
          await finishAppUpdateProgress('本機檔案模式，不需檢查更新', { keepOpen: keepProgressOpen });
        }
        if (manual) {
          setStatus('目前是本機檔案模式；自動更新需要用 HTTPS 網址／PWA 開啟。', true);
        }
        return { activated:false };
      }

      setVersionBadge(`${APP_VERSION} · 檢查中`, true);

      try {
        if (showProgress) await appUpdateStep(0, '準備檢查更新…', 90);
        if (showProgress) await appUpdateStep(15, `目前版本 ${APP_VERSION}`, 110);

        const reg = serviceWorkerRegistration
          || await navigator.serviceWorker.getRegistration()
          || await navigator.serviceWorker.register(SERVICE_WORKER_URL, { updateViaCache: 'none' });
        serviceWorkerRegistration = reg;

        if (showProgress) await appUpdateStep(32, '正在連線檢查新版…', 110);

        // 直接向線上 index.html 比對版本。這不依賴 service worker 檔案本身有沒有改動，
        // 可避免「網站已部署新版，但舊頁面一直停在舊 APP_VERSION」。
        try {
          const versionUrl = new URL('./index.html', location.href);
          versionUrl.searchParams.set('__version_check', Date.now().toString());
          const versionResponse = await fetch(versionUrl.href, { cache: 'no-store' });
          if (versionResponse.ok) {
            const remoteHtml = await versionResponse.text();
            const match = remoteHtml.match(/const APP_VERSION = '([^']+)'/);
            const remoteVersion = String(match?.[1] || '').trim();
            if (remoteVersion && remoteVersion !== APP_VERSION) {
              if (showProgress) setAppUpdateProgress(82, `找到新版 ${remoteVersion}，正在重新載入…`);
              if (manual) setStatus(`找到新版 ${remoteVersion}，正在重新載入…`);
              appRefreshing = true;
              sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');
              const reloadUrl = new URL(location.href);
              reloadUrl.searchParams.set('__app_version', remoteVersion);
              setTimeout(() => location.replace(reloadUrl.href), 120);
              return { activated:true, remoteVersion };
            }
          }
        } catch (versionError) {
          console.warn('線上版本比對失敗：', versionError);
        }

        await promiseTimeout(
          reg.update(),
          manual ? 8000 : 2500,
          '更新伺服器回應逾時'
        );

        if (showProgress) await appUpdateStep(55, '正在比對程式版本…', 100);

        const installing = reg.installing;
        if (installing) {
          if (showProgress) await appUpdateStep(70, '找到新版，正在下載…', 80);
          await waitForWorkerSettle(installing, manual ? 9000 : 3500);
        } else if (showProgress) {
          await appUpdateStep(72, '版本確認完成…', 100);
        }

        const activated = await activateWaitingWorker(reg);
        if (activated) {
          if (showProgress) setAppUpdateProgress(92, '正在套用新版…');
          if (manual) setStatus('找到新版，正在套用更新…');
          return { activated:true };
        }

        if (showProgress) {
          await appUpdateStep(90, '正在整理程式快取…', 100);
          if (keepProgressOpen) {
            setAppUpdateProgress(86, '更新檢查完成，正在載入球員資料…');
          } else {
            await finishAppUpdateProgress('目前已是最新版本');
          }
        }
        return { activated:false };
      } catch (error) {
        console.error('更新檢查失敗：', error);
        if (showProgress) {
          if (keepProgressOpen) {
            setAppUpdateProgress(82, '更新檢查失敗，正在載入目前資料…', { error: true });
          } else {
            setAppUpdateProgress(100, '更新檢查失敗，使用目前版本', { error: true });
            await new Promise(resolve => setTimeout(resolve, 950));
            hideAppUpdateProgress();
          }
        }
        if (manual) setStatus('檢查更新失敗，請確認網路後再試。', true);
        return { activated:false };
      } finally {
        if (!appRefreshing) {
          setTimeout(() => setVersionBadge(APP_VERSION, false), 500);
        }
      }
    }

    async function setupAppUpdate() {
      const badge = document.getElementById('appVersionBadge');
      if (badge) {
        badge.textContent = APP_VERSION;
        badge.addEventListener('click', () => checkAppUpdate({ manual: true, showProgress: true }));
      }

      const skipStartupSplash = sessionStorage.getItem('baseballSkipStartupSplashOnce') === '1';
      if (skipStartupSplash) sessionStorage.removeItem('baseballSkipStartupSplashOnce');

      if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
        if (!skipStartupSplash) {
          await checkAppUpdate({ showProgress: true, keepProgressOpen: true });
        } else {
          setAppUpdateProgress(86, '正在載入球員資料…');
        }
        return false;
      }

      try {
        const reg = await promiseTimeout(
          navigator.serviceWorker.register(SERVICE_WORKER_URL, {
            updateViaCache: 'none'
          }),
          2500,
          'Service Worker 註冊逾時'
        );
        serviceWorkerRegistration = reg;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (appRefreshing) return;
          appRefreshing = true;
          sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');

          if (appUpdateProgressVisible) {
            setAppUpdateProgress(100, '新版已就緒，正在重新開啟…');
            setTimeout(() => location.reload(), 280);
          } else {
            location.reload();
          }
        });

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          if (appUpdateProgressVisible) setAppUpdateProgress(68, '找到新版，正在下載…');

          worker.addEventListener('statechange', async () => {
            if (appUpdateProgressVisible && worker.state === 'installed') {
              setAppUpdateProgress(88, '新版下載完成，正在套用…');
            }
          });
        });

        let updateResult = { activated:false };
        if (!skipStartupSplash) {
          updateResult = await checkAppUpdate({ showProgress: true, keepProgressOpen: true });
        } else {
          setAppUpdateProgress(86, '新版已套用，正在載入球員資料…');
        }

        setInterval(() => checkAppUpdate(), 15 * 60 * 1000);

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkAppUpdate();
        });

        if (updateResult?.activated) {
          // controllerchange 正常會立刻重新載入；留一個 fallback 避免瀏覽器漏事件。
          setTimeout(() => {
            if (appRefreshing) return;
            appRefreshing = true;
            sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');
            location.reload();
          }, 1300);
          return true;
        }

        return appRefreshing;
      } catch (error) {
        console.error('Service Worker 設定失敗：', error);
        setAppUpdateProgress(82, '更新檢查失敗，正在載入目前資料…', { error: true });
        return false;
      }
    }

    async function bootApp() {
      // 本機資料和更新檢查同時跑；首頁顯示前再確認一次所有已連結球員目前軍別。
      const initPromise = init();
      const updatePromise = setupAppUpdate();

      const willReloadForUpdate = await updatePromise;
      if (willReloadForUpdate) return;

      setAppUpdateProgress(88, '正在準備球員資料…');
      await initPromise;

      setAppUpdateProgress(94, '正在確認球員目前一軍／二軍狀態…');
      await refreshCurrentRosterStatus();
      renderAll();

      setAppUpdateProgress(100, '資料已準備完成');
      await new Promise(resolve => setTimeout(resolve, 220));
      hideAppUpdateProgress();
    }

    bootApp();
  
