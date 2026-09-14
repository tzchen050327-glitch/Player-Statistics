from pathlib import Path
import json, re

p = Path('app.js')
s = p.read_text(encoding='utf-8')

# Home CPBL daily schedule must request only A/E/C from the backend.
old = """        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'daily-games',
          league,
          date
        })
"""
new = """        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'daily-games',
          league,
          date,
          ...(league === 'CPBL' ? { kindCodes:['A','E','C'] } : {})
        })
"""
if old not in s:
    raise SystemExit('leagueDailyGamesRequest body anchor missing')
s = s.replace(old, new, 1)

# Keep the client-side D filter as defense in depth even though D is no longer requested.
if "filter(game => String(game?.kindCode || 'A').toUpperCase() !== 'D')" not in s:
    raise SystemExit('CPBL D defensive filter missing')

s = s.replace("const APP_VERSION = 'v2.94';", "const APP_VERSION = 'v2.95';", 1)
s = s.replace('v2.94', 'v2.95').replace('v294', 'v295')
p.write_text(s, encoding='utf-8')

for name in ['index.html', 'styles.css', 'cpbl-realtime.js', 'service-worker.js', 'diagnostics.html']:
    q = Path(name)
    if not q.exists():
        continue
    x = q.read_text(encoding='utf-8').replace('v2.94', 'v2.95').replace('v294', 'v295')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v295', x)
    q.write_text(x, encoding='utf-8')

Path('version.json').write_text(
    json.dumps({'version': 'v2.95'}, ensure_ascii=False, separators=(',', ':')) + '\n',
    encoding='utf-8'
)

# Keep only the current and immediately previous formal release artifacts.
for old_path in [
    '.github/scripts/apply_v293.py',
    '.github/workflows/apply-v293.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v2.95 integration hardening patch applied')
