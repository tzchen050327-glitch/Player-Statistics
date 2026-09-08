import { chromium } from 'playwright';

const mode = process.argv[2] || 'official';
const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g,'');
const around = (text, needle, radius=1000) => {
  const ntext=norm(text), nneedle=norm(needle);
  const i=ntext.indexOf(nneedle);
  if(i<0) return 'NOT_FOUND';
  const rawIndex=text.toLowerCase().indexOf(String(needle).toLowerCase());
  const at=rawIndex>=0?rawIndex:Math.min(text.length,i);
  return text.slice(Math.max(0,at-radius),Math.min(text.length,at+radius)).replace(/\s+/g,' ');
};
async function getJson(url){
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 diagnostics'}});
  console.log('FETCH',r.status,url);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return await r.json();
}
function interesting(url){
  return /statsapi\.mlb\.com|mlbstatic|stats|leader|lookup|graphql|api\/|box-score|schedule/i.test(url);
}
async function browserProbe(url, needle, {watch=false}={}){
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({
      viewport:{width:1365,height:900},
      locale:'en-US',
      ignoreHTTPSErrors:true,
      userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
    });
    const page=await context.newPage();
    const seen=new Set();
    if(watch){
      page.on('response',async response=>{
        const u=response.url();
        if(!interesting(u)||seen.has(u)) return;
        seen.add(u);
        const ct=String(response.headers()['content-type']||'');
        console.log('NET',response.status(),ct,u);
        if(/json/i.test(ct)){
          try{
            const txt=await response.text();
            const hit=/Yi.?Chang|CHANG.?Yi|Chinese.?Taipei|TPE/i.test(txt);
            if(hit) console.log('NET_JSON_MATCH',u,txt.slice(0,12000).replace(/\s+/g,' '));
          }catch{}
        }
      });
    }
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
      await page.waitForTimeout(10000);
      const title=await page.title();
      const body=await page.locator('body').innerText({timeout:30000});
      console.log('PAGE',title,url,'len=',body.length,'needle=',needle);
      console.log(around(body,needle));
      if(watch){
        const entries=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
        for(const u of entries.filter(interesting)) console.log('PERF',u);
      }
      return {title,url,len:body.length,found:around(body,needle)!=='NOT_FOUND'};
    }catch(e){
      console.log('PAGE_ERR',url,String(e));
      return {url,found:false,error:String(e)};
    }
  }finally{
    await browser.close();
  }
}

const APP_CLIENT='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/baseball-client';
const APP_KEY='TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
const APP_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqbmRuc3p0YmNwbWtoaWN0amtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDgxMDcsImV4cCI6MjEwMzU4NDEwN30.oB0Qq2eF3Tnrhg209rzPMNUhQPPEREmJwWxMFxCZLYU';

async function appRequest(action,params={}){
  const r=await fetch(APP_CLIENT,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({appKey:APP_KEY,anonKey:APP_ANON,action,...params})
  });
  const txt=await r.text();
  let data=null;
  try{data=JSON.parse(txt)}catch{}
  if(!r.ok || !data?.ok){
    throw new Error(action+' HTTP '+r.status+' '+txt.slice(0,1200));
  }
  return data;
}
function compactPitcher(p){
  if(!p) return null;
  return {
    innings:p.innings,outs:p.outs,w:p.w,l:p.l,era:p.era,whip:p.whip,
    h:p.h,r:p.r,er:p.er,bb:p.bb,k:p.k
  };
}
function compactHitter(h){
  if(!h) return null;
  return {
    pa:h.pa,ab:h.ab,runs:h.runs,hits:h.hits,
    double:h.double,triple:h.triple,hr:h.hr,rbi:h.rbi,bb:h.bb,k:h.k
  };
}
function pickUsefulPlayer(roster){
  const list=roster?.players||[];
  return list.find(p=>{
    const h=p?.hitter||{},pit=p?.pitcher||{};
    return Number(h.pa||h.ab||h.hits||0)>0 || Number(pit.outs||pit.h||pit.bb||pit.k||0)>0;
  }) || list[0] || null;
}
async function e2eAppApi(){
  console.log('E2E_BEGIN');

  const wbcParams={
    competition:'WBC',year:2026,team:'中華台北',
    playerId:'838359',playerName:'Yi Chang'
  };
  const ws=await appRequest('international-player-stats',wbcParams);
  const wg=await appRequest('international-player-games',wbcParams);
  console.log('E2E_WBC_STATS',JSON.stringify({
    found:ws.stats?.found,source:ws.stats?.source,pitcher:compactPitcher(ws.stats?.pitcher)
  }));
  console.log('E2E_WBC_GAMES',JSON.stringify({
    count:(wg.games||[]).length,
    games:(wg.games||[]).map(g=>({date:g.date,opponent:g.opponent,pitcher:compactPitcher(g.pitcher)}))
  }));

  for(const test of [
    {tag:'P12',competition:'世界12強',year:2024,team:'中華台北'},
    {tag:'ABC',competition:'亞錦賽',year:2025,team:'中華台北'}
  ]){
    const rr=await appRequest('international-roster',test);
    const player=pickUsefulPlayer(rr.roster);
    console.log('E2E_'+test.tag+'_ROSTER',JSON.stringify({
      count:(rr.roster?.players||[]).length,
      source:rr.roster?.source,
      sample:player?{
        id:player.id,name:player.name,type:player.type,
        hitter:compactHitter(player.hitter),pitcher:compactPitcher(player.pitcher)
      }:null
    }));
    if(!player) continue;
    const params={...test,playerId:String(player.id||''),playerName:player.name};
    const ps=await appRequest('international-player-stats',params);
    const pg=await appRequest('international-player-games',params);
    console.log('E2E_'+test.tag+'_STATS',JSON.stringify({
      found:ps.stats?.found,source:ps.stats?.source,
      hitter:compactHitter(ps.stats?.hitter),pitcher:compactPitcher(ps.stats?.pitcher)
    }));
    console.log('E2E_'+test.tag+'_GAMES',JSON.stringify({
      count:(pg.games||[]).length,
      games:(pg.games||[]).map(g=>({
        date:g.date,opponent:g.opponent,
        hitter:compactHitter(g.hitter),pitcher:compactPitcher(g.pitcher)
      }))
    }));
  }

  for (const playerName of ['劉任右','張乙安']) {
    const tag = playerName === '劉任右' ? 'U18_LIU' : 'U18_CHANG';
    const params = {
      competition:'U18亞青',
      year:2026,
      team:'中華台北',
      playerName
    };
    const ps = await appRequest('international-player-stats',params);
    const pg = await appRequest('international-player-games',params);
    console.log('E2E_'+tag+'_STATS',JSON.stringify({
      found:ps.stats?.found,
      source:ps.stats?.source,
      hitter:compactHitter(ps.stats?.hitter),
      pitcher:compactPitcher(ps.stats?.pitcher)
    }));
    console.log('E2E_'+tag+'_GAMES',JSON.stringify({
      count:(pg.games||[]).length,
      games:(pg.games||[]).map(g=>({
        date:g.date,opponent:g.opponent,
        hitter:compactHitter(g.hitter),
        pitcher:compactPitcher(g.pitcher)
      }))
    }));
  }

  console.log('E2E_END');
}

async function official(){
  await e2eAppApi();
  for(const year of [2026,2025,2023]){
    try{
      const teams=await getJson('https://statsapi.mlb.com/api/v1/teams?sportId=51&season='+year);
      console.log('TEAMS',year,JSON.stringify((teams.teams||[]).map(t=>({id:t.id,name:t.name}))));
    }catch(e){console.log('TEAMS_ERR',year,String(e))}
  }
  for(const year of [2026,2025,2023]){
    for(const gameType of ['F','W']){
      try{
        const url='https://statsapi.mlb.com/api/v1/teams/791/roster?hydrate='+encodeURIComponent('person(stats(type=season,season='+year+',sportId=51,teamId=791,gameType='+gameType+'))')+'&rosterType=active&season='+year+'&sportId=51';
        const d=await getJson(url);
        const hit=(d.roster||[]).find(x=>/Yi.?Chang/i.test(x?.person?.fullName||''));
        console.log('ROSTER_TEST',year,gameType,'count=',(d.roster||[]).length,'YiChang=',JSON.stringify(hit||null));
      }catch(e){console.log('ROSTER_TEST_ERR',year,gameType,String(e))}
    }
    for(const gameType of ['F','W']){
      try{
        const url='https://statsapi.mlb.com/api/v1/schedule?sportId=51&season='+year+'&teamId=791&gameType='+gameType+'&hydrate=team';
        const d=await getJson(url);
        const games=(d.dates||[]).flatMap(x=>x.games||[]);
        console.log('SCHEDULE_TEST',year,gameType,'count=',games.length,'games=',JSON.stringify(games.map(g=>({gamePk:g.gamePk,date:g.officialDate,away:g.teams?.away?.team?.name,home:g.teams?.home?.team?.name}))));
      }catch(e){console.log('SCHEDULE_TEST_ERR',year,gameType,String(e))}
    }
  }
  const base='https://statsapi.mlb.com/api/v1/stats';
  for(const gameType of ['', '&gameTypes=W','&gameType=W','&gameTypes=F','&gameType=F']){
    for(const group of ['pitching','hitting']){
      const url=base+'?stats=season&group='+group+'&season=2026&sportIds=51&hydrate=person,team&limit=2000'+gameType;
      try{
        const data=await getJson(url);
        const splits=(data.stats||[]).flatMap(x=>x.splits||[]);
        const hits=splits.filter(s=>{
          const n=norm(s?.person?.fullName||'');
          const t=norm(s?.team?.name||'');
          return (n.includes('yichang')||n.includes('changyi')) && (t.includes('chinesetaipei')||t.includes('taiwan')||t==='tpe');
        });
        console.log('STATSAPI',group,gameType||'default','splits=',splits.length,'YiChang=',JSON.stringify(hits.slice(0,4)));
      }catch(e){console.log('STATSAPI_ERR',group,gameType,String(e))}
    }
  }
  await browserProbe('https://www.mlb.com/world-baseball-classic/stats/pitching/chinese-taipei','Yi Chang',{watch:true});
  await browserProbe('https://www.mlb.com/world-baseball-classic/stats/chinese-taipei','Yu Chang',{watch:true});
  await browserProbe('https://www.mlb.com/world-baseball-classic/roster/chinese-taipei?season=2026','Yi Chang',{watch:true});
  await browserProbe('https://www.wbsc.org/en/events/2024-premier12/stats?statsSection=batting&teamId=28965','CHEN Chieh-Hsien',{watch:true});
  await browserProbe('https://www.wbscasia.org/en/events/2025-xxx-bfa-asian-baseball-championship/stats','CHINESE TAIPEI',{watch:true});
}

async function inspectU18Box(){
  const url='https://www.wbscasia.org/en/events/2026-bfa-xiv-u18-championship/schedule-and-results/box-score/207380';
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({
      locale:'en-US',
      ignoreHTTPSErrors:true,
      userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
    });
    const page=await context.newPage();
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForTimeout(8000);
    console.log('U18_BOX_STATUS',response?.status(),await page.title());
    const body=(await page.locator('body').innerText()).replace(/\s+/g,' ');
    console.log('U18_BOX_BODY',body.slice(0,12000));

    const inertiaRaw=await page.locator('[data-page]').first().getAttribute('data-page').catch(()=>null);
    if(inertiaRaw){
      try{
        const inertia=JSON.parse(inertiaRaw);
        const original=inertia?.props?.viewData?.original || inertia?.props?.viewData || {};
        const gamePlays=original?.gamePlays;
        console.log('U18_INERTIA_COMPONENT',inertia?.component||'');
        console.log('U18_INERTIA_ORIGINAL_KEYS',JSON.stringify(Object.keys(original||{})));
        console.log('U18_GAMEPLAYS_TYPE',Array.isArray(gamePlays)?'array':typeof gamePlays);
        console.log('U18_GAMEPLAYS_LEN',Array.isArray(gamePlays)?gamePlays.length:Object.keys(gamePlays||{}).length);
        const sample=Array.isArray(gamePlays)
          ? gamePlays.slice(0,30)
          : Object.fromEntries(Object.entries(gamePlays||{}).slice(0,30));
        console.log('U18_GAMEPLAYS_SAMPLE',JSON.stringify(sample).slice(0,30000));
      }catch(e){
        console.log('U18_INERTIA_PARSE_ERR',String(e),'rawLen=',inertiaRaw.length);
      }
    }else{
      console.log('U18_INERTIA_MISSING');
    }

    const tables=await page.locator('table').evaluateAll((els)=>els.map((t,idx)=>({
      idx,
      text:(t.innerText||'').replace(/\s+/g,' '),
      headers:[...t.querySelectorAll('thead th, tr:first-child th, tr:first-child td')].map(x=>(x.textContent||'').trim()),
      rows:[...t.querySelectorAll('tr')].slice(0,12).map(r=>[...r.querySelectorAll('th,td')].map(x=>(x.textContent||'').trim()))
    })));
    console.log('U18_BOX_TABLES',JSON.stringify(tables));
  } finally {
    await browser.close();
  }
}

async function fallback(){
  await inspectU18Box();
  await browserProbe('https://www.baseball-reference.com/register/player.fcgi?id=cho---000yak','Chinese Taipei',{watch:true});
  await browserProbe('https://www.baseball-reference.com/register/team.cgi?id=8c67e8cc','Yi Chang',{watch:true});
  await browserProbe('https://www.2026wbc.jp/score/pool-c/','Chang, Yi',{watch:true});
}
await (mode==='fallback'?fallback():official());
