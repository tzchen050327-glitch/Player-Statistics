// Read-only 2026 Black Panther Cup record parser.
// Public pages of the official site's linked Rebas competition handbook.
// Fixed host, bounded game ID, upstream 4-minute cache; no database calls.
const REBAS="https://blackpanthercup.rebas.tw";
const CACHE_TTL=240000;
type StatCell={text:string,href?:string};
type StatTable={headers:string[],rows:StatCell[][]};
const cache=new Map<string,{expires:number,data:unknown}>();
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Cache-Control":"public,max-age=120,s-maxage=120","X-Content-Type-Options":"nosniff"};
function reply(data:unknown,status=200){return Response.json(data,{status,headers})}
function decode(s:string){return s.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'")}
function text(s:string){return decode(s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim())}
function cells(row:string):StatCell[]{return [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(m=>{const v:StatCell={text:text(m[1])};const link=m[1].match(/href=["'](\/player\/[A-Za-z0-9_-]{3,20})["']/);if(link)v.href=REBAS+link[1];return v})}
function tables(html:string){
 const all:StatTable[]=[];
 const seen=new Set<string>();
 for(const raw of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)){
  const rows=[...raw[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>cells(r[1])).filter(x=>x.length>1);
  if(rows.length<2)continue;
  const headers=rows[0].map(c=>c.text);
  if(!headers.includes("選手")||!(headers.includes("打數")||headers.includes("局數")))continue;
  const body=rows.slice(1).filter(row=>row.length===headers.length&&row[0]?.text);
  const table={headers,rows:body};
  const fingerprint=JSON.stringify(table);
  if(seen.has(fingerprint))continue;
  seen.add(fingerprint);all.push(table);
 }
 const batters=all.filter(t=>t.headers.includes("打數"));
 const pitchers=all.filter(t=>t.headers.includes("局數"));
 return {batters,pitchers};
}
function matchup(html:string){
 const noStyle=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"");
 // Score headline is a compact run of spans: away name, away score, state,
 // home score and home name. Do not infer "final" from numbers alone.
 const anchor=noStyle.indexOf(">完賽</span>");
 if(anchor<0)return null;
 const spans=[...noStyle.slice(Math.max(0,anchor-2300),anchor+2000).matchAll(/<span\b[^>]*>([^<]+)<\/span>/gi)].map(m=>text(m[1]));
 const pos=spans.indexOf("完賽");
 if(pos<2||pos+2>=spans.length)return null;
 const away=spans[pos-2],home=spans[pos+2],as=Number(spans[pos-1]),hs=Number(spans[pos+1]);
 if(!away||!home||!Number.isInteger(as)||!Number.isInteger(hs)||as<0||hs<0)return null;
 return {away,home,awayScore:as,homeScore:hs,status:"final"};
}
function lineScore(html:string,score:{awayScore:number,homeScore:number}){
 const noStyle=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"");
 const before=noStyle.slice(0,noStyle.indexOf("<table"));
 // R/H/E are shown next to nine inning cells, unused innings as "-".
 const rhead=before.indexOf(">R</p>");
 if(rhead<0)return null;
 const innings=before.slice(Math.max(0,rhead-12000),rhead);
 const awayBlock=innings.match(/<div class="css-674jbs">[\s\S]*?<div class="css-1c087lh">([\s\S]*?)<\/div>[\s\S]*?<div class="css-1h004tw">/);
 const away=awayBlock?[...awayBlock[0].matchAll(/<div class="css-1c087lh">([0-9-]+)<\/div>/g)].map(x=>x[1]):[];
 const homeBlock=innings.match(/<div class="css-1h004tw">([\s\S]*?)<\/div><\/div><\/div><div class="css-j7qwjs">/);
 const home=homeBlock?[...homeBlock[1].matchAll(/<div class="css-(?:1cdlxmi|1s12j40)">([0-9-]+)<\/div>/g)].map(x=>x[1]):[];
 const totals=before.slice(rhead,rhead+2600);
 const t=totals.match(/<div class="css-p65hq8">([\s\S]*?)<\/div><div class="css-11b9nfe">([\s\S]*?)<\/div>/);
 const vals=(chunk:string)=>[...chunk.matchAll(/<p\b[^>]*>(\d+)<\/p>/g)].map(x=>Number(x[1]));
 const a=t?vals(t[1]):[],b=t?vals(t[2]):[];
 if(a.length!==3||b.length!==3||a[0]!==score.awayScore||b[0]!==score.homeScore)return null;
 return {innings:[1,2,3,4,5,6,7,8,9],awayInnings:away.slice(0,9),homeInnings:home.slice(0,9),away:{r:a[0],h:a[1],e:a[2]},home:{r:b[0],h:b[1],e:b[2]}};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="GET")return reply({error:"GET only"},405);
 const u=new URL(req.url),id=u.searchParams.get("id")||"";
 if(!/^[a-zA-Z0-9_-]{3,14}$/.test(id))return reply({error:"Invalid game ID"},400);
 const cached=cache.get(id);
 if(cached&&cached.expires>Date.now())return reply(cached.data);
 try{
  const r=await fetch(REBAS+"/game/"+id,{signal:AbortSignal.timeout(12000),headers:{"Accept":"text/html","Accept-Language":"zh-TW"}});
  if(!r.ok)return reply({error:"Source HTTP "+r.status},502);
  const html=await r.text(),score=matchup(html);
  if(!score)return reply({error:"Game not final or score layout unavailable",source:REBAS+"/game/"+id,available:false},422);
  const parsed=tables(html);
  if(parsed.batters.length!==2||parsed.pitchers.length!==2)return reply({error:"Incomplete team statistics",source:REBAS+"/game/"+id,available:false,tables:{batters:parsed.batters.length,pitchers:parsed.pitchers.length}},422);
  const board=lineScore(html,score);
  const data={id,source:REBAS+"/game/"+id,competition:"2026 黑豹旗",checkedAt:new Date().toISOString(),
   ...score,lineScore:board,teams:[
    {name:score.away,side:"away",batting:parsed.batters[0],pitching:parsed.pitchers[0]},
    {name:score.home,side:"home",batting:parsed.batters[1],pitching:parsed.pitchers[1]}],
   pitchByPitchAvailable:!html.includes("本場比賽不支援逐球紀錄"),available:true};
  cache.set(id,{data,expires:Date.now()+CACHE_TTL});
  return reply(data);
 }catch(e){return reply({error:String(e).slice(0,200),available:false},502)}
});
