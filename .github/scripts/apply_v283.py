from pathlib import Path
import json, re

p = Path('app.js')
s = p.read_text(encoding='utf-8')

anchor = """      // A postseason card already knows its exact stage. Keep that context even if
      // an old NPB page contains generic navigation text for other competitions.
      if (game?.competition) {
        data.competition = String(game.competition);
        data.competitionLabel = String(game.competitionLabel || data.competitionLabel || '');
        if (data.game && typeof data.game === 'object') {
          data.game.competition = data.competition;
          data.game.competitionLabel = data.competitionLabel;
        }
      }
      return data;
"""
replacement = """      // A postseason card already knows its exact stage. Keep that context even if
      // an old NPB page contains generic navigation text for other competitions.
      if (game?.competition) {
        data.competition = String(game.competition);
        data.competitionLabel = String(game.competitionLabel || data.competitionLabel || '');
        if (data.game && typeof data.game === 'object') {
          data.game.competition = data.competition;
          data.game.competitionLabel = data.competitionLabel;
        }
      } else if (league === 'NPB') {
        // Normal NPB game cards have no postseason competition attached. Some NPB
        // pages include a generic 日本シリーズ navigation link, which the legacy
        // backend classifier can mistake for the active competition. Do not let a
        // regular game enter competition-scoped scoreboard mode because of that.
        data.competition = 'regular';
        data.competitionLabel = '例行賽';
        data.statsScope = 'season';
        if (data.authority && typeof data.authority === 'object') data.authority.statsScope = 'season';
        if (data.game && typeof data.game === 'object') {
          data.game.competition = 'regular';
          data.game.competitionLabel = '例行賽';
        }
      }
      return data;
"""
if anchor not in s:
    raise SystemExit('NPB detail normalization anchor not found')
s = s.replace(anchor, replacement, 1)
s = s.replace("const APP_VERSION = 'v2.82';", "const APP_VERSION = 'v2.83';", 1)
s = s.replace('?v=v2.82', '?v=v2.83')
p.write_text(s, encoding='utf-8')

for name in ['index.html','service-worker.js']:
    p = Path(name)
    s = p.read_text(encoding='utf-8').replace('v2.82','v2.83').replace('v282','v283')
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v283', s)
    p.write_text(s, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.83'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
print('v2.83 patch applied')
