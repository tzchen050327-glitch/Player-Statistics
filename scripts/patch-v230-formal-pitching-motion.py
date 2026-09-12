from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.29';" not in s:
    raise SystemExit('expected v2.29')
s = s.replace("const APP_VERSION = 'v2.29';", "const APP_VERSION = 'v2.30';", 1)
s = s.replace('?v=v2.29', '?v=v2.30')
p.write_text(s, encoding='utf-8')

p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = '''                  <svg class="battery-player battery-pitcher" viewBox="0 0 44 44" aria-hidden="true">
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
                  </svg>'''
new = '''                  <svg class="battery-player battery-pitcher battery-pitcher-formal" viewBox="0 0 44 44" aria-hidden="true">
                    <g class="battery-pitcher-figure">
                      <g class="battery-pitcher-core">
                        <path class="battery-cap" d="M9 8.7c1.2-4 4.4-6.2 8.4-5.5 2.8.5 4.7 2.1 5.8 4.7l-9.3 1.9Z"></path>
                        <circle class="battery-skin" cx="16.4" cy="10.8" r="4.2"></circle>
                        <path class="battery-uniform" d="M12.8 15.1c2-1.2 5.7-1.1 7.8.2l3.5 9.4-3.5 3.2-4-7.3-3.1 7.1-4-2.2Z"></path>
                      </g>
                      <path class="battery-drive-leg" d="M13.9 24.2 9.2 36.7l4.2 1.1 4.7-10.6-1.4-3.7Z"></path>
                      <path class="battery-stride-leg" d="M18.4 24.2c3.6 2.5 6 6.1 7.9 10.1l-3.8 1.9c-1.9-3.5-4.1-6.1-6.6-7.6Z"></path>
                      <g class="battery-throw-arm-formal">
                        <path d="M20 16.3c4.7.3 8.7 2.8 12.1 5.9l-2.4 3.1c-3-2.4-6.3-4-10.5-4.3Z"></path>
                        <circle class="battery-hand" cx="31.8" cy="23.5" r="1.7"></circle>
                      </g>
                      <g class="battery-glove-side-formal">
                        <path class="battery-glove-arm" d="M12.7 16.5 7 20.8l2 3.4 6.5-3.5Z"></path>
                        <ellipse class="battery-glove" cx="6.8" cy="22" rx="3.8" ry="3.1"></ellipse>
                      </g>
                    </g>
                  </svg>'''
if old not in s:
    raise SystemExit('pitcher SVG anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.30 formal pitcher delivery: lift -> coil -> stride -> release */
.home-live-battery{--battery-cycle:3.2s}
.home-live-battery.is-refreshing{--battery-cycle:1.65s}
.battery-pitcher-formal .battery-drive-leg,
.battery-pitcher-formal .battery-stride-leg,
.battery-pitcher-formal .battery-throw-arm-formal path,
.battery-pitcher-formal .battery-glove-side-formal .battery-glove-arm{fill:#214e75}
.battery-pitcher-formal .battery-pitcher-figure{
  transform-box:fill-box;
  transform-origin:44% 66%;
  animation:batteryPitcherBodyFormal var(--battery-cycle) cubic-bezier(.42,.03,.28,1) infinite;
}
.battery-pitcher-core{
  transform-box:fill-box;
  transform-origin:48% 76%;
  animation:batteryPitcherCoilFormal var(--battery-cycle) cubic-bezier(.42,.03,.28,1) infinite;
}
.battery-drive-leg{
  transform-box:fill-box;
  transform-origin:72% 6%;
  animation:batteryDriveLegFormal var(--battery-cycle) cubic-bezier(.42,.03,.28,1) infinite;
}
.battery-stride-leg{
  transform-box:fill-box;
  transform-origin:10% 7%;
  animation:batteryStrideLegFormal var(--battery-cycle) cubic-bezier(.42,.03,.28,1) infinite;
}
.battery-throw-arm-formal{
  transform-box:fill-box;
  transform-origin:7% 16%;
  animation:batteryThrowArmFormal var(--battery-cycle) cubic-bezier(.36,.02,.25,1) infinite;
}
.battery-glove-side-formal{
  transform-box:fill-box;
  transform-origin:85% 18%;
  animation:batteryGloveArmFormal var(--battery-cycle) cubic-bezier(.4,.04,.3,1) infinite;
}
@keyframes batteryPitcherBodyFormal{
  0%,6%,49%,100%{transform:translate(0,0) rotate(0deg)}
  11%{transform:translate(-1px,-1px) rotate(-2deg)}
  18%{transform:translate(-1px,-2px) rotate(-7deg)}
  23%{transform:translate(0,-2px) rotate(-10deg)}
  29%{transform:translate(2px,-1px) rotate(-4deg)}
  34%{transform:translate(4px,0) rotate(5deg)}
  39%{transform:translate(5px,2px) rotate(13deg)}
  45%{transform:translate(3px,2px) rotate(7deg)}
}
@keyframes batteryPitcherCoilFormal{
  0%,7%,48%,100%{transform:rotate(0deg) skewX(0deg)}
  13%{transform:rotate(-4deg) skewX(-2deg)}
  20%{transform:rotate(-12deg) skewX(-4deg)}
  24%{transform:rotate(-14deg) skewX(-4deg)}
  31%{transform:rotate(-5deg) skewX(-1deg)}
  36%{transform:rotate(8deg) skewX(2deg)}
  41%{transform:rotate(13deg) skewX(3deg)}
  46%{transform:rotate(5deg) skewX(1deg)}
}
@keyframes batteryDriveLegFormal{
  0%,8%,49%,100%{transform:rotate(0deg) translate(0,0)}
  14%{transform:rotate(8deg) translate(-1px,-1px)}
  22%{transform:rotate(15deg) translate(-1px,-1px)}
  31%{transform:rotate(-4deg) translate(0,1px)}
  39%{transform:rotate(-13deg) translate(2px,1px)}
  45%{transform:rotate(-7deg) translate(1px,1px)}
}
@keyframes batteryStrideLegFormal{
  0%,8%,49%,100%{transform:rotate(0deg) translate(0,0)}
  12%{transform:rotate(-30deg) translate(-1px,-3px)}
  17%{transform:rotate(-58deg) translate(-2px,-6px)}
  22%{transform:rotate(-66deg) translate(-2px,-7px)}
  26%{transform:rotate(-37deg) translate(0,-5px)}
  31%{transform:rotate(12deg) translate(3px,-2px)}
  35%{transform:rotate(34deg) translate(5px,0)}
  41%{transform:rotate(24deg) translate(5px,1px)}
  46%{transform:rotate(8deg) translate(2px,1px)}
}
@keyframes batteryThrowArmFormal{
  0%,8%,49%,100%{transform:rotate(0deg) translate(0,0)}
  13%{transform:rotate(-20deg) translate(-1px,-1px)}
  20%{transform:rotate(-44deg) translate(-2px,-1px)}
  26%{transform:rotate(-63deg) translate(-1px,-1px)}
  31%{transform:rotate(-42deg) translate(0,-1px)}
  34%{transform:rotate(7deg) translate(1px,0)}
  37%{transform:rotate(62deg) translate(2px,1px)}
  41%{transform:rotate(92deg) translate(1px,3px)}
  46%{transform:rotate(42deg) translate(0,2px)}
}
@keyframes batteryGloveArmFormal{
  0%,8%,49%,100%{transform:rotate(0deg) translate(0,0)}
  14%{transform:rotate(16deg) translate(1px,-1px)}
  21%{transform:rotate(30deg) translate(2px,-1px)}
  27%{transform:rotate(18deg) translate(2px,0)}
  33%{transform:rotate(-20deg) translate(3px,1px)}
  39%{transform:rotate(-42deg) translate(3px,2px)}
  46%{transform:rotate(-16deg) translate(1px,1px)}
}
@keyframes batteryBallRoundTrip{
  0%,32%{left:31px;top:8px;opacity:0;transform:scale(.78) rotate(0deg)}
  34%{opacity:1}
  47%{left:calc(100% - 34px);top:9px;opacity:1;transform:scale(1) rotate(300deg)}
  50%{left:calc(100% - 34px);top:9px;opacity:0;transform:scale(.86) rotate(330deg)}
  67%{left:calc(100% - 31px);top:4px;opacity:0;transform:scale(.82) rotate(350deg)}
  69%{opacity:1}
  84%{left:29px;top:8px;opacity:1;transform:scale(1) rotate(35deg)}
  88%,100%{left:29px;top:8px;opacity:0;transform:scale(.82) rotate(70deg)}
}
@keyframes batteryMittPop{
  0%,42%,54%,100%{transform:scale(1) rotate(0deg)}
  47%{transform:scale(1.3) rotate(-8deg)}
  51%{transform:scale(.96) rotate(1deg)}
}
@keyframes batteryCatcherCrouch{
  0%,50%,89%,100%{opacity:1;transform:translateY(1px) scaleY(.98)}
  56%,83%{opacity:0;transform:translateY(-2px) scaleY(1.06)}
}
@keyframes batteryCatcherStand{
  0%,52%,87%,100%{opacity:0;transform:translateY(3px) scaleY(.92)}
  58%,80%{opacity:1;transform:translateY(-1px) scaleY(1)}
}
@keyframes batteryReturnArm{
  0%,60%,82%,100%{transform:rotate(0deg)}
  65%{transform:rotate(-38deg)}
  70%{transform:rotate(22deg)}
  77%{transform:rotate(3deg)}
}
@media(prefers-reduced-motion:reduce){
  .home-live-battery{--battery-cycle:5.4s}
  .battery-pitcher-core,.battery-drive-leg,.battery-stride-leg,.battery-throw-arm-formal,.battery-glove-side-formal{animation:none}
}
'''
if '/* v2.30 formal pitcher delivery: lift -> coil -> stride -> release */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.29', 'v2.30')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.30.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.28.html'
if old_archive.exists():
    old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8').replace('baseball-player-card-pwa-v146', 'baseball-player-card-pwa-v147').replace('v2.29', 'v2.30')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.30 formal pitching motion patch applied')
