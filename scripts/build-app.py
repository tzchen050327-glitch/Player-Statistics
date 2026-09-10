from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
order_file = ROOT / 'js' / 'module-order.txt'
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
if "const APP_VERSION = 'v2.06';" not in bundle:
    raise SystemExit('wrong APP_VERSION')
(ROOT / 'app.js').write_text(bundle, encoding='utf-8')
print(f'built app.js from {len(order)} modules, {len(bundle)} chars')
