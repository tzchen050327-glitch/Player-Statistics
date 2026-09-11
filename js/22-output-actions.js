    function outputRecordForRole(baseRecord, role) {
      const next = {
        ...baseRecord,
        hitterPAs: Array.isArray(baseRecord?.hitterPAs) ? baseRecord.hitterPAs.map(pa => ({ ...pa })) : [],
        hitterAppearance: {
          ...defaultGameRecord(selectedPlayer()).hitterAppearance,
          ...(baseRecord?.hitterAppearance || {})
        },
        pitcherGame: {
          ...defaultGameRecord(selectedPlayer()).pitcherGame,
          ...(baseRecord?.pitcherGame || {})
        },
        cpblGameSummary: {
          ...defaultGameRecord(selectedPlayer()).cpblGameSummary,
          ...(baseRecord?.cpblGameSummary || {})
        }
      };

      const pair = baseRecord?.externalRoleDaily || null;
      if (!pair) return next;

      // v1.91: prepared/download output must match the visible preview exactly.
      // Never overwrite an already-populated currentRecord with a thinner raw
      // provider payload, because some providers omit derived/manual flags such
      // as CG/SHO and express decisions as "decision:L" instead of w/l.
      if (role === 'hitter' && pair.hitter) {
        const existingHitter = dailyHitterRoleHasData({
          ...(next.internationalHitterGame || {}),
          plateAppearances: next.hitterPAs
        });

        if (!existingHitter) {
          const h = pair.hitter;
          const list = Array.isArray(h.plateAppearances) ? h.plateAppearances : [];
          next.hitterAppearance.mode = 'bat';
          next.hitterPAs = list.map(pa => ({
            id: uid(),
            code: pa.code || 'OUT',
            position: pa.position || '',
            rbi: Number(pa.rbi) || 0,
            cpblOfficialAction: pa.officialAction || ''
          }));
          next.cpblGameSummary = {
            runs: Math.max(0, Number(h.runs) || 0),
            hits: Math.max(0, Number(h.hits) || 0),
            errors: Math.max(0, Number(h.errors) || 0),
            official: true
          };
          next.internationalHitterGame = { ...h };
        }
      }

      if (role === 'pitcher' && pair.pitcher) {
        const existingPitcher = dailyPitcherRoleHasData(next.pitcherGame);
        if (!existingPitcher) {
          const p = pair.pitcher;
          const pitchCount = Math.max(0, Math.min(150, Number(p.pitchCount) || 0));
          const decision = ['W','L'].includes(String(p.decision || '').toUpperCase())
            ? String(p.decision).toUpperCase()
            : (Number(p.w) > 0 ? 'W' : Number(p.l) > 0 ? 'L' : (next.pitcherGame.decision || 'ND'));

          next.pitcherGame = {
            ...next.pitcherGame,
            innings: p.innings || outsToIP(Number(p.outs) || 0) || next.pitcherGame.innings || '0.0',
            k: Number(p.k) || 0,
            bb: Number(p.bb) || 0,
            h: Number(p.h) || 0,
            hbp: Number(p.hbp) || 0,
            r: Number(p.r) || 0,
            er: Math.min(Math.max(0, Number(p.r) || 0), Math.max(0, Number(p.er) || 0)),
            pitchTens: Math.floor(pitchCount / 10),
            pitchOnes: pitchCount >= 150 ? 0 : pitchCount % 10,
            cg: p.cg === undefined ? Boolean(next.pitcherGame.cg) : Boolean(Number(p.cg) || p.cg),
            sho: p.sho === undefined ? Boolean(next.pitcherGame.sho) : Boolean(Number(p.sho) || p.sho),
            hld: p.hld === undefined ? Boolean(next.pitcherGame.hld) : Boolean(Number(p.hld) || p.hld),
            sv: p.sv === undefined ? Boolean(next.pitcherGame.sv) : Boolean(Number(p.sv) || p.sv),
            bsv: p.bsv === undefined ? Boolean(next.pitcherGame.bsv) : Boolean(Number(p.bsv) || p.bsv),
            decision,
            result: Boolean(Number(p.sv) || p.sv) ? 'SV'
              : Boolean(Number(p.hld) || p.hld) ? 'HLD'
              : decision
          };
          next.externalWalksCombined = Boolean(p.walksCombined);
        }
      }

      return next;
    }

    async function capturePreparedOutputForRole(role) {
      const player = selectedPlayer();
      if (!player || !currentRecord) throw new Error('請先選擇球員與戰報日期。');

      const originalType = player.type;
      const originalStats = player.stats;
      const originalRecord = currentRecord;
      const originalTodayRoleView = todayRoleView;
      try {
        player.type = role;
        player.stats = seasonStatsForOutputRole(player, role);
        currentRecord = outputRecordForRole(originalRecord, role);
        todayRoleView = role;

        await renderCanvas();
        const blob = await new Promise(resolve => els.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('圖片產生失敗。');

        const fileName = currentOutputFileName(role);
        return {
          role,
          blob,
          fileName,
          file: new File([blob], fileName, { type:'image/png' })
        };
      } finally {
        player.type = originalType;
        player.stats = originalStats;
        currentRecord = originalRecord;
        todayRoleView = originalTodayRoleView;
      }
    }

    function updatePreparedOutputDialog() {
      const count = preparedOutputs.length || (preparedOutput ? 1 : 0);
      const internationalTotal = preparedOutputKind === 'international-total';
      const annual = preparedOutputKind === 'season' || internationalTotal;
      if (els.outputDialogTitle) {
        els.outputDialogTitle.textContent = internationalTotal
          ? (count > 1 ? `${count} 張賽事總戰績圖已準備完成` : '賽事總戰績圖已準備完成')
          : annual
            ? (count > 1 ? `${count} 張年度戰報已準備完成` : '年度戰報已準備完成')
            : (count > 1 ? `${count} 張圖片已準備完成` : '圖片已準備完成');
      }
      if (els.downloadPreparedLabel) els.downloadPreparedLabel.textContent = count > 1 ? `下載 ${count} 張圖片` : '下載圖片';
      if (els.sharePreparedLabel) els.sharePreparedLabel.textContent = count > 1 ? `分享 ${count} 張圖片` : '分享圖片';
      els.outputBackgroundBtn?.classList.toggle('hidden', annual);
    }

    async function generatePreparedOutputsFromCanvas() {
      preparedOutputKind = 'daily';
      const player = selectedPlayer();
      if (!player || !currentRecord) throw new Error('請先選擇球員。');

      const officialRoles = currentDualDailyRoles();
      const roles = officialRoles.length
        ? ['hitter','pitcher'].filter(role => officialRoles.includes(role))
        : [player.type];
      const outputs = [];

      for (const role of roles) {
        outputs.push(await capturePreparedOutputForRole(role));
      }

      preparedOutputs = outputs;
      preparedOutput = outputs[0] || null;
      updatePreparedOutputDialog();

      // 輸出完成後把右側預覽還原成球員目前主要角色。
      await renderCanvas();
      return outputs;
    }

    async function refreshPreparedOutputFromCanvas() {
      return await generatePreparedOutputsFromCanvas();
    }

    async function prepareOutputImage() {
      const player = selectedPlayer();
      const shouldRefreshKboPlateAppearances = Boolean(
        player
        && playerScope(player) === 'overseas'
        && String(player.externalProvider || '').toUpperCase() === 'KBO'
        && player.type === 'hitter'
        && currentRecord?.externalReadOnlyImport
        && currentRecord?.cpblGameSummary?.official
        && !(Array.isArray(currentRecord?.hitterPAs) && currentRecord.hitterPAs.length)
      );
      if (shouldRefreshKboPlateAppearances) {
        try {
          await importExternalDaily(player);
        } catch (error) {
          console.warn('KBO 逐打席重新抓取失敗', error);
        }
      }
      await commitCurrentGame();
      return await generatePreparedOutputsFromCanvas();
    }

    async function downloadPreparedOutput() {
      const outputs = preparedOutputs.length ? preparedOutputs : (preparedOutput ? [preparedOutput] : []);
      if (!outputs.length) throw new Error('請先產生圖片。');

      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i];
        const url = URL.createObjectURL(output.blob);
        const link = document.createElement('a');
        link.download = output.fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
        if (i < outputs.length - 1) await new Promise(resolve => setTimeout(resolve, 260));
      }
    }

    async function sharePreparedOutput() {
      const outputs = preparedOutputs.length ? preparedOutputs : (preparedOutput ? [preparedOutput] : []);
      if (!outputs.length) throw new Error('請先產生圖片。');

      const files = outputs.map(output => output.file);
      const canShareFiles = Boolean(
        navigator.share
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files })
      );

      if (!canShareFiles) {
        throw new Error('這台裝置／瀏覽器不支援一次分享這些圖片，請改用「下載圖片」。');
      }

      await navigator.share({
        files,
        title: outputs.length > 1 ? '球員投打戰績圖片' : '球員戰績圖片'
      });
    }

    async function downloadCpblErrorCard(player = selectedPlayer()) {
      if (!player || playerScope(player) !== 'cpbl' || !player.cpblAcnt) {
        throw new Error('只有已連結 CPBL 官方資料的球員可以產生失誤圖。');
      }
      if (!currentRecord) throw new Error('請先選擇比賽日期。');

      if (!Array.isArray(currentRecord.cpblGameErrors)) {
        await refreshCpblGameErrors(player, { quiet:true });
      }

      const errors = Array.isArray(currentRecord.cpblGameErrors) ? currentRecord.cpblGameErrors : [];
      const own = errors.find(item => String(item?.acnt || '') === String(player.cpblAcnt || '')) || null;
      const ownCount = Math.max(0, Number(own?.count) || 0);
      const originalRecord = currentRecord;
      const originalRole = todayRoleView;

      try {
        currentRecord = {
          ...originalRecord,
          cpblErrorCardMode:true,
          cpblErrorCardCount:ownCount,
          cpblGameSummary:{
            ...defaultGameRecord(player).cpblGameSummary,
            ...(originalRecord.cpblGameSummary || {}),
            errors:ownCount,
            official:true
          }
        };
        todayRoleView = player.type === 'pitcher' ? 'pitcher' : 'hitter';
        await renderCanvas();

        const blob = await new Promise(resolve => els.canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('失誤圖產生失敗。');
        const safeName = String(reportPlayerName(player) || player.name || 'player').replace(/[\\/:*?"<>|]+/g, '_');
        const dateText = String(originalRecord.date || els.gameDate.value || '').replaceAll('-', '');
        const fileName = `${dateText}_${safeName}_失誤紀錄.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
        setStatus(`已下載 ${reportPlayerName(player)} 的失誤圖（${ownCount} 次失誤）。`);
      } finally {
        currentRecord = originalRecord;
        todayRoleView = originalRole;
        await renderCanvas();
      }
    }

    els.downloadBtn.addEventListener('click', async () => {
      try {
        if (selectedTab !== 'today') throw new Error('請到「今日戰績」產生當天戰報。');
        setStatus('正在更新當天數據並產生戰報…');
        const outputs = await prepareOutputImage();
        els.outputDialog?.showModal();
        const count = outputs.length;
        setStatus(count > 1
          ? `投球與打擊戰報已分開產生，共 ${count} 張圖片。`
          : ((currentRecord.cpblReadOnlyImport || currentRecord.externalReadOnlyImport)
              ? '圖片已準備完成；官方單場資料不會重複更新球員累積數據。'
              : '圖片已準備完成，球員基礎數據已同步更新。'));
        renderAll();
      } catch (error) {
        setStatus(error?.message || '圖片產生失敗。', true);
      }
    });

    els.seasonReportBtn?.addEventListener('click', async () => {
      try {
        const player=selectedPlayer();
        if(!player) throw new Error('請先選擇球員。');
        const internationalTotal = playerScope(player) === 'international';
        const allowedTab = internationalTotal ? selectedTab === 'base' : ['base','minor','secondary'].includes(selectedTab);
        if (!allowedTab) {
          throw new Error(internationalTotal ? '請到「賽事總成績」頁輸出總戰績圖。' : '請到一軍／二軍整季成績頁輸出年度戰報。');
        }
        const context=annualSeasonContext(player);
        const levelText=supportsLeagueLevelTabs(player) ? (selectedLevel==='D'?'二軍':'一軍') : (context.league||'');
        setStatus(internationalTotal
          ? `正在產生 ${context.year} ${context.league || '國際賽'}總戰績圖…`
          : `正在產生 ${context.year} ${levelText}整季戰報…`);
        const outputs=await prepareAnnualSeasonReports();
        els.outputDialog?.showModal();
        setStatus(internationalTotal
          ? (outputs.length>1 ? `已產生 ${outputs.length} 張賽事總戰績圖（打擊＋投球）。` : `${context.year} 賽事總戰績圖已準備完成。`)
          : (outputs.length>1 ? `已產生 ${outputs.length} 張年度戰報（打擊＋投球）。` : `${context.year} 年度戰報已準備完成。`));
      } catch (error) {
        setStatus(error?.message || '年度戰報產生失敗。', true);
      }
    });

    els.downloadPreparedBtn?.addEventListener('click', async () => {
      try {
        const count = preparedOutputs.length || (preparedOutput ? 1 : 0);
        await downloadPreparedOutput();
        els.outputDialog?.close();
        showAppToast(count > 1 ? `已下載 ${count} 張圖片` : '已下載');
        setStatus(count > 1 ? `已下載 ${count} 張圖片。` : '圖片已下載。');
      } catch (error) {
        setStatus(error?.message || '下載失敗。', true);
      }
    });

    els.sharePreparedBtn?.addEventListener('click', async () => {
      try {
        await sharePreparedOutput();
        setStatus('已開啟系統分享器。');
      } catch (error) {
        if (error?.name === 'AbortError') {
          setStatus('已取消分享。');
          return;
        }
        setStatus(error?.message || '分享失敗。', true);
      }
    });

    els.outputBackgroundBtn?.addEventListener('click', () => {
      if (preparedOutputKind === 'season') return;
      els.outputDialog?.close();
      renderQuickTemplates();
      els.quickTemplateDialog?.showModal();
    });

