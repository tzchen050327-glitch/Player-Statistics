from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version wiring
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.20';" not in s:
    raise SystemExit('expected v2.20 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.20';", "const APP_VERSION = 'v2.21';", 1)
s = s.replace('?v=v2.20', '?v=v2.21')
p.write_text(s, encoding='utf-8')

# Hide the completed-status pill for CPBL only. Scores remain visible.
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = """          const statusLabel = homeDailyGameStatusLabel(game);\n          const showScore = status === 'live' || status === 'final';"""
new = """          const statusLabel = league === 'CPBL' && status === 'final'\n            ? ''\n            : homeDailyGameStatusLabel(game);\n          const showScore = status === 'live' || status === 'final';"""
if old not in s:
    raise SystemExit('status label anchor not found')
s = s.replace(old, new, 1)
old = """                <span class=\"home-game-status status-${escapeAttr(status)}\">${escapeHtml(statusLabel)}</span>\n                ${game?.time && ['final','live'].includes(status) ? `<span class=\"home-game-time\">${escapeHtml(String(game.time))}</span>` : ''}"""
new = """                ${statusLabel ? `<span class=\"home-game-status status-${escapeAttr(status)}\">${escapeHtml(statusLabel)}</span>` : ''}\n                ${game?.time && ['final','live'].includes(status) ? `<span class=\"home-game-time\">${escapeHtml(String(game.time))}</span>` : ''}"""
if old not in s:
    raise SystemExit('status pill anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Index/archive/cache bust
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.20', 'v2.21')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.21.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.19.html'
if old_archive.exists(): old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v137', 'baseball-player-card-pwa-v138')
s = s.replace('v2.20', 'v2.21')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.21 hide CPBL final label patch applied')
