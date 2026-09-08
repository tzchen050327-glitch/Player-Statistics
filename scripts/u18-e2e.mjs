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

  const official=(games.games||[]).find(g=>String(g.gameId)==='207380');
  if(!official) throw new Error('official WBSC game 207380 not found: '+playerName);
  if(official.partial) throw new Error('WBSC game unexpectedly partial: '+playerName);
  if(official.source!=='wbsc-asia-gameplays') throw new Error('unexpected source '+official.source+': '+playerName);

  if(playerName==='張乙安'){
    const codes=(official.hitter?.plateAppearances||[]).map(pa=>pa.code);
    if(JSON.stringify(codes)!==JSON.stringify(['3B','K','1B'])){
      throw new Error('張乙安 PA mismatch: '+JSON.stringify(codes));
    }
  }
  if(playerName==='胡辰睿'){
    const codes=(official.hitter?.plateAppearances||[]).map(pa=>pa.code);
    if(JSON.stringify(codes)!==JSON.stringify(['K','FO','1B'])){
      throw new Error('胡辰睿 PA mismatch: '+JSON.stringify(codes));
    }
  }
  if(playerName==='劉任右'){
    if(official.pitcher?.innings!=='5.0'||Number(official.pitcher?.k)!==6){
      throw new Error('劉任右 pitching mismatch: '+JSON.stringify(official.pitcher));
    }
  }

  console.log('U18_E2E',JSON.stringify({
    playerName,
    id:player.id,
    type:player.type,
    count:(games.games||[]).length,
    official:{
      gameId:official.gameId,date:official.date,opponent:official.opponent,
      partial:official.partial,hitter:official.hitter,pitcher:official.pitcher,source:official.source
    }
  }));
}
