import fs from 'node:fs/promises';

const BASE = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1';
const APP_KEY = 'TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function post(slug, body = {}, { timeout = 30000 } = {}) {
  const response = await fetch(`${BASE}/${slug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout)
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text || '{}'); } catch { data = { raw: text }; }
  return { response, data };
}

async function retry(label, fn, attempts = 2) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (error) {
      last = error;
      if (i < attempts) await new Promise(resolve => setTimeout(resolve, 1200 * i));
    }
  }
  throw new Error(`${label}: ${last?.message || last}`);
}

const version = JSON.parse(await fs.readFile('version.json', 'utf8'));
assert(version.version === 'v2.95', `version.json expected v2.95, got ${version.version}`);

await retry('major schedule', async () => {
  const { response, data } = await post('league-daily-games', {
    appKey: APP_KEY,
    action: 'daily-games',
    league: 'CPBL',
    date: '2026-09-13',
    kindCodes: ['A', 'E', 'C']
  });
  assert(response.ok && data?.ok, `major schedule HTTP ${response.status}`);
  assert(Array.isArray(data.games) && data.games.length >= 3, 'major historical schedule missing games');
  assert(data.games.every(game => String(game.kindCode || 'A').toUpperCase() !== 'D'), 'major schedule leaked D games');
});

await retry('minor schedule', async () => {
  const { response, data } = await post('league-daily-games', {
    appKey: APP_KEY,
    action: 'daily-games',
    league: 'CPBL',
    date: '2026-09-13',
    kindCodes: ['D']
  });
  assert(response.ok && data?.ok, `minor schedule HTTP ${response.status}`);
  assert(Array.isArray(data.games) && data.games.length >= 1, 'minor historical schedule missing games');
  assert(data.games.every(game => String(game.kindCode || '').toUpperCase() === 'D'), 'D schedule contains non-D game');
});

await retry('current roster', async () => {
  const { response, data } = await post('cpbl-current-roster', {
    appKey: APP_KEY,
    action: 'current-roster',
    acnt: '0000000363'
  });
  assert(response.ok && data?.ok, `current roster HTTP ${response.status}`);
  assert(data?.player?.level === 'D', `陳仕朋 expected D, got ${data?.player?.level || 'empty'}`);
  assert(data?.player?.teamCode === 'AEO', `陳仕朋 expected teamCode AEO, got ${data?.player?.teamCode || 'empty'}`);
});

await retry('historical detail', async () => {
  const { response, data } = await post('cpbl-game-detail', {
    appKey: APP_KEY,
    action: 'game-detail',
    date: '2026-09-13',
    gameId: '328',
    kindCode: 'A',
    status: 'final'
  });
  assert(response.ok && data?.ok, `historical detail HTTP ${response.status}`);
  assert(String(data.status || '').toLowerCase() === 'final', `#328 expected final, got ${data.status}`);
  assert(Array.isArray(data.plays) && data.plays.length > 0, '#328 final detail has no plays');
});

{
  const { response } = await post('cpbl-api', { action: 'player-profile', acnt: '0000000363' });
  assert(response.status === 403, `raw cpbl-api expected 403, got ${response.status}`);
}

await retry('diagnostics', async () => {
  const { response, data } = await post('cache-diagnostics', {});
  assert(response.ok && data?.ok, `diagnostics HTTP ${response.status}`);
  assert(data?.integrity && Number.isFinite(Number(data.integrity.checkedGames)), 'diagnostics integrity checks missing');
});

for (const slug of ['cpbl-pregame-prefetch', 'cpbl-minor-team-batting']) {
  const { response } = await post(slug, {});
  assert([401, 403].includes(response.status), `${slug} should be retired from public access, got ${response.status}`);
}

console.log('v2.95 production integration smoke passed');
