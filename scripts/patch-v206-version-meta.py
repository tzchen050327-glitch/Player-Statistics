from pathlib import Path

VERSION = 'v2.06'

for filename in ['index.html', 'index v2.06.html']:
    path = Path(filename)
    s = path.read_text(encoding='utf-8')
    meta = f'  <meta name="app-version" content="{VERSION}" />\n'
    if 'name="app-version"' not in s:
        needle = '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n'
        if needle not in s:
            raise SystemExit(f'viewport marker missing in {filename}')
        s = s.replace(needle, needle + meta, 1)
    else:
        import re
        s = re.sub(r'<meta name="app-version" content="[^"]+"\s*/>', f'<meta name="app-version" content="{VERSION}" />', s, count=1)
    path.write_text(s, encoding='utf-8')

boot = Path('js/23-bootstrap.js')
s = boot.read_text(encoding='utf-8')
old = """            const remoteHtml = await versionResponse.text();
            const match = remoteHtml.match(/const APP_VERSION = '([^']+)'/);
            const remoteVersion = String(match?.[1] || '').trim();
"""
new = """            const remoteHtml = await versionResponse.text();
            const metaMatch = remoteHtml.match(/<meta\\s+name=[\"']app-version[\"']\\s+content=[\"']([^\"']+)[\"']/i);
            const legacyMatch = remoteHtml.match(/const APP_VERSION = '([^']+)'/);
            const remoteVersion = String(metaMatch?.[1] || legacyMatch?.[1] || '').trim();
"""
if old not in s:
    raise SystemExit('old remote version parser not found')
s = s.replace(old, new, 1)
boot.write_text(s, encoding='utf-8')

print('PATCH_VERSION_META_OK')
