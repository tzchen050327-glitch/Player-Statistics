from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    return text.replace(old, new, 1)

runtime = [
    'app.js','index.html','styles.css','game-detail-enhancement.css',
    'game-detail-enhancement.js','live-static-update.js',
    'cpbl-cache-router.js','service-worker.js','rescue.html',
    'report-layout.css','report-layout.js','cpbl-realtime.js'
]
for name in runtime:
    p=Path(name)
    if not p.exists():
        continue
    s=p.read_text(encoding='utf-8')
    s=s.replace('v2.53','v2.54').replace('v253','v254').replace('V253','V254')
    p.write_text(s,encoding='utf-8')

# ---------- app.js: CPBL Realtime becomes primary; browser polling is fallback only ----------
p=Path('app.js'); s=p.read_text(encoding='utf-8')

old="""      if (!el) return;
      if (activeHomeGameDetail?.loading) {
"""
new="""      if (!el) return;
      if (activeHomeGameDetail?.league === 'CPBL' && window.__cpblRealtimeConnected) {
        el.textContent = '即時推送';
        return;
      }
      if (activeHomeGameDetail?.loading) {
"""
s=replace_once(s,old,new,'detail realtime countdown')

pat=r"    function scheduleHomeGameDetailRefresh\(detail\) \{.*?\n    \}\n\n    async function refreshActiveHomeGameDetail"
new_block="""    function scheduleHomeGameDetailRefresh(detail) {
      stopHomeGameDetailRefresh();
      if (!activeHomeGameDetail || document.visibilityState !== 'visible') return;
      if (String(detail?.status || '').toLowerCase() !== 'live') return;
      if (!homeGameDetailAutoAvailable()) return;
      let delay = 30 * 1000;
      if (activeHomeGameDetail.league === 'CPBL') {
        // v2.54: CPBL is pushed by Supabase Realtime. Poll only as a low-frequency
        // safety net when the Realtime channel is unavailable.
        if (window.__cpblRealtimeConnected) {
          updateHomeGameDetailRefreshCountdown();
          return;
        }
        delay = 5 * 60 * 1000;
      } else if (activeHomeGameDetail.league === 'NPB') {
        delay = 45 * 1000;
      }
      startHomeGameDetailRefreshCountdown(delay);
      homeGameDetailRefreshTimer = setTimeout(() => {
        homeGameDetailRefreshTimer = 0;
        stopHomeGameDetailRefreshCountdown();
        if (!activeHomeGameDetail || document.visibilityState !== 'visible' || !consumeHomeGameDetailAuto()) return;
        refreshActiveHomeGameDetail({ force:true, automatic:true });
      }, delay);
    }

    async function refreshActiveHomeGameDetail"""
s,n=re.subn(pat,new_block,s,count=1,flags=re.S)
if n!=1: raise SystemExit('scheduleHomeGameDetailRefresh patch failed')

old="""        const detail = await leagueGameDetailRequest(league, date, game);
"""
new="""        let detail = null;
        if (league === 'CPBL' && date === localISODate() && game?.id && typeof window.__cpblRealtimeReadPublished === 'function') {
          try {
            const published = await window.__cpblRealtimeReadPublished(date, String(game.id));
            detail = published?.detail || null;
          } catch {}
        }
        if (!detail) detail = await leagueGameDetailRequest(league, date, game);
"""
s=replace_once(s,old,new,'published initial detail')

old="""    function closeHomeGameDetail() {
      stopHomeGameDetailRefresh();
      activeHomeGameDetail = null;
"""
new="""    function closeHomeGameDetail() {
      stopHomeGameDetailRefresh();
      window.dispatchEvent(new CustomEvent('cpbl-live-unwatch'));
      document.body.classList.remove('gdx-cpbl-landscape');
      activeHomeGameDetail = null;
"""
s=replace_once(s,old,new,'detail close cleanup')

pat=r"(    function openHomeGameDetail\(game, league, date\) \{.*?      activeHomeGameDetail = \{ league, date, game, key, loading:false \};)(.*?      refreshActiveHomeGameDetail\(\);\n    \}\n)"
m=re.search(pat,s,flags=re.S)
if not m: raise SystemExit('openHomeGameDetail target not found')
injected=m.group(1)+"""
      if (league === 'CPBL' && date === localISODate() && game?.id) {
        window.dispatchEvent(new CustomEvent('cpbl-live-watch', { detail:{ date, gameId:String(game.id) } }));
      } else {
        window.dispatchEvent(new CustomEvent('cpbl-live-unwatch'));
      }
"""+m.group(2)
listeners="""

    window.addEventListener('cpbl-live-cache-update', event => {
      if (!activeHomeGameDetail || activeHomeGameDetail.league !== 'CPBL') return;
      const row = event?.detail?.row || null;
      const detail = event?.detail?.detail || row?.published_payload || null;
      if (!detail?.game) return;
      const { date, game } = activeHomeGameDetail;
      if (String(row?.game_date || detail?.date || '') !== String(date || '')) return;
      const expectedId = String(game?.id || '');
      const incomingId = String(row?.game_id || detail?.game?.id || '');
      if (expectedId && incomingId && expectedId !== incomingId) return;
      const key = homeGameDetailKey('CPBL', date, game);
      homeGameDetailCache.set(key, { at:Date.now(), detail });
      homeGameDetailErrorStreak = 0;
      syncHomeDailyGameFromDetail('CPBL', date, game, detail);
      renderHomeGameDetail(detail, game);
      scheduleHomeGameDetailRefresh(detail);
    });

    window.addEventListener('cpbl-live-realtime-status', event => {
      if (!activeHomeGameDetail || activeHomeGameDetail.league !== 'CPBL') return;
      const cached = homeGameDetailCache.get(homeGameDetailKey('CPBL', activeHomeGameDetail.date, activeHomeGameDetail.game));
      if (event?.detail?.connected) {
        stopHomeGameDetailRefresh();
        updateHomeGameDetailRefreshCountdown();
      } else if (cached?.detail) {
        scheduleHomeGameDetailRefresh(cached.detail);
      }
    });

    window.addEventListener('cpbl-live-day-update', event => {
      if (currentPage !== 'home' || homeDailyGamesLeague() !== 'CPBL') return;
      const row = event?.detail?.row || null;
      const detail = event?.detail?.detail || row?.published_payload || null;
      const date = String(row?.game_date || detail?.date || '');
      if (!date || date !== String(els.gameDate?.value || localISODate())) return;
      const key = `CPBL|${date}`;
      const cached = homeDailyGamesCache.get(key);
      if (!cached || !Array.isArray(cached.games)) return;
      const incomingId = String(row?.game_id || detail?.game?.id || '');
      const index = cached.games.findIndex(g => String(g?.id || '') === incomingId);
      if (index < 0) return;
      const gameInfo = detail?.game || {};
      cached.games[index] = {
        ...cached.games[index],
        ...gameInfo,
        id:incomingId || cached.games[index]?.id,
        status:String(detail?.status || row?.status || cached.games[index]?.status || 'scheduled')
      };
      cached.at = Date.now();
      cached.error = '';
      homeDailyGamesCache.set(key, cached);
      renderHomeDailyGames({ skipLoad:true });
    });

    window.addEventListener('cpbl-live-day-realtime-status', event => {
      if (currentPage !== 'home' || homeDailyGamesLeague() !== 'CPBL') return;
      if (event?.detail?.connected) stopHomeDailyGamesAutoRefresh();
      else scheduleHomeDailyGamesAutoRefresh();
    });
"""
s=s[:m.start()]+injected+listeners+s[m.end():]

old="""      const league = homeDailyGamesLeague();
      const date = String(els.gameDate?.value || localISODate());
      const cached = homeDailyGamesCache.get(`${league}|${date}`);
"""
new="""      const league = homeDailyGamesLeague();
      const date = String(els.gameDate?.value || localISODate());
      if (league === 'CPBL' && date === localISODate()) {
        window.dispatchEvent(new CustomEvent('cpbl-live-watch-day', { detail:{ date } }));
        if (window.__cpblDayRealtimeConnected) return;
      } else {
        window.dispatchEvent(new CustomEvent('cpbl-live-unwatch-day'));
      }
      const cached = homeDailyGamesCache.get(`${league}|${date}`);
"""
s=replace_once(s,old,new,'daily realtime watch')

old="""      let delay = homeDailyGamesRefreshDelay(league, date, games);
      // On upstream errors, slow down retries instead of hammering Supabase / official sites.
"""
new="""      let delay = homeDailyGamesRefreshDelay(league, date, games);
      if (league === 'CPBL') delay = window.__cpblDayRealtimeConnected ? 0 : 5 * 60 * 1000;
      // On upstream errors, slow down retries instead of hammering Supabase / official sites.
"""
s=replace_once(s,old,new,'daily fallback cadence')
p.write_text(s,encoding='utf-8')

# ---------- game-detail-enhancement.js: CPBL-only landscape + backend-authoritative lineup ----------
p=Path('game-detail-enhancement.js'); s=p.read_text(encoding='utf-8')
pat=r"  function lineupEntries\(detail, side\) \{.*?\n  \}\n\n  function positionKey"
new="""  function lineupEntries(detail, side) {
    // v2.54: the backend owns batting order and season/live totals. The browser
    // renders the normalized lineup instead of rebuilding it from play sequence.
    return rawRoster(detail,side)
      .sort((a,b)=>(Number(a.order)||99)-(Number(b.order)||99))
      .slice(0,9);
  }

  function positionKey"""
s,n=re.subn(pat,new,s,count=1,flags=re.S)
if n!=1: raise SystemExit('lineupEntries patch failed')

old="""    const detail=latestDetail; if (!detail?.game) return;
    const overlay=document.getElementById('homeGameDetailOverlay'), body=overlay?.querySelector('#homeGameDetailBody');
    if (!overlay||overlay.classList.contains('hidden')||!body||!sameGame(body,detail)) return;
"""
new="""    const detail=latestDetail; if (!detail?.game) return;
    const overlay=document.getElementById('homeGameDetailOverlay'), body=overlay?.querySelector('#homeGameDetailBody');
    const isCpbl=String(detail?.league||'').toUpperCase()==='CPBL';
    if (!isCpbl) {
      document.body.classList.remove('gdx-cpbl-landscape');
      body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
      if (body) delete body.dataset.gdxStamp;
      return;
    }
    document.body.classList.add('gdx-cpbl-landscape');
    if (!overlay||overlay.classList.contains('hidden')||!body||!sameGame(body,detail)) return;
"""
s=replace_once(s,old,new,'CPBL-only enhancement')
p.write_text(s,encoding='utf-8')

# ---------- CSS: never hide/reshape NPB landscape ----------
p=Path('game-detail-enhancement.css'); s=p.read_text(encoding='utf-8')
old="#homeGameDetailBody{overflow:hidden;}#homeGameDetailBody>.game-detail-content{display:none!important;}.gdx-landscape-board{display:grid;"
new="body.gdx-cpbl-landscape #homeGameDetailBody{overflow:hidden;}body.gdx-cpbl-landscape #homeGameDetailBody>.game-detail-content{display:none!important;}body.gdx-cpbl-landscape .gdx-landscape-board{display:grid;"
s=replace_once(s,old,new,'landscape CSS scope')
p.write_text(s,encoding='utf-8')

p=Path('report-layout.css'); s=p.read_text(encoding='utf-8')
s=s.replace('body.home-game-detail-open ', 'body.home-game-detail-open.gdx-cpbl-landscape ')
p.write_text(s,encoding='utf-8')

# ---------- index + service worker ----------
p=Path('index.html'); s=p.read_text(encoding='utf-8')
if './cpbl-realtime.js?v=v2.54' not in s:
    s=s.replace(
        '<script src="./live-static-update.js?v=v2.54"></script>',
        '<script src="./live-static-update.js?v=v2.54"></script>\n  <script src="./cpbl-realtime.js?v=v2.54"></script>'
    )
p.write_text(s,encoding='utf-8')

p=Path('service-worker.js'); s=p.read_text(encoding='utf-8')
s=re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'baseball-player-card-pwa-v254';", s, count=1)
if "'./cpbl-realtime.js?v=v2.54'" not in s:
    s=s.replace("  './live-static-update.js?v=v2.54',", "  './live-static-update.js?v=v2.54',\n  './cpbl-realtime.js?v=v2.54',")
if "url.pathname.endsWith('/cpbl-realtime.js')" not in s:
    s=s.replace(
        "  const isCoreAsset = url.pathname.endsWith('/live-static-update.js')",
        "  const isCoreAsset = url.pathname.endsWith('/cpbl-realtime.js')\n    || url.pathname.endsWith('/live-static-update.js')"
    )
p.write_text(s,encoding='utf-8')

# Guardrails.
for name in runtime:
    p=Path(name)
    if not p.exists(): continue
    text=p.read_text(encoding='utf-8')
    if 'v2.53' in text or 'v253' in text or 'V253' in text:
        raise SystemExit(f'old version token remains: {name}')
if "const APP_VERSION = 'v2.54';" not in Path('app.js').read_text(encoding='utf-8'):
    raise SystemExit('APP_VERSION is not v2.54')
if './cpbl-realtime.js?v=v2.54' not in Path('index.html').read_text(encoding='utf-8'):
    raise SystemExit('cpbl-realtime.js missing from index')
