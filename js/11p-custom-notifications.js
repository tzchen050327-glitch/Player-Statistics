const CUSTOM_NOTIFICATION_STORAGE_KEY = 'custom-player-notification-watch-v1';
    const CUSTOM_NOTIFICATION_DEVICE_TOKEN_KEY = 'custom-player-notification-device-v1';
    const CUSTOM_NOTIFICATION_PUSH_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/player-push';
    const CUSTOM_NOTIFICATION_VAPID_PUBLIC_KEY = 'BFJ_q3JS2DSEFzm2JgBwtVPxRhsCzoYtJxGNxS9PKvZmhrNBA9kfR0Z_prWfLpoUb438dslhvA33KVf1OjcWDfw';
    let customNotificationFlash = null;
    let customNotificationLastAutoSyncAt = 0;

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
        teamCode:String(player?.cpblTeamCode || ''),
        playerType:String(player?.type || ''),
        major:true,
        minor:true,
        lineup:true,
        appearance:true,
        plateAppearance:false,
        updatedAt:Date.now()
      };
    }

    function customNotificationRule(player, state = customNotificationReadState()) {
      const key = customNotificationPlayerKey(player);
      const value = state?.[key];
      return value && typeof value === 'object' ? value : null;
    }

    function customNotificationDeviceToken() {
      let token = String(localStorage.getItem(CUSTOM_NOTIFICATION_DEVICE_TOKEN_KEY) || '');
      if (/^[A-Za-z0-9_-]{20,160}$/.test(token)) return token;
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      let binary = '';
      bytes.forEach(value => { binary += String.fromCharCode(value); });
      token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      localStorage.setItem(CUSTOM_NOTIFICATION_DEVICE_TOKEN_KEY, token);
      return token;
    }

    function customNotificationPushSupported() {
      return typeof window !== 'undefined'
        && 'Notification' in window
        && 'serviceWorker' in navigator
        && 'PushManager' in window;
    }

    function customNotificationApplicationServerKey(value) {
      const padding = '='.repeat((4 - value.length % 4) % 4);
      const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64);
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
      return out;
    }

    function customNotificationWatchPayload() {
      const state = customNotificationReadState();
      return customNotificationPlayers().map(player => {
        const rule = customNotificationRule(player, state);
        if (!rule) return null;
        return {
          cpblAcnt:String(player.cpblAcnt || ''),
          name:String(player.name || rule.name || ''),
          team:String(player.cpblTeam || rule.team || ''),
          teamCode:String(player.cpblTeamCode || rule.teamCode || ''),
          playerType:String(player.type || rule.playerType || ''),
          major:rule.major !== false,
          minor:rule.minor !== false,
          lineup:rule.lineup !== false,
          appearance:rule.appearance !== false,
          plateAppearance:rule.plateAppearance === true
        };
      }).filter(Boolean);
    }

    async function customNotificationPost(body) {
      const response = await fetch(CUSTOM_NOTIFICATION_PUSH_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    }

    async function customNotificationSubscription({ requestPermission = false } = {}) {
      if (!customNotificationPushSupported()) {
        throw new Error('目前瀏覽器不支援背景推播；iPhone / iPad 請先把網站加入主畫面後再開啟。');
      }
      let permission = Notification.permission;
      if (permission === 'default' && requestPermission) {
        permission = await Notification.requestPermission();
      }
      if (permission === 'denied') throw new Error('通知權限已被封鎖，請到系統或瀏覽器設定重新允許。');
      if (permission !== 'granted') return null;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription && requestPermission) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:customNotificationApplicationServerKey(CUSTOM_NOTIFICATION_VAPID_PUBLIC_KEY)
        });
      }
      return subscription;
    }

    async function customNotificationSyncPush({ ensure = false } = {}) {
      if (!customNotificationPushSupported()) {
        if (ensure) throw new Error('目前瀏覽器不支援背景推播；iPhone / iPad 請先把網站加入主畫面後再開啟。');
        return { skipped:true };
      }
      const subscription = await customNotificationSubscription({ requestPermission:ensure });
      if (!subscription) return { skipped:true };
      const json = subscription.toJSON();
      return await customNotificationPost({
        action:'sync',
        deviceToken:customNotificationDeviceToken(),
        subscription:json,
        watches:customNotificationWatchPayload()
      });
    }

    async function customNotificationDisablePush() {
      if (!customNotificationPushSupported()) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe().catch(() => false);
      await customNotificationPost({
        action:'unsubscribe',
        deviceToken:customNotificationDeviceToken()
      }).catch(() => null);
    }

    function customNotificationSetFlash(message, error = false) {
      customNotificationFlash = { message:String(message || ''), error:Boolean(error) };
    }

    function customNotificationPushStatusText() {
      if (!customNotificationPushSupported()) return '此瀏覽器目前不能使用背景推播';
      if (Notification.permission === 'denied') return '通知權限已封鎖';
      if (Notification.permission === 'granted') return '背景推播權限已開啟';
      return '尚未啟用背景推播';
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
            ${player?.type === 'pitcher' ? '' : customNotificationOption('逐打席', 'plateAppearance', rule?.plateAppearance === true, !active, key)}
          </div>
        </article>
      `;
    }

    function customNotificationRenderAfterAction(message, error = false) {
      customNotificationSetFlash(message, error);
      renderCustomNotificationPage();
    }

    function bindCustomNotificationEvents() {
      if (!els.customNotificationPageContent) return;

      els.customNotificationPageContent.querySelectorAll('[data-custom-notification-player]').forEach(input => {
        input.addEventListener('change', async () => {
          const key = String(input.dataset.customNotificationPlayer || '');
          const player = customNotificationPlayers().find(item => customNotificationPlayerKey(item) === key);
          if (!player) return;
          const state = customNotificationReadState();
          if (input.checked) state[key] = customNotificationDefaultRule(player);
          else delete state[key];
          customNotificationWriteState(state);
          try {
            await customNotificationSyncPush({ ensure:Boolean(input.checked) });
            customNotificationRenderAfterAction(input.checked ? '已儲存並同步推播設定。' : '已取消此球員通知。');
          } catch (error) {
            customNotificationRenderAfterAction(error?.message || '推播設定同步失敗。', true);
          }
        });
      });

      els.customNotificationPageContent.querySelectorAll('[data-custom-notification-field]').forEach(input => {
        input.addEventListener('change', async () => {
          const key = String(input.dataset.customNotificationKey || '');
          const field = String(input.dataset.customNotificationField || '');
          if (!['major','minor','lineup','appearance','plateAppearance'].includes(field)) return;
          const state = customNotificationReadState();
          const rule = state?.[key];
          if (!rule) return;
          rule[field] = Boolean(input.checked);
          rule.updatedAt = Date.now();
          state[key] = rule;
          customNotificationWriteState(state);
          try {
            await customNotificationSyncPush();
            customNotificationRenderAfterAction('通知條件已同步。');
          } catch (error) {
            customNotificationRenderAfterAction(error?.message || '推播設定同步失敗。', true);
          }
        });
      });

      els.customNotificationPageContent.querySelector('[data-custom-notification-clear]')?.addEventListener('click', async () => {
        customNotificationWriteState({});
        try {
          await customNotificationSyncPush();
          customNotificationRenderAfterAction('已取消全部球員通知。');
        } catch (error) {
          customNotificationRenderAfterAction(error?.message || '取消通知同步失敗。', true);
        }
      });

      els.customNotificationPageContent.querySelector('[data-custom-notification-enable]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await customNotificationSyncPush({ ensure:true });
          customNotificationRenderAfterAction('背景推播已啟用，通知條件也已同步。');
        } catch (error) {
          customNotificationRenderAfterAction(error?.message || '背景推播啟用失敗。', true);
        }
      });

      els.customNotificationPageContent.querySelector('[data-custom-notification-test]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await customNotificationSyncPush({ ensure:true });
          await customNotificationPost({
            action:'test',
            deviceToken:customNotificationDeviceToken()
          });
          customNotificationRenderAfterAction('測試通知已送出。');
        } catch (error) {
          customNotificationRenderAfterAction(error?.message || '測試通知失敗。', true);
        }
      });

      els.customNotificationPageContent.querySelector('[data-custom-notification-disable]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await customNotificationDisablePush();
          customNotificationRenderAfterAction('此裝置的背景推播已停用。');
        } catch (error) {
          customNotificationRenderAfterAction(error?.message || '停用推播失敗。', true);
        }
      });
    }

    function renderCustomNotificationPage() {
      if (!els.customNotificationPageContent) return;
      const state = customNotificationReadState();
      const available = customNotificationPlayers();
      const activeCount = available.filter(player => Boolean(customNotificationRule(player, state))).length;
      const pushSupported = customNotificationPushSupported();
      const permission = pushSupported ? Notification.permission : 'unsupported';
      const enableText = permission === 'granted' ? '同步推播設定' : '啟用背景推播';

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
            <small>一軍沿用既有即時資料觸發；二軍只有有人訂閱時才啟動背景掃描。</small>
          </div>
          <b>${activeCount} 人</b>
        </section>

        <section class="custom-notification-push-card">
          <div>
            <strong>${escapeHtml(customNotificationPushStatusText())}</strong>
            <span>App 關閉後也能收到「先發公布／實際出賽」通知。</span>
          </div>
          <div class="custom-notification-push-actions">
            <button type="button" class="press-btn primary" data-custom-notification-enable ${pushSupported && permission !== 'denied' ? '' : 'disabled'}>${escapeHtml(enableText)}</button>
            <button type="button" class="press-btn" data-custom-notification-test ${pushSupported && permission === 'granted' ? '' : 'disabled'}>測試通知</button>
            <button type="button" class="press-btn" data-custom-notification-disable ${pushSupported && permission === 'granted' ? '' : 'disabled'}>停用推播</button>
          </div>
        </section>

        ${customNotificationFlash?.message ? `<div class="custom-notification-flash ${customNotificationFlash.error ? 'is-error' : ''}">${escapeHtml(customNotificationFlash.message)}</div>` : ''}

        <div class="custom-notification-toolbar">
          <span>勾選球員後，再決定要追蹤的一／二軍與通知事件。</span>
          ${activeCount ? '<button type="button" class="press-btn custom-notification-clear" data-custom-notification-clear>全部取消</button>' : ''}
        </div>

        <div class="custom-notification-list">
          ${rows}
        </div>

        <div class="custom-notification-footnote">
          一軍不增加額外輪詢；二軍每 3 分鐘只在有二軍訂閱者時檢查官方比賽資料，沒有二軍訂閱時不執行。
        </div>
      `;

      bindCustomNotificationEvents();

      if (permission === 'granted' && Date.now() - customNotificationLastAutoSyncAt > 30000) {
        customNotificationLastAutoSyncAt = Date.now();
        void customNotificationSyncPush().catch(error => {
          console.warn('custom notification auto sync failed', error);
        });
      }
      customNotificationFlash = null;
    }
