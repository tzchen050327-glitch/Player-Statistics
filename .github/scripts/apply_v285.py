from pathlib import Path
import json, re

p = Path('app.js')
s = p.read_text(encoding='utf-8')
old = """      } else if (league === 'NPB') {
        // Normal NPB game cards have no postseason competition attached. Some NPB
        // pages include a generic 日本シリーズ navigation link, which the legacy
        // backend classifier can mistake for the active competition. Do not let a
        // regular game enter competition-scoped scoreboard mode because of that.
        data.competition = 'regular';
        data.competitionLabel = '例行賽';
"""
new = """      } else if (league === 'NPB') {
        // Normal NPB game cards have no postseason competition attached. Some NPB
        // pages include a generic 日本シリーズ navigation link, which the legacy
        // backend classifier can mistake for the active competition. Normalize the
        // whole scope, not just the label, so the lineup header cannot still render
        // LINEUP · 日本大賽 from a stale competition-scoped statsScope.
        data.competition = 'regular';
        data.competitionLabel = '例行賽';
        data.statsScope = 'season';
        if (data.authority && typeof data.authority === 'object') data.authority.statsScope = 'season';
        if (data.game && typeof data.game === 'object') {
          data.game.competition = 'regular';
          data.game.competitionLabel = '例行賽';
        }
"""
if old not in s:
    raise SystemExit('NPB regular normalization anchor not found')
s = s.replace(old, new, 1)
s = s.replace("const APP_VERSION = 'v2.84';", "const APP_VERSION = 'v2.85';", 1)
s = s.replace('v2.84','v2.85')
p.write_text(s, encoding='utf-8')

for name in ['index.html','service-worker.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8').replace('v2.84','v2.85').replace('v284','v285')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v285', s)
    p.write_text(s, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.85'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print('v2.85 patch applied')
