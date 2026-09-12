from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version wiring
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.23';" not in s:
    raise SystemExit('expected v2.23 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.23';", "const APP_VERSION = 'v2.24';", 1)
s = s.replace('?v=v2.23', '?v=v2.24')
p.write_text(s, encoding='utf-8')

# Stretch the live activity rail through the available header width and keep
# the score area the same height while official schedule data is loading.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.24 full-width live activity rail + stable daily-games height */
.home-daily-games-title{flex:1 1 auto;min-width:0}
.home-league-live-row{display:inline-flex;align-items:center;gap:7px;min-width:0;flex:1 1 auto}
.home-league-live-row>span:first-child{flex:0 0 auto}
.home-live-refresh-rail{position:relative;display:inline-block;flex:1 1 auto;width:auto;min-width:54px;height:7px;border-radius:999px;overflow:hidden;background:#dce7f1;box-shadow:inset 0 0 0 1px rgba(31,78,121,.08);vertical-align:middle}
.home-live-refresh-rail i{position:absolute;top:1px;left:2px;width:13px;height:5px;border-radius:999px;background:linear-gradient(90deg,#d7ad52,#f3d47d,#d7ad52);box-shadow:0 0 5px rgba(215,173,82,.48);animation:homeLiveRefreshSweepFull 1.55s ease-in-out infinite alternate}
.home-live-refresh-rail.is-refreshing i{animation-duration:.62s;box-shadow:0 0 8px rgba(215,173,82,.78)}
@keyframes homeLiveRefreshSweepFull{from{left:2px}to{left:calc(100% - 15px)}}
.home-games-state{min-height:107px}

@media(max-width:720px){
  .home-daily-games-head{position:relative;display:block;min-height:42px;margin-bottom:6px}
  .home-daily-games-title{display:grid;grid-template-rows:auto auto;gap:2px;width:100%;min-width:0}
  .home-daily-games-meta{position:absolute;top:1px;right:0;min-height:20px;z-index:1}
  .home-league-live-row{display:flex;width:100%;padding-right:0}
  .home-live-refresh-rail{min-width:0;max-width:none}
  .home-games-state{min-height:99px}
}
'''
if '/* v2.24 full-width live activity rail + stable daily-games height */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# Main page + archive
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.23', 'v2.24')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.24.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.22.html'
if old_archive.exists():
    old_archive.unlink()

# PWA cache namespace
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v140', 'baseball-player-card-pwa-v141')
s = s.replace('v2.23', 'v2.24')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.24 live rail layout patch applied')
