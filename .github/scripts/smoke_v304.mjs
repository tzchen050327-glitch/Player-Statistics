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
assert(version.version==='v3.04',`expected v3.04, got ${version.version}`);
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');

assert(enhancement.includes('function completedPlateAppearance'),'completed PA detector missing');
assert(enhancement.includes('function cpblExpectedBatter'),'CPBL next-batter inference missing');
assert(enhancement.includes('function effectiveCurrentBatter'),'effective current batter helper missing');
assert(enhancement.includes("if(!sameHalf) return 0;"),'half-inning out reset missing');
assert(enhancement.includes("!playMatchesCurrentHalf(detail,last)) return [false,false,false]"),'half-inning base reset missing');
assert(enhancement.includes("return {first:'',second:'',third:''};"),'runner reset regression');
assert(enhancement.includes('const current=effectiveCurrentBatter(detail);'),'current batter PA summary is not PA-driven');
assert(enhancement.includes('const effective=effectiveCurrentBatter(detail);'),'lineup highlight is not PA-driven');
assert(enhancement.includes('const currentBatter=effectiveCurrentBatter(detail);'),'live batter display is not PA-driven');
assert(enhancement.includes('Three outs end this offense'),'three-out same-team advance guard missing');

// Production replay: 李勛傑's 4th-inning flyout is a completed PA and 梁家榮 is the next batting-order slot.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
  });
  assert(response.ok && data?.ok,`CPBL detail HTTP ${response.status}`);
  const plays=Array.isArray(data?.plays)?data.plays:[];
  const liIndex=plays.findIndex(p=>Number(p?.inning)===4&&p?.half==='top'&&String(p?.batter||'').includes('李勛傑'));
  assert(liIndex>=0,'4局上 李勛傑 PA missing');
  const li=plays[liIndex], next=plays[liIndex+1];
  assert(/游飛|飛/.test(String(li?.result||'')),`expected 李勛傑 flyout, got ${li?.result||''}`);
  assert(/1\s*人出局/.test(String(li?.description||'')),`李勛傑 description should record 1 out, got ${li?.description||''}`);
  assert(next&&String(next?.batter||'').includes('梁家榮'),`expected 梁家榮 after 李勛傑, got ${next?.batter||''}`);
  const liOrder=Number(li?.battingOrder), nextOrder=Number(next?.battingOrder);
  assert(liOrder>=1&&liOrder<=9,'李勛傑 battingOrder missing');
  assert(nextOrder===(liOrder%9)+1,`batting order should advance ${liOrder}->${(liOrder%9)+1}, got ${nextOrder}`);

  // Half-inning history exists for both sides so v3.04 can continue the order at a side change.
  const top3=plays.filter(p=>Number(p?.inning)===3&&p?.half==='top');
  const bottom3=plays.filter(p=>Number(p?.inning)===3&&p?.half==='bottom');
  assert(top3.length>0&&bottom3.length>0,'half-inning replay data missing');
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

console.log('v3.04 PA-driven half-inning state + next batter production smoke passed');
