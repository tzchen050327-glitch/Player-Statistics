from pathlib import Path
import json, re

# Landscape state must accept both CPBL and NPB direct detail responses.  Without
# this, an orientation change can briefly re-render from the last realtime copy.
p = Path('landscape-state.js')
s = p.read_text(encoding='utf-8')
s = re.sub(r"const VERSION = 'v[^']+';", "const VERSION = 'v2.97';", s, count=1)
old = "if (data?.ok && data?.game && String(data?.league || '').toUpperCase() === 'CPBL') {"
new = "if (data?.ok && data?.game && ['CPBL','NPB'].includes(String(data?.league || '').toUpperCase())) {"
if old not in s:
    raise SystemExit('landscape NPB direct-detail interception anchor missing')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Formal version bump.  Backend NPB parser/updater changes are deployed in
# Supabase; these files carry the matching web release/cache version.
for name in [
    'app.js', 'index.html', 'styles.css', 'cpbl-realtime.js', 'npb-realtime.js',
    'service-worker.js', 'diagnostics.html', 'game-detail-enhancement.js',
    'game-detail-enhancement.css', 'report-layout.js', 'report-layout.css',
    'postseason-history.js', 'landscape-state.css', 'cpbl-cache-router.js',
    'live-static-update.js'
]:
    q = Path(name)
    if not q.exists():
        continue
    x = q.read_text(encoding='utf-8').replace('v2.96', 'v2.97').replace('v296', 'v297')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v297', x)
    q.write_text(x, encoding='utf-8')

Path('version.json').write_text(
    json.dumps({'version': 'v2.97'}, ensure_ascii=False, separators=(',', ':')) + '\n',
    encoding='utf-8'
)

# Keep only current + immediately previous formal release artifacts.
for old_path in [
    '.github/scripts/apply_v295.py',
    '.github/scripts/smoke_v295.mjs',
    '.github/workflows/apply-v295.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v2.97 NPB pitcher batting and landscape-state patch applied')
