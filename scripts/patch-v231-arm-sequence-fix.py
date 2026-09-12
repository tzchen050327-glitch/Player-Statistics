from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version bump
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.30';" not in s:
    raise SystemExit('expected v2.30')
s = s.replace("const APP_VERSION = 'v2.30';", "const APP_VERSION = 'v2.31';", 1)
s = s.replace('?v=v2.30', '?v=v2.31')
p.write_text(s, encoding='utf-8')

# Wrap the catcher's glove side so it can move as one limb during the return throw.
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
old = '''                      <path class="battery-glove-arm" d="M14.2 14.3 8.1 18l1.7 3.3 6.8-3.4Z"></path>\n                      <ellipse class="battery-glove" cx="7.7" cy="19.4" rx="3.4" ry="2.9"></ellipse>'''
new = '''                      <g class="battery-catcher-glove-side">\n                        <path class="battery-glove-arm" d="M14.2 14.3 8.1 18l1.7 3.3 6.8-3.4Z"></path>\n                        <ellipse class="battery-glove" cx="7.7" cy="19.4" rx="3.4" ry="2.9"></ellipse>\n                      </g>'''
if old not in s:
    raise SystemExit('catcher glove anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Override v2.30 sequencing so both throwers keep the glove in front until the torso opens,
# then let the throwing arm pass the glove only at release.
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.31 anatomically ordered glove/throw-arm sequence */
.home-live-battery{--battery-cycle:3.35s}
.home-live-battery.is-refreshing{--battery-cycle:1.75s}

/* PITCHER: hands together/front -> leg lift -> coil -> stride -> open -> throw -> follow-through. */
.battery-pitcher-figure{animation:none}
.battery-pitcher-core{
  transform-box:fill-box;
  transform-origin:48% 82%;
  animation:batteryPitcherCoreV231 var(--battery-cycle) cubic-bezier(.42,.02,.32,1) infinite;
}
.battery-drive-leg{
  transform-box:fill-box;
  transform-origin:62% 4%;
  animation:batteryPitcherDriveLegV231 var(--battery-cycle) cubic-bezier(.42,.02,.32,1) infinite;
}
.battery-stride-leg{
  transform-box:fill-box;
  transform-origin:18% 5%;
  animation:batteryPitcherStrideLegV231 var(--battery-cycle) cubic-bezier(.42,.02,.32,1) infinite;
}
.battery-glove-side-formal{
  transform-box:fill-box;
  transform-origin:100% 45%;
  animation:batteryPitcherGloveSideV231 var(--battery-cycle) cubic-bezier(.42,.02,.32,1) infinite;
}
.battery-throw-arm-formal{
  transform-box:fill-box;
  transform-origin:12% 28%;
  animation:batteryPitcherThrowArmV231 var(--battery-cycle) cubic-bezier(.38,.01,.24,1) infinite;
}

@keyframes batteryPitcherCoreV231{
  0%,7%,52%,100%{transform:translate(0,0) rotate(0deg)}
  13%{transform:translate(-.4px,-.8px) rotate(-4deg)}
  21%{transform:translate(-.9px,-1.4px) rotate(-10deg)}
  29%{transform:translate(.3px,-.8px) rotate(-13deg)}
  36%{transform:translate(1.7px,.2px) rotate(3deg)}
  42%{transform:translate(3.3px,1px) rotate(12deg)}
  48%{transform:translate(2.1px,1.7px) rotate(7deg)}
}
@keyframes batteryPitcherDriveLegV231{
  0%,8%,52%,100%{transform:rotate(0deg) translate(0,0)}
  17%{transform:rotate(7deg) translate(-.3px,-.5px)}
  29%{transform:rotate(5deg) translate(-.5px,0)}
  39%{transform:rotate(-5deg) translate(.4px,.5px)}
  47%{transform:rotate(-9deg) translate(1px,.8px)}
}
@keyframes batteryPitcherStrideLegV231{
  0%,8%,52%,100%{transform:rotate(0deg) translate(0,0)}
  14%{transform:rotate(-28deg) translate(-1px,-4px)}
  21%{transform:rotate(-40deg) translate(-2px,-7px)}
  28%{transform:rotate(-25deg) translate(0,-4px)}
  36%{transform:rotate(24deg) translate(4px,1px)}
  43%{transform:rotate(35deg) translate(6px,2px)}
  49%{transform:rotate(18deg) translate(3px,1px)}
}
@keyframes batteryPitcherGloveSideV231{
  /* The source glove points backward; flip it forward while closed. */
  0%,8%{transform:translate(3px,-1px) rotate(-7deg) scaleX(-.9)}
  15%{transform:translate(4px,-2px) rotate(-13deg) scaleX(-1)}
  24%{transform:translate(4.5px,-1.4px) rotate(-8deg) scaleX(-1)}
  30%{transform:translate(3.5px,-.5px) rotate(1deg) scaleX(-.8)}
  34%{transform:translate(2px,.2px) rotate(8deg) scaleX(-.25)}
  38%{transform:translate(.5px,.5px) rotate(14deg) scaleX(.45)}
  42%{transform:translate(-.5px,1px) rotate(18deg) scaleX(1)}
  48%{transform:translate(-.2px,.6px) rotate(8deg) scaleX(1)}
  54%,100%{transform:translate(0,0) rotate(0deg) scaleX(1)}
}
@keyframes batteryPitcherThrowArmV231{
  /* Start near the glove, separate backward, then come through only after front-foot plant. */
  0%,8%{transform:translate(-2px,-1px) rotate(-15deg) scale(.72) scaleX(1)}
  14%{transform:translate(-1px,-1px) rotate(-4deg) scale(.82) scaleX(.45)}
  21%{transform:translate(-2px,0) rotate(18deg) scale(1) scaleX(-.82)}
  29%{transform:translate(-2.5px,.5px) rotate(31deg) scale(1.03) scaleX(-1)}
  34%{transform:translate(-1.5px,.2px) rotate(24deg) scale(1.03) scaleX(-.88)}
  38%{transform:translate(.5px,-.3px) rotate(4deg) scale(1.05) scaleX(-.28)}
  41%{transform:translate(1.8px,-.8px) rotate(-10deg) scale(1.06) scaleX(.48)}
  44%{transform:translate(3.3px,-.4px) rotate(-20deg) scale(1.08) scaleX(1)}
  48%{transform:translate(2.2px,1.1px) rotate(-8deg) scale(1) scaleX(1)}
  54%,100%{transform:translate(0,0) rotate(0deg) scale(1) scaleX(1)}
}

/* CATCHER: glove stays toward pitcher during rise/transfer, then moves behind as throwing arm comes through. */
.battery-catcher-crouch{
  animation:batteryCatcherCrouchV231 var(--battery-cycle) ease-in-out infinite;
}
.battery-catcher-stand{
  animation:batteryCatcherStandV231 var(--battery-cycle) cubic-bezier(.42,.02,.32,1) infinite;
}
.battery-catcher-glove-side{
  transform-box:fill-box;
  transform-origin:100% 45%;
  animation:batteryCatcherGloveSideV231 var(--battery-cycle) cubic-bezier(.42,.02,.32,1) infinite;
}
.battery-return-arm{
  transform-box:fill-box;
  transform-origin:12% 28%;
  animation:batteryCatcherThrowArmV231 var(--battery-cycle) cubic-bezier(.38,.01,.24,1) infinite;
}
.battery-mitt{animation:batteryMittPopV231 var(--battery-cycle) ease-in-out infinite}

@keyframes batteryCatcherCrouchV231{
  0%,52%,91%,100%{opacity:1;transform:translateY(1px) scaleY(.98)}
  57%,87%{opacity:0;transform:translateY(-2px) scaleY(1.05)}
}
@keyframes batteryCatcherStandV231{
  0%,54%,89%,100%{opacity:0;transform:translateY(3px) rotate(0deg) scaleY(.93)}
  59%{opacity:1;transform:translateY(0) rotate(-4deg) scaleY(1)}
  66%{opacity:1;transform:translateY(-1px) rotate(8deg) scaleY(1)}
  73%{opacity:1;transform:translateY(-1px) rotate(5deg) scaleY(1)}
  79%{opacity:1;transform:translateY(0) rotate(-9deg) scaleY(1)}
  86%{opacity:1;transform:translateY(1px) rotate(-4deg) scaleY(.99)}
}
@keyframes batteryCatcherGloveSideV231{
  /* Normal geometry points toward the pitcher (left), so keep it there through transfer. */
  0%,57%{transform:translate(0,0) rotate(0deg) scaleX(1)}
  62%{transform:translate(-1px,-1px) rotate(-9deg) scaleX(1)}
  68%{transform:translate(-1.5px,-.4px) rotate(-4deg) scaleX(1)}
  72%{transform:translate(-.5px,.2px) rotate(4deg) scaleX(.72)}
  76%{transform:translate(1px,.4px) rotate(10deg) scaleX(.12)}
  80%{transform:translate(2px,.6px) rotate(16deg) scaleX(-.65)}
  84%{transform:translate(2.4px,1px) rotate(18deg) scaleX(-1)}
  89%,100%{transform:translate(0,0) rotate(0deg) scaleX(1)}
}
@keyframes batteryCatcherThrowArmV231{
  /* Geometry points right: perfect for the cocked/back position before a throw to the left. */
  0%,57%{transform:translate(0,0) rotate(0deg) scaleX(1)}
  63%{transform:translate(1px,-1px) rotate(-20deg) scaleX(1)}
  69%{transform:translate(1.5px,-1px) rotate(-34deg) scaleX(1)}
  73%{transform:translate(.5px,-.5px) rotate(-24deg) scaleX(.88)}
  77%{transform:translate(-1px,-.5px) rotate(-6deg) scaleX(.28)}
  80%{transform:translate(-2.2px,0) rotate(11deg) scaleX(-.48)}
  83%{transform:translate(-3.2px,.4px) rotate(19deg) scaleX(-1)}
  87%{transform:translate(-2px,1px) rotate(8deg) scaleX(-1)}
  91%,100%{transform:translate(0,0) rotate(0deg) scaleX(1)}
}
@keyframes batteryMittPopV231{
  0%,47%,58%,100%{transform:scale(1) rotate(0deg)}
  52%{transform:scale(1.28) rotate(-7deg)}
  56%{transform:scale(.97) rotate(1deg)}
}

/* Ball release is synchronized to the hand passing the glove, in both directions. */
.battery-ball{animation:batteryBallRoundTripV231 var(--battery-cycle) cubic-bezier(.25,.03,.55,.98) infinite}
@keyframes batteryBallRoundTripV231{
  0%,40%{left:28px;top:7px;opacity:0;transform:scale(.82) rotate(0deg)}
  42%{left:30px;top:6px;opacity:1;transform:scale(.9) rotate(20deg)}
  52%{left:calc(100% - 34px);top:9px;opacity:1;transform:scale(1) rotate(310deg)}
  55%{left:calc(100% - 34px);top:9px;opacity:0;transform:scale(.86) rotate(350deg)}
  78%{left:calc(100% - 31px);top:5px;opacity:0;transform:scale(.84) rotate(0deg)}
  80%{left:calc(100% - 33px);top:6px;opacity:1;transform:scale(.9) rotate(25deg)}
  88%{left:29px;top:7px;opacity:1;transform:scale(1) rotate(325deg)}
  91%,100%{left:28px;top:7px;opacity:0;transform:scale(.84) rotate(360deg)}
}
'''
if '/* v2.31 anatomically ordered glove/throw-arm sequence */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# HTML version/archive
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.30', 'v2.31')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.31.html').write_text(s, encoding='utf-8')
old = ROOT / 'index v2.29.html'
if old.exists():
    old.unlink()

# Service worker cache/version
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v147', 'baseball-player-card-pwa-v148')
s = s.replace('v2.30', 'v2.31')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.31 arm sequence fix applied')
