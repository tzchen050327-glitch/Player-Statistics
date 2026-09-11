from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


# 1) Version bump.
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.13';" not in s:
    raise SystemExit('expected v2.13 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.13';", "const APP_VERSION = 'v2.14';", 1)
s = s.replace('?v=v2.13', '?v=v2.14')
p.write_text(s, encoding='utf-8')

# 2) Pitcher editor: keep runs as an input/stat, but let the user choose whether it appears on the daily card.
p = ROOT / 'js' / '13-daily-editor.js'
s = p.read_text(encoding='utf-8')
old = """          <label class=\"field\">最後一格顯示
            <select id=\"pLastMetric\">${pitcherLastMetricOptions(player?.pitcherLastMetric)}</select>
          </label>
        </div>
"""
new = """          <label class=\"field\">最後一格顯示
            <select id=\"pLastMetric\">${pitcherLastMetricOptions(player?.pitcherLastMetric)}</select>
          </label>
          <label class=\"field\">戰報顯示失分
            <select id=\"pShowRuns\">
              <option value=\"0\" ${g.showRuns ? '' : 'selected'}>否</option>
              <option value=\"1\" ${g.showRuns ? 'selected' : ''}>是</option>
            </select>
          </label>
        </div>
"""
if s.count(old) != 1:
    raise SystemExit('pitcher last metric field anchor not found')
s = s.replace(old, new, 1)

old = """      const ids = ['pK','pBB','pH','pHBP','pOtherReach','pR','pER','pPitchTens','pPitchOnes'];
"""
new = """      const ids = ['pK','pBB','pH','pHBP','pOtherReach','pR','pER','pPitchTens','pPitchOnes','pShowRuns'];
"""
if s.count(old) != 1:
    raise SystemExit('pitcher editor change-list anchor not found')
s = s.replace(old, new, 1)

old = """      g.er = Math.min(g.r, Number(document.getElementById('pER').value));
      g.pitchTens = Number(document.getElementById('pPitchTens').value);
"""
new = """      g.er = Math.min(g.r, Number(document.getElementById('pER').value));
      g.showRuns = document.getElementById('pShowRuns')?.value === '1';
      g.pitchTens = Number(document.getElementById('pPitchTens').value);
"""
if s.count(old) != 1:
    raise SystemExit('pitcher game update anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 3) Daily canvas: runs are hidden by default and inserted only when the current game opts in.
p = ROOT / 'js' / '16-daily-canvas.js'
s = p.read_text(encoding='utf-8')
old = """        const lines = currentRecord?.externalWalksCombined
          ? [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['四死球', g.bb],
              ['被安打', g.h],
              ['失分', g.r],
              ['自責分', g.er],
              ['用球數', pitches]
            ]
          : [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['保送', g.bb],
              ['被安打', g.h],
              ['死球', g.hbp],
              ['自責分', g.er],
              ['用球數', pitches]
            ];
"""
new = """        const showRuns = Boolean(g.showRuns);
        const lines = currentRecord?.externalWalksCombined
          ? [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['四死球', g.bb],
              ['被安打', g.h],
              ...(showRuns ? [['失分', g.r]] : []),
              ['自責分', g.er],
              ['用球數', pitches]
            ]
          : [
              ['投球局數', g.innings],
              ['三振', g.k],
              ['保送', g.bb],
              ['被安打', g.h],
              ['死球', g.hbp],
              ...(showRuns ? [['失分', g.r]] : []),
              ['自責分', g.er],
              ['用球數', pitches]
            ];
"""
if s.count(old) != 1:
    raise SystemExit('daily pitcher lines anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 4) HTML/service worker cache busting.
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
if 'v2.13' not in s:
    raise SystemExit('expected v2.13 index wiring')
s = s.replace('v2.13', 'v2.14')
p.write_text(s, encoding='utf-8')

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
if "baseball-player-card-pwa-v130" not in s:
    raise SystemExit('expected service worker cache v130')
s = s.replace('baseball-player-card-pwa-v130', 'baseball-player-card-pwa-v131', 1)
s = s.replace('v2.13', 'v2.14')
p.write_text(s, encoding='utf-8')

# 5) Rebuild deterministic bundle.
subprocess.run(['python3', str(ROOT / 'scripts' / 'build-app.py')], cwd=ROOT, check=True)

# 6) Keep current + previous archive only.
(ROOT / 'index v2.14.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
old_archive = ROOT / 'index v2.12.html'
if old_archive.exists():
    old_archive.unlink()
if not (ROOT / 'index v2.13.html').exists():
    raise SystemExit('previous archive index v2.13.html missing')

print('v2.14 pitcher runs display toggle applied; default is hidden')
