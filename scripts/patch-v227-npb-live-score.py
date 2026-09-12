from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.26';" not in s:
    raise SystemExit('expected v2.26')
s = s.replace("const APP_VERSION = 'v2.26';", "const APP_VERSION = 'v2.27';", 1)
s = s.replace("const LEAGUE_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-daily-games';",
              "const LEAGUE_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-daily-games';\n    const NPB_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/npb-live-games';", 1)
s = s.replace('?v=v2.26', '?v=v2.27')
p.write_text(s, encoding='utf-8')

p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = "const response = await fetch(LEAGUE_GAMES_API_URL, {"
new = "const response = await fetch(league === 'NPB' ? NPB_GAMES_API_URL : LEAGUE_GAMES_API_URL, {"
if old not in s:
    raise SystemExit('daily games fetch anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.26', 'v2.27')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.27.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.25.html'
if old_archive.exists():
    old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8').replace('baseball-player-card-pwa-v143', 'baseball-player-card-pwa-v144').replace('v2.26', 'v2.27')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.27 patch applied')
