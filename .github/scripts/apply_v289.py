from pathlib import Path
import json, re

# CPBL realtime cache keys must include kindCode because A/D GameSno may collide.
p = Path('cpbl-realtime.js')
s = p.read_text(encoding='utf-8')
s = s.replace("const VERSION = 'v2.87';", "const VERSION = 'v2.89';", 1)

old = """  async function readPublished(date, gameId) {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(d) || !id) return { ok:false, detail:null, row:null };
    const query = new URLSearchParams({
      game_date:`eq.${d}`,
      game_id:`eq.${id}`,
      select:'game_date,game_id,status,published_payload,published_revision,published_at',
      limit:'1'
    });
"""
new = """  async function readPublished(date, gameId, kindCode = 'A') {
    const d = String(date || '').trim();
    const id = String(gameId || '').trim();
    const kind = String(kindCode || 'A').trim().toUpperCase();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(d) || !id) return { ok:false, detail:null, row:null };
    const query = new URLSearchParams({
      game_date:`eq.${d}`,
      game_id:`eq.${id}`,
      kind_code:`eq.${kind}`,
      select:'game_date,game_id,kind_code,status,published_payload,published_revision,published_at',
      limit:'1'
    });
"""
if old not in s: raise SystemExit('readPublished anchor missing')
s = s.replace(old, new, 1)

old = """    if (!watch || !row) return;
    if (String(row.game_id || '') !== watch.gameId || String(row.game_date || '') !== watch.date) return;
"""
new = """    if (!watch || !row) return;
    if (String(row.game_id || '') !== watch.gameId || String(row.game_date || '') !== watch.date) return;
    if (String(row.kind_code || 'A').toUpperCase() !== watch.kindCode) return;
"""
if old not in s: raise SystemExit('acceptRow anchor missing')
s = s.replace(old, new, 1)

old = """    const revision = Number(row.published_revision ?? -1);
    const prev = Number(dayRevisions.get(gameId) ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= prev) return;
    if (Number.isFinite(revision) && revision >= 0) dayRevisions.set(gameId, revision);
"""
new = """    const kindCode = String(row?.kind_code || detail?.kindCode || detail?.game?.kindCode || 'A').toUpperCase();
    const revisionKey = `${kindCode}|${gameId}`;
    const revision = Number(row.published_revision ?? -1);
    const prev = Number(dayRevisions.get(revisionKey) ?? -1);
    if (Number.isFinite(revision) && revision >= 0 && revision <= prev) return;
    if (Number.isFinite(revision) && revision >= 0) dayRevisions.set(revisionKey, revision);
"""
if old not in s: raise SystemExit('day revision anchor missing')
s = s.replace(old, new, 1)

old = """  async function startWatch(input = {}) {
    const date = String(input.date || '').trim();
    const gameId = String(input.gameId || '').trim();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !gameId) return;
    if (watch?.date === date && watch?.gameId === gameId && channel) return;
    await stopWatch(false);
    watch = { date, gameId };
    try {
      const sb = await getClient();
      if (!watch || watch.date !== date || watch.gameId !== gameId) return;
      channel = sb.channel(`cpbl-live-${date}-${gameId}-${Math.random().toString(36).slice(2,8)}`)
"""
new = """  async function startWatch(input = {}) {
    const date = String(input.date || '').trim();
    const gameId = String(input.gameId || '').trim();
    const kindCode = String(input.kindCode || 'A').trim().toUpperCase();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !gameId) return;
    if (watch?.date === date && watch?.gameId === gameId && watch?.kindCode === kindCode && channel) return;
    await stopWatch(false);
    watch = { date, gameId, kindCode };
    try {
      const sb = await getClient();
      if (!watch || watch.date !== date || watch.gameId !== gameId || watch.kindCode !== kindCode) return;
      channel = sb.channel(`cpbl-live-${kindCode}-${date}-${gameId}-${Math.random().toString(36).slice(2,8)}`)
"""
if old not in s: raise SystemExit('startWatch anchor missing')
s = s.replace(old, new, 1)
s = s.replace('      const initial = await readPublished(date, gameId);', '      const initial = await readPublished(date, gameId, kindCode);', 1)
p.write_text(s, encoding='utf-8')

# app.js: pass and match CPBL kindCode end-to-end.
p = Path('app.js')
s = p.read_text(encoding='utf-8')
old = """    function homeGameDetailKey(league, date, game = {}) {
      return [league, date, String(game?.id || ''), String(game?.away || ''), String(game?.home || '')].join('|');
    }
"""
new = """    function homeGameDetailKey(league, date, game = {}) {
      return [league, date, String(game?.kindCode || ''), String(game?.id || ''), String(game?.away || ''), String(game?.home || '')].join('|');
    }
"""
if old not in s: raise SystemExit('homeGameDetailKey anchor missing')
s = s.replace(old, new, 1)

old = "const published = await window.__cpblRealtimeReadPublished(date, String(game.id));"
new = "const published = await window.__cpblRealtimeReadPublished(date, String(game.id), String(game?.kindCode || 'A'));"
if old not in s: raise SystemExit('readPublished caller missing')
s = s.replace(old, new, 1)

old = "window.dispatchEvent(new CustomEvent('cpbl-live-watch', { detail:{ date, gameId:String(game.id) } }));"
new = "window.dispatchEvent(new CustomEvent('cpbl-live-watch', { detail:{ date, gameId:String(game.id), kindCode:String(game?.kindCode || 'A') } }));"
if old not in s: raise SystemExit('cpbl live watch caller missing')
s = s.replace(old, new, 1)

old = """      const expectedId = String(game?.id || '');
      const incomingId = String(row?.game_id || detail?.game?.id || '');
      if (expectedId && incomingId && expectedId !== incomingId) return;
      const key = homeGameDetailKey('CPBL', date, game);
"""
new = """      const expectedId = String(game?.id || '');
      const incomingId = String(row?.game_id || detail?.game?.id || '');
      const expectedKind = String(game?.kindCode || 'A').toUpperCase();
      const incomingKind = String(row?.kind_code || detail?.kindCode || detail?.game?.kindCode || 'A').toUpperCase();
      if (expectedId && incomingId && expectedId !== incomingId) return;
      if (expectedKind !== incomingKind) return;
      const key = homeGameDetailKey('CPBL', date, game);
"""
if old not in s: raise SystemExit('CPBL detail realtime event anchor missing')
s = s.replace(old, new, 1)

old = """      const incomingId = String(row?.game_id || detail?.game?.id || '');
      const index = cached.games.findIndex(g => String(g?.id || '') === incomingId);
"""
new = """      const incomingId = String(row?.game_id || detail?.game?.id || '');
      const incomingKind = String(row?.kind_code || detail?.kindCode || detail?.game?.kindCode || 'A').toUpperCase();
      const index = cached.games.findIndex(g =>
        String(g?.id || '') === incomingId
        && String(g?.kindCode || 'A').toUpperCase() === incomingKind
      );
"""
if old not in s: raise SystemExit('CPBL day update lookup anchor missing')
s = s.replace(old, new, 1)

old = """      const target = games.find(item =>
        (info?.id && item?.id && String(info.id) === String(item.id))
        || (String(item?.away || '') === String(info?.away || game?.away || '')
          && String(item?.home || '') === String(info?.home || game?.home || ''))
      );
"""
new = """      const expectedKind = league === 'CPBL'
        ? String(info?.kindCode || game?.kindCode || 'A').toUpperCase()
        : '';
      const sameKind = item => league !== 'CPBL'
        || String(item?.kindCode || 'A').toUpperCase() === expectedKind;
      const target = games.find(item =>
        (((info?.id && item?.id && String(info.id) === String(item.id))
          || (String(item?.away || '') === String(info?.away || game?.away || '')
            && String(item?.home || '') === String(info?.home || game?.home || '')))
          && sameKind(item))
      );
"""
if old not in s: raise SystemExit('syncHomeDailyGameFromDetail lookup anchor missing')
s = s.replace(old, new, 1)

s = s.replace("const APP_VERSION = 'v2.88';", "const APP_VERSION = 'v2.89';", 1)
s = s.replace('v2.88','v2.89').replace('v288','v289')
p.write_text(s, encoding='utf-8')

for name in ['index.html','service-worker.js']:
    p = Path(name)
    x = p.read_text(encoding='utf-8').replace('v2.88','v2.89').replace('v288','v289')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v289', x)
    p.write_text(x, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.89'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print('v2.89 patch applied')
