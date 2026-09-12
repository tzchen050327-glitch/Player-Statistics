from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.22';" not in s:
    raise SystemExit('expected v2.22 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.22';", "const APP_VERSION = 'v2.23';", 1)
s = s.replace('?v=v2.22', '?v=v2.23')
p.write_text(s, encoding='utf-8')

p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
anchor = """    const homeDailyGamesCache = new Map();\n    const homeDailyGamesLoading = new Set();\n    const HOME_DAILY_GAMES_TTL = 60 * 1000;\n"""
insert = """    const homeDailyGamesCache = new Map();\n    const homeDailyGamesLoading = new Set();\n    const HOME_DAILY_GAMES_TTL = 60 * 1000;\n    let homeDailyGamesRefreshTimer = 0;\n\n    function homeDailyGamesHasLive(games = []) {\n      return Array.isArray(games) && games.some(game => String(game?.status || '').toLowerCase() === 'live');\n    }\n\n    function homeDailyGamesStartMs(league, date, time) {\n      const m = String(time || '').match(/(\\d{1,2}):(\\d{2})/);\n      if (!m || !/^\\d{4}-\\d{2}-\\d{2}$/.test(String(date || ''))) return NaN;\n      const hh = Number(m[1]);\n      const mm = Number(m[2]);\n      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;\n      const offsetHours = league === 'NPB' || league === 'KBO' ? 9 : league === 'MLB' ? -4 : 8;\n      const [y, mo, d] = String(date).split('-').map(Number);\n      return Date.UTC(y, mo - 1, d, hh - offsetHours, mm, 0, 0);\n    }\n\n    function homeDailyGamesRefreshDelay(league, date, games = []) {\n      if (String(date || '') !== localISODate()) return 0;\n      if (homeDailyGamesHasLive(games)) return 30 * 1000;\n      const scheduled = (Array.isArray(games) ? games : []).filter(game => String(game?.status || '').toLowerCase() === 'scheduled');\n      if (!scheduled.length) return 0;\n      const starts = scheduled.map(game => homeDailyGamesStartMs(league, date, game?.time)).filter(Number.isFinite);\n      if (!starts.length) return 30 * 60 * 1000;\n      const msUntil = Math.min(...starts) - Date.now();\n      if (msUntil <= 15 * 60 * 1000) return 60 * 1000;\n      if (msUntil <= 60 * 60 * 1000) return 5 * 60 * 1000;\n      if (msUntil <= 3 * 60 * 60 * 1000) return 10 * 60 * 1000;\n      return 30 * 60 * 1000;\n    }\n\n    function stopHomeDailyGamesAutoRefresh() {\n      if (homeDailyGamesRefreshTimer) clearTimeout(homeDailyGamesRefreshTimer);\n      homeDailyGamesRefreshTimer = 0;\n    }\n\n    function scheduleHomeDailyGamesAutoRefresh() {\n      stopHomeDailyGamesAutoRefresh();\n      if (document.visibilityState !== 'visible' || currentPage !== 'home') return;\n      const league = homeDailyGamesLeague();\n      const date = String(els.gameDate?.value || localISODate());\n      if (!league) return;\n      const cached = homeDailyGamesCache.get(`${league}|${date}`);\n      const games = Array.isArray(cached?.games) ? cached.games : [];\n      const delay = homeDailyGamesRefreshDelay(league, date, games);\n      if (!delay) return;\n      homeDailyGamesRefreshTimer = setTimeout(() => {\n        homeDailyGamesRefreshTimer = 0;\n        if (document.visibilityState !== 'visible' || currentPage !== 'home' || homeDailyGamesLeague() !== league || String(els.gameDate?.value || localISODate()) !== date) return;\n        renderHomeDailyGames({ force:true });\n      }, delay);\n    }\n\n    document.addEventListener('visibilitychange', () => {\n      if (document.visibilityState === 'visible') {\n        if (currentPage === 'home') renderHomeDailyGames({ force:true });\n      } else {\n        stopHomeDailyGamesAutoRefresh();\n      }\n    });\n"""
if anchor not in s:
    raise SystemExit('daily games state anchor not found')
s = s.replace(anchor, insert, 1)

old = """              <strong>當日賽事</strong>\n              <span>${escapeHtml(leagueLabel)}</span>\n"""
new = """              <strong>當日賽事</strong>\n              <span class=\"home-league-live-row\">\n                <span>${escapeHtml(leagueLabel)}</span>\n                ${homeDailyGamesHasLive(games) ? `<span class=\"home-live-refresh-rail ${loading ? 'is-refreshing' : ''}\" title=\"比賽進行中，自動更新比分\" aria-label=\"比賽進行中，自動更新比分\"><i></i></span>` : ''}\n              </span>\n"""
if old not in s:
    raise SystemExit('league label anchor not found')
s = s.replace(old, new, 1)

old = """      host.innerHTML = `\n        <section class=\"home-daily-games-shell\">\n"""
new = """      scheduleHomeDailyGamesAutoRefresh();\n      host.innerHTML = `\n        <section class=\"home-daily-games-shell\">\n"""
if old not in s:
    raise SystemExit('render html anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.23 live league refresh activity */
.home-league-live-row{display:inline-flex;align-items:center;gap:7px;min-width:0}
.home-live-refresh-rail{position:relative;display:inline-block;width:42px;height:7px;border-radius:999px;overflow:hidden;background:#dce7f1;box-shadow:inset 0 0 0 1px rgba(31,78,121,.08);vertical-align:middle}
.home-live-refresh-rail i{position:absolute;top:1px;left:2px;width:13px;height:5px;border-radius:999px;background:linear-gradient(90deg,#d7ad52,#f3d47d,#d7ad52);box-shadow:0 0 5px rgba(215,173,82,.48);animation:homeLiveRefreshSweep 1.55s ease-in-out infinite alternate}
.home-live-refresh-rail.is-refreshing i{animation-duration:.62s;box-shadow:0 0 8px rgba(215,173,82,.78)}
@keyframes homeLiveRefreshSweep{from{transform:translateX(0)}to{transform:translateX(25px)}}
@media (prefers-reduced-motion:reduce){.home-live-refresh-rail i{animation-duration:3s}}
'''
if '/* v2.23 live league refresh activity */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.22', 'v2.23')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.23.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.21.html'
if old_archive.exists(): old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v139', 'baseball-player-card-pwa-v140')
s = s.replace('v2.22', 'v2.23')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.23 smart live refresh patch applied')
