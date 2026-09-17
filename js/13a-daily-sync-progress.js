    // Add a visible progress overlay for manual "today stats" imports without changing
    // the underlying CPBL / overseas import logic.
    const importCpblDailyBeforeProgress = importCpblDaily;
    const importExternalDailyBeforeProgress = importExternalDaily;

    function setDailySyncProgress(percent, status, { error = false } = {}) {
      setSyncProgress(percent, status, { error });
      if (els.syncProgressTitle) els.syncProgressTitle.textContent = '正在同步今日戰績';
    }

    async function runDailyImportWithProgress(player, importTask, sourceLabel) {
      const dateText = String(els.gameDate?.value || localISODate()).replaceAll('-', '/');
      let progress = 12;
      let timer = 0;

      setDailySyncProgress(4, `準備同步 ${dateText} ${sourceLabel} 今日戰績…`);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      setDailySyncProgress(progress, `正在連線 ${sourceLabel} 官方資料…`);

      timer = setInterval(() => {
        if (progress >= 86) return;
        progress = Math.min(86, progress + (progress < 40 ? 7 : progress < 68 ? 5 : 3));
        const status = progress < 40
          ? `正在查詢 ${dateText} 單場資料…`
          : progress < 68
            ? '正在比對一軍／二軍、逐打席與單場成績…'
            : '正在整理官方今日戰績…';
        setDailySyncProgress(progress, status);
      }, 550);

      try {
        const result = await importTask();
        clearInterval(timer);
        timer = 0;
        setDailySyncProgress(94, '正在寫入並更新今日戰績畫面…');
        await new Promise(resolve => requestAnimationFrame(resolve));
        setDailySyncProgress(100, `${dateText} 今日戰績同步完成`);
        await new Promise(resolve => setTimeout(resolve, 420));
        hideSyncProgress();
        return result;
      } catch (error) {
        if (timer) clearInterval(timer);
        timer = 0;
        setDailySyncProgress(100, error?.message || '今日戰績同步失敗', { error: true });
        await new Promise(resolve => setTimeout(resolve, 900));
        hideSyncProgress();
        throw error;
      }
    }

    importCpblDaily = async function importCpblDailyWithProgress(player) {
      return runDailyImportWithProgress(
        player,
        () => importCpblDailyBeforeProgress(player),
        '中職'
      );
    };

    importExternalDaily = async function importExternalDailyWithProgress(player) {
      const sourceLabel = overseasProviderLabel(player?.externalProvider) || '國外聯盟';
      return runDailyImportWithProgress(
        player,
        () => importExternalDailyBeforeProgress(player),
        sourceLabel
      );
    };
