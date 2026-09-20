const GAME_LIST='https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList';
const SCHEDULE='https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36';
const CORS={'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','content-type':'application/json; charset=utf-8'};
const TEAM:Record<string,string>={HT:'KIA虎',KIA:'KIA虎','기아':'KIA虎',KT:'KT巫師',LG:'LG雙子',SS:'三星獅','삼성':'三星獅',OB:'斗山熊','두산':'斗山熊',SK:'SSG登陸者',SSG:'SSG登陸者',LT:'樂天巨人','롯데':'樂天巨人',HH:'韓華鷹','한화':'韓華鷹',NC:'NC恐龍',WO:'培證英雄','키움':'培證英雄'};
const clean=(v:any)=>String(v??'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/<br\s*\/?/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const score=(v:any)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
function alias(v:any){const raw=clean(v);return TEAM[raw]||TEAM[raw.toUpperCase()]||raw;}
function validDate(v:any){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new Error('date must be YYYY-MM-DD');return s;}
function kstDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
async function post(url:string,body:any,contentType='application/json; charset=UTF-8'){const r=await fetch(url,{method:'POST',headers:{'user-agent':UA,'referer':'https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx','content-type':contentType,'accept':'application/json, text/javascript, */*; q=0.01','x-requested-with':'XMLHttpRequest'},body:typeof body==='string'?body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw new Error('KBO HTTP '+r.status);const cut=text.search(/<!DOCTYPE|<html/i);return JSON.parse(cut>=0?text.slice(0,cut):text);}
function kstStart(date:string,time:string){const m=String(time||'').match(/(\d{1,2}):(\d{2})/);if(!m)return NaN;return Date.parse(`${date}T${String(m[1]).padStart(2,'0')}:${m[2]}:00+09:00`);}
function liveInningLabel(g:any){const inn=Number(g?.GAME_INN_NO)||0;if(!inn)return'';const tb=clean(g?.GAME_TB_SC_NM).toLowerCase();if(/초|top|상/.test(tb))return`${inn}局上`;if(/말|bottom|하/.test(tb))return`${inn}局下`;return`${inn}局`;}
function liveStatus(g:any,date:string){
  const cancelName=clean(g?.CANCEL_SC_NM);
  const state=clean(g?.GAME_STATE_SC);
  if(/취소|우천|노게임|연기|중단|서스펜디드/i.test(cancelName)||/취소|연기/i.test(state))return'cancelled';
  // KBO GetKboGameList uses GAME_STATE_SC=3 for completed games. Ties have no winning/losing pitcher,
  // so this explicit official state code must be checked before any start-time or inning heuristics.
  if(state==='3'||/종료|경기종료|final|completed/i.test(state))return'final';

  if(date<kstDate())return'final';

  // GameCenter pre-populates GAME_INN_NO=1 / GAME_TB_SC_NM=초 before first pitch.
  // Never let those placeholder fields make a future 18:30 game look live.
  const start=kstStart(date,clean(g?.G_TM));
  if(Number.isFinite(start)&&Date.now()<start)return'scheduled';
  if(/예정|경기전|scheduled|preview/i.test(state))return'scheduled';

  const inning=Number(g?.GAME_INN_NO)||0;
  const tb=clean(g?.GAME_TB_SC_NM);
  const activePlayer=clean(g?.T_P_NM)||clean(g?.B_P_NM);
  const activeCount=[g?.BALL_CN,g?.STRIKE_CN,g?.OUT_CN].some(v=>v!==null&&v!==undefined&&v!=='');
  const live=inning>0&&(!!tb||!!activePlayer||activeCount);
  const away=score(g?.T_SCORE_CN),home=score(g?.B_SCORE_CN);
  const scoreReady=String(g?.SCORE_CK??'')==='1'&&away!==null&&home!==null;
  const decision=Number(g?.W_PIT_P_ID)>0||Number(g?.L_PIT_P_ID)>0||!!clean(g?.W_PIT_P_NM)||!!clean(g?.L_PIT_P_NM);
  const vod=Number(g?.VOD_CK)===1;
  if(decision||(vod&&scoreReady&&!live))return'final';
  if(live||/진행|경기중|live|playing/i.test(state))return'live';
  if(Number.isFinite(start)&&Date.now()>=start)return'live';
  return'scheduled';
}
async function fromGameList(date:string){const d=date.replaceAll('-','');const j=await post(GAME_LIST,{leId:'1',srId:'0',date:d});const rows=Array.isArray(j?.game)?j.game:[];return rows.map((g:any)=>{const status=liveStatus(g,date);const awayRaw=score(g.T_SCORE_CN),homeRaw=score(g.B_SCORE_CN);const showScore=status==='live'||status==='final';return{away:alias(g.AWAY_NM||g.AWAY_ID),home:alias(g.HOME_NM||g.HOME_ID),awayScore:showScore?awayRaw:null,homeScore:showScore?homeRaw:null,status,time:clean(g.G_TM),venue:clean(g.S_NM),id:String(g.G_ID||''),inningLabel:status==='live'?liveInningLabel(g):''};});}
function schedulePlay(html:string){const raw=String(html||'');const names=[...raw.matchAll(/<span\b[^>]*>([^<]+)<\/span>/gi)].map(m=>clean(m[1])).filter(x=>x&&!/^\d+$/.test(x)&&x.toLowerCase()!=='vs');let away=alias(names[0]||''),home=alias(names[names.length-1]||'');const sm=raw.match(/<em[^>]*>\s*<span[^>]*>(\d+)<\/span>\s*<span[^>]*>vs<\/span>\s*<span[^>]*>(\d+)<\/span>\s*<\/em>/i);return{away,home,awayScore:sm?Number(sm[1]):null,homeScore:sm?Number(sm[2]):null};}
async function fromSchedule(date:string){const [y,m]=date.split('-');const body=new URLSearchParams({leId:'1',srIdList:'0,9,6',seasonId:y,gameMonth:m,teamId:''}).toString();const j=await post(SCHEDULE,body,'application/x-www-form-urlencoded; charset=UTF-8');let current='';const out:any[]=[];const today=kstDate();for(const row of j?.rows||[]){const cells=row?.row||[];if(!cells.length)continue;let offset=0;if(cells[0]?.Class==='day'){const mm=clean(cells[0].Text).match(/^(\d{2})\.(\d{2})/);if(mm)current=`${y}-${mm[1]}-${mm[2]}`;offset=1;}if(current!==date)continue;const playCell=cells[offset+1];if(!playCell||playCell.Class!=='play')continue;const p=schedulePlay(playCell.Text);const time=clean(cells[offset]?.Text||'');const note=clean(cells[offset+7]?.Text||'');let status='scheduled';if(/취소|우천|노게임|연기|중단/i.test(note))status='cancelled';else if(date<today)status='final';else{const start=kstStart(date,time);if(Number.isFinite(start)&&Date.now()>=start)status='live';}const showScore=status==='live'||status==='final';out.push({away:p.away||'客隊',home:p.home||'主隊',awayScore:showScore?p.awayScore:null,homeScore:showScore?p.homeScore:null,status,time,venue:clean(cells[offset+6]?.Text||''),id:'',inningLabel:''});}return out;}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return reply({ok:false,error:'POST only'},405);try{const body=await req.json();if(String(body.action||'')!=='daily-games'||String(body.league||'').toUpperCase()!=='KBO')return reply({ok:false,error:'KBO daily-games only'},400);const date=validDate(body.date);let games:any[]=[];try{games=await fromGameList(date);}catch(e){console.warn('GetKboGameList failed, falling back to schedule',e);}if(!games.length)games=await fromSchedule(date);return reply({ok:true,league:'KBO',date,games});}catch(e){console.error(e);return reply({ok:false,error:e instanceof Error?e.message:String(e)},500);}});
