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
    text=p.read_text(encoding='utf-8').replace('v3.09','v3.10').replace('v309','v310')
    if name=='service-worker.js':
        text=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v310',text)
    p.write_text(text,encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v3.10'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

# Keep only current + immediately previous release artifacts.
for old_path in [
    '.github/scripts/apply_v308.py',
    '.github/scripts/smoke_v308.mjs',
    '.github/workflows/apply-v308.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.10 release wiring applied: MLB US-date cache stays mutable until all games are terminal')
