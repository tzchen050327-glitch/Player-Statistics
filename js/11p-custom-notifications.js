const CUSTOM_NOTIFICATION_STORAGE_KEY = 'custom-player-notification-watch-v1';

    function customNotificationReadState() {
      try {
        const raw = JSON.parse(localStorage.getItem(CUSTOM_NOTIFICATION_STORAGE_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
      } catch {
        return {};
      }
    }

    function customNotificationWriteState(state) {
      localStorage.setItem(CUSTOM_NOTIFICATION_STORAGE_KEY, JSON.stringify(state || {}));
    }

    function customNotificationPlayerKey(player) {
      return String(player?.cpblAcnt || player?.id || '').trim();
    }

    function customNotificationPlayers() {
      return (Array.isArray(players) ? players : [])
        .filter(player => playerScope(player) === 'cpbl' && String(player?.cpblAcnt || '').trim())
        .sort((a, b) => {
          const team = String(a?.cpblTeam || '').localeCompare(String(b?.cpblTeam || ''), 'zh-Hant');
          if (team) return team;
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-Hant');
        });
    }

    function customNotificationDefaultRule(player) {
      return {
        playerId:String(player?.id || ''),
        cpblAcnt:String(player?.cpblAcnt || ''),
        name:String(player?.name || ''),
        team:String(player?.cpblTeam || ''),
        major:true,
        minor:true,
        lineup:true,
        appearance:true,
        updatedAt:Date.now()
      };
    }

    function customNotificationRule(player, state = customNotificationReadState()) {
      const key = customNotificationPlayerKey(player);
      const value = state?.[key];
      return value && typeof value === 'object' ? value : null;
    }

    function customNotificationOption(label, field, checked, disabled, key) {
      return `
        <label class="custom-notification-option ${disabled ? 'is-disabled' : ''}">
          <input type="checkbox" data-custom-notification-field="${escapeHtml(field)}" data-custom-notification-key="${escapeHtml(key)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    }

    function customNotificationRow(player, state) {
      const key = customNotificationPlayerKey(player);
      const rule = customNotificationRule(player, state);
      const active = Boolean(rule);
      const currentLevel = String(player?.cpblCurrentLevel || '').toUpperCase() === 'D' ? '目前二軍' : '目前一軍';
      const meta = [
        normalizeTeamName(player?.cpblTeam || ''),
        player?.number ? `#${player.number}` : '',
        currentLevel
      ].filter(Boolean).join('｜');

      return `
        <article class="custom-notification-row ${active ? 'is-active' : ''}" data-custom-notification-row="${escapeHtml(key)}">
          <div class="custom-notification-player">
            <label class="custom-notification-master">
              <input type="checkbox" data-custom-notification-player="${escapeHtml(key)}" ${active ? 'checked' : ''}>
              <span class="custom-notification-checkmark" aria-hidden="true"></span>
            </label>
            <div class="custom-notification-player-text">
              <strong>${escapeHtml(String(player?.name || '未命名球員'))}</strong>
              <span>${escapeHtml(meta || '中職球員')}</span>
            </div>
          </div>
          <div class="custom-notification-options">
            ${customNotificationOption('一軍', 'major', rule?.major !== false, !active, key)}
            ${customNotificationOption('二軍', 'minor', rule?.minor !== false, !active, key)}
            ${customNotificationOption('先發公布', 'lineup', rule?.lineup !== false, !active, key)}
            ${customNotificationOption('實際出賽', 'appearance', rule?.appearance !== false, !active, key)}
          </div>
        </article>
      `;
    }

    function bindCustomNotificationEvents() {
      if (!els.customNotificationPageContent) return;

      els.customNotificationPageContent.querySelectorAll('[data-custom-notification-player]').forEach(input => {
        input.addEventListener('change', () => {
          const key = String(input.dataset.customNotificationPlayer || '');
          const player = customNotificationPlayers().find(item => customNotificationPlayerKey(item) === key);
          if (!player) return;
          const state = customNotificationReadState();
          if (input.checked) state[key] = customNotificationDefaultRule(player);
          else delete state[key];
          customNotificationWriteState(state);
          renderCustomNotificationPage();
        });
      });

      els.customNotificationPageContent.querySelectorAll('[data-custom-notification-field]').forEach(input => {
        input.addEventListener('change', () => {
          const key = String(input.dataset.customNotificationKey || '');
          const field = String(input.dataset.customNotificationField || '');
          if (!['major','minor','lineup','appearance'].includes(field)) return;
          const state = customNotificationReadState();
          const rule = state?.[key];
          if (!rule) return;
          rule[field] = Boolean(input.checked);
          rule.updatedAt = Date.now();
          state[key] = rule;
          customNotificationWriteState(state);
          renderCustomNotificationPage();
        });
      });

      els.customNotificationPageContent.querySelector('[data-custom-notification-clear]')?.addEventListener('click', () => {
        customNotificationWriteState({});
        renderCustomNotificationPage();
      });
    }

    function renderCustomNotificationPage() {
      if (!els.customNotificationPageContent) return;
      const state = customNotificationReadState();
      const available = customNotificationPlayers();
      const activeCount = available.filter(player => Boolean(customNotificationRule(player, state))).length;

      const rows = available.length
        ? available.map(player => customNotificationRow(player, state)).join('')
        : `
          <div class="custom-notification-empty">
            <strong>目前沒有可設定的中職球員</strong>
            <span>先把球員加入首頁名單後，就能在這裡建立一軍／二軍出賽通知條件。</span>
          </div>
        `;

      els.customNotificationPageContent.innerHTML = `
        <section class="custom-notification-summary">
          <div>
            <span>CUSTOM ALERTS</span>
            <strong>球員出賽通知</strong>
            <small>設定儲存在此裝置；目前不會額外增加比賽資料輪詢。</small>
          </div>
          <b>${activeCount} 人</b>
        </section>

        <div class="custom-notification-toolbar">
          <span>勾選球員後，再決定要追蹤的一／二軍與通知事件。</span>
          ${activeCount ? '<button type="button" class="press-btn custom-notification-clear" data-custom-notification-clear>全部取消</button>' : ''}
        </div>

        <div class="custom-notification-list">
          ${rows}
        </div>

        <div class="custom-notification-footnote">
          背景推播傳送端尚未啟用；這一頁先建立正式通知條件，之後後端會直接沿用，不需要重新設定。
        </div>
      `;

      bindCustomNotificationEvents();
    }
