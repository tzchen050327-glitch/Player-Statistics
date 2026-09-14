from pathlib import Path
import json, re

for name in ['app.js', 'index.html', 'styles.css', 'cpbl-realtime.js', 'service-worker.js', 'diagnostics.html']:
    p = Path(name)
    if not p.exists():
        continue
    s = p.read_text(encoding='utf-8')
    s = s.replace('v2.95', 'v2.96').replace('v295', 'v296')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v296', s)
    p.write_text(s, encoding='utf-8')

Path('version.json').write_text(
    json.dumps({'version': 'v2.96'}, ensure_ascii=False, separators=(',', ':')) + '\n',
    encoding='utf-8'
)

# Keep only current + immediately previous formal release artifacts.
for old_path in [
    '.github/scripts/apply_v294.py',
    '.github/workflows/apply-v294.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v2.96 NPB live cadence and pitcher-batting patch applied')
