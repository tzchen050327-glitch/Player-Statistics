    function renderToday(player) {
      const todayRole = activeTodayRole(player);
      todayRoleView = todayRole;

      const projected = projectedPlayerStatsForRole(player, todayRole);
      const stats = todayRole === 'hitter' ? hitterDerived(projected) : pitcherDerived(projected);
      const metricHtml = todayRole === 'hitter'
        ? `<div class="metric"><span>打擊率</span><strong>${fmtBatRate(stats.avg)}</strong></div>
           <div class="metric"><span>上壘率</span><strong>${fmtBatRate(stats.obp)}</strong></div>
           <div class="metric"><span>長打率</span><strong>${fmtBatRate(stats.slg)}</strong></div>`
        : `<div class="metric"><span>WHIP</span><strong>${fmtTwo(stats.whip)}</strong></div>
           <div class="metric"><span>防禦率</span><strong>${fmtTwo(stats.era)}</strong></div>
           <div class="metric"><span>勝／敗</span><strong>${projected.w || 0}／${projected.l || 0}</strong></div>`;

      const appearance = todayRole === 'hitter' ? ensureHitterAppearance() : null;
      const appearanceHtml = todayRole === 'hitter'
        ? `<label class="field" style="margin-top:10px">出賽方式
             <select id="hitterAppearanceMode">
               <option value="bat" ${appearance.mode === 'bat' ? 'selected' : ''}>先發／代打</option>
               <option value="runner" ${appearance.mode === 'runner' ? 'selected' : ''}>代跑</option>
               <option value="defense" ${appearance.mode === 'defense' ? 'selected' : ''}>純代守</option>
             </select>
           </label>`
        : '';

      const scope = playerScope(player);
      const linkedOverseas = scope === 'overseas' && player.externalProvider && player.externalPlayerId;
      const opponentField = scope === 'overseas'
        ? `<label class="field">今日對手
             <input id="opponentInput" type="text" maxlength="60" value="${escapeAttr(currentRecord.opponent || '')}" placeholder="輸入對手球隊" />
           </label>`
        : `<label class="field">今日對手
             <select id="opponentInput">${opponentOptions(currentRecord.opponent || '')}</select>
           </label>`;

      const importButton = player.cpblAcnt
        ? `<div class="section-actions" style="margin-top:8px"><button id="importCpblDailyBtn" class="press-btn primary">抓取 ${escapeHtml(els.gameDate.value.replaceAll('-', '/'))} 中職資料</button></div>
           <div class="small" style="margin-top:6px">會先查一軍，當日一軍無出賽再自動查二軍；若同場有打擊與投球，兩邊會一次匯入。${els.gameDate.value !== localISODate() ? ' 歷史日期只匯入該場資料，不會寫入球員累積數據。' : ''}</div>`
        : linkedOverseas
          ? `<div class="section-actions" style="margin-top:8px"><button id="importExternalDailyBtn" class="press-btn primary">抓取 ${escapeHtml(els.gameDate.value.replaceAll('-', '/'))} ${escapeHtml(overseasProviderLabel(player.externalProvider))} 資料</button></div>
             <div class="small" style="margin-top:6px">${['NPB','KBO'].includes(String(player.externalProvider||'').toUpperCase()) ? '會先查一軍，當日一軍無出賽再自動查二軍。' : ''} 若同場同時有打擊與投球，兩邊會一次匯入；單場資料不會重複累加到已同步的賽季成績。</div>`
          : '';

      const roles = todayAvailableRoles(player);
      const roleSwitchHtml = roles.length > 1
        ? `<div class="level-role-switch" style="margin-top:14px" aria-label="當日成績類型">
             ${roles.map(role => `
               <button type="button"
                 class="level-role-btn ${role === todayRole ? 'active' : ''}"
                 data-today-role="${role}">
                 ${role === 'pitcher' ? '投球成績' : '打擊成績'}
               </button>`).join('')}
           </div>`
        : '';

      els.content.innerHTML = `
        <h2>#${escapeHtml(player.number)} ${escapeHtml(player.name)}｜今日狀況</h2>
        ${opponentField}
        ${importButton}
        ${roleSwitchHtml}
        ${appearanceHtml}
        <div class="metrics">${metricHtml}</div>
        <div id="todaySpecific"></div>`;

      const opponentInput = document.getElementById('opponentInput');
      if (scope !== 'overseas') syncOpponentSelectColor(opponentInput);
      opponentInput.addEventListener('change', async () => {
        currentRecord.opponent = opponentInput.value;
        if (scope !== 'overseas') syncOpponentSelectColor(opponentInput);
        await saveRecord();
        await renderCanvas();
      });
      if (scope === 'overseas') {
        opponentInput.addEventListener('input', () => {
          currentRecord.opponent = opponentInput.value;
          renderCanvas();
        });
      }

      document.querySelectorAll('[data-today-role]').forEach(button => {
        button.addEventListener('click', async () => {
          const nextRole = button.dataset.todayRole === 'pitcher' ? 'pitcher' : 'hitter';
          if (nextRole === todayRoleView) return;
          todayRoleView = nextRole;
          renderToday(player);
          await renderCanvas();
        });
      });

      document.getElementById('importCpblDailyBtn')?.addEventListener('click', async () => {
        try {
          await importCpblDaily(player);
        } catch (error) {
          setStatus(error.message || '抓取當日中職資料失敗。', true);
        }
      });

      document.getElementById('importExternalDailyBtn')?.addEventListener('click', async event => {
        const btn = event.currentTarget;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '正在抓取…';
        try {
          await importExternalDaily(player);
        } catch (error) {
          setStatus(error?.message || '抓取國外聯盟當日資料失敗。', true);
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });

      const appearanceMode = document.getElementById('hitterAppearanceMode');
      if (appearanceMode) {
        appearanceMode.addEventListener('change', async () => {
          const appearance = ensureHitterAppearance();
          appearance.mode = appearanceMode.value;
          await saveRecord();
          renderHitterToday();
          await renderCanvas();
        });
      }

      if (todayRole === 'hitter') renderHitterToday();
      else renderPitcherToday();
    }

    function renderHitterSubstitutionToday() {
      const host = document.getElementById('todaySpecific');
      const appearance = ensureHitterAppearance();
      const isRunner = appearance.mode === 'runner';
      const customInning = Number(appearance.inning) > 12 ? appearance.inning : '';
      const positionField = isRunner
        ? `<label id="subPositionWrap" class="field ${appearance.continueDefense ? '' : 'hidden'}">守備位置
             <select id="subPosition">${defensivePositionOptions(appearance.position)}</select>
           </label>`
        : `<label class="field">守備位置
             <select id="subPosition">${defensivePositionOptions(appearance.position)}</select>
           </label>`;

      host.innerHTML = `
        <h3>${isRunner ? '代跑紀錄' : '純代守紀錄'}</h3>
        <div class="panel" style="box-shadow:none;padding:14px;background:#f8fafc">
          <div class="grid four">
            <label class="field">局數
              <select id="subInning">${substitutionInningOptions(appearance.inning)}</select>
            </label>
            <label id="subOtherInningWrap" class="field ${Number(appearance.inning) > 12 ? '' : 'hidden'}">其他局數
              <input id="subOtherInning" type="number" min="1" step="1" inputmode="numeric" value="${escapeAttr(customInning)}" />
            </label>
            <label class="field">上／下半局
              <div class="half-switch">
                <button type="button" class="half-btn ${appearance.half === 'top' ? 'active' : ''}" data-sub-half="top">上半</button>
                <button type="button" class="half-btn ${appearance.half === 'bottom' ? 'active' : ''}" data-sub-half="bottom">下半</button>
              </div>
            </label>
            <label class="field">原棒次
              <select id="subBattingOrder">${battingOrderOptions(appearance.battingOrder)}</select>
            </label>
            ${positionField}
          </div>
          ${isRunner ? `<label class="check sub-check"><input id="subContinueDefense" type="checkbox" ${appearance.continueDefense ? 'checked' : ''} /> 下一個半局接替守備</label>` : ''}
        </div>`;

      const inningSelect = document.getElementById('subInning');
      const otherWrap = document.getElementById('subOtherInningWrap');
      const otherInput = document.getElementById('subOtherInning');

      inningSelect.addEventListener('change', async () => {
        if (inningSelect.value === '__other__') {
          otherWrap.classList.remove('hidden');
          if (!otherInput.value) otherInput.value = Number(appearance.inning) > 12 ? appearance.inning : '13';
          appearance.inning = otherInput.value;
        } else {
          otherWrap.classList.add('hidden');
          appearance.inning = inningSelect.value;
        }
        await saveRecord();
        await renderCanvas();
      });

      otherInput.addEventListener('input', () => {
        const value = Math.floor(Number(otherInput.value));
        if (Number.isFinite(value) && value >= 1) {
          appearance.inning = String(value);
          renderCanvas();
        }
      });

      otherInput.addEventListener('change', async () => {
        const value = Math.floor(Number(otherInput.value));
        if (!Number.isFinite(value) || value < 1) {
          await showAppAlert('其他局數請輸入正整數。', { title: '輸入有誤', tone: 'warning' });
          otherInput.value = Number(appearance.inning) > 12 ? appearance.inning : '13';
          return;
        }
        appearance.inning = String(value);
        otherInput.value = String(value);
        await saveRecord();
        await renderCanvas();
      });

      document.querySelectorAll('[data-sub-half]').forEach(button => {
        button.addEventListener('click', async () => {
          appearance.half = button.dataset.subHalf;
          document.querySelectorAll('[data-sub-half]').forEach(item => item.classList.toggle('active', item === button));
          await saveRecord();
          await renderCanvas();
        });
      });

      document.getElementById('subBattingOrder').addEventListener('change', async event => {
        appearance.battingOrder = event.target.value;
        await saveRecord();
        await renderCanvas();
      });

      document.getElementById('subPosition').addEventListener('change', async event => {
        appearance.position = event.target.value;
        await saveRecord();
        await renderCanvas();
      });

      const continueDefense = document.getElementById('subContinueDefense');
      if (continueDefense) {
        continueDefense.addEventListener('change', async () => {
          appearance.continueDefense = continueDefense.checked;
          document.getElementById('subPositionWrap').classList.toggle('hidden', !continueDefense.checked);
          await saveRecord();
          await renderCanvas();
        });
      }
    }

    function officialHitterRbiSummary(record = currentRecord) {
      const official = Math.max(0, Number(record?.internationalHitterGame?.rbi) || 0);
      const attributed = (Array.isArray(record?.hitterPAs) ? record.hitterPAs : [])
        .reduce((sum, pa) => sum + Math.max(0, Number(pa?.rbi) || 0), 0);
      return {
        official,
        attributed,
        unattributed: Math.max(0, official - attributed)
      };
    }

    function kboHitterRbiNeedsAggregateFallback(player, record = currentRecord) {
      if (!player || playerScope(player) !== 'overseas') return false;
      if (String(player.externalProvider || '').toUpperCase() !== 'KBO') return false;
      const summary = officialHitterRbiSummary(record);
      return summary.official > 0 && summary.unattributed > 0;
    }

    function renderHitterToday() {
      const player = selectedPlayer();
      const appearance = ensureHitterAppearance();
      if (appearance.mode !== 'bat') {
        renderHitterSubstitutionToday();
        return;
      }
      const host = document.getElementById('todaySpecific');
      const officialBox = currentRecord?.internationalHitterGame;
      const aggregateOnly = Boolean(currentRecord?.externalReadOnlyImport && officialBox && !currentRecord.hitterPAs.length);
      const aggregateFields = aggregateOnly ? [
        ['打席', officialBox.pa], ['打數', officialBox.ab], ['安打', officialBox.hits], ['打點', officialBox.rbi],
        ['得分', officialBox.runs], ['全壘打', officialBox.hr], ['保送', officialBox.bb], ['死球', officialBox.hbp],
        ['三振', officialBox.k], ['二安', officialBox.double], ['三安', officialBox.triple], ['失誤', officialBox.errors]
      ] : [];
      const officialAggregateHtml = aggregateOnly ? `
        <h3>官方單場打擊成績</h3>
        <div class="small" style="margin-bottom:10px">目前來源只確認到 Box Score 彙總；你仍可在下方手動補逐打席，補完後戰報會改用逐打席顯示。</div>
        <div class="grid four" style="margin-bottom:14px">
          ${aggregateFields.map(([label,value]) => `<label class="field">${escapeHtml(label)}<input type="text" value="${escapeAttr(String(Number(value)||0))}" readonly /></label>`).join('')}
        </div>` : '';
      const rows = currentRecord.hitterPAs.map((pa, index) => `
        <div class="pa-row">
          <div class="pa-no">${index + 1}</div>
          <div class="pa-result">${escapeHtml(paLabel(pa))}</div>
          <div class="pa-rbi">${pa.rbi ? `${pa.rbi} 打點` : ''}</div>
          <button class="press-btn edit-btn" data-edit-pa="${index}">編輯</button>
          <button class="press-btn danger" data-delete-pa="${index}">刪除</button>
        </div>`).join('');

      const rbiSummary = officialHitterRbiSummary(currentRecord);
      const kboRbiNote = kboHitterRbiNeedsAggregateFallback(player, currentRecord)
        ? `<div class="small" style="margin:-2px 2px 12px;color:#8b651f;font-weight:800">KBO 官方 Box：本場共 ${rbiSummary.official} 打點；其中 ${rbiSummary.attributed} 打點可對應到特定打席，其餘以官方總打點顯示。</div>`
        : '';

      host.innerHTML = `
        ${officialAggregateHtml}
        <h3>${aggregateOnly ? '手動補逐打席' : '逐打席紀錄'}</h3>
        <div class="pa-list">${rows || '<div class="small" style="padding:8px 2px 12px">目前沒有逐打席，可直接在下方新增。</div>'}</div>
        ${kboRbiNote}
        <div class="panel" style="box-shadow:none;padding:14px;background:#f8fafc">
          <h3 style="margin-top:0">第 ${currentRecord.hitterPAs.length + 1} 打席</h3>
          <div class="grid four">
            <label class="field">大分類
              <select id="paMajor">
                <option value="onbase">上壘</option>
                <option value="out">出局</option>
              </select>
            </label>
            <label class="field">小分類
              <select id="paResult"></select>
            </label>
            <label id="paPositionWrap" class="field hidden">守備位置
              <select id="paPosition"></select>
            </label>
            <label class="field">打點
              <select id="paRbi">${numberOptions(4, 0)}</select>
            </label>
          </div>
          <div class="section-actions">
            <button id="confirmPaBtn" class="press-btn primary">確定此打席</button>
          </div>
        </div>`;

      const major = document.getElementById('paMajor');
      const result = document.getElementById('paResult');
      const posWrap = document.getElementById('paPositionWrap');
      const pos = document.getElementById('paPosition');
      const rbi = document.getElementById('paRbi');

      function selectedPaParts() {
        const [code, ...officialParts] = String(result.value || '').split('::');
        return { code, officialAction: officialParts.join('::') };
      }

      function refreshRbiOptions() {
        const previous = Number(rbi.value) || 0;
        const { code } = selectedPaParts();
        let min = 0;
        let max = 4;
        const noRbiResults = new Set(['K', 'KREACH', 'DP', 'TP', 'INT', 'OUT']);
        if (['BB', 'IBB', 'HBP', 'CI'].includes(code)) max = 1;
        if (code === 'HR') min = 1;
        if (noRbiResults.has(code)) min = max = 0;

        let html = '';
        for (let value = min; value <= max; value++) {
          html += `<option value="${value}">${value}</option>`;
        }
        rbi.innerHTML = html;
        rbi.value = String(Math.min(max, Math.max(min, previous)));
        rbi.disabled = noRbiResults.has(code);
      }

      function refreshResults() {
        const onbase = [
          ['1B','一安'],['1B::內安','內安'],['1B::場安','場安'],
          ['2B','二安'],['2B::內二','內二'],['2B::場二','場二'],
          ['3B','三安'],['3B::內三','內三'],['3B::場三','場三'],
          ['HR','全壘打'],['HR::全打','全打'],['HR::內全','內全'],
          ['BB','四壞'],['IBB','故意四壞'],['HBP','死球'],
          ['FC','野選'],
          ['E','失誤'],['E::投失','投失'],['E::捕失','捕失'],['E::一失','一失'],['E::二失','二失'],['E::三失','三失'],['E::游失','游失'],['E::左失','左失'],['E::中失','中失'],['E::右失','右失'],['E::雙誤','雙誤'],
          ['CI::礙打','礙打'],['KREACH::不死三振','不死三振'],['OBS','礙跑']
        ];
        const out = [
          ['K','三振'],['GO','滾地出局'],['FO','飛球出局'],['FO::內飛','內飛'],['FO::界飛','界飛'],
          ['DP','雙殺'],['TP','三殺'],
          ['SH','犧牲短打'],['SH::犧短','犧短'],['SH::犧短誤','犧短誤'],['SH::犧選','犧選'],['SH::犧選誤','犧選誤'],
          ['SF','犧牲高飛'],['SF::犧飛','犧飛'],['SF::界犧飛','界犧飛'],['SF::犧飛誤','犧飛誤'],
          ['INT','礙守'],['OUT::裁決','裁決'],['OUT::違規','違規'],['OUT::觸球','觸球'],['OUT::觸傳球','觸傳球'],['OUT::三呎線','三呎線']
        ];
        const list = major.value === 'onbase' ? onbase : out;
        result.innerHTML = list.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
        refreshPosition();
        refreshRbiOptions();
      }

      function refreshPosition() {
        const { code, officialAction } = selectedPaParts();
        const needs = (code === 'GO' || code === 'FO') && !officialAction;
        posWrap.classList.toggle('hidden', !needs);
        if (!needs) return;
        const positions = code === 'FO'
          ? [['一','一飛'],['二','二飛'],['三','三飛'],['投','投飛'],['捕','捕飛'],['游','游飛'],['左','左飛'],['中','中飛'],['右','右飛'],['內','內飛'],['界','界飛']]
          : [['一','一滾'],['二','二滾'],['三','三滾'],['投','投滾'],['捕','捕滾'],['游','游滾'],['左','左滾'],['中','中滾'],['右','右滾']];
        pos.innerHTML = positions.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
      }

      major.addEventListener('change', refreshResults);
      result.addEventListener('change', () => {
        refreshPosition();
        refreshRbiOptions();
      });
      refreshResults();

      document.getElementById('confirmPaBtn').addEventListener('click', async () => {
        const { code, officialAction } = selectedPaParts();
        const rbiValue = Number(rbi.value) || 0;
        if (['BB', 'IBB', 'HBP', 'CI'].includes(code) && rbiValue > 1) {
          await showAppAlert('此上壘方式最多只能有 1 打點。', { title: '打點設定有誤', tone: 'warning' });
          return;
        }
        if (code === 'HR' && rbiValue < 1) {
          await showAppAlert('全壘打至少要有 1 打點。', { title: '打點設定有誤', tone: 'warning' });
          return;
        }
        if (['K', 'KREACH', 'DP', 'TP', 'INT', 'OUT'].includes(code) && rbiValue !== 0) {
          await showAppAlert('此出局／特殊結果不可設定打點。', { title: '打點設定有誤', tone: 'warning' });
          return;
        }
        currentRecord.hitterPAs.push({
          id: uid(), code,
          position: ((code === 'GO' || code === 'FO') && !officialAction) ? pos.value : '',
          rbi: rbiValue,
          cpblOfficialAction: officialAction
        });
        await saveRecord();
        renderAll();
      });

      host.querySelectorAll('[data-delete-pa]').forEach(btn => {
        btn.addEventListener('click', async () => {
          currentRecord.hitterPAs.splice(Number(btn.dataset.deletePa), 1);
          await saveRecord();
          renderAll();
        });
      });

      host.querySelectorAll('[data-edit-pa]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const index = Number(btn.dataset.editPa);
          const pa = currentRecord.hitterPAs[index];
          currentRecord.hitterPAs.splice(index, 1);
          await saveRecord();
          renderAll();
          setTimeout(() => fillPaForm(pa), 0);
        });
      });
    }

    function fillPaForm(pa) {
      const onbaseCodes = ['1B','2B','3B','HR','BB','IBB','HBP','CI','FC','E','KREACH','OBS'];
      const major = document.getElementById('paMajor');
      const result = document.getElementById('paResult');
      if (!major || !result) return;
      major.value = onbaseCodes.includes(pa.code) ? 'onbase' : 'out';
      major.dispatchEvent(new Event('change'));
      const officialValue = pa.cpblOfficialAction ? `${pa.code}::${pa.cpblOfficialAction}` : pa.code;
      result.value = Array.from(result.options).some(option => option.value === officialValue) ? officialValue : pa.code;
      result.dispatchEvent(new Event('change'));
      const pos = document.getElementById('paPosition');
      if (pos && pa.position) pos.value = pa.position;
      document.getElementById('paRbi').value = pa.rbi || 0;
    }

    function renderPitcherToday() {
      const player = selectedPlayer();
      const g = currentRecord.pitcherGame;
      const result = pitcherResult(g);
      const combinedFreePasses = Boolean(currentRecord?.externalWalksCombined);
      const host = document.getElementById('todaySpecific');
      host.innerHTML = `
        <h3>投球戰績</h3>
        <div class="grid four">
          <label class="field">投球局數
            <select id="pInnings">${pitcherInningsOptions(g.innings)}</select>
          </label>
          <label id="pInningsOtherWrap" class="field ${isPresetPitcherInnings(g.innings) ? 'hidden' : ''}">其他局數
            <input id="pInningsOther" type="text" inputmode="decimal" placeholder="例如 0.2、13.1" value="${isPresetPitcherInnings(g.innings) ? '' : escapeAttr(g.innings)}" />
          </label>
          <label class="field">三振<select id="pK">${numberOptions(36, g.k)}</select></label>
          <label class="field">${combinedFreePasses ? '四死球合計（KBO二軍）' : '保送(故意四壞球)'}<select id="pBB">${numberOptions(36, g.bb)}</select></label>
          <label class="field">被安打<select id="pH">${numberOptions(36, g.h)}</select></label>
          <label class="field">${combinedFreePasses ? '死球（已含於四死球合計）' : '死球'}<select id="pHBP" ${combinedFreePasses ? 'disabled' : ''}>${numberOptions(10, g.hbp)}</select></label>
          <label class="field">其他上壘(判斷完全比賽用)<select id="pOtherReach">${numberOptions(10, g.otherReach || 0)}</select></label>
          <label class="field">失分<select id="pR">${numberOptions(15, g.r)}</select></label>
          <label class="field">自責分<select id="pER">${numberOptions(Math.min(15, Number(g.r) || 0), Math.min(Number(g.er) || 0, Number(g.r) || 0))}</select></label>
          <label class="field">用球數（前段）<select id="pPitchTens">${numberOptions(15, g.pitchTens)}</select></label>
          <label class="field">用球數（個位）<select id="pPitchOnes">${numberOptions(9, g.pitchOnes)}</select></label>
          <label class="field">最後一格顯示
            <select id="pLastMetric">${pitcherLastMetricOptions(player?.pitcherLastMetric)}</select>
          </label>
          <label class="field">戰報顯示失分
            <select id="pShowRuns">
              <option value="0" ${g.showRuns ? '' : 'selected'}>否</option>
              <option value="1" ${g.showRuns ? 'selected' : ''}>是</option>
            </select>
          </label>
        </div>

        <h3>特殊紀錄</h3>
        <div class="inline-checks">
          ${checkHtml('pCG','完投',g.cg)}
          ${checkHtml('pSHO','完封',g.sho)}
          ${checkHtml('pNoWH','無四死球',g.noWalkHbp)}
        </div>

        <h3>投手結果（五選一）</h3>
        <div class="inline-checks">
          ${resultRadioHtml('pResultSV','SV','救援成功',result)}
          ${resultRadioHtml('pResultHLD','HLD','中繼成功',result)}
          ${resultRadioHtml('pResultW','W','勝',result)}
          ${resultRadioHtml('pResultL','L','敗',result)}
          ${resultRadioHtml('pResultND','ND','無關勝敗',result)}
        </div>

        <h3>其他結果</h3>
        <div class="inline-checks">
          ${checkHtml('pBSV','救援失敗',g.bsv)}
          ${checkHtml('pRainCalled','因雨提前裁定',g.rainCalled)}
        </div>`;

      const inningPreset = document.getElementById('pInnings');
      const inningOther = document.getElementById('pInningsOther');
      const inningOtherWrap = document.getElementById('pInningsOtherWrap');
      inningPreset.addEventListener('change', async () => {
        const isOther = inningPreset.value === '__other__';
        inningOtherWrap.classList.toggle('hidden', !isOther);
        if (isOther) {
          if (isPresetPitcherInnings(g.innings)) inningOther.value = '';
          inningOther.focus();
          return;
        }
        await updatePitcherGameFromUI();
      });
      inningOther.addEventListener('change', async () => {
        if (ipToOuts(inningOther.value) === null) {
          await showAppAlert('投球局數請輸入整數，或以 .1／.2 表示未滿一局，例如 0.2、13.1。', { title: '投球局數格式錯誤', tone: 'warning' });
          inningOther.value = g.innings;
          return;
        }
        await updatePitcherGameFromUI();
      });
      const lastMetricSelect = document.getElementById('pLastMetric');
      lastMetricSelect.addEventListener('change', async () => {
        if (!player) return;
        player.pitcherLastMetric = normalizePitcherLastMetric(lastMetricSelect.value);
        await savePlayer(player);
        await renderCanvas();
      });

      const ids = ['pK','pBB','pH','pHBP','pOtherReach','pR','pER','pPitchTens','pPitchOnes','pShowRuns'];
      ids.forEach(id => document.getElementById(id).addEventListener('change', updatePitcherGameFromUI));
      ['pCG','pSHO','pNoWH','pBSV','pRainCalled'].forEach(id => document.getElementById(id).addEventListener('change', async () => {
        syncPitcherDependencies(id);
        await updatePitcherGameFromUI();
      }));
      document.querySelectorAll('input[name="pitcherResult"]').forEach(r => r.addEventListener('change', async event => {
        syncPitcherDependencies(event.target.id);
        await updatePitcherGameFromUI();
      }));
      syncPitcherDependencies();
      if (Number(g.pitchTens) === 15) document.getElementById('pPitchOnes').disabled = true;
    }

    function checkHtml(id, label, checked) {
      return `<label class="check"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''} /> ${label}</label>`;
    }

    function radioHtml(name, value, label, selected) {
      return `<label class="check"><input type="radio" name="${name}" value="${value}" ${selected === value ? 'checked' : ''} /> ${label}</label>`;
    }

    function resultRadioHtml(id, value, label, selected) {
      return `<label class="check"><input id="${id}" type="radio" name="pitcherResult" value="${value}" ${selected === value ? 'checked' : ''} /> ${label}</label>`;
    }

    function syncPitcherDependencies(changedId = '') {
      const cg = document.getElementById('pCG');
      const sho = document.getElementById('pSHO');
      const noWH = document.getElementById('pNoWH');
      const resultSV = document.getElementById('pResultSV');
      const resultHLD = document.getElementById('pResultHLD');
      const resultND = document.getElementById('pResultND');
      const bsv = document.getElementById('pBSV');
      const inningsInput = document.getElementById('pInnings');
      const runsInput = document.getElementById('pR');
      const erInput = document.getElementById('pER');
      const rainCalled = document.getElementById('pRainCalled');
      if (!cg || !sho || !noWH || !resultSV || !resultHLD || !resultND || !bsv || !inningsInput || !runsInput || !erInput) return;

      const outs = ipToOuts(getPitcherInningsFromUI()) || 0;
      const runs = Number(runsInput.value) || 0;
      const cgEligible = outs >= 15;
      const shoEligible = cg.checked && outs >= 15 && runs === 0;
      const rainCalledEligible = cg.checked && outs >= 15;

      if (!rainCalledEligible) rainCalled.checked = false;
      rainCalled.disabled = !rainCalledEligible;

      if (!cgEligible) cg.checked = false;
      cg.disabled = !cgEligible;

      if (!shoEligible) sho.checked = false;
      sho.disabled = !shoEligible;

      if (!cg.checked) { sho.checked = false; noWH.checked = false; }
      if (!sho.checked) noWH.checked = false;
      noWH.disabled = !sho.checked;

      if (cg.checked && (resultSV.checked || resultHLD.checked)) resultND.checked = true;
      resultSV.disabled = cg.checked;
      resultHLD.disabled = cg.checked;

      if (cg.checked) bsv.checked = false;
      bsv.disabled = cg.checked;

      if (changedId === 'pBSV' && bsv.checked && (resultSV.checked || resultHLD.checked)) {
        resultND.checked = true;
      }
      if ((changedId === 'pResultSV' || changedId === 'pResultHLD') && (resultSV.checked || resultHLD.checked)) {
        bsv.checked = false;
      }
      if (resultSV.checked || resultHLD.checked) bsv.checked = false;

      if ((Number(erInput.value) || 0) > runs) erInput.value = String(runs);
    }

    async function updatePitcherGameFromUI() {
      const g = currentRecord.pitcherGame;
      const inningsValue = getPitcherInningsFromUI();
      if (ipToOuts(inningsValue) === null) return;
      g.innings = inningsValue;
      g.k = Number(document.getElementById('pK').value);
      g.bb = Number(document.getElementById('pBB').value);
      g.h = Number(document.getElementById('pH').value);
      g.hbp = Number(document.getElementById('pHBP').value);
      g.otherReach = Number(document.getElementById('pOtherReach').value);
      g.r = Number(document.getElementById('pR').value);
      g.er = Math.min(g.r, Number(document.getElementById('pER').value));
      g.showRuns = document.getElementById('pShowRuns')?.value === '1';
      g.pitchTens = Number(document.getElementById('pPitchTens').value);
      g.pitchOnes = Number(document.getElementById('pPitchOnes').value);
      if (g.pitchTens === 15) {
        g.pitchOnes = 0;
        document.getElementById('pPitchOnes').value = '0';
        document.getElementById('pPitchOnes').disabled = true;
      } else {
        document.getElementById('pPitchOnes').disabled = false;
      }
      syncPitcherDependencies('metrics');
      g.cg = document.getElementById('pCG').checked;
      g.sho = document.getElementById('pSHO').checked;
      g.noWalkHbp = document.getElementById('pNoWH').checked;
      g.result = document.querySelector('input[name="pitcherResult"]:checked')?.value || 'ND';
      g.hld = g.result === 'HLD';
      g.sv = g.result === 'SV';
      g.bsv = document.getElementById('pBSV').checked && !g.hld && !g.sv;
      g.rainCalled = document.getElementById('pRainCalled').checked;
      g.decision = ['W','L','ND'].includes(g.result) ? g.result : 'ND';
      await saveRecord();
      renderAll();
    }

