from pathlib import Path
import json, re

p = Path('app.js')
s = p.read_text(encoding='utf-8')

s = s.replace("const CPBL_MINOR_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-minor-game-detail';",
              "const CPBL_MINOR_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/cpbl-minor-game-detail-cache';")

old = """      const requestKindCode = String(payload?.kindCode || 'A').toUpperCase();
      const requestUrl = action === 'daily' && ['E','C'].includes(requestKindCode)
        ? CPBL_POSTSEASON_DAILY_API_URL
        : action === 'daily' && ['A','D'].includes(requestKindCode)
          ? CPBL_DAILY_CACHE_API_URL
          : CPBL_API_URL;
"""
new = """      const requestKindCode = String(payload?.kindCode || 'A').toUpperCase();
      const requestUrl = action === 'daily' && ['A','D','E','C'].includes(requestKindCode)
        ? CPBL_DAILY_CACHE_API_URL
        : CPBL_API_URL;
"""
if old not in s: raise SystemExit('cpblRequest routing anchor missing')
s = s.replace(old, new, 1)

if 'async function leagueGameDetailRequest(league, date, game) {' in s:
    s = s.replace('async function leagueGameDetailRequest(league, date, game) {',
                  'async function leagueGameDetailRequest(league, date, game, force = false) {', 1)
status_anchor = "          status:String(game?.status || '')\n"
if status_anchor not in s: raise SystemExit('detail body status anchor missing')
s = s.replace(status_anchor, "          status:String(game?.status || ''),\n          force:Boolean(force)\n", 1)

s = s.replace('refreshActiveHomeGameDetail({ force:true, automatic:true });',
              'refreshActiveHomeGameDetail({ force:false, automatic:true });')

old = """      if (cached?.detail) renderHomeGameDetail(cached.detail, game, { loading:true });
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      try {
        let detail = null;
        let fromPublishedCache = false;
"""
new = """      if (cached?.detail) renderHomeGameDetail(cached.detail, game, { loading:false });
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      try {
        let detail = null;
        const staleDetail = !force ? (cached?.detail || null) : null;
        let fromPublishedCache = false;
        let fromAnyCache = Boolean(staleDetail);
"""
if old not in s: raise SystemExit('SWR start anchor missing')
s = s.replace(old, new, 1)

old = """            detail = published?.detail || null;
            fromPublishedCache = Boolean(detail);
"""
new = """            detail = published?.detail || null;
            fromPublishedCache = Boolean(detail);
            if (detail) fromAnyCache = true;
"""
if old not in s: raise SystemExit('published CPBL anchor missing')
s = s.replace(old, new, 1)

old = """            const published = await window.__npbRealtimeReadPublished(date, String(game.id));
            detail = published?.detail || null;
"""
new = """            const published = await window.__npbRealtimeReadPublished(date, String(game.id));
            detail = published?.detail || null;
            if (detail) fromAnyCache = true;
"""
if old in s: s = s.replace(old, new, 1)

old = """        if (!detail) detail = await leagueGameDetailRequest(league, date, game);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        if (String(detail?.status || '').toLowerCase() === 'scheduled' && (league === 'CPBL' || league === 'NPB') && (!fromPublishedCache || force)) {
"""
new = """        if (!detail && staleDetail) detail = staleDetail;
        if (!detail) detail = await leagueGameDetailRequest(league, date, game, force);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        if (String(detail?.status || '').toLowerCase() === 'scheduled' && (league === 'CPBL' || league === 'NPB') && (!fromAnyCache || force)) {
"""
if old not in s: raise SystemExit('detail fallback anchor missing')
s = s.replace(old, new, 1)

old = """        homeGameDetailCache.set(key, { at:Date.now(), detail });
        homeGameDetailErrorStreak = 0;
        syncHomeDailyGameFromDetail(league, date, game, detail);
        if (detail?.game?.id && !game.id) game.id = detail.game.id;
        renderHomeGameDetail(detail, game);
        scheduleHomeGameDetailRefresh(detail);
"""
new = """        const detailChanged = !cached?.detail || JSON.stringify(cached.detail) !== JSON.stringify(detail);
        homeGameDetailCache.set(key, { at:Date.now(), detail });
        homeGameDetailErrorStreak = 0;
        syncHomeDailyGameFromDetail(league, date, game, detail);
        if (detail?.game?.id && !game.id) game.id = detail.game.id;
        if (detailChanged || force) renderHomeGameDetail(detail, game);
        scheduleHomeGameDetailRefresh(detail);
"""
if old not in s: raise SystemExit('detail render anchor missing')
s = s.replace(old, new, 1)

s = s.replace("const APP_VERSION = 'v2.90';", "const APP_VERSION = 'v2.91';", 1)
s = s.replace('v2.90','v2.91').replace('v290','v291')
p.write_text(s, encoding='utf-8')

p = Path('index.html')
h = p.read_text(encoding='utf-8')
if 'cacheDiagnosticsLink' not in h:
    anchor = '<button id="allPlayersBtn" class="press-btn">展開全部</button>'
    if anchor not in h: raise SystemExit('diagnostics link anchor missing')
    h = h.replace(anchor, anchor + '\n            <a id="cacheDiagnosticsLink" class="press-btn" href="./diagnostics.html" target="_blank" rel="noopener">快取診斷</a>', 1)
h = h.replace('v2.90','v2.91').replace('v290','v291')
p.write_text(h, encoding='utf-8')

for name in ['cpbl-realtime.js','service-worker.js']:
    q = Path(name)
    x = q.read_text(encoding='utf-8').replace('v2.90','v2.91').replace('v290','v291')
    if name == 'service-worker.js':
        x = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v291', x)
    q.write_text(x, encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.91'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')
for old in ['.github/scripts/apply_v289.py','.github/workflows/apply-v289.yml']:
    Path(old).unlink(missing_ok=True)
print('v2.91 frontend cache patch applied')
