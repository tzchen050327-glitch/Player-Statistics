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
assert(version.version==='v3.06',`expected v3.06, got ${version.version}`);

const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
const realtime=await fs.readFile('cpbl-realtime.js','utf8');
assert(enhancement.includes('function visibleInningCells'),'scoreboard visibility helper missing');
assert(enhancement.includes("if(inningNo>info.inning) return ''"),'future innings must stay blank');
assert(enhancement.includes("if(info.half==='top' && sideHalf==='bottom') return ''"),'bottom half must stay blank before it starts');
assert(enhancement.includes("return currentHalfComplete ? 0 : ''"),'active scoreless half must stay blank until three outs');
assert(realtime.includes('async function refreshFromRealtimeSignal'),'realtime push refresh helper missing');
assert(realtime.includes('const published=await readPublished(current.date,current.gameId,current.kindCode)'),'realtime signal must immediately read canonical published payload');
assert(realtime.includes('void refreshFromRealtimeSignal(payload?.new)'),'postgres change must drive the immediate refresh');
assert(realtime.includes('12000'),'12-second watchdog fallback missing');

// Mirror the production visibility rule with deterministic cases.
function visible({values,side,inning,half,total,lastSameHalf=true,lastOuts=0}){
  const innings=['1','2','3','4','5','6','7','8','9'];
  const raw=innings.map((_,i)=>values?.[i]??'');
  const sideHalf=side==='away'?'top':'bottom';
  const currentHalfComplete=lastSameHalf&&lastOuts>=3;
  const numericTotal=Number(total);
  const priorRuns=raw.reduce((sum,value,index)=>{
    const inningNo=index+1;
    const cell=Number(String(value??'').trim());
    return inningNo<inning&&Number.isFinite(cell)?sum+cell:sum;
  },0);
  const inferredCurrentRuns=Number.isFinite(numericTotal)?Math.max(0,numericTotal-priorRuns):0;
  return raw.map((value,index)=>{
    const inningNo=index+1;
    if(inningNo>inning) return '';
    if(inningNo<inning) return value;
    if(half==='top'&&sideHalf==='bottom') return '';
    if(half==='bottom'&&sideHalf==='top') return value;
    const cell=Number(String(value??'').trim());
    if(Number.isFinite(cell)&&cell>0) return value;
    if(inferredCurrentRuns>0) return inferredCurrentRuns;
    return currentHalfComplete?0:'';
  });
}

// 5th bottom just started: away top-half zero is official, home zero is not yet official, 6th is future.
{
  const away=visible({values:[0,0,0,1,0,0,'','',''],side:'away',inning:5,half:'bottom',total:1,lastOuts:0});
  const home=visible({values:[0,1,0,0,0,'','','',''],side:'home',inning:5,half:'bottom',total:1,lastOuts:0});
  assert(away[4]===0,'away 5th top completed zero should be visible');
  assert(home[4]==='','home active scoreless 5th should stay blank');
  assert(away[5]===''&&home[5]==='','future 6th inning must stay blank');
}

// Active half scores: show it immediately.
{
  const home=visible({values:[0,1,0,0,1,'','','',''],side:'home',inning:5,half:'bottom',total:2,lastOuts:1});
  assert(Number(home[4])===1,'active inning run should appear immediately');
}

// Scoreless active half only becomes 0 after the third out.
{
  const home=visible({values:[0,1,0,0,0,'','','',''],side:'home',inning:5,half:'bottom',total:1,lastOuts:3});
  assert(home[4]===0,'scoreless half should finalize to zero at three outs');
}

// Keep real CPBL detail path healthy and retain the lineup-order regression.
{
  const {response,data}=await post('cpbl-game-detail',{
    appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'scheduled',force:false
  });
  assert(response.ok&&data?.ok,`CPBL detail HTTP ${response.status}`);
  const away=Array.isArray(data?.lineups?.away?.batters)?data.lineups.away.batters:[];
  const order=name=>Number(away.find(p=>String(p?.name||'').includes(name))?.order||0);
  assert(order('林政華')===1&&order('威克')===2,'CPBL fixed lineup order regression');
}

console.log('v3.06 realtime push refresh and scoreboard timing smoke passed');
