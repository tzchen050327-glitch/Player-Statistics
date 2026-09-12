from pathlib import Path
import re

root = Path('.')

# config
p = root / 'js/00-core-config.js'
s = p.read_text(encoding='utf-8')
s = s.replace("const APP_VERSION = 'v2.31';", "const APP_VERSION = 'v2.32';")
s = s.replace("const LEAGUE_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-game-detail';", "const LEAGUE_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-game-detail';\n    const CPBL_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-game-detail';")
s = s.replace("./assets/default-hitter.jpg?v=v2.31", "./assets/default-hitter.jpg?v=v2.32")
s = s.replace("./assets/default-pitcher.jpg?v=v2.31", "./assets/default-pitcher.jpg?v=v2.32")
p.write_text(s, encoding='utf-8')

# CPBL detail endpoint + display metadata
p = root / 'js/11-home-international.js'
s = p.read_text(encoding='utf-8')
s = s.replace("const response = await fetch(LEAGUE_GAME_DETAIL_API_URL, {", "const detailApiUrl = league === 'CPBL' ? CPBL_GAME_DETAIL_API_URL : LEAGUE_GAME_DETAIL_API_URL;\n      const response = await fetch(detailApiUrl, {")
needle = """    function homeGameDetailScore(value) {\n      const n = Number(value);\n      return Number.isFinite(n) ? String(n) : '—';\n    }\n"""
insert = needle + """\n    function homeGameDetailOutLabel(value) {\n      const raw = String(value ?? '').trim();\n      if (!raw) return '';\n      if (/^\\d+$/.test(raw)) return `${Number(raw)}出局`;\n      return raw.replace(/(\\d+)\\s*アウト/g, '$1出局').replace(/(\\d+)\\s*outs?/gi, '$1出局');\n    }\n\n    function homeGameDetailBasesLabel(value) {\n      let raw = String(value ?? '').trim();\n      if (!raw) return '';\n      raw = raw.replace(/走者なし|ランナーなし|no runners?/gi, '壘上無人')\n        .replace(/一塁|1塁/g, '一壘')\n        .replace(/二塁|2塁/g, '二壘')\n        .replace(/三塁|3塁/g, '三壘');\n      if (/壘上無人/.test(raw)) return '壘上無人';\n      if (/一、二、三壘|滿壘/.test(raw)) return /滿壘/.test(raw) ? '一、二、三壘' : raw;\n      const bases = [];\n      if (/一壘|(?:^|[^0-9])1(?:[^0-9]|$)/.test(raw)) bases.push('一');\n      if (/二壘|(?:^|[^0-9])2(?:[^0-9]|$)/.test(raw)) bases.push('二');\n      if (/三壘|(?:^|[^0-9])3(?:[^0-9]|$)/.test(raw)) bases.push('三');\n      return bases.length ? `${[...new Set(bases)].join('、')}壘` : raw;\n    }\n\n    function homeGameDetailRbiLabel(value) {\n      const n = Number(value);\n      return Number.isFinite(n) && n > 0 ? `${Math.floor(n)}打點` : '';\n    }\n\n    function homeGameDetailMeta(play) {\n      return [\n        homeGameDetailOutLabel(play?.outs),\n        homeGameDetailBasesLabel(play?.bases),\n        homeGameDetailRbiLabel(play?.rbi)\n      ].map(v => String(v || '').trim()).filter(Boolean).join('｜');\n    }\n"""
if needle not in s:
    raise SystemExit('score helper anchor not found')
s = s.replace(needle, insert, 1)
old = """                <div class=\"game-detail-pa-meta\">${[play?.outs, play?.bases, play?.count].map(v => String(v || '').trim()).filter(Boolean).map(escapeHtml).join('｜')}</div>"""
new = """                <div class=\"game-detail-pa-meta\">${escapeHtml(homeGameDetailMeta(play))}</div>"""
if old not in s:
    raise SystemExit('PA meta anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# index + archive
p = root / 'index.html'
s = p.read_text(encoding='utf-8')
s = s.replace('content="v2.31"', 'content="v2.32"')
s = s.replace('styles.css?v=v2.31', 'styles.css?v=v2.32')
s = s.replace('app.js?v=v2.31', 'app.js?v=v2.32')
p.write_text(s, encoding='utf-8')
(root / 'index v2.32.html').write_text(s, encoding='utf-8')
old_archive = root / 'index v2.30.html'
if old_archive.exists(): old_archive.unlink()

# service worker
p = root / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace("baseball-player-card-pwa-v148", "baseball-player-card-pwa-v149")
s = s.replace('v=v2.31', 'v=v2.32')
p.write_text(s, encoding='utf-8')
