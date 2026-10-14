// CPBL team-vs-team season pitching splits. Final game box scores only; backend cached.
// Does not alter live updating or existing single-player matchup APIs.
const SB_URL=Deno.env.get('SUPABASE_URL')||'';
const SB_SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const APP_KEY_SHA256='fd2a2f093be5bb84ab00c6724a4f73af370908d2a1157f958ce115738fdfd6a8';
const STATS='https://stats.cpbl.com.tw/api/proxy/v1';
const TEAMS=new Set(['AAA','ACN','ADD','AEO','AJL','AKP']);
const HEADERS={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36','accept':'application/json','accept-language':'zh-TW,zh;q=0.9'};
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST, OPTIONS','content-type':'application/json; charset=utf-8'};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const field=(r:any,...keys:string[])=>{for(const k of keys)if(r?.[k]!==undefined&&r[k]!==null&&r[k]!=='')return r[k];return null};
const text=(v:any)=>String(v??'').trim();
const sleep=(ms:number)=>new Promise(ok=>setTimeout(ok,ms));
async function digest(v:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function sbHeaders(extra:Record<string,string>={}){if(!SB_URL||!SB_SERVICE)throw new Error('資料服務未設定');return{'apikey':SB_SERVICE,'authorization':'Bearer '+SB_SERVICE,...extra}}
async function dbRead(path:string){
  const r=await fetch(SB_URL+'/rest/v1/'+path,{headers:sbHeaders({'accept':'application/json'})});
  if(!r.ok)throw new Error('資料快取讀取失敗：'+r.status);
  return await r.json();
}
async function dbUpsert(table:string,data:any,onConflict:string){
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?on_conflict='+onConflict,{method:'POST',headers:sbHeaders({'content-type':'application/json','prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(data)});
  if(!r.ok)throw new Error('資料快取寫入失敗：'+r.status);
}
async function stats(path:string){
  const r=await fetch(STATS+path,{headers:HEADERS,signal:AbortSignal.timeout(13000)});
  if(!r.ok)throw new Error('CPBL 官方資料讀取失敗：'+r.status);
  const j=await r.json();return j?.Data??j?.data??j;
}
function taiwanParts(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'numeric'}).formatToParts(new Date());return{year:Number(parts.find(x=>x.type==='year')?.value),month:Number(parts.find(x=>x.type==='month')?.value)}}
function normalizeGame(g:any){
  const id=text(g?.GameId),away=text(g?.Visiting?.Team?.Code||g?.VisitingTeamCode).slice(0,3),home=text(g?.Home?.Team?.Code||g?.HomeTeamCode).slice(0,3);
  return {fullGameId:id,date:text(g?.PreExeDate||g?.GameDate||g?.GameDateTimeS).slice(0,10),status:text(g?.GameStatus||g?.GameStatusName).toUpperCase(),awayCode:away,homeCode:home};
}
async function seasonGames(year:number){
  const key=year+'|A',now=Date.now();
  const cached=await dbRead('cpbl_matchup_schedule_cache?cache_key=eq.'+encodeURIComponent(key)+'&select=games,fetched_at&limit=1');
  if(cached[0]?.fetched_at&&now-Date.parse(cached[0].fetched_at)<12*3600000&&Array.isArray(cached[0]?.games)&&cached[0].games.length)return cached[0].games;
  const tw=taiwanParts(),months=[] as number[];
  for(let m=3;m<=(year===tw.year?Math.min(11,Math.max(3,tw.month)):11);m++)months.push(m);
  const games=new Map<string,any>();
  try{
    for(let i=0;i<months.length;i+=3){
      const groups=await Promise.all(months.slice(i,i+3).map(async m=>{
        const q=new URLSearchParams({kindCode:'A',year:String(year),month:String(m)});
        const d=await stats('/games/schedule?'+q.toString());
        return Array.isArray(d?.Games)?d.Games:[];
      }));
      for(const group of groups)for(const src of group){const g=normalizeGame(src);if(g.fullGameId)games.set(g.fullGameId,g)}
      if(i+3<months.length)await sleep(100);
    }
  }catch(e){
    if(Array.isArray(cached[0]?.games)&&cached[0].games.length)return cached[0].games;
    throw e;
  }
  if(!games.size){
    if(Array.isArray(cached[0]?.games)&&cached[0].games.length)return cached[0].games;
    throw new Error('找不到此年度官方賽程，無法確認對戰涵蓋範圍');
  }
  const rows=[...games.values()];
  await dbUpsert('cpbl_matchup_schedule_cache',{cache_key:key,game_year:year,kind_code:'A',games:rows,fetched_at:new Date().toISOString(),updated_at:new Date().toISOString()},'cache_key');
  return rows;
}
function officialPitchers(g:any,scheduled:any){
  const result=[] as any[];
  for(const [side,key,teamCode] of [['away','Visiting',scheduled.awayCode],['home','Home',scheduled.homeCode]] as const){
    const rows=Array.isArray(g?.[key]?.Pitchers)?g[key].Pitchers:[];
    for(let i=0;i<rows.length;i++){
      const p=rows[i],acnt=text(field(p,'PitcherAcnt','Acnt')||p?.Player?.Acnt||p?.Pitcher?.Acnt),name=text(field(p,'PitcherName','PlayerName','Name')||p?.Player?.Name||p?.Pitcher?.Name).replace(/^[#＃*＊\s]+/,'');
      const innings=Math.max(0,Math.floor(num(field(p,'InningPitchedCnt'))));
      const thirds=Math.max(0,Math.min(2,Math.floor(num(field(p,'InningPitchedDiv3Cnt')))));
      const outs=innings*3+thirds,pitches=num(field(p,'PitchCnt'));
      if(!acnt||!name||(!outs&&!pitches))continue;
      const decision=text(field(p,'GameResult')).toUpperCase();
      const wp=text(g?.WinningPitcher?.Acnt),lp=text(g?.LoserPitcher?.Acnt);
      result.push({acnt,name,team:teamCode,side,starter:i===0,g:1,gs:i===0?1:0,outs,
        w:wp?Number(wp===acnt):Number(decision==='W'),l:lp?Number(lp===acnt):Number(decision==='L'),
        sv:Number(text(field(p,'IsSaveOK'))==='1'||text(g?.Closer?.Acnt)===acnt),
        hld:num(field(p,'ReliefPointCnt'))>0?1:0,
        h:num(field(p,'HittingCnt')),bb:num(field(p,'BasesONBallsCnt'))+num(field(p,'IntentionalBasesONBallsCnt')),
        hbp:num(field(p,'HitBYPitchCnt')),so:num(field(p,'StrikeOutCnt')),er:num(field(p,'EarnedRunCnt')),
        runs:num(field(p,'RunCnt')),hr:num(field(p,'HomeRunCnt','HomerunCnt','HR')),pitches});
    }
  }
  if(!result.length)throw new Error('官方單場投手紀錄為空');
  return result;
}
function blank(p:any){return{acnt:p.acnt,name:p.name,team:p.team,g:0,gs:0,outs:0,w:0,l:0,sv:0,hld:0,h:0,bb:0,hbp:0,so:0,er:0,runs:0,hr:0,pitches:0}}
function summarize(games:any[],club:string,role:string){
  const map=new Map<string,any>();
  for(const game of games)for(const p of game){
    if(p.team!==club||(role==='starter'&&!p.starter)||(role==='reliever'&&p.starter))continue;
    const key=p.acnt||p.name,old=map.get(key)||blank(p);
    for(const k of ['g','gs','outs','w','l','sv','hld','h','bb','hbp','so','er','runs','hr','pitches'])old[k]+=num(p[k]);
    if(p.name)old.name=p.name;map.set(key,old);
  }
  return [...map.values()].map(p=>({...p,ip:Math.floor(p.outs/3)+'.'+p.outs%3,era:p.outs?Number((p.er*27/p.outs).toFixed(2)):null,whip:p.outs?Number(((p.h+p.bb)*3/p.outs).toFixed(2)):null}))
    .sort((a,b)=>b.outs-a.outs||b.so-a.so||a.name.localeCompare(b.name,'zh-Hant'));
}
async function matchup(teamA:string,teamB:string,year:number){
  const all=await seasonGames(year);
  const scheduled=all.filter(g=>{
    const a=text(g.awayCode),b=text(g.homeCode),status=text(g.status).toUpperCase();
    return ((a===teamA&&b===teamB)||(a===teamB&&b===teamA))&&/FINISHED|FINAL|COMPLETED/.test(status);
  }).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if(scheduled.length>36)throw new Error('單組交手場次超過安全上限');
  const fetched=[] as any[],missing=[] as any[];
  if(scheduled.length){
    const ids=scheduled.map(x=>x.fullGameId),query='cpbl_team_pitching_matchup_game_cache?select=full_game_id,pitching_rows&full_game_id=in.('+ids.join(',')+')';
    const cache=await dbRead(query),by=new Map(cache.map((r:any)=>[r.full_game_id,r.pitching_rows]));
    for(const g of scheduled) {
      const p=by.get(g.fullGameId);
      if(Array.isArray(p)&&p.length)fetched.push(p);
      else missing.push(g);
    }
  }
  let failures=0;
  for(let i=0;i<missing.length;i+=4){
    const batch=await Promise.allSettled(missing.slice(i,i+4).map(async g=>{
      const d=await stats('/games/'+encodeURIComponent(g.fullGameId));
      const raw=d?.Game??d;
      const rows=officialPitchers(raw,g);
      return{full_game_id:g.fullGameId,game_year:year,kind_code:'A',game_date:g.date||null,away_code:g.awayCode,home_code:g.homeCode,game_status:'FINISHED',pitching_rows:rows,updated_at:new Date().toISOString()};
    }));
    const succeed=[] as any[];
    for(const item of batch){if(item.status==='fulfilled'){succeed.push(item.value);fetched.push(item.value.pitching_rows)}else{failures++;console.warn('team matchup game unavailable',String(item.reason).slice(0,160))}}
    if(succeed.length){try{await dbUpsert('cpbl_team_pitching_matchup_game_cache',succeed,'full_game_id')}catch(e){console.error('team matchup cache write',e)}}
    if(i+4<missing.length)await sleep(120);
  }
  const byRole={} as Record<string,any>;
  for(const role of ['all','starter','reliever'])byRole[role]=[
    {team:teamA,rows:summarize(fetched,teamA,role)},
    {team:teamB,rows:summarize(fetched,teamB,role)}
  ];
  return{year,kindCode:'A',teamA,teamB,games:scheduleCount(scheduled),completedGames:fetched.length,failedGames:failures,complete:failures===0,byRole,source:'CPBL 官方逐場投手紀錄',updatedAt:new Date().toISOString()};
}
function scheduleCount(games:any[]){return games.length}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return respond({ok:false,error:'POST only'},405);
  try{
    const body=await req.json(),appKey=text(body?.appKey);
    if(!appKey||await digest(appKey)!==APP_KEY_SHA256)return respond({ok:false,error:'Forbidden'},403);
    const teamA=text(body.teamA).slice(0,3).toUpperCase(),teamB=text(body.teamB).slice(0,3).toUpperCase(),year=Number(body.year);
    if(!TEAMS.has(teamA)||!TEAMS.has(teamB)||teamA===teamB)return respond({ok:false,error:'請選擇兩支不同的中職球隊'},400);
    const now=taiwanParts().year;
    if(!Number.isInteger(year)||year<1990||year>now)return respond({ok:false,error:'年份不支援'},400);
    const data=await matchup(teamA,teamB,year);
    return respond({ok:true,...data});
  }catch(e){
    console.error('team matchup error',String(e).slice(0,240));
    return respond({ok:false,error:e instanceof Error?e.message:'對戰資料查詢失敗'},502);
  }
});