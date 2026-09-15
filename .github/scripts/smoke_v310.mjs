import fs from 'node:fs/promises';

const BASE='https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1';
const APP_KEY='TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';
const assert=(condition,message)=>{ if(!condition) throw new Error(message); };

const version=JSON.parse(await fs.readFile('version.json','utf8'));
assert(version.version==='v3.10',`expected v3.10, got ${version.version}`);

const response=await fetch(`${BASE}/league-daily-games`,{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({appKey:APP_KEY,action:'daily-games',league:'MLB',date:'2026-09-14'}),
  signal:AbortSignal.timeout(30000)
});
const data=await response.json().catch(()=>({}));
assert(response.ok&&data?.ok,`league-daily-games HTTP ${response.status}: ${JSON.stringify(data)}`);
const games=Array.isArray(data?.games)?data.games:[];
assert(games.length===10,`expected 10 MLB games on 2026-09-14, got ${games.length}`);
const nonTerminal=games.filter(g=>!['final','cancelled','postponed'].includes(String(g?.status||'').toLowerCase()));
assert(nonTerminal.length===0,`historical MLB cache still contains non-terminal games: ${nonTerminal.map(g=>`${g.away} @ ${g.home}: ${g.status}`).join(', ')}`);
const live=games.filter(g=>String(g?.status||'').toLowerCase()==='live');
assert(live.length===0,`MLB 2026-09-14 must not still show live games: ${live.map(g=>`${g.away} @ ${g.home}`).join(', ')}`);

const dodgers=games.find(g=>String(g?.away||'').includes('Dodgers')&&String(g?.home||'').includes('Reds'));
const whiteSox=games.find(g=>String(g?.away||'').includes('White Sox')&&String(g?.home||'').includes('Guardians'));
assert(dodgers?.status==='final'&&Number(dodgers?.awayScore)===4&&Number(dodgers?.homeScore)===1,'Dodgers @ Reds final regression mismatch');
assert(whiteSox?.status==='final'&&Number(whiteSox?.awayScore)===7&&Number(whiteSox?.homeScore)===3,'White Sox @ Guardians final regression mismatch');

console.log('v3.10 MLB cross-timezone historical-cache regression smoke passed');
