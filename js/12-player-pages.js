    function selectedLevelSecondaryStats(player) {
      if (!player) return null;
      const level = supportsLeagueLevelTabs(player) ? selectedLevel : 'A';
      const pair = roleStatsPair(player, selectedSeason, level);
      return player.type === 'pitcher' ? pair?.hitter || null : pair?.pitcher || null;
    }

    function selectedLevelHasSecondaryRole(player) {
      const stats = selectedLevelSecondaryStats(player);
      return player?.type === 'pitcher' ? hitterRoleHasData(stats) : pitcherRoleHasData(stats);
    }

    function renderSelectedLevelSecondaryRole(player) {
      const stats = selectedLevelSecondaryStats(player);
      const levelLabel = selectedLevel === 'D' ? '二軍' : '一軍';
      const roleHeadingPrefix = supportsLeagueLevelTabs(player)
        ? `${selectedSeason} ${levelLabel}`
        : `${selectedSeason} `;

      if (player.type === 'pitcher') {
        const d = hitterDerived(stats || hitterDefaults());
        els.content.innerHTML = `
          <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${roleHeadingPrefix}打擊成績</h2>
          <div class="metrics">
            <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
            <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
            <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
          </div>
          <div class="grid four">
            ${readonlyStatField('打席', stats?.pa || 0)}
            ${readonlyStatField('打數', stats?.ab || 0)}
            ${readonlyStatField('安打', d.hits || 0)}
            ${readonlyStatField('得分', stats?.runs || 0)}
            ${readonlyStatField('打點', stats?.rbi || 0)}
            ${readonlyStatField('一安', stats?.single || 0)}
            ${readonlyStatField('二安', stats?.double || 0)}
            ${readonlyStatField('三安', stats?.triple || 0)}
            ${readonlyStatField('全壘打', stats?.hr || 0)}
            ${readonlyStatField('四壞球', stats?.bb || 0)}
            ${readonlyStatField('故意四壞', stats?.ibb || 0)}
            ${readonlyStatField('死球', stats?.hbp || 0)}
            ${readonlyStatField('三振', stats?.k || 0)}
            ${readonlyStatField('犧牲短打', stats?.sacBunt || 0)}
            ${readonlyStatField('犧牲高飛', stats?.sacFly || 0)}
          </div>
          ${playerSourceInfoHtml(player)}`;
        return;
      }

      const d = pitcherDerived(stats || pitcherDefaults());
      els.content.innerHTML = `
        <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${roleHeadingPrefix}投球成績</h2>
        <div class="metrics">
          <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
          <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
          <div class="metric"><span>勝／敗</span><strong>${stats?.w || 0}／${stats?.l || 0}</strong></div>
        </div>
        <div class="grid four">
          ${readonlyStatField('投球局數', outsToIP(stats?.outs || 0))}
          ${readonlyStatField('被安打', stats?.h || 0)}
          ${readonlyStatField('保送', stats?.bb || 0)}
          ${readonlyStatField('死球', stats?.hbp || 0)}
          ${readonlyStatField('三振', stats?.k || 0)}
          ${readonlyStatField('自責分', stats?.er || 0)}
          ${readonlyStatField('勝場', stats?.w || 0)}
          ${readonlyStatField('敗場', stats?.l || 0)}
          ${readonlyStatField('完投', stats?.cg || 0)}
          ${readonlyStatField('完封', stats?.sho || 0)}
          ${readonlyStatField('救援成功', stats?.sv || 0)}
          ${readonlyStatField('中繼成功', stats?.hld || 0)}
        </div>
        ${playerSourceInfoHtml(player)}`;
    }

    function injectSelectedLevelRoleSwitch(player) {
      if (!selectedLevelHasSecondaryRole(player)) {
        selectedRoleView = 'primary';
        return;
      }

      const primaryLabel = player.type === 'pitcher' ? '投球成績' : '打擊成績';
      const secondaryLabel = player.type === 'pitcher' ? '打擊成績' : '投球成績';
      els.content.insertAdjacentHTML('afterbegin', `
        <div class="level-role-switch" aria-label="成績類型">
          <button type="button" class="level-role-btn ${selectedRoleView === 'primary' ? 'active' : ''}" data-role-view="primary">${primaryLabel}</button>
          <button type="button" class="level-role-btn ${selectedRoleView === 'secondary' ? 'active' : ''}" data-role-view="secondary">${secondaryLabel}</button>
        </div>`);

      els.content.querySelectorAll('[data-role-view]').forEach(button => {
        button.addEventListener('click', () => {
          const next = button.dataset.roleView === 'secondary' ? 'secondary' : 'primary';
          if (next === selectedRoleView) return;
          selectedRoleView = next;
          renderAll();
        });
      });
    }

    function renderLeagueLevelStatsPage(player) {
      if (!supportsLeagueLevelTabs(player)) {
        renderBaseSettings(player);
        return;
      }

      if (!selectedLevelHasSecondaryRole(player)) selectedRoleView = 'primary';

      if (selectedRoleView === 'secondary') renderSelectedLevelSecondaryRole(player);
      else renderBaseSettings(player);

      injectSelectedLevelRoleSwitch(player);
    }

    function renderBaseSettings(player) {
      const levelHeading = supportsLeagueLevelTabs(player)
        ? `${selectedSeason} ${selectedLevel === 'D' ? '二軍' : '一軍'}總成績`
        : '';
      const usEntry = isUsPlayer(player) ? currentUsCareerEntry(player) : null;
      const usCareerHeading = usEntry
        ? `${usEntry.year} ${usEntry.organizationName || usEntry.teamName || '球隊未提供'} ${usEntry.level || 'MiLB'} 總成績`
        : '';
      const usDualHeading = supportsUsDualRoleTabs(player)
        ? `${selectedSeason} ${player.type === 'pitcher' ? '投球成績' : '打擊成績'}`
        : '';
      if (player.type === 'hitter') {
        const s = mergeStats(player.stats, hitterDefaults);
        const d = hitterDerived(s);
        els.content.innerHTML = `
          <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${playerScope(player) === 'international' ? `${escapeHtml(playerSpecialCompetition(player))} ${escapeHtml(internationalEdition(player))} 總成績` : (levelHeading || usCareerHeading || usDualHeading || '打者基礎設定')}</h2>
          <div class="metrics">
            <div class="metric"><span>打擊率</span><strong>${fmtBatRate(d.avg)}</strong></div>
            <div class="metric"><span>上壘率</span><strong>${fmtBatRate(d.obp)}</strong></div>
            <div class="metric"><span>長打率</span><strong>${fmtBatRate(d.slg)}</strong></div>
          </div>
          <div class="grid four">
            ${hitterInput('打席', 'pa', s.pa)}
            ${hitterInput('打數', 'ab', s.ab)}
            ${hitterInput('打點', 'rbi', s.rbi)}
            ${hitterInput('得分', 'runs', s.runs)}
            ${hitterReadonly('安打', d.hits)}
            ${hitterInput('一安', 'single', s.single)}
            ${hitterInput('二安', 'double', s.double)}
            ${hitterInput('三安', 'triple', s.triple)}
            ${hitterInput('全壘打', 'hr', s.hr)}
            ${hitterReadonly('壘打數', d.tb)}
            ${hitterInput('犧牲短打', 'sacBunt', s.sacBunt)}
            ${hitterInput('犧牲高飛', 'sacFly', s.sacFly)}
            ${hitterInput('四壞球', 'bb', s.bb)}
            ${hitterInput('故意四壞球', 'ibb', s.ibb)}
            ${hitterInput('死球', 'hbp', s.hbp)}
          </div>
          <div class="section-actions">
            <button id="deletePlayerBtn" class="press-btn danger">刪除球員</button>
            <button id="saveBaseBtn" class="press-btn primary">儲存基礎設定</button>
          </div>
          ${playerSourceInfoHtml(player)}`;
      } else {
        const s = mergeStats(player.stats, pitcherDefaults);
        const d = pitcherDerived(s);
        els.content.innerHTML = `
          <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜${playerScope(player) === 'international' ? `${escapeHtml(playerSpecialCompetition(player))} ${escapeHtml(internationalEdition(player))} 總成績` : (levelHeading || usCareerHeading || usDualHeading || '投手基礎設定')}</h2>
          <div class="metrics">
            <div class="metric"><span>WHIP</span><strong>${fmtTwo(d.whip)}</strong></div>
            <div class="metric"><span>防禦率</span><strong>${fmtTwo(d.era)}</strong></div>
            <div class="metric"><span>勝／敗</span><strong>${s.w}／${s.l}</strong></div>
          </div>
          <div class="grid four">
            ${pitcherInput('完投', 'cg', s.cg)}
            ${pitcherInput('完封', 'sho', s.sho)}
            ${pitcherInput('無四死球', 'noWalkHbp', s.noWalkHbp)}
            ${pitcherInput('勝場', 'w', s.w)}
            ${pitcherInput('敗場', 'l', s.l)}
            ${pitcherInput('救援成功', 'sv', s.sv)}
            ${pitcherInput('救援失敗', 'bsv', s.bsv)}
            ${pitcherInput('中繼成功', 'hld', s.hld)}
            <label class="field">投球局數<input id="base-outs" type="text" value="${outsToIP(s.outs)}" /></label>
            ${pitcherInput('安打', 'h', s.h)}
            ${pitcherInput('保送', 'bb', s.bb)}
            ${pitcherInput('死球', 'hbp', s.hbp)}
            ${pitcherInput('三振', 'k', s.k)}
            ${pitcherInput('自責分', 'er', s.er)}
          </div>
          <div class="section-actions">
            <button id="deletePlayerBtn" class="press-btn danger">刪除球員</button>
            <button id="saveBaseBtn" class="press-btn primary">儲存基礎設定</button>
          </div>
          ${playerSourceInfoHtml(player)}`;
      }

      document.getElementById('saveBaseBtn').addEventListener('click', async () => {
        try {
          if (player.type === 'hitter') {
            const next = hitterDefaults();
            Object.keys(next).forEach(key => next[key] = readNonNegative(`base-${key}`));
            validateHitterBaseStats(next);
            player.stats = next;
          } else {
            const next = pitcherDefaults();
            Object.keys(next).filter(k => k !== 'outs').forEach(key => next[key] = readNonNegative(`base-${key}`));
            const outs = ipToOuts(document.getElementById('base-outs').value);
            if (outs === null) throw new Error('投球局數格式必須是「整數.0、.1 或 .2」');
            next.outs = outs;
            player.stats = next;
          }
          await savePlayer(player);
          setStatus('基礎設定已儲存。');
          renderAll();
        } catch (error) {
          setStatus(error.message, true);
        }
      });

      document.getElementById('deletePlayerBtn').addEventListener('click', async () => {
        try {
          await deleteSelectedPlayer();
        } catch (error) {
          setStatus(error.message || '刪除球員失敗。', true);
        }
      });
    }

    async function deletePlayerById(playerId) {
      const player = players.find(item => item.id === playerId);
      if (!player) return false;

      const firstConfirm = await showAppConfirm(
        `確定要刪除 #${player.number} ${player.name} 嗎？\n會一併刪除球員資料、照片與所有日期戰報。`,
        {
          title: '刪除球員',
          confirmText: '繼續',
          cancelText: '取消',
          tone: 'danger'
        }
      );
      if (!firstConfirm) return false;

      const secondConfirm = await showAppConfirm(
        `再次確認：永久刪除 #${player.number} ${player.name}？\n此操作無法復原。`,
        {
          title: '永久刪除確認',
          confirmText: '永久刪除',
          cancelText: '取消',
          tone: 'danger'
        }
      );
      if (!secondConfirm) return false;

      const gameRecords = await idbGetAll(STORES.games);
      const relatedGames = gameRecords.filter(record => record.playerId === player.id);
      const relatedPhotos = photos.filter(photo => photo.playerId === player.id);

      await Promise.all([
        idbDelete(STORES.players, player.id),
        ...relatedGames.map(record => idbDelete(STORES.games, record.key)),
        ...relatedPhotos.map(photo => idbDelete(STORES.photos, photo.id))
      ]);

      relatedPhotos.forEach(photo => photoImageCache.delete(photo.id));
      photos = photos.filter(photo => photo.playerId !== player.id);
      players = players.filter(item => item.id !== player.id);

      if (selectedPlayerId === player.id) {
        selectedPlayerId = [...players]
          .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))[0]?.id || null;
        currentRecord = null;
        currentPage = 'home';

        if (selectedPlayerId) {
          localStorage.setItem('baseballSelectedPlayerId', selectedPlayerId);
          selectedLevel = 'A';
          const nextPlayer = selectedPlayer();
          selectedSeason = availableSeasonYears(nextPlayer, 'A')[0] || CURRENT_YEAR;
          activatePlayerStatsProfile(nextPlayer, selectedSeason, selectedLevel);
          await loadRecord();
        } else {
          localStorage.removeItem('baseballSelectedPlayerId');
        }
      }

      renderAll();
      renderDeletePlayerList();
      setStatus(`已刪除球員 #${player.number} ${player.name}。`);
      return true;
    }

    async function deleteSelectedPlayer() {
      const player = selectedPlayer();
      if (!player) return;
      await deletePlayerById(player.id);
    }

    function renderDeletePlayerList() {
      if (!els.deletePlayerList) return;
      const list = [...players].sort((a,b) => String(a.number || '').localeCompare(String(b.number || ''), 'zh-Hant', { numeric:true }));
      els.deletePlayerList.innerHTML = list.length ? list.map(player => {
        const meta = playerSourceMeta(player);
        return `
          <button class="press-btn player-search-result" type="button" data-delete-player-id="${player.id}">
            <span class="result-number">#${escapeHtml(player.number)}</span>
            <span class="result-main">
              <span class="result-name">${escapeHtml(player.name)}</span>
              <span class="result-meta">${escapeHtml(meta || '未連結中職資料')}</span>
            </span>
          </button>`;
      }).join('') : '<div class="empty">目前沒有球員。</div>';

      els.deletePlayerList.querySelectorAll('[data-delete-player-id]').forEach(button => {
        button.addEventListener('click', async () => {
          await deletePlayerById(button.dataset.deletePlayerId);
          if (!players.length) els.deletePlayerDialog?.close();
        });
      });
    }

    function hitterInput(label, key, value) {
      return `<label class="field">${label}<input id="base-${key}" type="number" min="0" step="1" value="${Number(value) || 0}" /></label>`;
    }

    function pitcherInput(label, key, value) { return hitterInput(label, key, value); }
    function hitterReadonly(label, value) {
      return `<label class="field">${label}<input type="number" value="${Number(value) || 0}" readonly /></label>`;
    }

    function readNonNegative(id) {
      const el = document.getElementById(id);
      const value = Number(el?.value || 0);
      if (!Number.isFinite(value) || value < 0) throw new Error('數值不可小於 0');
      return Math.floor(value);
    }

    function validateHitterBaseStats(stats) {
      if (stats.hr > stats.rbi) throw new Error('全壘打數不可大於打點');
      if (stats.hr > stats.runs) throw new Error('全壘打數不可大於得分');

      const recordedPlateAppearances =
        stats.ab + stats.bb + stats.ibb + stats.hbp + stats.sacBunt + stats.sacFly;
      if (recordedPlateAppearances > stats.pa) {
        throw new Error('打數、四壞、故意四壞、死球與兩種犧牲的合計不可大於打席');
      }
    }

