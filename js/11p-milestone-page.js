    let milestoneLeagueFilter = localStorage.getItem('milestoneLeagueFilter') === 'NPB' ? 'NPB' : 'CPBL';
    let milestoneScopeFilter = localStorage.getItem('milestoneScopeFilter') === 'season' ? 'season' : 'career';
    let milestoneSnapshot = null;
    let milestoneSnapshotLoading = false;
    let milestoneSnapshotRemoteChecked = false;
    let milestoneSnapshotError = '';

    const MILESTONE_TARGETS = {
      career: {
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
      },
      season: {
        hitter: [
          { key:'hits', label:'安打', short:'H', targets:[20,50,75,100,125,150,175,200] },
          { key:'hr', label:'全壘打', short:'HR', targets:[5,10,15,20,25,30,35,40,50,60] },
          { key:'rbi', label:'打點', short:'RBI', targets:[20,30,50,75,100,125,150] },
          { key:'runs', label:'得分', short:'R', targets:[20,30,50,75,100,125,150] }
        ],
        pitcher: [
          { key:'k', label:'三振', short:'K', targets:[20,50,75,100,125,150,175,200,250] },
          { key:'w', label:'勝投', short:'W', targets:[3,5,10,15,20,25] },
          { key:'sv', label:'救援成功', short:'SV', targets:[5,10,20,30,40,50] },
          { key:'hld', label:'中繼成功', short:'HLD', targets:[5,10,20,30,40,50] },
          { key:'innings', label:'投球局數', short:'IP', targets:[25,50,75,100,125,150,175,200] }
        ]
      }
    };

    function milestoneLeagueLabel(code) {
      return code === 'NPB' ? '日本職棒' : '中華職棒';
    }

    function milestoneScopeLabel(scope = milestoneScopeFilter) {
      return scope === 'season' ? `${milestoneSnapshot?.season || CURRENT_YEAR} 本季` : '生涯';
    }

    function milestoneSnapshotCacheKey() {
      return 'diamondscope-milestone-snapshot-v2';
    }

    function milestoneReadCachedSnapshot() {
      try {
        const saved = JSON.parse(localStorage.getItem(milestoneSnapshotCacheKey()) || 'null');
        if (!saved?.data || Number(saved?.data?.schemaVersion) < 2) return null;
        const age = Date.now() - Number(saved.at || 0);
        if (!Number.isFinite(age) || age > 12 * 60 * 60 * 1000) return null;
        return saved.data;
      } catch {
        return null;
      }
    }

    function milestoneSaveSnapshot(data) {
      try {
        localStorage.setItem(milestoneSnapshotCacheKey(), JSON.stringify({ at:Date.now(), data }));
      } catch {}
    }

    async function loadMilestoneSnapshot({ force = false } = {}) {
      if (milestoneSnapshotLoading) return;
      if (!force && milestoneSnapshot && milestoneSnapshotRemoteChecked) return;

      if (!force && !milestoneSnapshot) {
        const cached = milestoneReadCachedSnapshot();
        if (cached) milestoneSnapshot = cached;
      }

      milestoneSnapshotLoading = true;
      milestoneSnapshotError = '';
      if (currentPage === 'milestone') renderMilestonePage();

      try {
        const day = typeof localISODate === 'function' ? localISODate() : new Date().toISOString().slice(0,10);
        const response = await fetch(`./data/milestones.json?d=${encodeURIComponent(day)}`, { cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data?.leagues?.CPBL || !data?.leagues?.NPB) throw new Error('里程碑資料格式不完整');
        milestoneSnapshot = data;
        milestoneSnapshotRemoteChecked = true;
        milestoneSaveSnapshot(data);
      } catch (error) {
        milestoneSnapshotRemoteChecked = true;
        if (!milestoneSnapshot) {
          milestoneSnapshotError = error instanceof Error ? error.message : String(error);
        }
      } finally {
        milestoneSnapshotLoading = false;
        if (currentPage === 'milestone') renderMilestonePage();
      }
    }

    function milestoneCurrentRows() {
      const branch = milestoneSnapshot?.leagues?.[milestoneLeagueFilter]?.[milestoneScopeFilter] || {};
      const hitters = Array.isArray(branch.hitters) ? branch.hitters : [];
      const pitchers = Array.isArray(branch.pitchers) ? branch.pitchers : [];
      return [
        ...hitters.map(player => ({ ...player, type:'hitter' })),
        ...pitchers.map(player => ({ ...player, type:'pitcher' }))
      ];
    }

    function milestoneNextTarget(value, targets) {
      const safe = Math.max(0, Number(value) || 0);
      const target = targets.find(n => n > safe) || (Math.floor(safe / 500) + 1) * 500;
      return { value:safe, target, remaining:Math.max(0,target-safe), progress:target ? safe/target : 0 };
    }

    function milestoneRows(player) {
      const stats = player?.stats || {};
      const specs = MILESTONE_TARGETS[milestoneScopeFilter][player.type] || [];
      return specs.map(spec => {
        const value = spec.key === 'innings'
          ? (Number(stats.outs)||0) / 3
          : Number(stats[spec.key]) || 0;
        return { ...spec, ...milestoneNextTarget(value, spec.targets) };
      }).filter(row => row.value > 0);
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
      if (row.key === 'innings') return row.remaining / (milestoneScopeFilter === 'season' ? 8 : 20);
      if (['hr','w','sv','hld'].includes(row.key)) return row.remaining / (milestoneScopeFilter === 'season' ? 2 : 4);
      return row.remaining / (milestoneScopeFilter === 'season' ? 8 : 20);
    }

    function milestonePlayerItems() {
      return milestoneCurrentRows()
        .map(player => ({ player, rows:milestoneRows(player) }))
        .filter(item => item.rows.length);
    }

    function milestoneSpotlights(items) {
      const events = items.flatMap(item => item.rows.map(row => ({ player:item.player, row })))
        .sort((a,b) => milestoneNearScore(a.row)-milestoneNearScore(b.row)
          || b.row.progress-a.row.progress
          || String(a.player?.name||'').localeCompare(String(b.player?.name||''),'zh-Hant'))
        .slice(0,3);

      if (!events.length) return '<div class="milestone-focus-empty">目前沒有可計算的里程碑資料。</div>';

      return events.map((event,index) => `
        <article class="milestone-focus-item">
          <span class="milestone-focus-rank">0${index+1}</span>
          <div class="milestone-focus-main">
            <div class="milestone-focus-name">${escapeHtml(event.player.name || '未命名球員')}</div>
            <div class="milestone-focus-desc">${escapeHtml(event.player.team || '')} · ${escapeHtml(event.row.label)} ${milestoneValueText(event.row)} → ${event.row.target}</div>
          </div>
          <div class="milestone-focus-gap">
            <span>還差</span>
            <strong>${milestoneRemainText(event.row)}</strong>
          </div>
        </article>
      `).join('');
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
      const sorted = [...item.rows].sort((a,b) => milestoneNearScore(a)-milestoneNearScore(b) || b.progress-a.progress);
      return `
        <article class="milestone-player-line">
          <div class="milestone-player-identity">
            <span>${player.type === 'pitcher' ? 'P' : 'B'}</span>
            <div>
              <strong>${escapeHtml(player.name || '未命名球員')}</strong>
              <small>${escapeHtml(player.team || '')} · ${milestoneScopeLabel()}</small>
            </div>
          </div>
          <div class="milestone-player-metrics">
            ${sorted.slice(0,4).map(milestoneMetricPill).join('')}
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
        })
        .slice(0,16);

      return `
        <section class="milestone-group">
          <div class="milestone-group-head">
            <div>
              <span>${type === 'pitcher' ? 'PITCHING' : 'BATTING'}</span>
              <h3>${escapeHtml(title)}</h3>
            </div>
            <b>最接近 16 人</b>
          </div>
          <div class="milestone-player-list">
            ${rows.length ? rows.map(milestonePlayerLine).join('') : '<div class="milestone-group-empty">目前沒有這一類的里程碑資料。</div>'}
          </div>
        </section>
      `;
    }

    function milestoneLeagueButton(code,label) {
      return `<button type="button" class="milestone-league-tab ${milestoneLeagueFilter===code?'active':''}" data-milestone-league="${code}">${escapeHtml(label)}</button>`;
    }

    function milestoneScopeButton(scope,label) {
      return `<button type="button" class="milestone-scope-tab ${milestoneScopeFilter===scope?'active':''}" data-milestone-scope="${scope}">${escapeHtml(label)}</button>`;
    }

    function milestoneUpdatedText() {
      const value = String(milestoneSnapshot?.generatedAt || '');
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    }

    function bindMilestoneEvents() {
      els.milestonePageContent?.querySelectorAll('[data-milestone-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          milestoneLeagueFilter = String(btn.dataset.milestoneLeague || '') === 'NPB' ? 'NPB' : 'CPBL';
          localStorage.setItem('milestoneLeagueFilter', milestoneLeagueFilter);
          renderMilestonePage();
        });
      });

      els.milestonePageContent?.querySelectorAll('[data-milestone-scope]').forEach(btn => {
        btn.addEventListener('click', () => {
          milestoneScopeFilter = String(btn.dataset.milestoneScope || '') === 'season' ? 'season' : 'career';
          localStorage.setItem('milestoneScopeFilter', milestoneScopeFilter);
          renderMilestonePage();
        });
      });

      els.milestonePageContent?.querySelector('[data-milestone-refresh]')?.addEventListener('click', () => {
        void loadMilestoneSnapshot({ force:true });
      });
    }

    function renderMilestonePage() {
      if (!els.milestonePageContent) return;
      if (!milestoneSnapshot && !milestoneSnapshotLoading) {
        const cached = milestoneReadCachedSnapshot();
        if (cached) milestoneSnapshot = cached;
        void loadMilestoneSnapshot();
      }

      const controls = `
        <div class="milestone-filter-stack">
          <div class="milestone-league-tabs" aria-label="里程碑聯盟">
            ${milestoneLeagueButton('CPBL','台灣')}
            ${milestoneLeagueButton('NPB','日本')}
          </div>
          <div class="milestone-scope-tabs" aria-label="里程碑範圍">
            ${milestoneScopeButton('career','生涯')}
            ${milestoneScopeButton('season','本季')}
          </div>
        </div>
      `;

      if (!milestoneSnapshot) {
        els.milestonePageContent.innerHTML = `
          ${controls}
          <div class="milestone-loading-state">
            <strong>${milestoneSnapshotError ? '里程碑資料暫時無法載入' : '正在載入台日職棒里程碑…'}</strong>
            <span>${milestoneSnapshotError ? escapeHtml(milestoneSnapshotError) : '每日靜態快照，不啟動背景輪詢。'}</span>
            ${milestoneSnapshotError ? '<button class="press-btn" type="button" data-milestone-refresh>重新載入</button>' : ''}
          </div>
        `;
        bindMilestoneEvents();
        return;
      }

      const items = milestonePlayerItems();
      const scopeText = milestoneScopeLabel();
      els.milestonePageContent.innerHTML = `
        ${controls}

        <section class="milestone-focus">
          <div class="milestone-focus-head">
            <div>
              <span>NEAREST MILESTONES</span>
              <h3>最接近達成</h3>
            </div>
            <b>${escapeHtml(milestoneLeagueLabel(milestoneLeagueFilter))} · ${escapeHtml(scopeText)}</b>
          </div>
          <div class="milestone-focus-list">${milestoneSpotlights(items)}</div>
        </section>

        ${milestoneSection('打者里程碑',items,'hitter')}
        ${milestoneSection('投手里程碑',items,'pitcher')}

        <div class="milestone-data-note">
          官方聯盟資料每日整理一次 · 更新 ${escapeHtml(milestoneUpdatedText() || '等待首次快照')} · 開啟本頁不使用 Supabase 輪詢
          <button type="button" data-milestone-refresh>更新快照</button>
        </div>
      `;
      bindMilestoneEvents();
    }
