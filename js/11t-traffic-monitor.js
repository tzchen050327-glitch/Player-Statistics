    const TRAFFIC_MONITOR_PROJECTS = [
      { key:'A', title:'A 專案', scope:'CPBL / NPB 即時、逐打席、現役球員資料', ref:'kjndnsztbcpmkhictjkr' },
      { key:'B', title:'B 專案', scope:'KBO / MLB / 國際賽 / 歷史資料', ref:'qprxdenajyumsoywwfaw' }
    ];
    let trafficMonitorState = {
      loading:false,
      loadedAt:0,
      error:'',
      managementConnected:false,
      settings:{ enabled:false, threshold_a_mb:10, threshold_b_mb:10, threshold_total_mb:20 },
      usage:{ date:'', rows:[] }
    };

    async function trafficMonitorApi(action, extra = {}) {
      const response = await fetch(TRAFFIC_USAGE_MONITOR_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action,
          deviceToken:customNotificationDeviceToken(),
          ...extra
        }),
        cache:'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || ('HTTP ' + response.status));
      return data;
    }

    function trafficMonitorFormatBytes(value) {
      const bytes = Math.max(0, Number(value) || 0);
      if (!bytes) return '—';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    function trafficMonitorUsageRow(key) {
      return (Array.isArray(trafficMonitorState?.usage?.rows) ? trafficMonitorState.usage.rows : [])
        .find(row => String(row?.project_key || '') === key) || null;
    }

    function trafficMonitorProjectCard(project) {
      const row = trafficMonitorUsageRow(project.key);
      const sourceReady = Boolean(row);
      return `
        <section class="traffic-project-card" data-project="${project.key}">
          <div class="traffic-project-head">
            <div>
              <span>${escapeHtml(project.key)} PROJECT</span>
              <strong>${escapeHtml(project.title)}</strong>
              <small>${escapeHtml(project.scope)}</small>
            </div>
            <b>${sourceReady ? '今日已更新' : '等待資料'}</b>
          </div>
          <div class="traffic-project-metrics">
            <div><span>今日 Egress</span><strong>${trafficMonitorFormatBytes(row?.egress_bytes)}</strong><small>${sourceReady ? '完整專案' : '等待 usage API'}</small></div>
            <div><span>Cached Egress</span><strong>${trafficMonitorFormatBytes(row?.cached_egress_bytes)}</strong><small>${sourceReady ? '完整專案' : '等待 usage API'}</small></div>
            <div><span>API Requests</span><strong>${row?.api_requests == null ? '—' : Number(row.api_requests).toLocaleString('en-US')}</strong><small>今日</small></div>
            <div><span>資料日期</span><strong class="traffic-date-value">${escapeHtml(String(row?.usage_date || trafficMonitorState?.usage?.date || '—'))}</strong><small>${row?.fetched_at ? '已同步' : '尚未同步'}</small></div>
          </div>
        </section>`;
    }

    function trafficMonitorAlertPanel() {
      const s = trafficMonitorState.settings || {};
      const connected = Boolean(trafficMonitorState.managementConnected);
      return `
        <section class="traffic-alert-panel">
          <div class="traffic-alert-master">
            <div>
              <span>PROGRAM ALERT</span>
              <strong>程式流量提醒</strong>
              <small>${connected ? '後端每小時檢查一次；App 關閉也能推播。' : '提醒架構已啟用，但 Supabase Management API 資料源尚未連接。'}</small>
            </div>
            <label class="traffic-alert-switch">
              <input type="checkbox" data-traffic-alert-enabled ${s.enabled ? 'checked' : ''}>
              <span aria-hidden="true"></span>
            </label>
          </div>
          <div class="traffic-alert-source ${connected ? 'is-ready' : 'is-pending'}">
            <b>${connected ? '資料源已連接' : '資料源尚未連接'}</b>
            <span>${connected ? 'Supabase Management API' : '需要 SUPABASE_MANAGEMENT_TOKEN；目前不會用估算值觸發提醒。'}</span>
          </div>
          <div class="traffic-alert-thresholds">
            <label><span>A 專案每日門檻</span><div><input type="number" min="0.1" step="0.1" value="${Number(s.threshold_a_mb || 10)}" data-traffic-threshold="A"><em>MB</em></div></label>
            <label><span>B 專案每日門檻</span><div><input type="number" min="0.1" step="0.1" value="${Number(s.threshold_b_mb || 10)}" data-traffic-threshold="B"><em>MB</em></div></label>
            <label><span>A+B 合計每日門檻</span><div><input type="number" min="0.1" step="0.1" value="${Number(s.threshold_total_mb || 20)}" data-traffic-threshold="TOTAL"><em>MB</em></div></label>
          </div>
          <div class="traffic-alert-actions">
            <span>同一門檻一天只通知一次。</span>
            <button type="button" class="press-btn" data-traffic-alert-save>儲存門檻</button>
          </div>
          ${trafficMonitorState.error ? '<div class="traffic-monitor-flash is-error">' + escapeHtml(trafficMonitorState.error) + '</div>' : ''}
        </section>`;
    }

    async function trafficMonitorLoad({ force = false } = {}) {
      if (trafficMonitorState.loading) return;
      if (!force && trafficMonitorState.loadedAt && Date.now() - trafficMonitorState.loadedAt < 5 * 60 * 1000) return;
      trafficMonitorState.loading = true;
      trafficMonitorState.error = '';
      renderTrafficMonitorPage();
      try {
        const data = await trafficMonitorApi('status');
        trafficMonitorState = {
          ...trafficMonitorState,
          loading:false,
          loadedAt:Date.now(),
          managementConnected:Boolean(data?.managementConnected),
          settings:data?.settings || trafficMonitorState.settings,
          usage:data?.usage || { date:'', rows:[] },
          error:''
        };
      } catch (error) {
        trafficMonitorState.loading = false;
        trafficMonitorState.error = error?.message || '流量監控設定讀取失敗';
      }
      if (currentPage === 'traffic-monitor') renderTrafficMonitorPage();
    }

    function trafficMonitorReadInputs() {
      const host = els.trafficMonitorPageContent;
      const get = key => Math.max(0.1, Number(host?.querySelector('[data-traffic-threshold="' + key + '"]')?.value) || (key === 'TOTAL' ? 20 : 10));
      return { thresholdA:get('A'), thresholdB:get('B'), thresholdTotal:get('TOTAL') };
    }

    async function trafficMonitorSave(enabled = null) {
      const host = els.trafficMonitorPageContent;
      const currentEnabled = enabled == null
        ? Boolean(host?.querySelector('[data-traffic-alert-enabled]')?.checked)
        : Boolean(enabled);
      const thresholds = trafficMonitorReadInputs();
      if (currentEnabled) {
        await customNotificationSyncPush({ ensure:true });
      }
      const data = await trafficMonitorApi('save', { enabled:currentEnabled, ...thresholds });
      trafficMonitorState.settings = data?.settings || {
        enabled:currentEnabled,
        threshold_a_mb:thresholds.thresholdA,
        threshold_b_mb:thresholds.thresholdB,
        threshold_total_mb:thresholds.thresholdTotal
      };
      trafficMonitorState.managementConnected = Boolean(data?.managementConnected);
      trafficMonitorState.loadedAt = Date.now();
      trafficMonitorState.error = '';
      renderTrafficMonitorPage();
    }

    function bindTrafficMonitorEvents() {
      const host = els.trafficMonitorPageContent;
      if (!host) return;
      host.querySelector('[data-traffic-alert-enabled]')?.addEventListener('change', async event => {
        const input = event.currentTarget;
        input.disabled = true;
        try {
          await trafficMonitorSave(Boolean(input.checked));
        } catch (error) {
          trafficMonitorState.error = error?.message || '提醒設定儲存失敗';
          if (input) input.checked = !input.checked;
          renderTrafficMonitorPage();
        }
      });
      host.querySelector('[data-traffic-alert-save]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await trafficMonitorSave();
        } catch (error) {
          trafficMonitorState.error = error?.message || '門檻設定儲存失敗';
          renderTrafficMonitorPage();
        }
      });
      host.querySelector('[data-traffic-monitor-refresh]')?.addEventListener('click', () => {
        trafficMonitorState.loadedAt = 0;
        void trafficMonitorLoad({ force:true });
      });
    }

    function renderTrafficMonitorPage() {
      if (!els.trafficMonitorPageContent) return;
      const cards = TRAFFIC_MONITOR_PROJECTS.map(trafficMonitorProjectCard).join('');
      els.trafficMonitorPageContent.innerHTML = `
        ${trafficMonitorAlertPanel()}
        <section class="traffic-monitor-overview">
          <div>
            <span>SUPABASE PROJECT USAGE</span>
            <strong>A / B 專案流量監控</strong>
            <small>監控整個 Supabase 專案，不是單一裝置。</small>
          </div>
          <button type="button" class="press-btn" data-traffic-monitor-refresh ${trafficMonitorState.loading ? 'disabled' : ''}>${trafficMonitorState.loading ? '更新中…' : '更新狀態'}</button>
        </section>
        <div class="traffic-project-grid">${cards}</div>
        <div class="traffic-monitor-warning">
          後端排程固定每小時檢查一次。完整 Egress 只接受 Supabase 官方 usage 資料；資料源未連接時不會拿 gateway logs 估算，也不會誤發超量通知。
        </div>
      `;
      bindTrafficMonitorEvents();
      if (!trafficMonitorState.loading && (!trafficMonitorState.loadedAt || Date.now() - trafficMonitorState.loadedAt > 5 * 60 * 1000)) {
        void trafficMonitorLoad();
      }
    }
