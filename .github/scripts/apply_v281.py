from pathlib import Path
import re, json

ROOT = Path('.')

# ---------- postseason-history.js ----------
p = ROOT / 'postseason-history.js'
s = p.read_text(encoding='utf-8')

cache_anchor = "  let syncTimer = 0;\n\n  const esc ="
cache_insert = """  let syncTimer = 0;

  const HISTORY_DB_NAME = 'postseason-history-cache-v1';
  const HISTORY_STORE = 'history';
  const HISTORY_CACHE_SCHEMA = 2;
  const CURRENT_YEAR = new Date().getFullYear();
  let historyDbPromise = null;

  function openHistoryDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (historyDbPromise) return historyDbPromise;
    historyDbPromise = new Promise(resolve => {
      const req = indexedDB.open(HISTORY_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath:'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return historyDbPromise;
  }

  async function readPersistentHistory(key, year) {
    try {
      const db = await openHistoryDb();
      if (!db) return null;
      const row = await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readonly');
        const req = tx.objectStore(HISTORY_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (!row || row.schema !== HISTORY_CACHE_SCHEMA || !row.data) return null;
      // Finished seasons are immutable for this UI. Current season stays refreshable.
      if (Number(year) < CURRENT_YEAR) return row.data;
      if (Date.now() - Number(row.at || 0) <= 10 * 60 * 1000) return row.data;
      return null;
    } catch {
      return null;
    }
  }

  async function writePersistentHistory(key, year, data) {
    try {
      const db = await openHistoryDb();
      if (!db) return;
      await new Promise(resolve => {
        const tx = db.transaction(HISTORY_STORE, 'readwrite');
        tx.objectStore(HISTORY_STORE).put({ key, year:Number(year), at:Date.now(), schema:HISTORY_CACHE_SCHEMA, data });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {}
  }

  const esc ="""
if cache_anchor not in s:
    raise SystemExit('cache anchor not found')
s = s.replace(cache_anchor, cache_insert, 1)

request_pattern = re.compile(r"  async function requestHistory\(ctx, league, year\) \{.*?\n  \}\n\n  function playerAppeared", re.S)
request_repl = """  async function requestHistory(ctx, league, year) {
    const key = historyKey(ctx, league, year);
    if (historyCache.has(key)) return historyCache.get(key);
    if (historyInflight.has(key)) return historyInflight.get(key);

    const player = ctx.player;
    const request = (async () => {
      const stored = await readPersistentHistory(key, year);
      if (stored) {
        historyCache.set(key, stored);
        return stored;
      }

      const response = await fetch(API_URL, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          appKey:APP_KEY,
          action:'player-history',
          league,
          year,
          playerId:playerIdFor(player, league),
          playerName:playerNameFor(player)
        })
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      historyCache.set(key, data);
      void writePersistentHistory(key, year, data);
      return data;
    })().finally(() => historyInflight.delete(key));

    historyInflight.set(key, request);
    return request;
  }

  function playerAppeared"""
s, n = request_pattern.subn(request_repl, s, count=1)
if n != 1:
    raise SystemExit(f'requestHistory replacement count {n}')

# Restore stage buttons across the top; keep DNP + running-series-score logic from v2.80.
render_pattern = re.compile(r"  function renderCompetition\(data, key\) \{.*?\n  \}\n\n  async function loadAndRender", re.S)
render_repl = """  function renderCompetition(data, key) {
    const target = host();
    if (!target) return;
    const competitions = (Array.isArray(data?.competitions) ? data.competitions : []).filter(c => c?.playerAppeared);
    if (!competitions.length) {
      target.innerHTML = `<div class=\"postseason-empty\"><strong>${esc(data?.year || '')} 沒有找到這位球員的季後賽出賽紀錄</strong><span>若球員當年沒有實際出賽，這個年份不會保留在季後賽年份選單。</span></div>`;
      return;
    }

    const comp = competitions.find(c => c.key === key) || competitions[0];
    selectedCompetition = comp.key;
    const games = relevantGames(comp);
    const progress = seriesProgress(games, comp, data?.league);

    target.innerHTML = `
      <div class=\"postseason-history\">
        <div class=\"postseason-head\">
          <div><span class=\"postseason-kicker\">POSTSEASON HISTORY</span><h2>${esc(data.year)} ${esc(comp.label)}</h2></div>
          <div class=\"postseason-source\">${esc(data.league)} 官方資料</div>
        </div>
        <div class=\"postseason-stage-tabs\" style=\"--postseason-stage-count:${competitions.length}\">
          ${competitions.map(c=>`<button type=\"button\" class=\"press-btn postseason-stage-btn ${c.key===comp.key?'active':''}\" data-postseason-stage=\"${esc(c.key)}\">${esc(c.label)}</button>`).join('')}
        </div>
        <div class=\"postseason-summary-wrap\">
          ${statGrid('系列打擊成績', comp.batting, 'batting')}
          ${statGrid('系列投球成績', comp.pitching, 'pitching')}
        </div>
        <section class=\"postseason-games-section\">
          <div class=\"postseason-games-head\"><strong>系列賽程</strong><span>${games.length} 場</span></div>
          <div class=\"postseason-game-list\">${games.map((g,index)=>{
            const seriesText = progress[index]?.text || '—';
            const playerLine = gamePlayerLine(g);
            return `
            <button type=\"button\" class=\"postseason-game-row\" data-postseason-game=\"${index}\" ${g?.id?'':'disabled'}>
              <div class=\"postseason-game-date\">${esc(String(g.date||'').replaceAll('-','/'))}</div>
              <div class=\"postseason-game-matchup\"><span>${esc(g.away||'客隊')}</span><b>${esc(scoreCell(g.awayScore))} - ${esc(scoreCell(g.homeScore))}</b><span>${esc(g.home||'主隊')}</span></div>
              <div class=\"postseason-series-score\">大比分 ${esc(seriesText)}</div>
              <div class=\"postseason-game-player ${playerLine==='未出賽'?'is-dnp':''}\">${esc(playerLine)}</div>
              <div class=\"postseason-game-open\">查看逐打席 ›</div>
            </button>`;
          }).join('')}</div>
        </section>
      </div>`;

    target.querySelectorAll('[data-postseason-stage]').forEach(button => {
      button.addEventListener('click', () => renderCompetition(data, String(button.dataset.postseasonStage || '')));
    });
    target.querySelectorAll('[data-postseason-game]').forEach(button => {
      button.addEventListener('click', () => {
        const game = games[Number(button.dataset.postseasonGame)];
        if (!game?.id) return;
        window.dispatchEvent(new CustomEvent('postseason-open-game', { detail:{ game:{...game,status:'final'}, league:data.league, date:game.date, postseason:true } }));
      });
    });
  }

  async function loadAndRender"""
s, n = render_pattern.subn(render_repl, s, count=1)
if n != 1:
    raise SystemExit(f'renderCompetition replacement count {n}')

# Expose a prefetch hook so the app's existing progress overlay can wait for postseason data.
end_anchor = "  window.addEventListener('pageshow', scheduleSync);\n  setTimeout(syncFromApp,0);"
prefetch_insert = """  window.__prefetchPostseasonContext = async () => {
    const ctx = getContext();
    if (!ctx?.player) return { years:[], failures:[] };
    const league = showAvailability(ctx);
    if (!league) return { years:[], failures:[] };
    rememberCandidateYears(ctx, league);
    const key = playerKey(ctx, league);
    const result = await preparePostseasonYears(ctx, league, { background:true });
    return { years:(validYearsCache.get(key) || []).slice(), failures:result?.failures || [] };
  };

  window.addEventListener('pageshow', scheduleSync);
  setTimeout(syncFromApp,0);"""
if end_anchor not in s:
    raise SystemExit('prefetch anchor not found')
s = s.replace(end_anchor, prefetch_insert, 1)
p.write_text(s, encoding='utf-8')

# ---------- postseason-history.css ----------
p = ROOT / 'postseason-history.css'
s = p.read_text(encoding='utf-8')
# Append strong overrides: stage switch stays one horizontal row; parallel content grid from v2.80 is no longer used.
s += """

/* v2.81: series stages are top switches, not parallel content columns. */
.postseason-stage-tabs{
  display:grid!important;
  grid-template-columns:repeat(var(--postseason-stage-count,3),minmax(0,1fr))!important;
  gap:8px!important;
  width:100%;
  overflow-x:auto;
}
.postseason-stage-btn{min-width:0;width:100%;white-space:nowrap;}
.postseason-stage-grid{display:block!important;}
.postseason-series-score{font-size:11px;font-weight:800;opacity:.68;white-space:nowrap;}
.postseason-game-player.is-dnp,.postseason-summary-none{font-weight:800;opacity:.62;}
.postseason-summary-none{padding:18px 4px;text-align:center;}
@media(max-width:700px){
  .postseason-stage-tabs{grid-template-columns:repeat(var(--postseason-stage-count,3),minmax(96px,1fr))!important;}
  .postseason-stage-btn{font-size:11px;padding:7px 4px;}
}
"""
p.write_text(s, encoding='utf-8')

# ---------- app.js ----------
p = ROOT / 'app.js'
s = p.read_text(encoding='utf-8')

# Historical NPB detail sometimes reports scheduled even though play-by-play exists.
detail_anchor = """      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `單場逐打席讀取失敗（${response.status}）`);
      return data;
"""
detail_repl = """      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `單場逐打席讀取失敗（${response.status}）`);
      // NPB historical pages can lack the exact end-time marker used by the backend status parser.
      // If official play-by-play exists, this is not a scheduled pregame page.
      if (league === 'NPB' && String(data?.status || '').toLowerCase() === 'scheduled'
          && Array.isArray(data?.plays) && data.plays.length > 0) {
        data.status = 'final';
        if (data.game && typeof data.game === 'object') data.game.status = 'final';
      }
      return data;
"""
if detail_anchor not in s:
    raise SystemExit('detail request anchor not found')
s = s.replace(detail_anchor, detail_repl, 1)

# Make the existing progress bar wait for the postseason prefetch/cache pass before closing.
finish_pattern = re.compile(r"    async function finishSyncProgress\(status = '同步完成'\) \{\n      setSyncProgress\(100, status\);\n      await markSuccessfulSeasonSyncMeta\(\);\n      await new Promise\(resolve => setTimeout\(resolve, 420\)\);\n      hideSyncProgress\(\);\n    \}")
finish_repl = """    async function finishSyncProgress(status = '同步完成') {
      try {
        if (currentPage === 'player' && typeof window.__prefetchPostseasonContext === 'function') {
          setSyncProgress(92, '正在整理季後賽歷史資料…');
          const postseason = await window.__prefetchPostseasonContext();
          const count = Array.isArray(postseason?.years) ? postseason.years.length : 0;
          if (count) setSyncProgress(98, `季後賽 ${count} 個賽季已快取`);
        }
      } catch (error) {
        console.warn('季後賽背景預抓失敗', error);
      }
      setSyncProgress(100, status);
      await markSuccessfulSeasonSyncMeta();
      await new Promise(resolve => setTimeout(resolve, 420));
      hideSyncProgress();
    }"""
s, n = finish_pattern.subn(finish_repl, s, count=1)
if n != 1:
    raise SystemExit(f'finishSyncProgress replacement count {n}')

s = s.replace("v2.80", "v2.81")
p.write_text(s, encoding='utf-8')

# ---------- index/service worker/version ----------
for name in ['index.html','service-worker.js']:
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    s = s.replace('v2.80','v2.81')
    s = s.replace('v280','v281')
    # Generic SW cache token safety.
    if name == 'service-worker.js':
        s = re.sub(r'baseball-player-card-pwa-v\d+', 'baseball-player-card-pwa-v281', s)
    p.write_text(s, encoding='utf-8')

(ROOT / 'version.json').write_text(json.dumps({'version':'v2.81'}, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf-8')

print('v2.81 patch applied')
