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
assert(version.version==='v3.08',`expected v3.08, got ${version.version}`);

// Frontend fallback from v3.07 must remain as a safety net for old final cache rows.
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
assert(enhancement.includes('function reconciledBattingStats'),'final batting reconciliation regression');
assert(enhancement.includes('gameHomeRuns'),'gameHomeRuns reconciliation regression');

// CPBL now exposes official source event timestamps from LiveLogJson.
{
  const {response,data}=await post('cpbl-game-detail-source',{
    appKey:APP_KEY,action:'game-detail',date:'2026-09-14',gameId:'280',status:'final'
  });
  assert(response.ok&&data?.ok,`CPBL source HTTP ${response.status}`);
  assert(String(data?.sourceTiming?.lastEventUpdatedAt||'').startsWith('2026-09-14T22:05:31'),`unexpected last event time ${data?.sourceTiming?.lastEventUpdatedAt||''}`);
  assert(String(data?.sourceTiming?.gameUpdatedAt||'').startsWith('2026-09-14T21:51:05'),`unexpected game update time ${data?.sourceTiming?.gameUpdatedAt||''}`);
  assert(String(data?.sourceTiming?.observedAt||'').includes('T'),'source observedAt missing');
  const plays=Array.isArray(data?.plays)?data.plays:[];
  assert(plays.some(p=>p?.sourceUpdatedAt),'per-play CPBL sourceUpdatedAt missing');
}

// Historical CPBL final fixture remains intact; old cache is intentionally left immutable.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'final',force:false
  });
  assert(response.ok&&data?.ok,`CPBL final HTTP ${response.status}`);
  const away=Array.isArray(data?.lineups?.away?.batters)?data.lineups.away.batters:[];
  const liang=away.find(p=>String(p?.name||'').includes('梁家榮'));
  assert(liang,'梁家榮 final fixture missing');
  assert(Number(liang?.gameHomeRuns||0)===1,'梁家榮 gameHomeRuns regression');
}

// NPB detail path remains healthy after updater-side final freezing change.
{
  const {response,data}=await post('npb-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'NPB',date:'2026-09-14',gameId:'t-d-24',away:'中日龍',home:'阪神虎',status:'final'
  });
  assert(response.ok&&data?.ok,`NPB detail HTTP ${response.status}`);
  assert(Array.isArray(data?.lineups?.away?.batters),'NPB away lineup missing');
}

console.log('v3.08 final stat freeze + CPBL source timing production smoke passed');
