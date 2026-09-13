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

  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeCell = v => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    return s === 'null' || s === 'undefined' ? '' : s;
  };
  const compactName = v => String(v || '').trim().replace(/\s+/g, ' ');
  const normName = v => compactName(v).replace(/[・·.\s]/g, '').toLowerCase();
  const samePlayerName = (a,b) => {
    const x = normName(a), y = normName(b);
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
  };

  function applyVersionLabel() {
    const badge = document.getElementById('appVersionBadge');
    if (badge && badge.textContent !== UI_VERSION) badge.textContent = UI_VERSION;
    const splash = document.getElementById('appSplashVersion');
    const text = `VERSION ${UI_VERSION}`;
    if (splash && splash.textContent !== text) splash.textContent = text;
  }

  function normalizeBaseState(value) {
    if (Array.isArray(value)) return { first: !!value[0], second: !!value[1], third: !!value[2] };
    if (value && typeof value === 'object') return {
      first: !!(value.first ?? value[1] ?? value.base1),
      second: !!(value.second ?? value[2] ?? value.base2),
      third: !!(value.third ?? value[3] ?? value.base3)
    };
    const raw = String(value || '');
    return {
      first: /一壘|一塁|1塁|first/i.test(raw),
      second: /二壘|二塁|2塁|second/i.test(raw),
      third: /三壘|三塁|3塁|third/i.test(raw)
    };
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
    const after = inferredOutsAfterPlay(last);
    return after >= 3 ? 0 : after;
  }

  function inferredTotals(detail) {
    let awayH = 0, homeH = 0, awayE = 0, homeE = 0;
    for (const play of Array.isArray(detail?.plays) ? detail.plays : []) {
      const text = `${play?.result || ''} ${play?.raw || ''}`;
      const offense = play?.half === 'bottom' ? 'home' : 'away';
      if (/全壘打|三壘安打|二壘安打|(?:^|\s)安打(?:$|\s)/.test(text)) offense === 'away' ? awayH++ : homeH++;
      if (/失誤上壘|失誤|エラー/.test(text)) offense === 'away' ? homeE++ : awayE++;
    }
    return { awayH, homeH, awayE, homeE };
  }

  function normalizedBoard(detail) {
    const game = detail?.game || {}, source = detail?.scoreboard || {}, inferred = inferredTotals(detail);
    const innings = Array.isArray(source.innings) ? source.innings.map(String) : [];
    const away = Array.isArray(source.away) ? source.away : [], home = Array.isArray(source.home) ? source.home : [];
    const sum = values => {
      let total = 0, found = false;
      for (const v of values) if (/^-?\d+$/.test(safeCell(v))) { total += Number(v); found = true; }
      return found ? total : null;
    };
    const fallback = (v, alt) => safeCell(v) === '' ? alt : v;
    const ar = sum(away), hr = sum(home);
    return {
      innings, away, home,
      awayTotals:{R:ar ?? fallback(source?.awayTotals?.R, game.awayScore ?? ''),H:fallback(source?.awayTotals?.H,inferred.awayH),E:fallback(source?.awayTotals?.E,inferred.awayE)},
      homeTotals:{R:hr ?? fallback(source?.homeTotals?.R, game.homeScore ?? ''),H:fallback(source?.homeTotals?.H,inferred.homeH),E:fallback(source?.homeTotals?.E,inferred.homeE)}
    };
  }

  function currentOffenseSide(detail) {
    const label = String(detail?.game?.inningLabel || '');
    if (/上/.test(label)) return 'away';
    if (/下/.test(label)) return 'home';
    const last = Array.isArray(detail?.plays) ? detail.plays.at(-1) : null;
    return last?.half === 'bottom' ? 'home' : 'away';
  }

  function rawRoster(detail, side) {
    const raw = detail?.lineups?.[side];
    const list = Array.isArray(raw?.batters) ? raw.batters : Array.isArray(raw?.order) ? raw.order : Array.isArray(raw) ? raw : [];
    return list.map((entry,index)=>({
      order:Number(entry?.order)||index+1,
      number:safeCell(entry?.number||entry?.uniformNumber||entry?.jersey||''),
      name:compactName(entry?.name||entry?.fullName||entry?.playerName||''),
      position:compactName(entry?.position||entry?.pos||''),
      acnt:safeCell(entry?.acnt||entry?.playerId||entry?.id||''),
      avg:safeCell(entry?.avg??entry?.average??entry?.battingAverage??''),
      hits:Number(entry?.hits??entry?.h??0)||0,
      homeRuns:Number(entry?.homeRuns??entry?.hr??0)||0,
      rbi:Number(entry?.rbi??entry?.rbis??0)||0
    })).filter(x=>x.name);
  }

  function lineupOrderFromGame(detail, side) {
    const wantedHalf = side === 'away' ? 'top' : 'bottom';
    const seen = [];
    for (const play of Array.isArray(detail?.plays) ? detail.plays : []) {
      if (play?.half !== wantedHalf) continue;
      const name = compactName(play?.batter || play?.hitter || '');
      if (!name || seen.some(x=>samePlayerName(x,name))) continue;
      seen.push(name);
      if (seen.length >= 9) break;
    }
    return seen;
  }

  function classifyBatting(play) {
    const text = `${play?.result||''} ${play?.raw||''}`.trim();
    const hit = /全壘打|三壘安打|二壘安打|(?:^|\s)安打(?:$|\s)/.test(text);
    const hr = /全壘打/.test(text);
    const walk = /四壞|故意四壞|觸身/.test(text);
    const sacrifice = /犧牲短打|犧短|犧牲飛球|犧飛|犠牲|犠打/.test(text);
    const interference = /妨礙打擊|catcher interference/i.test(text);
    const ab = !(walk || sacrifice || interference);
    return {hit,hr,ab,rbi:Number(play?.rbi)||0};
  }

  function gameBattingTotals(detail, side) {
    const wantedHalf = side === 'away' ? 'top' : 'bottom', map = new Map();
    for (const play of Array.isArray(detail?.plays) ? detail.plays : []) {
      if (play?.half !== wantedHalf) continue;
      const name = compactName(play?.batter || play?.hitter || '');
      if (!name) continue;
      let row = [...map.entries()].find(([k])=>samePlayerName(k,name))?.[1];
      if (!row) { row={ab:0,h:0,hr:0,rbi:0}; map.set(name,row); }
      const c = classifyBatting(play);
      if (c.ab) row.ab++;
      if (c.hit) row.h++;
      if (c.hr) row.hr++;
      row.rbi += c.rbi;
    }
    return map;
  }

  function lineupEntries(detail, side) {
    const roster = rawRoster(detail,side);
    const order = lineupOrderFromGame(detail,side);
    const status = String(detail?.status||'').toLowerCase();
    const totals = gameBattingTotals(detail,side);
    let arranged = order.map((name,i)=>{
      const r = roster.find(x=>samePlayerName(x.name,name)) || {name,order:i+1,number:'',position:'',avg:'',hits:0,homeRuns:0,rbi:0};
      return {...r,order:i+1};
    });
    for (const r of roster) if (!arranged.some(x=>samePlayerName(x.name,r.name)) && arranged.length<9) arranged.push({...r,order:arranged.length+1});
    if (!arranged.length) arranged = roster.slice(0,9);
    return arranged.slice(0,9).map(entry=>{
      if (status === 'final') return entry;
      const game = [...totals.entries()].find(([k])=>samePlayerName(k,entry.name))?.[1] || {ab:0,h:0,hr:0,rbi:0};
      const officialGameH = game.h;
      const officialSeasonH = Number(entry.hits)||0;
      const seasonHBefore = Math.max(0, officialSeasonH - officialGameH);
      const shownH = seasonHBefore + game.h;
      let avg = entry.avg;
      if (avg && /^\.\d{3}$/.test(avg) && officialSeasonH >= 0 && game.ab > 0) {
        const finalAvg = Number(`0${avg}`);
        const approxFinalAB = finalAvg > 0 ? Math.round(officialSeasonH / finalAvg) : 0;
        const preAB = Math.max(0, approxFinalAB - game.ab);
        avg = preAB + game.ab > 0 ? ((seasonHBefore + game.h)/(preAB + game.ab)).toFixed(3).replace(/^0/,'') : '.000';
      }
      return {...entry,avg,hits:shownH,homeRuns:Math.max(0,(Number(entry.homeRuns)||0)-game.hr)+game.hr,rbi:Math.max(0,(Number(entry.rbi)||0)-game.rbi)+game.rbi};
    });
  }

  function positionKey(value) {
    const p = compactName(value).toUpperCase();
    if (/^(P|投|投手|PITCHER)$/.test(p)) return 'p';
    if (/^(C|捕|捕手|CATCHER)$/.test(p)) return 'c';
    if (/^(1B|一|一壘|一塁|FIRST)$/.test(p)) return '1b';
    if (/^(2B|二|二壘|二塁|SECOND)$/.test(p)) return '2b';
    if (/^(3B|三|三壘|三塁|THIRD)$/.test(p)) return '3b';
    if (/^(SS|遊|游|遊撃|游擊|SHORT)$/.test(p)) return 'ss';
    if (/^(LF|左|左翼|LEFT)$/.test(p)) return 'lf';
    if (/^(CF|中|中堅|CENTER)$/.test(p)) return 'cf';
    if (/^(RF|右|右翼|RIGHT)$/.test(p)) return 'rf';
    return '';
  }

  function defenseMap(detail, side) {
    const raw = detail?.lineups?.[side] || {}, map = {};
    const fielders = Array.isArray(raw.fielders) ? raw.fielders : rawRoster(detail,side);
    for (const entry of fielders) {
      const key = positionKey(entry?.position || entry?.pos || ''), name = compactName(entry?.name || entry?.fullName || '');
      if (key && name) map[key] = name;
    }
    const pitcher = compactName(raw?.pitcher?.fullName || raw?.pitcher?.name || detail?.current?.pitcher?.fullName || detail?.current?.pitcher?.name || '');
    if (pitcher) map.p = pitcher;
    return map;
  }

  function directRunnerNames(detail) {
    const raw = detail?.current?.runners || detail?.runners || {};
    const take=(...values)=>compactName(values.find(v=>compactName(v))||'');
    return {first:take(raw.first,raw.firstBase,raw[1],raw.base1),second:take(raw.second,raw.secondBase,raw[2],raw.base2),third:take(raw.third,raw.thirdBase,raw[3],raw.base3)};
  }

  function inferRunnerNames(detail) {
    const offense = currentOffenseSide(detail), wantedHalf = offense === 'away' ? 'top' : 'bottom';
    const gameInning = Number(String(detail?.game?.inningLabel||'').match(/(\d+)/)?.[1]||0);
    const plays = (Array.isArray(detail?.plays)?detail.plays:[]).filter(p=>p?.half===wantedHalf && (!gameInning || Number(p?.inning)===gameInning));
    let runners = {first:'',second:'',third:''};
    for (const play of plays) {
      const before = normalizeBaseState(play?.baseStateBefore || play?.basesBefore || '');
      const after = normalizeBaseState(play?.baseState || play?.basesAfter || play?.bases || '');
      if (!before.first) runners.first=''; if (!before.second) runners.second=''; if (!before.third) runners.third='';
      const batter = compactName(play?.batter||play?.hitter||'');
      const result = `${play?.result||''} ${play?.raw||''}`;
      const old = {...runners};
      runners = {first:'',second:'',third:''};
      if (/全壘打/.test(result)) continue;
      if (after.third) runners.third = /三壘安打/.test(result) ? batter : (old.second || old.first || old.third);
      if (after.second) runners.second = /二壘安打/.test(result) ? batter : (old.first || old.second);
      if (after.first) runners.first = /安打|四壞|觸身|失誤上壘|野手選擇/.test(result) ? batter : old.first;
    }
    return runners;
  }

  function currentRunnerNames(detail) {
    const direct = directRunnerNames(detail), inferred = inferRunnerNames(detail);
    return {first:direct.first||inferred.first,second:direct.second||inferred.second,third:direct.third||inferred.third};
  }

  function detailStamp(detail) {
    const game=detail?.game||{}, last=Array.isArray(detail?.plays)&&detail.plays.length?detail.plays.at(-1):null;
    return [detail?.league,detail?.date,detail?.status,game.id,game.awayScore,game.homeScore,detail?.updatedAt,detail?.current?.outs,
      detail?.current?.pitcher?.name,detail?.current?.batter?.name,JSON.stringify(detail?.scoreboard||{}),JSON.stringify(detail?.lineups||{}),
      JSON.stringify(detail?.current?.runners||{}),last?.inning,last?.half,last?.batter,last?.pitcher,last?.result,last?.bases,last?.rbi].map(v=>String(v??'')).join('|');
  }

  function renderDiamond(value, cls='gdx-diamond') {
    const s=normalizeBaseState(value);
    return `<div class="${cls}" aria-label="目前壘包狀態"><span class="gdx-base gdx-base-second ${s.second?'is-on':''}" title="二壘"></span><span class="gdx-base gdx-base-third ${s.third?'is-on':''}" title="三壘"></span><span class="gdx-base gdx-base-first ${s.first?'is-on':''}" title="一壘"></span><span class="gdx-home"></span></div>`;
  }

  function renderLiveSituation(detail) {
    const pitcher=compactName(detail?.current?.pitcher?.fullName||detail?.current?.pitcher?.name)||'讀取中';
    const batter=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name)||'等待下一位打者';
    return `<section class="gdx-live-situation game-detail-enhanced-marker" data-gdx="live"><div class="gdx-bases-card"><span>目前壘包</span>${renderDiamond(currentBaseState(detail))}<strong class="gdx-outs">${currentOuts(detail)}出局</strong></div><div class="gdx-current-stack"><div class="gdx-current-row"><span>目前投手</span><strong data-gdx-current-pitcher>${esc(pitcher)}</strong></div><div class="gdx-current-row"><span>目前打者</span><strong data-gdx-current-batter>${esc(batter)}</strong></div></div></section>`;
  }

  function renderScoreboard(detail,board) {
    const game=detail?.game||{}, head=board.innings.map(x=>`<th>${esc(x)}</th>`).join('');
    const cells=values=>board.innings.map((_,i)=>`<td>${esc(safeCell(values[i]))}</td>`).join('');
    return `<section class="gdx-scoreboard game-detail-enhanced-marker" data-gdx="scoreboard"><div class="gdx-section-head"><strong>計分板</strong></div><div class="gdx-scoreboard-scroll"><table><thead><tr><th class="gdx-team-col">球隊</th>${head}<th>R</th><th>H</th><th>E</th></tr></thead><tbody><tr><th class="gdx-team-col">${esc(game.away||'客隊')}</th>${cells(board.away)}<td class="gdx-total">${esc(board.awayTotals.R)}</td><td>${esc(board.awayTotals.H)}</td><td>${esc(board.awayTotals.E)}</td></tr><tr><th class="gdx-team-col">${esc(game.home||'主隊')}</th>${cells(board.home)}<td class="gdx-total">${esc(board.homeTotals.R)}</td><td>${esc(board.homeTotals.H)}</td><td>${esc(board.homeTotals.E)}</td></tr></tbody></table></div></section>`;
  }

  function renderLineupPanel(detail,side) {
    const entries=lineupEntries(detail,side), current=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name||'');
    const rows=Array.from({length:9},(_,i)=>entries[i]||{number:'',name:'',avg:'',hits:'',homeRuns:'',rbi:''});
    return `<div class="gdx-landscape-lineup">${`<div class="gdx-lineup-head"><span>#</span><span>姓名</span><span>AVG</span><span>H</span><span>HR</span><span>RBI</span></div>`}${rows.map(e=>`<div class="gdx-lineup-row ${e.name&&samePlayerName(e.name,current)?'is-current':''}"><span>${esc(e.number||'—')}</span><strong>${esc(e.name||'—')}</strong><span>${esc(e.avg||'—')}</span><span>${esc(e.hits??'—')}</span><span>${esc(e.homeRuns??'—')}</span><span>${esc(e.rbi??'—')}</span></div>`).join('')}</div>`;
  }

  function currentPitcherInfo(detail,side) {
    const direct=detail?.lineups?.[side]?.pitcher||{}, current=detail?.current?.pitcher||{}, name=compactName(direct.fullName||direct.name||current.fullName||current.name||'');
    const stats=direct.stats||direct||current.stats||current;
    return {name:name||'投手資料讀取中',pitches:safeCell(stats.pitches??stats.pitchCount??''),ip:safeCell(stats.ip??stats.innings??''),hits:safeCell(stats.hits??stats.h??''),homeRuns:safeCell(stats.homeRuns??stats.hr??''),walks:safeCell(stats.walks??stats.bb??''),strikeouts:safeCell(stats.so??stats.strikeouts??''),era:safeCell(stats.era??'')};
  }

  function renderPitcherPanel(detail,side) {
    const p=currentPitcherInfo(detail,side), items=[['P',p.pitches],['IP',p.ip],['H',p.hits],['HR',p.homeRuns],['BB',p.walks],['SO',p.strikeouts],['ERA',p.era]];
    return `<div class="gdx-landscape-pitcher"><div class="gdx-pitcher-kicker">CURRENT PITCHER</div><strong class="gdx-pitcher-name">${esc(p.name)}</strong><div class="gdx-pitcher-grid">${items.map(([l,v])=>`<div><span>${l}</span><b>${esc(v||'—')}</b></div>`).join('')}</div></div>`;
  }

  function renderDefenseField(detail,side) {
    const field=defenseMap(detail,side), spots=['lf','cf','rf','ss','2b','3b','1b','p','c'];
    return `<div class="gdx-field-card"><div class="gdx-mini-title">守備</div><div class="gdx-field-shape">${spots.map(pos=>`<div class="gdx-fielder gdx-pos-${pos}"><span>${esc(field[pos]||'—')}</span></div>`).join('')}</div></div>`;
  }

  function renderRunnerDiamond(detail) {
    const state=normalizeBaseState(currentBaseState(detail)), names=currentRunnerNames(detail), label=(on,name)=>on?esc(name||'有人'):'';
    return `<div class="gdx-runner-card"><div class="gdx-mini-title">壘上</div><div class="gdx-runner-diamond"><div class="gdx-runner-base gdx-runner-second ${state.second?'is-on':''}"></div><div class="gdx-runner-base gdx-runner-third ${state.third?'is-on':''}"></div><div class="gdx-runner-base gdx-runner-first ${state.first?'is-on':''}"></div><span class="gdx-runner-name gdx-runner-name-second">${label(state.second,names.second)}</span><span class="gdx-runner-name gdx-runner-name-third">${label(state.third,names.third)}</span><span class="gdx-runner-name gdx-runner-name-first">${label(state.first,names.first)}</span><div class="gdx-runner-home"></div></div><div class="gdx-runner-outs">${currentOuts(detail)}出局</div></div>`;
  }

  function renderLandscapeScoreboard(detail,board) {
    const game=detail?.game||{}, innings=board.innings.length?board.innings:Array.from({length:9},(_,i)=>String(i+1));
    const cells=(values,totals)=>`${innings.map((_,i)=>`<td>${esc(safeCell(values?.[i]))}</td>`).join('')}<td class="is-total">${esc(safeCell(totals.R))}</td><td>${esc(safeCell(totals.H))}</td><td>${esc(safeCell(totals.E))}</td>`;
    return `<div class="gdx-landscape-score"><div class="gdx-landscape-scoreline"><div><span>${esc(game.away||'客隊')}</span><strong>${esc(safeCell(board.awayTotals.R)||'0')}</strong></div><div class="gdx-landscape-inning">${esc(game.inningLabel||(detail?.status==='final'?'比賽結束':''))}</div><div><strong>${esc(safeCell(board.homeTotals.R)||'0')}</strong><span>${esc(game.home||'主隊')}</span></div></div><div class="gdx-landscape-scoretable-wrap"><table class="gdx-landscape-scoretable"><thead><tr><th></th>${innings.map(x=>`<th>${esc(x)}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr></thead><tbody><tr><th>${esc(game.away||'客')}</th>${cells(board.away,board.awayTotals)}</tr><tr><th>${esc(game.home||'主')}</th>${cells(board.home,board.homeTotals)}</tr></tbody></table></div></div>`;
  }

  function renderLandscapeBoard(detail,board) {
    const offense=currentOffenseSide(detail), defense=offense==='away'?'home':'away', game=detail?.game||{};
    const side=(which)=>{
      const team=which==='away'?game.away||'客隊':game.home||'主隊', isOff=which===offense;
      return `<section class="gdx-landscape-side gdx-side-${which}"><div class="gdx-landscape-team-head"><span>${which==='away'?'AWAY':'HOME'}</span><strong>${esc(team)}</strong><em>${isOff?'ATTACK':'DEFENSE'}</em></div>${isOff?renderLineupPanel(detail,which):renderPitcherPanel(detail,which)}</section>`;
    };
    return `<section class="gdx-landscape-board game-detail-enhanced-marker" data-gdx="landscape">${side('away')}<div class="gdx-landscape-center">${renderLandscapeScoreboard(detail,board)}<div class="gdx-landscape-lower">${renderDefenseField(detail,defense)}${renderRunnerDiamond(detail)}</div></div>${side('home')}</section>`;
  }

  function renderPreviousPlay(detail) {
    const play=Array.isArray(detail?.plays)?detail.plays.at(-1):null;
    if (!play) return '';
    const inning=Number(play.inning)||0, half=play.half==='bottom'?'下':play.half==='top'?'上':'';
    const outs=inferredOutsAfterPlay(play), meta=[outs>=3?'3出局':`${Math.max(0,outs)}出局`];
    if (Number(play.rbi)||0) meta.push(`${Number(play.rbi)}打點`);
    const title=String(detail?.status||'').toLowerCase()==='final'?'最後一個打席':'上一個打席';
    return `<section class="gdx-last-play game-detail-enhanced-marker" data-gdx="last-play"><div class="gdx-last-play-head"><strong>${title}</strong><span>${inning?`${inning}局${half}`:''}</span></div><div class="gdx-last-play-main"><strong>${esc(play.batter||play.hitter||'—')}</strong><span>${esc(play.result||play.raw||'—')}</span></div><div class="gdx-last-play-meta">${meta.map(esc).join('<i>｜</i>')}</div></section>`;
  }

  function patchMainScore(scoreCard,board) {
    const els=scoreCard?.querySelectorAll('.game-detail-score-row strong');
    if (!els||els.length<2) return;
    els[0].textContent=safeCell(board?.awayTotals?.R);
    els[1].textContent=safeCell(board?.homeTotals?.R);
  }

  function patchLiveSection(root,detail) {
    const s=normalizeBaseState(currentBaseState(detail));
    root.querySelector('.gdx-base-first')?.classList.toggle('is-on',s.first);
    root.querySelector('.gdx-base-second')?.classList.toggle('is-on',s.second);
    root.querySelector('.gdx-base-third')?.classList.toggle('is-on',s.third);
    const outs=root.querySelector('.gdx-outs'); if (outs) outs.textContent=`${currentOuts(detail)}出局`;
    const p=root.querySelector('[data-gdx-current-pitcher]'); if (p) p.textContent=compactName(detail?.current?.pitcher?.fullName||detail?.current?.pitcher?.name)||'讀取中';
    const b=root.querySelector('[data-gdx-current-batter]'); if (b) b.textContent=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name)||'等待下一位打者';
  }

  function morphNode(target, source) {
    if (!target || !source) return;
    if (target.nodeType !== source.nodeType || target.nodeName !== source.nodeName) {
      target.replaceWith(source.cloneNode(true));
      return;
    }
    if (target.nodeType === Node.TEXT_NODE) {
      if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
      return;
    }
    const targetEl = target, sourceEl = source;
    for (const attr of [...targetEl.attributes]) {
      if (!sourceEl.hasAttribute(attr.name)) targetEl.removeAttribute(attr.name);
    }
    for (const attr of [...sourceEl.attributes]) {
      if (targetEl.getAttribute(attr.name) !== attr.value) targetEl.setAttribute(attr.name, attr.value);
    }
    const tChildren = [...targetEl.childNodes], sChildren = [...sourceEl.childNodes];
    const common = Math.min(tChildren.length, sChildren.length);
    for (let i=0;i<common;i++) morphNode(tChildren[i], sChildren[i]);
    for (let i=tChildren.length-1;i>=sChildren.length;i--) tChildren[i].remove();
    for (let i=common;i<sChildren.length;i++) targetEl.appendChild(sChildren[i].cloneNode(true));
  }

  function patchOrReplace(body, selector, html, detail) {
    const old=body.querySelector(selector);
    if (!old) return null;
    const temp=document.createElement('template'); temp.innerHTML=html.trim(); const fresh=temp.content.firstElementChild;
    if (!fresh) return old;
    if (selector.includes('live')) { patchLiveSection(old,detail); return old; }
    morphNode(old, fresh);
    return old;
  }

  function sameGame(body,detail) {
    const score=body.querySelector('.game-detail-score-card'); if (!score) return false;
    const text=score.textContent||'', away=String(detail?.game?.away||'').trim(), home=String(detail?.game?.home||'').trim();
    return (!away||text.includes(away))&&(!home||text.includes(home));
  }

  function enhanceGameDetail() {
    applyVersionLabel();
    const detail=latestDetail; if (!detail?.game) return;
    const overlay=document.getElementById('homeGameDetailOverlay'), body=overlay?.querySelector('#homeGameDetailBody');
    if (!overlay||overlay.classList.contains('hidden')||!body||!sameGame(body,detail)) return;
    const scoreCard=body.querySelector('.game-detail-score-card'); if (!scoreCard) return;
    const board=normalizedBoard(detail); patchMainScore(scoreCard,board);
    const stamp=detailStamp(detail); if (body.dataset.gdxStamp===stamp) return;
    body.dataset.gdxStamp=stamp;

    const portrait=body.querySelector('.game-detail-content');
    const landscapeHtml=renderLandscapeBoard(detail,board);
    if (body.querySelector('[data-gdx="landscape"]')) patchOrReplace(body,'[data-gdx="landscape"]',landscapeHtml,detail);
    else if (portrait) portrait.insertAdjacentHTML('beforebegin',landscapeHtml);

    const status=String(detail.status||'').toLowerCase();
    let live=body.querySelector('[data-gdx="live"]');
    if (status==='live') {
      const liveHtml=renderLiveSituation(detail);
      if (live) patchOrReplace(body,'[data-gdx="live"]',liveHtml,detail);
      else scoreCard.insertAdjacentHTML('afterend',liveHtml);
    } else if (live) live.remove();

    const scoreHtml=renderScoreboard(detail,board);
    const scoreExtra=body.querySelector('[data-gdx="scoreboard"]');
    if (scoreExtra) patchOrReplace(body,'[data-gdx="scoreboard"]',scoreHtml,detail);
    else (body.querySelector('[data-gdx="live"]')||scoreCard).insertAdjacentHTML('afterend',scoreHtml);

    const playSection=body.querySelector('.game-detail-play-section'), prevHtml=renderPreviousPlay(detail), prev=body.querySelector('[data-gdx="last-play"]');
    if (prevHtml) {
      if (prev) patchOrReplace(body,'[data-gdx="last-play"]',prevHtml,detail);
      else if (playSection) playSection.insertAdjacentHTML('beforebegin',prevHtml);
    } else prev?.remove();

    body.querySelector('.game-detail-current-grid')?.remove();
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer=setTimeout(enhanceGameDetail,60);
  }

  new MutationObserver(()=>scheduleEnhance()).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',event=>{if(event.target.closest('[data-home-game], .home-daily-game, .home-game-row')) setTimeout(scheduleEnhance,200);},true);
  applyVersionLabel();
  scheduleEnhance();
})();