const PREDICTION_API_URL = `${SUPABASE_B_FUNCTIONS_BASE}/league-predictions`;
    const predictionUiState = {
      league: ['cpbl','npb','kbo'].includes(localStorage.getItem('predictionLeague'))
        ? localStorage.getItem('predictionLeague')
        : 'cpbl',
      mode: ['game','postseason'].includes(localStorage.getItem('predictionMode'))
        ? localStorage.getItem('predictionMode')
        : 'game'
    };
    const predictionDataCache = new Map();
    const predictionLoading = new Set();
    const predictionErrors = new Map();
    const PREDICTION_HISTORY_SUPABASE_URL = String(SUPABASE_B_FUNCTIONS_BASE || '').replace(/\/functions\/v1\/?$/,'');
    const PREDICTION_HISTORY_PUBLIC_KEY = 'sb_publishable_uinDyff0LufJDS8WrjoMYw_-W_QO_96';
    const PREDICTION_SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
    let predictionRealtimeClient = null;
    let predictionRealtimeChannel = null;
    let predictionRealtimeTarget = '';
    let predictionRealtimeLoader = null;
    let predictionRealtimeReloadTimer = 0;
    let predictionGameSlideIndex = 0;

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
        kbo:'韓國職棒'
      }[predictionUiState.league] || '中華職棒';
    }

    function predictionGroupLabel(group) {
      return {
        central:'央聯',
        pacific:'洋聯',
        regular:'KBO',
        annual:'全年度'
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
      if (s === 'final') return '比賽結束';
      return '未開打';
    }

    function predictionModelNote(data) {
      if (!data?.model) return '';
      const factors = Array.isArray(data.model.factors) ? data.model.factors : [];
      const updateTime = predictionDisplayTime(data?.fetchedAt || data?.updatedAt || '');
      return `
        <div class="prediction-model-note">
          <div>
            <strong>${escapeHtml(data.model.name || 'DiamondScope Model')}</strong>
            ${factors.length ? `<span>${factors.map(escapeHtml).join(' ・ ')}</span>` : ''}
            ${data.model.note ? `<span>${escapeHtml(data.model.note)}</span>` : ''}
            ${updateTime ? `<span class="prediction-data-time">資料更新 ${escapeHtml(updateTime)}</span>` : ''}
          </div>
          <div class="prediction-model-actions">
            <button type="button" class="prediction-refresh-btn" data-prediction-refresh>更新資料</button>
            ${predictionUiState.mode === 'game' ? '<button type="button" class="prediction-refresh-btn is-recalculate" data-prediction-recalculate>重新計算預測</button>' : ''}
          </div>
        </div>
      `;
    }

    function predictionHistoryPoints(game) {
      const source = Array.isArray(game?.history) ? game.history : [];
      const points = source
        .map(point => ({
          ...point,
          sequence:Number(point?.sequence ?? 0),
          label:String(point?.label || ''),
          homeProbability:Math.max(0, Math.min(100, Number(point?.homeProbability) || 0)),
          awayProbability:Math.max(0, Math.min(100, Number(point?.awayProbability) || 0))
        }))
        .filter(point => point.label)
        .sort((a, b) => a.sequence - b.sequence);

      if (!points.length) {
        const home = Math.max(0, Math.min(100, Number(game?.pregameHomeProbability ?? game?.homeProbability) || 0));
        const away = Math.max(0, Math.min(100, Number(game?.pregameAwayProbability ?? game?.awayProbability) || (100 - home)));
        points.push({
          key:'pregame',
          sequence:4,
          label:'賽前預測',
          homeProbability:home,
          awayProbability:away,
          trigger:'pregame'
        });
      }
      return points;
    }

    function predictionHistoryAxisLabel(label) {
      const value = String(label || '');
      const stage = {
        '初始預測':'初始',
        '牛棚更新':'牛棚',
        '先發公布':'先發',
        '打線公布':'打線',
        '賽前預測':'賽前'
      };
      if (stage[value]) return stage[value];
      const match = value.match(/(\d+)局([上下])/);
      return match ? `${match[1]}${match[2]}` : value;
    }

    function predictionHistoryTriggerLabel(point) {
      const trigger = String(point?.trigger || '');
      const label = String(point?.label || '');
      if (label === '初始預測' || trigger === 'initial') return '初始預測';
      if (label === '牛棚更新' || trigger === 'bullpen-refresh') return '牛棚更新';
      if (label === '先發公布' || trigger === 'starter-published') return '先發公布';
      if (label === '打線公布' || trigger === 'lineup-published') return '打線公布';
      if (/\d+局[上下]/.test(label)) return `${label}結束`;
      return label || '賽前預測';
    }

    function predictionHistoryTime(value) {
      const ms = Date.parse(String(value || ''));
      if (!Number.isFinite(ms)) return '';
      return new Intl.DateTimeFormat('zh-TW', {
        hour:'2-digit',
        minute:'2-digit',
        hour12:false
      }).format(new Date(ms));
    }

    function predictionAdjustmentReason(points, away, home) {
      const latest = points[points.length - 1] || null;
      const previous = points.length > 1 ? points[points.length - 2] : null;
      const trigger = String(latest?.trigger || '');
      const label = String(latest?.label || '');

      let reason = '目前賽前模型結果';
      if (trigger === 'starter-published' || label === '先發公布') {
        reason = '先發投手公布後重算';
      } else if (trigger === 'bullpen-refresh' || label === '牛棚更新') {
        reason = '前一日賽事結束，依牛棚負荷重算';
      } else if (trigger === 'lineup-published' || label === '打線公布') {
        reason = '先發打序公布後重算';
      } else if (trigger === 'half-inning' || /\d+局[上下]/.test(label)) {
        const half = label.match(/\d+局[上下]/)?.[0] || label;
        reason = `${half}結束，依比分與即時比賽內容重算`;
      } else if (trigger === 'game-final') {
        reason = '比賽結束，依最終結果更新';
      } else if (trigger === 'initial' || label === '初始預測') {
        reason = '初始賽前模型';
      } else if (trigger === 'pregame' || label === '賽前預測') {
        reason = '賽前資料更新後重算';
      }

      if (!latest || !previous) return { reason, delta:'' };

      const latestAway = Number(latest?.awayProbability);
      const previousAway = Number(previous?.awayProbability);
      const latestHome = Number(latest?.homeProbability);
      const previousHome = Number(previous?.homeProbability);
      if (![latestAway,previousAway,latestHome,previousHome].every(Number.isFinite)) {
        return { reason, delta:'' };
      }

      const awayDelta = latestAway - previousAway;
      const homeDelta = latestHome - previousHome;
      const absAway = Math.abs(awayDelta);
      const absHome = Math.abs(homeDelta);

      if (Math.max(absAway, absHome) < 0.05) {
        return { reason, delta:'勝率沒有明顯變化' };
      }

      const team = absAway >= absHome ? away : home;
      const delta = absAway >= absHome ? awayDelta : homeDelta;
      const sign = delta > 0 ? '+' : '';
      return {
        reason,
        delta:`${team} ${sign}${delta.toFixed(1)} 個百分點`
      };
    }

    function predictionDisplayTime(value) {
      const ms = Date.parse(String(value || ''));
      if (!Number.isFinite(ms)) return '';
      return new Intl.DateTimeFormat('zh-TW', {
        month:'2-digit',
        day:'2-digit',
        hour:'2-digit',
        minute:'2-digit',
        hour12:false
      }).format(new Date(ms));
    }

    function predictionPointInsight(game, points, index) {
      const point = points[index] || null;
      const previous = index > 0 ? points[index - 1] : null;
      if (!point) return null;

      const away = String(game?.away || '客隊');
      const home = String(game?.home || '主隊');
      const trigger = String(point?.trigger || '');
      const label = String(point?.label || '');
      let reason = predictionHistoryTriggerLabel(point);
      let factorKey = '';

      if (trigger === 'starter-published' || label === '先發公布') {
        reason = '先發投手公布後重新計算';
        factorKey = 'starter';
      } else if (trigger === 'bullpen-refresh' || label === '牛棚更新') {
        reason = '前一日賽事結束，依牛棚負荷重新計算';
        factorKey = 'bullpen';
      } else if (trigger === 'lineup-published' || label === '打線公布') {
        reason = '先發打序公布後重新計算';
        factorKey = 'lineup';
      } else if (trigger === 'half-inning' || /\d+局[上下]/.test(label)) {
        const half = label.match(/\d+局[上下]/)?.[0] || label;
        reason = `${half}結束，依比分與即時比賽內容重新計算`;
        factorKey = 'live-score';
      } else if (trigger === 'initial' || label === '初始預測') {
        reason = '建立初始賽前預測';
      } else if (trigger === 'pregame' || label === '賽前預測') {
        reason = '賽前資料更新後重新計算';
      }

      const awayPct = Number(point?.awayProbability);
      const homePct = Number(point?.homeProbability);
      const prevAway = Number(previous?.awayProbability);
      const prevHome = Number(previous?.homeProbability);
      let delta = '第一個預測節點';
      if ([awayPct, homePct, prevAway, prevHome].every(Number.isFinite)) {
        const awayDelta = awayPct - prevAway;
        const homeDelta = homePct - prevHome;
        if (Math.max(Math.abs(awayDelta), Math.abs(homeDelta)) < 0.05) {
          delta = '與上一個節點相比沒有明顯變化';
        } else {
          const useAway = Math.abs(awayDelta) >= Math.abs(homeDelta);
          const team = useAway ? away : home;
          const value = useAway ? awayDelta : homeDelta;
          delta = `${team} ${value > 0 ? '+' : ''}${value.toFixed(1)} 個百分點`;
        }
      }

      const factors = Array.isArray(game?.factors) ? game.factors : [];
      const factor = factorKey
        ? factors.find(item => {
            const key = String(item?.key || '');
            if (factorKey === 'live-score') return /live|score|inning/i.test(key) || /半局比分|即時比分/.test(String(item?.label || ''));
            return key === factorKey;
          }) || null
        : null;

      const isLatest = index === points.length - 1;
      const factorDetail = isLatest && factor?.detail
        ? `${String(factor?.label || reason)}：${String(factor.detail)}`
        : '';

      const score = Number.isFinite(Number(point?.awayScore)) && Number.isFinite(Number(point?.homeScore))
        ? `${away} ${Number(point.awayScore)}：${Number(point.homeScore)} ${home}`
        : '';
      const time = predictionDisplayTime(point?.updatedAt || point?.createdAt || '');

      return { reason, delta, factorDetail, score, time, awayPct, homePct };
    }

    function predictionWinChart(game, gameIndex = 0) {
      const points = predictionHistoryPoints(game);
      const away = String(game?.away || '客隊');
      const home = String(game?.home || '主隊');

      const pointByKey = new Map();
      points.forEach(point => {
        const key = String(point?.key || '');
        const label = String(point?.label || '');
        if (key === 'starter' || label === '先發公布') pointByKey.set('starter', point);
        else if (key === 'bullpen' || label === '牛棚更新') pointByKey.set('bullpen', point);
        else if (key === 'lineup' || label === '打線公布') pointByKey.set('lineup', point);
        else {
          const match = label.match(/(\d+)局([上下])/);
          if (match) pointByKey.set(`inning-${match[1]}-${match[2] === '下' ? 'bottom' : 'top'}`, point);
          else if (/^inning-/.test(key)) pointByKey.set(key, point);
        }
      });

      const maxRecordedInning = points.reduce((max, point) => {
        const match = String(point?.label || '').match(/(\d+)局[上下]/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      const currentInning = Number(String(game?.inningLabel || '').match(/(\d+)局/)?.[1] || 0);
      const inningLimit = Math.max(9, Math.min(12, Math.max(maxRecordedInning, currentInning)));

      const slots = [
        { key:'starter', label:'先發投手' },
        { key:'bullpen', label:'牛棚狀態' },
        { key:'lineup', label:'先發打序' }
      ];
      for (let inning = 1; inning <= inningLimit; inning++) {
        slots.push({ key:`inning-${inning}-top`, label:`${inning}局上半` });
        slots.push({ key:`inning-${inning}-bottom`, label:`${inning}局下半` });
      }

      const width = 320;
      const labelWidth = 74;
      const plotLeft = labelWidth + 8;
      const plotRight = width - 8;
      const plotWidth = plotRight - plotLeft;
      const rowHeight = 24;
      const headerHeight = 34;
      const bottomPad = 10;
      const height = headerHeight + slots.length * rowHeight + bottomPad;
      const xFor = homeProbability => plotLeft + Math.max(0, Math.min(100, Number(homeProbability) || 0)) / 100 * plotWidth;
      const yFor = index => headerHeight + index * rowHeight + rowHeight / 2;
      const completed = slots
        .map((slot,index) => ({slot,index,point:pointByKey.get(slot.key) || null}))
        .filter(item => item.point);

      const linePoints = completed.map(item =>
        `${xFor(item.point.homeProbability).toFixed(1)},${yFor(item.index).toFixed(1)}`
      ).join(' ');

      const latest = points[points.length - 1] || null;
      const latestHome = Number(latest?.homeProbability ?? game?.homeProbability ?? 50);
      const latestAway = Number(latest?.awayProbability ?? game?.awayProbability ?? (100 - latestHome));
      const adjustment = predictionAdjustmentReason(points, away, home);

      const rowSvg = slots.map((slot,index) => {
        const y = yFor(index);
        const point = pointByKey.get(slot.key);
        const homePct = point ? Math.max(0, Math.min(100, Number(point.homeProbability) || 0)) : 50;
        const awayPct = point ? Math.max(0, Math.min(100, Number(point.awayProbability ?? (100 - homePct)) || 0)) : 50;
        const x = point ? xFor(homePct) : null;
        const onAwaySide = point && homePct < 50;
        const onHomeSide = point && homePct > 50;
        const displayPct = point ? (onAwaySide ? awayPct : onHomeSide ? homePct : 50) : 0;
        const labelX = point
          ? Math.min(plotRight - 7, Math.max(plotLeft + 7, x + (onAwaySide ? -7 : onHomeSide ? 7 : 0)))
          : 0;
        const labelAnchor = onAwaySide ? 'end' : onHomeSide ? 'start' : 'middle';
        const isLast = point && latest && String(point?.key || '') === String(latest?.key || '');
        const pointIndex = point ? points.findIndex(item => item === point) : -1;
        return `
          <g class="prediction-lr-row ${point ? 'is-complete is-clickable' : 'is-pending'}" ${point ? `data-prediction-point-index="${pointIndex}" tabindex="0" role="button" aria-label="${escapeHtml(slot.label)} 詳細資料"` : ''}>
            <line class="prediction-lr-row-line" x1="${plotLeft}" x2="${plotRight}" y1="${y}" y2="${y}"></line>
            <circle class="prediction-lr-status" cx="${labelWidth - 8}" cy="${y}" r="${point ? 3.2 : 2.4}"></circle>
            <text class="prediction-lr-label" x="2" y="${y + 3.2}">${escapeHtml(slot.label)}</text>
            ${point ? `
              <circle class="prediction-lr-point ${isLast ? 'is-current' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isLast ? 5.2 : 3.5}"></circle>
              <text class="prediction-lr-value" x="${labelX.toFixed(1)}" y="${(y - 6.5).toFixed(1)}" text-anchor="${labelAnchor}">${displayPct.toFixed(1)}%</text>
            ` : ''}
          </g>
        `;
      }).join('');

      return `
        <section class="prediction-win-chart prediction-win-chart-lr" data-prediction-game-index="${gameIndex}" aria-label="${escapeHtml(away)} 對 ${escapeHtml(home)} 勝率走勢">
          <div class="prediction-lr-head">
            <div class="prediction-lr-team prediction-lr-away">
              <strong>${escapeHtml(away)}</strong>
              <b>${latestAway.toFixed(1)}%</b>
            </div>
            <div class="prediction-lr-center prediction-lr-reason" title="${escapeHtml(adjustment.reason)}">
              <strong>${escapeHtml(adjustment.reason)}</strong>
              ${adjustment.delta ? `<span>${escapeHtml(adjustment.delta)}</span>` : ''}
            </div>
            <div class="prediction-lr-team prediction-lr-home">
              <strong>${escapeHtml(home)}</strong>
              <b>${latestHome.toFixed(1)}%</b>
            </div>
          </div>

          <div class="prediction-lr-axis-caption">
            <span>客隊 100%</span>
            <span>50%</span>
            <span>主隊 100%</span>
          </div>

          <div class="prediction-lr-scroll">
            <svg class="prediction-lr-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
              <rect class="prediction-lr-away-zone" x="${plotLeft}" y="${headerHeight - 7}" width="${plotWidth/2}" height="${height-headerHeight+1}" rx="8"></rect>
              <rect class="prediction-lr-home-zone" x="${plotLeft + plotWidth/2}" y="${headerHeight - 7}" width="${plotWidth/2}" height="${height-headerHeight+1}" rx="8"></rect>
              <line class="prediction-lr-midline" x1="${(plotLeft + plotWidth/2).toFixed(1)}" x2="${(plotLeft + plotWidth/2).toFixed(1)}" y1="${headerHeight - 7}" y2="${height - 8}"></line>
              ${completed.length > 1 ? `<polyline class="prediction-lr-connector-shadow" points="${linePoints}"></polyline><polyline class="prediction-lr-connector" points="${linePoints}"></polyline>` : ''}
              ${rowSvg}
            </svg>
          </div>
          <div class="prediction-point-detail hidden" data-prediction-point-detail aria-live="polite"></div>
        </section>
      `;
    }

    function predictionGameCard(game, index=0, total=1) {
      const away = escapeHtml(game?.away || '客隊');
      const home = escapeHtml(game?.home || '主隊');
      const latestHistory = predictionHistoryPoints(game).at(-1) || null;
      // The prediction UI is event-based: while a half inning is still in progress,
      // keep the headline probability on the latest committed history snapshot.
      // It advances only after the backend writes the completed-half event.
      const awayPct = Math.max(0, Math.min(100, Number(latestHistory?.awayProbability ?? game?.awayProbability) || 0));
      const homePct = Math.max(0, Math.min(100, Number(latestHistory?.homeProbability ?? game?.homeProbability) || 0));
      const displayPick = awayPct >= homePct ? String(game?.away || '客隊') : String(game?.home || '主隊');
      const displayConfidence = Math.max(awayPct, homePct);
      const factors = Array.isArray(game?.factors) ? game.factors : [];
      const dataTime = predictionDisplayTime(latestHistory?.updatedAt || latestHistory?.createdAt || '');
      const meta = [
        String(game?.status || '').toLowerCase() === 'live' ? game?.inningLabel : '',
        game?.time,
        game?.venue
      ].filter(Boolean).map(escapeHtml).join('｜');
      return `
        <article class="prediction-game-card">
          <div class="prediction-game-top">
            <div>
              <span class="prediction-game-status">${predictionStatusLabel(game?.status)}</span>
              ${meta ? `<span class="prediction-game-meta">${meta}</span>` : ''}
              ${dataTime ? `<span class="prediction-game-meta prediction-game-updated">更新 ${escapeHtml(dataTime)}</span>` : ''}
            </div>
            <span class="prediction-pick-badge">較看好 ${escapeHtml(displayPick)} ${displayConfidence.toFixed(1)}%</span>
          </div>

          <div class="prediction-matchup prediction-matchup-split">
            <div class="prediction-matchup-teams">
              <div class="prediction-matchup-side prediction-matchup-away">
                <strong>${away}</strong>
                <b>${awayPct.toFixed(1)}%</b>
              </div>
              <div class="prediction-matchup-mid">50%</div>
              <div class="prediction-matchup-side prediction-matchup-home">
                <strong>${home}</strong>
                <b>${homePct.toFixed(1)}%</b>
              </div>
            </div>
            <div class="prediction-probability-track" aria-hidden="true">
              <span class="prediction-probability-away" style="width:${awayPct}%"></span>
              <span class="prediction-probability-home" style="width:${homePct}%"></span>
            </div>
          </div>

          <div class="prediction-factor-list">
            ${factors.map(f => `
              <div class="prediction-factor-row">
                <div>
                  <strong>${escapeHtml(f?.label || '')}</strong>
                  <span>${escapeHtml(f?.detail || '')}</span>
                </div>
                <b>${f?.displayValue ? escapeHtml(f.displayValue) : `${Number(f?.weight || 0).toFixed(1)}%`}</b>
              </div>
            `).join('')}
          </div>

          ${predictionWinChart(game, index)}
          <div class="prediction-game-page" aria-label="第 ${index + 1} 場，共 ${total} 場">${index + 1} / ${total}</div>
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
      return `
        <div class="prediction-game-carousel-shell">
          <div class="prediction-game-swipe-head">
            <span>左右滑動切換場次</span>
            <b data-prediction-carousel-counter>1 / ${games.length}</b>
          </div>
          <div class="prediction-game-list" data-prediction-carousel>
            ${games.map((game, index) => predictionGameCard(game, index, games.length)).join('')}
          </div>
          ${games.length > 1 ? `
            <div class="prediction-carousel-dots" aria-label="場次切換">
              ${games.map((_, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-prediction-slide="${index}" aria-label="第 ${index + 1} 場"></button>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }


    function predictionHash(text) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < String(text || '').length; i += 1) {
        h ^= String(text)[i].charCodeAt(0);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    function predictionRng(seed) {
      let x = Number(seed) || 123456789;
      return () => {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
      };
    }

    function predictionRowStrength(row) {
      const wins = Number(row?.wins || 0);
      const losses = Number(row?.losses || 0);
      const played = wins + losses;
      const raw = played > 0 ? wins / played : .5;
      return Math.max(.28, Math.min(.72, .5 + (raw - .5) * .82));
    }

    function predictionRankRows(rows) {
      return [...rows].sort((a, b) => {
        const ap = Number(a?.pct || 0);
        const bp = Number(b?.pct || 0);
        if (bp !== ap) return bp - ap;
        if (Number(b?.wins || 0) !== Number(a?.wins || 0)) return Number(b?.wins || 0) - Number(a?.wins || 0);
        if (Number(a?.losses || 0) !== Number(b?.losses || 0)) return Number(a?.losses || 0) - Number(b?.losses || 0);
        return Number(a?.currentRank || 99) - Number(b?.currentRank || 99);
      });
    }

    function predictionSimRow(row, totalGames, rng) {
      let wins = Number(row?.wins || 0);
      let losses = Number(row?.losses || 0);
      const ties = Number(row?.ties || 0);
      const games = Number(row?.games || (wins + losses + ties));
      const remaining = Math.max(0, Number(totalGames || 0) - games);
      const strength = predictionRowStrength(row);
      for (let i = 0; i < remaining; i += 1) {
        if (rng() < strength) wins += 1;
        else losses += 1;
      }
      return {
        team:String(row?.team || ''),
        wins,
        losses,
        ties,
        pct:(wins + losses) > 0 ? wins / (wins + losses) : .5,
        currentRank:Number(row?.rank || 99)
      };
    }

    function predictionRows(section) {
      return Array.isArray(section?.rows) ? section.rows : [];
    }

    function predictionPercent(count, iterations) {
      return Number(((Number(count || 0) / Math.max(1, Number(iterations || 1))) * 100).toFixed(1));
    }

    function predictionCurrentRecord(row) {
      return `${Number(row?.wins || 0)}-${Number(row?.losses || 0)}-${Number(row?.ties || 0)}`;
    }

    function predictionCpblStages(standing, date, iterations=5000) {
      const firstRows = predictionRows(standing?.first);
      const secondRows = predictionRows(standing?.second);
      const annualRows = predictionRows(standing?.annual);
      const teams = annualRows.map(row => String(row?.team || '')).filter(Boolean);
      const counts = new Map(teams.map(team => [team, { half:0, postseason:0, direct:0 }]));
      const secondStarted = secondRows.some(row => Number(row?.games || 0) > 0);
      const activeHalf = secondStarted ? 'second' : 'first';
      const activeLabel = secondStarted ? '下半季冠軍' : '上半季冠軍';
      const rng = predictionRng(predictionHash(`CPBL|${date}|${JSON.stringify(standing)}`));

      for (let sim = 0; sim < iterations; sim += 1) {
        const firstFinal = [];
        const secondFinal = [];
        const annualFinal = [];

        for (const annual of annualRows) {
          const team = String(annual?.team || '');
          const first = firstRows.find(row => String(row?.team || '') === team) || { team, wins:0, losses:0, ties:0, games:0, rank:99 };
          const second = secondRows.find(row => String(row?.team || '') === team) || { team, wins:0, losses:0, ties:0, games:0, rank:99 };
          const strength = predictionRowStrength(annual);

          let fw = Number(first?.wins || 0), fl = Number(first?.losses || 0);
          let sw = Number(second?.wins || 0), sl = Number(second?.losses || 0);
          let aw = Number(annual?.wins || 0), al = Number(annual?.losses || 0);

          const firstRemaining = Math.max(0, 60 - Number(first?.games || (fw + fl + Number(first?.ties || 0))));
          const secondRemaining = Math.max(0, 60 - Number(second?.games || (sw + sl + Number(second?.ties || 0))));

          for (let i = 0; i < firstRemaining; i += 1) {
            if (rng() < strength) { fw += 1; aw += 1; }
            else { fl += 1; al += 1; }
          }
          for (let i = 0; i < secondRemaining; i += 1) {
            if (rng() < strength) { sw += 1; aw += 1; }
            else { sl += 1; al += 1; }
          }

          firstFinal.push({ team, wins:fw, losses:fl, pct:(fw + fl) ? fw / (fw + fl) : .5, currentRank:Number(first?.rank || 99) });
          secondFinal.push({ team, wins:sw, losses:sl, pct:(sw + sl) ? sw / (sw + sl) : .5, currentRank:Number(second?.rank || 99) });
          annualFinal.push({ team, wins:aw, losses:al, pct:(aw + al) ? aw / (aw + al) : .5, currentRank:Number(annual?.rank || 99) });
        }

        const firstRank = predictionRankRows(firstFinal);
        const secondRank = predictionRankRows(secondFinal);
        const annualRank = predictionRankRows(annualFinal);
        const firstChampion = firstRank[0]?.team || '';
        const secondChampion = secondRank[0]?.team || '';
        const activeChampion = activeHalf === 'second' ? secondChampion : firstChampion;
        if (activeChampion && counts.has(activeChampion)) counts.get(activeChampion).half += 1;

        const qualified = new Set();
        let direct = '';

        if (firstChampion && secondChampion && firstChampion !== secondChampion) {
          qualified.add(firstChampion);
          qualified.add(secondChampion);
          const f = annualRank.find(row => row.team === firstChampion);
          const s = annualRank.find(row => row.team === secondChampion);
          if (f && s) {
            if (f.pct === s.pct) direct = rng() < .5 ? firstChampion : secondChampion;
            else direct = f.pct > s.pct ? firstChampion : secondChampion;
          }
          const extra = annualRank.find(row => !qualified.has(row.team));
          if (extra) qualified.add(extra.team);
        } else {
          annualRank.slice(0, 3).forEach(row => qualified.add(row.team));
          direct = annualRank[0]?.team || '';
        }

        qualified.forEach(team => {
          if (counts.has(team)) counts.get(team).postseason += 1;
        });
        if (direct && counts.has(direct)) counts.get(direct).direct += 1;
      }

      return {
        ok:true,
        league:'CPBL',
        mode:'postseason',
        date,
        iterations,
        activeHalf,
        stageMetrics:[
          { key:'halfTitleProbability', label:activeLabel },
          { key:'postseasonProbability', label:'進季後賽' },
          { key:'directFinalProbability', label:'直進台灣大賽' }
        ],
        teams:annualRows.map(row => {
          const team = String(row?.team || '');
          const count = counts.get(team) || {};
          return {
            team,
            group:'annual',
            record:predictionCurrentRecord(row),
            rank:Number(row?.rank || 99),
            halfTitleProbability:predictionPercent(count.half, iterations),
            postseasonProbability:predictionPercent(count.postseason, iterations),
            directFinalProbability:predictionPercent(count.direct, iterations)
          };
        }).sort((a,b) => b.postseasonProbability - a.postseasonProbability || b.directFinalProbability - a.directFinalProbability || a.rank - b.rank),
        model:{
          name:'DiamondScope CPBL Postseason Model v2',
          note:`同時模擬上、下半季與全年戰績；「${activeLabel}」會直接納入季後賽與台灣大賽資格判定。`
        }
      };
    }

    function predictionNpbStages(standing, date, iterations=5000) {
      const sections = ['central','pacific'];
      const allRows = sections.flatMap(section => predictionRows(standing?.[section]).map(row => ({ ...row, _group:section })));
      const counts = new Map(allRows.map(row => [String(row?.team || ''), { cs:0, first:0, final:0 }]));
      const rng = predictionRng(predictionHash(`NPB|${date}|${JSON.stringify(standing)}`));

      for (let sim = 0; sim < iterations; sim += 1) {
        for (const section of sections) {
          const rows = predictionRows(standing?.[section]);
          const ranked = predictionRankRows(rows.map(row => predictionSimRow(row, 143, rng)));
          ranked.slice(0,3).forEach((row,index) => {
            const count = counts.get(row.team);
            if (!count) return;
            count.cs += 1;
            if (index === 0) count.final += 1;
            else count.first += 1;
          });
        }
      }

      return {
        ok:true,
        league:'NPB',
        mode:'postseason',
        date,
        iterations,
        stageMetrics:[
          { key:'postseasonProbability', label:'進CS' },
          { key:'firstStageProbability', label:'CS首輪' },
          { key:'finalStageProbability', label:'直進Final Stage' }
        ],
        teams:allRows.map(row => {
          const team = String(row?.team || '');
          const count = counts.get(team) || {};
          return {
            team,
            group:row._group,
            record:predictionCurrentRecord(row),
            rank:Number(row?.rank || 99),
            postseasonProbability:predictionPercent(count.cs, iterations),
            firstStageProbability:predictionPercent(count.first, iterations),
            finalStageProbability:predictionPercent(count.final, iterations)
          };
        }).sort((a,b) => b.postseasonProbability - a.postseasonProbability || b.finalStageProbability - a.finalStageProbability || a.rank - b.rank),
        model:{
          name:'DiamondScope NPB Postseason Model v2',
          note:'央聯、洋聯分開模擬；聯盟第1直接進CS Final Stage，第2、3名進CS首輪。'
        }
      };
    }

    function predictionKboStages(standing, date, iterations=5000) {
      const rows = predictionRows(standing?.regular);
      const counts = new Map(rows.map(row => [String(row?.team || ''), { postseason:0, wildcard:0, semi:0, playoff:0, final:0 }]));
      const rng = predictionRng(predictionHash(`KBO|${date}|${JSON.stringify(standing)}`));

      for (let sim = 0; sim < iterations; sim += 1) {
        const ranked = predictionRankRows(rows.map(row => predictionSimRow(row, 144, rng)));
        ranked.slice(0,5).forEach((row,index) => {
          const count = counts.get(row.team);
          if (!count) return;
          count.postseason += 1;
          if (index === 0) count.final += 1;
          else if (index === 1) count.playoff += 1;
          else if (index === 2) count.semi += 1;
          else count.wildcard += 1;
        });
      }

      return {
        ok:true,
        league:'KBO',
        mode:'postseason',
        date,
        iterations,
        stageMetrics:[
          { key:'postseasonProbability', label:'進季後賽' },
          { key:'wildCardProbability', label:'外卡戰' },
          { key:'semiPlayoffProbability', label:'直進準附加賽' },
          { key:'playoffProbability', label:'直進附加賽' },
          { key:'directFinalProbability', label:'直進韓國大賽' }
        ],
        teams:rows.map(row => {
          const team = String(row?.team || '');
          const count = counts.get(team) || {};
          return {
            team,
            group:'regular',
            record:predictionCurrentRecord(row),
            rank:Number(row?.rank || 99),
            postseasonProbability:predictionPercent(count.postseason, iterations),
            wildCardProbability:predictionPercent(count.wildcard, iterations),
            semiPlayoffProbability:predictionPercent(count.semi, iterations),
            playoffProbability:predictionPercent(count.playoff, iterations),
            directFinalProbability:predictionPercent(count.final, iterations)
          };
        }).sort((a,b) => b.postseasonProbability - a.postseasonProbability || b.directFinalProbability - a.directFinalProbability || a.rank - b.rank),
        model:{
          name:'DiamondScope KBO Postseason Model v2',
          note:'依例行賽最終名次拆分外卡、準附加賽、附加賽與直接進韓國大賽的機率。'
        }
      };
    }

    async function predictionBuildPostseason(league, date) {
      const standing = await predictionStandingData(league, date);
      if (league === 'CPBL') return predictionCpblStages(standing, date);
      if (league === 'NPB') return predictionNpbStages(standing, date);
      return predictionKboStages(standing, date);
    }

    function predictionPostseasonRow(row, metrics) {
      const group = predictionGroupLabel(row?.group);
      return `
        <div class="prediction-postseason-row prediction-postseason-row-stages">
          <div class="prediction-postseason-team">
            <strong>${escapeHtml(row?.team || '')}</strong>
            <span>${group ? `${escapeHtml(group)}｜` : ''}${escapeHtml(row?.record || '')}</span>
          </div>
          <div class="prediction-stage-grid" style="--prediction-stage-count:${Math.max(1, metrics.length)}">
            ${metrics.map(metric => {
              const p = Math.max(0, Math.min(100, Number(row?.[metric.key]) || 0));
              return `
                <div class="prediction-stage-cell">
                  <span>${escapeHtml(metric.label)}</span>
                  <b class="${predictionPctClass(p)}">${p.toFixed(1)}%</b>
                  <div class="prediction-postseason-track" aria-hidden="true">
                    <span class="${predictionPctClass(p)}" style="width:${p}%"></span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    function predictionPostseasonContent(data) {
      const teams = Array.isArray(data?.teams) ? data.teams : [];
      const metrics = Array.isArray(data?.stageMetrics) ? data.stageMetrics : [];
      if (!teams.length || !metrics.length) {
        return `
          <div class="prediction-empty-state">
            <strong>目前沒有季後賽模擬資料</strong>
            <span>戰績資料建立後會自動產生各階段晉級機率。</span>
          </div>
        `;
      }

      const npbGroups = predictionUiState.league === 'npb'
        ? [
            { key:'pacific', label:'洋聯' },
            { key:'central', label:'央聯' }
          ]
        : null;

      const listHtml = npbGroups
        ? npbGroups.map(group => {
            const groupTeams = teams.filter(row => String(row?.group || '') === group.key);
            if (!groupTeams.length) return '';
            return `
              <section class="prediction-postseason-group" aria-label="${group.label}">
                <div class="prediction-postseason-group-title">${group.label}</div>
                <div class="prediction-postseason-list prediction-postseason-list-stages">
                  ${groupTeams.map(row => predictionPostseasonRow(row, metrics)).join('')}
                </div>
              </section>
            `;
          }).join('')
        : `
            <div class="prediction-postseason-list prediction-postseason-list-stages">
              ${teams.map(row => predictionPostseasonRow(row, metrics)).join('')}
            </div>
          `;

      return `
        <div class="prediction-postseason-stage-note">依目前戰績模擬例行賽最終排名與各階段資格</div>
        ${listHtml}
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

    function predictionNormTeam(value) {
      return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    async function predictionPost(url, body) {
      const response = await fetch(url, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    }

    function predictionStandingHit(standing, team) {
      const target = predictionNormTeam(team);
      for (const [section, value] of Object.entries(standing || {})) {
        const rows = Array.isArray(value?.rows) ? value.rows : [];
        const row = rows.find(item => {
          const names = [item?.team, item?.sourceTeam].map(predictionNormTeam).filter(Boolean);
          return names.includes(target);
        });
        if (row) return { section, row };
      }
      return null;
    }

    function predictionPairHomeProbability(awayValue, homeValue) {
      const a = Number(awayValue);
      const h = Number(homeValue);
      if (!Number.isFinite(a) || !Number.isFinite(h) || a < 0 || h < 0 || a + h <= 0) return null;
      return Math.max(.08, Math.min(.92, h / (a + h)));
    }

    function predictionRecentVenue(detail, team, side) {
      const rows = Array.isArray(detail?.recent) ? detail.recent : [];
      let wins = 0, losses = 0, ties = 0;
      for (const game of rows) {
        const isSide = side === 'home'
          ? predictionNormTeam(game?.home) === predictionNormTeam(team)
          : predictionNormTeam(game?.away) === predictionNormTeam(team);
        if (!isSide) continue;
        const result = String(game?.result || '');
        if (result === 'W') wins++;
        else if (result === 'L') losses++;
        else if (result === 'T') ties++;
      }
      const games = wins + losses + ties;
      if (games < 2) return null;
      return {
        wins, losses, ties, games,
        value:(wins + ties * .5 + 1) / (games + 2)
      };
    }

    function predictionReweightGame(game, venueFactor=null) {
      const baseWeights = { season:45, h2h:20, recent:20, venue:10, starter:5 };
      const factors = (Array.isArray(game?.factors) ? game.factors : [])
        .filter(f => String(f?.key || '') !== 'home' && String(f?.key || '') !== 'venue')
        .map(f => ({ ...f, _base:Number(baseWeights[String(f?.key || '')] || 0) }))
        .filter(f => f._base > 0 && Number.isFinite(Number(f?.homeProbability)));
      if (venueFactor) factors.push({ ...venueFactor, _base:10 });
      const total = factors.reduce((sum, f) => sum + f._base, 0);
      if (!total) return game;
      const pHome = Math.max(.08, Math.min(.92, factors.reduce((sum, f) => sum + f._base * Number(f.homeProbability) / 100, 0) / total));
      const pAway = 1 - pHome;
      const homeName = String(game?.home || '');
      const awayName = String(game?.away || '');
      return {
        ...game,
        homeProbability:Number((pHome * 100).toFixed(1)),
        awayProbability:Number((pAway * 100).toFixed(1)),
        pick:pHome >= pAway ? homeName : awayName,
        confidence:Number((Math.max(pHome, pAway) * 100).toFixed(1)),
        factors:factors.map(({ _base, ...f }) => ({ ...f, weight:Number((_base / total * 100).toFixed(1)) }))
      };
    }

    async function predictionStandingData(league, date) {
      const data = await predictionPost(LEAGUE_STANDINGS_API_URL, {
        appKey:CPBL_APP_KEY, action:'current', league, date
      });
      return data?.[String(league || '').toLowerCase()] || {};
    }

    async function predictionRefineVenue(data, league, date) {
      if (!data || !Array.isArray(data.games) || !data.games.length) return data;
      if (Number(data?.model?.version || 0) >= 2) return data;
      let standing = {};
      try { standing = await predictionStandingData(league, date); } catch {}
      const teams = [...new Set(data.games.flatMap(game => [game?.away, game?.home]).filter(Boolean))];
      const details = new Map();
      await Promise.all(teams.map(async team => {
        try {
          const hit = predictionStandingHit(standing, team);
          const view = league === 'CPBL' ? 'annual' : league === 'KBO' ? 'regular' : (hit?.section || 'central');
          const detail = await predictionPost(LEAGUE_TEAM_DETAIL_API_URL, {
            appKey:CPBL_APP_KEY, league, team, view
          });
          details.set(predictionNormTeam(team), detail);
        } catch {
          details.set(predictionNormTeam(team), null);
        }
      }));
      data.games = data.games.map(game => {
        const away = String(game?.away || '');
        const home = String(game?.home || '');
        const awaySplit = predictionRecentVenue(details.get(predictionNormTeam(away)), away, 'away');
        const homeSplit = predictionRecentVenue(details.get(predictionNormTeam(home)), home, 'home');
        let venueFactor = null;
        if (awaySplit && homeSplit) {
          const pHome = predictionPairHomeProbability(awaySplit.value, homeSplit.value);
          if (pHome !== null) venueFactor = {
            key:'venue',
            label:'主客場表現',
            homeProbability:Number((pHome * 100).toFixed(1)),
            detail:`${away} 近期客場 ${awaySplit.wins}-${awaySplit.losses}-${awaySplit.ties}｜${home} 近期主場 ${homeSplit.wins}-${homeSplit.losses}-${homeSplit.ties}`
          };
        }
        return predictionReweightGame(game, venueFactor);
      });
      data.model = {
        ...(data.model || {}),
        name:'DiamondScope Game Model v1.1',
        factors:['球季戰績 45%','本季對戰 20%（有資料時）','近期狀態 20%','主客場表現 10%（有資料時）','先發投手 5%（有資料時）'],
        note:'主客場不再固定加成；只使用實際主場／客場表現，樣本不足時直接移除此因子並重新分配權重。'
      };
      return data;
    }

    async function loadPredictionPageData({ force=false, silent=false } = {}) {
      const key = predictionKey();
      if (predictionLoading.has(key)) return;
      if (!force && predictionDataCache.has(key)) return;

      predictionLoading.add(key);
      predictionErrors.delete(key);
      if (!silent && currentPage === 'prediction') renderPredictionPage();

      try {
        const league = predictionLeagueCode();
        const mode = predictionUiState.mode;
        const date = predictionDate();
        let data;

        if (mode === 'postseason') {
          data = await predictionBuildPostseason(league, date);
        } else {
          data = await predictionPost(PREDICTION_API_URL, {
            appKey:CPBL_APP_KEY,
            league,
            mode,
            date,
            force:Boolean(force)
          });
          if (league === 'CPBL' && Array.isArray(data?.games)) {
            data.games = data.games.filter(game => {
              const text = [
                game?.away, game?.home, game?.competition,
                game?.competitionLabel, game?.kindCode
              ].filter(Boolean).join(' ');
              return !/二軍|farm|minor/i.test(text);
            });
          }
          data = await predictionRefineVenue(data, league, date);
        }

        predictionDataCache.set(key, data);
      } catch (error) {
        predictionErrors.set(key, error instanceof Error ? error.message : String(error));
      } finally {
        predictionLoading.delete(key);
        if (currentPage === 'prediction') renderPredictionPage();
      }
    }

    function predictionLoadSupabaseSdk() {
      if (window.supabase?.createClient) return Promise.resolve(window.supabase);
      if (predictionRealtimeLoader) return predictionRealtimeLoader;
      predictionRealtimeLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PREDICTION_SUPABASE_CDN;
        script.async = true;
        script.crossOrigin = 'anonymous';
        const timer = setTimeout(() => reject(new Error('Prediction Realtime SDK timeout')), 10000);
        script.onload = () => {
          clearTimeout(timer);
          if (window.supabase?.createClient) resolve(window.supabase);
          else reject(new Error('Prediction Realtime SDK unavailable'));
        };
        script.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Prediction Realtime SDK failed to load'));
        };
        document.head.appendChild(script);
      }).catch(error => {
        predictionRealtimeLoader = null;
        throw error;
      });
      return predictionRealtimeLoader;
    }

    async function predictionRealtimeGetClient() {
      if (predictionRealtimeClient) return predictionRealtimeClient;
      const sdk = await predictionLoadSupabaseSdk();
      predictionRealtimeClient = sdk.createClient(
        PREDICTION_HISTORY_SUPABASE_URL,
        PREDICTION_HISTORY_PUBLIC_KEY,
        {
          auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
          realtime:{ params:{ eventsPerSecond:4 } }
        }
      );
      return predictionRealtimeClient;
    }

    function predictionScheduleRealtimeReload(row) {
      const league = predictionLeagueCode();
      const date = predictionDate();
      if (predictionUiState.mode !== 'game' || currentPage !== 'prediction') return;
      if (String(row?.league || '').toUpperCase() !== league) return;
      if (String(row?.game_date || '') !== date) return;

      if (predictionRealtimeReloadTimer) clearTimeout(predictionRealtimeReloadTimer);
      predictionRealtimeReloadTimer = setTimeout(() => {
        predictionRealtimeReloadTimer = 0;
        if (predictionUiState.mode !== 'game' || currentPage !== 'prediction') return;
        const key = predictionKey();
        predictionDataCache.delete(key);
        void loadPredictionPageData({ force:false, silent:true });
      }, 900);
    }

    async function predictionStopRealtime() {
      const old = predictionRealtimeChannel;
      predictionRealtimeChannel = null;
      predictionRealtimeTarget = '';
      if (old && predictionRealtimeClient) {
        try { await predictionRealtimeClient.removeChannel(old); } catch {}
      }
    }

    async function predictionSyncRealtime() {
      if (predictionUiState.mode !== 'game' || currentPage !== 'prediction') {
        if (predictionRealtimeChannel) void predictionStopRealtime();
        return;
      }
      const league = predictionLeagueCode();
      const date = predictionDate();
      const target = `${league}|${date}`;
      if (predictionRealtimeChannel && predictionRealtimeTarget === target) return;

      await predictionStopRealtime();
      predictionRealtimeTarget = target;
      try {
        const client = await predictionRealtimeGetClient();
        if (predictionRealtimeTarget !== target || currentPage !== 'prediction' || predictionUiState.mode !== 'game') return;
        predictionRealtimeChannel = client
          .channel(`prediction-history-${league}-${date}-${Math.random().toString(36).slice(2,8)}`)
          .on('postgres_changes', {
            event:'*',
            schema:'public',
            table:'league_prediction_history',
            filter:`league=eq.${league}`
          }, payload => predictionScheduleRealtimeReload(payload?.new || payload?.old || {}))
          .subscribe();
      } catch (error) {
        console.warn('prediction realtime unavailable', error);
      }
    }

    function bindPredictionEvents() {
      if (!els.predictionPageContent) return;

      els.predictionPageContent.querySelectorAll('[data-prediction-league]').forEach(btn => {
        btn.addEventListener('click', () => {
          const league = String(btn.dataset.predictionLeague || '');
          if (!['cpbl','npb','kbo'].includes(league)) return;
          predictionUiState.league = league;
          predictionGameSlideIndex = 0;
          localStorage.setItem('predictionLeague', league);
          renderPredictionPage();
        });
      });

      els.predictionPageContent.querySelectorAll('[data-prediction-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = String(btn.dataset.predictionMode || '');
          if (!['game','postseason'].includes(mode)) return;
          predictionUiState.mode = mode;
          predictionGameSlideIndex = 0;
          localStorage.setItem('predictionMode', mode);
          renderPredictionPage();
        });
      });

      els.predictionPageContent.querySelectorAll('[data-prediction-refresh]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = predictionKey();
          predictionDataCache.delete(key);
          predictionErrors.delete(key);
          void loadPredictionPageData({ force:false });
        });
      });

      els.predictionPageContent.querySelectorAll('[data-prediction-recalculate]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = predictionKey();
          predictionDataCache.delete(key);
          predictionErrors.delete(key);
          void loadPredictionPageData({ force:true });
        });
      });

      els.predictionPageContent.querySelectorAll('[data-prediction-point-index]').forEach(node => {
        const openDetail = () => {
          const chart = node.closest('[data-prediction-game-index]');
          const detailEl = chart?.querySelector('[data-prediction-point-detail]');
          if (!chart || !detailEl) return;
          const key = predictionKey();
          const data = predictionDataCache.get(key) || null;
          const gameIndex = Number(chart.dataset.predictionGameIndex);
          const pointIndex = Number(node.dataset.predictionPointIndex);
          const game = Array.isArray(data?.games) ? data.games[gameIndex] : null;
          const points = predictionHistoryPoints(game);
          const insight = predictionPointInsight(game, points, pointIndex);
          if (!insight) return;

          detailEl.innerHTML = `
            <div class="prediction-point-detail-head">
              <strong>${escapeHtml(predictionHistoryTriggerLabel(points[pointIndex]))}</strong>
              ${insight.time ? `<span>${escapeHtml(insight.time)}</span>` : ''}
            </div>
            <div class="prediction-point-detail-prob">
              <span>${escapeHtml(String(game?.away || '客隊'))} <b>${Number(insight.awayPct || 0).toFixed(1)}%</b></span>
              <span>${escapeHtml(String(game?.home || '主隊'))} <b>${Number(insight.homePct || 0).toFixed(1)}%</b></span>
            </div>
            <p>${escapeHtml(insight.reason)}</p>
            <p class="prediction-point-detail-delta">${escapeHtml(insight.delta)}</p>
            ${insight.score ? `<p>${escapeHtml(insight.score)}</p>` : ''}
            ${insight.factorDetail ? `<p class="prediction-point-factor">${escapeHtml(insight.factorDetail)}</p>` : ''}
          `;
          detailEl.classList.remove('hidden');
        };
        node.addEventListener('click', openDetail);
        node.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
          }
        });
      });

      const carousel = els.predictionPageContent.querySelector('[data-prediction-carousel]');
      if (carousel) {
        const cards = [...carousel.querySelectorAll('.prediction-game-card')];
        const dots = [...els.predictionPageContent.querySelectorAll('[data-prediction-slide]')];
        const counter = els.predictionPageContent.querySelector('[data-prediction-carousel-counter]');
        let scrollFrame = 0;
        const activeIndex = () => {
          if (!cards.length) return 0;
          let best = 0;
          let distance = Infinity;
          cards.forEach((card, index) => {
            const d = Math.abs(card.getBoundingClientRect().left - carousel.getBoundingClientRect().left);
            if (d < distance) { distance = d; best = index; }
          });
          return best;
        };
        const syncCarousel = () => {
          scrollFrame = 0;
          const index = activeIndex();
          dots.forEach((dot, dotIndex) => {
            dot.classList.toggle('active', dotIndex === index);
            if (dotIndex === index) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
          });
          predictionGameSlideIndex = index;
          if (counter) counter.textContent = `${index + 1} / ${cards.length}`;
        };
        carousel.addEventListener('scroll', () => {
          if (scrollFrame) cancelAnimationFrame(scrollFrame);
          scrollFrame = requestAnimationFrame(syncCarousel);
        }, { passive:true });
        dots.forEach((dot, index) => {
          dot.addEventListener('click', () => {
            const card = cards[index];
            if (!card) return;
            carousel.scrollTo({
              left:Math.max(0, card.offsetLeft - (cards[0]?.offsetLeft || 0)),
              behavior:'smooth'
            });
          });
        });
        const initialIndex = Math.max(0, Math.min(cards.length - 1, Number(predictionGameSlideIndex) || 0));
        if (cards[initialIndex]) {
          carousel.scrollTo({
            left:Math.max(0, cards[initialIndex].offsetLeft - (cards[0]?.offsetLeft || 0)),
            behavior:'auto'
          });
        }
        syncCarousel();
      }
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
        </div>

        <div class="prediction-mode-controls" aria-label="預測類型">
          ${predictionModeButton('比賽預測','game')}
          ${predictionModeButton('季後賽預測','postseason')}
        </div>

        ${predictionWorkspace(data, loading, error)}
      `;

      bindPredictionEvents();
      void predictionSyncRealtime();
      if (!data && !loading && !error) void loadPredictionPageData();
    }