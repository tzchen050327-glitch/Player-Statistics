from pathlib import Path
import re
import shutil

VERSION = 'v2.06'
OLD_MODULES = [
    'js/core.js',
    'js/providers.js',
    'js/storage-stats.js',
    'js/player-ui.js',
    'js/report-canvas.js',
    'js/forms.js',
    'js/output.js',
    'js/bootstrap.js',
]

for name in OLD_MODULES:
    if not Path(name).exists():
        raise SystemExit(f'missing source module: {name}')

source = ''.join(Path(name).read_text(encoding='utf-8') for name in OLD_MODULES)
if "const APP_VERSION = 'v2.06';" not in source:
    raise SystemExit('APP_VERSION v2.06 not found')

# Split only at existing top-level declaration boundaries and preserve byte-for-byte order.
# app.js is rebuilt by concatenating these modules, so browser runtime keeps the original
# one-script hoisting/global-lexical semantics while the maintainable source is modular.
segments = [
    ('00-core-config.js', None),
    ('01-catalogs.js', "    const INTERNATIONAL_COMPETITIONS ="),
    ('02-core-helpers.js', "    function getCurrentTemplate()"),
    ('03-provider-us.js', "    async function cpblRequest("),
    ('04-provider-season.js', "    function externalHitterStatsToLocal("),
    ('05-provider-international.js', "    async function syncInternationalTournamentStats("),
    ('06-provider-cpbl.js', "    function cpblLevelLabel("),
    ('07-storage.js', "    function uid()"),
    ('08-stats-search.js', "    function numberOptions("),
    ('09-player-navigation.js', "    async function selectPlayer("),
    ('10-batch-reports.js', "    function clearBatchReportOutputs()"),
    ('11-home-international.js', "    function playerScope("),
    ('12-player-pages.js', "    function selectedLevelSecondaryStats("),
    ('13-daily-editor.js', "    function renderToday("),
    ('14-photo-template-ui.js', "    function renderPhotos("),
    ('15-render-controller.js', "    function renderContent()"),
    ('16-daily-canvas.js', "    async function renderCanvas()"),
    ('17-canvas-backgrounds.js', "    function drawOpponentFrame("),
    ('18-canvas-utils.js', "    function tracePhotoFramePath("),
    ('19-forms-events.js', "    function competitionOptionsHtml("),
    ('20-output-core.js', "    function currentOutputFileName("),
    ('21-annual-report.js', "    function annualTextFit("),
    ('22-output-actions.js', "    function outputRecordForRole("),
    ('23-bootstrap.js', "    async function init()"),
]

positions = []
for filename, marker in segments:
    if marker is None:
        positions.append((filename, 0))
        continue
    count = source.count(marker)
    if count != 1:
        raise SystemExit(f'marker {marker!r} occurs {count} times')
    positions.append((filename, source.index(marker)))

if positions != sorted(positions, key=lambda item: item[1]):
    raise SystemExit('module markers are not in source order')

module_texts = {}
for idx, (filename, start) in enumerate(positions):
    end = positions[idx + 1][1] if idx + 1 < len(positions) else len(source)
    text = source[start:end]
    if not text.strip():
        raise SystemExit(f'empty module: {filename}')
    module_texts[filename] = text

reassembled = ''.join(module_texts[name] for name, _ in segments)
if reassembled != source:
    raise SystemExit('reassembled source differs from pre-split source')

# Replace first-stage modules with final source modules.
shutil.rmtree('js')
Path('js').mkdir()
for filename, _ in segments:
    Path('js', filename).write_text(module_texts[filename], encoding='utf-8')

order = [filename for filename, _ in segments]
Path('js/module-order.txt').write_text('\n'.join(order) + '\n', encoding='utf-8')

readme = '''# JavaScript architecture — v2.06\n\n`js/` is the maintainable source. Files are intentionally ordered and must be concatenated in `module-order.txt` order.\n\nThe live page loads the generated `app.js` bundle instead of executing every source file separately. This is deliberate: it preserves the exact hoisting and global lexical semantics of the original single-script application while still allowing the source to be maintained by feature area.\n\n## Source modules\n\n- `00-core-config.js` — version/config, DOM references, global state, sync metadata and special-record normalization.\n- `01-catalogs.js` — league/tournament/team/template catalogs and static configuration.\n- `02-core-helpers.js` — shared display/template/opponent helpers.\n- `03-provider-us.js` — provider HTTP clients and MLB/MiLB career helpers.\n- `04-provider-season.js` — normalized season stat conversion and overseas season synchronization.\n- `05-provider-international.js` — international tournament totals and per-game synchronization.\n- `06-provider-cpbl.js` — CPBL roster/history/season/daily synchronization.\n- `07-storage.js` — IndexedDB persistence, game record loading/saving and player stat profiles.\n- `08-stats-search.js` — stat derivation, PA localization, dialogs, status and player search.\n- `09-player-navigation.js` — player selection and season/level switching.\n- `10-batch-reports.js` — batch report data retrieval and generation.\n- `11-home-international.js` — home filters, international explorer and archived international games.\n- `12-player-pages.js` — season/role/player settings views.\n- `13-daily-editor.js` — hitter/pitcher daily record editors and dependency rules.\n- `14-photo-template-ui.js` — photo/template UI and template preview rendering.\n- `15-render-controller.js` — page rendering controller and game commit helpers.\n- `16-daily-canvas.js` — primary daily report canvas renderer and styled card primitives.\n- `17-canvas-backgrounds.js` — scoreboard/stadium/bullpen/background drawing.\n- `18-canvas-utils.js` — photo-frame/canvas/image/tag utilities.\n- `19-forms-events.js` — add-player forms, pickers, dialogs, event wiring and photo interaction.\n- `20-output-core.js` — output role/file-name helpers.\n- `21-annual-report.js` — annual report canvas and capture flow.\n- `22-output-actions.js` — prepared-output generation/download/share actions.\n- `23-bootstrap.js` — initialization, update checks and application boot.\n\n## Build\n\nRun `python3 scripts/build-app.py`. The build is deterministic and reconstructs `app.js` from the source modules. CI verifies that the committed bundle matches the source.\n\n## Rollback\n\n- Stable pre-deep-split branch: `rollback-v2.05-pre-deep-split`\n- Monolithic preserved file: `index v2.04 monolith.html`\n- Current modularization work branch: `modularize-v2.06`\n'''
Path('js/README.md').write_text(readme, encoding='utf-8')

build_script = '''from pathlib import Path\n\nROOT = Path(__file__).resolve().parents[1]\norder_file = ROOT / 'js' / 'module-order.txt'\nif not order_file.exists():\n    raise SystemExit('missing js/module-order.txt')\norder = [line.strip() for line in order_file.read_text(encoding='utf-8').splitlines() if line.strip()]\nif not order:\n    raise SystemExit('empty module order')\nparts = []\nfor name in order:\n    path = ROOT / 'js' / name\n    if not path.exists():\n        raise SystemExit(f'missing module: {name}')\n    parts.append(path.read_text(encoding='utf-8'))\nbundle = ''.join(parts)\nif "const APP_VERSION = 'v2.06';" not in bundle:\n    raise SystemExit('wrong APP_VERSION')\n(ROOT / 'app.js').write_text(bundle, encoding='utf-8')\nprint(f'built app.js from {len(order)} modules, {len(bundle)} chars')\n'''
Path('scripts/build-app.py').write_text(build_script, encoding='utf-8')
Path('app.js').write_text(reassembled, encoding='utf-8')

# Live HTML loads the deterministic bundle. This avoids cross-script hoisting regressions.
index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
pattern = re.compile(r'(?:\n\s*<script src="\./js/[^\"]+\?v=v2\.06"></script>)+')
html, n = pattern.subn('\n    <script src="./app.js?v=v2.06"></script>', html, count=1)
if n != 1:
    raise SystemExit(f'failed to replace split script block, matches={n}')
index_path.write_text(html, encoding='utf-8')
Path('index v2.06.html').write_text(html, encoding='utf-8')

sw_path = Path('service-worker.js')
sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r"const CACHE_NAME = 'baseball-player-card-pwa-v\d+';", "const CACHE_NAME = 'baseball-player-card-pwa-v123';", sw, count=1)
sw = re.sub(
    r"(?:\s*'\./js/[^']+\?v=v2\.06',\n)+",
    "  './app.js?v=v2.06',\n",
    sw,
    count=1,
)
if "'./app.js?v=v2.06'" not in sw or "'./js/core.js?v=v2.06'" in sw:
    raise SystemExit('service worker app shell replacement failed')
sw_path.write_text(sw, encoding='utf-8')

# Static invariants for the features immediately preceding the refactor.
checks = {
    'sync lock': 'function setSyncUiLocked(locked)',
    'sync source metadata': 'function renderSyncMetaBanner(player)',
    'special record standardizer': 'function standardizePitcherSpecialRecords(game = {})',
    'player opens base tab': "selectedTab = 'base';",
    'CPBL daily import': 'async function importCpblDaily(player)',
    'overseas daily import': 'async function importExternalDaily(player)',
    'annual report': 'async function renderAnnualSeasonCanvas(role, player=selectedPlayer())',
    'boot': 'bootApp();',
}
for label, needle in checks.items():
    if needle not in reassembled:
        raise SystemExit(f'missing invariant: {label}')

print('FINAL_MODULES', len(order))
for filename in order:
    p = Path('js', filename)
    print(filename, p.stat().st_size)
print('BUNDLE_BYTES', Path('app.js').stat().st_size)
print('HTML_BYTES', Path('index.html').stat().st_size)
print('FINALIZE_OK')
