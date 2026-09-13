(() => {
  const UI_VERSION = document.querySelector('meta[name="app-version"]')?.getAttribute('content') || 'v2.51';
  const DETAIL_URL_RE = /\/(?:league-game-detail|cpbl-game-detail)(?:\?|$)/i;
  let latestDetail = null;
  let enhanceTimer = null;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const request = args[0];
      const url = typeof request === 'string' ? request : String(request?.url || '');
      if (DETAIL_URL_RE.test(url)) {
        response.clone().json().then(data => {
          if (data?.ok && data?.game) {
            latestDetail = data;
            scheduleEnhance();
          }
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  function applyVersionLabel() {
    const badge = document.getElementById('appVersionBadge');
    if (badge && badge.textContent !== UI_VERSION) badge.textContent = UI_VERSION;
    const splash = document.getElementById('appSplashVersion');
    const splashText = `VERSION ${UI_VERSION}`;
    if (splash && splash.textContent !== splashText) splash.textContent = splashText;
    const meta = document.querySelector('meta[name="app-version"]');
    if (meta && meta.getAttribute('content') !== UI_VERSION) meta.setAttribute('content', UI_VERSION);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }

  function normalizeBaseState(value) {
    if (Array.isArray(value)) return { first: !!value[0], second: !!value[1], third: !!value[2] };
    if (value && typeof value === 'object') {
      return {
        first: !!(value.first ?? value[1] ?? value.base1),
        second: !!(value.second ?? value[2] ?? value.base2),
        third: !!(value.third ?? value[3] ?? value.base3)
      };
    }
    const raw = String(value || '');
    return {
      first: /一壘|一塁|1塁|first/i.test(raw),
      second: /二壘|二塁|2塁|second/i.test(raw),
      third: /三壘|三塁|3塁|third/i.test(raw)
    };
  }

  function baseStateLabel(value) {
    const s = normalizeBaseState(value);
    const bases = [];
    if (s.first) bases.push('一壘');
    if (s.second) bases.push('二壘');
    if (s.third) bases.push('三壘');
    return bases.length ? `${bases.join('、')}有人` : '壘上無人';
  }

  function currentBaseState(detail) {
    if (detail?.current?.baseState) return detail.current.baseState;
    if (detail?.current?.bases) return detail.current.bases;
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    return last?.baseState || last?.basesAfter || last?.bases || '';
  }

  function parseOutNumber(value) {
    const m = String(value ?? '').match(/([0-3])/);
    return m ? Number(m[1]) : null;
  }

  function inferredOutsAfterPlay(play) {
    if (!play) return 0;
    const before = parseOutNumber(play.outs);
    if (before === null) return 0;
    const text = `${play.raw || ''} ${play.result || ''}`;
    let added = 0;
    if (/三殺|トリプルプレー/i.test(text)) added = 3;
    else if (/雙殺|併殺|ダブルプレー/i.test(text)) added = 2;
    else if (/三振|ゴロ|滾地|フライ|飛球|ライナー|平飛|犧牲|犠牲|犠打|アウト/i.test(text)) added = 1;
    return Math.min(3, before + added);
  }

  function currentOuts(detail) {
    const direct = parseOutNumber(detail?.current?.outs);
    if (direct !== null) return Math.min(2, direct);
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    if (!last) return 0;
    const m = String(detail?.game?.inningLabel || '').match(/(\d+)局([上下])/);
    if (m) {
      const sameInning = Number(m[1]) === Number(last.inning || 0);
      const sameHalf = (m[2] === '上' && last.half === 'top') || (m[2] === '下' && last.half === 'bottom');
      if (!sameInning || !sameHalf) return 0;
    }
    const after = inferredOutsAfterPlay(last);
    return after >= 3 ? 0 : after;
  }

  function renderDiamond(value) {
    const s = normalizeBaseState(value);
    return `<div class="gdx-diamond" aria-label="目前壘包狀態">
      <span class="gdx-base gdx-base-second ${s.second ? 'is-on' : ''}" title="二壘"></span>
      <span class="gdx-base gdx-base-third ${s.third ? 'is-on' : ''}" title="三壘"></span>
      <span class="gdx-base gdx-base-first ${s.first ? 'is-on' : ''}" title="一壘"></span>
      <span class="gdx-home"></span>
    </div>`;
  }

  function safeCell(value) {
    if (value === null || value === undefined) return '';
    const s = String(value).trim();
    return s === 'null' || s === 'undefined' ? '' : s;
  }

  function numericInningTotal(values) {
    let total = 0;
    let found = false;
    for (const value of Array.isArray(values) ? values : []) {
      const raw = safeCell(value);
      if (!/^-?\d+$/.test(raw)) continue;
      total += Number(raw);
      found = true;
    }
    return found ? total : null;
  }

  function inferredTotals(detail) {
    let awayH = 0, homeH = 0, awayE = 0, homeE = 0;
    for (const play of Array.isArray(detail?.plays) ? detail.plays : []) {
      const text = `${play?.result || ''} ${play?.raw || ''}`;
      const offense = play?.half === 'bottom' ? 'home' : 'away';
      if (/全壘打|三壘安打|二壘安打|(?:^|\s)安打(?:$|\s)/.test(text)) {
        if (offense === 'away') awayH += 1; else homeH += 1;
      }
      if (/失誤上壘|失誤|エラー/.test(text)) {
        if (offense === 'away') homeE += 1; else awayE += 1;
      }
    }
    return { awayH, homeH, awayE, homeE };
  }

  function normalizedBoard(detail) {
    const game = detail?.game || {};
    const source = detail?.scoreboard || {};
    const inferred = inferredTotals(detail);
    const innings = Array.isArray(source.innings) ? source.innings.map(String) : [];
    const away = Array.isArray(source.away) ? source.away : [];
    const home = Array.isArray(source.home) ? source.home : [];
    const fallback = (value, alt) => safeCell(value) === '' ? alt : value;
    const awayInningRuns = numericInningTotal(away);
    const homeInningRuns = numericInningTotal(home);
    const awayRuns = awayInningRuns !== null
      ? awayInningRuns
      : fallback(source?.awayTotals?.R, fallback(game.awayScore, ''));
    const homeRuns = homeInningRuns !== null
      ? homeInningRuns
      : fallback(source?.homeTotals?.R, fallback(game.homeScore, ''));
    return {
      innings,
      away,
      home,
      awayTotals: {
        R: awayRuns,
        H: fallback(source?.awayTotals?.H, inferred.awayH),
        E: fallback(source?.awayTotals?.E, inferred.awayE)
      },
      homeTotals: {
        R: homeRuns,
        H: fallback(source?.homeTotals?.H, inferred.homeH),
        E: fallback(source?.homeTotals?.E, inferred.homeE)
      }
    };
  }

  function patchMainScore(scoreCard, board) {
    const scoreEls = scoreCard?.querySelectorAll('.game-detail-score-row strong');
    if (!scoreEls || scoreEls.length < 2) return;
    const away = safeCell(board?.awayTotals?.R);
    const home = safeCell(board?.homeTotals?.R);
    if (away !== '') scoreEls[0].textContent = away;
    if (home !== '') scoreEls[1].textContent = home;
  }

  function renderScoreboard(detail, board = normalizedBoard(detail)) {
    const game = detail?.game || {};
    const head = board.innings.map(x => `<th>${esc(x)}</th>`).join('');
    const cells = values => board.innings.map((_, i) => `<td>${esc(safeCell(values[i]))}</td>`).join('');
    return `<section class="gdx-scoreboard game-detail-enhanced-marker" aria-label="計分板">
      <div class="gdx-section-head"><strong>計分板</strong></div>
      <div class="gdx-scoreboard-scroll"><table>
        <thead><tr><th class="gdx-team-col">球隊</th>${head}<th>R</th><th>H</th><th>E</th></tr></thead>
        <tbody>
          <tr><th class="gdx-team-col">${esc(game.away || '客隊')}</th>${cells(board.away)}<td class="gdx-total">${esc(safeCell(board.awayTotals.R))}</td><td>${esc(safeCell(board.awayTotals.H))}</td><td>${esc(safeCell(board.awayTotals.E))}</td></tr>
          <tr><th class="gdx-team-col">${esc(game.home || '主隊')}</th>${cells(board.home)}<td class="gdx-total">${esc(safeCell(board.homeTotals.R))}</td><td>${esc(safeCell(board.homeTotals.H))}</td><td>${esc(safeCell(board.homeTotals.E))}</td></tr>
        </tbody>
      </table></div>
    </section>`;
  }

  function renderLiveSituation(detail) {
    const pitcher = String(detail?.current?.pitcher?.fullName || detail?.current?.pitcher?.name || '').trim() || '讀取中';
    const batter = String(detail?.current?.batter?.fullName || detail?.current?.batter?.name || '').trim() || '等待下一位打者';
    return `<section class="gdx-live-situation game-detail-enhanced-marker">
      <div class="gdx-bases-card"><span>目前壘包</span>${renderDiamond(currentBaseState(detail))}<strong class="gdx-outs">${currentOuts(detail)}出局</strong></div>
      <div class="gdx-current-stack">
        <div class="gdx-current-row"><span>目前投手</span><strong>${esc(pitcher)}</strong></div>
        <div class="gdx-current-row"><span>目前打者</span><strong>${esc(batter)}</strong></div>
      </div>
    </section>`;
  }

  function renderPreviousPlay(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const play = plays[plays.length - 1];
    if (!play) return '';
    const inning = Number(play.inning) || 0;
    const half = play.half === 'bottom' ? '下' : play.half === 'top' ? '上' : '';
    const inningLabel = inning ? `${inning}局${half}` : '';
    const batter = String(play.batter || play.hitter || '—').trim() || '—';
    const result = String(play.result || play.raw || '—').trim() || '—';
    const outs = inferredOutsAfterPlay(play);
    const baseValue = play.baseState || play.basesAfter || play.bases || '';
    const meta = [];
    if (outs >= 3) meta.push('3出局', '攻守交換');
    else {
      meta.push(`${Math.max(0, outs)}出局`);
      meta.push(baseStateLabel(baseValue));
    }
    const rbi = Number(play.rbi) || 0;
    if (rbi > 0) meta.push(`${rbi}打點`);
    const pitcher = String(play.pitcher || '').trim();
    if (pitcher) meta.push(`投手 ${pitcher}`);
    const status = String(detail?.status || '').toLowerCase();
    const title = status === 'final' ? '最後一個打席' : '上一個打席';
    return `<section class="gdx-last-play game-detail-enhanced-marker" aria-label="${title}">
      <div class="gdx-last-play-head"><strong>${title}</strong><span>${esc(inningLabel)}</span></div>
      <div class="gdx-last-play-main">
        <strong>${esc(batter)}</strong>
        <span>${esc(result)}</span>
      </div>
      <div class="gdx-last-play-meta">${meta.map(esc).join('<i>｜</i>')}</div>
    </section>`;
  }

  function compactName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function samePlayerName(a, b) {
    const norm = value => compactName(value).replace(/[・·.\s]/g, '').toLowerCase();
    const x = norm(a), y = norm(b);
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
  }

  function currentOffenseSide(detail) {
    const inningLabel = String(detail?.game?.inningLabel || '');
    if (/上/.test(inningLabel)) return 'away';
    if (/下/.test(inningLabel)) return 'home';
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    if (last?.half === 'top') return 'away';
    if (last?.half === 'bottom') return 'home';
    return 'away';
  }

  function lineupEntries(detail, side) {
    const raw = detail?.lineups?.[side];
    const direct = Array.isArray(raw?.batters) ? raw.batters : Array.isArray(raw?.order) ? raw.order : Array.isArray(raw) ? raw : [];
    const normalized = direct.map((entry, index) => ({
      order: Number(entry?.order) || index + 1,
      number: safeCell(entry?.number || entry?.uniformNumber || entry?.jersey || ''),
      name: compactName(entry?.name || entry?.fullName || entry?.playerName || ''),
      position: compactName(entry?.position || entry?.pos || ''),
      avg: safeCell(entry?.avg ?? entry?.average ?? entry?.battingAverage ?? ''),
      hits: safeCell(entry?.hits ?? entry?.h ?? ''),
      homeRuns: safeCell(entry?.homeRuns ?? entry?.hr ?? ''),
      rbi: safeCell(entry?.rbi ?? entry?.rbis ?? '')
    })).filter(entry => entry.name);
    if (normalized.length) return normalized.slice(0, 9);
    const wantedHalf = side === 'away' ? 'top' : 'bottom';
    const seen = [];
    for (const play of Array.isArray(detail?.plays) ? detail.plays : []) {
      if (play?.half !== wantedHalf) continue;
      const name = compactName(play?.batter || play?.hitter || '');
      if (!name || seen.some(entry => samePlayerName(entry.name, name))) continue;
      seen.push({ order: seen.length + 1, number: '', name, position: '', avg: '', hits: '', homeRuns: '', rbi: '' });
      if (seen.length >= 9) break;
    }
    return seen;
  }

  function renderLineupPanel(detail, side) {
    const entries = lineupEntries(detail, side);
    const current = compactName(detail?.current?.batter?.fullName || detail?.current?.batter?.name || '');
    const rows = Array.from({ length: 9 }, (_, i) => entries[i] || { order:i + 1, number:'', name:'', avg:'', hits:'', homeRuns:'', rbi:'' });
    return `<div class="gdx-landscape-lineup">
      <div class="gdx-lineup-head"><span>#</span><span>姓名</span><span>AVG</span><span>H</span><span>HR</span><span>RBI</span></div>
      ${rows.map(entry => {
        const active = entry.name && samePlayerName(entry.name, current);
        return `<div class="gdx-lineup-row ${active ? 'is-current' : ''}">
          <span>${esc(entry.number || '—')}</span>
          <strong title="${esc(entry.name || '')}">${esc(entry.name || '—')}</strong>
          <span>${esc(entry.avg || '—')}</span><span>${esc(entry.hits || '—')}</span><span>${esc(entry.homeRuns || '—')}</span><span>${esc(entry.rbi || '—')}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function currentPitcherInfo(detail, defenseSide) {
    const direct = detail?.lineups?.[defenseSide]?.pitcher || {};
    const current = detail?.current?.pitcher || {};
    const name = compactName(direct.fullName || direct.name || current.fullName || current.name || '');
    const stats = direct.stats || direct || current.stats || current;
    const pitcherPlays = (Array.isArray(detail?.plays) ? detail.plays : []).filter(play => !name || samePlayerName(play?.pitcher, name));
    const text = play => `${play?.result || ''} ${play?.raw || ''}`;
    return {
      name: name || '投手資料讀取中',
      pitches: safeCell(stats.pitches ?? stats.pitchCount ?? stats.pitchingCount ?? ''), ip: safeCell(stats.ip ?? stats.innings ?? stats.inningsPitched ?? ''),
      hits: safeCell(stats.hits ?? stats.h ?? '') || String(pitcherPlays.filter(p => /全壘打|三壘安打|二壘安打|(?:^|\s)安打(?:$|\s)/.test(text(p))).length || ''),
      homeRuns: safeCell(stats.homeRuns ?? stats.hr ?? '') || String(pitcherPlays.filter(p => /全壘打/.test(text(p))).length || ''),
      walks: safeCell(stats.walks ?? stats.bb ?? stats.fourDead ?? '') || String(pitcherPlays.filter(p => /四壞|觸身/.test(text(p))).length || ''),
      strikeouts: safeCell(stats.so ?? stats.strikeouts ?? '') || String(pitcherPlays.filter(p => /三振/.test(text(p))).length || ''), era: safeCell(stats.era ?? '')
    };
  }

  function renderPitcherPanel(detail, side) {
    const p = currentPitcherInfo(detail, side);
    const items = [['P',p.pitches],['IP',p.ip],['H',p.hits],['HR',p.homeRuns],['BB',p.walks],['SO',p.strikeouts],['ERA',p.era]];
    return `<div class="gdx-landscape-pitcher"><div class="gdx-pitcher-kicker">CURRENT PITCHER</div><strong class="gdx-pitcher-name">${esc(p.name)}</strong><div class="gdx-pitcher-grid">${items.map(([label,value]) => `<div><span>${label}</span><b>${esc(value || '—')}</b></div>`).join('')}</div></div>`;
  }

  function renderLandscapeSide(detail, side, offenseSide) {
    const game = detail?.game || {};
    const team = side === 'away' ? game.away || '客隊' : game.home || '主隊';
    const offense = side === offenseSide;
    return `<section class="gdx-landscape-side gdx-side-${side}"><div class="gdx-landscape-team-head"><span>${side === 'away' ? 'AWAY' : 'HOME'}</span><strong>${esc(team)}</strong><em>${offense ? 'ATTACK' : 'DEFENSE'}</em></div>${offense ? renderLineupPanel(detail, side) : renderPitcherPanel(detail, side)}</section>`;
  }

  function positionKey(value) {
    const p = compactName(value).toUpperCase();
    if (/^(P|投|投手|PITCHER)$/.test(p)) return 'p'; if (/^(C|捕|捕手|CATCHER)$/.test(p)) return 'c';
    if (/^(1B|一|一壘|一塁|FIRST)$/.test(p)) return '1b'; if (/^(2B|二|二壘|二塁|SECOND)$/.test(p)) return '2b';
    if (/^(3B|三|三壘|三塁|THIRD)$/.test(p)) return '3b'; if (/^(SS|遊|游|遊撃|游擊|SHORT)$/.test(p)) return 'ss';
    if (/^(LF|左|左翼|LEFT)$/.test(p)) return 'lf'; if (/^(CF|中|中堅|CENTER)$/.test(p)) return 'cf'; if (/^(RF|右|右翼|RIGHT)$/.test(p)) return 'rf'; return '';
  }

  function defenseMap(detail, side) {
    const map = {}, raw = detail?.lineups?.[side];
    const fielders = Array.isArray(raw?.fielders) ? raw.fielders : lineupEntries(detail, side);
    for (const entry of fielders) { const key = positionKey(entry?.position || entry?.pos || ''); const name = compactName(entry?.name || entry?.fullName || ''); if (key && name) map[key] = name; }
    const pitcher = compactName(raw?.pitcher?.fullName || raw?.pitcher?.name || detail?.current?.pitcher?.fullName || detail?.current?.pitcher?.name || ''); if (pitcher) map.p = pitcher;
    return map;
  }

  function renderDefenseField(detail, side) {
    const field = defenseMap(detail, side), spots = ['lf','cf','rf','ss','2b','3b','1b','p','c'];
    return `<div class="gdx-field-card"><div class="gdx-mini-title">守備</div><div class="gdx-field-shape" aria-label="守備佈陣">${spots.map(pos => `<div class="gdx-fielder gdx-pos-${pos}"><span>${esc(field[pos] || '—')}</span></div>`).join('')}</div></div>`;
  }

  function currentRunnerNames(detail) {
    const raw = detail?.current?.runners || detail?.runners || {}, take = (...values) => compactName(values.find(v => compactName(v)) || '');
    return { first:take(raw.first,raw.firstBase,raw[1],raw.base1), second:take(raw.second,raw.secondBase,raw[2],raw.base2), third:take(raw.third,raw.thirdBase,raw[3],raw.base3) };
  }

  function renderRunnerDiamond(detail) {
    const state = normalizeBaseState(currentBaseState(detail)), names = currentRunnerNames(detail), label = (on,name) => on ? esc(name || '有人') : '';
    return `<div class="gdx-runner-card"><div class="gdx-mini-title">壘上</div><div class="gdx-runner-diamond" aria-label="壘上狀態"><div class="gdx-runner-base gdx-runner-second ${state.second?'is-on':''}"></div><div class="gdx-runner-base gdx-runner-third ${state.third?'is-on':''}"></div><div class="gdx-runner-base gdx-runner-first ${state.first?'is-on':''}"></div><span class="gdx-runner-name gdx-runner-name-second">${label(state.second,names.second)}</span><span class="gdx-runner-name gdx-runner-name-third">${label(state.third,names.third)}</span><span class="gdx-runner-name gdx-runner-name-first">${label(state.first,names.first)}</span><div class="gdx-runner-home"></div></div><div class="gdx-runner-outs">${currentOuts(detail)}出局</div></div>`;
  }

  function renderLandscapeScoreboard(detail, board) {
    const game = detail?.game || {}, innings = board.innings.length ? board.innings : Array.from({length:9},(_,i)=>String(i+1));
    const cells = (values,totals) => `${innings.map((_,i)=>`<td>${esc(safeCell(values?.[i]))}</td>`).join('')}<td class="is-total">${esc(safeCell(totals.R))}</td><td>${esc(safeCell(totals.H))}</td><td>${esc(safeCell(totals.E))}</td>`;
    return `<div class="gdx-landscape-score"><div class="gdx-landscape-scoreline"><div><span>${esc(game.away||'客隊')}</span><strong>${esc(safeCell(board.awayTotals.R)||'0')}</strong></div><div class="gdx-landscape-inning">${esc(game.inningLabel || (detail?.status==='final'?'比賽結束':''))}</div><div><strong>${esc(safeCell(board.homeTotals.R)||'0')}</strong><span>${esc(game.home||'主隊')}</span></div></div><div class="gdx-landscape-scoretable-wrap"><table class="gdx-landscape-scoretable"><thead><tr><th></th>${innings.map(x=>`<th>${esc(x)}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr></thead><tbody><tr><th>${esc(game.away||'客')}</th>${cells(board.away,board.awayTotals)}</tr><tr><th>${esc(game.home||'主')}</th>${cells(board.home,board.homeTotals)}</tr></tbody></table></div></div>`;
  }

  function renderLandscapeBoard(detail, board) {
    const offense = currentOffenseSide(detail), defense = offense === 'away' ? 'home' : 'away';
    return `<section class="gdx-landscape-board game-detail-enhanced-marker" aria-label="橫向大螢幕模式">${renderLandscapeSide(detail,'away',offense)}<div class="gdx-landscape-center">${renderLandscapeScoreboard(detail,board)}<div class="gdx-landscape-lower">${renderDefenseField(detail,defense)}${renderRunnerDiamond(detail)}</div></div>${renderLandscapeSide(detail,'home',offense)}</section>`;
  }

  function detailStamp(detail) {
    const game = detail?.game || {};
    const last = Array.isArray(detail?.plays) && detail.plays.length ? detail.plays[detail.plays.length - 1] : null;
    const board = detail?.scoreboard || {};
    return [
      detail?.league, detail?.date, detail?.status, game.id, game.awayScore, game.homeScore,
      detail?.updatedAt, detail?.current?.outs, detail?.current?.pitcher?.name, detail?.current?.batter?.name,
      JSON.stringify(board?.away || []), JSON.stringify(board?.home || []),
      board?.awayTotals?.R, board?.awayTotals?.H, board?.awayTotals?.E,
      board?.homeTotals?.R, board?.homeTotals?.H, board?.homeTotals?.E,
      JSON.stringify(detail?.lineups || {}), JSON.stringify(detail?.current?.runners || {}),
      last?.inning, last?.half, last?.batter, last?.pitcher, last?.result, last?.bases, last?.basesAfter, last?.rbi
    ].map(v => String(v ?? '')).join('|');
  }

  function sameGame(body, detail) {
    const scoreCard = body.querySelector('.game-detail-score-card');
    if (!scoreCard) return false;
    const text = scoreCard.textContent || '';
    const away = String(detail?.game?.away || '').trim();
    const home = String(detail?.game?.home || '').trim();
    return (!away || text.includes(away)) && (!home || text.includes(home));
  }

  function enhanceGameDetail() {
    applyVersionLabel();
    const detail = latestDetail;
    if (!detail?.game) return;
    const overlay = document.getElementById('homeGameDetailOverlay');
    const body = overlay?.querySelector('#homeGameDetailBody');
    if (!overlay || overlay.classList.contains('hidden') || !body || !sameGame(body, detail)) return;
    const scoreCard = body.querySelector('.game-detail-score-card');
    if (!scoreCard) return;
    const board = normalizedBoard(detail);
    patchMainScore(scoreCard, board);

    const stamp = detailStamp(detail);
    if (body.dataset.gdxStamp === stamp && body.querySelector('.game-detail-enhanced-marker')) return;
    body.dataset.gdxStamp = stamp;
    body.querySelectorAll('.game-detail-enhanced-marker').forEach(el => el.remove());
    body.querySelector('.game-detail-current-grid')?.remove();

    const portraitContent = body.querySelector('.game-detail-content');
    if (portraitContent) portraitContent.insertAdjacentHTML('beforebegin', renderLandscapeBoard(detail, board));

    const status = String(detail.status || '').toLowerCase();
    let anchor = scoreCard;
    if (status === 'live') {
      scoreCard.insertAdjacentHTML('afterend', renderLiveSituation(detail));
      anchor = scoreCard.nextElementSibling || scoreCard;
    }
    anchor.insertAdjacentHTML('afterend', renderScoreboard(detail, board));

    const playSection = body.querySelector('.game-detail-play-section');
    const previousPlayHtml = renderPreviousPlay(detail);
    if (playSection && previousPlayHtml) {
      playSection.insertAdjacentHTML('beforebegin', previousPlayHtml);
    }
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceGameDetail, 40);
  }

  new MutationObserver(() => scheduleEnhance()).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-home-game], .home-daily-game, .home-game-row')) setTimeout(scheduleEnhance, 200);
  }, true);

  applyVersionLabel();
  scheduleEnhance();
})();
