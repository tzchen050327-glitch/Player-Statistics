import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outPath = process.argv[2] || 'tmp/fallback.json';

const probes = [
  {
    id:'u18-2026-tpe-kor-cna',
    competition:'U18亞青',
    year:2026,
    url:'https://www.cna.com.tw/news/aspt/202609070285.aspx',
    needles:['劉任右','69球','6次三振','吳昊翔','張乙安']
  },
  {
    id:'u18-2026-tpe-kor-ltn',
    competition:'U18亞青',
    year:2026,
    url:'https://sports.ltn.com.tw/news/breakingnews/5566230',
    needles:['劉桓宇','觸身球','張乙安','三壘打','胡辰睿']
  },
  {
    id:'u18-2026-tpe-kor-nownews',
    competition:'U18亞青',
    year:2026,
    url:'https://www.nownews.com/news/6873044',
    needles:['0.1局','2安打','陳昱勛','5局無安打']
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

function hitterStat({pa=0,ab=0,runs=0,hits=0,single=0,double=0,triple=0,hr=0,rbi=0,bb=0,ibb=0,hbp=0,sacBunt=0,sacFly=0,k=0}={}) {
  return {pa,ab,runs,hits,single,double,triple,hr,rbi,bb,ibb,hbp,sacBunt,sacFly,k};
}
function pitcherStat({outs=0,h=0,r=0,er=0,bb=0,hbp=0,k=0,w=0,l=0,sv=0,hld=0,bsv=0,cg=0,sho=0,pitchCount=0}={}) {
  return {
    outs,innings:String(Math.floor(outs/3))+'.'+String(outs%3),
    h,r,er,bb,hbp,k,w,l,sv,hld,bsv,cg,sho,pitchCount,
    era:outs?Math.round((er*27/outs)*100)/100:0,
    whip:outs?Math.round((((h+bb)*3)/outs)*100)/100:0
  };
}

function buildU18TaiwanKoreaFallback(checks) {
  const supporting = checks.filter(x => x.id.startsWith('u18-2026-tpe-kor-') && x.ok);
  if (supporting.length < 2) return null;

  const sources = supporting.map(x => x.url);
  const source='交叉驗證 fallback（CNA／自由體育／NOWnews）';
  const sourceUrl=sources[0] || '';
  const gameId='U18-2026-20260907-TPE-KOR';

  const starterShell = (name,position,hitter=null,pitcher=null) => ({
    name,position,hitter,pitcher,
    games:[{
      gameId,date:'2026-09-07',opponent:'韓國',
      hitter,pitcher,partial:true,source,sourceUrl,sources
    }]
  });

  const players = [
    starterShell('胡辰睿','RF',hitterStat({pa:3,ab:3,hits:1,single:1,runs:0,rbi:0})),
    starterShell('劉桓宇','LF',hitterStat({pa:3,ab:2,hits:0,hbp:1,k:1,runs:0,rbi:0})),
    starterShell('張乙安','SS',hitterStat({pa:3,ab:3,hits:2,single:1,triple:1,k:1,runs:0,rbi:0})),
    starterShell('黃世堯','C',hitterStat({pa:3,ab:3,hits:0,k:2,runs:0,rbi:0})),
    starterShell('邱聖安','1B',null),
    starterShell('陳柏凱','DH',null),
    starterShell('帕蘇拉．塔基斯利尼安','CF',null),
    starterShell('全永樂','3B',null),
    starterShell('陳耀杰','2B',null),
    starterShell('劉任右','P',null,pitcherStat({outs:15,h:0,r:0,er:0,bb:2,k:6,pitchCount:69})),
    starterShell('吳昊翔','P',null,pitcherStat({outs:1,h:2,r:2,er:2,l:1})),
    starterShell('陳昱勛','P',null,pitcherStat({outs:5,r:0,er:0,k:1}))
  ];

  return {
    competition:'U18亞青',
    year:2026,
    source,
    sourceUrl,
    fallback:true,
    partial:true,
    games:[{
      gameId,date:'2026-09-07',away:'韓國',home:'中華台北',
      score:{away:2,home:0},
      source,sourceUrl,sources,partial:true,
      teams:{'中華台北':players}
    }],
    teams:{'中華台北':players}
  };
}

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
    await page.waitForTimeout(3500);
    result.title=await page.title();
    const body=normalize(await page.locator('body').innerText({timeout:30000}));
    for(const n of p.needles) result.matches[n]=body.includes(n);
    result.ok=p.needles.filter(n=>result.matches[n]).length >= Math.min(3,p.needles.length);
    const firstNeedle=p.needles.find(n=>body.includes(n));
    if(firstNeedle){
      const at=body.indexOf(firstNeedle);
      result.snippet=body.slice(Math.max(0,at-500),Math.min(body.length,at+1800));
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

const events={};
const u18=buildU18TaiwanKoreaFallback(checks);
if(u18) events['U18亞青:2026']=u18;

await fs.mkdir(outPath.split('/').slice(0,-1).join('/')||'.',{recursive:true});
await fs.writeFile(outPath,JSON.stringify({
  generatedAt:new Date().toISOString(),
  generator:'fallback-browser-bot',
  checks,
  events
},null,2));

console.log('FALLBACK_EVENTS',JSON.stringify(Object.fromEntries(Object.entries(events).map(([k,v])=>[k,{games:v.games?.length||0,teams:Object.keys(v.teams||{}).length}]))));
console.log(JSON.stringify(checks.map(x=>({id:x.id,ok:x.ok,status:x.status,matches:x.matches}))));
