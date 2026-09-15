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
assert(version.version==='v3.07',`expected v3.07, got ${version.version}`);
const enhancement=await fs.readFile('game-detail-enhancement.js','utf8');
assert(enhancement.includes('function reconciledBattingStats'),'final batting reconciliation helper missing');
assert(enhancement.includes('gameHomeRuns'),'gameHomeRuns reconciliation missing');
assert(enhancement.includes('finalStatsReconciled:true'),'reconciliation marker missing');
assert(enhancement.includes('formatAverage(hits,ab,sourceAvg)'),'final AVG reconstruction missing');

const {response,data}=await post('cpbl-game-detail',{
  appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'final',force:false
});
assert(response.ok && data?.ok,`CPBL final detail HTTP ${response.status}`);
assert(String(data?.status||'').toLowerCase()==='final','expected final game');

const away=Array.isArray(data?.lineups?.away?.batters)?data.lineups.away.batters:[];
const liang=away.find(p=>String(p?.name||'').includes('梁家榮'));
assert(liang,'梁家榮 final lineup row missing');

const num=v=>Number(v??0)||0;
assert(num(liang.homeRuns)===0,'regression fixture changed: final base HR should still be pregame 0');
assert(num(liang.gameHomeRuns)===1,'梁家榮 gameHomeRuns must be 1');
assert(num(liang.hits)===44 && num(liang.gameHits)===2,'梁家榮 hit reconciliation fixture mismatch');
assert(num(liang.rbi)===18 && num(liang.gameRbi)===1,'梁家榮 RBI reconciliation fixture mismatch');
assert(num(liang.ab)===171 && num(liang.gameAb)===3,'梁家榮 AB reconciliation fixture mismatch');

const finalAb=num(liang.ab)+num(liang.gameAb);
const finalHits=num(liang.hits)+num(liang.gameHits);
const finalHr=num(liang.homeRuns)+num(liang.gameHomeRuns);
const finalRbi=num(liang.rbi)+num(liang.gameRbi);
const finalAvg=(finalHits/finalAb).toFixed(3).replace(/^0/,'');
assert(finalAb===174,'梁家榮 reconciled AB should be 174');
assert(finalHits===46,'梁家榮 reconciled H should be 46');
assert(finalHr===1,'梁家榮 reconciled HR should stay 1 after final');
assert(finalRbi===19,'梁家榮 reconciled RBI should be 19');
assert(finalAvg==='.264',`梁家榮 reconciled AVG should be .264, got ${finalAvg}`);

const plays=Array.isArray(data?.plays)?data.plays:[];
const homer=plays.find(p=>Number(p?.inning)===4&&p?.half==='top'&&String(p?.batter||'').includes('梁家榮'));
assert(homer&&/全壘打/.test(String(homer?.result||'')),'梁家榮 4局上全壘打 play missing');

console.log('v3.07 CPBL final batting totals reconciliation production smoke passed');
