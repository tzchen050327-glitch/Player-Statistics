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
async function official(){
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
async function fallback(){
  await browserProbe('https://www.baseball-reference.com/register/player.fcgi?id=cho---000yak','Chinese Taipei',{watch:true});
  await browserProbe('https://www.baseball-reference.com/register/team.cgi?id=8c67e8cc','Yi Chang',{watch:true});
  await browserProbe('https://www.2026wbc.jp/score/pool-c/','Chang, Yi',{watch:true});
}
await (mode==='fallback'?fallback():official());
