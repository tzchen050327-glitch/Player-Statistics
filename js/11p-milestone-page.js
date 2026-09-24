    let milestoneLeagueFilter = 'CPBL';

    const MILESTONE_TARGETS = {
      hitter: [
        { key:'hits', label:'安打', short:'H', targets:[50,100,200,300,500,750,1000,1250,1500,1750,2000,2500,3000] },
        { key:'hr', label:'全壘打', short:'HR', targets:[10,20,30,50,75,100,150,200,250,300,400,500,600] },
        { key:'rbi', label:'打點', short:'RBI', targets:[50,100,200,300,500,750,1000,1250,1500,2000] },
        { key:'runs', label:'得分', short:'R', targets:[50,100,200,300,500,750,1000,1250,1500,2000] }
      ],
      pitcher: [
        { key:'k', label:'三振', short:'K', targets:[50,100,200,300,500,750,1000,1500,2000,2500,3000] },
        { key:'w', label:'勝投', short:'W', targets:[5,10,20,50,75,100,150,200,250,300] },
        { key:'sv', label:'救援成功', short:'SV', targets:[10,20,30,50,75,100,150,200,250,300] },
        { key:'hld', label:'中繼成功', short:'HLD', targets:[10,20,30,50,75,100,150,200,250,300] },
        { key:'innings', label:'投球局數', short:'IP', targets:[50,100,200,300,500,750,1000,1500,2000,2500,3000] }
      ]
    };

    function milestoneLeagueCode(player) {
      const scope = playerScope(player);
      if (scope === 'cpbl') return 'CPBL';
      if (scope !== 'overseas') return '';
      return String(player?.externalProvider || '').toUpperCase() === 'NPB' ? 'NPB' : '';
    }

    function milestoneLeagueLabel(code) {
      return code === 'NPB' ? '日本職棒' : '中華職棒';
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
      const target = targets.find(n => n > safe) || (Math.floor(safe / 500) + 1) * 500;
      return { value:safe, target, remaining:Math.max(0, target-safe) };
    }

    function milestoneRows(player) {
      const stats = milestoneCareerStats(player);
      const specs = player.type === 'pitcher' ? MILESTONE_TARGETS.pitcher : MILESTONE_TARGETS.hitter;
      return specs.map(spec => {
        const value = spec.key === 'innings' ? Number(stats.innings)||0 : Number(stats[spec.key])||0;
        const state = milestoneNextTarget(value, spec.targets);
        return { ...spec, ...state, progress: state.target ? Math.max(0, Math.min(1, state.value/state.target)) : 0 };
      });
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

    function milestoneNearScore(row) {
      if (row.key === 'innings') return row.remaining / 10;
      if (['hr','w','sv','hld'].includes(row.key)) return row.remaining / 2;
      return row.remaining / 10;
    }

    function milestoneLeaguePlayers() {
      return players.filter(player => milestoneLeagueCode(player) === milestoneLeagueFilter);
    }

    function milestoneSpotlights(items) {
      const events = items.flatMap(item =>
        item.rows.map(row => ({ player:item.player, row }))
      ).filter(event => event.row.value > 0)
       .sort((a,b) => milestoneNearScore(a.row)-milestoneNearScore(b.row)
         || b.row.progress-a.row.progress
         || String(a.player?.name||'').localeCompare(String(b.player?.name||''),'zh-Hant'))
       .slice(0,3);

      if (!events.length) return '<div class="milestone-focus-empty">目前沒有足夠的已同步數據可以產生焦點。</div>';

      return events.map((event,index) => {
        const row = event.row;
        const number = String(event.player?.number || '').trim();
        return `
          <article class="milestone-focus-item">
            <span class="milestone-focus-rank">0${index+1}</span>
            <div class="milestone-focus-main">
              <div class="milestone-focus-name">${number ? `#${escapeHtml(number)} ` : ''}${escapeHtml(event.player.name || '未命名球員')}</div>
              <div class="milestone-focus-desc">${escapeHtml(row.label)} ${milestoneValueText(row)} → ${row.target}</div>
            </div>
            <div class="milestone-focus-gap">
              <span>還差</span>
              <strong>${milestoneRemainText(row)}</strong>
            </div>
          </article>
        `;
      }).join('');
    }

    function milestoneMetricPill(row) {
      const close = milestoneNearScore(row) <= 1;
      return `
        <div class="milestone-metric-pill ${close ? 'is-close' : ''}">
          <span>${escapeHtml(row.short)}</span>
          <strong>${milestoneValueText(row)}<em>/${row.target}</em></strong>
          <small>差 ${milestoneRemainText(row)}</small>
        </div>
      `;
    }

    function milestonePlayerLine(item) {
      const player = item.player;
      const number = String(player?.number || '').trim();
      const sorted = [...item.rows].sort((a,b) => milestoneNearScore(a)-milestoneNearScore(b) || b.progress-a.progress);
      return `
        <article class="milestone-player-line">
          <div class="milestone-player-identity">
            <span>${player.type === 'pitcher' ? 'P' : 'B'}</span>
            <div>
              <strong>${number ? `#${escapeHtml(number)} ` : ''}${escapeHtml(player.name || '未命名球員')}</strong>
              <small>${player.type === 'pitcher' ? '投手' : '打者'} · 生涯累積</small>
            </div>
          </div>
          <div class="milestone-player-metrics">
            ${sorted.slice(0, player.type === 'pitcher' ? 4 : 4).map(milestoneMetricPill).join('')}
          </div>
        </article>
      `;
    }

    function milestoneSection(title, items, type) {
      const rows = items.filter(item => item.player.type === type)
        .sort((a,b) => {
          const ar = Math.min(...a.rows.map(milestoneNearScore));
          const br = Math.min(...b.rows.map(milestoneNearScore));
          return ar-br || String(a.player?.name||'').localeCompare(String(b.player?.name||''),'zh-Hant');
        });

      return `
        <section class="milestone-group">
          <div class="milestone-group-head">
            <div>
              <span>${type === 'pitcher' ? 'PITCHING' : 'BATTING'}</span>
              <h3>${escapeHtml(title)}</h3>
            </div>
            <b>${rows.length} 人</b>
          </div>
          <div class="milestone-player-list">
            ${rows.length ? rows.map(milestonePlayerLine).join('') : '<div class="milestone-group-empty">目前沒有這一類的已同步球員。</div>'}
          </div>
        </section>
      `;
    }

    function milestoneLeagueButton(code, label) {
      return `<button type="button" class="milestone-league-tab ${milestoneLeagueFilter===code?'active':''}" data-milestone-league="${escapeAttr(code)}">${escapeHtml(label)}</button>`;
    }

    function bindMilestoneEvents() {
      els.milestonePageContent?.querySelectorAll('[data-milestone-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          milestoneLeagueFilter = String(btn.dataset.milestoneLeague || 'CPBL') === 'NPB' ? 'NPB' : 'CPBL';
          localStorage.setItem('milestoneLeagueFilter', milestoneLeagueFilter);
          renderMilestonePage();
        });
      });
    }

    function renderMilestonePage() {
      if (!els.milestonePageContent) return;

      const saved = localStorage.getItem('milestoneLeagueFilter');
      if (saved === 'CPBL' || saved === 'NPB') milestoneLeagueFilter = saved;

      const leaguePlayers = milestoneLeaguePlayers();
      const items = leaguePlayers.map(player => ({ player, rows:milestoneRows(player) }));

      els.milestonePageContent.innerHTML = `
        <div class="milestone-league-tabs" aria-label="里程碑聯盟">
          ${milestoneLeagueButton('CPBL','台灣')}
          ${milestoneLeagueButton('NPB','日本')}
        </div>

        <section class="milestone-focus">
          <div class="milestone-focus-head">
            <div>
              <span>NEAREST MILESTONES</span>
              <h3>最接近達成</h3>
            </div>
            <b>${escapeHtml(milestoneLeagueLabel(milestoneLeagueFilter))}</b>
          </div>
          <div class="milestone-focus-list">
            ${milestoneSpotlights(items)}
          </div>
        </section>

        ${milestoneSection('打者里程碑', items, 'hitter')}
        ${milestoneSection('投手里程碑', items, 'pitcher')}

        <div class="milestone-data-note">資料直接使用 App 內已同步的歷年一軍資料計算；開啟本頁不會新增背景輪詢。</div>
      `;

      bindMilestoneEvents();
    }
