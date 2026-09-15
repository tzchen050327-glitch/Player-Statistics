from pathlib import Path
import json, re

for name in [
    'app.js','index.html','styles.css','cpbl-realtime.js','npb-realtime.js',
    'service-worker.js','diagnostics.html','game-detail-enhancement.js',
    'game-detail-enhancement.css','report-layout.js','report-layout.css',
    'postseason-history.js','landscape-state.js','landscape-state.css',
    'cpbl-cache-router.js','live-static-update.js'
]:
    p=Path(name)
    if not p.exists():
        continue
    s=p.read_text(encoding='utf-8').replace('v3.07','v3.08').replace('v307','v308')
    if name=='service-worker.js':
        s=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v308',s)
    p.write_text(s,encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v3.08'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

# Keep only current + immediately previous release artifacts.
for old_path in [
    '.github/scripts/apply_v306.py',
    '.github/scripts/smoke_v306.mjs',
    '.github/workflows/apply-v306.yml',
    '.github/scripts/probe_cpbl_time.py',
    '.github/workflows/probe-cpbl-time.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.08 release wiring applied: CPBL/NPB final stat freeze + CPBL source timing')
