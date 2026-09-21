const PREDICTION_API_URL = `${SUPABASE_B_FUNCTIONS_BASE}/league-predictions`;
    const predictionUiState = {
      league: ['cpbl','npb','kbo','mlb'].includes(localStorage.getItem('predictionLeague'))
        ? localStorage.getItem('predictionLeague')
        : 'cpbl',
      mode: ['game','postseason'].includes(localStorage.getItem('predictionMode'))
        ? localStorage.getItem('predictionMode')
        : 'game'
    };
    const predictionDataCache = new Map();
    const predictionLoading = new Set();
    const predictionErrors = new Map();

    function predictionLeagueCode() {
      return String(predictionUiState.league || 'cpbl').toUpperCase();
    }

    function predictionDate() {
      return String(els.gameDate?.value || localISODate());
    }

    function predictionKey() {
      return [predictionLeagueCode(), predictionUiState.mode, predictionDate()].join('|');
    }

    function predictionLeagueButton(label, value) {
      const active = predictionUiState.league === value;
      return `<button type="button" class="prediction-league-btn ${active ? 'active' : ''}" data-prediction-league="${value}" aria-pressed="${active ? 'true' : 'false'}">${label}</button>`;
    }

    function predictionModeButton(label, value) {
      const active = predictionUiState.mode === value;
      return `<button type="button" class="prediction-mode-btn ${active ? 'active' : ''}" data-prediction-mode="${value}" aria-pressed="${active ? 'true' : 'false'}">${label}</button>`;
    }

    function predictionLeagueLabel() {
      return {
        cpbl:'中華職棒',
        npb:'日本職棒',
        kbo:'韓國職棒',
        mlb:'美國職棒'
      }[predictionUiState.league] || '中華職棒';
    }

    function predictionGroupLabel(group) {
      return {
        central:'央聯',
        pacific:'洋聯',
        regular:'KBO',
        annual:'全年度',
        alEast:'美聯東區',
        alCentral:'美聯中區',
        alWest:'美聯西區',
        nlEast:'國聯東區',
        nlCentral:'國聯中區',
        nlWest:'國聯西區'
      }[String(group || '')] || '';
    }

    function predictionPctClass(value) {
      const p = Number(value) || 0;
      if (p >= 80) return 'is-high';
      if (p <= 20) return 'is-low';
      return 'is-mid';
    }

    function predictionStatusLabel(status) {
      const s = String(status || '').toLowerCase();
      if (s === 'live') return '比賽中';
      if (s === 'suspended') return '暫停';
      return '未開打';
    }

    function predictionModelNote(data) {
      if (!data?.model) return '';
      const factors = Array.isArray(data.model.factors) ? data.model.factors : [];
      return `
        <div class="prediction-model-note">
          <div>
            <strong>${escapeHtml(data.model.name || 'DiamondScope Model')}</strong>
            ${factors.length ? `<span>${factors.map(escapeHtml).join(' ・ ')}</span>` : ''}
            ${data.model.note ? `<span>${escapeHtml(data.model.note)}</span>` : ''}
          </div>
          <button type="button" class="prediction-refresh-btn" data-prediction-refresh>重新計算</button>
        </div>
      `;
    }

    function predictionGameCard(game) {
      const away = escapeHtml(game?.away || '客隊');
      const home = escapeHtml(game?.home || '主隊');
      const awayPct = Math.max(0, Math.min(100, Number(game?.awayProbability) || 0));
      const homePct = Math.max(0, Math.min(100, Number(game?.homeProbability) || 0));
      const factors = Array.isArray(game?.factors) ? game.factors : [];
      const meta = [game?.time, game?.venue].filter(Boolean).map(escapeHtml).join('｜');
      return `
        <article class="prediction-game-card">
          <div class="prediction-game-top">
            <div>
              <span class="prediction-game-status">${predictionStatusLabel(game?.status)}</span>
              ${meta ? `<span class="prediction-game-meta">${meta}</span>` : ''}
            </div>
            <span class="prediction-pick-badge">較看好 ${escapeHtml(game?.pick || '')} ${Number(game?.confidence || 0).toFixed(1)}%</span>
          </div>

          <div class="prediction-matchup">
            <div class="prediction-team-line">
              <strong>${away}</strong>
              <b>${awayPct.toFixed(1)}%</b>
            </div>
            <div class="prediction-probability-track" aria-hidden="true">
              <span class="prediction-probability-away" style="width:${awayPct}%"></span>
              <span class="prediction-probability-home" style="width:${homePct}%"></span>
            </div>
            <div class="prediction-team-line">
              <strong>${home}</strong>
              <b>${homePct.toFixed(1)}%</b>
            </div>
          </div>

          <div class="prediction-factor-list">
            ${factors.map(f => `
              <div class="prediction-factor-row">
                <div>
                  <strong>${escapeHtml(f?.label || '')}</strong>
                  <span>${escapeHtml(f?.detail || '')}</span>
                </div>
                <b>${Number(f?.weight || 0).toFixed(1)}%</b>
              </div>
            `).join('')}
          </div>
        </article>
      `;
    }

    function predictionGameContent(data) {
      const games = Array.isArray(data?.games) ? data.games : [];
      if (!games.length) {
        return `
          <div class="prediction-empty-state">
            <div class="prediction-empty-icon" aria-hidden="true">✓</div>
            <strong>目前沒有待預測賽事</strong>
            <span>已結束與延賽場次不會重新計算預測；可切換日期查看尚未開打的賽事。</span>
          </div>
        `;
      }
      return `<div class="prediction-game-list">${games.map(predictionGameCard).join('')}</div>`;
    }

    function predictionPostseasonRow(row) {
      const p = Math.max(0, Math.min(100, Number(row?.probability) || 0));
      const group = predictionGroupLabel(row?.group);
      return `
        <div class="prediction-postseason-row">
          <div class="prediction-postseason-team">
            <strong>${escapeHtml(row?.team || '')}</strong>
            <span>${group ? `${escapeHtml(group)}｜` : ''}${escapeHtml(row?.record || '')}${row?.firstHalfChampion ? '｜上半季冠軍' : ''}</span>
          </div>
          <div class="prediction-postseason-meter">
            <div class="prediction-postseason-track">
              <span class="${predictionPctClass(p)}" style="width:${p}%"></span>
            </div>
            <span>${escapeHtml(row?.status || '')}</span>
          </div>
          <b class="${predictionPctClass(p)}">${p.toFixed(1)}%</b>
        </div>
      `;
    }

    function predictionPostseasonContent(data) {
      const teams = Array.isArray(data?.teams) ? data.teams : [];
      if (!teams.length) {
        return `
          <div class="prediction-empty-state">
            <strong>目前沒有季後賽模擬資料</strong>
            <span>戰績資料建立後會自動產生季後賽機率。</span>
          </div>
        `;
      }
      return `
        <div class="prediction-postseason-head">
          <span>球隊</span>
          <span>模型狀態</span>
          <span>季後賽機率</span>
        </div>
        <div class="prediction-postseason-list">
          ${teams.map(predictionPostseasonRow).join('')}
        </div>
        <div class="prediction-sim-count">Monte Carlo 模擬 ${Number(data?.iterations || 0).toLocaleString()} 次</div>
      `;
    }

    function predictionWorkspace(data, loading, error) {
      const modeGame = predictionUiState.mode === 'game';
      const title = modeGame ? '比賽預測' : '季後賽預測';
      const kicker = modeGame ? 'GAME PREDICTION' : 'POSTSEASON PREDICTION';
      const date = predictionDate().replaceAll('-', '/');

      let body = '';
      if (loading) {
        body = `
          <div class="prediction-loading-state">
            <span class="prediction-loading-dot"></span>
            <strong>正在計算 ${predictionLeagueLabel()} ${title}…</strong>
          </div>
        `;
      } else if (error) {
        body = `
          <div class="prediction-error-state">
            <strong>預測資料讀取失敗</strong>
            <span>${escapeHtml(error)}</span>
            <button type="button" class="prediction-refresh-btn" data-prediction-refresh>重新嘗試</button>
          </div>
        `;
      } else if (data) {
        body = modeGame ? predictionGameContent(data) : predictionPostseasonContent(data);
      } else {
        body = '<div class="prediction-loading-state"><span class="prediction-loading-dot"></span><strong>準備預測資料…</strong></div>';
      }

      return `
        <section class="prediction-workspace" aria-label="${title}">
          <div class="prediction-workspace-head">
            <div>
              <span>${kicker}</span>
              <strong>${title}</strong>
              <small>${predictionLeagueLabel()}｜${date}</small>
            </div>
            <span class="prediction-stage-badge">${data?.cache ? '快取結果' : '即時計算'}</span>
          </div>
          ${body}
          ${data ? predictionModelNote(data) : ''}
        </section>
      `;
    }

    async function loadPredictionPageData({ force=false } = {}) {
      const key = predictionKey();
      if (predictionLoading.has(key)) return;
      if (!force && predictionDataCache.has(key)) return;

      predictionLoading.add(key);
      predictionErrors.delete(key);
      if (currentPage === 'prediction') renderPredictionPage();

      try {
        const response = await fetch(PREDICTION_API_URL, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body:JSON.stringify({
            appKey:CPBL_APP_KEY,
            league:predictionLeagueCode(),
            mode:predictionUiState.mode,
            date:predictionDate(),
            force
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
        predictionDataCache.set(key, data);
      } catch (error) {
        predictionErrors.set(key, error instanceof Error ? error.message : String(error));
      } finally {
        predictionLoading.delete(key);
        if (currentPage === 'prediction') renderPredictionPage();
      }
    }

    function bindPredictionEvents() {
      if (!els.predictionPageContent) return;

      els.predictionPageContent.querySelectorAll('[data-prediction-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          const league = String(btn.dataset.predictionLeague || '');
          if (!['cpbl','npb','kbo','mlb'].includes(league)) return;
          predictionUiState.league = league;
          localStorage.setItem('predictionLeague', league);
          renderPredictionPage();
        });
      });

      els.predictionPageContent.querySelectorAll('[data-prediction-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = String(btn.dataset.predictionMode || '');
          if (!['game','postseason'].includes(mode)) return;
          predictionUiState.mode = mode;
          localStorage.setItem('predictionMode', mode);
          renderPredictionPage();
        });
      });

      els.predictionPageContent.querySelectorAll('[data-prediction-refresh]').forEach(btn => {
        btn.addEventListener('click', () => void loadPredictionPageData({ force:true }));
      });
    }

    function renderPredictionPage() {
      if (!els.predictionPageContent) return;
      const key = predictionKey();
      const data = predictionDataCache.get(key) || null;
      const loading = predictionLoading.has(key);
      const error = predictionErrors.get(key) || '';

      els.predictionPageContent.innerHTML = `
        <div class="prediction-controls" aria-label="預測聯盟">
          ${predictionLeagueButton('中華職棒','cpbl')}
          ${predictionLeagueButton('日本職棒','npb')}
          ${predictionLeagueButton('韓國職棒','kbo')}
          ${predictionLeagueButton('美國職棒','mlb')}
        </div>

        <div class="prediction-mode-controls" aria-label="預測類型">
          ${predictionModeButton('比賽預測','game')}
          ${predictionModeButton('季後賽預測','postseason')}
        </div>

        ${predictionWorkspace(data, loading, error)}
      `;

      bindPredictionEvents();
      if (!data && !loading && !error) void loadPredictionPageData();
    }