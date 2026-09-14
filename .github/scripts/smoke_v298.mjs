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

const version = JSON.parse(await fs.readFile('version.json', 'utf8'));
assert(version.version === 'v2.98', `version.json expected v2.98, got ${version.version}`);

const enhancement = await fs.readFile('game-detail-enhancement.js', 'utf8');
assert(enhancement.includes("const numbered = n => new RegExp"), 'composite NPB base parser is missing');
assert(enhancement.includes("/滿壘|満塁|bases\\s*loaded/i"), 'bases-loaded parser is missing');
assert(enhancement.includes("String(detail?.league || '').toUpperCase() === 'NPB'"), 'NPB base-state preference is missing');
assert(enhancement.includes('function inferRunnerNames(detail)'), 'runner inference function missing');
assert(enhancement.includes('const stateForPlay=play=>normalizeBaseState'), 'runner state reconciliation missing');
assert(enhancement.includes('const assignToState=(after,batter,dest)=>'), 'runner identity transition missing');
assert(enhancement.includes('JSON.stringify(detail?.current?.baseState||{})'), 'base-state stamp invalidation missing');

for (const file of ['npb-realtime.js', 'cpbl-realtime.js']) {
  const realtime = await fs.readFile(file, 'utf8');
  assert(realtime.includes("const VERSION = 'v2.98';"), `${file} version is not v2.98`);
  assert(realtime.includes('let watchdogTimer = 0;'), `${file} watchdog timer missing`);
  assert(realtime.includes('async function readRevision('), `${file} revision probe missing`);
  assert(realtime.includes('function startWatchdog()'), `${file} watchdog start missing`);
  assert(realtime.includes('}, 12000);'), `${file} watchdog cadence must be 12 seconds`);
  assert(realtime.includes('stopWatchdog();'), `${file} watchdog cleanup missing`);
}

// Keep the v2.97 NPB pitcher-batting regression covered while verifying production remains live.
{
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
  assert(String(byOrder.get(8)?.name || '').includes('マラー'), 'NPB pitcher must remain in batting order');
  assert(String(byOrder.get(8)?.position || '').toUpperCase() === 'P', 'NPB pitcher batting position must remain P');
}

{
  const { response, data } = await post('npb-live-updater', { appKey: APP_KEY });
  assert(response.ok && data?.ok, `NPB updater HTTP ${response.status}`);
  assert(Number(data?.dueToleranceMs) === 10000, `expected dueToleranceMs=10000, got ${data?.dueToleranceMs}`);
}

console.log('v2.98 NPB runner/base + CPBL/NPB realtime watchdog smoke passed');
