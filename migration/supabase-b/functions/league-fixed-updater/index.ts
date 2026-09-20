const APP_KEY='TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE_ROLE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const KBO_URL=`${SUPABASE_URL}/functions/v1/kbo-live-games`;
const MLB='https://statsapi.mlb.com/api/v1';
const DBH={apikey:SERVICE_ROLE,authorization:`Bearer ${SERVICE_ROLE}`,'content-type':'application/json'};
const CORS={'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, authorization','content-type':'application/json; charset=utf-8'};
const reply=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:CORS});
const terminal=(s:any)=>['final','cancelled','postponed'].includes(String(s||'').toLowerCase());
const score=(v:any)=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const clean=(v:any)=>String(v??'').trim().replace(/\s+/g,' ');
async function rest(path:string,init:RequestInit={}){return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{...DBH,...(init.headers||{})}})}
async function rows(path:string){const r=await rest(path);if(!r.ok)throw new Error(`DB ${r.status}: ${await r.text()}`);const j=await r.json().catch(()=>[]);return Array.isArray(j)?j:[]}
async function rpc(name:string,body:any){const r=await rest(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw new Error(`${name} ${r.status}: ${t}`);try{return JSON.parse(t)}catch{return t}}
function zoneNow(zone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';return{date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour')),minute:Number(get('minute')),second:Number(get('second'))}}
function beforeTenDelay(zone:string){const z=zoneNow(zone);const sec=z.hour*3600+z.minute*60+z.second;return sec<36000?(36000-sec)*1000:0}
function kboStart(date:string,time:any){const m=clean(time).match(/(\d{1,2}):(\d{2})/);return m?Date.parse(`${date}T${String(m[1]).padStart(2,'0')}:${m[2]}:00+09:00`):NaN}
function nextDue(statuses:any[],starts:number[],now=Date.now()){
  // Once a game is live (or suspended), refresh the shared schedule every 2 minutes.
  if(statuses.some(s=>String(s).toLowerCase()==='live')) return now+120_000;
  if(statuses.some(s=>String(s).toLowerCase()==='suspended')) return now+120_000;
  let best=Infinity;
  for(let i=0;i<starts.length;i++){
    const ms=starts[i];
    const status=String(statuses[i]||'scheduled').toLowerCase();
    if(terminal(status)||!Number.isFinite(ms))continue;
    const d=ms-now;
    let n:number;
    // T-30: one verification fetch. T-2 onward: enter 2-minute cadence.
    if(d<=2*60_000)n=now+120_000;
    else if(d<=30*60_000)n=ms-2*60_000;
    else n=ms-30*60_000;
    if(n<=now)n=now+120_000;
    best=Math.min(best,n);
  }
  if(Number.isFinite(best))return best;
  if(statuses.length&&statuses.every(terminal))return now+12*60*60_000;
  // No games found: avoid polling all day; one later safety check is enough.
  return now+12*60*60_000;
}
async function state(league:string){return (await rows(`league_fixed_refresh_state?league=eq.${league}&select=*`))[0]||null}
async function saveState(league:string,date:string,next:number,lastError:string|null=null){const r=await rest('league_fixed_refresh_state?on_conflict=league',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({league,game_date:date,next_refresh_at:new Date(next).toISOString(),last_refresh_at:lastError?undefined:new Date().toISOString(),last_error:lastError,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(`state ${r.status}: ${await r.text()}`)}
async function fetchKbo(date:string){const r=await fetch(KBO_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'daily-games',league:'KBO',date})});const j=await r.json().catch(()=>({}));if(!r.ok||!j?.ok)throw new Error(j?.error||`KBO ${r.status}`);const games=Array.isArray(j.games)?j.games:[];return{games,starts:games.map((g:any)=>kboStart(date,g?.time)),statuses:games.map((g:any)=>g?.status)}}
function mlbLabel(g:any,status:string){if(status!=='live')return'';const l=g?.linescore||{};const inn=Number(l?.currentInning);if(!inn)return'';const st=String(l?.inningState||l?.inningHalf||'').toLowerCase();if(st.includes('top'))return`${inn}局上`;if(st.includes('bottom'))return`${inn}局下`;if(st.includes('middle'))return`${inn}局中`;if(st.includes('end'))return`${inn}局結束`;return`${inn}局`}
async function fetchMlb(date:string){const r=await fetch(`${MLB}/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=linescore,team,venue`,{headers:{accept:'application/json'}});if(!r.ok)throw new Error(`MLB ${r.status}`);const j=await r.json();const raw=(j?.dates||[]).flatMap((d:any)=>d?.games||[]);const games:any[]=[],starts:number[]=[],statuses:string[]=[];for(const g of raw){const x=String(g?.status?.abstractGameState||g?.status?.detailedState||'');let status=/Final|Completed/i.test(x)?'final':/Live|In Progress|Warmup/i.test(x)?'live':'scheduled';if(/Postponed|Cancelled/i.test(x))status='cancelled';if(/Suspended/i.test(x))status='suspended';const start=Date.parse(String(g?.gameDate||''));starts.push(start);statuses.push(status);games.push({away:g?.teams?.away?.team?.name||'',home:g?.teams?.home?.team?.name||'',awayScore:score(g?.teams?.away?.score),homeScore:score(g?.teams?.home?.score),status,time:'',venue:g?.venue?.name||'',id:String(g?.gamePk||''),inningLabel:mlbLabel(g,status)})}return{games,starts,statuses}}
async function publish(league:string,date:string,games:any[],next:number){const out=await rpc('publish_league_schedule_cache',{p_league:league,p_game_date:date,p_payload:{games},p_refresh_after:new Date(next).toISOString(),p_source:'official-fixed-updater'});return Array.isArray(out)?out[0]||{}:out||{}}
async function tickLeague(league:'KBO'|'MLB',zone:string){const z=zoneNow(zone),date=z.date,st=await state(league),now=Date.now();
  // On a new league-local date, do one discovery fetch to learn the day's first start.
  // After that, sleep until T-30; there is no fixed 10:00 local wake-up anymore.
  const stateDate=String(st?.game_date||'');const dueAt=Date.parse(String(st?.next_refresh_at||''));if(stateDate===date&&Number.isFinite(dueAt)&&dueAt>now)return{league,date,sleeping:true,nextRefreshAt:new Date(dueAt).toISOString()};
  try{const src=league==='KBO'?await fetchKbo(date):await fetchMlb(date);const next=nextDue(src.statuses,src.starts,Date.now());const pub=await publish(league,date,src.games,next);await saveState(league,date,next,null);return{league,date,refreshed:true,changed:Boolean(pub?.changed),revision:Number(pub?.revision||0),games:src.games.length,nextRefreshAt:new Date(next).toISOString()}}catch(e){const msg=e instanceof Error?e.message:String(e),next=Date.now()+2*60_000;await saveState(league,date,next,msg).catch(()=>{});return{league,date,refreshed:false,error:msg,nextRefreshAt:new Date(next).toISOString()}}
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return reply({ok:false,error:'POST only'},405);try{const body=await req.json().catch(()=>({}));if(body?.appKey!==APP_KEY)return reply({ok:false,error:'Forbidden'},403);const requested=String(body?.league||'').toUpperCase();let results:any[]=[];if(requested==='KBO')results=[await tickLeague('KBO','Asia/Seoul')];else if(requested==='MLB')results=[await tickLeague('MLB','America/New_York')];else results=await Promise.all([tickLeague('KBO','Asia/Seoul'),tickLeague('MLB','America/New_York')]);return reply({ok:true,mode:'scheduled-due-only',rules:{live:{KBO:120,MLB:120},pregame30:'T-30 one verification check',pregame2:'T-2 begins 120-second cadence',start:'120-second cadence while live/suspended',dailyDiscovery:'one fetch after league-local date rollover',idle:'database cron does not call this function until due'},results})}catch(e){return reply({ok:false,error:e instanceof Error?e.message:String(e)},500)}});
