from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version bump.
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.28';" not in s:
    raise SystemExit('expected v2.28')
s = s.replace("const APP_VERSION = 'v2.28';", "const APP_VERSION = 'v2.29';", 1)
s = s.replace('?v=v2.28', '?v=v2.29')
p.write_text(s, encoding='utf-8')

# Replace the rough v2.28 line figures with compact filled baseball characters.
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = '''${homeDailyGamesHasLive(games) && homeDailyGamesAutoRefreshAvailable() ? `<span class="home-live-catchplay ${loading ? 'is-refreshing' : ''}" title="比賽進行中，自動更新比分" aria-label="比賽進行中，自動更新比分">
                  <svg class="home-live-player home-live-pitcher" viewBox="0 0 22 22" aria-hidden="true">
                    <circle cx="6" cy="4" r="2.1"></circle>
                    <path d="M6 6.7 8.3 10.2 12.8 7.9M8.3 10.2 6.1 16.7M8.3 10.2 11.4 16.5M12.8 7.9 15.2 6.5"></path>
                  </svg>
                  <span class="home-live-ball"></span>
                  <svg class="home-live-player home-live-catcher" viewBox="0 0 22 22" aria-hidden="true">
                    <circle cx="15.5" cy="4.4" r="2.1"></circle>
                    <path d="M15.3 6.7 13.8 10.4 9.3 9.2M13.8 10.4 10.4 15.8M13.8 10.4 17.4 15.8M9.3 9.2 7.2 8.4"></path>
                    <path class="home-live-mitt" d="M6.3 6.9c-1.3.4-2.1 1.4-1.8 2.4.4 1.2 1.8 1.6 3.1.8 1-.6 1.3-1.8.6-2.6-.5-.6-1.2-.8-1.9-.6Z"></path>
                  </svg>
                </span>` : ''}'''
new = '''${homeDailyGamesHasLive(games) && homeDailyGamesAutoRefreshAvailable() ? `<span class="home-live-battery ${loading ? 'is-refreshing' : ''}" title="比賽進行中，自動更新比分" aria-label="比賽進行中，自動更新比分">
                  <svg class="battery-player battery-pitcher" viewBox="0 0 44 44" aria-hidden="true">
                    <g class="battery-pitcher-figure">
                      <path class="battery-cap" d="M9 8.7c1.2-4 4.4-6.2 8.4-5.5 2.8.5 4.7 2.1 5.8 4.7l-9.3 1.9Z"></path>
                      <circle class="battery-skin" cx="16.4" cy="10.8" r="4.2"></circle>
                      <path class="battery-uniform" d="M12.8 15.1c2-1.2 5.7-1.1 7.8.2l3.5 9.4-3.5 3.2-4-7.3-3.1 7.1-4-2.2Z"></path>
                      <path class="battery-leg" d="M12.9 25.4 8.5 36.6l4.2 1 4.2-9.8 5.4 9 3.8-1.8-5.8-11Z"></path>
                      <path class="battery-throw-arm" d="M20.2 16.4c5.5 1 9.6 4 12.9 7.2l-2.7 2.8c-3-2.7-6.8-4.8-11.1-5.5Z"></path>
                      <path class="battery-glove-arm" d="M12.5 16.9 6.8 21.2l2 3.4 6.4-3.6Z"></path>
                      <ellipse class="battery-glove" cx="6.6" cy="22.5" rx="3.8" ry="3.1"></ellipse>
                      <circle class="battery-hand" cx="33" cy="24.8" r="1.7"></circle>
                    </g>
                  </svg>
                  <span class="battery-ball"><i></i></span>
                  <svg class="battery-player battery-catcher" viewBox="0 0 44 44" aria-hidden="true">
                    <g class="battery-catcher-crouch">
                      <path class="battery-mask" d="M14 5.6c2.2-2.1 6.4-2.4 9-.6l1.7 4.5-2.4 5.2-7.7-.4-2.1-5.1Z"></path>
                      <path class="battery-mask-line" d="M14.5 8.6h9.2M16.1 5.8l-.3 7.1M21.2 5.5l.7 7.4"></path>
                      <path class="battery-chest" d="M13.7 14.1c3-1.2 7.5-1 10 .5l2.2 10-5.3 2.8-4.2-1-4.6-2.4Z"></path>
                      <path class="battery-catcher-leg" d="m14 23.6-7 7.6 3.7 3.5 7.5-5.4 6.8 5.2 3.4-3.4-6.4-7.5Z"></path>
                      <path class="battery-receive-arm" d="M13.8 16.1 6.7 19l1.6 3.7 7.8-2.6Z"></path>
                      <ellipse class="battery-mitt" cx="5.7" cy="20.7" rx="4.2" ry="3.4"></ellipse>
                    </g>
                    <g class="battery-catcher-stand">
                      <path class="battery-mask" d="M14.8 3.8c2.2-2 6.2-2.2 8.8-.4l1.5 4.1-2.1 4.9-7.6-.3-2-4.9Z"></path>
                      <path class="battery-mask-line" d="M15.2 6.6h9M16.8 4l-.3 7M21.8 3.9l.6 7"></path>
                      <path class="battery-chest" d="M14.1 12.1c3.1-1.2 7.2-1.1 9.7.4l2 10.2-4.6 2.2-4.4-.5-4.2-2.8Z"></path>
                      <path class="battery-stand-leg" d="m15.3 22.1-3.7 14.7 4.1.8 3.5-10.7 4 10.5 4-1.2-4.1-14Z"></path>
                      <g class="battery-return-arm">
                        <path d="M22.8 13.5c4.9 1 8.3 4.1 10.7 7.1l-2.6 2.5c-2.8-2.8-5.8-4.7-9.4-5.2Z"></path>
                        <circle class="battery-hand" cx="33.4" cy="21.9" r="1.7"></circle>
                      </g>
                      <path class="battery-glove-arm" d="M14.2 14.3 8.1 18l1.7 3.3 6.8-3.4Z"></path>
                      <ellipse class="battery-glove" cx="7.7" cy="19.4" rx="3.4" ry="2.9"></ellipse>
                    </g>
                  </svg>
                </span>` : ''}'''
if old not in s:
    raise SystemExit('v2.28 catchplay markup not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Refined animation: pitcher delivers, catcher receives, stands, throws it back, crouches again.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.29 refined pitcher/catcher live indicator */
.home-live-battery{
  --battery-cycle:2.65s;
  position:relative;
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex:1 1 auto;
  min-width:82px;
  height:27px;
  overflow:hidden;
  isolation:isolate;
  filter:drop-shadow(0 1px 1px rgba(24,58,90,.08));
}
.home-live-battery.is-refreshing{--battery-cycle:1.35s}
.home-live-battery::before{
  content:'';
  position:absolute;
  left:29px;
  right:29px;
  bottom:3px;
  height:1px;
  background:linear-gradient(90deg,transparent,rgba(31,78,121,.14) 18%,rgba(215,173,82,.25) 50%,rgba(31,78,121,.14) 82%,transparent);
}
.battery-player{
  position:relative;
  z-index:2;
  width:28px;
  height:28px;
  flex:0 0 28px;
  overflow:visible;
}
.battery-player .battery-cap,
.battery-player .battery-uniform,
.battery-player .battery-leg,
.battery-player .battery-throw-arm,
.battery-player .battery-glove-arm,
.battery-player .battery-chest,
.battery-player .battery-catcher-leg,
.battery-player .battery-stand-leg,
.battery-player .battery-return-arm path,
.battery-player .battery-receive-arm{fill:#214e75}
.battery-player .battery-skin,
.battery-player .battery-hand{fill:#e5ba73}
.battery-player .battery-glove,
.battery-player .battery-mitt{fill:#c89537;stroke:#9b6d1e;stroke-width:1}
.battery-player .battery-mask{fill:#173d60}
.battery-player .battery-mask-line{fill:none;stroke:#d7ad52;stroke-width:1.25;stroke-linecap:round}
.battery-pitcher-figure{
  transform-box:fill-box;
  transform-origin:45% 62%;
  animation:batteryPitcherDeliver var(--battery-cycle) cubic-bezier(.45,.02,.28,1) infinite;
}
.battery-catcher-crouch,
.battery-catcher-stand{
  transform-box:fill-box;
  transform-origin:center bottom;
}
.battery-catcher-crouch{animation:batteryCatcherCrouch var(--battery-cycle) ease-in-out infinite}
.battery-catcher-stand{opacity:0;animation:batteryCatcherStand var(--battery-cycle) ease-in-out infinite}
.battery-return-arm{
  transform-box:fill-box;
  transform-origin:20% 55%;
  animation:batteryReturnArm var(--battery-cycle) ease-in-out infinite;
}
.battery-mitt{
  transform-box:fill-box;
  transform-origin:center;
  animation:batteryMittPop var(--battery-cycle) ease-in-out infinite;
}
.battery-ball{
  position:absolute;
  z-index:5;
  left:27px;
  top:7px;
  width:7px;
  height:7px;
  opacity:0;
  animation:batteryBallRoundTrip var(--battery-cycle) cubic-bezier(.28,.03,.58,.98) infinite;
}
.battery-ball i{
  position:absolute;
  inset:0;
  border-radius:50%;
  background:#fffdfa;
  border:1px solid #d9d2c8;
  box-shadow:0 0 6px rgba(215,173,82,.66),0 1px 2px rgba(26,61,92,.16);
}
.battery-ball i::before,
.battery-ball i::after{
  content:'';
  position:absolute;
  top:1.2px;
  width:2px;
  height:4px;
  border-radius:50%;
  border-left:1px solid #b74b45;
}
.battery-ball i::before{left:1.1px;transform:rotate(19deg)}
.battery-ball i::after{right:.8px;transform:rotate(199deg)}
@keyframes batteryPitcherDeliver{
  0%,6%,44%,100%{transform:translate(0,0) rotate(0deg)}
  10%{transform:translate(-1px,-1px) rotate(-5deg)}
  18%{transform:translate(1px,-3px) rotate(-10deg)}
  27%{transform:translate(3px,1px) rotate(8deg)}
  35%{transform:translate(1px,0) rotate(2deg)}
}
@keyframes batteryBallRoundTrip{
  0%,13%{left:27px;top:7px;opacity:0;transform:scale(.8) rotate(0deg)}
  16%{opacity:1}
  38%{left:calc(100% - 34px);top:9px;opacity:1;transform:scale(1) rotate(320deg)}
  43%{left:calc(100% - 34px);top:9px;opacity:0;transform:scale(.88) rotate(350deg)}
  59%{left:calc(100% - 31px);top:4px;opacity:0;transform:scale(.82) rotate(360deg)}
  62%{opacity:1}
  82%{left:28px;top:7px;opacity:1;transform:scale(1) rotate(40deg)}
  87%,100%{left:28px;top:7px;opacity:0;transform:scale(.82) rotate(70deg)}
}
@keyframes batteryMittPop{
  0%,33%,48%,100%{transform:scale(1) rotate(0deg)}
  39%{transform:scale(1.28) rotate(-7deg)}
  44%{transform:scale(.96) rotate(1deg)}
}
@keyframes batteryCatcherCrouch{
  0%,42%,88%,100%{opacity:1;transform:translateY(1px) scaleY(.98)}
  48%,82%{opacity:0;transform:translateY(-2px) scaleY(1.06)}
}
@keyframes batteryCatcherStand{
  0%,44%,86%,100%{opacity:0;transform:translateY(3px) scaleY(.92)}
  51%,78%{opacity:1;transform:translateY(-1px) scaleY(1)}
}
@keyframes batteryReturnArm{
  0%,54%,79%,100%{transform:rotate(0deg)}
  60%{transform:rotate(-34deg)}
  68%{transform:rotate(18deg)}
  74%{transform:rotate(2deg)}
}
@media(max-width:720px){
  .home-live-battery{width:100%;min-width:0;height:27px}
}
@media(prefers-reduced-motion:reduce){
  .home-live-battery{--battery-cycle:4.5s}
}
'''
if '/* v2.29 refined pitcher/catcher live indicator */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# Versioned archive + service worker cache.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.28', 'v2.29')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.29.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.27.html'
if old_archive.exists():
    old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v145', 'baseball-player-card-pwa-v146')
s = s.replace('v2.28', 'v2.29')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.29 refined battery animation patch applied')
