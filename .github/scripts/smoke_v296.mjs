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
assert(version.version === 'v2.96', `version.json expected v2.96, got ${version.version}`);

await retry('NPB pitcher batting order', async () => {
  const { response, data } = await post('npb-game-detail', {
    appKey: APP_KEY,
    action: 'game-detail',
    league: 'NPB',
    date: '2026-09-14',
    gameId: 't-d-24',
    away: '中日龍',
    home: '阪神虎',
    status: 'live'
  }, { timeout: 55000 });
  assert(response.ok && data?.ok, `NPB detail HTTP ${response.status}`);
  const away = data?.lineups?.away?.batters || [];
  const pitcher = away.find(p => String(p?.position || '').toUpperCase() === 'P');
  assert(pitcher, 'NPB batting order omitted the pitcher');
  assert(Number(pitcher.order) === 8, `expected pitcher batting 8th, got ${pitcher?.order}`);
  const pitcherPa = (data?.plays || []).find(p => String(p?.batter || '').includes('マラー'));
  assert(pitcherPa && Number(pitcherPa.battingOrder) === 8, 'pitcher plate appearance missing battingOrder=8');
});

await retry('CPBL major schedule', async () => {
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

await retry('current roster', async () => {
  const { response, data } = await post('cpbl-current-roster', {
    appKey: APP_KEY,
    action: 'current-roster',
    acnt: '0000000363'
  });
  assert(response.ok && data?.ok, `current roster HTTP ${response.status}`);
  assert(data?.player?.level === 'D', `陳仕朋 expected D, got ${data?.player?.level || 'empty'}`);
});

console.log('v2.96 production integration smoke passed');
