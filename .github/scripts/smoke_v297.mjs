import fs from 'node:fs/promises';

const BASE = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1';
const APP_KEY = 'TyPAf0puXo-lBcrIf4Ky1wQryHaG2f4j';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function post(slug, body = {}, { timeout = 55000 } = {}) {
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
assert(version.version === 'v2.97', `version.json expected v2.97, got ${version.version}`);

// Regression from 2026-09-14 Chunichi @ Hanshin: the pitcher (Muller) bats 8th.
// The batting cycle must be 7 Hanada -> 8 Muller(P) -> 9 Kato, never 7 -> 9.
await retry('NPB pitcher batting cycle', async () => {
  const { response, data } = await post('npb-game-detail', {
    appKey: APP_KEY,
    action: 'game-detail',
    league: 'NPB',
    date: '2026-09-14',
    gameId: 't-d-24',
    away: '中日龍',
    home: '阪神虎',
    status: 'live'
  });
  assert(response.ok && data?.ok, `NPB detail HTTP ${response.status}`);
  const away = data?.lineups?.away?.batters || [];
  const byOrder = new Map(away.map(p => [Number(p?.order), p]));
  assert(String(byOrder.get(7)?.name || '').includes('花田'), `7th batter expected 花田, got ${byOrder.get(7)?.name || 'missing'}`);
  assert(String(byOrder.get(8)?.name || '').includes('マラー'), `8th batter expected マラー, got ${byOrder.get(8)?.name || 'missing'}`);
  assert(String(byOrder.get(8)?.position || '').toUpperCase() === 'P', '8th batter must remain position=P');
  assert(String(byOrder.get(9)?.name || '').includes('加藤'), `9th batter expected 加藤, got ${byOrder.get(9)?.name || 'missing'}`);

  const topPlays = (data?.plays || []).filter(p => p?.half === 'top');
  const i7 = topPlays.findIndex(p => String(p?.batter || '').includes('花田') && Number(p?.battingOrder) === 7);
  const i8 = topPlays.findIndex((p, i) => i > i7 && String(p?.batter || '').includes('マラー') && Number(p?.battingOrder) === 8);
  const i9 = topPlays.findIndex((p, i) => i > i8 && String(p?.batter || '').includes('加藤') && Number(p?.battingOrder) === 9);
  assert(i7 >= 0 && i8 > i7 && i9 > i8, `expected PA sequence 7->8(P)->9; got indexes ${i7},${i8},${i9}`);
});

// Live updater must run on the 30-second cadence and keep its due-time tolerance.
await retry('NPB 30-second cadence', async () => {
  const { response, data } = await post('npb-live-updater', { appKey: APP_KEY });
  assert(response.ok && data?.ok, `NPB updater HTTP ${response.status}`);
  assert(Number(data?.dueToleranceMs) === 10000, `expected dueToleranceMs=10000, got ${data?.dueToleranceMs}`);
  if (String(data?.cronSchedule || '')) {
    assert(String(data.cronSchedule) === '30 seconds', `expected live cron 30 seconds, got ${data.cronSchedule}`);
  }
});

const landscape = await fs.readFile('landscape-state.js', 'utf8');
assert(landscape.includes("['CPBL','NPB'].includes(String(data?.league || '').toUpperCase())"), 'landscape direct-detail listener must accept NPB');
assert(landscape.includes("const VERSION = 'v2.97';"), 'landscape-state internal version is not v2.97');

console.log('v2.97 NPB cadence + pitcher batting regression smoke passed');
