    let milestoneLeagueFilter = 'ALL';

    const MILESTONE_TARGETS = {
      hitter: [
        { key:'hits', label:'安打', targets:[50,100,200,300,500,750,1000,1250,1500,1750,2000,2500,3000] },
        { key:'hr', label:'全壘打', targets:[10,20,30,50,75,100,150,200,250,300,400,500,600] },
        { key:'rbi', label:'打點', targets:[50,100,200,300,500,750,1000,1250,1500,2000] },
        { key:'runs', label:'得分', targets:[50,100,200,300,500,750,1000,1250,1500,2000] }
      ],
      pitcher: [
        { key:'k', label:'三振', targets:[50,100,200,300,500,750,1000,1500,2000,2500,3000] },
        { key:'w', label:'勝投', targets:[5,10,20,50,75,100,150,200,250,300] },
        { key:'sv', label:'救援成功', targets:[10,20,30,50,75,100,150,200,250,300] },
        { key:'hld', label:'中繼成功', targets:[10,20,30,50,75,100,150,200,250,300] },
        { key:'innings', label:'投球局數', targets:[50,100,200,300,500,750,1000,1500,2000,2500,3000] }
      ]
    };

    function milestoneLeagueCode(player) {
      const scope = playerScope(player);
      if (scope === 'cpbl') return 'CPBL';
      if (scope !== 'overseas') return '';
      const provider = String(player?.externalProvider || '').toUpperCase();
      if (provider === 'NPB') return 'NPB';
      if (provider === 'KBO') return 'KBO';
      if (provider === 'MLB' || provider === 'MILB' || provider === 'US') return 'US';
      return provider;
    }

    function milestoneLeagueLabel(code) {
      return ({CPBL:'中華職棒',NPB:'日本職棒',KBO:'韓國職棒',US:'美國職棒'})[code] || code;
    }

    function milestoneCareerStats(player) {
      const profiles = ensureStatsProfiles(player);
      const rows = Object.entries(profiles)
        .filter(([key]) => String(key).endsWith(':A'))
        .map(([,stats]) => stats && typeof stats === 'object' ? stats : {});
      if (!rows.length && player?.stats) rows.push(player.stats);

      if (player.type === 'pitcher') {
        const total = pitcherDefaults();
        for (const stats of rows) {
          for (const key of Object.keys(total)) total[key] += Number(stats?.[key]) || 0;
        }
        total.innings = (Number(total.outs) || 0) / 3;
        return total;
      }

      const total = hitterDefaults();
      for (const stats of rows) {
        for (const key of Object.keys(total)) total[key] += Number(stats?.[key]) || 0;
      }
      total.hits = (Number(total.single)||0) + (Number(total.double)||0) + (Number(total.triple)||0) + (Number(total.hr)||0);
      return total;
    }

    function milestoneNextTarget(value, targets) {
      const safe = Math.max(0, Number(value) || 0);
      const target = targets.find(n => n >= safe) || (Math.floor(safe / 500) + 1) * 500;
      return { value:safe, target, remaining:Math.max(0, target-safe) };
    }

    function milestonePlayerRows(player) {
      const stats = milestoneCareerStats(player);
      const specs = player.type === 'pitcher' ? MILESTONE_TARGETS.pitcher : MILESTONE_TARGETS.hitter;
      return specs.map(spec => {
        const raw = spec.key === 'innings' ? Number(stats.innings)||0 : Number(stats[spec.key])||0;
        return { ...spec, ...milestoneNextTarget(raw, spec.targets) };
      }).sort((a,b) => a.remaining-b.remaining || a.target-b.target).slice(0,2);
    }

    function milestoneValueText(row) {
      if (row.key !== 'innings') return String(Math.floor(row.value));
      const outs = Math.round(row.value * 3);
      return `${Math.floor(outs/3)}.${outs%3}`;
    }

    function milestoneRemainText(row) {
      if (row.key !== 'innings') return String(Math.ceil(row.remaining));
      const outs = Math.max(0, Math.ceil(row.remaining * 3));
      return `${Math.floor(outs/3)}.${outs%3}`;
    }

    function milestoneCard(player) {
      const code = milestoneLeagueCode(player);
      const rows = milestonePlayerRows(player);
      const first = rows[0];
      const number = String(player?.number || '').trim();
      return `
        <article class="milestone-card">
          <div class="milestone-card-head">
            <div>
              <span>${escapeHtml(milestoneLeagueLabel(code))} · ${player.type === 'pitcher' ? '投手' : '打者'}</span>
              <strong>${number ? `#${escapeHtml(number)} ` : ''}${escapeHtml(player.name || '未命名球員')}</strong>
            </div>
            <b>${first.remaining === 0 ? '達成' : `差 ${milestoneRemainText(first)}`}</b>
          </div>
          <div class="milestone-track-list">
            ${rows.map(row => `
              <div class="milestone-track">
                <div class="milestone-track-meta">
                  <span>${escapeHtml(row.label)} <strong>${milestoneValueText(row)}</strong></span>
                  <b>${row.target}</b>
                </div>
                <div class="milestone-progress"><i style="width:${Math.max(0,Math.min(100,row.value/row.target*100)).toFixed(1)}%"></i></div>
                <small>${row.remaining === 0 ? `已達成 ${row.target} ${escapeHtml(row.label)}` : `距離 ${row.target} ${escapeHtml(row.label)}還差 ${milestoneRemainText(row)}`}</small>
              </div>
            `).join('')}
          </div>
        </article>
      `;
    }

    function milestoneFilterButton(code, label) {
      return `<button type="button" class="milestone-filter-btn ${milestoneLeagueFilter===code?'active':''}" data-milestone-league="${escapeAttr(code)}">${escapeHtml(label)}</button>`;
    }

    function bindMilestoneEvents() {
      els.milestonePageContent?.querySelectorAll('[data-milestone-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          milestoneLeagueFilter = String(btn.dataset.milestoneLeague || 'ALL');
          renderMilestonePage();
        });
      });
    }

    function renderMilestonePage() {
      if (!els.milestonePageContent) return;
      const proPlayers = players.filter(player => Boolean(milestoneLeagueCode(player)));
      const leagueCodes = [...new Set(proPlayers.map(milestoneLeagueCode).filter(Boolean))];
      const shown = proPlayers
        .filter(player => milestoneLeagueFilter === 'ALL' || milestoneLeagueCode(player) === milestoneLeagueFilter)
        .map(player => ({ player, rows:milestonePlayerRows(player) }))
        .sort((a,b) => (a.rows[0]?.remaining ?? Infinity) - (b.rows[0]?.remaining ?? Infinity)
          || String(a.player?.name||'').localeCompare(String(b.player?.name||''), 'zh-Hant'));

      els.milestonePageContent.innerHTML = `
        <div class="milestone-note">
          <strong>低流量模式</strong>
          <span>只使用已同步到這台裝置的職業聯盟球員資料；開啟本頁不會額外呼叫 API、Function 或 Realtime。</span>
        </div>
        <div class="milestone-filters">
          ${milestoneFilterButton('ALL','全部')}
          ${leagueCodes.map(code => milestoneFilterButton(code,milestoneLeagueLabel(code))).join('')}
        </div>
        <div class="milestone-summary">
          <strong>${shown.length} 名球員</strong>
          <span>依距離下一個里程碑排序 · 僅計一軍／最高層級已同步賽季</span>
        </div>
        <div class="milestone-grid">
          ${shown.length ? shown.map(item => milestoneCard(item.player)).join('') : '<div class="milestone-empty">目前沒有可計算的已同步職業聯盟球員資料。</div>'}
        </div>
      `;
      bindMilestoneEvents();
    }
