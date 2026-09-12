from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.24';" not in s:
    raise SystemExit('expected v2.24 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.24';", "const APP_VERSION = 'v2.25';", 1)
s = s.replace('?v=v2.24', '?v=v2.25')
p.write_text(s, encoding='utf-8')

# Quota protection / safer polling
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')

old = """    const homeDailyGamesCache = new Map();
    const homeDailyGamesLoading = new Set();
    const HOME_DAILY_GAMES_TTL = 60 * 1000;
    let homeDailyGamesRefreshTimer = 0;
"""
new = """    const homeDailyGamesCache = new Map();
    const homeDailyGamesLoading = new Set();
    const HOME_DAILY_GAMES_TTL = 2 * 60 * 1000;
    const HOME_DAILY_GAMES_FORCE_FLOOR = 15 * 1000;
    const HOME_DAILY_AUTO_REFRESH_LIMIT = 360;
    const HOME_DAILY_AUTO_REFRESH_STORAGE_KEY = 'home-daily-games-auto-refresh-budget-v1';
    let homeDailyGamesRefreshTimer = 0;

    function homeDailyGamesAutoRefreshBudget() {
      const day = localISODate();
      try {
        const raw = JSON.parse(localStorage.getItem(HOME_DAILY_AUTO_REFRESH_STORAGE_KEY) || '{}');
        if (raw?.day === day) return { day, count:Math.max(0, Number(raw.count) || 0) };
      } catch {}
      return { day, count:0 };
    }

    function homeDailyGamesAutoRefreshAvailable() {
      return homeDailyGamesAutoRefreshBudget().count < HOME_DAILY_AUTO_REFRESH_LIMIT;
    }

    function consumeHomeDailyGamesAutoRefresh() {
      const state = homeDailyGamesAutoRefreshBudget();
      if (state.count >= HOME_DAILY_AUTO_REFRESH_LIMIT) return false;
      try {
        localStorage.setItem(HOME_DAILY_AUTO_REFRESH_STORAGE_KEY, JSON.stringify({ day:state.day, count:state.count + 1 }));
      } catch {}
      return true;
    }
"""
if old not in s:
    raise SystemExit('state anchor not found')
s = s.replace(old, new, 1)

old = """    function homeDailyGamesRefreshDelay(league, date, games = []) {
      if (String(date || '') !== localISODate()) return 0;
      if (homeDailyGamesHasLive(games)) return 30 * 1000;
      const scheduled = (Array.isArray(games) ? games : []).filter(game => String(game?.status || '').toLowerCase() === 'scheduled');
      if (!scheduled.length) return 0;
      const starts = scheduled.map(game => homeDailyGamesStartMs(league, date, game?.time)).filter(Number.isFinite);
      if (!starts.length) return 30 * 60 * 1000;
      const msUntil = Math.min(...starts) - Date.now();
      if (msUntil <= 15 * 60 * 1000) return 60 * 1000;
      if (msUntil <= 60 * 60 * 1000) return 5 * 60 * 1000;
      if (msUntil <= 3 * 60 * 60 * 1000) return 10 * 60 * 1000;
      return 30 * 60 * 1000;
    }
"""
new = """    function homeDailyGamesRefreshDelay(league, date, games = []) {
      if (String(date || '') !== localISODate()) return 0;
      if (homeDailyGamesHasLive(games)) {
        // MLB games span much more of the day, so poll it less aggressively.
        return league === 'MLB' ? 2 * 60 * 1000 : 60 * 1000;
      }
      const scheduled = (Array.isArray(games) ? games : []).filter(game => String(game?.status || '').toLowerCase() === 'scheduled');
      if (!scheduled.length) return 0;
      const starts = scheduled.map(game => homeDailyGamesStartMs(league, date, game?.time)).filter(Number.isFinite);
      if (!starts.length) return 60 * 60 * 1000;
      const msUntil = Math.min(...starts) - Date.now();
      if (msUntil <= 15 * 60 * 1000) return 2 * 60 * 1000;
      if (msUntil <= 60 * 60 * 1000) return 10 * 60 * 1000;
      if (msUntil <= 3 * 60 * 60 * 1000) return 20 * 60 * 1000;
      return 60 * 60 * 1000;
    }
"""
if old not in s:
    raise SystemExit('refresh delay anchor not found')
s = s.replace(old, new, 1)

old = """      const cached = homeDailyGamesCache.get(`${league}|${date}`);
      const games = Array.isArray(cached?.games) ? cached.games : [];
      const delay = homeDailyGamesRefreshDelay(league, date, games);
      if (!delay) return;
      homeDailyGamesRefreshTimer = setTimeout(() => {
        homeDailyGamesRefreshTimer = 0;
        if (document.visibilityState !== 'visible' || currentPage !== 'home' || homeDailyGamesLeague() !== league || String(els.gameDate?.value || localISODate()) !== date) return;
        renderHomeDailyGames({ force:true });
      }, delay);
"""
new = """      const cached = homeDailyGamesCache.get(`${league}|${date}`);
      const games = Array.isArray(cached?.games) ? cached.games : [];
      let delay = homeDailyGamesRefreshDelay(league, date, games);
      // On upstream errors, slow down retries instead of hammering Supabase / official sites.
      if (cached?.error) delay = Math.max(delay || 0, 10 * 60 * 1000);
      if (!delay || !homeDailyGamesAutoRefreshAvailable()) return;
      if (globalThis.navigator?.connection?.saveData) delay *= 2;
      homeDailyGamesRefreshTimer = setTimeout(() => {
        homeDailyGamesRefreshTimer = 0;
        if (document.visibilityState !== 'visible' || currentPage !== 'home' || homeDailyGamesLeague() !== league || String(els.gameDate?.value || localISODate()) !== date) return;
        if (!consumeHomeDailyGamesAutoRefresh()) return;
        renderHomeDailyGames({ force:true });
      }, delay);
"""
if old not in s:
    raise SystemExit('schedule anchor not found')
s = s.replace(old, new, 1)

old = """    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (currentPage === 'home') renderHomeDailyGames({ force:true });
      } else {
        stopHomeDailyGamesAutoRefresh();
      }
    });
"""
new = """    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Reuse a still-fresh result instead of forcing another Edge Function invocation on every focus change.
        if (currentPage === 'home') renderHomeDailyGames();
      } else {
        stopHomeDailyGamesAutoRefresh();
      }
    });
"""
if old not in s:
    raise SystemExit('visibility anchor not found')
s = s.replace(old, new, 1)

old = """      const cached = homeDailyGamesCache.get(key);
      if (!force && cached && now - Number(cached.at || 0) < HOME_DAILY_GAMES_TTL) return cached.games || [];
      if (homeDailyGamesLoading.has(key)) return null;
"""
new = """      const cached = homeDailyGamesCache.get(key);
      const age = cached ? now - Number(cached.at || 0) : Infinity;
      if (!force && cached && age < HOME_DAILY_GAMES_TTL) return cached.games || [];
      // Even forced refreshes are coalesced for a short floor to avoid double-clicks / rapid tab changes.
      if (force && cached && age < HOME_DAILY_GAMES_FORCE_FLOOR) return cached.games || [];
      if (homeDailyGamesLoading.has(key)) return null;
"""
if old not in s:
    raise SystemExit('load cache anchor not found')
s = s.replace(old, new, 1)

# Don't show a moving rail if the per-device automatic refresh safety budget is exhausted.
old = """                ${homeDailyGamesHasLive(games) ? `<span class=\"home-live-refresh-rail ${loading ? 'is-refreshing' : ''}\" title=\"比賽進行中，自動更新比分\" aria-label=\"比賽進行中，自動更新比分\"><i></i></span>` : ''}
"""
new = """                ${homeDailyGamesHasLive(games) && homeDailyGamesAutoRefreshAvailable() ? `<span class=\"home-live-refresh-rail ${loading ? 'is-refreshing' : ''}\" title=\"比賽進行中，自動更新比分\" aria-label=\"比賽進行中，自動更新比分\"><i></i></span>` : ''}
"""
if old not in s:
    raise SystemExit('live rail anchor not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

# Versioned page/archive/cache
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.24', 'v2.25')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.25.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.23.html'
if old_archive.exists(): old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v141', 'baseball-player-card-pwa-v142')
s = s.replace('v2.24', 'v2.25')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.25 quota guard applied')
