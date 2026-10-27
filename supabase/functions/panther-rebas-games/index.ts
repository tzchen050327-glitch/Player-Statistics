// Official 2026 Black Panther Cup handbook game discovery and score feed.
// Restrict to one tournament, only expose compact single-day records.
const ORIGIN="https://blackpanthercup.rebas.tw";
const BASE_HEADERS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Cache-Control":"public,max-age=60,s-maxage=60","X-Content-Type-Options":"nosniff"};
let lastGames:any[]=[],validUntil=0;
function output(body:unknown,status=200){return Response.json(body,{status,headers:BASE_HEADERS})}
function isMatch(item:any){return item?.season?.uniqid==="blackpanthercup-2026-14"&&/^[A-Za-z0-9_-]{3,14}$/.test(item?.uniqid||"")}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:BASE_HEADERS});
 if(req.method!=="GET")return output({error:"GET only"},405);
 const params=new URL(req.url).searchParams;
 const date=params.get("date")||"",through=params.get("through")||"";
 const validDate=/^2026-(?:10-(?:2[5-9]|3[01])|11-(?:0[1-9]|[12][0-9]))$/;
 if(!(date&&!through&&validDate.test(date))&&!(through&&!date&&validDate.test(through)))return output({error:"Invalid 2026 Panther Cup date/through"},400);
 try{
  if(Date.now()>validUntil||!lastGames.length){
   const upstream=await fetch(ORIGIN+"/api/games",{signal:AbortSignal.timeout(14000),headers:{"Accept":"application/json"}});
   if(!upstream.ok)return output({available:false,error:"Source HTTP "+upstream.status},502);
   const items=await upstream.json();
   if(!Array.isArray(items))return output({available:false,error:"Source format unavailable"},502);
   lastGames=items.filter(isMatch);
   validUntil=Date.now()+120000;
  }
  const gameDate=(x:any)=>String(x?.info?.scheduled_start_at||"").slice(0,10).replaceAll("/","-");
  const records=lastGames.filter(x=>date?gameDate(x)===date:gameDate(x)>="2026-10-25"&&gameDate(x)<=through).map(x=>{
   const status=String(x.info.status||"").toUpperCase();
   const started=Boolean(x.info.started_at||x.info.time?.started_at);
   const finished=status==="FINISHED";
   const active=finished||(started&&["PLAYING","LIVE","IN_PROGRESS","ONGOING"].includes(status));
   const side=(s:any)=>({team:String(s?.team||""),score:active?Number(s?.runs||0):null,
    hits:active?Number(s?.hits||0):null,errors:active?Number(s?.errors||0):null,
    innings:Array.isArray(s?.scores)?s.scores.slice(0,12):[]});
   return {id:x.uniqid,date:gameDate(x),time:String(x.info.scheduled_start_at||"").slice(11,16),
     home:side(x.home),away:side(x.away),status:finished?"final":active?"live":"scheduled",
     source:ORIGIN+"/game/"+x.uniqid,boxAvailable:finished&&x.info.stats_completeness!=="NONE",
     pbpAvailable:!!(x.home?.record_pbp||x.away?.record_pbp)};
  });
  return output({available:true,...(date?{date}:{through}),source:ORIGIN+"/api/games",checkedAt:new Date().toISOString(),gameCount:records.length,games:records});
 }catch(error){return output({available:false,error:String(error).slice(0,150),date},502)}
});
