from pathlib import Path
import re

s = Path('app.js').read_text(encoding='utf-8')
lines = s.splitlines()
patterns = [
    r'^\s*function openDb\b',
    r'^\s*async function updatePlayerFromCpbl\b',
    r'^\s*async function syncExternalSeason\b',
    r'^\s*function renderAnnualSeasonCanvas\b',
    r'^\s*function renderContent\b',
    r'^\s*function renderAll\b',
    r'^\s*async function selectPlayer\b',
    r'^\s*function selectPlayer\b',
    r'^\s*async function init\b',
]
print('TOTAL_LINES', len(lines))
for p in patterns:
    found=[]
    rx=re.compile(p)
    for i,line in enumerate(lines,1):
        if rx.search(line): found.append(i)
    print(p, found[:20])

print('\nTOP_LEVEL_FUNCTIONS')
for i,line in enumerate(lines,1):
    if re.match(r'^    (?:async )?function\s+[A-Za-z_$][\w$]*\s*\(', line):
        print(f'{i}: {line.strip()}')

print('\nTOP_LEVEL_SECTION_COMMENTS')
for i,line in enumerate(lines,1):
    if re.match(r'^    //', line) and ('====' in line or '---' in line or 'SECTION' in line.upper()):
        print(f'{i}: {line.strip()}')

# trigger analysis workflow
