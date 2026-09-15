import fs from 'node:fs/promises';

const BASE='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1';
const APP_KEY='TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
const assert=(condition,message)=>{ if(!condition) throw new Error(message); };

async function post(slug,body){
  const response=await fetch(`${BASE}/${slug}`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)
  });
  const data=await response.json().catch(()=>({}));
  return {response,data};
}

const version=JSON.parse(await fs.readFile('version.json','utf8'));
assert(version.version==='v3.09',`expected v3.09, got ${version.version}`);

const app=await fs.readFile('app.js','utf8');
assert(app.includes("const supportsPregameStarters = league === 'CPBL' || league === 'NPB';"),'CPBL/NPB pregame gating missing');
assert(app.includes("if (detail && !force && !detail?.pregame && staleDetail?.pregame)"),'pregame cache preservation missing');
assert(!app.includes("league === 'NPB' && (!fromAnyCache || force)"),'old NPB-only pregame gate still present');

const fixtures=[
  {gameId:'282',away:'味全龍',home:'富邦悍將',awayStarter:'黃暐傑',homeStarter:'魔力藍'},
  {gameId:'331',away:'中信兄弟',home:'台鋼雄鷹',awayStarter:'羅戈',homeStarter:'艾速特'},
  {gameId:'332',away:'樂天桃猿',home:'統一獅',awayStarter:'曾家輝',homeStarter:'郭俊麟'},
];

for(const f of fixtures){
  const {response,data}=await post('pregame-starters',{
    appKey:APP_KEY,action:'pregame-starters',league:'CPBL',date:'2026-09-15',gameId:f.gameId,away:f.away,home:f.home
  });
  assert(response.ok&&data?.ok,`pregame ${f.gameId} HTTP ${response.status}: ${data?.error||''}`);
  const awayName=String(data?.awayStarter?.name||'');
  const homeName=String(data?.homeStarter?.name||'');
  assert(awayName.includes(f.awayStarter),`#${f.gameId} away starter expected ${f.awayStarter}, got ${awayName||'(empty)'}`);
  assert(homeName.includes(f.homeStarter),`#${f.gameId} home starter expected ${f.homeStarter}, got ${homeName||'(empty)'}`);
  console.log(`#${f.gameId}: ${awayName} vs ${homeName}`);
}

console.log('v3.09 CPBL scheduled pregame starters production smoke passed');
