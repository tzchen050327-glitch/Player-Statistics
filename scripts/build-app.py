from pathlib import Path
import argparse
import difflib
import re

ROOT = Path(__file__).resolve().parents[1]
order_file = ROOT / 'js' / 'module-order.txt'

parser = argparse.ArgumentParser(description='Build app.js from canonical js/ modules.')
parser.add_argument('--check', action='store_true', help='verify without writing app.js')
args = parser.parse_args()

if not order_file.exists():
    raise SystemExit('missing js/module-order.txt')
order = [line.strip() for line in order_file.read_text(encoding='utf-8').splitlines() if line.strip()]
if not order:
    raise SystemExit('empty module order')

parts = []
for name in order:
    path = ROOT / 'js' / name
    if not path.exists():
        raise SystemExit(f'missing module: {name}')
    parts.append(path.read_text(encoding='utf-8'))

bundle = ''.join(parts)
versions = re.findall(r"const APP_VERSION = '([^']+)';", bundle)
if len(versions) != 1:
    raise SystemExit(f'expected exactly one APP_VERSION, found {len(versions)}')
version = versions[0].strip()
if not re.fullmatch(r'v\d+\.\d+', version):
    raise SystemExit(f'invalid APP_VERSION: {version!r}')

target = ROOT / 'app.js'
if args.check:
    current = target.read_text(encoding='utf-8') if target.exists() else ''
    if current != bundle:
        diff = difflib.unified_diff(current.splitlines(), bundle.splitlines(), fromfile='committed app.js', tofile='generated app.js', n=2)
        preview = '\n'.join(list(diff)[:80])
        raise SystemExit('app.js is not reproducible from js/ modules.\n' + preview)
    print(f'app.js matches {len(order)} source modules ({version}, {len(bundle)} chars)')
else:
    target.write_text(bundle, encoding='utf-8')
    print(f'built app.js {version} from {len(order)} modules, {len(bundle)} chars')
