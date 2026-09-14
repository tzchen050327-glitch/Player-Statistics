(() => {
  const UI_VERSION = document.querySelector('meta[name="app-version"]')?.getAttribute('content') || 'v2.77';
  const DETAIL_URL_RE = /\/(?:league-game-detail|cpbl-game-detail|cpbl-postseason-detail|npb-game-detail)(?:\?|$)/i;
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
    const raw = String(value || '').normalize('NFKC');
    const loaded = /滿壘|満塁|bases\s*loaded/i.test(raw);
    const numbered = n => new RegExp(`(?:^|[^0-9])${n}(?=[^0-9]|$)`).test(raw);
    return {
      first: loaded || /一壘|一塁|first/i.test(raw) || numbered(1),
      second: loaded || /二壘|二塁|second/i.test(raw) || numbered(2),
      third: loaded || /三壘|三塁|third/i.test(raw) || numbered(3)
    };
  }

  function baseStateKey(value) {
    const s=normalizeBaseState(value);
    return `${s.first?'1':'0'}${s.second?'1':'0'}${s.third?'1':'0'}`;
  }

  function shouldUseCpblLastAfter(detail,last) {
    if(String(detail?.league||'').toUpperCase()!=='CPBL' || !last) return false;
    const hasAfter=last?.baseStateAfter!==undefined&&last?.baseStateAfter!==null || !!last?.basesAfter;
    if(!hasAfter) return false;
    const currentName=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name||'');
    const lastName=compactName(last?.batter?.fullName||last?.batter?.name||last?.batter||last?.hitter||'');
    if(currentName && lastName && samePlayerName(currentName,lastName)) return true;

    const beforeValue=last?.baseState ?? last?.bases ?? '';
    const afterValue=last?.baseStateAfter ?? last?.basesAfter ?? '';
    const currentValue=detail?.current?.baseState ?? detail?.current?.bases ?? '';
    const beforeKey=baseStateKey(beforeValue), afterKey=baseStateKey(afterValue), currentKey=baseStateKey(currentValue);

    // CPBL can advance current.batter before current.baseState catches up.
    // If current still equals the completed PA's pre-PA state while the post-PA
    // state changed, the post-PA state is the authoritative live situation.
    return beforeKey!==afterKey && currentKey===beforeKey;
  }

  function currentBaseState(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    const status = String(detail?.status || '').toLowerCase();
    if (status === 'final' || inferredOutsAfterPlay(last) >= 3) return [false,false,false];
    const league=String(detail?.league || '').toUpperCase();
    if (league === 'CPBL' && shouldUseCpblLastAfter(detail,last)) {
      if (last?.baseStateAfter !== undefined && last?.baseStateAfter !== null) return last.baseStateAfter;
      if (last?.basesAfter) return last.basesAfter;
    }
    if (league === 'NPB') {
      const inferred = inferRunnerNames(detail);
      if (inferred.first || inferred.second || inferred.third) {
        return [!!inferred.first, !!inferred.second, !!inferred.third];
      }
      if (detail?.current?.bases !== undefined && detail?.current?.bases !== null) return detail.current.bases;
    }
    if (detail?.current?.baseState) return detail.current.baseState;
    if (detail?.current?.bases) return detail.current.bases;
    return last?.baseStateAfter || last?.basesAfter || last?.baseState || last?.bases || '';
  }

  function parseOutNumber(value) {
    const m = String(value ?? '').match(/([0-3])/);
    return m ? Number(m[1]) : null;
  }

  function inferredOutsAfterPlay(play) {
    if (!play) return 0;
    const before = parseOutNumber(play.outs);
    if (before === null) return 0;
    const resultText=`${play.result || ''} ${play.raw || ''}`;
    const description=String(play.description || '');
    const text=`${resultText} ${description}`;
    const explicit=text.match(/([0-3])\s*人出局/i);
    if (explicit) return Math.min(3,Number(explicit[1]));
    if (/三人出局|3\s*出局/i.test(text)) return 3;
    // A hit can contain words such as '高飛球' in its description; that is not an out.
    if (/全壘打|三壘安打|二壘安打|一壘安打|安打|四壞|故意四壞|觸身|死球|失誤上壘|野手選擇|趁傳上壘/i.test(resultText)) return before;
    let added = 0;
    if (/三殺|トリプルプレー/i.test(resultText)) added = 3;
    else if (/雙殺|併殺|ダブルプレー|DP\b/i.test(resultText)) added = 2;
    else if (/三振|ゴロ|滾地|一滾|二滾|三滾|游滾|遊滾|投滾|捕滾|フライ|飛球|界飛|ライナー|平飛|犧牲|犠牲|犠打|犧飛|アウト|出局/i.test(resultText)) added = 1;
    else if (/打者[^。]*(刺殺|接殺|封殺|出局)/i.test(description)) added = 1;
    return Math.min(3, before + added);
  }

  function currentOuts(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    const after = inferredOutsAfterPlay(last);
    if (String(detail?.status || '').toLowerCase() === 'final') return 3;
    if (after >= 3) return 3;
    const direct = parseOutNumber(detail?.current?.outs);
    if (direct !== null) return Math.min(2, direct);
    return after;
  }

  function normalizedBoard(detail) {
    const game = detail?.game || {}, source = detail?.scoreboard || {};
    const innings = Array.isArray(source.innings) ? source.innings.map(String) : [];
    const away = Array.isArray(source.away) ? source.away : [], home = Array.isArray(source.home) ? source.home : [];
    const sum = values => {
      let total = 0, found = false;
      for (const v of values) if (/^-?\d+$/.test(safeCell(v))) { total += Number(v); found = true; }
      return found ? total : null;
    };
    const pick = (primary, fallback='') => safeCell(primary) === '' ? fallback : primary;
    const awayRuns = pick(source?.awayTotals?.R, pick(game.awayScore, sum(away) ?? ''));
    const homeRuns = pick(source?.homeTotals?.R, pick(game.homeScore, sum(home) ?? ''));
    return {
      innings, away, home,
      awayTotals:{R:awayRuns,H:pick(source?.awayTotals?.H,''),E:pick(source?.awayTotals?.E,'')},
      homeTotals:{R:homeRuns,H:pick(source?.homeTotals?.H,''),E:pick(source?.homeTotals?.E,'')}
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

  function lineupEntries(detail, side) {
    return rawRoster(detail, side)
      .sort((a,b)=>(Number(a.order)||99)-(Number(b.order)||99))
      .slice(0,9);
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
    const take=(...values)=>{
      const value=compactName(values.find(v=>compactName(v))||'');
      return /^\d+$/.test(value)||/^(?:true|false|null|undefined)$/i.test(value)?'':value;
    };
    return {first:take(raw.first,raw.firstBase,raw[1],raw.base1),second:take(raw.second,raw.secondBase,raw[2],raw.base2),third:take(raw.third,raw.thirdBase,raw[3],raw.base3)};
  }

  function inferRunnerNames(detail) {
    const offense=currentOffenseSide(detail), wantedHalf=offense==='away'?'top':'bottom';
    const gameInning=Number(String(detail?.game?.inningLabel||'').match(/(\d+)/)?.[1]||0);
    const plays=(Array.isArray(detail?.plays)?detail.plays:[]).filter(p=>p?.half===wantedHalf&&(!gameInning||Number(p?.inning)===gameInning));
    let runners={first:'',second:'',third:''};
    const keys=['first','second','third'];
    const rank={first:1,second:2,third:3};
    const keyOf=base=>base==='一壘'?'first':base==='二壘'?'second':'third';
    const destOf=text=>/一壘/.test(text)?'first':/二壘/.test(text)?'second':/三壘/.test(text)?'third':'';
    const league=String(detail?.league||'').toUpperCase();
    // CPBL baseState is the official situation BEFORE this plate appearance.
    // NPB keeps using the explicit before-state fields when available.
    const stateForPlay=play=>normalizeBaseState(
      league==='CPBL'
        ? (play?.baseState ?? play?.bases ?? play?.baseStateBefore ?? play?.basesBefore ?? '')
        : (play?.baseStateBefore ?? play?.basesBefore ?? play?.baseState ?? play?.bases ?? '')
    );
    const reconcileBefore=state=>{
      for(const key of keys) if(!state[key]) runners[key]='';
    };
    const destination=(result,desc)=>{
      const text=`${result||''} ${desc||''}`;
      if(/全壘打|全塁打|ホームラン|home\s*run/i.test(text)) return 'home';
      if(/三壘安打|三塁打|スリーベース|triple/i.test(text)) return 'third';
      if(/二壘安打|二塁打|ツーベース|double/i.test(text)) return 'second';
      if(/一壘安打|安打|ヒット|四壞|四球|フォアボール|故意四壞|敬遠|觸身|死球|デッドボール|失誤上壘|野手選擇/i.test(text) || /趁傳上壘|打者[^。]*上壘/.test(desc||'')) return 'first';
      return '';
    };
    const heuristicAfter=(before,dest,result,play)=>{
      let after={first:!!before.first,second:!!before.second,third:!!before.third};
      if(inferredOutsAfterPlay(play)>=3 || dest==='home') return {first:false,second:false,third:false};
      if(dest==='third') return {first:false,second:false,third:true};
      if(dest==='second') return {first:false,second:true,third:!!before.first};
      if(dest==='first') {
        const walk=/四壞|四球|フォアボール|故意四壞|敬遠|觸身|死球|デッドボール/i.test(result||'');
        if(walk){
          if(before.first){
            if(before.second) after.third=true;
            after.second=true;
          }
          after.first=true;
          return after;
        }
        return {first:true,second:!!before.first,third:!!before.second};
      }
      if(/犧牲短打|犠打|sacrifice\s*bunt/i.test(result||'')) {
        return {first:false,second:!!before.first,third:!!before.second || !!before.third};
      }
      return after;
    };
    const assignToState=(after,batter,dest)=>{
      const old={...runners};
      const next={first:'',second:'',third:''};
      if(dest==='home'){ runners=next; return; }
      if(dest && after[dest] && batter) next[dest]=batter;
      const oldRunners=[['third',old.third],['second',old.second],['first',old.first]].filter(([,name])=>!!name);
      for(const [from,name] of oldRunners){
        const candidates=keys
          .filter(key=>after[key]&&!next[key]&&rank[key]>=rank[from])
          .sort((a,b)=>rank[b]-rank[a]);
        if(candidates.length) next[candidates[0]]=name;
      }
      runners=next;
    };
    for(let i=0;i<plays.length;i++){
      const play=plays[i];
      const desc=compactName(play?.description||'');
      const batter=compactName(play?.batter||play?.hitter||'');
      const result=`${play?.result||''} ${play?.raw||''}`;
      const before=stateForPlay(play);
      reconcileBefore(before);

      for(const m of desc.matchAll(/更換代跑[:：]\s*([^=〉>。]+?)\s*(?:=>|→|〉)\s*([^，。\s]+)/g)){
        const from=compactName(m[1]),to=compactName(m[2]);
        for(const k of keys) if(runners[k]===from) runners[k]=to;
      }
      for(const m of desc.matchAll(/(一壘|二壘|三壘)跑者\s*([^\s，。-]+?)\s*(上(?:一壘|二壘|三壘)|回本壘(?:得分)?|出局)/g)){
        const from=keyOf(m[1]),name=compactName(m[2]),action=m[3];
        if(runners[from]===name||!runners[from]) runners[from]='';
        if(/^上/.test(action)){
          const to=destOf(action);
          if(to) runners[to]=name;
        }
      }

      const nextPlay=plays[i+1];
      const sameHalf=nextPlay&&Number(nextPlay?.inning)===Number(play?.inning)&&nextPlay?.half===play?.half;
      // For CPBL, the next PA's official pre-PA state is this PA's authoritative after-state.
      // This fixes the old off-by-one interpretation that lost runner identities.
      const officialAfter=sameHalf ? stateForPlay(nextPlay) : null;
      const dest=destination(result,desc);
      const after=officialAfter || heuristicAfter(before,dest,result,play);
      assignToState(after,batter,dest);

      if(inferredOutsAfterPlay(play)>=3) runners={first:'',second:'',third:''};
    }
    return runners;
  }

  function currentRunnerNames(detail) {
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    const last = plays[plays.length - 1];
    if (String(detail?.status || '').toLowerCase() === 'final' || inferredOutsAfterPlay(last) >= 3) {
      return {first:'',second:'',third:''};
    }
    const direct = directRunnerNames(detail), inferred = inferRunnerNames(detail);
    let immediate={first:'',second:'',third:''};
    const useCpblAfter=shouldUseCpblLastAfter(detail,last);
    if(useCpblAfter){
      const raw=last?.runnersAfter||{};
      immediate={first:compactName(raw.first||''),second:compactName(raw.second||''),third:compactName(raw.third||'')};
    }
    // When current.baseState is stale, its runner names are stale as well.
    // Prefer the completed PA's post-state identities before direct current runners.
    const merged=useCpblAfter
      ? {first:immediate.first||direct.first||inferred.first,second:immediate.second||direct.second||inferred.second,third:immediate.third||direct.third||inferred.third}
      : {first:direct.first||inferred.first,second:direct.second||inferred.second,third:direct.third||inferred.third};
    const state=normalizeBaseState(currentBaseState(detail));
    return {first:state.first?merged.first:'',second:state.second?merged.second:'',third:state.third?merged.third:''};
  }

  function detailStamp(detail) {
    const game=detail?.game||{}, last=Array.isArray(detail?.plays)&&detail.plays.length?detail.plays.at(-1):null;
    return [detail?.league,detail?.date,detail?.status,detail?.competition,detail?.competitionLabel,detail?.statsScope,game.id,game.awayScore,game.homeScore,detail?.updatedAt,detail?.current?.outs,
      detail?.current?.pitcher?.name,detail?.current?.batter?.name,JSON.stringify(detail?.scoreboard||{}),JSON.stringify(detail?.lineups||{}),
      JSON.stringify(detail?.current?.runners||{}),JSON.stringify(detail?.current?.baseState||{}),detail?.current?.bases,last?.inning,last?.half,last?.batter,last?.pitcher,last?.result,last?.bases,last?.rbi,
      JSON.stringify(last?.baseStateAfter||{}),JSON.stringify(last?.runnersAfter||{})].map(v=>String(v??'')).join('|');
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
    const byOrder=new Map(entries.map((entry,index)=>[Number(entry?.order)||index+1,entry]));
    const rows=Array.from({length:9},(_,i)=>byOrder.get(i+1)||{order:i+1,number:'',name:'',avg:'',hits:'',homeRuns:'',rbi:''});
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
    return `<div class="gdx-field-card"><div class="gdx-mini-title">守備</div><div class="gdx-field-shape"></div><div class="gdx-fielders-layer">${spots.map(pos=>`<div class="gdx-fielder gdx-pos-${pos}"><span>${esc(field[pos]||'—')}</span></div>`).join('')}</div></div>`;
  }

  function shortPaResult(play) {
    const text=compactName(play?.result||play?.raw||play?.description||'');
    if(!text) return '—';
    if(/四壞|保送|walk/i.test(text)) return '四壞';
    if(/觸身|死球|hit by pitch/i.test(text)) return '觸身';
    if(/三振|strikeout/i.test(text)) return '三振';
    if(/全壘打|全塁打|home run/i.test(text)) return '全壘打';
    if(/三壘安打|三塁打|triple/i.test(text)) return '三安';
    if(/二壘安打|二塁打|double/i.test(text)) return '二安';
    if(/安打|single/i.test(text)) return '一安';
    if(/雙殺|併殺|double play|DP\b/i.test(text)) return '雙殺';
    if(/犧牲飛球|犠牲フライ|sacrifice fly/i.test(text)) return '犧飛';
    if(/犧牲觸擊|犧牲短打|犠打|sacrifice bunt/i.test(text)) return '犧打';
    if(/界外飛|邪飛/i.test(text)) return '界飛';
    if(/飛球|飛出|flyout|フライ/i.test(text)) return '飛球';
    if(/平飛|lineout|ライナー/i.test(text)) return '平飛';
    if(/滾地|滾地球|groundout|ゴロ/i.test(text)) return '滾地';
    return text.length>7?`${text.slice(0,7)}…`:text;
  }

  function currentBatterPaSummary(detail) {
    const current=detail?.current?.batter||{};
    const name=compactName(current.fullName||current.name||current.playerName||'');
    const acnt=String(current.acnt||current.batterAcnt||current.playerAcnt||'').trim();
    const plays=Array.isArray(detail?.plays)?detail.plays:[];
    const matches=plays.filter(play=>{
      const paAcnt=String(play?.batterAcnt||play?.hitterAcnt||play?.batter?.acnt||play?.hitter?.acnt||'').trim();
      if(acnt&&paAcnt) return acnt===paAcnt;
      const paName=compactName(play?.batter?.fullName||play?.batter?.name||play?.batter||play?.hitter?.fullName||play?.hitter?.name||play?.hitter||'');
      return !!(name&&paName&&samePlayerName(name,paName));
    });
    return {name:name||'等待打者',results:matches.map(shortPaResult).filter(Boolean)};
  }

  function previousPlateAppearance(detail) {
    const plays=Array.isArray(detail?.plays)?detail.plays:[];
    const play=plays.at(-1)||null;
    if(!play) return {name:'',result:''};
    const name=compactName(play?.batter?.fullName||play?.batter?.name||play?.batter||play?.hitter?.fullName||play?.hitter?.name||play?.hitter||'');
    return {name,result:shortPaResult(play)};
  }

  function currentPitcherSummary(detail,side) {
    const current=detail?.current?.pitcher||{};
    const fallback=currentPitcherInfo(detail,side);
    const stats=current.stats||current;
    return {
      name:compactName(current.fullName||current.name||current.playerName||fallback.name||'')||'投手資料讀取中',
      pitches:safeCell(stats.pitches??stats.pitchCount??stats.pitchCnt??fallback.pitches??'')
    };
  }

  function renderRunnerDiamond(detail,defenseSide) {
    const state=normalizeBaseState(currentBaseState(detail)), names=currentRunnerNames(detail), label=(on,name)=>on?esc(name||'—'):'';
    const pitcher=currentPitcherSummary(detail,defenseSide), batter=currentBatterPaSummary(detail), previous=previousPlateAppearance(detail);
    const paHtml=batter.results.length?batter.results.map((result,i)=>`<span title="第${i+1}打席">${esc(result)}</span>`).join(''):'<span class="is-empty">尚未有打席</span>';
    const prevHtml=previous.name?`<div class="gdx-live-previous-row"><span>上一棒</span><strong>${esc(previous.name)}</strong><b>${esc(previous.result||'—')}</b></div>`:'';
    return `<div class="gdx-runner-card"><div class="gdx-mini-title">壘上</div><div class="gdx-runner-top"><div class="gdx-runner-diamond"><div class="gdx-runner-base gdx-runner-second ${state.second?'is-on':''}"></div><div class="gdx-runner-base gdx-runner-third ${state.third?'is-on':''}"></div><div class="gdx-runner-base gdx-runner-first ${state.first?'is-on':''}"></div><span class="gdx-runner-name gdx-runner-name-second">${label(state.second,names.second)}</span><span class="gdx-runner-name gdx-runner-name-third">${label(state.third,names.third)}</span><span class="gdx-runner-name gdx-runner-name-first">${label(state.first,names.first)}</span><div class="gdx-runner-home"></div></div><div class="gdx-runner-outs">${currentOuts(detail)}出局</div></div><div class="gdx-live-strip"><div class="gdx-live-pitcher-row"><span>投手</span><strong>${esc(pitcher.name)}</strong><b>用球 ${esc(pitcher.pitches||'—')}</b></div><div class="gdx-live-batter-row"><div><span>打者</span><strong>${esc(batter.name)}</strong></div><div class="gdx-pa-results">${paHtml}</div></div>${prevHtml}</div></div>`;
  }

  function gameStateLabel(detail) {
    const supplied=compactName(detail?.game?.statusLabel||detail?.statusLabel||'');
    if(supplied) return supplied;
    const status=String(detail?.status||'').toLowerCase();
    if(status==='final') return '比賽結束';
    if(status==='postponed') return '延賽';
    if(status==='cancelled') return '延賽／取消';
    if(status==='suspended') return '比賽暫停';
    return compactName(detail?.game?.inningLabel||'');
  }

  function renderLandscapeScoreboard(detail,board) {
    const game=detail?.game||{}, innings=board.innings.length?board.innings:Array.from({length:9},(_,i)=>String(i+1));
    const cells=(values,totals)=>`${innings.map((_,i)=>`<td>${esc(safeCell(values?.[i]))}</td>`).join('')}<td class="is-total">${esc(safeCell(totals.R))}</td><td>${esc(safeCell(totals.H))}</td><td>${esc(safeCell(totals.E))}</td>`;
    return `<div class="gdx-landscape-score"><div class="gdx-landscape-scoreline"><div><span>${esc(game.away||'客隊')}</span><strong>${esc(safeCell(board.awayTotals.R)||'0')}</strong></div><div class="gdx-landscape-inning">${esc(gameStateLabel(detail))}</div><div><strong>${esc(safeCell(board.homeTotals.R)||'0')}</strong><span>${esc(game.home||'主隊')}</span></div></div><div class="gdx-landscape-scoretable-wrap"><table class="gdx-landscape-scoretable"><thead><tr><th></th>${innings.map(x=>`<th>${esc(x)}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr></thead><tbody><tr><th>${esc(game.away||'客')}</th>${cells(board.away,board.awayTotals)}</tr><tr><th>${esc(game.home||'主')}</th>${cells(board.home,board.homeTotals)}</tr></tbody></table></div></div>`;
  }

  function landscapeShowBothLineups(detail) {
    if (String(detail?.status || '').toLowerCase() === 'final') return true;
    const plays = Array.isArray(detail?.plays) ? detail.plays : [];
    return inferredOutsAfterPlay(plays.at(-1)) >= 3;
  }

  function renderLandscapeBoard(detail,board) {
    const offense=currentOffenseSide(detail), defense=offense==='away'?'home':'away', game=detail?.game||{};
    const competitionLabel=compactName(detail?.competitionLabel||game?.competitionLabel||'');
    const competitionScoped=String(detail?.statsScope||detail?.authority?.statsScope||'')==='competition';
    const lineupTag=competitionScoped&&competitionLabel?`LINEUP · ${competitionLabel}`:'LINEUP';
    const side=(which)=>{
      const team=which==='away'?game.away||'客隊':game.home||'主隊';
      return `<section class="gdx-landscape-side gdx-side-${which}"><div class="gdx-landscape-team-head"><span>${which==='away'?'AWAY':'HOME'}</span><strong>${esc(team)}</strong><em>${esc(lineupTag)}</em></div>${renderLineupPanel(detail,which)}</section>`;
    };
    return `<section class="gdx-landscape-board game-detail-enhanced-marker" data-gdx="landscape">${side('away')}<div class="gdx-landscape-center">${renderLandscapeScoreboard(detail,board)}<div class="gdx-landscape-lower">${renderDefenseField(detail,defense)}${renderRunnerDiamond(detail,defense)}</div></div>${side('home')}</section>`;
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
    const detail=latestDetail || window.__latestHomeGameDetail || null; if (!detail?.game) return;
    const overlay=document.getElementById('homeGameDetailOverlay'), body=overlay?.querySelector('#homeGameDetailBody');
    const league=String(detail?.league||'').toUpperCase(), isCpbl=league==='CPBL', isNpb=league==='NPB';
    const supportsLandscape=isCpbl||isNpb;
    const landscapeMode=supportsLandscape && window.matchMedia('(orientation: landscape) and (min-width: 700px)').matches;
    if (!isCpbl && !isNpb) {
      document.body.classList.remove('gdx-cpbl-landscape');
      body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
      return;
    }
    document.body.classList.toggle('gdx-cpbl-landscape',supportsLandscape);
    if (!supportsLandscape) body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
    if (!overlay||overlay.classList.contains('hidden')||!body||!sameGame(body,detail)) return;
    const scoreCard=body.querySelector('.game-detail-score-card'); if (!scoreCard) return;
    const board=normalizedBoard(detail); patchMainScore(scoreCard,board);
    const stamp=`${detailStamp(detail)}|${landscapeMode?'landscape':'portrait'}`;
    if (body.dataset.gdxStamp===stamp) return;
    body.dataset.gdxStamp=stamp;

    const portrait=body.querySelector('.game-detail-content');
    if (landscapeMode) {
      const landscapeHtml=renderLandscapeBoard(detail,board);
      if (body.querySelector('[data-gdx="landscape"]')) patchOrReplace(body,'[data-gdx="landscape"]',landscapeHtml,detail);
      else if (portrait) portrait.insertAdjacentHTML('beforebegin',landscapeHtml);
      body.querySelectorAll('[data-gdx="live"],[data-gdx="scoreboard"],[data-gdx="last-play"]').forEach(node=>node.remove());
    } else {
      body.querySelector('[data-gdx="landscape"]')?.remove();

      const status=String(detail.status||'').toLowerCase();
      let live=body.querySelector('[data-gdx="live"]');
      if (isCpbl && status==='live') {
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
    }

    body.querySelector('.game-detail-current-grid')?.remove();
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer=setTimeout(enhanceGameDetail,60);
  }

  const acceptRealtimeDetail = event => {
    const detail=event?.detail?.detail||event?.detail?.row?.published_payload||null;
    if (!detail?.game) return;
    latestDetail=detail;
    scheduleEnhance();
  };
  window.addEventListener('cpbl-live-cache-update',acceptRealtimeDetail);
  window.addEventListener('npb-live-cache-update',acceptRealtimeDetail);
  window.addEventListener('home-game-detail-state', event => {
    const detail=event?.detail?.detail||null;
    if (!detail?.game) return;
    latestDetail=detail;
    scheduleEnhance();
  });

  new MutationObserver(()=>scheduleEnhance()).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',event=>{if(event.target.closest('[data-home-game], .home-daily-game, .home-game-row')) setTimeout(scheduleEnhance,200);},true);
  window.addEventListener('resize',scheduleEnhance,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(scheduleEnhance,80),{passive:true});
  applyVersionLabel();
  scheduleEnhance();
})();