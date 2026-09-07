import { chromium } from 'playwright';

const mode = process.argv[2] || 'official';
const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g,'');
const around = (text, needle, radius=900) => {
  const i = norm(text).indexOf(norm(needle));
  if(i<0) return 'NOT_FOUND';
  // Find corresponding approximate original offset by searching simple text if possible.
  const rawIndex = text.toLowerCase().indexOf(String(needle).toLowerCase());
  const at = rawIndex >= 0 ? rawIndex : Math.min(text.length, i);
  return text.slice(Math.max(0,at-radius), Math.min(text.length,at+radius)).replace(/\s+/g,' ');
};
async function getJson(url){
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 diagnostics'}});
  console.log('FETCH',r.status,url);
  if(!r.ok) throw new Error('HTTP '+r.status);
  return await r.json();
}
async function browserText(url, needle){
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1365,height:900},locale:'en-US'});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForTimeout(8000);
    const title=await page.title();
    const body=await page.locator('body').innerText({timeout:30000});
    console.log('PAGE',title,url,'len=',body.length,'needle=',needle);
    console.log(around(body,needle));
    return {title,url,len:body.length,found:around(body,needle)!=='NOT_FOUND'};
  }finally{
    await browser.close();
  }
}
async function official(){
  const base='https://statsapi.mlb.com/api/v1/stats';
  for(const group of ['pitching','hitting']){
    const url=base+'?stats=season&group='+group+'&season=2026&sportIds=51&hydrate=person,team&limit=2000';
    try{
      const data=await getJson(url);
      const splits=(data.stats||[]).flatMap(x=>x.splits||[]);
      const hits=splits.filter(s=>{
        const n=norm(s?.person?.fullName||'');
        const t=norm(s?.team?.name||'');
        return (n.includes('yichang')||n.includes('changyi')) && (t.includes('chinesetaipei')||t.includes('taiwan')||t==='tpe');
      });
      console.log('STATSAPI',group,'splits=',splits.length,'YiChang=',JSON.stringify(hits.slice(0,4),null,2));
    }catch(e){console.log('STATSAPI_ERR',group,String(e))}
  }
  await browserText('https://www.mlb.com/world-baseball-classic/roster/chinese-taipei?season=2026','Yi Chang');
  await browserText('https://www.mlb.com/world-baseball-classic/stats/pitching/chinese-taipei','Yi Chang');
  await browserText('https://federation-staging-0.wbsc.org/en/events/2024-premier12/stats?statsSection=batting&teamId=28965','CHEN Chieh-Hsien');
}
async function fallback(){
  await browserText('https://www.baseball-reference.com/register/player.fcgi?id=cho---000yak','Chinese Taipei');
  await browserText('https://www.baseball-reference.com/register/team.cgi?id=8c67e8cc','Yi Chang');
  await browserText('https://www.2026wbc.jp/score/pool-c/','Chang, Yi');
}
await (mode==='fallback'?fallback():official());
