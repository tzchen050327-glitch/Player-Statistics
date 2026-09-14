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
assert(version.version==='v2.99',`expected v2.99, got ${version.version}`);

const app=await fs.readFile('app.js','utf8');
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
assert(app.includes("new CustomEvent('home-game-detail-state'"),'app -> enhancement detail bridge missing');
assert(app.includes('window.__latestHomeGameDetail = detail'),'latest detail bridge state missing');
assert(enhancement.includes("window.addEventListener('home-game-detail-state'"),'enhancement bridge listener missing');
assert(enhancement.includes('latestDetail || window.__latestHomeGameDetail || null'),'enhancement fallback detail missing');
assert(enhancement.includes('const byOrder=new Map(entries.map'),'lineup slot map missing');

// Production regression: today's CPBL game must expose a complete 9+9 batting order.
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
    status:'live',
    force:false
  });
  assert(response.ok && data?.ok,`CPBL detail HTTP ${response.status}`);
  const away=data?.lineups?.away?.batters||[];
  const home=data?.lineups?.home?.batters||[];
  assert(away.length===9,`CPBL away lineup expected 9, got ${away.length}`);
  assert(home.length===9,`CPBL home lineup expected 9, got ${home.length}`);
  for(const [side,list] of [['away',away],['home',home]]){
    const orders=list.map(p=>Number(p?.order)).sort((a,b)=>a-b);
    assert(JSON.stringify(orders)===JSON.stringify([1,2,3,4,5,6,7,8,9]),`${side} batting orders invalid: ${orders.join(',')}`);
    assert(list.every(p=>String(p?.name||'').trim()),`${side} lineup has blank name`);
  }
}

// Keep NPB regression alive as well.
{
  const {response,data}=await post('npb-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'NPB',date:'2026-09-14',gameId:'t-d-24',away:'中日龍',home:'阪神虎',status:'live'
  });
  assert(response.ok && data?.ok,`NPB detail HTTP ${response.status}`);
  const byOrder=new Map((data?.lineups?.away?.batters||[]).map(p=>[Number(p?.order),p]));
  assert(String(byOrder.get(8)?.name||'').includes('マラー'),'NPB pitcher batting regression');
}

console.log('v2.99 CPBL lineup bridge + 9x9 production smoke passed');
