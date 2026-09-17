    /* ---------- Cloud sync delta pull ---------- */
    // The stored revision means "latest server revision fully merged into this browser".
    // A push must NOT advance it, otherwise concurrent changes from another device can be skipped.
    const cloudSyncPushRecordsBeforeDelta = cloudSyncPushRecords;

    cloudSyncPushRecords = async function cloudSyncPushRecordsWithoutAdvancingSeenRevision(records, { manual = false } = {}) {
      if (!cloudSyncCredentials || !records.length) return 0;
      let applied = 0;
      const normal = records.filter(r => r.store !== STORES.photos);
      const photoRecords = records.filter(r => r.store === STORES.photos);

      for (let i = 0; i < normal.length; i += 120) {
        const batch = [];
        for (const record of normal.slice(i, i + 120)) batch.push(await cloudSyncEncodedRecord(record));
        const result = await cloudSyncApi('push', { records: batch });
        applied += Number(result?.applied || 0);
      }

      for (const record of photoRecords) {
        const encoded = await cloudSyncEncodedRecord(record);
        const result = await cloudSyncApi('push', { records: [encoded] }, 90000);
        applied += Number(result?.applied || 0);
      }

      cloudSyncLastSuccessAt = Date.now();
      cloudSyncLastError = '';
      cloudSyncRefreshUi();
      if (manual && typeof setStatus === 'function') setStatus(`雲端同步完成${applied ? `（${applied} 筆更新）` : ''}。`);
      return applied;
    };

    const cloudSyncPullBeforeDelta = cloudSyncPull;

    cloudSyncPull = async function cloudSyncPullDelta({ manual = false, uploadLocalOnly = true, forceFull = false } = {}) {
      if (!cloudSyncCredentials || cloudSyncBusy || !db) return null;

      // Flush local pending writes first. Their new server revision is deliberately NOT marked as seen;
      // the delta pull below will merge both our own write and any concurrent remote writes.
      await cloudSyncFlushPending();
      if (cloudSyncBusy) return null;

      cloudSyncBusy = true;
      try {
        const previous = cloudSyncStoredRevision();
        const useDelta = !forceFull && cloudSyncInitialDone && previous > 0;
        const result = await cloudSyncApi('pull', useDelta ? { sinceRevision: previous } : {});
        const revision = Math.max(0, Number(result?.group?.revision || 0));
        const records = Array.isArray(result?.records) ? result.records : [];
        const isDelta = Boolean(result?.delta);

        // A delta response contains only changed keys. Never run the "upload local-only records"
        // reconciliation against it, otherwise every unchanged local row would be re-uploaded.
        const shouldMerge = !cloudSyncInitialDone || revision !== previous || manual || records.length > 0;
        if (shouldMerge) {
          await cloudSyncMergeRemote(records, {
            uploadLocalOnly: isDelta ? false : uploadLocalOnly
          });
        }

        // Only after the returned revision has been merged is it safe to mark that revision as seen.
        cloudSyncSetRevision(revision);
        cloudSyncLastSuccessAt = Date.now();
        cloudSyncLastError = '';
        cloudSyncInitialDone = true;
        cloudSyncRefreshUi();
        if (manual && typeof setStatus === 'function') {
          setStatus(isDelta
            ? `雲端增量同步完成${records.length ? `（下載 ${records.length} 筆變更）` : ''}。`
            : '雲端資料已同步。');
        }
        return result;
      } catch (error) {
        cloudSyncLastError = error?.message || String(error);
        cloudSyncRefreshUi();
        if (manual && typeof setStatus === 'function') setStatus(cloudSyncLastError, true);
        else console.warn('雲端同步下載失敗：', error);
        return null;
      } finally {
        cloudSyncBusy = false;
        cloudSyncRefreshUi();
      }
    };

    // Update the explanatory copy created by 07a now that changed revisions use delta pull.
    const cloudSyncDeltaHelp = [...document.querySelectorAll('#cloudSyncConnectedPanel .subtle')]
      .find(el => String(el.textContent || '').includes('背景每 30 秒'));
    if (cloudSyncDeltaHelp) {
      cloudSyncDeltaHelp.textContent = '這台裝置的球員、比賽紀錄與自訂照片會和同一群組的其他裝置合併同步。修改後會自動上傳；背景每 30 秒與回到前景時只檢查版本，有變動時只下載變更的紀錄，不再整包下載。';
    }
