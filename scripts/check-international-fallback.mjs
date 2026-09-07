import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outPath = process.argv[2] || 'tmp/fallback.json';
const probes = [
  {
    id:'u18-2026-japan-official',
    competition:'U18亞青',
    year:2026,
    url:'https://www.japan-baseball.jp/en/team/18u/2026/asianchampionship/overview.html',
    needles:['Chinese Taipei','Korea','9/7/2026']
  },
  {
    id:'u18-2026-tpe-kor-news',
    competition:'U18亞青',
    year:2026,
    url:'https://news.tvbs.com.tw/sports/baseball/4018916',
    needles:['劉任右','69球','6次三振','0：2']
  },
  {
    id:'asian-games-2023-fallback',
    competition:'亞洲運動會',
    year:2023,
    url:'https://globalsportsarchive.com/competition/baseball/asian-games-2022-hangzhou/preliminary-round/88048/',
    needles:['Chinese Taipei','Korea Republic','Japan']
  }
];

const normalize = s => String(s||'').replace(/\s+/g,' ').trim();
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({
  locale:'zh-TW',
  ignoreHTTPSErrors:true,
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
});
const checks=[];
for (const p of probes) {
  const page=await context.newPage();
  let result={...p,ok:false,status:0,title:'',matches:{},snippet:'',checkedAt:new Date().toISOString()};
  try{
    const response=await page.goto(p.url,{waitUntil:'domcontentloaded',timeout:90000});
    result.status=response?.status()||0;
    await page.waitForTimeout(5000);
    result.title=await page.title();
    const body=normalize(await page.locator('body').innerText({timeout:30000}));
    for(const n of p.needles) result.matches[n]=body.includes(n);
    result.ok=Object.values(result.matches).some(Boolean);
    const firstNeedle=p.needles.find(n=>body.includes(n));
    if(firstNeedle){
      const at=body.indexOf(firstNeedle);
      result.snippet=body.slice(Math.max(0,at-500),Math.min(body.length,at+1500));
    } else {
      result.snippet=body.slice(0,1500);
    }
  }catch(e){
    result.error=String(e);
  }
  checks.push(result);
  await page.close();
}
await browser.close();
await fs.mkdir(outPath.split('/').slice(0,-1).join('/')||'.',{recursive:true});
await fs.writeFile(outPath,JSON.stringify({
  generatedAt:new Date().toISOString(),
  generator:'fallback-browser-bot',
  checks
},null,2));
console.log(JSON.stringify(checks.map(x=>({id:x.id,ok:x.ok,status:x.status,matches:x.matches}))));
