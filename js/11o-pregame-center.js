    const pregameCenterCache = new Map();
    const pregameBullpenCache = new Map();
    let activePregameCenter = null;
    let pregameCenterTab = 'overview';

    function pregameCenterSupported(league) {
      return ['CPBL','NPB'].includes(String(league || '').toUpperCase());
    }

    function pregameCenterKey(league, date, game = {}) {
      return [
        String(league || '').toUpperCase(),
        String(date || ''),
        String(game?.id || ''),
        String(game?.away || ''),
        String(game?.home || '')
      ].join('|');
    }

    function ensurePregameCenterOverlay() {
      let overlay = document.getElementById('pregameCenterOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'pregameCenterOverlay';
      overlay.className = 'pregame-center-overlay hidden';
      overlay.innerHTML = '<div class="pregame-center-sheet" role="dialog" aria-modal="true" aria-label="對戰中心"><div id="pregameCenterBody"></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', event => {
        if (event.target === overlay) closePregameCenter();
      });
      return overlay;
    }

    function pregameCenterBody() {
      ensurePregameCenterOverlay();
      return document.getElementById('pregameCenterBody');
    }

    async function pregameCenterPost(url, payload) {
      const response = await fetch(url, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({ appKey:CPBL_APP_KEY, ...payload })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `讀取失敗（${response.status}）`);
      return data;
    }

    function pregameRecordText(row) {
      if (!row) return '—';
      const wins = Number(row?.wins || 0);
      const losses = Number(row?.losses || 0);
      const ties = Number(row?.ties || 0);
      return `${wins}勝 ${losses}敗${ties ? ` ${ties}和` : ''}`;
    }

    function pregameRecentText(row) {
      if (!row || !Number(row?.games || 0)) return '—';
      return `${Number(row?.wins || 0)}勝 ${Number(row?.losses || 0)}敗${Number(row?.ties || 0) ? ` ${Number(row.ties)}和` : ''}`;
    }

    function pregameH2hText(row) {
      if (!row) return '尚無資料';
      return `${Number(row?.wins || 0)}勝 ${Number(row?.losses || 0)}敗${Number(row?.ties || 0) ? ` ${Number(row.ties)}和` : ''}`;
    }

    function pregameStarterCard(starter, team, sideLabel) {
      const stats = starter?.stats || {};
      const hasStarter = Boolean(starter?.name || starter?.fullName);
      return `
        <article class="pregame-starter-card">
          <div class="pregame-card-kicker">${escapeHtml(sideLabel)}｜${escapeHtml(team)}</div>
          <strong class="pregame-starter-name">${escapeHtml(hasStarter ? (starter.name || starter.fullName) : '尚未公布')}</strong>
          ${hasStarter ? `
            <div class="pregame-mini-stats">
              <span><b>ERA</b><strong>${escapeHtml(String(stats?.era || '—'))}</strong></span>
              <span><b>WHIP</b><strong>${escapeHtml(String(stats?.whip || '—'))}</strong></span>
              <span><b>W-L</b><strong>${escapeHtml(`${stats?.wins ?? '—'}-${stats?.losses ?? '—'}`)}</strong></span>
              <span><b>IP</b><strong>${escapeHtml(String(stats?.ip || '—'))}</strong></span>
            </div>
          ` : '<div class="pregame-empty-note">聯盟公布後會自動更新。</div>'}
        </article>
      `;
    }

    function pregameLineupCard(lineup, team, sideLabel) {
      const names = Array.isArray(lineup?.names) ? lineup.names : [];
      return `
        <article class="pregame-lineup-card">
          <div class="pregame-card-kicker">${escapeHtml(sideLabel)}｜${escapeHtml(team)}</div>
          <div class="pregame-card-title-row">
            <strong>先發打序</strong>
            <span class="${lineup?.confirmed ? 'is-ready' : ''}">${lineup?.confirmed ? '已公布' : '預估'}</span>
          </div>
          ${names.length ? `
            <ol class="pregame-lineup-list">
              ${names.slice(0,9).map((name,index) => `<li><b>${index + 1}</b><span>${escapeHtml(String(name))}</span></li>`).join('')}
            </ol>
          ` : '<div class="pregame-empty-note">目前沒有可顯示的打序。</div>'}
        </article>
      `;
    }

    function bullpenLevelClass(level) {
      return ['fresh','normal','tired','heavy'].includes(String(level || '')) ? String(level) : 'normal';
    }

    function bullpenSummaryCard(raw, team, sideLabel) {
      const availability = Number(raw?.availabilityPct);
      return `
        <article class="pregame-bullpen-summary">
          <div class="pregame-card-kicker">${escapeHtml(sideLabel)}｜${escapeHtml(team)}</div>
          <div class="pregame-bullpen-score">
            <strong>${Number.isFinite(availability) ? availability.toFixed(0) + '%' : '—'}</strong>
            <span class="bullpen-level ${bullpenLevelClass(raw?.level)}">${escapeHtml(raw?.levelLabel || '資料不足')}</span>
          </div>
          <div class="pregame-mini-stats">
            <span><b>ERA</b><strong>${Number(raw?.era || 0) ? Number(raw.era).toFixed(2) : '—'}</strong></span>
            <span><b>WHIP</b><strong>${Number(raw?.whip || 0) ? Number(raw.whip).toFixed(2) : '—'}</strong></span>
            <span><b>投手</b><strong>${Number(raw?.pitchers || 0) || '—'}</strong></span>
          </div>
        </article>
      `;
    }

    function renderPregameOverview(data) {
      const game = data?.game || {};
      const away = String(game?.away || activePregameCenter?.game?.away || '客隊');
      const home = String(game?.home || activePregameCenter?.game?.home || '主隊');
      const prediction = data?.prediction || null;
      const awayProb = Number(prediction?.awayProbability);
      const homeProb = Number(prediction?.homeProbability);
      const hasPrediction = Number.isFinite(awayProb) && Number.isFinite(homeProb) && (awayProb + homeProb > 0);
      const awayH2h = data?.h2h?.away || null;

      return `
        <section class="pregame-hero">
          <div class="pregame-hero-meta">${escapeHtml(String(data?.date || ''))}${game?.time ? `｜${escapeHtml(String(game.time))}` : ''}${game?.venue ? `｜${escapeHtml(String(game.venue))}` : ''}</div>
          <div class="pregame-matchup">
            <div><span>客隊</span><strong>${escapeHtml(away)}</strong></div>
            <b>VS</b>
            <div><span>主隊</span><strong>${escapeHtml(home)}</strong></div>
          </div>
          ${hasPrediction ? `
            <div class="pregame-prediction">
              <div class="pregame-prediction-head"><span>${escapeHtml(away)} ${awayProb.toFixed(1)}%</span><b>賽前勝率</b><span>${escapeHtml(home)} ${homeProb.toFixed(1)}%</span></div>
              <div class="pregame-prediction-track"><span style="width:${Math.max(0,Math.min(100,awayProb))}%"></span></div>
            </div>
          ` : ''}
        </section>

        <section class="pregame-compare-grid">
          <article><span>球季戰績</span><strong>${escapeHtml(pregameRecordText(data?.standings?.away))}</strong><small>${escapeHtml(away)}</small></article>
          <article><span>本季對戰</span><strong>${escapeHtml(pregameH2hText(awayH2h))}</strong><small>${escapeHtml(away)} 視角</small></article>
          <article><span>最近 6 場</span><strong>${escapeHtml(pregameRecentText(data?.recent?.away))}</strong><small>${escapeHtml(away)}</small></article>
          <article><span>球季戰績</span><strong>${escapeHtml(pregameRecordText(data?.standings?.home))}</strong><small>${escapeHtml(home)}</small></article>
          <article><span>對戰反向</span><strong>${escapeHtml(pregameH2hText(data?.h2h?.home))}</strong><small>${escapeHtml(home)} 視角</small></article>
          <article><span>最近 6 場</span><strong>${escapeHtml(pregameRecentText(data?.recent?.home))}</strong><small>${escapeHtml(home)}</small></article>
        </section>

        <section class="pregame-section">
          <div class="pregame-section-head"><strong>預告先發</strong><span>${data?.starters?.published ? '已取得官方資料' : '等待公布'}</span></div>
          <div class="pregame-two-col">
            ${pregameStarterCard(data?.starters?.away, away, '客隊')}
            ${pregameStarterCard(data?.starters?.home, home, '主隊')}
          </div>
        </section>

        <section class="pregame-section">
          <div class="pregame-section-head">
            <strong>牛棚狀況</strong>
            <button class="pregame-inline-btn" type="button" data-pregame-tab="bullpen">查看完整牛棚</button>
          </div>
          <div class="pregame-two-col">
            ${bullpenSummaryCard(data?.bullpen?.away, away, '客隊')}
            ${bullpenSummaryCard(data?.bullpen?.home, home, '主隊')}
          </div>
        </section>
      `;
    }

    function bullpenWorkText(item) {
      if (!item) return '—';
      const yesterday = Number(item?.yesterdayWork || 0);
      const total = Number(item?.totalWork || 0);
      const days = Number(item?.days || 0);
      const unit = String(item?.unit || 'BF');
      const parts = [];
      if (yesterday) parts.push(`昨日 ${yesterday}${unit}`);
      if (total && total !== yesterday) parts.push(`近兩日 ${total}${unit}`);
      if (days >= 2) parts.push('連兩日');
      return parts.join('｜') || '近期無高負荷';
    }

    function renderBullpenTeam(raw, team, sideLabel) {
      const members = Array.isArray(raw?.members) ? raw.members : [];
      const tired = Array.isArray(raw?.tired) ? raw.tired : [];
      const availability = Number(raw?.availabilityPct);
      return `
        <article class="bullpen-team-panel">
          <header>
            <div><span>${escapeHtml(sideLabel)}</span><strong>${escapeHtml(team)}</strong></div>
            <div class="bullpen-availability ${bullpenLevelClass(raw?.level)}"><b>${Number.isFinite(availability) ? availability.toFixed(0) + '%' : '—'}</b><span>${escapeHtml(raw?.levelLabel || '資料不足')}</span></div>
          </header>
          <div class="bullpen-team-metrics">
            <span><b>牛棚 ERA</b><strong>${Number(raw?.era || 0) ? Number(raw.era).toFixed(2) : '—'}</strong></span>
            <span><b>WHIP</b><strong>${Number(raw?.whip || 0) ? Number(raw.whip).toFixed(2) : '—'}</strong></span>
            <span><b>投手數</b><strong>${Number(raw?.pitchers || 0) || '—'}</strong></span>
          </div>

          <div class="bullpen-subhead"><strong>近期高負荷</strong><span>以前兩日使用量判定</span></div>
          ${tired.length ? `
            <div class="bullpen-workload-list">
              ${tired.map(item => `
                <div class="bullpen-workload-row">
                  <div><strong>${escapeHtml(item?.name || '—')}</strong><span>${escapeHtml(bullpenWorkText(item))}</span></div>
                  <b class="status-${String(item?.status || '') === '高負荷' ? 'heavy' : String(item?.status || '') === '注意' ? 'tired' : 'normal'}">${escapeHtml(item?.status || '可用')}</b>
                </div>
              `).join('')}
            </div>
          ` : '<div class="pregame-empty-note">目前沒有需要特別標記的高負荷投手。</div>'}

          <div class="bullpen-subhead"><strong>牛棚成員</strong><span>${members.length ? `${members.length} 人` : '資料來源未提供完整名單'}</span></div>
          ${members.length ? `
            <div class="bullpen-member-list">
              ${members.map(member => `
                <div class="bullpen-member-row">
                  <strong>${escapeHtml(member?.name || '—')}</strong>
                  <span>ERA ${Number(member?.era || 0).toFixed(2)}</span>
                  <span>WHIP ${Number(member?.whip || 0).toFixed(2)}</span>
                  ${Number(member?.holds || 0) ? `<span>HLD ${Number(member.holds)}</span>` : ''}
                  ${Number(member?.saves || 0) ? `<span>SV ${Number(member.saves)}</span>` : ''}
                  ${member?.workload ? `<b>${escapeHtml(member.workload.status || '')}</b>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </article>
      `;
    }

    function renderBullpenPage(data) {
      const game = activePregameCenter?.game || {};
      const away = String(data?.away || game?.away || '客隊');
      const home = String(data?.home || game?.home || '主隊');
      return `
        <section class="bullpen-page-intro">
          <span>今日牛棚可用度</span>
          <strong>${escapeHtml(away)} vs ${escapeHtml(home)}</strong>
          <p>依球季牛棚表現與前兩日後援使用量計算；「可用度」不是傷病判定。</p>
        </section>
        <div class="bullpen-page-grid">
          ${renderBullpenTeam(data?.awayBullpen, away, '客隊')}
          ${renderBullpenTeam(data?.homeBullpen, home, '主隊')}
        </div>
      `;
    }

    function renderPregameCenter({ loading=false, error='' } = {}) {
      const body = pregameCenterBody();
      if (!body || !activePregameCenter) return;
      const { league, date, game, key } = activePregameCenter;
      if (league !== 'CPBL' && pregameCenterTab === 'bullpen') pregameCenterTab = 'overview';
      const data = pregameCenterCache.get(key)?.data || null;
      const bullpenData = pregameBullpenCache.get(key)?.data || null;
      const leagueLabel = ({CPBL:'中華職棒',NPB:'日本職棒',KBO:'韓國職棒'})[league] || league;

      body.innerHTML = `
        <header class="pregame-center-head">
          <button class="pregame-close-btn" type="button" data-pregame-close>← 返回</button>
          <div><span>PRE-GAME CENTER</span><strong>對戰中心</strong><small>${escapeHtml(leagueLabel)}</small></div>
          <button class="pregame-refresh-btn" type="button" data-pregame-refresh>重新讀取</button>
        </header>
        <nav class="pregame-tabs ${league === 'NPB' ? 'is-two' : ''}">
          <button type="button" data-pregame-tab="play">逐打席紀錄</button>
          <button type="button" data-pregame-tab="overview" class="${pregameCenterTab === 'overview' ? 'active' : ''}">對戰總覽</button>
          ${league === 'CPBL' ? `<button type="button" data-pregame-tab="bullpen" class="${pregameCenterTab === 'bullpen' ? 'active' : ''}">牛棚狀態</button>` : ''}
        </nav>
        <main class="pregame-center-content">
          ${loading && !data ? '<div class="pregame-loading"><span></span><strong>正在整理賽前資料…</strong></div>' : ''}
          ${error ? `<div class="pregame-error">${escapeHtml(error)}</div>` : ''}
          ${pregameCenterTab === 'overview' && data ? renderPregameOverview(data) : ''}
          ${league === 'CPBL' && pregameCenterTab === 'bullpen'
            ? (bullpenData ? renderBullpenPage(bullpenData) : '<div class="pregame-loading"><span></span><strong>正在讀取牛棚狀況…</strong></div>')
            : ''}
        </main>
      `;

      body.querySelector('[data-pregame-close]')?.addEventListener('click', closePregameCenter);
      body.querySelector('[data-pregame-refresh]')?.addEventListener('click', () => void loadPregameCenter(true));
      body.querySelectorAll('[data-pregame-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = String(btn.dataset.pregameTab || '');
          if (tab === 'play') {
            const current = activePregameCenter;
            if (current && typeof openHomeGameDetail === 'function') {
              closePregameCenter();
              openHomeGameDetail(current.game, current.league, current.date, { tab:'play' });
            }
            return;
          }
          const allowed = league === 'CPBL' ? ['overview','bullpen'] : ['overview'];
          if (!allowed.includes(tab)) return;
          pregameCenterTab = tab;
          renderPregameCenter();
          if (tab === 'bullpen' && league === 'CPBL' && !pregameBullpenCache.get(key)?.data) void loadPregameBullpen();
        });
      });

      const overlay = ensurePregameCenterOverlay();
      overlay.classList.remove('hidden');
      document.body.classList.add('pregame-center-open');
    }

    async function loadPregameCenter(force=false) {
      if (!activePregameCenter) return;
      const { league, date, game, key } = activePregameCenter;
      if (!force && pregameCenterCache.get(key)?.data) {
        renderPregameCenter();
        return;
      }
      renderPregameCenter({ loading:true });
      try {
        const data = await pregameCenterPost(LEAGUE_PREGAME_CENTER_API_URL, {
          league,date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || ''),
          time:String(game?.time || ''),
          venue:String(game?.venue || ''),
          status:String(game?.status || 'scheduled'),
          force:Boolean(force)
        });
        pregameCenterCache.set(key,{ at:Date.now(), data });
        if (data?.bullpen) {
          pregameBullpenCache.set(key,{
            at:Date.now(),
            data:{
              ok:true,league,date,gameId:String(game?.id || ''),
              away:String(game?.away || ''),home:String(game?.home || ''),
              awayBullpen:data.bullpen.away,homeBullpen:data.bullpen.home
            }
          });
        }
        renderPregameCenter();
      } catch (error) {
        renderPregameCenter({ error:error instanceof Error ? error.message : String(error) });
      }
    }

    async function loadPregameBullpen(force=false) {
      if (!activePregameCenter) return;
      const { league, date, game, key } = activePregameCenter;
      if (!force && pregameBullpenCache.get(key)?.data) {
        renderPregameCenter();
        return;
      }
      try {
        const data = await pregameCenterPost(LEAGUE_BULLPEN_STATUS_API_URL, {
          league,date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || ''),
          force:Boolean(force)
        });
        pregameBullpenCache.set(key,{ at:Date.now(), data });
        renderPregameCenter();
      } catch (error) {
        renderPregameCenter({ error:error instanceof Error ? error.message : String(error) });
      }
    }

    function openPregameCenter(game, league, date) {
      league = String(league || '').toUpperCase();
      if (!pregameCenterSupported(league) || !game) return;
      if (typeof openHomeGameDetail === 'function') {
        openHomeGameDetail(game, league, date, { tab:'overview' });
        return;
      }
    }

    function closePregameCenter() {
      activePregameCenter = null;
      pregameCenterTab = 'overview';
      const overlay = document.getElementById('pregameCenterOverlay');
      overlay?.classList.add('hidden');
      document.body.classList.remove('pregame-center-open');
      if (currentPage === 'home') scheduleHomeDailyGamesAutoRefresh();
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activePregameCenter) closePregameCenter();
    });
