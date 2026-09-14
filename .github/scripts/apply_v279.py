from pathlib import Path
import json

ROOT=Path('.')

def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

p='postseason-history.js'
s=read(p)
old="String(league || '').toUpperCase() === 'NPB' && comp?.key === 'climax_final'"
new="String(league || '').toUpperCase() === 'NPB' && ['climax_final','climax_special'].includes(comp?.key)"
if old not in s and new not in s:
    raise SystemExit('NPB CS advantage condition not found')
s=s.replace(old,new)
write(p,s)

for p in ['app.js','index.html','service-worker.js']:
    s=read(p).replace('v2.78','v2.79')
    if p=='service-worker.js': s=s.replace('v278','v279')
    write(p,s)
write('version.json',json.dumps({'version':'v2.79'},ensure_ascii=False,separators=(',',':'))+'\n')

checks={
'postseason-history.js':["['climax_final','climax_special'].includes(comp?.key)"],
'app.js':["const APP_VERSION = 'v2.79'"],
'index.html':['?v=v2.79'],
'service-worker.js':['v279','?v=v2.79'],
'version.json':['v2.79']}
for p,needles in checks.items():
    t=read(p)
    for n in needles:
        if n not in t: raise SystemExit(f'{p}: missing {n}')
print('v2.79 patch applied')
