from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Frontend formatter: display runner state as "一、二壘有人" and keep empty-bases wording.
js_path = ROOT / 'js/11-home-international.js'
js = js_path.read_text(encoding='utf-8')
old = """      if (/壘上無人/.test(raw)) return '壘上無人';
      if (/一、二、三壘|滿壘/.test(raw)) return /滿壘/.test(raw) ? '一、二、三壘' : raw;
      const bases = [];
      if (/一壘|(?:^|[^0-9])1(?:[^0-9]|$)/.test(raw)) bases.push('一');
      if (/二壘|(?:^|[^0-9])2(?:[^0-9]|$)/.test(raw)) bases.push('二');
      if (/三壘|(?:^|[^0-9])3(?:[^0-9]|$)/.test(raw)) bases.push('三');
      return bases.length ? `${[...new Set(bases)].join('、')}壘` : raw;
"""
new = """      if (/壘上無人/.test(raw)) return '壘上無人';
      if (/滿壘/.test(raw)) return '一、二、三壘有人';
      const bases = [];
      if (/一壘|(?:^|[^0-9])1(?:[^0-9]|$)/.test(raw)) bases.push('一');
      if (/二壘|(?:^|[^0-9])2(?:[^0-9]|$)/.test(raw)) bases.push('二');
      if (/三壘|(?:^|[^0-9])3(?:[^0-9]|$)/.test(raw)) bases.push('三');
      if (bases.length) return `${[...new Set(bases)].join('、')}壘有人`;
      return /壘$/.test(raw) ? `${raw}有人` : raw;
"""
if old not in js:
    raise SystemExit('target base formatter block not found')
js = js.replace(old, new, 1)
js_path.write_text(js, encoding='utf-8')

# Version bump.
for rel in ['js/00-core-config.js', 'index.html']:
    p = ROOT / rel
    s = p.read_text(encoding='utf-8')
    s = s.replace('v2.32', 'v2.33')
    p.write_text(s, encoding='utf-8')

sw = ROOT / 'service-worker.js'
s = sw.read_text(encoding='utf-8')
s = s.replace("baseball-player-card-pwa-v149", "baseball-player-card-pwa-v150")
s = s.replace('v2.32', 'v2.33')
sw.write_text(s, encoding='utf-8')

# Create release archive from the patched index.
archive = ROOT / 'index v2.33.html'
archive.write_text((ROOT / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
