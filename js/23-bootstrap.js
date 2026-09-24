    async function init() {
      let stage = '開啟瀏覽器資料庫';
      const reportStartupError = (error, currentStage = stage) => {
        const message = error?.message || String(error || '未知錯誤');
        console.error(`[startup:${currentStage}]`, error);
        try {
          window.__siteDiagnostics?.log?.('startup-init-error', {
            message,
            extra:`stage=${currentStage}; name=${error?.name || ''}`
          });
        } catch {}
        return message;
      };

      try {
        db = await openDB();
      } catch (error) {
        const message = reportStartupError(error, stage);
        const detail = error?.name ? `（${error.name}）` : '';
        setStatus(`無法開啟瀏覽器資料庫${detail}。\n${message}`, true);
        return;
      }

      try {
        stage = '讀取本機球員資料';
        players = await idbGetAll(STORES.players);
        photos = await idbGetAll(STORES.photos);

        const deferCloudSync = typeof cloudSyncInitialMerge === 'function' && (players.length > 0 || photos.length > 0);
        if (typeof cloudSyncInitialMerge === 'function' && !deferCloudSync) {
          stage = '首次雲端同步';
          try {
            // Cloud sync failure must not masquerade as an IndexedDB failure.
            await cloudSyncInitialMerge();
          } catch (error) {
            reportStartupError(error, stage);
            console.warn('首次雲端同步失敗，先以本機空資料啟動', error);
          }
        }

        stage = '修復本機球員資料';
        for (const player of players) {
          try {
            ensurePhotoTransforms(player);
            const fixedName = applyStoredPreferredExternalName(player);
            const fixedTeam = applyStoredPreferredExternalTeam(player);
            const fixedExternalRole = repairStoredExternalPlayerType(player);
            const fixedCpblRole = repairStoredCpblPlayerType(player);
            if (fixedName || fixedTeam || fixedExternalRole || fixedCpblRole) await idbPut(STORES.players, player);
          } catch (error) {
            reportStartupError(error, `修復球員資料：${player?.name || player?.id || 'unknown'}`);
          }
        }

        stage = '修復照片資料';
        for (const photo of photos) {
          if (!photo.playerId) {
            const owner = players.find(player => player.selectedPhotoId === photo.id);
            if (owner) {
              try {
                photo.playerId = owner.id;
                await idbPut(STORES.photos, photo);
              } catch (error) {
                reportStartupError(error, `修復照片資料：${photo?.id || 'unknown'}`);
              }
            }
          }
        }

        stage = '初始化首頁狀態';
        els.gameDate.value = localISODate();
        syncAppPickerLabels();
        selectedTab = localStorage.getItem('baseballSelectedTab') || 'base';
        if (!['base', 'minor', 'secondary', 'today', 'photos'].includes(selectedTab)) selectedTab = 'base';
        currentPage = 'home';
        const savedPlayerId = localStorage.getItem('baseballSelectedPlayerId');
        selectedPlayerId = players.some(p => p.id === savedPlayerId) ? savedPlayerId : (players[0]?.id || null);

        selectedLevel = 'A';
        if (selectedPlayerId) {
          stage = '初始化目前球員';
          const player = selectedPlayer();
          selectedSeason = availableSeasonYears(player, 'A')[0] || CURRENT_YEAR;
          if (playerScope(player) === 'cpbl' || supportsLeagueLevelTabs(player)) {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }

          try {
            await savePlayer(player);
          } catch (error) {
            reportStartupError(error, '儲存目前球員狀態');
          }

          stage = '讀取今日紀錄';
          try {
            await loadRecord();
          } catch (error) {
            reportStartupError(error, stage);
            currentRecord = defaultGameRecord(player);
          }
        }

        stage = '渲染主畫面';
        renderAll();

        if (deferCloudSync) {
          void cloudSyncInitialMerge().catch(error => {
            reportStartupError(error, '背景雲端同步');
            console.warn('背景雲端同步失敗，沿用本機資料', error);
          });
        }
      } catch (error) {
        const message = reportStartupError(error, stage);
        setStatus(`啟動失敗（${stage}）。\n${message}`, true);
      }
    }


    let serviceWorkerRegistration = null;
    let appRefreshing = false;
    let appUpdateProgressVisible = false;
    let suppressStartupSplash = false;
    let suppressNextControllerReload = false;

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

    function parseAppVersion(value) {
      const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/i);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
    }

    function isRemoteVersionNewer(remote, current = APP_VERSION) {
      const r = parseAppVersion(remote);
      const c = parseAppVersion(current);
      if (!r || !c) return false;
      for (let i = 0; i < 3; i += 1) {
        if (r[i] > c[i]) return true;
        if (r[i] < c[i]) return false;
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

        // 先讀取獨立 version.json，再以 index.html 作相容 fallback。
        try {
          const markerUrl = new URL('./version.json', location.href);
          markerUrl.searchParams.set('__version_check', Date.now().toString());
          const markerResponse = await fetch(markerUrl.href, { cache: 'no-store' });
          if (markerResponse.ok) {
            const marker = await markerResponse.json().catch(() => ({}));
            const remoteVersion = String(marker?.version || '').trim();
            if (remoteVersion && isRemoteVersionNewer(remoteVersion)) {
              if (showProgress) setAppUpdateProgress(82, `找到新版 ${remoteVersion}，正在重新載入…`);
              if (manual) setStatus(`找到新版 ${remoteVersion}，正在重新載入…`);
              appRefreshing = true;
              sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');
              sessionStorage.setItem('baseballSkipControllerReloadOnce', '1');
              const reloadUrl = new URL('./index.html', location.href);
              reloadUrl.searchParams.set('v', remoteVersion);
              reloadUrl.searchParams.set('__app_version', remoteVersion);
              setTimeout(() => location.replace(reloadUrl.href), 120);
              return { activated:true, remoteVersion };
            }
          }
        } catch (markerError) {
          console.warn('版本標記讀取失敗：', markerError);
        }

        // 再向線上 index.html 比對版本，避免舊部署沒有 version.json 時失去更新能力。
        try {
          const versionUrl = new URL('./index.html', location.href);
          versionUrl.searchParams.set('__version_check', Date.now().toString());
          const versionResponse = await fetch(versionUrl.href, { cache: 'no-store' });
          if (versionResponse.ok) {
            const remoteHtml = await versionResponse.text();
            const metaMatch = remoteHtml.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);
            const legacyMatch = remoteHtml.match(/const APP_VERSION = '([^']+)'/);
            const remoteVersion = String(metaMatch?.[1] || legacyMatch?.[1] || '').trim();
            if (remoteVersion && isRemoteVersionNewer(remoteVersion)) {
              if (showProgress) setAppUpdateProgress(82, `找到新版 ${remoteVersion}，正在重新載入…`);
              if (manual) setStatus(`找到新版 ${remoteVersion}，正在重新載入…`);
              appRefreshing = true;
              sessionStorage.setItem('baseballSkipStartupSplashOnce', '1');
              sessionStorage.setItem('baseballSkipControllerReloadOnce', '1');
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
      const skipControllerReload = sessionStorage.getItem('baseballSkipControllerReloadOnce') === '1';
      suppressStartupSplash = skipStartupSplash;
      suppressNextControllerReload = skipControllerReload;
      if (skipStartupSplash) {
        sessionStorage.removeItem('baseballSkipStartupSplashOnce');
        hideAppUpdateProgress();
      }
      if (skipControllerReload) {
        sessionStorage.removeItem('baseballSkipControllerReloadOnce');
      }

      if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
        if (!skipStartupSplash) {
          await checkAppUpdate({ showProgress: true, keepProgressOpen: true });
        } else {
          hideAppUpdateProgress();
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
          if (suppressNextControllerReload) {
            suppressNextControllerReload = false;
            return;
          }
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
          hideAppUpdateProgress();
        }

        setInterval(() => checkAppUpdate(), 15 * 60 * 1000);

        // v2.82: do not check/apply updates merely because the user returned
        // to this browser tab. Startup, manual version-badge checks, and the
        // existing 15-minute timer remain responsible for update checks.

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
        if (!suppressStartupSplash) {
          setAppUpdateProgress(82, '更新檢查失敗，正在載入目前資料…', { error: true });
        } else {
          hideAppUpdateProgress();
        }
        return false;
      }
    }

    async function bootApp() {
      // Local data and update checks run together. Slow roster refresh must not block first paint.
      const initPromise = init();
      const updatePromise = setupAppUpdate();

      const willReloadForUpdate = await updatePromise;
      if (willReloadForUpdate) return;

      if (suppressStartupSplash) {
        await initPromise;
        hideAppUpdateProgress();
        document.documentElement.classList.remove('skip-startup-splash-frame');
      } else {
        setAppUpdateProgress(88, '正在準備球員資料…');
        await initPromise;
        setAppUpdateProgress(100, '資料已準備完成');
        await new Promise(resolve => setTimeout(resolve, 120));
        hideAppUpdateProgress();
      }

      // Use the most recently cached CPBL level immediately, then refresh it in background.
      void refreshCurrentRosterStatus()
        .then(() => {
          if (currentPage === 'home') renderAll();
        })
        .catch(error => {
          console.warn('背景更新目前一軍／二軍狀態失敗', error);
        });
    }

    bootApp();
  
