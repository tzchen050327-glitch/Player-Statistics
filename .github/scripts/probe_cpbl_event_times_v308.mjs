const BASE='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1';
const APP_KEY='TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
const r=await fetch(`${BASE}/cpbl-game-detail-source`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appKey:APP_KEY,action:'game-detail',league:'CPBL',date:'2026-09-14',gameId:'280',kindCode:'A',status:'final'}),signal:AbortSignal.timeout(55000)});
const d=await r.json();
if(!r.ok||!d?.ok) throw new Error(JSON.stringify(d));
const plays=Array.isArray(d.plays)?d.plays:[];
const parse=s=>{const t=Date.parse(String(s||''));return Number.isFinite(t)?t:null};
const rows=[];let prev=null;
for(let i=0;i<plays.length;i++){
  const p=plays[i];
  const t=parse(p.sourceUpdatedAt||p.sourceCreatedAt);
  rows.push({n:i+1,inn:`${p.inning}${p.half==='top'?'上':'下'}`,batter:p.batter||'',result:p.result||'',create:p.sourceCreatedAt||'',update:p.sourceUpdatedAt||'',rowstamp:p.sourceRowstamp||'',deltaSec:prev!==null&&t!==null?Math.round((t-prev)/1000):null,editSec:parse(p.sourceCreatedAt)!==null&&parse(p.sourceUpdatedAt)!==null?Math.round((parse(p.sourceUpdatedAt)-parse(p.sourceCreatedAt))/1000):null});
  if(t!==null) prev=t;
}
console.log('EVENT_ROWS_START');
for(const x of rows) console.log([x.n,x.inn,x.batter,x.result,x.create,x.update,x.deltaSec??'',x.editSec??'',x.rowstamp].join('\t'));
console.log('EVENT_ROWS_END');
const deltas=rows.map(x=>x.deltaSec).filter(x=>Number.isFinite(x)&&x>=0);
const sorted=[...deltas].sort((a,b)=>a-b);
const q=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]:null;
const sameSecond=deltas.filter(x=>x===0).length;
const under5=deltas.filter(x=>x<=5).length;
const under10=deltas.filter(x=>x<=10).length;
const under30=deltas.filter(x=>x<=30).length;
const over120=deltas.filter(x=>x>=120).length;
const edits=rows.filter(x=>Number.isFinite(x.editSec)&&x.editSec!==0);
const grouped=new Map();
for(const x of rows){const key=x.update||x.create||'';if(!key)continue;grouped.set(key,(grouped.get(key)||0)+1)}
const batches=[...grouped.entries()].filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]);
console.log('SUMMARY',JSON.stringify({plays:rows.length,intervals:deltas.length,min:sorted[0]??null,p25:q(.25),median:q(.5),p75:q(.75),p90:q(.9),max:sorted.at(-1)??null,sameSecond,under5,under10,under30,over120,editedEvents:edits.length,batchTimestampGroups:batches.slice(0,20)},null,2));
console.log('LARGEST_GAPS',JSON.stringify(rows.filter(x=>Number.isFinite(x.deltaSec)).sort((a,b)=>b.deltaSec-a.deltaSec).slice(0,12),null,2));
console.log('EDITED_EVENTS',JSON.stringify(edits.slice(0,20),null,2));
console.log('SOURCE_TIMING',JSON.stringify(d.sourceTiming||{},null,2));
