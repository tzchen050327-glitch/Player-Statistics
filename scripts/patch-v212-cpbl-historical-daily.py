from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version bump
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.11';" not in s:
    raise SystemExit('expected v2.11 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.11';", "const APP_VERSION = 'v2.12';", 1)
s = s.replace("?v=v2.11", "?v=v2.12")
p.write_text(s, encoding='utf-8')

# Main shell wiring
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
if 'v2.11' not in s:
    raise SystemExit('expected v2.11 index wiring')
p.write_text(s.replace('v2.11', 'v2.12'), encoding='utf-8')

# PWA cache refresh
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
if 'baseball-player-card-pwa-v128' not in s:
    raise SystemExit('expected cache v128')
s = s.replace('baseball-player-card-pwa-v128', 'baseball-player-card-pwa-v129', 1)
s = s.replace('v2.11', 'v2.12')
p.write_text(s, encoding='utf-8')

# Rebuild runtime bundle
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# Archive policy: current + previous only
(ROOT / 'index v2.12.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old = ROOT / 'index v2.10.html'
if old.exists():
    old.unlink()
if not (ROOT / 'index v2.11.html').exists():
    raise SystemExit('index v2.11.html must remain')

print('v2.12 CPBL historical daily release wiring applied')
