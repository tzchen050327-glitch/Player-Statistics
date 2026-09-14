from pathlib import Path
import json, re

# app.js: normal CPBL game opens must prefer the Supabase-published payload.
p = Path('app.js')
s = p.read_text(encoding='utf-8')
old = """        let detail = null;
        if (league === 'CPBL' && date === localISODate() && game?.id && typeof window.__cpblRealtimeReadPublished === 'function') {
          try {
            const published = await window.__cpblRealtimeReadPublished(date, String(game.id));
            detail = published?.detail || null;
          } catch {}
        }
"""
new = """        let detail = null;
        let fromPublishedCache = false;
        if (!force && league === 'CPBL' && date === localISODate() && game?.id && typeof window.__cpblRealtimeReadPublished === 'function') {
          try {
            const published = await window.__cpblRealtimeReadPublished(date, String(game.id));
            detail = published?.detail || null;
            fromPublishedCache = Boolean(detail);
          } catch {}
        }
"""
if old not in s:
    raise SystemExit('CPBL published-cache read anchor not found')
s = s.replace(old, new, 1)

old = """        if (String(detail?.status || '').toLowerCase() === 'scheduled' && (league === 'CPBL' || league === 'NPB')) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
          }
        }
"""
new = """        if (String(detail?.status || '').toLowerCase() === 'scheduled' && (league === 'CPBL' || league === 'NPB') && (!fromPublishedCache || force)) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
          }
        }
"""
if old not in s:
    raise SystemExit('pregame request anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# cpbl-realtime.js: published payload is a general game cache, not live-only.
p = Path('cpbl-realtime.js')
s = p.read_text(encoding='utf-8')
s = s.replace("const VERSION = 'v2.77';", "const VERSION = 'v2.86';", 1)
old = "return { ok:Boolean(detail) && isLiveStatus(status), detail:isLiveStatus(status) ? detail : null, row, gameStatus:status };"
new = "return { ok:Boolean(detail), detail, row, gameStatus:status, isLive:isLiveStatus(status) };"
if old not in s:
    raise SystemExit('readPublished return anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Version bump + PWA cache bust.
for name in ['app.js','index.html','service-worker.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8').replace('v2.85','v2.86').replace('v285','v286')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v286', s)
    p.write_text(s, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.86'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')

# Keep only current + previous version artifacts.
for old_path in ['.github/scripts/apply_v284.py', '.github/workflows/apply-v284.yml']:
    Path(old_path).unlink(missing_ok=True)

print('v2.86 patch applied')
