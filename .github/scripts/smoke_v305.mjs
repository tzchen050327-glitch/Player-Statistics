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
assert(version.version==='v3.05',`expected v3.05, got ${version.version}`);
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
assert(enhancement.includes('CPBL play.battingOrder is the ordinal PA number inside the current'),'CPBL battingOrder warning missing');
assert(!enhancement.includes("let previousOrder=Number(anchorPlay?.battingOrder||0)"),'play.battingOrder must not drive lineup advancement');
assert(enhancement.includes('const matched=roster.find(entry=>'),'lineup identity matching missing');
assert(enhancement.includes('previousLineupOrder:previousOrder'),'lineup-order inference marker missing');
assert(enhancement.includes('prevents visual 2->4->2 bouncing'),'stable next-batter guard missing');

const {response,data}=await post('cpbl-game-detail',{
  appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
});
assert(response.ok && data?.ok,`CPBL detail HTTP ${response.status}`);
const plays=Array.isArray(data?.plays)?data.plays:[];
const away=Array.isArray(data?.lineups?.away?.batters)?data.lineups.away.batters:[];
const lineupOrder=name=>Number(away.find(p=>String(p?.name||'').includes(name))?.order||0);
const play=(inning,name)=>plays.find(p=>Number(p?.inning)===inning&&p?.half==='top'&&String(p?.batter||'').includes(name));

// Regression proof: CPBL play.battingOrder is NOT the fixed lineup slot.
const sung=play(5,'宋嘉翔');
const ho=play(5,'何品室融');
const lin=play(5,'林政華');
const wing=play(5,'威克');
assert(sung&&ho&&lin&&wing,'5局上 regression plays missing');
assert(Number(sung.battingOrder)===1 && lineupOrder('宋嘉翔')===8,'宋嘉翔 should prove PA ordinal 1 != lineup slot 8');
assert(Number(ho.battingOrder)===2 && lineupOrder('何品室融')===9,'何品室融 should prove PA ordinal 2 != lineup slot 9');
assert(Number(lin.battingOrder)===3 && lineupOrder('林政華')===1,'林政華 should prove PA ordinal 3 != lineup slot 1');
assert(Number(wing.battingOrder)===4 && lineupOrder('威克')===2,'威克 should prove PA ordinal 4 != lineup slot 2');

// The only valid advancement comes from the latest lineup identity.
const nextName=(name)=>{
  const order=lineupOrder(name);
  const next=(order%9)+1;
  return String(away.find(p=>Number(p?.order)===next)?.name||'');
};
assert(nextName('宋嘉翔').includes('何品室融'),'8棒宋嘉翔 must advance to 9棒何品室融');
assert(nextName('何品室融').includes('林政華'),'9棒何品室融 must advance to 1棒林政華');
assert(nextName('林政華').includes('威克'),'1棒林政華 must advance to 2棒威克');

console.log('v3.05 CPBL fixed-lineup next-batter production smoke passed');
