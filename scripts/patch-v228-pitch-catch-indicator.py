from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version bump
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.27';" not in s:
    raise SystemExit('expected v2.27')
s = s.replace("const APP_VERSION = 'v2.27';", "const APP_VERSION = 'v2.28';", 1)
s = s.replace('?v=v2.27', '?v=v2.28')
p.write_text(s, encoding='utf-8')

# Replace the live refresh rail with an animated pitcher/catcher scene.
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = """${homeDailyGamesHasLive(games) && homeDailyGamesAutoRefreshAvailable() ? `<span class=\"home-live-refresh-rail ${loading ? 'is-refreshing' : ''}\" title=\"比賽進行中，自動更新比分\" aria-label=\"比賽進行中，自動更新比分\"><i></i></span>` : ''}"""
new = """${homeDailyGamesHasLive(games) && homeDailyGamesAutoRefreshAvailable() ? `<span class=\"home-live-catchplay ${loading ? 'is-refreshing' : ''}\" title=\"比賽進行中，自動更新比分\" aria-label=\"比賽進行中，自動更新比分\">\n                  <svg class=\"home-live-player home-live-pitcher\" viewBox=\"0 0 22 22\" aria-hidden=\"true\">\n                    <circle cx=\"6\" cy=\"4\" r=\"2.1\"></circle>\n                    <path d=\"M6 6.7 8.3 10.2 12.8 7.9M8.3 10.2 6.1 16.7M8.3 10.2 11.4 16.5M12.8 7.9 15.2 6.5\"></path>\n                  </svg>\n                  <span class=\"home-live-ball\"></span>\n                  <svg class=\"home-live-player home-live-catcher\" viewBox=\"0 0 22 22\" aria-hidden=\"true\">\n                    <circle cx=\"15.5\" cy=\"4.4\" r=\"2.1\"></circle>\n                    <path d=\"M15.3 6.7 13.8 10.4 9.3 9.2M13.8 10.4 10.4 15.8M13.8 10.4 17.4 15.8M9.3 9.2 7.2 8.4\"></path>\n                    <path class=\"home-live-mitt\" d=\"M6.3 6.9c-1.3.4-2.1 1.4-1.8 2.4.4 1.2 1.8 1.6 3.1.8 1-.6 1.3-1.8.6-2.6-.5-.6-1.2-.8-1.9-.6Z\"></path>\n                  </svg>\n                </span>` : ''}"""
if old not in s:
    raise SystemExit('live refresh rail markup not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Add compact animated pitcher/catcher CSS while preserving layout height.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.28 live pitcher/catcher refresh indicator */
.home-live-catchplay{
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:space-between;
  flex:1 1 auto;
  min-width:66px;
  height:17px;
  overflow:hidden;
  color:#315777;
  vertical-align:middle;
}
.home-live-player{
  position:relative;
  z-index:2;
  flex:0 0 19px;
  width:19px;
  height:19px;
  overflow:visible;
  fill:#315777;
  stroke:#315777;
  stroke-width:1.65;
  stroke-linecap:round;
  stroke-linejoin:round;
}
.home-live-player circle{stroke:none}
.home-live-player path{fill:none}
.home-live-catcher .home-live-mitt{fill:#d7ad52;stroke:#b08328;stroke-width:1.15;transform-origin:6.8px 8.7px;animation:homeLiveMittCatch 1.55s ease-in-out infinite}
.home-live-pitcher{transform-origin:8px 11px;animation:homeLivePitcherMotion 1.55s ease-in-out infinite}
.home-live-ball{
  position:absolute;
  z-index:3;
  top:6px;
  left:19px;
  width:5px;
  height:5px;
  border-radius:50%;
  background:#e4b447;
  box-shadow:0 0 5px rgba(228,180,71,.72);
  animation:homeLivePitchFlight 1.55s cubic-bezier(.3,.02,.55,.98) infinite;
}
.home-live-catchplay::after{
  content:'';
  position:absolute;
  z-index:0;
  left:20px;
  right:20px;
  bottom:2px;
  height:1px;
  border-radius:999px;
  background:linear-gradient(90deg,transparent,rgba(49,87,119,.12),transparent);
}
.home-live-catchplay.is-refreshing .home-live-ball,
.home-live-catchplay.is-refreshing .home-live-pitcher,
.home-live-catchplay.is-refreshing .home-live-mitt{animation-duration:.82s}
@keyframes homeLivePitchFlight{
  0%,12%{left:19px;opacity:0;transform:translateY(1px) scale(.85)}
  17%{opacity:1}
  64%{left:calc(100% - 24px);opacity:1;transform:translateY(-1px) scale(1)}
  70%,100%{left:calc(100% - 24px);opacity:0;transform:translateY(0) scale(.85)}
}
@keyframes homeLivePitcherMotion{
  0%,8%,100%{transform:rotate(0deg) translateX(0)}
  18%{transform:rotate(-8deg) translateX(-1px)}
  32%{transform:rotate(7deg) translateX(1px)}
  46%,85%{transform:rotate(0deg) translateX(0)}
}
@keyframes homeLiveMittCatch{
  0%,52%,100%{transform:scale(1)}
  63%{transform:scale(1.18) rotate(-5deg)}
  74%{transform:scale(.96)}
}
@media(max-width:720px){
  .home-live-catchplay{width:100%;min-width:0;height:17px}
}
@media(prefers-reduced-motion:reduce){
  .home-live-ball{animation-duration:3.2s}
  .home-live-pitcher,.home-live-catcher .home-live-mitt{animation:none}
}
'''
if '/* v2.28 live pitcher/catcher refresh indicator */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# HTML archive and cache bust.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.27', 'v2.28')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.28.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.26.html'
if old_archive.exists():
    old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v144', 'baseball-player-card-pwa-v145')
s = s.replace('v2.27', 'v2.28')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.28 pitcher/catcher indicator patch applied')
