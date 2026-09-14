from pathlib import Path
import json, re

p = Path('app.js')
s = p.read_text(encoding='utf-8')

old = """      return Array.isArray(data.games) ? data.games : [];
    }


    function homeGameDetailSupported(league) {
"""
new = """      let games = Array.isArray(data.games) ? data.games : [];
      // CPBL schedule history can occasionally omit an end marker and look live/scheduled.
      // A date before today is immutable history in the UI, so normalize those states to FINAL.
      if (league === 'CPBL' && String(date || '') < localISODate()) {
        games = games.map(game => {
          const status = String(game?.status || '').toLowerCase();
          return ['live','scheduled','suspended'].includes(status)
            ? { ...game, status:'final' }
            : game;
        });
      }
      return games;
    }


    function homeGameDetailSupported(league) {
"""
if old not in s:
    raise SystemExit('leagueDailyGamesRequest return anchor missing')
s = s.replace(old, new, 1)

s = s.replace("const APP_VERSION = 'v2.91';", "const APP_VERSION = 'v2.92';", 1)
s = s.replace('v2.91','v2.92').replace('v291','v292')
p.write_text(s, encoding='utf-8')

for name in ['index.html','cpbl-realtime.js','service-worker.js','diagnostics.html']:
    q = Path(name)
    x = q.read_text(encoding='utf-8').replace('v2.91','v2.92').replace('v291','v292')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v292', x)
    q.write_text(x, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.92'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')

# Keep only current + immediately previous formal release artifacts.
for old_path in ['.github/scripts/apply_v290.py', '.github/workflows/apply-v290.yml']:
    Path(old_path).unlink(missing_ok=True)

print('v2.92 cache accuracy guards applied')
