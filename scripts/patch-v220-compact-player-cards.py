from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version wiring
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.19';" not in s:
    raise SystemExit('expected v2.19 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.19';", "const APP_VERSION = 'v2.20';", 1)
s = s.replace('?v=v2.19', '?v=v2.20')
p.write_text(s, encoding='utf-8')

p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
s = s.replace('v2.19', 'v2.20')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.20.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.18.html'
if old_archive.exists():
    old_archive.unlink()

# Compact homepage player cards without changing the information shown.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.20 compact homepage player cards */
#homePage #recentPlayers{
  gap:8px !important;
}
#homePage #recentPlayers .home-player-card{
  min-height:66px !important;
  padding:8px 10px !important;
  border-radius:13px;
  flex-direction:row !important;
  align-items:center !important;
  gap:10px !important;
}
#homePage #recentPlayers .home-player-number{
  flex:0 0 auto;
  min-width:39px;
  height:32px;
  padding:0 7px;
  font-size:13px;
}
#homePage #recentPlayers .home-player-card > span:last-child{
  flex:1 1 auto;
  width:auto;
  min-width:0;
}
#homePage #recentPlayers .home-player-name{
  margin-top:0;
  font-size:14px;
  line-height:1.18;
}
#homePage #recentPlayers .home-player-meta{
  margin-top:3px;
  font-size:10px;
  line-height:1.25;
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
  overflow:hidden;
}
@media (max-width: 560px){
  #homePage #recentPlayers .home-player-card{
    min-height:62px !important;
    padding:7px 9px !important;
    gap:9px !important;
  }
  #homePage #recentPlayers .home-player-number{
    min-width:37px;
    height:30px;
    font-size:12px;
  }
  #homePage #recentPlayers .home-player-name{font-size:13px}
  #homePage #recentPlayers .home-player-meta{font-size:9.5px}
}
'''
if '/* v2.20 compact homepage player cards */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# Service worker cache bust
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace("baseball-player-card-pwa-v136", "baseball-player-card-pwa-v137")
s = s.replace('v2.19', 'v2.20')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.20 compact player cards patch applied')
