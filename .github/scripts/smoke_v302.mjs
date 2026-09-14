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
assert(version.version==='v3.02',`expected v3.02, got ${version.version}`);
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
assert(enhancement.includes('function shouldUseCpblLastAfter'),'stale CPBL current/base fallback helper missing');
assert(enhancement.includes('beforeKey!==afterKey && currentKey===beforeKey'),'stale-current detection missing');
assert(enhancement.includes('const useCpblAfter=shouldUseCpblLastAfter(detail,last)'),'runner-name stale-current fallback missing');
assert(enhancement.includes("JSON.stringify(last?.baseStateAfter||{})"),'post-PA base state missing from detail stamp');
assert(enhancement.includes("JSON.stringify(last?.runnersAfter||{})"),'post-PA runner names missing from detail stamp');
assert(enhancement.includes('function previousPlateAppearance'),'previous batter helper regression');

// Production replay: the 3rd-inning 林政華 single must carry an immediate first-base runner.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
  });
  assert(response.ok && data?.ok,`CPBL detail HTTP ${response.status}`);
  const plays=Array.isArray(data?.plays)?data.plays:[];
  const lin=plays.find(p=>Number(p?.inning)===3&&p?.half==='top'&&String(p?.batter||'').includes('林政華'));
  assert(lin,'3局上 林政華 PA missing');
  assert(/安打/.test(String(lin?.result||'')),`expected 林政華 hit, got ${lin?.result||''}`);
  assert(Array.isArray(lin?.baseStateAfter)&&lin.baseStateAfter[0]===true,'林政華 single should light first base immediately');
  assert(String(lin?.runnersAfter?.first||'').includes('林政華'),`林政華 should be first-base runner immediately, got ${lin?.runnersAfter?.first||''}`);

  const idx=plays.indexOf(lin);
  const next=idx>=0?plays[idx+1]:null;
  assert(next&&String(next?.batter||'').includes('威克'),'威克 should bat after 林政華 in this replay');

  assert((data?.lineups?.away?.batters||[]).length===9,'CPBL away lineup regression');
  assert((data?.lineups?.home?.batters||[]).length===9,'CPBL home lineup regression');
}

// Keep the earlier immediate-runner regression alive.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
  });
  assert(response.ok && data?.ok,`CPBL replay HTTP ${response.status}`);
  const plays=Array.isArray(data?.plays)?data.plays:[];
  const nagata=plays.find(p=>Number(p?.inning)===2&&p?.half==='bottom'&&String(p?.batter||'').includes('永田颯太郎'));
  assert(nagata,'永田颯太郎 PA missing');
  assert(String(nagata?.runnersAfter?.first||'').includes('永田颯太郎'),'永田 immediate runner regression');
}

// Keep NPB pitcher-batting regression alive.
{
  const {response,data}=await post('npb-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'NPB',date:'2026-09-14',gameId:'t-d-24',away:'中日龍',home:'阪神虎',status:'live'
  });
  assert(response.ok && data?.ok,`NPB detail HTTP ${response.status}`);
  const byOrder=new Map((data?.lineups?.away?.batters||[]).map(p=>[Number(p?.order),p]));
  assert(String(byOrder.get(8)?.name||'').includes('マラー'),'NPB pitcher batting regression');
}

console.log('v3.02 CPBL stale-current runner fallback production smoke passed');
