from pathlib import Path
import json, re

# v2.90 records the production backend next-game correction:
# CPBL next-game ignores schedule rows earlier than today's Taiwan date.
for name in ['app.js','index.html','service-worker.js','cpbl-realtime.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8').replace('v2.89','v2.90').replace('v289','v290')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v290', s)
    p.write_text(s, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.90'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print('v2.90 release metadata applied')
