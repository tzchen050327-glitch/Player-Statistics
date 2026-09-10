from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version + default artwork cache busting
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.10';" not in s:
    raise SystemExit('expected v2.10 config')
s = s.replace("const APP_VERSION = 'v2.10';", "const APP_VERSION = 'v2.11';", 1)
s = s.replace("./assets/default-hitter.jpg?v=v2.10", "./assets/default-hitter.jpg?v=v2.11")
s = s.replace("./assets/default-pitcher.jpg?v=v2.10", "./assets/default-pitcher.jpg?v=v2.11")
p.write_text(s, encoding='utf-8')

# Main HTML wiring
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
if 'v2.10' not in s:
    raise SystemExit('expected v2.10 index wiring')
p.write_text(s.replace('v2.10', 'v2.11'), encoding='utf-8')

# PWA cache + URLs
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
if 'baseball-player-card-pwa-v127' not in s:
    raise SystemExit('expected service worker cache v127')
s = s.replace('baseball-player-card-pwa-v127', 'baseball-player-card-pwa-v128', 1)
s = s.replace('v2.10', 'v2.11')
p.write_text(s, encoding='utf-8')

# Rebuild deterministic bundle
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# Version archive policy: current + previous only
(ROOT / 'index v2.11.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old = ROOT / 'index v2.09.html'
if old.exists():
    old.unlink()
if not (ROOT / 'index v2.10.html').exists():
    raise SystemExit('index v2.10.html must remain as previous version')

print('v2.11 artwork update applied')
