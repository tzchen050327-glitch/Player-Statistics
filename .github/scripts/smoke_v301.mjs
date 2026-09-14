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
assert(version.version==='v3.01',`expected v3.01, got ${version.version}`);
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
const css=await fs.readFile('game-detail-enhancement.css','utf8');
assert(enhancement.includes('last?.baseStateAfter'),'CPBL immediate post-PA base state fallback missing');
assert(enhancement.includes('last?.runnersAfter'),'CPBL immediate post-PA runner fallback missing');
assert(enhancement.includes('function previousPlateAppearance'),'previous batter helper missing');
assert(enhancement.includes('gdx-live-previous-row'),'previous batter landscape row missing');
assert(css.includes('.gdx-live-previous-row'),'previous batter styling missing');
assert(enhancement.includes("A hit can contain words such as '高飛球'"),'hit/out inference guard missing');

// Production replay: runner identities must exist immediately AFTER each completed PA.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
  });
  assert(response.ok && data?.ok,`CPBL detail HTTP ${response.status}`);
  const plays=Array.isArray(data?.plays)?data.plays:[];
  const find=name=>plays.find(p=>Number(p?.inning)===2&&p?.half==='bottom'&&String(p?.batter||'').includes(name));
  const nagata=find('永田颯太郎');
  assert(nagata,'永田颯太郎 PA missing');
  assert(Array.isArray(nagata?.baseStateAfter)&&nagata.baseStateAfter[0]===true,'永田 hit should immediately light first base');
  assert(String(nagata?.runnersAfter?.first||'').includes('永田颯太郎'),`永田 should be first-base runner immediately, got ${nagata?.runnersAfter?.first||''}`);

  const tseng=find('曾子祐');
  assert(tseng,'曾子祐 PA missing');
  assert(String(tseng?.runnersAfter?.first||'').includes('曾子祐'),`曾子祐 should be on first, got ${tseng?.runnersAfter?.first||''}`);
  assert(String(tseng?.runnersAfter?.second||'').includes('永田颯太郎'),`永田 should advance to second, got ${tseng?.runnersAfter?.second||''}`);

  const chen=find('陳致嘉');
  assert(chen,'陳致嘉 PA missing');
  assert(String(chen?.runnersAfter?.first||'').includes('陳致嘉'),`陳致嘉 should be on first, got ${chen?.runnersAfter?.first||''}`);
  assert(String(chen?.runnersAfter?.third||'').includes('宋柏翰'),`宋柏翰 should be on third, got ${chen?.runnersAfter?.third||''}`);
  assert((data?.lineups?.away?.batters||[]).length===9,'CPBL away lineup regression');
  assert((data?.lineups?.home?.batters||[]).length===9,'CPBL home lineup regression');
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

console.log('v3.01 CPBL immediate runners + previous batter production smoke passed');
