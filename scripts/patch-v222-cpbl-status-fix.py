from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.21';" not in s:
    raise SystemExit('expected v2.21 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.21';", "const APP_VERSION = 'v2.22';", 1)
s = s.replace('?v=v2.21', '?v=v2.22')
p.write_text(s, encoding='utf-8')

# Restore normal status-label rendering. Backend v4 now supplies the correct CPBL status/time.
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = """          const statusLabel = league === 'CPBL' && status === 'final'\n            ? ''\n            : homeDailyGameStatusLabel(game);\n          const showScore = status === 'live' || status === 'final';"""
new = """          const statusLabel = homeDailyGameStatusLabel(game);\n          const showScore = status === 'live' || status === 'final';"""
if old not in s:
    raise SystemExit('v2.21 status-label override not found')
s = s.replace(old, new, 1)
old = """                ${statusLabel ? `<span class=\"home-game-status status-${escapeAttr(status)}\">${escapeHtml(statusLabel)}</span>` : ''}\n                ${game?.time && ['final','live'].includes(status) ? `<span class=\"home-game-time\">${escapeHtml(String(game.time))}</span>` : ''}"""
new = """                <span class=\"home-game-status status-${escapeAttr(status)}\">${escapeHtml(statusLabel)}</span>\n                ${game?.time && ['final','live'].includes(status) ? `<span class=\"home-game-time\">${escapeHtml(String(game.time))}</span>` : ''}"""
if old not in s:
    raise SystemExit('conditional status pill not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.21', 'v2.22')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.22.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.20.html'
if old_archive.exists(): old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v138', 'baseball-player-card-pwa-v139')
s = s.replace('v2.21', 'v2.22')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.22 CPBL status fix applied')
