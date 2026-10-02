    const TRAFFIC_MONITOR_PROJECTS = [
      {
        key:'A',
        title:'A 專案',
        scope:'CPBL / NPB 即時、逐打席、現役球員資料',
        ref:'kjndnsztbcpmkhictjkr'
      },
      {
        key:'B',
        title:'B 專案',
        scope:'KBO / MLB / 國際賽 / 歷史資料',
        ref:'qprxdenajyumsoywwfaw'
      }
    ];

    function renderTrafficMonitorPage() {
      if (!els.trafficMonitorPageContent) return;
      const cards = TRAFFIC_MONITOR_PROJECTS.map(project => `
        <section class="traffic-project-card" data-project="${project.key}">
          <div class="traffic-project-head">
            <div>
              <span>${escapeHtml(project.key)} PROJECT</span>
              <strong>${escapeHtml(project.title)}</strong>
              <small>${escapeHtml(project.scope)}</small>
            </div>
            <b>整體專案</b>
          </div>

          <div class="traffic-project-metrics">
            <div><span>本月 Egress</span><strong>—</strong><small>等待 Supabase usage API</small></div>
            <div><span>Cached Egress</span><strong>—</strong><small>等待 Supabase usage API</small></div>
            <div><span>API Requests</span><strong>—</strong><small>等待 Supabase usage API</small></div>
            <div><span>今日用量</span><strong>—</strong><small>等待 Supabase usage API</small></div>
          </div>
        </section>
      `).join('');

      els.trafficMonitorPageContent.innerHTML = `
        <section class="traffic-monitor-overview">
          <div>
            <span>SUPABASE PROJECT USAGE</span>
            <strong>A / B 專案流量監控</strong>
            <small>這裡監控的是整個 Supabase 專案，不是這台裝置。</small>
          </div>
        </section>
        <div class="traffic-project-grid">${cards}</div>
        <div class="traffic-monitor-warning">
          完整 Egress / Cached Egress 必須從 Supabase Management API 的 usage 資料讀取；目前前端不會用估算值冒充真實流量。入口與 A/B 專案版面已完成，後端 token 接上後即可直接填入真實值。
        </div>
      `;
    }
