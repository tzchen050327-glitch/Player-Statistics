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
assert(version.version==='v3.03',`expected v3.03, got ${version.version}`);
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
assert(enhancement.includes('function playMatchesCurrentHalf'),'half-inning out guard missing');
assert(enhancement.includes('Math.max(direct,after)'),'stale current.outs protection missing');
assert(enhancement.includes('[一二三游遊左中右投捕](?:飛|直)'),'positional fly/liner out parser missing');
assert(enhancement.includes('shouldUseCpblLastAfter'),'runner fallback regression');
assert(enhancement.includes('function previousPlateAppearance'),'previous batter regression');

// Production replay: 李勛傑 游飛 in 4th top explicitly produced the first out.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
  });
  assert(response.ok && data?.ok,`CPBL detail HTTP ${response.status}`);
  const plays=Array.isArray(data?.plays)?data.plays:[];
  const lee=plays.find(p=>Number(p?.inning)===4&&p?.half==='top'&&String(p?.batter||'').includes('李勛傑'));
  assert(lee,'4局上 李勛傑 PA missing');
  assert(String(lee?.result||'').includes('游飛'),`expected 游飛, got ${lee?.result||''}`);
  assert(/1\s*人出局/.test(String(lee?.description||'')),`expected explicit 1 out in description, got ${lee?.description||''}`);
  assert((data?.lineups?.away?.batters||[]).length===9,'CPBL away lineup regression');
  assert((data?.lineups?.home?.batters||[]).length===9,'CPBL home lineup regression');
}

// Keep immediate runner state regression alive.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
  });
  assert(response.ok && data?.ok,`CPBL runner replay HTTP ${response.status}`);
  const plays=Array.isArray(data?.plays)?data.plays:[];
  const lin=plays.find(p=>Number(p?.inning)===3&&p?.half==='top'&&String(p?.batter||'').includes('林政華'));
  assert(lin,'3局上 林政華 PA missing');
  assert(String(lin?.runnersAfter?.first||'').includes('林政華'),'林政華 immediate runner regression');
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

console.log('v3.03 CPBL live outs synchronization production smoke passed');
