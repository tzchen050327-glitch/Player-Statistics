    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    }

    function escapeAttr(value) { return escapeHtml(value); }

    els.backHomeBtn?.addEventListener('click', () => {
      currentPage = 'home';
      renderAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    els.majorLevelBtn?.addEventListener('click', () => switchPlayerLevel('A'));
    els.minorLevelBtn?.addEventListener('click', () => switchPlayerLevel('D'));
    els.seasonSelect?.addEventListener('change', () => {
      syncAppPickerLabels();
      switchPlayerSeason(els.seasonSelect.value);
    });

    function competitionOptionsHtml(scope, selected = '') {
      const options = specialOptionsForScope(scope);
      return options.map(option =>
        `<option value="${escapeHtml(option)}" ${selected === option ? 'selected' : ''}>${escapeHtml(option)}</option>`
      ).join('');
    }

    function updateAddPlayerScopeUI(scope = homeZone) {
      scope = scope === 'international' || scope === 'overseas' ? scope : 'cpbl';
      if (els.newPlayerScope) els.newPlayerScope.value = scope;
      const external = scope !== 'cpbl';
      els.newPlayerExternalFields?.classList.toggle('hidden', !external);

      if (els.newPlayerCompetition) {
        const previous = String(els.newPlayerCompetition.value || '');
        const options = specialOptionsForScope(scope);
        els.newPlayerCompetition.innerHTML = external ? competitionOptionsHtml(scope, previous) : '';
        if (external && options.includes(previous)) els.newPlayerCompetition.value = previous;
      }
      if (els.newPlayerExternalYear && !els.newPlayerExternalYear.value) {
        els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      }

      const competition = String(els.newPlayerCompetition?.value || '');
      const provider = overseasProvider(competition);

      if (els.newPlayerCompetitionLabel?.childNodes?.[0]) {
        els.newPlayerCompetitionLabel.childNodes[0].nodeValue = scope === 'international' ? '賽事\n          ' : '聯盟\n          ';
      }
      if (els.newPlayerTeamLabel?.childNodes?.[0]) {
        els.newPlayerTeamLabel.childNodes[0].nodeValue = scope === 'international' ? '代表隊\n          ' : '球隊\n          ';
      }
      if (els.newPlayerYearLabel?.childNodes?.[0]) {
        els.newPlayerYearLabel.childNodes[0].nodeValue = scope === 'international' ? '屆別年份\n          ' : '賽季年份\n          ';
      }
      if (els.newPlayerExternalTeam) {
        els.newPlayerExternalTeam.placeholder = scope === 'international'
          ? '例如：中華台北、日本、韓國'
          : '例如：Los Angeles Dodgers';
      }

      const cpblButton = document.getElementById('createCpblPlayerBtn');
      const externalButton = document.getElementById('createExternalPlayerBtn');
      const manualButton = document.getElementById('createManualPlayerBtn');

      cpblButton?.classList.toggle('hidden', scope !== 'cpbl');
      externalButton?.classList.toggle('hidden', !(scope === 'overseas' && provider));
      if (externalButton && provider) externalButton.textContent = `搜尋 ${overseasProviderLabel(provider)} 資料`;

      if (manualButton) {
        manualButton.textContent = scope === 'cpbl' ? '純新增' : scope === 'overseas' && provider ? '手動建立' : '建立球員';
      }

      if (els.newPlayerScopeHelp) {
        els.newPlayerScopeHelp.textContent = scope === 'overseas' && provider
          ? `可直接用中文／英文／日文／韓文姓名搜尋 ${overseasProviderLabel(provider)}；建立後會自動同步賽季資料，當日資料可在球員頁匯入。`
          : scope === 'international'
            ? '國際賽以「賽事 → 屆別 → 代表隊」獨立保存；同一位球員可以在不同屆賽事各自建立紀錄。'
            : external
              ? '此球員會建立在獨立專區，成績、戰報與中職資料分開保存。'
              : '純新增不連結中職；搜尋中職資料會用姓名＋背號查詢。連結官網後會以官方守位決定主要分類；若球員實際有投打兩種紀錄，會自動整合在同一位球員內。';
      }

      if (scope === 'international' || (scope === 'overseas' && !provider)) {
        hideNewPlayerSuggestions();
      }
    }

    function prepareAddPlayerDialog() {
      clearNewPlayerForm();
      updateAddPlayerScopeUI(homeZone);

      if (homeZone === 'international') {
        if (homeSpecialFilter && els.newPlayerCompetition) {
          els.newPlayerCompetition.value = homeSpecialFilter;
          updateAddPlayerScopeUI('international');
        }
        if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = homeInternationalEditionFilter || String(CURRENT_YEAR);
        if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = homeInternationalTeamFilter || '';
      } else if (homeZone === 'overseas') {
        if (els.newPlayerCompetition && homeSpecialFilter) {
          els.newPlayerCompetition.value = homeSpecialFilter;
          updateAddPlayerScopeUI('overseas');
          els.newPlayerCompetition.value = homeSpecialFilter;
          updateAddPlayerScopeUI('overseas');
        }
        if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = '';
        if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      } else {
        if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = '';
        if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      }
      els.addDialog.showModal();
    }

    document.getElementById('addPlayerBtn').addEventListener('click', prepareAddPlayerDialog);

    els.homeZoneSwitch?.querySelectorAll('[data-home-root]').forEach(button => {
      button.addEventListener('click', () => {
        homeRootSection = button.dataset.homeRoot === 'international' ? 'international' : 'pro';
        if (homeRootSection === 'international') {
          homeZone = 'international';
          homeSpecialFilter = '';
          homeInternationalEditionFilter = '';
          homeInternationalTeamFilter = '';
        } else {
          applyHomeProSelection();
        }
        homeTeamFilter = '';
        renderRecentPlayers();
      });
    });

    els.homeProCountrySwitch?.querySelectorAll('[data-pro-country]').forEach(button => {
      button.addEventListener('click', () => {
        const country = button.dataset.proCountry;
        homeProCountry = ['TW','US','JP','KR'].includes(country) ? country : 'TW';
        homeRootSection = 'pro';
        homeTeamFilter = '';
        applyHomeProSelection();
        renderRecentPlayers();
      });
    });

    els.homeUsLeagueSwitch?.querySelectorAll('[data-us-league]').forEach(button => {
      button.addEventListener('click', () => {
        homeUsLeague = button.dataset.usLeague === 'MiLB' ? 'MiLB' : 'MLB';
        homeRootSection = 'pro';
        homeProCountry = 'US';
        applyHomeProSelection();
        renderRecentPlayers();
      });
    });
    document.getElementById('homeSearchPlayerBtn').addEventListener('click', openPlayerSearch);
    document.getElementById('allSearchPlayerBtn').addEventListener('click', openPlayerSearch);
    document.getElementById('batchReportBtn').addEventListener('click', openBatchReportDialog);
    els.playerSearchInput?.addEventListener('input', renderPlayerSearchResults);
    document.getElementById('batchReportSelectAllBtn').addEventListener('click', () => {
      document.querySelectorAll('[data-batch-report-player]').forEach(input => input.checked = true);
    });
    document.getElementById('batchReportClearBtn').addEventListener('click', () => {
      document.querySelectorAll('[data-batch-report-player]').forEach(input => input.checked = false);
    });
    els.batchReportGenerateBtn?.addEventListener('click', () => generateBatchReports({ refreshStats:true, refreshDaily:true }));
    els.batchReportDownloadAllBtn?.addEventListener('click', downloadAllBatchReports);

    let activeAllFilterSelect = null;
    let appToastTimer = null;
    let datePickerView = null;

    function formatPickerDate(value) {
      const raw = String(value || '');
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[1]}/${match[2]}/${match[3]}` : '選擇日期';
    }

    function syncAppPickerLabels() {
      if (els.gameDateButtonText) {
        els.gameDateButtonText.textContent = formatPickerDate(els.gameDate?.value);
      }
      if (els.seasonSelectButtonText) {
        els.seasonSelectButtonText.textContent = selectedOptionLabel(els.seasonSelect) || '選擇賽季';
      }
      if (els.seasonSelectButton) {
        els.seasonSelectButton.disabled = Boolean(els.seasonSelect?.disabled || !els.seasonSelect?.options?.length);
      }
    }

    function localCalendarDate(value = '') {
      const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const date = new Date(year, month, day);
      return Number.isFinite(date.getTime()) ? date : null;
    }

    function calendarIso(year, month, day) {
      return [
        String(year).padStart(4,'0'),
        String(month + 1).padStart(2,'0'),
        String(day).padStart(2,'0')
      ].join('-');
    }

    function renderDatePicker() {
      if (!els.datePickerGrid || !els.datePickerMonthLabel) return;
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      if (!(datePickerView instanceof Date) || !Number.isFinite(datePickerView.getTime())) {
        datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      }

      const year = datePickerView.getFullYear();
      const month = datePickerView.getMonth();
      els.datePickerMonthLabel.textContent = `${year} 年 ${month + 1} 月`;

      const firstDay = new Date(year, month, 1).getDay();
      const days = new Date(year, month + 1, 0).getDate();
      const selectedIso = String(els.gameDate?.value || '');
      const todayIso = localISODate();
      const cells = [];

      for (let i = 0; i < firstDay; i++) {
        cells.push('<span class="app-date-empty" aria-hidden="true"></span>');
      }
      for (let day = 1; day <= days; day++) {
        const iso = calendarIso(year, month, day);
        const classes = [
          'app-date-day',
          iso === todayIso ? 'is-today' : '',
          iso === selectedIso ? 'is-selected' : ''
        ].filter(Boolean).join(' ');
        cells.push(`<button class="${classes}" type="button" role="gridcell" data-picker-date="${iso}" aria-selected="${iso === selectedIso}">${day}</button>`);
      }

      els.datePickerGrid.innerHTML = cells.join('');
      els.datePickerGrid.querySelectorAll('[data-picker-date]').forEach(button => {
        button.addEventListener('click', () => {
          const value = String(button.dataset.pickerDate || '');
          if (!value || !els.gameDate) return;
          els.gameDate.value = value;
          syncAppPickerLabels();
          els.datePickerDialog?.close();
          els.gameDate.dispatchEvent(new Event('change', { bubbles:true }));
        });
      });
    }

    function openDatePicker() {
      const selected = localCalendarDate(els.gameDate?.value) || new Date();
      datePickerView = new Date(selected.getFullYear(), selected.getMonth(), 1);
      renderDatePicker();
      if (els.datePickerDialog && !els.datePickerDialog.open) els.datePickerDialog.showModal();
    }

    function openSeasonPicker() {
      if (!els.seasonSelect || !els.seasonPickerDialog || !els.seasonPickerList || els.seasonSelect.disabled) return;
      const options = Array.from(els.seasonSelect.options);
      els.seasonPickerList.innerHTML = options.length ? options.map((option,index) => {
        const active = option.value === els.seasonSelect.value;
        return `
          <button class="filter-choice-option ${active ? 'active' : ''}" type="button"
                  data-season-option-index="${index}" role="option" aria-selected="${active}">
            <span>${escapeHtml(option.textContent || '')}</span>
            <span class="filter-choice-radio" aria-hidden="true"></span>
          </button>`;
      }).join('') : '<div class="empty">目前沒有可選賽季。</div>';

      els.seasonPickerList.querySelectorAll('[data-season-option-index]').forEach(button => {
        button.addEventListener('click', () => {
          const option = els.seasonSelect?.options?.[Number(button.dataset.seasonOptionIndex)];
          if (!option || !els.seasonSelect) return;
          els.seasonSelect.value = option.value;
          syncAppPickerLabels();
          els.seasonPickerDialog.close();
          els.seasonSelect.dispatchEvent(new Event('change', { bubbles:true }));
        });
      });

      if (!els.seasonPickerDialog.open) els.seasonPickerDialog.showModal();
    }

    function selectedOptionLabel(select) {
      return String(select?.selectedOptions?.[0]?.textContent || '').trim();
    }

    function syncAllFilterTriggerLabels() {
      const levelLabel = els.allLevelFilterButton?.querySelector('[data-filter-label]');
      const teamLabel = els.allTeamFilterButton?.querySelector('[data-filter-label]');
      if (levelLabel) levelLabel.textContent = selectedOptionLabel(els.allLevelFilters) || '全部';
      if (teamLabel) teamLabel.textContent = selectedOptionLabel(els.allTeamFilters) || '全部球隊';
    }

    function openAllFilterChoice(select, title) {
      if (!select || !els.filterChoiceDialog || !els.filterChoiceList) return;
      activeAllFilterSelect = select;
      if (els.filterChoiceTitle) els.filterChoiceTitle.textContent = title;

      els.filterChoiceList.innerHTML = Array.from(select.options).map((option, index) => {
        const active = option.value === select.value;
        return `
          <button class="filter-choice-option ${active ? 'active' : ''}" type="button"
                  data-filter-option-index="${index}" role="option" aria-selected="${active}">
            <span>${escapeHtml(option.textContent || '')}</span>
            <span class="filter-choice-radio" aria-hidden="true"></span>
          </button>`;
      }).join('');

      els.filterChoiceList.querySelectorAll('[data-filter-option-index]').forEach(button => {
        button.addEventListener('click', () => {
          const index = Number(button.dataset.filterOptionIndex);
          const option = activeAllFilterSelect?.options?.[index];
          if (!option || !activeAllFilterSelect) return;
          activeAllFilterSelect.value = option.value;
          activeAllFilterSelect.dispatchEvent(new Event('change', { bubbles:true }));
          els.filterChoiceDialog.close();
        });
      });

      if (!els.filterChoiceDialog.open) els.filterChoiceDialog.showModal();
    }

    function showAppToast(message, duration = 1800) {
      if (!els.appToast || !els.appToastText) return;
      clearTimeout(appToastTimer);
      els.appToastText.textContent = String(message || '已完成');
      els.appToast.classList.remove('show');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => els.appToast.classList.add('show'));
      });
      appToastTimer = setTimeout(() => {
        els.appToast?.classList.remove('show');
      }, Math.max(900, Number(duration) || 1800));
    }

    els.allLevelFilters?.addEventListener('change', () => {
      const value = String(els.allLevelFilters.value || 'ALL');
      homeLevelFilter = ['A','D','OTHER'].includes(value) ? value : 'ALL';
      syncAllFilterTriggerLabels();
      renderAllPlayersDialog();
    });

    els.allTeamFilters?.addEventListener('change', () => {
      homeTeamFilter = String(els.allTeamFilters.value || '');
      syncAllFilterTriggerLabels();
      renderAllPlayersDialog();
    });

    els.allLevelFilterButton?.addEventListener('click', () => openAllFilterChoice(els.allLevelFilters, '選擇類別'));
    els.allTeamFilterButton?.addEventListener('click', () => openAllFilterChoice(els.allTeamFilters, '選擇球隊'));
    els.filterChoiceDialog?.addEventListener('click', event => {
      if (event.target === els.filterChoiceDialog) els.filterChoiceDialog.close();
    });

    els.gameDateButton?.addEventListener('click', openDatePicker);
    els.datePickerPrev?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() - 1, 1);
      renderDatePicker();
    });
    els.datePickerNext?.addEventListener('click', () => {
      if (!(datePickerView instanceof Date)) return openDatePicker();
      datePickerView = new Date(datePickerView.getFullYear(), datePickerView.getMonth() + 1, 1);
      renderDatePicker();
    });
    els.datePickerToday?.addEventListener('click', () => {
      if (!els.gameDate) return;
      els.gameDate.value = localISODate();
      syncAppPickerLabels();
      els.datePickerDialog?.close();
      els.gameDate.dispatchEvent(new Event('change', { bubbles:true }));
    });
    els.datePickerDialog?.addEventListener('click', event => {
      if (event.target === els.datePickerDialog) els.datePickerDialog.close();
    });

    els.seasonSelectButton?.addEventListener('click', openSeasonPicker);
    els.seasonPickerDialog?.addEventListener('click', event => {
      if (event.target === els.seasonPickerDialog) els.seasonPickerDialog.close();
    });

    syncAllFilterTriggerLabels();
    syncAppPickerLabels();

    document.getElementById('allPlayersBtn').addEventListener('click', () => {
      renderAllPlayersDialog();
      els.allDialog.showModal();
    });
    document.getElementById('allDeletePlayerBtn').addEventListener('click', () => {
      renderDeletePlayerList();
      els.allDialog.close();
      els.deletePlayerDialog?.showModal();
    });
    document.querySelectorAll('.dialog-close').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
    els.batchReportDialog?.addEventListener('close', () => {
      // 生成結果的 blob URL 只在視窗開啟期間保留。
      clearBatchReportOutputs();
    });

    function newPlayerFormValues() {
      const scope = els.newPlayerScope?.value === 'international' || els.newPlayerScope?.value === 'overseas'
        ? els.newPlayerScope.value
        : 'cpbl';
      return {
        name: document.getElementById('newPlayerName').value.trim(),
        number: document.getElementById('newPlayerNumber').value.trim(),
        selectedType: document.getElementById('newPlayerType').value,
        scope,
        competition: scope === 'cpbl' ? '' : String(els.newPlayerCompetition?.value || '').trim(),
        externalTeam: scope === 'cpbl' ? '' : String(els.newPlayerExternalTeam?.value || '').trim(),
        externalYear: scope === 'cpbl' ? CURRENT_YEAR : Math.floor(Number(els.newPlayerExternalYear?.value) || CURRENT_YEAR)
      };
    }

    function validateNewPlayer(name, number, scope = 'cpbl', competition = '', deferLinkedDuplicate = false) {
      if (!name || (scope !== 'overseas' && !number)) {
        setStatus(scope === 'overseas' ? '球員名稱要填寫。' : '球員名稱與背號都要填寫。', true);
        return false;
      }
      if (scope !== 'cpbl' && !competition) {
        setStatus('請先選擇賽事／聯盟。', true);
        return false;
      }
      if (!deferLinkedDuplicate && players.some(p =>
        p.name === name
        && p.number === number
        && playerScope(p) === scope
        && (scope === 'cpbl' || playerSpecialCompetition(p) === competition)
      )) {
        setStatus('這個專區已經有相同球員。', true);
        return false;
      }
      return true;
    }

    function hideNewPlayerSuggestions() {
      if (!els.newPlayerSuggestions) return;
      els.newPlayerSuggestions.classList.add('hidden');
      els.newPlayerSuggestions.innerHTML = '';
    }

    function renderNewPlayerSuggestions(items, stateText = '') {
      if (!els.newPlayerSuggestions) return;
      newPlayerSuggestionItems = Array.isArray(items) ? items : [];
      if (stateText) {
        els.newPlayerSuggestions.innerHTML = `<div class="new-player-suggestion-state">${escapeHtml(stateText)}</div>`;
        els.newPlayerSuggestions.classList.remove('hidden');
        return;
      }
      if (!newPlayerSuggestionItems.length) {
        hideNewPlayerSuggestions();
        return;
      }

      els.newPlayerSuggestions.innerHTML = newPlayerSuggestionItems.map((item,index) => {
        const displayName = item.zhName || item.name || '';
        const officialName = item.name && item.name !== displayName ? ` · ${item.name}` : '';
        const meta = item.source === 'cpbl'
          ? ['中職', item.team, item.number ? `#${item.number}` : '', item.position].filter(Boolean).join('｜')
          : [overseasProviderLabel(item.provider), item.twoWay ? '二刀流' : '', item.team, item.number ? `#${item.number}` : '', item.position].filter(Boolean).join('｜');
        return `
          <button type="button" class="new-player-suggestion" role="option" data-suggest-index="${index}">
            <strong>${escapeHtml(displayName)}${escapeHtml(officialName)}</strong>
            <span>${escapeHtml(meta || (item.source === 'cpbl' ? '中職球員' : '國外聯盟球員'))}</span>
          </button>
        `;
      }).join('');
      els.newPlayerSuggestions.classList.remove('hidden');

      els.newPlayerSuggestions.querySelectorAll('[data-suggest-index]').forEach(button => {
        button.addEventListener('click', async () => {
          const item = newPlayerSuggestionItems[Number(button.dataset.suggestIndex)];
          if (!item) return;
          newPlayerSuggestionPicked = true;

          if (item.source === 'cpbl') {
            const acnt = String(item.id || '');
            if (!acnt) return;
            const expectedName = String(item.name || '');
            els.newPlayerName.value = expectedName;
            renderNewPlayerSuggestions([], '正在讀取球員資料…');
            try {
              const data = await cpblRequest('player-profile', { acnt });
              const official = data.player;
              if (!official) throw new Error('讀不到球員資料');
              els.newPlayerName.value = official.name || expectedName;
              els.newPlayerNumber.value = official.number || '';
              if (official.position) {
                els.newPlayerType.value = official.position.includes('投手') ? 'pitcher' : 'hitter';
                newPlayerTypeTouched = false;
              }
              hideNewPlayerSuggestions();
              els.newPlayerNumber.focus();
            } catch (error) {
              hideNewPlayerSuggestions();
              setStatus(error?.message || '球員資料讀取失敗。', true);
            }
            return;
          }

          const provider = String(item.provider || '');
          const id = String(item.id || '');
          if (!provider || !id) return;
          const displayName = item.zhName || item.name || String(els.newPlayerName.value || '').trim();
          els.newPlayerName.value = displayName;
          renderNewPlayerSuggestions([], `正在讀取 ${overseasProviderLabel(provider)} 球員資料…`);

          try {
            const data = await baseballRequest('player-profile', { provider, id });
            const official = data.player || {};
            newExternalSelected = {
              provider,
              id,
              zhName: item.zhName || (/[㐀-鿿]/.test(displayName) ? displayName : ''),
              officialName: official.name || item.name || '',
              name: displayName,
              number: official.number || item.number || '',
              team: official.team || item.team || '',
              position: official.position || item.position || '',
              type: official.type || item.type || 'hitter',
              twoWay: Boolean(official.twoWay || item.twoWay)
            };
            els.newPlayerName.value = newExternalSelected.zhName || newExternalSelected.name || newExternalSelected.officialName;
            els.newPlayerNumber.value = newExternalSelected.number || '';
            if (!newExternalSelected.twoWay) {
              els.newPlayerType.value = newExternalSelected.type === 'pitcher' ? 'pitcher' : 'hitter';
            }
            if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = newExternalSelected.team || '';
            hideNewPlayerSuggestions();
            document.getElementById('createExternalPlayerBtn')?.focus();
          } catch (error) {
            newExternalSelected = null;
            hideNewPlayerSuggestions();
            setStatus(error?.message || '國外聯盟球員資料讀取失敗。', true);
          }
        });
      });
    }

    async function requestNewPlayerSuggestions(query) {
      const requestId = ++newPlayerSuggestRequestId;
      const scope = els.newPlayerScope?.value || 'cpbl';

      try {
        let items = [];
        let emptyText = '';

        if (scope === 'cpbl') {
          const data = await cpblRequest('suggest-players', { query, limit: 10 });
          items = (data.players || []).map(item => ({
            source:'cpbl',
            id:item.acnt || '',
            name:item.name || '',
            number:item.number || '',
            team:item.team || '',
            position:item.position || ''
          }));
          emptyText = '找不到符合的中職球員';
        } else if (scope === 'overseas') {
          const provider = overseasProvider(els.newPlayerCompetition?.value);
          if (!provider) {
            hideNewPlayerSuggestions();
            return;
          }
          const data = await baseballRequest('search-player', {
            provider,
            query,
            year: Number(els.newPlayerExternalYear?.value) || CURRENT_YEAR
          });
          items = (data.players || []).map(item => ({
            source:'external',
            provider:item.provider || provider,
            id:item.id || '',
            name:item.name || '',
            zhName:item.zhName || '',
            number:item.number || '',
            team:item.team || '',
            position:item.position || '',
            type:item.type || '',
            twoWay:Boolean(item.twoWay)
          }));
          emptyText = `找不到符合的 ${overseasProviderLabel(provider)} 球員`;
        } else {
          hideNewPlayerSuggestions();
          return;
        }

        if (requestId !== newPlayerSuggestRequestId) return;
        const latest = String(els.newPlayerName?.value || '').trim();
        if (latest !== query || !latest) return;
        renderNewPlayerSuggestions(items, items.length ? '' : emptyText);
      } catch (error) {
        if (requestId !== newPlayerSuggestRequestId) return;
        hideNewPlayerSuggestions();
        console.warn('球員即時建議失敗', error);
      }
    }

    function clearNewPlayerForm() {
      document.getElementById('newPlayerName').value = '';
      document.getElementById('newPlayerNumber').value = '';
      if (els.newPlayerExternalTeam) els.newPlayerExternalTeam.value = '';
      if (els.newPlayerExternalYear) els.newPlayerExternalYear.value = String(CURRENT_YEAR);
      newPlayerSuggestionPicked = false;
      newExternalSelected = null;
      newPlayerTypeTouched = false;
      newPlayerSuggestionItems = [];
      newPlayerSuggestRequestId++;
      if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
      hideNewPlayerSuggestions();
    }

    document.getElementById('newPlayerType')?.addEventListener('change', () => {
      newPlayerTypeTouched = true;
    });

    els.newPlayerName?.addEventListener('input', () => {
      newPlayerSuggestionPicked = false;
      newExternalSelected = null;
      const scope = els.newPlayerScope?.value || 'cpbl';
      const query = String(els.newPlayerName.value || '').trim();
      const provider = scope === 'overseas' ? overseasProvider(els.newPlayerCompetition?.value) : '';

      if (scope === 'international' || (scope === 'overseas' && !provider)) {
        hideNewPlayerSuggestions();
        return;
      }

      newPlayerSuggestRequestId++;
      if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
      if (!query) {
        hideNewPlayerSuggestions();
        return;
      }

      renderNewPlayerSuggestions([], scope === 'cpbl'
        ? '搜尋中職球員…'
        : `搜尋 ${overseasProviderLabel(provider)} 球員…`);
      newPlayerSuggestTimer = setTimeout(() => requestNewPlayerSuggestions(query), 300);
    });

    els.newPlayerScope?.addEventListener('change', () => {
      newExternalSelected = null;
      updateAddPlayerScopeUI(els.newPlayerScope.value);
    });

    els.newPlayerCompetition?.addEventListener('change', () => {
      newExternalSelected = null;
      hideNewPlayerSuggestions();
      updateAddPlayerScopeUI(els.newPlayerScope?.value || homeZone);
      const query = String(els.newPlayerName?.value || '').trim();
      if (query && els.newPlayerScope?.value === 'overseas' && overseasProvider(els.newPlayerCompetition.value)) {
        renderNewPlayerSuggestions([], `搜尋 ${els.newPlayerCompetition.value} 球員…`);
        if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
        newPlayerSuggestTimer = setTimeout(() => requestNewPlayerSuggestions(query), 250);
      }
    });

    els.newPlayerName?.addEventListener('focus', () => {
      const query = String(els.newPlayerName.value || '').trim();
      if (query && !newPlayerSuggestionPicked && els.newPlayerSuggestions?.innerHTML) {
        els.newPlayerSuggestions.classList.remove('hidden');
      }
    });

    document.addEventListener('pointerdown', event => {
      if (!els.addDialog?.open || !els.newPlayerSuggestions) return;
      if (event.target === els.newPlayerName || els.newPlayerSuggestions.contains(event.target)) return;
      hideNewPlayerSuggestions();
    });

    els.addDialog?.addEventListener('close', () => {
      newPlayerSuggestRequestId++;
      if (newPlayerSuggestTimer) clearTimeout(newPlayerSuggestTimer);
      hideNewPlayerSuggestions();
    });

    document.getElementById('createManualPlayerBtn').addEventListener('click', async () => {
      const { name, number, selectedType, scope, competition, externalTeam, externalYear } = newPlayerFormValues();
      if (!validateNewPlayer(name, number, scope, competition)) return;
      const btn = document.getElementById('createManualPlayerBtn');
      btn.disabled = true;
      try {
        const player = {
          id: uid(), name, number, type: selectedType,
          stats: selectedType === 'hitter' ? hitterDefaults() : pitcherDefaults(),
          pitcherLastMetric: selectedType === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId: null, photoTransforms: {},
          scope,
          externalCompetition: competition,
          externalTeam: scope === 'international' ? normalizeInternationalTeamName(externalTeam) : externalTeam,
          externalYear,
          cpblAcnt: '', cpblTeam: '', cpblTeamCode: '', cpblPosition: '',
          createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now()
        };
        await savePlayer(player);
        clearNewPlayerForm();
        els.addDialog.close();
        await selectPlayer(player.id);
        setStatus(scope === 'cpbl'
          ? '球員已純新增，未連結中職官網。'
          : `已建立${scopeLabel(scope)}球員資料。`);
      } catch (error) {
        setStatus(error.message || '建立球員失敗。', true);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('createExternalPlayerBtn').addEventListener('click', async () => {
      const { name, number, selectedType, scope, competition, externalYear } = newPlayerFormValues();
      const provider = overseasProvider(competition);
      if (scope !== 'overseas' || !provider) {
        setStatus('請先選擇美國職棒、NPB 或 KBO。', true);
        return;
      }
      if (!validateNewPlayer(name, number, scope, competition, true)) return;

      const btn = document.getElementById('createExternalPlayerBtn');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = `搜尋 ${overseasProviderLabel(provider)}…`;

      try {
        let picked = newExternalSelected;
        if (!picked || picked.provider !== provider) {
          const result = await baseballRequest('search-player', {
            provider,
            query: name,
            year: externalYear
          });
          const candidates = result.players || [];
          if (!candidates.length) throw new Error(`${overseasProviderLabel(provider)} 找不到「${name}」。`);

          const exact = candidates.find(item =>
            String(item.zhName || '').trim() === name || String(item.name || '').trim() === name
          );
          const candidate = exact || (candidates.length === 1 ? candidates[0] : null);
          if (!candidate) {
            renderNewPlayerSuggestions(candidates.map(item => ({
              source:'external',
              provider:item.provider || provider,
              id:item.id || '',
              name:item.name || '',
              zhName:item.zhName || '',
              number:item.number || '',
              team:item.team || '',
              position:item.position || '',
              type:item.type || '',
              twoWay:Boolean(item.twoWay)
            })));
            throw new Error('找到多位同名／相近球員，請先從姓名下方選擇正確球員。');
          }

          picked = {
            provider,
            id:String(candidate.id || ''),
            zhName:candidate.zhName || '',
            officialName:candidate.name || '',
            name:candidate.zhName || candidate.name || name,
            number:candidate.number || '',
            team:candidate.team || '',
            position:candidate.position || '',
            type:candidate.type || selectedType,
            twoWay:Boolean(candidate.twoWay)
          };
        }

        if (!picked?.id) throw new Error('找不到球員識別資料。');

        btn.textContent = '同步賽季資料…';
        const profileData = await baseballRequest('player-profile', {
          provider,
          id:picked.id
        });
        const official = profileData.player || {};

        let remote = null;
        let seasonSyncError = '';
        try {
          const seasonData = await baseballRequest('season-stats', {
            provider,
            id:picked.id,
            year:externalYear
          });
          remote = seasonData.stats || null;
          if (!remote) seasonSyncError = '讀不到賽季成績。';
        } catch (error) {
          seasonSyncError = error?.message || '賽季成績同步失敗。';
          if (provider !== 'MILB') throw error;
        }

        const isTwoWay = Boolean(
          official.twoWay
          || picked.twoWay
          || remote?.profile?.twoWay
        );
        const officialPosition = official.position || official.jpPosition || picked.position || '';
        const positionType = externalPositionType(officialPosition);
        let type = official.type || positionType || picked.type || selectedType;
        if (type !== 'pitcher' && type !== 'hitter') type = selectedType;

        const typedChineseName = /[㐀-鿿]/.test(name) ? name : '';
        const displayName = picked.zhName || typedChineseName || picked.name || official.name || name;
        const player = {
          id:uid(),
          name:displayName,
          number:official.number || picked.number || number || '—',
          type,
          primaryType:type,
          scope:'overseas',
          stats:type === 'hitter' ? hitterDefaults() : pitcherDefaults(),
          pitcherLastMetric:type === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId:null,
          photoTransforms:{},
          externalCompetition:competition,
          externalProvider:provider,
          externalPlayerId:String(picked.id),
          externalTwoWay:isTwoWay,
          externalOfficialName:official.name || picked.officialName || picked.name || '',
          externalPosition:official.position || official.jpPosition || picked.position || '',
          externalTeam:official.team || picked.team || '',
          externalCurrentTeam:official.team || picked.team || '',
          externalCurrentOrganization:official.currentOrganization || official.organization || '',
          externalCurrentLevel:official.currentLevel || (provider === 'MLB' ? 'MLB' : provider === 'MILB' ? 'MiLB' : ''),
          externalCurrentSportId:Number(official.sportId)||0,
          externalYear,
          externalAvailableYears:[],
          externalSeasonSyncPending:Boolean(provider === 'MILB' && seasonSyncError),
          externalSeasonSyncError:provider === 'MILB' ? seasonSyncError : '',
          cpblAcnt:'',cpblTeam:'',cpblTeamCode:'',cpblPosition:'',
          createdAt:Date.now(),updatedAt:Date.now(),lastUsedAt:Date.now()
        };

        if (remote) applyExternalSeasonStats(player, remote, externalYear);
        const sameLinkedPlayers = players.filter(p => playerScope(p) === 'overseas'
          && String(p.externalPlayerId || '') === String(player.externalPlayerId)
          && (provider === 'US' ? isUsPlayer(p) : p.externalProvider === provider));
        if (sameLinkedPlayers.length) {
          throw new Error('這位球員已經存在；現在同一筆球員資料會自動整合投球與打擊成績，不需要再建立另一個角色版本。');
        }

        await savePlayer(player);
        newExternalSelected = null;
        clearNewPlayerForm();
        els.addDialog.close();
        await selectPlayer(player.id);
        setStatus(seasonSyncError && provider === 'MILB'
          ? `已建立 ${player.name}；MiLB 賽季累積同步暫時失敗，但仍可抓指定日期單場資料。`
          : `已從 ${overseasProviderLabel(provider)} 建立：${player.name}｜${player.externalTeam || '球隊未提供'}`);
      } catch (error) {
        setStatus(error?.message || '搜尋國外聯盟資料失敗。', true);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
        updateAddPlayerScopeUI(els.newPlayerScope?.value || homeZone);
      }
    });

    document.getElementById('createCpblPlayerBtn').addEventListener('click', async () => {
      const { name, number, selectedType } = newPlayerFormValues();
      if (!validateNewPlayer(name, number, 'cpbl', '', true)) return;
      const btn = document.getElementById('createCpblPlayerBtn');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '搜尋中職官網…';
      try {
        const searchName = String(name || '').trim();
        const found = await cpblRequest('search-player', { name: searchName, number });
        const official = found.player;
        if (!official) throw new Error(`中職官網找不到「${searchName} #${number}」。`);

        let type = cpblOfficialTypeFromPosition(official.position) || selectedType;

        const sameLinkedPlayers = players.filter(p =>
          playerScope(p) === 'cpbl'
          && String(p.cpblAcnt || '') === String(official.acnt || '')
        );
        if (sameLinkedPlayers.length) {
          throw new Error('這位球員已經存在；現在同一筆球員資料會依官方守位分類，投打紀錄會自動整合，不需要再建立另一個角色版本。');
        }

        const player = {
          id: uid(), name: official.name || name, number: official.number || number, type,
          primaryType:type,
          scope: 'cpbl',
          stats: type === 'hitter' ? hitterDefaults() : pitcherDefaults(),
          pitcherLastMetric: type === 'pitcher' ? 'wl' : undefined,
          selectedPhotoId: null, photoTransforms: {},
          cpblAcnt: official.acnt || '',
          cpblTeam: official.team || '',
          cpblTeamCode: official.teamCode || '',
          cpblPosition: official.position || '',
          cpblDualRole: sameLinkedPlayers.length > 0,
          createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now()
        };
        ensureStatsProfiles(player);
        try { await syncPlayerCpblHistory(player); }
        catch (error) { console.warn('CPBL season history import failed', error); }
        try {
          const roster = await cpblRequest('current-roster', { acnt: player.cpblAcnt });
          if (roster?.player?.team) {
            player.cpblTeam = normalizeTeamName(roster.player.team);
            if (roster.player.teamCode) player.cpblTeamCode = String(roster.player.teamCode);
            if (roster.player.number) player.number = String(roster.player.number);
            player.cpblCurrentLevel = roster.player.level === 'D' ? 'D' : 'A';
            repairStoredCpblPlayerType(player, roster.player.position || official.position || '');
            player.cpblRosterUpdatedAt = Date.now();
            await savePlayer(player);
          }
        } catch (error) {
          console.warn('CPBL current roster import failed', error);
        }
        clearNewPlayerForm();
        els.addDialog.close();
        await selectPlayer(player.id);
        setStatus(`已從中職官網建立：${official.team} #${official.number} ${official.name || name}`);
      } catch (error) {
        setStatus(error.message || '搜尋中職資料失敗。', true);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const player = selectedPlayer();
        let nextTab = btn.dataset.tab;

        if (nextTab === 'secondary' && supportsUsDualRoleTabs(player)) {
          selectedLevel = 'A';
          selectedTab = 'secondary';
          localStorage.setItem('baseballSelectedTab', selectedTab);
          renderAll();
          return;
        }

        if (supportsLeagueLevelTabs(player) && (nextTab === 'base' || nextTab === 'minor')) {
          const level = nextTab === 'minor' ? 'D' : 'A';
          selectedRoleView = 'primary';
          selectedTab = nextTab;
          localStorage.setItem('baseballSelectedTab', selectedTab);

          if (playerScope(player) === 'cpbl') {
            if (selectedLevel !== level) switchPlayerLevel(level);
            else {
              selectedLevel = level;
              const years = availableSeasonYears(player, level);
              if (!years.includes(selectedSeason)) selectedSeason = years[0] || CURRENT_YEAR;
              activatePlayerStatsProfile(player, selectedSeason, level);
              renderAll();
            }
            return;
          }

          await switchOverseasLeagueLevel(level);
          return;
        }

        if (nextTab === 'today' && supportsLeagueLevelTabs(player)) {
          selectedLevel = 'A';
          await loadRecord();
        }

        selectedTab = nextTab;
        if (selectedTab === 'today' && playerScope(player) === 'international') {
          internationalSelectedGameKey = '';
        }
        localStorage.setItem('baseballSelectedTab', selectedTab);
        renderAll();
      });
    });

    els.gameDate.addEventListener('change', async () => {
      syncAppPickerLabels();
      const player=selectedPlayer();
      if (playerScope(player) === 'international' && !internationalSelectedGameKey) {
        renderAll();
        return;
      }
      await loadRecord();
      renderAll();
    });

    window.addEventListener('resize', () => requestAnimationFrame(updateHomePaneHeight));
    window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(updateHomePaneHeight));

    els.canvas.addEventListener('pointerdown', async event => {
      const player = selectedPlayer();
      if (!player) return;
      const photo = photos.find(p => p.id === player.selectedPhotoId && p.playerId === player.id);
      const point = canvasPoint(event);
      if (!photo || !pointInPhotoFrame(point)) return;
      try {
        const image = await getPhotoImage(photo);
        const transform = clampPhotoTransform(image, getPhotoTransform(player, photo.id));
        photoDrag = {
          pointerId: event.pointerId,
          playerId: player.id,
          photoId: photo.id,
          image,
          startPoint: point,
          startTransform: { ...transform }
        };
        els.canvas.setPointerCapture(event.pointerId);
        els.canvas.style.cursor = 'grabbing';
        event.preventDefault();
      } catch {
        setStatus('照片載入失敗。', true);
      }
    });

    els.canvas.addEventListener('pointermove', event => {
      const point = canvasPoint(event);
      if (!photoDrag) {
        const player = selectedPlayer();
        const hasPhoto = player && photos.some(p => p.id === player.selectedPhotoId && p.playerId === player.id);
        els.canvas.style.cursor = hasPhoto && pointInPhotoFrame(point) ? 'grab' : 'default';
        return;
      }
      if (event.pointerId !== photoDrag.pointerId) return;
      const player = players.find(p => p.id === photoDrag.playerId);
      if (!player || player.selectedPhotoId !== photoDrag.photoId) return;
      const next = {
        x: photoDrag.startTransform.x + point.x - photoDrag.startPoint.x,
        y: photoDrag.startTransform.y + point.y - photoDrag.startPoint.y,
        scale: photoDrag.startTransform.scale
      };
      ensurePhotoTransforms(player)[photoDrag.photoId] = clampPhotoTransform(photoDrag.image, next);
      renderCanvas();
      event.preventDefault();
    });

    async function finishPhotoDrag(event) {
      if (!photoDrag || event.pointerId !== photoDrag.pointerId) return;
      const player = players.find(p => p.id === photoDrag.playerId);
      photoDrag = null;
      els.canvas.style.cursor = 'grab';
      try { els.canvas.releasePointerCapture(event.pointerId); } catch {}
      if (player) {
        await savePlayer(player);
        setStatus('照片位置已保存。');
      }
    }

    els.canvas.addEventListener('pointerup', finishPhotoDrag);
    els.canvas.addEventListener('pointercancel', finishPhotoDrag);
    els.canvas.addEventListener('pointerleave', event => {
      if (!photoDrag) els.canvas.style.cursor = 'default';
    });

    els.canvas.addEventListener('wheel', async event => {
      const player = selectedPlayer();
      if (!player) return;
      const photo = photos.find(p => p.id === player.selectedPhotoId && p.playerId === player.id);
      const point = canvasPoint(event);
      if (!photo || !pointInPhotoFrame(point)) return;
      event.preventDefault();
      try {
        const image = await getPhotoImage(photo);
        const current = clampPhotoTransform(image, getPhotoTransform(player, photo.id));
        const direction = event.deltaY < 0 ? 1 : -1;
        const next = clampPhotoTransform(image, {
          ...current,
          scale: current.scale + direction * 0.1
        });
        ensurePhotoTransforms(player)[photo.id] = next;
        renderCanvas();
        if (selectedTab === 'photos') {
          const zoomInput = document.getElementById('photoZoom');
          const zoomValue = document.getElementById('photoZoomValue');
          if (zoomInput) zoomInput.value = String(Math.round(next.scale * 100));
          if (zoomValue) zoomValue.textContent = `${Math.round(next.scale * 100)}%`;
        }
        clearTimeout(photoZoomSaveTimer);
        photoZoomSaveTimer = setTimeout(() => savePlayer(player), 250);
      } catch {
        setStatus('照片載入失敗。', true);
      }
    }, { passive: false });

