    /* ---------- Optional shared cloud sync ---------- */
    const PLAYER_CLOUD_SYNC_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/player-cloud-sync';
    const CLOUD_SYNC_CREDENTIALS_KEY = 'baseballCloudSyncCredentialsV1';
    const CLOUD_SYNC_REVISION_PREFIX = 'baseballCloudSyncRevisionV1:';
    const CLOUD_SYNC_STORES = new Set([STORES.players, STORES.games, STORES.photos]);
    const CLOUD_SYNC_POLL_MS = 30 * 1000;

    let cloudSyncCredentials = null;
    let cloudSyncApplying = false;
    let cloudSyncBusy = false;
    let cloudSyncInitialDone = false;
    let cloudSyncPending = new Map();
    let cloudSyncFlushTimer = 0;
    let cloudSyncPollTimer = 0;
    let cloudSyncLastError = '';
    let cloudSyncLastSuccessAt = 0;

    function cloudSyncLoadCredentials() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CLOUD_SYNC_CREDENTIALS_KEY) || 'null');
        const code = String(parsed?.code || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
        const secret = String(parsed?.secret || '');
        if (!code || !secret) return null;
        return { code, secret, label: String(parsed?.label || '') };
      } catch {
        return null;
      }
    }

    function cloudSyncSaveCredentials(value) {
      cloudSyncCredentials = value?.code && value?.secret
        ? {
            code: String(value.code).toUpperCase().replace(/[^A-Z2-9]/g, ''),
            secret: String(value.secret),
            label: String(value.label || '')
          }
        : null;
      if (cloudSyncCredentials) {
        localStorage.setItem(CLOUD_SYNC_CREDENTIALS_KEY, JSON.stringify(cloudSyncCredentials));
      } else {
        localStorage.removeItem(CLOUD_SYNC_CREDENTIALS_KEY);
      }
      cloudSyncRefreshUi();
    }

    function cloudSyncRevisionKey(code = cloudSyncCredentials?.code || '') {
      return CLOUD_SYNC_REVISION_PREFIX + String(code || '');
    }

    function cloudSyncStoredRevision() {
      return Math.max(0, Number(localStorage.getItem(cloudSyncRevisionKey()) || 0) || 0);
    }

    function cloudSyncSetRevision(value) {
      if (!cloudSyncCredentials?.code) return;
      const revision = Math.max(0, Math.floor(Number(value) || 0));
      localStorage.setItem(cloudSyncRevisionKey(), String(revision));
    }

    cloudSyncCredentials = cloudSyncLoadCredentials();

    async function cloudSyncApi(action, extra = {}, timeout = 45000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const credentials = extra.credentials || cloudSyncCredentials;
        const body = { action, ...extra };
        delete body.credentials;
        if (action !== 'create-group') {
          if (!credentials?.code || !credentials?.secret) throw new Error('這台裝置尚未連接同步群組');
          body.code = credentials.code;
          body.secret = credentials.secret;
        }
        const response = await fetch(PLAYER_CLOUD_SYNC_API_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || `雲端同步失敗（${response.status}）`);
        }
        return data;
      } finally {
        clearTimeout(timer);
      }
    }

    function cloudSyncUpdatedAt(value) {
      return Math.max(
        0,
        Number(value?.updatedAt) || 0,
        Number(value?.updated_at) || 0,
        Number(value?.createdAt) || 0,
        Number(value?.created_at) || 0
      );
    }

    function cloudSyncRecordKey(storeName, value, fallback = '') {
      if (storeName === STORES.games) return String(value?.key || fallback || '');
      return String(value?.id || fallback || '');
    }

    function cloudSyncCloneJson(value) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return {};
      }
    }

    function cloudSyncQueueRecord(storeName, value, { deleted = false, key = '', updatedAt = 0 } = {}) {
      if (!cloudSyncCredentials || cloudSyncApplying || !CLOUD_SYNC_STORES.has(storeName)) return;
      const recordKey = String(key || cloudSyncRecordKey(storeName, value));
      if (!recordKey) return;
      const stamp = Math.max(1, Math.floor(Number(updatedAt) || cloudSyncUpdatedAt(value) || Date.now()));
      const mapKey = `${storeName}|${recordKey}`;
      const previous = cloudSyncPending.get(mapKey);
      if (previous && Number(previous.updatedAt || 0) > stamp) return;
      cloudSyncPending.set(mapKey, {
        store: storeName,
        key: recordKey,
        value: deleted ? null : value,
        deleted: Boolean(deleted),
        updatedAt: stamp
      });
      cloudSyncScheduleFlush();
    }

    function cloudSyncScheduleFlush(delay = 900) {
      if (!cloudSyncCredentials || cloudSyncApplying) return;
      if (cloudSyncFlushTimer) clearTimeout(cloudSyncFlushTimer);
      cloudSyncFlushTimer = setTimeout(() => {
        cloudSyncFlushTimer = 0;
        void cloudSyncFlushPending();
      }, Math.max(100, Number(delay) || 900));
    }

    function cloudSyncBlobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result || '');
          resolve(raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw);
        };
        reader.onerror = () => reject(reader.error || new Error('照片讀取失敗'));
        reader.readAsDataURL(blob);
      });
    }

    async function cloudSyncEncodedRecord(record) {
      if (record.deleted) {
        return {
          store: record.store,
          key: record.key,
          payload: {},
          deleted: true,
          updatedAt: record.updatedAt
        };
      }

      if (record.store !== STORES.photos) {
        return {
          store: record.store,
          key: record.key,
          payload: cloudSyncCloneJson(record.value),
          deleted: false,
          updatedAt: record.updatedAt
        };
      }

      const photo = record.value || {};
      const payload = {
        id: String(photo.id || record.key),
        playerId: String(photo.playerId || ''),
        name: String(photo.name || ''),
        createdAt: Number(photo.createdAt) || record.updatedAt,
        updatedAt: Number(photo.updatedAt) || Number(photo.createdAt) || record.updatedAt,
        mimeType: String(photo.blob?.type || photo.mimeType || 'image/jpeg'),
        size: Number(photo.blob?.size || photo.size || 0)
      };
      if (photo.blob instanceof Blob) {
        if (photo.blob.size > 15 * 1024 * 1024) {
          throw new Error(`照片「${payload.name || payload.id}」超過 15MB，其他資料已可同步，但這張照片無法上傳`);
        }
        payload.blobBase64 = await cloudSyncBlobToBase64(photo.blob);
      }
      return {
        store: record.store,
        key: record.key,
        payload,
        deleted: false,
        updatedAt: record.updatedAt
      };
    }

    async function cloudSyncPushRecords(records, { manual = false } = {}) {
      if (!cloudSyncCredentials || !records.length) return 0;
      let applied = 0;
      const normal = records.filter(r => r.store !== STORES.photos);
      const photoRecords = records.filter(r => r.store === STORES.photos);

      for (let i = 0; i < normal.length; i += 120) {
        const batch = [];
        for (const record of normal.slice(i, i + 120)) batch.push(await cloudSyncEncodedRecord(record));
        const result = await cloudSyncApi('push', { records: batch });
        applied += Number(result?.applied || 0);
        cloudSyncSetRevision(result?.revision);
      }

      // Photo requests are deliberately sent one at a time so a large image never makes
      // a normal player/game batch exceed the Edge Function body limit.
      for (const record of photoRecords) {
        const encoded = await cloudSyncEncodedRecord(record);
        const result = await cloudSyncApi('push', { records: [encoded] }, 90000);
        applied += Number(result?.applied || 0);
        cloudSyncSetRevision(result?.revision);
      }

      cloudSyncLastSuccessAt = Date.now();
      cloudSyncLastError = '';
      cloudSyncRefreshUi();
      if (manual && typeof setStatus === 'function') setStatus(`雲端同步完成${applied ? `（${applied} 筆更新）` : ''}。`);
      return applied;
    }

    async function cloudSyncFlushPending({ manual = false } = {}) {
      if (!cloudSyncCredentials || cloudSyncApplying || cloudSyncBusy || !cloudSyncPending.size) return 0;
      cloudSyncBusy = true;
      const snapshot = [...cloudSyncPending.values()];
      for (const item of snapshot) cloudSyncPending.delete(`${item.store}|${item.key}`);
      try {
        return await cloudSyncPushRecords(snapshot, { manual });
      } catch (error) {
        for (const item of snapshot) {
          const mapKey = `${item.store}|${item.key}`;
          const newer = cloudSyncPending.get(mapKey);
          if (!newer || Number(newer.updatedAt || 0) <= Number(item.updatedAt || 0)) cloudSyncPending.set(mapKey, item);
        }
        cloudSyncLastError = error?.message || String(error);
        cloudSyncRefreshUi();
        if (manual && typeof setStatus === 'function') setStatus(cloudSyncLastError, true);
        else console.warn('雲端同步上傳失敗：', error);
        return 0;
      } finally {
        cloudSyncBusy = false;
        if (cloudSyncPending.size) cloudSyncScheduleFlush(2500);
      }
    }

    const cloudSyncOriginalIdbPut = idbPut;
    const cloudSyncOriginalIdbDelete = idbDelete;

    idbPut = async function cloudAwareIdbPut(storeName, value) {
      const result = await cloudSyncOriginalIdbPut(storeName, value);
      if (!cloudSyncApplying) cloudSyncQueueRecord(storeName, value);
      return result;
    };

    idbDelete = async function cloudAwareIdbDelete(storeName, key) {
      const existing = CLOUD_SYNC_STORES.has(storeName) ? await idbGet(storeName, key).catch(() => null) : null;
      const result = await cloudSyncOriginalIdbDelete(storeName, key);
      if (!cloudSyncApplying && CLOUD_SYNC_STORES.has(storeName)) {
        cloudSyncQueueRecord(storeName, existing || {}, { deleted: true, key: String(key), updatedAt: Date.now() });
      }
      return result;
    };

    async function cloudSyncDownloadPhoto(record) {
      const meta = record?.payload && typeof record.payload === 'object' ? record.payload : {};
      const url = String(record?.downloadUrl || '');
      if (!url) return null;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`照片下載失敗（${response.status}）`);
      const blob = await response.blob();
      return {
        id: String(meta.id || record.key),
        playerId: String(meta.playerId || ''),
        name: String(meta.name || '同步照片'),
        createdAt: Number(meta.createdAt) || Number(record.updatedAt) || Date.now(),
        updatedAt: Number(meta.updatedAt) || Number(record.updatedAt) || Date.now(),
        blob
      };
    }

    function cloudSyncMapByKey(items, storeName) {
      const out = new Map();
      for (const item of items || []) {
        const key = cloudSyncRecordKey(storeName, item);
        if (key) out.set(key, item);
      }
      return out;
    }

    async function cloudSyncReloadMemory() {
      players = await idbGetAll(STORES.players);
      photos = await idbGetAll(STORES.photos);
      if (selectedPlayerId && !players.some(p => p.id === selectedPlayerId)) selectedPlayerId = players[0]?.id || null;
      if (!selectedPlayerId && players.length) selectedPlayerId = players[0].id;
      if (selectedPlayerId) localStorage.setItem('baseballSelectedPlayerId', selectedPlayerId);
      else localStorage.removeItem('baseballSelectedPlayerId');
      if (selectedPlayerId && typeof loadRecord === 'function' && els?.gameDate?.value) {
        try { await loadRecord(); } catch (error) { console.warn('同步後重新載入單場資料失敗', error); }
      }
      if (els?.gameDate?.value && typeof renderAll === 'function') renderAll();
    }

    async function cloudSyncMergeRemote(records, { uploadLocalOnly = true } = {}) {
      const remoteRecords = Array.isArray(records) ? records : [];
      const local = {
        [STORES.players]: await idbGetAll(STORES.players),
        [STORES.games]: await idbGetAll(STORES.games),
        [STORES.photos]: await idbGetAll(STORES.photos)
      };
      const localMaps = {
        [STORES.players]: cloudSyncMapByKey(local[STORES.players], STORES.players),
        [STORES.games]: cloudSyncMapByKey(local[STORES.games], STORES.games),
        [STORES.photos]: cloudSyncMapByKey(local[STORES.photos], STORES.photos)
      };
      const remoteKeys = new Set();
      const upload = [];
      let changedLocal = false;

      cloudSyncApplying = true;
      try {
        for (const remote of remoteRecords) {
          const store = String(remote?.store || '');
          const key = String(remote?.key || '');
          if (!CLOUD_SYNC_STORES.has(store) || !key) continue;
          remoteKeys.add(`${store}|${key}`);
          const localValue = localMaps[store].get(key) || null;
          const localStamp = cloudSyncUpdatedAt(localValue);
          const remoteStamp = Math.max(1, Number(remote?.updatedAt) || 0);

          if (localValue && localStamp > remoteStamp) {
            upload.push({ store, key, value: localValue, deleted: false, updatedAt: localStamp });
            continue;
          }

          if (remote?.deleted) {
            if (localValue) {
              await cloudSyncOriginalIdbDelete(store, key);
              localMaps[store].delete(key);
              changedLocal = true;
            }
            continue;
          }

          if (store === STORES.photos) {
            const currentSame = localValue && localStamp >= remoteStamp && localValue.blob instanceof Blob;
            if (!currentSame) {
              try {
                const photo = await cloudSyncDownloadPhoto(remote);
                if (photo) {
                  await cloudSyncOriginalIdbPut(store, photo);
                  localMaps[store].set(key, photo);
                  changedLocal = true;
                }
              } catch (error) {
                console.warn('同步照片下載失敗，稍後會重試：', error);
              }
            }
          } else {
            const payload = remote?.payload && typeof remote.payload === 'object' ? remote.payload : null;
            if (payload && (!localValue || remoteStamp >= localStamp)) {
              await cloudSyncOriginalIdbPut(store, payload);
              localMaps[store].set(key, payload);
              changedLocal = true;
            }
          }
        }

        if (uploadLocalOnly) {
          for (const store of CLOUD_SYNC_STORES) {
            for (const [key, value] of localMaps[store]) {
              if (remoteKeys.has(`${store}|${key}`)) continue;
              upload.push({
                store,
                key,
                value,
                deleted: false,
                updatedAt: Math.max(1, cloudSyncUpdatedAt(value) || Date.now())
              });
            }
          }
        }
      } finally {
        cloudSyncApplying = false;
      }

      if (changedLocal) await cloudSyncReloadMemory();
      if (upload.length) await cloudSyncPushRecords(upload);
      return { changedLocal, uploaded: upload.length };
    }

    async function cloudSyncPull({ manual = false, uploadLocalOnly = true } = {}) {
      if (!cloudSyncCredentials || cloudSyncBusy || !db) return null;
      cloudSyncBusy = true;
      try {
        await cloudSyncFlushPending();
        const result = await cloudSyncApi('pull', {});
        const revision = Math.max(0, Number(result?.group?.revision || 0));
        const previous = cloudSyncStoredRevision();
        // Even if the revision matches, a first load still has to merge because this browser's
        // IndexedDB may be empty while another linked browser already holds the same revision.
        if (!cloudSyncInitialDone || revision !== previous || manual) {
          await cloudSyncMergeRemote(result?.records || [], { uploadLocalOnly });
        }
        cloudSyncSetRevision(revision);
        cloudSyncLastSuccessAt = Date.now();
        cloudSyncLastError = '';
        cloudSyncInitialDone = true;
        cloudSyncRefreshUi();
        if (manual && typeof setStatus === 'function') setStatus('雲端資料已同步。');
        return result;
      } catch (error) {
        cloudSyncLastError = error?.message || String(error);
        cloudSyncRefreshUi();
        if (manual && typeof setStatus === 'function') setStatus(cloudSyncLastError, true);
        else console.warn('雲端同步下載失敗：', error);
        return null;
      } finally {
        cloudSyncBusy = false;
      }
    }

    async function cloudSyncFullPush({ manual = false } = {}) {
      if (!cloudSyncCredentials || !db) return;
      const allPlayers = await idbGetAll(STORES.players);
      const allGames = await idbGetAll(STORES.games);
      const allPhotos = await idbGetAll(STORES.photos);
      const records = [];
      for (const value of allPlayers) records.push({ store: STORES.players, key: String(value.id), value, deleted: false, updatedAt: Math.max(1, cloudSyncUpdatedAt(value) || Date.now()) });
      for (const value of allGames) records.push({ store: STORES.games, key: String(value.key), value, deleted: false, updatedAt: Math.max(1, cloudSyncUpdatedAt(value) || Date.now()) });
      for (const value of allPhotos) records.push({ store: STORES.photos, key: String(value.id), value, deleted: false, updatedAt: Math.max(1, cloudSyncUpdatedAt(value) || Date.now()) });
      await cloudSyncPushRecords(records, { manual });
    }

    function cloudSyncStartPolling() {
      if (cloudSyncPollTimer) return;
      cloudSyncPollTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && cloudSyncCredentials) void cloudSyncPull();
      }, CLOUD_SYNC_POLL_MS);
    }

    async function cloudSyncInitialMerge() {
      cloudSyncStartPolling();
      if (!cloudSyncCredentials || !db) {
        cloudSyncInitialDone = true;
        cloudSyncRefreshUi();
        return;
      }
      await cloudSyncPull({ uploadLocalOnly: true });
    }

    async function cloudSyncCreateGroup() {
      if (!db) throw new Error('本機資料庫尚未準備完成');
      const result = await cloudSyncApi('create-group', { label: '球員共用資料' });
      const credentials = {
        code: String(result?.group?.code || ''),
        secret: String(result?.secret || ''),
        label: String(result?.group?.label || '')
      };
      if (!credentials.code || !credentials.secret) throw new Error('同步群組建立失敗');
      cloudSyncSaveCredentials(credentials);
      cloudSyncSetRevision(result?.group?.revision || 0);
      cloudSyncInitialDone = true;
      await cloudSyncFullPush({ manual: true });
      cloudSyncRefreshUi();
      return credentials;
    }

    async function cloudSyncJoinGroup(code, secret) {
      if (!db) throw new Error('本機資料庫尚未準備完成');
      const credentials = {
        code: String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, ''),
        secret: String(secret || '').trim(),
        label: ''
      };
      if (!credentials.code || !credentials.secret) throw new Error('請輸入同步群組代碼與金鑰');
      const probe = await cloudSyncApi('probe', { credentials });
      credentials.label = String(probe?.group?.label || '');
      cloudSyncSaveCredentials(credentials);
      // Force this browser to merge the complete remote set once.
      localStorage.removeItem(cloudSyncRevisionKey(credentials.code));
      cloudSyncInitialDone = false;
      await cloudSyncPull({ manual: true, uploadLocalOnly: true });
      return credentials;
    }

    function cloudSyncDisconnect() {
      const oldCode = cloudSyncCredentials?.code || '';
      cloudSyncSaveCredentials(null);
      cloudSyncPending.clear();
      cloudSyncInitialDone = true;
      if (oldCode) localStorage.removeItem(CLOUD_SYNC_REVISION_PREFIX + oldCode);
      if (typeof setStatus === 'function') setStatus('這台裝置已解除雲端同步；本機球員資料仍保留。');
    }

    function cloudSyncConnectionText() {
      if (!cloudSyncCredentials) return '';
      return `球員資料同步\n群組代碼：${cloudSyncCredentials.code}\n同步金鑰：${cloudSyncCredentials.secret}`;
    }

    async function cloudSyncCopyConnection() {
      const text = cloudSyncConnectionText();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        if (typeof setStatus === 'function') setStatus('同步群組代碼與金鑰已複製。');
      } catch {
        window.prompt('請複製以下連接資訊：', text);
      }
    }

    function cloudSyncFormatTime(value) {
      const time = Number(value) || 0;
      if (!time) return '尚未同步';
      const d = new Date(time);
      if (Number.isNaN(d.getTime())) return '尚未同步';
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function cloudSyncEnsureUi() {
      const actions = document.getElementById('homeZoneSwitch');
      if (actions && !document.getElementById('cloudSyncBtn')) {
        const button = document.createElement('button');
        button.id = 'cloudSyncBtn';
        button.className = 'home-zone-btn';
        button.type = 'button';
        button.textContent = '雲端同步';
        button.addEventListener('click', () => {
          cloudSyncRefreshUi();
          document.getElementById('cloudSyncDialog')?.showModal();
        });
        actions.appendChild(button);
      }

      if (!document.getElementById('cloudSyncDialog')) {
        const dialog = document.createElement('dialog');
        dialog.id = 'cloudSyncDialog';
        dialog.innerHTML = `
          <div class="dialog-body" style="max-width:620px">
            <div class="dialog-head">
              <h2>球員資料雲端同步</h2>
              <button id="cloudSyncCloseBtn" class="press-btn dialog-close" type="button" aria-label="關閉">×</button>
            </div>
            <div id="cloudSyncConnectedPanel" class="hidden">
              <div class="panel" style="box-shadow:none;padding:14px;background:#f8fafc;margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
                  <div>
                    <div class="subtle">目前同步群組</div>
                    <strong id="cloudSyncCurrentCode" style="font-size:20px;letter-spacing:.08em"></strong>
                  </div>
                  <div id="cloudSyncStateText" class="subtle"></div>
                </div>
              </div>
              <div class="subtle" style="margin-bottom:12px">這台裝置的球員、比賽紀錄與自訂照片會和同一群組的其他裝置合併同步。修改後會自動上傳，開啟網頁及回到前景時也會自動抓取。</div>
              <div class="section-actions" style="flex-wrap:wrap">
                <button id="cloudSyncNowBtn" class="press-btn primary" type="button">立即同步</button>
                <button id="cloudSyncCopyBtn" class="press-btn" type="button">複製連接資訊</button>
                <button id="cloudSyncDisconnectBtn" class="press-btn danger" type="button">解除這台裝置</button>
              </div>
            </div>
            <div id="cloudSyncDisconnectedPanel">
              <div class="subtle" style="margin-bottom:14px">第一台裝置先「建立同步群組」；其他要共用資料的帳號／裝置，再輸入同一組群組代碼與同步金鑰。</div>
              <div class="section-actions" style="margin-bottom:18px">
                <button id="cloudSyncCreateBtn" class="press-btn primary" type="button">建立同步群組</button>
              </div>
              <div class="panel" style="box-shadow:none;padding:14px;background:#f8fafc">
                <div style="font-weight:800;margin-bottom:10px">連接既有群組</div>
                <div class="grid two">
                  <label class="field">群組代碼
                    <input id="cloudSyncCodeInput" type="text" maxlength="16" autocomplete="off" autocapitalize="characters" placeholder="例如 ABCD2345" />
                  </label>
                  <label class="field">同步金鑰
                    <input id="cloudSyncSecretInput" type="password" autocomplete="off" placeholder="貼上第一台裝置提供的金鑰" />
                  </label>
                </div>
                <div class="section-actions" style="margin-top:12px">
                  <button id="cloudSyncJoinBtn" class="press-btn" type="button">連接並合併資料</button>
                </div>
              </div>
            </div>
            <div id="cloudSyncDialogMessage" class="subtle" style="margin-top:12px"></div>
          </div>`;
        document.body.appendChild(dialog);

        dialog.querySelector('#cloudSyncCloseBtn')?.addEventListener('click', () => dialog.close());
        dialog.querySelector('#cloudSyncCreateBtn')?.addEventListener('click', async event => {
          const button = event.currentTarget;
          button.disabled = true;
          cloudSyncSetDialogMessage('正在建立同步群組並上傳本機資料…');
          try {
            await cloudSyncCreateGroup();
            await cloudSyncCopyConnection();
            cloudSyncSetDialogMessage('建立完成。連接資訊已複製；請保存同步金鑰。');
          } catch (error) {
            cloudSyncSetDialogMessage(error?.message || String(error), true);
          } finally {
            button.disabled = false;
            cloudSyncRefreshUi();
          }
        });
        dialog.querySelector('#cloudSyncJoinBtn')?.addEventListener('click', async event => {
          const button = event.currentTarget;
          const code = dialog.querySelector('#cloudSyncCodeInput')?.value || '';
          const secret = dialog.querySelector('#cloudSyncSecretInput')?.value || '';
          button.disabled = true;
          cloudSyncSetDialogMessage('正在驗證並合併兩邊資料…');
          try {
            await cloudSyncJoinGroup(code, secret);
            cloudSyncSetDialogMessage('連接完成。這台裝置已加入共用資料。');
          } catch (error) {
            cloudSyncSetDialogMessage(error?.message || String(error), true);
          } finally {
            button.disabled = false;
            cloudSyncRefreshUi();
          }
        });
        dialog.querySelector('#cloudSyncNowBtn')?.addEventListener('click', async event => {
          const button = event.currentTarget;
          button.disabled = true;
          cloudSyncSetDialogMessage('正在同步…');
          try {
            await cloudSyncFlushPending({ manual: true });
            await cloudSyncPull({ manual: true });
            cloudSyncSetDialogMessage('同步完成。');
          } finally {
            button.disabled = false;
            cloudSyncRefreshUi();
          }
        });
        dialog.querySelector('#cloudSyncCopyBtn')?.addEventListener('click', () => void cloudSyncCopyConnection());
        dialog.querySelector('#cloudSyncDisconnectBtn')?.addEventListener('click', () => {
          if (!confirm('只解除這台裝置的雲端同步？本機資料不會刪除，其他已連接裝置也不受影響。')) return;
          cloudSyncDisconnect();
          cloudSyncSetDialogMessage('已解除這台裝置。');
          cloudSyncRefreshUi();
        });
      }
      cloudSyncRefreshUi();
    }

    function cloudSyncSetDialogMessage(message, error = false) {
      const el = document.getElementById('cloudSyncDialogMessage');
      if (!el) return;
      el.textContent = String(message || '');
      el.style.color = error ? '#b91c1c' : '';
    }

    function cloudSyncRefreshUi() {
      const button = document.getElementById('cloudSyncBtn');
      if (button) {
        button.textContent = cloudSyncCredentials ? `雲端同步 · ${cloudSyncCredentials.code}` : '雲端同步';
        button.title = cloudSyncCredentials
          ? (cloudSyncLastError ? `同步異常：${cloudSyncLastError}` : `已連接｜最後同步 ${cloudSyncFormatTime(cloudSyncLastSuccessAt)}`)
          : '設定指定裝置／帳號共用球員資料';
      }
      const connected = document.getElementById('cloudSyncConnectedPanel');
      const disconnected = document.getElementById('cloudSyncDisconnectedPanel');
      connected?.classList.toggle('hidden', !cloudSyncCredentials);
      disconnected?.classList.toggle('hidden', Boolean(cloudSyncCredentials));
      const code = document.getElementById('cloudSyncCurrentCode');
      if (code) code.textContent = cloudSyncCredentials?.code || '';
      const state = document.getElementById('cloudSyncStateText');
      if (state) {
        state.textContent = cloudSyncLastError
          ? `同步異常：${cloudSyncLastError}`
          : cloudSyncBusy
            ? '同步中…'
            : `最後同步 ${cloudSyncFormatTime(cloudSyncLastSuccessAt)}`;
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && cloudSyncCredentials && db) void cloudSyncPull();
    });

    // app.js is loaded at the end of <body>, so the home action row already exists here.
    cloudSyncEnsureUi();
