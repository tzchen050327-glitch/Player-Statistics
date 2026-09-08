import fs from 'node:fs/promises';

const html=await fs.readFile('index.html','utf8');
const appKey=(html.match(/const CPBL_APP_KEY = '([^']+)'/)||[])[1];
const anonKey=(html.match(/const CPBL_ANON_KEY = '([^']+)'/)||[])[1];
if(!appKey||!anonKey) throw new Error('app credentials not found');

const client='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/baseball-client';

async function request(action,params={}){
  const r=await fetch(client,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({appKey,anonKey,action,...params})
  });
  const text=await r.text();
  let data={};
  try{data=JSON.parse(text)}catch{}
  if(!r.ok||!data?.ok) throw new Error(action+' '+r.status+' '+text.slice(0,1200));
  return data;
}

const roster=await request('international-roster',{
  competition:'亞洲運動會',year:2023,team:'中華台北'
});
console.log('AG_E2E_ROSTER',JSON.stringify({
  source:roster.roster?.source,
  count:(roster.roster?.players||[]).length,
  sample:(roster.roster?.players||[]).slice(0,5).map(p=>({name:p.name,zhName:p.zhName,number:p.number,type:p.type}))
}));

for(const wanted of ['鄭宗哲','林昱珉']){
  const player=(roster.roster?.players||[]).find(p=>
    String(p.zhName||'').includes(wanted) || String(p.name||'').includes(wanted)
  );
  if(!player) throw new Error('Asian Games roster player not found: '+wanted);

  const params={
    competition:'亞洲運動會',year:2023,team:'中華台北',
    playerId:String(player.id||''),playerName:player.name
  };
  const stats=await request('international-player-stats',params);
  const games=await request('international-player-games',params);
  if(!stats.stats?.found) throw new Error('Asian Games stats missing: '+wanted);
  if(!(games.games||[]).length) throw new Error('Asian Games games missing: '+wanted);

  console.log('AG_E2E_PLAYER',JSON.stringify({
    wanted,
    player:{id:player.id,name:player.name,zhName:player.zhName,type:player.type},
    source:stats.stats?.source,
    hitter:stats.stats?.hitter||null,
    pitcher:stats.stats?.pitcher||null,
    count:(games.games||[]).length,
    games:(games.games||[]).map(g=>({
      date:g.date,opponent:g.opponent,hitter:g.hitter||null,pitcher:g.pitcher||null,source:g.source
    }))
  }));
}
