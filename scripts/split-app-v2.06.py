from pathlib import Path
import re

root = Path('.')
app_path = root / 'app.js'
index_path = root / 'index.html'
sw_path = root / 'service-worker.js'

if not app_path.exists():
    raise SystemExit('app.js missing')

source = app_path.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.05';" not in source:
    raise SystemExit('Expected v2.05 app.js baseline')
source_v206 = source.replace("const APP_VERSION = 'v2.05';", "const APP_VERSION = 'v2.06';", 1)

anchors = [
    ('js/core.js', None),
    ('js/providers.js', "    async function cpblRequest(action, payload = {}) {"),
    ('js/storage-stats.js', "    function uid() {"),
    ('js/player-ui.js', "    async function selectPlayer(id) {"),
    ('js/report-canvas.js', "    async function renderCanvas() {"),
    ('js/forms.js', "    function escapeHtml(value) {"),
    ('js/output.js', "    function currentOutputFileName(roleOverride = '') {"),
    ('js/bootstrap.js', "    async function init() {"),
]

positions = [0]
for _, anchor in anchors[1:]:
    count = source_v206.count(anchor)
    if count != 1:
        raise SystemExit(f'Anchor must occur exactly once: {anchor!r}, got {count}')
    positions.append(source_v206.index(anchor))

if positions != sorted(positions) or len(set(positions)) != len(positions):
    raise SystemExit(f'Anchor order invalid: {positions}')

out_dir = root / 'js'
out_dir.mkdir(exist_ok=True)
parts = []
for i, (name, _) in enumerate(anchors):
    start = positions[i]
    end = positions[i + 1] if i + 1 < len(positions) else len(source_v206)
    part = source_v206[start:end]
    if not part.strip():
        raise SystemExit(f'Empty split part: {name}')
    Path(name).write_text(part, encoding='utf-8')
    parts.append(part)

reconstructed = ''.join(parts)
if reconstructed != source_v206:
    raise SystemExit('Split reconstruction mismatch')

index = index_path.read_text(encoding='utf-8')
if './app.js?v=v2.05' not in index:
    raise SystemExit('Expected v2.05 app.js script tag in index.html')
index = index.replace('./styles.css?v=v2.05', './styles.css?v=v2.06')
script_tags = '\n'.join([
    '    <script src="./js/core.js?v=v2.06"></script>',
    '    <script src="./js/providers.js?v=v2.06"></script>',
    '    <script src="./js/storage-stats.js?v=v2.06"></script>',
    '    <script src="./js/player-ui.js?v=v2.06"></script>',
    '    <script src="./js/report-canvas.js?v=v2.06"></script>',
    '    <script src="./js/forms.js?v=v2.06"></script>',
    '    <script src="./js/output.js?v=v2.06"></script>',
    '    <script src="./js/bootstrap.js?v=v2.06"></script>',
])
index = index.replace('    <script src="./app.js?v=v2.05"></script>', script_tags, 1)
index_path.write_text(index, encoding='utf-8')
(root / 'index v2.06.html').write_text(index, encoding='utf-8')

sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace("const CACHE_NAME = 'baseball-player-card-pwa-v121';", "const CACHE_NAME = 'baseball-player-card-pwa-v122';", 1)
sw = sw.replace("  './styles.css?v=v2.05',\n  './app.js?v=v2.05',", "  './styles.css?v=v2.06',\n" + '\n'.join([
    "  './js/core.js?v=v2.06',",
    "  './js/providers.js?v=v2.06',",
    "  './js/storage-stats.js?v=v2.06',",
    "  './js/player-ui.js?v=v2.06',",
    "  './js/report-canvas.js?v=v2.06',",
    "  './js/forms.js?v=v2.06',",
    "  './js/output.js?v=v2.06',",
    "  './js/bootstrap.js?v=v2.06',",
]), 1)
if './app.js?v=v2.05' in sw or 'v=v2.05' in sw:
    raise SystemExit('Old v2.05 app shell reference remains')
sw_path.write_text(sw, encoding='utf-8')

readme = '''# JavaScript structure (v2.06)\n\nThe previous monolithic `app.js` is split without reordering code. The scripts load in this exact order:\n\n1. `core.js` — version/config, DOM references, global state, shared constants/helpers.\n2. `providers.js` — CPBL/MLB/MiLB/NPB/KBO/international data fetching and synchronization.\n3. `storage-stats.js` — IndexedDB, player/game persistence, stat derivation, search/message helpers.\n4. `player-ui.js` — player selection, season/level switching, player pages, batch reports, daily editors.\n5. `report-canvas.js` — daily report canvas rendering, backgrounds, image/frame drawing.\n6. `forms.js` — add-player flows, pickers, dialogs, photo interaction and form/event wiring.\n7. `output.js` — annual-season output and prepared download/share generation.\n8. `bootstrap.js` — initialization, update checks and application boot.\n\nRollback baseline: branch `rollback-v2.05-pre-deep-split`.\nWork branch: `modularize-v2.06`.\n'''
(out_dir / 'README.md').write_text(readme, encoding='utf-8')

# app.js is no longer loaded; remove it only after all split artifacts and validations are complete.
app_path.unlink()

print('Split complete')
for name, _ in anchors:
    print(name, Path(name).stat().st_size)
print('index.html', index_path.stat().st_size)
print('service-worker.js', sw_path.stat().st_size)
