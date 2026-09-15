from pathlib import Path
import json

root = Path('.')
version = json.loads((root / 'version.json').read_text(encoding='utf-8'))['version']

index_path = root / 'index.html'
index = index_path.read_text(encoding='utf-8')
if 'diagnostic-runtime.js' not in index:
    marker = f'<link rel="stylesheet" href="./styles.css?v={version}" />'
    if marker not in index:
        raise SystemExit('styles.css marker not found in index.html')
    index = index.replace(marker, f'<script src="./diagnostic-runtime.js?v={version}"></script>\n  {marker}', 1)
index_path.write_text(index, encoding='utf-8')

sw_path = root / 'service-worker.js'
sw = sw_path.read_text(encoding='utf-8')
if 'diagnostic-runtime.js?v=' not in sw:
    marker = f"  './live-static-update.js?v={version}',\n"
    if marker not in sw:
        raise SystemExit('live-static-update app shell marker not found')
    sw = sw.replace(marker, f"  './diagnostic-runtime.js?v={version}',\n" + marker, 1)
if "url.pathname.endsWith('/diagnostic-runtime.js')" not in sw:
    marker = "  const isCoreAsset = url.pathname.endsWith('/cpbl-realtime.js')"
    if marker not in sw:
        raise SystemExit('isCoreAsset marker not found')
    sw = sw.replace(marker, "  const isCoreAsset = url.pathname.endsWith('/diagnostic-runtime.js')\n    || url.pathname.endsWith('/cpbl-realtime.js')", 1)
sw_path.write_text(sw, encoding='utf-8')

print(f'wired site diagnostics for {version}')
