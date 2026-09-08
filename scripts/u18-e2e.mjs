import fs from 'node:fs/promises';

const html=await fs.readFile('index.html','utf8');
const appKey=(html.match(/const CPBL_APP_KEY = '([^']+)'/)||[])[1];
const anonKey=(html.match(/const CPBL_ANON_KEY = '([^']+)'/)||[])[1];
if(!appKey||!anonKey) throw new Error('app credentials not found in index.html');

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
  if(!r.ok||!data?.ok) throw new Error(action+' '+r.status+' '+text.slice(0,1000));
  return data;
}

for(const playerName of ['劉任右','張乙安','胡辰睿','黃世堯']){
  const roster=await request('international-roster',{
    competition:'U18亞青',year:2026,team:'中華台北'
  });
  const player=(roster.roster?.players||[]).find(p=>
    String(p.zhName||'').includes(playerName) || String(p.name||'').includes(playerName)
  );
  if(!player) throw new Error('roster player not found: '+playerName);

  const games=await request('international-player-games',{
    competition:'U18亞青',year:2026,team:'中華台北',
    playerId:String(player.id||''),playerName
  });

  console.log('U18_E2E',JSON.stringify({
    playerName,
    id:player.id,
    type:player.type,
    count:(games.games||[]).length,
    games:(games.games||[]).map(g=>({
      date:g.date,opponent:g.opponent,partial:g.partial,
      hitter:g.hitter,pitcher:g.pitcher,source:g.source
    }))
  }));
}
