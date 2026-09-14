from pathlib import Path
import json, re

# v2.87 records the production CPBL pregame background-prefetch architecture.
for name in ['app.js','index.html','service-worker.js','cpbl-realtime.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8').replace('v2.86','v2.87').replace('v286','v287')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v287', s)
    p.write_text(s, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.87'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')

# Keep only the current and immediately previous release artifacts.
for old_path in ['.github/scripts/apply_v285.py', '.github/workflows/apply-v285.yml']:
    Path(old_path).unlink(missing_ok=True)

print('v2.87 release metadata applied')
