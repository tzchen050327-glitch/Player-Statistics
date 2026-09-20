const CORS={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'content-type, x-baseball-proxy-key',
  'content-type':'application/json; charset=utf-8'
};
const PROXY_KEY='__BASEBALL_PROXY_KEY__';
const MLB_BASE='https://statsapi.mlb.com/api/v1';
const MLB_SPORT=1;
const MILB_SPORTS=[11,12,13,14,15,16,21];
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36';
const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
function clean(v:any){return String(v??'').replace(/\s+/g,' ').trim();}
function dateOnly(v:any){const m=clean(v).match(/(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:'';}
function levelLabel(id:any){
  const map:Record<number,string>={1:'MLB',11:'AAA',12:'AA',13:'High-A',14:'A',15:'Short-A',16:'Rookie',21:'MiLB'};
  return map[Number(id)||0]||(Number(id)?'MiLB':'');
}
async function officialText(url:string){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),12000);
  try{
    const sbUrl=Deno.env.get('SUPABASE_URL')||'';
    const sbKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
    if(sbUrl&&sbKey){
      try{
        const rpc=await fetch(sbUrl+'/rest/v1/rpc/baseball_official_http_get',{
          method:'POST',
          headers:{'content-type':'application/json','apikey':sbKey},
          body:JSON.stringify({p_url:url}),signal:ctrl.signal
        });
        if(rpc.ok){
          const value=await rpc.json();
          if(typeof value==='string'&&value.length)return value;
        }
      }catch(e){console.warn('MLB official DB proxy failed',e)}
    }
    const r=await fetch(url,{headers:{'user-agent':UA,'accept':'application/json'},cache:'no-store',signal:ctrl.signal});
    if(!r.ok)throw new Error(`MLB Stats API HTTP ${r.status}`);
    return await r.text();
  }finally{clearTimeout(timer);}
}
async function getJson(url:string){return JSON.parse(await officialText(url));}
function splitDate(split:any){return dateOnly(split?.date||split?.game?.gameDate||split?.gameDate||'');}
function splitSportId(split:any,fallback=0){return Number(split?.sport?.id||split?.league?.sport?.id||split?.team?.sport?.id||split?.__sportId||fallback)||0;}
function normalizeSplit(split:any,fallbackSportId=0,role=''){
  const sportId=splitSportId(split,fallbackSportId);
  return {
    date:splitDate(split),
    sportId,
    leagueLevel:levelLabel(sportId),
    team:clean(split?.team?.name||''),
    opponent:clean(split?.opponent?.name||''),
    gamePk:String(split?.game?.gamePk||split?.gamePk||''),
    role
  };
}
async function directSplits(id:string,group:string,year:number,sports:number[]){
  const qs=new URLSearchParams({stats:'gameLog',group,season:String(year),gameType:'R'});
  if(sports.length)qs.set('sportIds',sports.join(','));
  const data=await getJson(`${MLB_BASE}/people/${encodeURIComponent(id)}/stats?${qs.toString()}`);
  return (data?.stats||[]).flatMap((b:any)=>Array.isArray(b?.splits)?b.splits:[]);
}
async function hydratedSplits(id:string,group:string,year:number,sportId:number){
  const hydrate=`stats(group=[${group}],type=[gameLog],season=${year},sportId=${sportId},gameType=[R])`;
  const data=await getJson(`${MLB_BASE}/people/${encodeURIComponent(id)}?hydrate=${encodeURIComponent(hydrate)}`);
  const person=data?.people?.[0];
  return (person?.stats||[]).flatMap((b:any)=>Array.isArray(b?.splits)?b.splits:[]).map((s:any)=>({...s,__sportId:sportId}));
}
async function groupSplits(id:string,group:string,year:number,sports:number[]){
  try{
    const rows=await directSplits(id,group,year,sports);
    if(rows.length)return rows;
  }catch(e){console.warn('direct gameLog failed',group,year,e)}
  if(sports.length===1&&sports[0]===1)return[];
  const batches=await Promise.all(sports.map(async sid=>{
    try{return await hydratedSplits(id,group,year,sid)}catch{return[];}
  }));
  return batches.flat();
}
async function latestForYear(id:string,year:number,targetDate:string,sports:number[]){
  const groups=['hitting','pitching','fielding'];
  const results=await Promise.all(groups.map(g=>groupSplits(id,g,year,sports)));
  const candidates:any[]=[];
  for(let i=0;i<groups.length;i++){
    for(const split of results[i]||[]){
      const row=normalizeSplit(split,sports.length===1?sports[0]:0,groups[i]);
      if(row.date&&row.date<targetDate)candidates.push(row);
    }
  }
  candidates.sort((a,b)=>b.date.localeCompare(a.date));
  if(!candidates.length)return null;
  const latestDate=candidates[0].date;
  const same=candidates.filter(x=>x.date===latestDate);
  const preferred=same.find(x=>x.role==='hitting')||same.find(x=>x.role==='pitching')||same[0];
  const roles=[...new Set(same.map(x=>x.role==='hitting'?'hitter':x.role==='pitching'?'pitcher':'fielding'))];
  return {...preferred,roles};
}
async function lastAppearance(provider:string,id:string,targetDate:string){
  const p=provider.toUpperCase();
  const targetYear=Number(targetDate.slice(0,4));
  const sets=p==='MLB'?[[MLB_SPORT]]:p==='MILB'?[MILB_SPORTS]:[[MLB_SPORT],MILB_SPORTS];
  for(let year=targetYear;year>=targetYear-3;year--){
    const found=(await Promise.all(sets.map(s=>latestForYear(id,year,targetDate,s)))).filter(Boolean) as any[];
    if(found.length){
      found.sort((a,b)=>b.date.localeCompare(a.date)||(a.sportId===1?-1:1));
      return found[0];
    }
  }
  return null;
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return send({ok:false,error:'POST only'},405);
  if(req.headers.get('x-baseball-proxy-key')!==PROXY_KEY)return send({ok:false,error:'Forbidden'},403);
  try{
    const body=await req.json();
    if(String(body.action||'')!=='last-appearance')return send({ok:false,error:'unknown action'},400);
    const provider=clean(body.provider).toUpperCase(),id=clean(body.id),date=clean(body.date);
    if(!['US','MLB','MILB'].includes(provider)||!id||!/^\d{4}-\d{2}-\d{2}$/.test(date))return send({ok:false,error:'provider/id/date required'},400);
    return send({ok:true,lastAppearance:await lastAppearance(provider,id,date)});
  }catch(e){return send({ok:false,error:e instanceof Error?e.message:String(e)},500);}
});