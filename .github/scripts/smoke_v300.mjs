import fs from 'node:fs/promises';

const BASE='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1';
const APP_KEY='TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
const assert=(condition,message)=>{ if(!condition) throw new Error(message); };

async function post(slug,body){
  const response=await fetch(`${BASE}/${slug}`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)
  });
  const data=await response.json().catch(()=>({}));
  return {response,data};
}

const version=JSON.parse(await fs.readFile('version.json','utf8'));
assert(version.version==='v3.00',`expected v3.00, got ${version.version}`);

const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
assert(enhancement.includes("league==='CPBL'"),'CPBL-specific runner state semantics missing');
assert(enhancement.includes("play?.baseState ?? play?.bases ?? play?.baseStateBefore"),'CPBL pre-PA base-state preference missing');
assert(enhancement.includes('const officialAfter=sameHalf ? stateForPlay(nextPlay) : null'),'next-PA after-state bridge missing');
assert(enhancement.includes('const merged={first:direct.first||inferred.first'),'runner direct/inferred merge missing');
assert(enhancement.includes("const state=normalizeBaseState(detail?.current?.baseState ?? detail?.current?.bases ?? '')"),'current base-state mask missing');

// Production replay regression: CPBL first inning must preserve runner identities.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,
    action:'game-detail',
    league:'CPBL',
    date:'2026-09-14',
    gameId:'280',
    kindCode:'A',
    away:'樂天桃猿',
    home:'台鋼雄鷹',
    status:'scheduled',
    force:false
  });
  assert(response.ok && data?.ok,`CPBL detail HTTP ${response.status}`);
  const plays=Array.isArray(data?.plays)?data.plays:[];
  const lee=plays.find(p=>Number(p?.inning)===1 && p?.half==='top' && String(p?.batter||'').includes('李勛傑'));
  assert(lee, 'CPBL replay target 李勛傑 missing');
  assert(String(lee?.runners?.first||'').includes('林泓育'),`expected first-base runner 林泓育, got ${lee?.runners?.first||''}`);
  assert(String(lee?.runners?.second||'').includes('威克'),`expected second-base runner 威克, got ${lee?.runners?.second||''}`);
}

// Keep the lineup and NPB pitcher-batting regressions alive.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled'
  });
  assert(response.ok && data?.ok,`CPBL lineup HTTP ${response.status}`);
  assert((data?.lineups?.away?.batters||[]).length===9,'CPBL away lineup regression');
  assert((data?.lineups?.home?.batters||[]).length===9,'CPBL home lineup regression');
}

{
  const {response,data}=await post('npb-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'NPB',date:'2026-09-14',gameId:'t-d-24',away:'中日龍',home:'阪神虎',status:'live'
  });
  assert(response.ok && data?.ok,`NPB detail HTTP ${response.status}`);
  const byOrder=new Map((data?.lineups?.away?.batters||[]).map(p=>[Number(p?.order),p]));
  assert(String(byOrder.get(8)?.name||'').includes('マラー'),'NPB pitcher batting regression');
}

console.log('v3.00 CPBL runner-name production replay smoke passed');
