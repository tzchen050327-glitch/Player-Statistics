    function clearBatchReportOutputs() {
      for (const output of batchReportOutputs) {
        if (output?.url) URL.revokeObjectURL(output.url);
      }
      batchReportOutputs = [];
      els.batchReportDownloadAllBtn?.classList.add('hidden');
      if (els.batchReportResults) els.batchReportResults.innerHTML = '';
    }

    function renderBatchReportSelection() {
      if (!els.batchReportList) return;
      const list = players
        .filter(player => playerScope(player) === homeZone)
        .sort((a,b) => String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric:true }));
      els.batchReportList.innerHTML = list.length ? list.map(player => {
        const meta = playerSourceMeta(player);
        return `
          <label class="batch-report-row">
            <input type="checkbox" value="${player.id}" data-batch-report-player />
            <span>
              <span class="batch-report-name">#${escapeHtml(player.number)} ${escapeHtml(player.name)}</span>
              <span class="batch-report-meta">${escapeHtml(meta || '未連結中職資料')}</span>
            </span>
          </label>`;
      }).join('') : '<div class="empty">目前沒有球員。</div>';
    }

    function openBatchReportDialog() {
      clearBatchReportOutputs();
      batchReportPreferences = {};
      if (els.batchReportDate) els.batchReportDate.textContent = els.gameDate.value.replaceAll('-', '/');
      if (els.batchReportProgress) els.batchReportProgress.textContent = '';
      renderBatchReportSelection();
      els.allDialog?.close();
      els.batchReportDialog?.showModal();
    }

    function batchReportSelectedIds() {
      return [...document.querySelectorAll('[data-batch-report-player]:checked')].map(input => input.value);
    }

    async function readSavedGameForBatch(playerId) {
      const date = els.gameDate.value;
      let record = await idbGet(STORES.games, `${date}:${playerId}:A`);
      if (!record) record = await idbGet(STORES.games, `${date}:${playerId}`);
      if (record) return { record, level:'A' };

      record = await idbGet(STORES.games, `${date}:${playerId}:D`);
      if (record) return { record, level:'D' };

      return { record:null, level:'A' };
    }

    function hasUsableBatchRecord(record, player) {
      if (!record || !String(record.opponent || '').trim()) return false;
      if (player.type === 'hitter') {
        const mode = record.hitterAppearance?.mode || 'bat';
        if (mode !== 'bat') return true;
        return Array.isArray(record.hitterPAs) && record.hitterPAs.length > 0;
      }
      const g = record.pitcherGame || {};
      return String(g.innings || '0.0') !== '0.0'
        || Number(g.k) > 0 || Number(g.h) > 0 || Number(g.bb) > 0
        || Number(g.hbp) > 0 || Number(g.er) > 0 || Number(g.r) > 0;
    }

    function batchRecordFromCpblDaily(player, daily, level) {
      if (!daily?.found) return null;
      const record = {
        ...defaultGameRecord(player),
        key: `${els.gameDate.value}:${player.id}:${level}`,
        playerId: player.id,
        date: els.gameDate.value,
        level,
        opponent: normalizeTeamName(daily.game?.opponent || ''),
        cpblReadOnlyImport: els.gameDate.value !== localISODate(),
        cpblImportedAt: Date.now()
      };

      if (player.type === 'hitter') {
        const list = daily.hitter?.plateAppearances || [];
        if (!list.length) return null;
        record.hitterAppearance.mode = 'bat';
        record.hitterPAs = list.map(pa => ({
          id: uid(),
          code: pa.code,
          position: pa.position || '',
          rbi: Number(pa.rbi) || 0,
          cpblOfficialAction: pa.officialAction || ''
        }));
        record.cpblGameSummary = {
          runs: Math.max(0, Number(daily.hitter?.runs) || 0),
          hits: Math.max(0, Number(daily.hitter?.hits) || 0),
          errors: Math.max(0, Number(daily.hitter?.errors) || 0),
          official: true
        };
        record.committedStats = deriveHitterGame(record.hitterPAs);
      } else {
        const p = daily.pitcher;
        if (!p) return null;
        const g = record.pitcherGame;
        g.innings = p.innings || '0.0';
        g.k = Number(p.k) || 0;
        g.bb = Number(p.bb) || 0;
        g.h = Number(p.h) || 0;
        g.hbp = Number(p.hbp) || 0;
        g.r = Number(p.r) || 0;
        g.er = Number(p.er) || 0;
        const pitchCount = Number(p.pitchCount) || 0;
        g.pitchTens = Math.floor(pitchCount / 10);
        g.pitchOnes = pitchCount % 10;
        g.cg = Boolean(p.cg);
        g.sho = Boolean(p.sho);
        g.hld = Boolean(p.hld);
        g.sv = Boolean(p.sv);
        g.bsv = Boolean(p.bsv);
        g.decision = ['W','L'].includes(p.decision) ? p.decision : 'ND';
        g.result = g.sv ? 'SV' : g.hld ? 'HLD' : g.decision;
        record.committedStats = derivePitcherGame(g);
      }

      record.committedAt = Date.now();
      return record;
    }

    async function fetchBatchGameFromCpbl(player) {
      if (playerScope(player) !== 'cpbl') {
        return { record:null, level:'A', reason:'國際賽／國外聯盟球員只使用已儲存的當日戰報資料' };
      }
      if (!player?.cpblAcnt || !player?.cpblTeamCode) {
        return { record:null, level:'A', reason:'此球員尚未連結中職官網' };
      }

      const levels = ['A','D'];
      let lastReason = '';
      for (const level of levels) {
        const knownYears = player?.cpblAvailableYears?.[level];
        const year = Number(els.gameDate.value.slice(0,4));
        if (Array.isArray(knownYears) && knownYears.length && !knownYears.includes(year)) continue;

        try {
          const data = await cpblRequest('daily', {
            acnt: player.cpblAcnt,
            date: els.gameDate.value,
            teamCode: player.cpblTeamCode,
            kindCode: level
          });
          const daily = data.daily;
          if (!daily?.found) {
            lastReason = daily?.reason || lastReason;
            continue;
          }

          const record = batchRecordFromCpblDaily(player, daily, level);
          if (!record) {
            lastReason = player.type === 'hitter'
              ? '官網顯示有出賽，但沒有可用的逐打席資料'
              : '官網顯示有出賽，但沒有可用的投球資料';
            continue;
          }

          await idbPut(STORES.games, record);
          return { record, level, fetched:true };
        } catch (error) {
          lastReason = error?.message || String(error);
        }
      }

      return { record:null, level:'A', reason:lastReason || '官網查不到當天出賽資料' };
    }

    async function refreshBatchSeasonStats(player, year, level) {
      const scope = playerScope(player);
      try {
        if (scope === 'cpbl') {
          if (!player?.cpblAcnt) {
            return { ok:false, skipped:true, reason:'尚未連結中職官網' };
          }
          await updatePlayerFromCpbl(player, true, year, level);
          activatePlayerStatsProfile(player, year, level);
          return { ok:true };
        }

        if (scope === 'overseas') {
          if (!player?.externalProvider || !player?.externalPlayerId) {
            return { ok:false, skipped:true, reason:'尚未連結國外聯盟資料' };
          }
          await syncExternalSeason(player, year, null, level);
          activatePlayerStatsProfile(player, year, level);
          return { ok:true };
        }

        if (scope === 'international') {
          if (!playerSpecialCompetition(player)) {
            return { ok:false, skipped:true, reason:'尚未連結國際賽資料' };
          }
          await syncInternationalTournamentStats(player);
          return { ok:true };
        }

        return { ok:false, skipped:true, reason:'此球員沒有可同步的官方來源' };
      } catch (error) {
        console.warn('批次戰報累積數據更新失敗', player?.name, error);
        return { ok:false, skipped:false, reason:error?.message || '累積數據更新失敗' };
      }
    }

    async function generateBatchReports({ refreshStats = true, refreshDaily = false } = {}) {
      const ids = batchReportSelectedIds();
      if (!ids.length) {
        setStatus('請至少勾選一名球員。', true);
        return;
      }

      clearBatchReportOutputs();
      els.batchReportGenerateBtn.disabled = true;

      const savedState = {
        selectedPlayerId,
        selectedLevel,
        selectedSeason,
        currentRecord,
        currentPage,
        currentTemplate
      };

      const results = [];
      try {
        for (let index = 0; index < ids.length; index++) {
          const player = players.find(item => item.id === ids[index]);
          if (!player) continue;

          if (els.batchReportProgress) {
            els.batchReportProgress.textContent = `正在生成 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
          }

          let savedGame = await readSavedGameForBatch(player.id);
          let record = savedGame.record;
          let reportLevel = savedGame.level;
          let dailyRefreshWarning = '';

          if (refreshDaily && playerScope(player) === 'cpbl') {
            if (els.batchReportProgress) {
              els.batchReportProgress.textContent = `正在更新單場資料 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
            }
            const fetched = await fetchBatchGameFromCpbl(player);
            if (hasUsableBatchRecord(fetched.record, player)) {
              record = fetched.record;
              reportLevel = fetched.level;
            } else if (hasUsableBatchRecord(record, player)) {
              dailyRefreshWarning = fetched.reason || '單場資料更新失敗，已使用本機快取';
            } else {
              results.push({ player, ok:false, reason:fetched.reason || '這一天查不到出賽資料' });
              continue;
            }
          } else if (!hasUsableBatchRecord(record, player)) {
            if (els.batchReportProgress) {
              els.batchReportProgress.textContent = `正在查官網 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
            }
            const fetched = await fetchBatchGameFromCpbl(player);
            record = fetched.record;
            reportLevel = fetched.level;

            if (!hasUsableBatchRecord(record, player)) {
              results.push({ player, ok:false, reason:fetched.reason || '這一天查不到出賽資料' });
              continue;
            }
          }

          selectedPlayerId = player.id;
          selectedLevel = reportLevel;
          const preferredTemplate = batchReportPreferences[player.id]?.templateKey;
          currentTemplate = preferredTemplate && TEMPLATES[preferredTemplate]?.enabled
            ? preferredTemplate
            : savedState.currentTemplate;

          const reportYear = Number(els.gameDate.value.slice(0,4)) || CURRENT_YEAR;
          const scope = playerScope(player);
          const years = availableSeasonYears(player, reportLevel);
          selectedSeason = scope === 'international'
            ? (Number(player.externalYear) || reportYear)
            : (years.includes(reportYear) ? reportYear : (years[0] || reportYear));

          let statsRefresh = { ok:false, skipped:true, reason:'' };
          if (refreshStats) {
            if (els.batchReportProgress) {
              els.batchReportProgress.textContent = `正在更新累積數據 ${index + 1}／${ids.length}：#${player.number} ${player.name}`;
            }
            statsRefresh = await refreshBatchSeasonStats(player, selectedSeason, selectedLevel);
          }

          if (scope !== 'international') {
            activatePlayerStatsProfile(player, selectedSeason, selectedLevel);
          }

          currentRecord = {
            ...defaultGameRecord(player),
            ...record,
            key: `${els.gameDate.value}:${player.id}:${reportLevel}`,
            playerId: player.id,
            date: els.gameDate.value,
            level: reportLevel,
            hitterPAs: Array.isArray(record.hitterPAs) ? record.hitterPAs : [],
            hitterAppearance: {
              ...defaultGameRecord(player).hitterAppearance,
              ...(record.hitterAppearance || {})
            },
            pitcherGame: {
              ...defaultGameRecord(player).pitcherGame,
              ...(record.pitcherGame || {})
            },
            cpblGameSummary: {
              ...defaultGameRecord(player).cpblGameSummary,
              ...(record.cpblGameSummary || {})
            }
          };

          await renderCanvas();
          const blob = await new Promise(resolve => els.canvas.toBlob(resolve, 'image/png'));
          if (!blob) {
            results.push({ player, ok:false, reason:'圖片產生失敗' });
            continue;
          }

          const fileName = currentOutputFileName();
          const url = URL.createObjectURL(blob);
          const refreshWarning = [
            dailyRefreshWarning,
            (!statsRefresh.ok && !statsRefresh.skipped ? statsRefresh.reason : '')
          ].filter(Boolean).join('；');
          const output = {
            playerId:player.id,
            player,
            blob,
            fileName,
            url,
            templateKey:currentTemplate,
            refreshWarning,
            statsRefreshed:Boolean(statsRefresh.ok)
          };
          batchReportOutputs.push(output);
          results.push({ player, ok:true, output });

          await new Promise(resolve => setTimeout(resolve, 60));
        }
      } finally {
        selectedPlayerId = savedState.selectedPlayerId;
        selectedLevel = savedState.selectedLevel;
        selectedSeason = savedState.selectedSeason;
        currentRecord = savedState.currentRecord;
        currentPage = savedState.currentPage;
        currentTemplate = savedState.currentTemplate;
        const restoredPlayer = selectedPlayer();
        if (restoredPlayer) activatePlayerStatsProfile(restoredPlayer, selectedSeason, selectedLevel);
        els.batchReportGenerateBtn.disabled = false;
        renderAll();
      }

      if (els.batchReportProgress) {
        const okCount = results.filter(item => item.ok).length;
        els.batchReportProgress.textContent = `完成：生成 ${okCount} 張，跳過 ${results.length - okCount} 名。`;
      }

      if (els.batchReportResults) {
        els.batchReportResults.innerHTML = results.map(item => {
          if (!item.ok) {
            return `
              <div class="batch-report-result failed">
                <div class="result-text">
                  <strong>#${escapeHtml(item.player.number)} ${escapeHtml(item.player.name)}</strong>
                  ${escapeHtml(item.reason)}
                </div>
              </div>`;
          }

          const templateButtons = Object.entries(TEMPLATES)
            .filter(([, template]) => template.enabled)
            .map(([key, template]) => `
              <button type="button"
                class="batch-template-chip ${item.output.templateKey === key ? 'active' : ''}"
                data-batch-template-player="${item.player.id}"
                data-batch-template-key="${key}">
                ${escapeHtml(template.label)}
              </button>`).join('');

          return `
            <div class="batch-report-result" data-batch-result-player="${item.player.id}">
              <div class="batch-result-main">
                <div class="result-text">
                  <strong>#${escapeHtml(item.player.number)} ${escapeHtml(item.player.name)}</strong>
                  ${item.output.refreshWarning
                    ? `已生成｜更新提醒：${escapeHtml(item.output.refreshWarning)}`
                    : (item.output.statsRefreshed ? '已生成｜最新累積數據已同步' : '已生成')}
                </div>
                <div class="batch-result-controls">
                  <button class="press-btn" type="button" data-batch-download="${item.player.id}">下載</button>
                  <button class="press-btn" type="button" data-batch-bg-toggle="${item.player.id}">背景選擇</button>
                  <button class="press-btn" type="button" data-batch-photo-trigger="${item.player.id}">圖片上傳</button>
                  <input class="hidden" type="file" accept="image/*" data-batch-photo-input="${item.player.id}" />
                </div>
                <div class="batch-result-template-panel hidden" data-batch-template-panel="${item.player.id}">
                  ${templateButtons}
                </div>
              </div>
            </div>`;
        }).join('');

        els.batchReportResults.querySelectorAll('[data-batch-download]').forEach(button => {
          button.addEventListener('click', async () => {
            const playerId = button.dataset.batchDownload;
            button.disabled = true;
            try {
              if (els.batchReportProgress) {
                els.batchReportProgress.textContent = '下載前正在同步最新數據並重新產圖…';
              }
              const outputs = await generateBatchReports({ refreshStats:true, refreshDaily:true });
              const output = outputs.find(item => item.playerId === playerId);
              if (!output) throw new Error('找不到這名球員可下載的戰報。');

              const link = document.createElement('a');
              link.href = output.url;
              link.download = output.fileName;
              document.body.appendChild(link);
              link.click();
              link.remove();

              if (els.batchReportProgress) {
                els.batchReportProgress.textContent = `已更新最新數據並下載：#${output.player.number} ${output.player.name}`;
              }
              showAppToast('已下載');
            } catch (error) {
              setStatus(error?.message || '批次戰報下載失敗。', true);
            }
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-bg-toggle]').forEach(button => {
          button.addEventListener('click', () => {
            const playerId = button.dataset.batchBgToggle;
            const panel = els.batchReportResults.querySelector(`[data-batch-template-panel="${playerId}"]`);
            panel?.classList.toggle('hidden');
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-template-player]').forEach(button => {
          button.addEventListener('click', async () => {
            const playerId = button.dataset.batchTemplatePlayer;
            const templateKey = button.dataset.batchTemplateKey;
            if (!TEMPLATES[templateKey]?.enabled) return;
            batchReportPreferences[playerId] = {
              ...(batchReportPreferences[playerId] || {}),
              templateKey
            };
            await generateBatchReports({ refreshStats:false, refreshDaily:false });
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-photo-trigger]').forEach(button => {
          button.addEventListener('click', () => {
            const input = els.batchReportResults.querySelector(`[data-batch-photo-input="${button.dataset.batchPhotoTrigger}"]`);
            input?.click();
          });
        });

        els.batchReportResults.querySelectorAll('[data-batch-photo-input]').forEach(input => {
          input.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
              setStatus('請選擇圖片檔。', true);
              return;
            }

            const player = players.find(item => item.id === event.target.dataset.batchPhotoInput);
            if (!player) return;

            event.target.disabled = true;
            try {
              const photo = {
                id: uid(),
                playerId: player.id,
                name: file.name,
                blob: file,
                createdAt: Date.now()
              };
              await idbPut(STORES.photos, photo);
              photos.push(photo);
              player.selectedPhotoId = photo.id;
              ensurePhotoTransforms(player)[photo.id] = { x: 0, y: 0, scale: 1 };
              await savePlayer(player);
              await generateBatchReports({ refreshStats:false, refreshDaily:false });
            } catch (error) {
              setStatus(error?.message || '圖片上傳失敗。', true);
            }
          });
        });
      }

      const hasOutputs = batchReportOutputs.length > 0;
      els.batchReportDownloadAllBtn?.classList.toggle('hidden', !hasOutputs);
      return batchReportOutputs.slice();
    }

    async function downloadAllBatchReports() {
      if (!batchReportOutputs.length) {
        setStatus('目前沒有可下載的批次戰報。', true);
        return;
      }

      els.batchReportDownloadAllBtn.disabled = true;
      try {
        if (els.batchReportProgress) {
          els.batchReportProgress.textContent = '全部下載前正在同步最新數據並重新產圖…';
        }

        const outputs = await generateBatchReports({ refreshStats:true, refreshDaily:true });
        if (!outputs.length) throw new Error('更新後沒有可下載的戰報。');

        for (let i = 0; i < outputs.length; i++) {
          const output = outputs[i];
          const link = document.createElement('a');
          link.href = output.url;
          link.download = output.fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          if (i < outputs.length - 1) await new Promise(resolve => setTimeout(resolve, 250));
        }

        if (els.batchReportProgress) {
          els.batchReportProgress.textContent = `已同步最新數據並下載 ${outputs.length} 張戰報。`;
        }
        showAppToast(`已下載 ${outputs.length} 張圖片`);
      } catch (error) {
        setStatus(error?.message || '批次下載失敗。', true);
      } finally {
        els.batchReportDownloadAllBtn.disabled = false;
      }
    }

