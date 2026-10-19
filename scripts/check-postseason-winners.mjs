import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/11na-postseason-page.js','utf8');
const start = source.indexOf('    function postseasonMatchCard(');
const end = source.indexOf('    let postseasonNpbGames = [];', start);
assert.ok(start >= 0 && end > start, 'Shared postseason card renderer must exist');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);
const card = vm.runInNewContext(source.slice(start,end) + '\npostseasonMatchCard', { postseasonEscape:escape });

function check(winner, index) {
  const html = card('Series', 'Team A', 'Team B', '', {seriesScore:[3,2],winner});
  const teams = [...html.matchAll(/<div class="postseason-bracket-team ([^"]*)"/g)].map(m=>m[1].trim());
  assert.equal(teams.length,2,'both teams rendered');
  for(let i=0;i<2;i++) assert.equal(teams[i].includes('is-winner'), i===index, 'only confirmed winner gets green marker');
  assert.equal(/postseason-series-card is-complete/.test(html),index>=0, 'series marked complete only for confirmed winner');
}
check('',-1);
check('Team A',0);
check('Team B',1);
check('Unknown team',-1);

const winnerPaths = [
  'winner:firstWinner','winner:wcWinner','winner:semiWinner','winner:poWinner',
  'winner:ksWinner','winner:challengeWinner','winner:direct&&challengeWinner?',
  "postseasonNpbSeriesWinner(centralChampion,pacificChampion,'japan_series',4)"
];
for(const rule of winnerPaths) assert.ok(source.includes(rule), 'Winner source missing: '+rule);
assert.ok(source.includes("node.classList.toggle('is-winner'"),'live CPBL DOM updater must track confirmed winners');
console.log('All CPBL, NPB, KBO postseason winner styling regression checks passed');
