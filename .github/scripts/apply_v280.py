from pathlib import Path
import json

ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

p='postseason-history.js'
s=read(p)
old="""      const awayScore = Number(game?.awayScore);\n      const homeScore = Number(game?.homeScore);\n      const hasScore = Number.isFinite(awayScore) && Number.isFinite(homeScore);\n"""
new="""      const awayRaw = game?.awayScore;\n      const homeRaw = game?.homeScore;\n      const awayScore = Number(awayRaw);\n      const homeScore = Number(homeRaw);\n      const hasScore = awayRaw !== null && awayRaw !== undefined && awayRaw !== ''\n        && homeRaw !== null && homeRaw !== undefined && homeRaw !== ''\n        && Number.isFinite(awayScore) && Number.isFinite(homeScore);\n"""
if old not in s and new not in s:
    raise SystemExit('series score guard not found')
s=s.replace(old,new)
write(p,s)

for p in ['app.js','index.html','service-worker.js']:
    s=read(p).replace('v2.79','v2.80')
    if p=='service-worker.js': s=s.replace('v279','v280')
    write(p,s)
write('version.json',json.dumps({'version':'v2.80'},ensure_ascii=False,separators=(',',':'))+'\n')

checks={
'postseason-history.js':["awayRaw !== null","homeRaw !== null"],
'app.js':["const APP_VERSION = 'v2.80'"],
'index.html':['?v=v2.80'],
'service-worker.js':['v280','?v=v2.80'],
'version.json':['v2.80']}
for p,needles in checks.items():
    t=read(p)
    for n in needles:
        if n not in t: raise SystemExit(f'{p}: missing {n}')
print('v2.80 patch applied')
