from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

VERSION_FILES = [
    'app.js',
    'index.html',
    'styles.css',
    'game-detail-enhancement.css',
    'game-detail-enhancement.js',
    'live-static-update.js',
    'cpbl-cache-router.js',
    'cpbl-realtime.js',
    'service-worker.js',
    'rescue.html',
    'report-layout.css',
    'report-layout.js',
]

for rel in VERSION_FILES:
    path = ROOT / rel
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    text = text.replace('v2.55', 'v2.56').replace('v255', 'v256').replace('V255', 'V256')
    path.write_text(text, encoding='utf-8')

# 1) Returning to a browser tab must not trigger an update check / reload.
app_path = ROOT / 'app.js'
app = app_path.read_text(encoding='utf-8')
visibility_block = """        document.addEventListener('visibilitychange', () => {\n          if (document.visibilityState === 'visible') checkAppUpdate();\n        });\n\n"""
if visibility_block not in app:
    raise SystemExit('visibilitychange update block not found in app.js')
app = app.replace(
    visibility_block,
    """        // v2.56: do not check/apply updates merely because the user returned\n        // to this browser tab. Startup, manual version-badge checks, and the\n        // existing 15-minute timer remain responsible for update checks.\n\n""",
    1,
)
app_path.write_text(app, encoding='utf-8')

# 2) A defensive-half substitution still changes that team's batting-order slot.
# v2.55 filtered the play list to only the team's offensive half before parsing
# substitutions, so e.g. 林岱安 entering at catcher in B8 was never applied to
# Fubon's batting-order panel.
gd_path = ROOT / 'game-detail-enhancement.js'
gd = gd_path.read_text(encoding='utf-8')
old = """    const wantedHalf = side === 'away' ? 'top' : 'bottom';\n    const plays = (Array.isArray(detail?.plays) ? detail.plays : []).filter(play => play?.half === wantedHalf);\n    const slots = new Map(), nameToSlot = new Map();\n    let nextSlot = 1;\n\n    for (const play of plays) {\n      for (const change of parseSubs(play?.description)) {\n        const slot = nameToSlot.get(normName(change.from));\n        if (!slot) continue;\n        const repl = player(change.to);\n        repl.order = slot;\n        slots.set(slot, repl);\n        nameToSlot.set(normName(change.to), slot);\n      }\n      if (!realPA(play)) continue;\n"""
new = """    const wantedHalf = side === 'away' ? 'top' : 'bottom';\n    const plays = Array.isArray(detail?.plays) ? detail.plays : [];\n    const slots = new Map(), nameToSlot = new Map();\n    let nextSlot = 1;\n\n    for (const play of plays) {\n      // Substitutions can be announced while this team is on defense. Apply\n      // them to an already-known batting slot regardless of inning half.\n      for (const change of parseSubs(play?.description)) {\n        const slot = nameToSlot.get(normName(change.from));\n        if (!slot) continue;\n        const repl = player(change.to);\n        repl.order = slot;\n        slots.set(slot, repl);\n        nameToSlot.set(normName(change.to), slot);\n      }\n      // Only actual plate appearances advance this team's 1→9 batting cycle.\n      if (play?.half !== wantedHalf) continue;\n      if (!realPA(play)) continue;\n"""
if old not in gd:
    raise SystemExit('lineup play-filter block not found')
gd = gd.replace(old, new, 1)

# 3) Re-apply official defensive substitution descriptions to the field map.
# This makes the field state robust even if FirstSno/fielders lags one event.
old_def = """  function defenseMap(detail, side) {\n    const raw = detail?.lineups?.[side] || {}, map = {};\n    const fielders = Array.isArray(raw.fielders) ? raw.fielders : rawRoster(detail,side);\n    for (const entry of fielders) {\n      const key = positionKey(entry?.position || entry?.pos || ''), name = compactName(entry?.name || entry?.fullName || '');\n      if (key && name) map[key] = name;\n    }\n    const pitcher = compactName(raw?.pitcher?.fullName || raw?.pitcher?.name || detail?.current?.pitcher?.fullName || detail?.current?.pitcher?.name || '');\n    if (pitcher) map.p = pitcher;\n    return map;\n  }\n"""
new_def = """  function defenseMap(detail, side) {\n    const raw = detail?.lineups?.[side] || {}, map = {};\n    const fielders = Array.isArray(raw.fielders) ? raw.fielders : rawRoster(detail,side);\n    for (const entry of fielders) {\n      const key = positionKey(entry?.position || entry?.pos || ''), name = compactName(entry?.name || entry?.fullName || '');\n      if (key && name) map[key] = name;\n    }\n\n    const removePlayer = name => {\n      const target = normName(name);\n      if (!target) return;\n      for (const [pos, current] of Object.entries(map)) {\n        if (normName(current) === target) delete map[pos];\n      }\n    };\n    const roleAndName = value => {\n      const text = compactName(value).replace(/[()（）]/g,'').replace(/^[-：:]+|[-：:]+$/g,'');\n      const m = text.match(/^(投手|捕手|一壘手|二壘手|三壘手|游擊手|遊擊手|左外野手|中外野手|右外野手|指定打擊|DH)[-：:]?(.*)$/);\n      if (m) return { pos:positionKey(m[1]), name:compactName(m[2]) };\n      const n = text.match(/^(.*?)[-：:]?(投手|捕手|一壘手|二壘手|三壘手|游擊手|遊擊手|左外野手|中外野手|右外野手|指定打擊|DH)$/);\n      if (n) return { pos:positionKey(n[2]), name:compactName(n[1]) };\n      return { pos:'', name:text };\n    };\n    const defensiveHalf = side === 'away' ? 'bottom' : 'top';\n    for (const play of Array.isArray(detail?.plays) ? detail.plays : []) {\n      if (play?.half !== defensiveHalf) continue;\n      const text = String(play?.description || '');\n      let m;\n      const playerRe = /更換選手：([^。]+?)=>([^。]+)/g;\n      while ((m = playerRe.exec(text))) {\n        const from = roleAndName(m[1]), to = roleAndName(m[2]);\n        removePlayer(from.name);\n        removePlayer(to.name);\n        if (to.pos && to.name) map[to.pos] = to.name;\n      }\n      const defenseRe = /更換守備：([^。]+?)=>([^。]+)/g;\n      while ((m = defenseRe.exec(text))) {\n        const from = roleAndName(m[1]), to = roleAndName(m[2]);\n        const name = from.name || to.name;\n        removePlayer(name);\n        if (to.pos && name) map[to.pos] = name;\n      }\n    }\n\n    const pitcher = compactName(raw?.pitcher?.fullName || raw?.pitcher?.name || detail?.current?.pitcher?.fullName || detail?.current?.pitcher?.name || '');\n    if (pitcher) map.p = pitcher;\n    return map;\n  }\n"""
if old_def not in gd:
    raise SystemExit('defenseMap block not found')
gd = gd.replace(old_def, new_def, 1)
gd_path.write_text(gd, encoding='utf-8')

print('v2.56 patch applied')
