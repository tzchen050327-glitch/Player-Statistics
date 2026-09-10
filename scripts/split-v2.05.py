from pathlib import Path
import re

index_path = Path('index.html')
backup_path = Path('index v2.04 monolith.html')
css_path = Path('styles.css')
js_path = Path('app.js')
sw_path = Path('service-worker.js')

source = index_path.read_text(encoding='utf-8')

if "const APP_VERSION = 'v2.04'" not in source:
    raise RuntimeError('Expected live index v2.04 before split')
if '<link rel="stylesheet" href="./styles.css' in source or '<script src="./app.js' in source:
    raise RuntimeError('index.html already appears split')
if backup_path.exists():
    raise RuntimeError(f'Backup already exists: {backup_path}')

# Preserve the exact pre-split live index for one-file rollback.
backup_path.write_text(source, encoding='utf-8')

style_matches = list(re.finditer(r'<style(?:\s[^>]*)?>(.*?)</style>', source, flags=re.I | re.S))
if len(style_matches) != 1:
    raise RuntimeError(f'Expected exactly one style block, found {len(style_matches)}')
style_match = style_matches[0]

script_matches = list(re.finditer(r'<script(?:\s[^>]*)?>(.*?)</script>', source, flags=re.I | re.S))
app_matches = [m for m in script_matches if "const APP_VERSION = 'v2.04'" in m.group(1)]
if len(app_matches) != 1:
    raise RuntimeError(f'Expected exactly one application script block, found {len(app_matches)}')
script_match = app_matches[0]

css = style_match.group(1).strip('\n') + '\n'
js = script_match.group(1).strip('\n') + '\n'

# Version bump belongs to the new split build, while the backup stays untouched.
css = css.replace('v2.04', 'v2.05')
js = js.replace('v2.04', 'v2.05')

html = source
html = html[:style_match.start()] + '  <link rel="stylesheet" href="./styles.css?v=v2.05" />' + html[style_match.end():]

# Re-locate the application script after the style replacement changed offsets.
script_matches_after = list(re.finditer(r'<script(?:\s[^>]*)?>(.*?)</script>', html, flags=re.I | re.S))
app_after = [m for m in script_matches_after if "const APP_VERSION = 'v2.04'" in m.group(1)]
if len(app_after) != 1:
    raise RuntimeError(f'Could not re-locate application script after CSS extraction: {len(app_after)}')
script_match_after = app_after[0]
html = html[:script_match_after.start()] + '  <script src="./app.js?v=v2.05"></script>' + html[script_match_after.end():]
html = html.replace('v2.04', 'v2.05')

# Sanity checks: behavior code moved, not duplicated.
if '<style' in html.lower():
    raise RuntimeError('Inline style block still remains in index.html')
if "const APP_VERSION = 'v2.05'" in html:
    raise RuntimeError('Application JS still remains inline in index.html')
if "const APP_VERSION = 'v2.05'" not in js:
    raise RuntimeError('APP_VERSION v2.05 missing from app.js')
if 'function renderAll()' not in js or 'function renderContent()' not in js:
    raise RuntimeError('Core render functions missing from extracted app.js')

css_path.write_text(css, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
index_path.write_text(html, encoding='utf-8')

# Offline/PWA shell must include the newly externalized files.
sw = sw_path.read_text(encoding='utf-8')
sw, count = re.subn(
    r"const CACHE_NAME = 'baseball-player-card-pwa-v\d+';",
    "const CACHE_NAME = 'baseball-player-card-pwa-v121';",
    sw,
    count=1,
)
if count != 1:
    raise RuntimeError('Could not bump service-worker cache version')

needle = "  './index.html',\n"
replacement = "  './index.html',\n  './styles.css?v=v2.05',\n  './app.js?v=v2.05',\n"
if needle not in sw:
    raise RuntimeError('Could not locate service-worker app shell insertion point')
sw = sw.replace(needle, replacement, 1)
sw_path.write_text(sw, encoding='utf-8')

print('Split complete')
print('backup bytes:', backup_path.stat().st_size)
print('index bytes:', index_path.stat().st_size)
print('css bytes:', css_path.stat().st_size)
print('js bytes:', js_path.stat().st_size)
