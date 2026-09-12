from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# Version + endpoint
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.25';" not in s:
    raise SystemExit('expected v2.25 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.25';", "const APP_VERSION = 'v2.26';", 1)
s = s.replace("    const LEAGUE_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-daily-games';\n",
              "    const LEAGUE_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-daily-games';\n    const LEAGUE_GAME_DETAIL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-game-detail';\n", 1)
s = s.replace('?v=v2.25', '?v=v2.26')
p.write_text(s, encoding='utf-8')

# Game-detail behavior
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')

state_anchor = """    const homeDailyGamesCache = new Map();
    const homeDailyGamesLoading = new Set();
    const HOME_DAILY_GAMES_TTL = 2 * 60 * 1000;
"""
state_insert = """    const homeDailyGamesCache = new Map();
    const homeDailyGamesLoading = new Set();
    const homeGameDetailCache = new Map();
    const HOME_GAME_DETAIL_AUTO_LIMIT = 120;
    const HOME_GAME_DETAIL_AUTO_STORAGE_KEY = 'home-game-detail-auto-budget-v1';
    let activeHomeGameDetail = null;
    let homeGameDetailRefreshTimer = 0;
    const HOME_DAILY_GAMES_TTL = 2 * 60 * 1000;
"""
if state_anchor not in s:
    raise SystemExit('state anchor not found')
s = s.replace(state_anchor, state_insert, 1)

# Prevent home schedule polling while full game detail is open.
old = """    function scheduleHomeDailyGamesAutoRefresh() {
      stopHomeDailyGamesAutoRefresh();
      if (document.visibilityState !== 'visible' || currentPage !== 'home') return;
"""
new = """    function scheduleHomeDailyGamesAutoRefresh() {
      stopHomeDailyGamesAutoRefresh();
      if (activeHomeGameDetail) return;
      if (document.visibilityState !== 'visible' || currentPage !== 'home') return;
"""
if old not in s:
    raise SystemExit('schedule home anchor not found')
s = s.replace(old, new, 1)

# Insert detail helpers after daily-games request function and before loadHomeDailyGames.
marker = """    async function loadHomeDailyGames(league, date, { force = false } = {}) {
"""
if marker not in s:
    raise SystemExit('load daily marker missing')
helpers = r'''
    function homeGameDetailSupported(league) {
      return league === 'CPBL' || league === 'NPB';
    }

    function homeGameDetailKey(league, date, game = {}) {
      return [league, date, String(game?.id || ''), String(game?.away || ''), String(game?.home || '')].join('|');
    }

    function homeGameDetailBudget() {
      const day = localISODate();
      try {
        const raw = JSON.parse(localStorage.getItem(HOME_GAME_DETAIL_AUTO_STORAGE_KEY) || '{}');
        if (raw?.day === day) return { day, count:Math.max(0, Number(raw.count) || 0) };
      } catch {}
      return { day, count:0 };
    }

    function homeGameDetailAutoAvailable() {
      return homeGameDetailBudget().count < HOME_GAME_DETAIL_AUTO_LIMIT;
    }

    function consumeHomeGameDetailAuto() {
      const state = homeGameDetailBudget();
      if (state.count >= HOME_GAME_DETAIL_AUTO_LIMIT) return false;
      try {
        localStorage.setItem(HOME_GAME_DETAIL_AUTO_STORAGE_KEY, JSON.stringify({ day:state.day, count:state.count + 1 }));
      } catch {}
      return true;
    }

    async function leagueGameDetailRequest(league, date, game) {
      const response = await fetch(LEAGUE_GAME_DETAIL_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'game-detail',
          league,
          date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || ''),
          venue:String(game?.venue || ''),
          status:String(game?.status || '')
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `單場逐打席讀取失敗（${response.status}）`);
      return data;
    }

    function homeGameDetailStatusLabel(detail) {
      const status = String(detail?.status || '').toLowerCase();
      if (status === 'live') return ['比賽中', detail?.game?.inningLabel || ''].filter(Boolean).join('｜');
      if (status === 'final') return '比賽結束';
      if (status === 'cancelled') return '延賽／取消';
      return '尚未開打';
    }

    function homeGameDetailScore(value) {
      const n = Number(value);
      return Number.isFinite(n) ? String(n) : '—';
    }

    function homeGameDetailGroups(plays = []) {
      const map = new Map();
      for (const play of Array.isArray(plays) ? plays : []) {
        const inning = Math.max(0, Number(play?.inning) || 0);
        const half = String(play?.half || '');
        const key = `${inning}|${half}`;
        if (!map.has(key)) map.set(key, { inning, half, team:String(play?.team || ''), plays:[] });
        map.get(key).plays.push(play);
      }
      return [...map.values()].sort((a,b) => a.inning - b.inning || (a.half === 'top' ? -1 : 1));
    }

    function ensureHomeGameDetailOverlay() {
      let overlay = document.getElementById('homeGameDetailOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'homeGameDetailOverlay';
      overlay.className = 'home-game-detail-overlay hidden';
      overlay.innerHTML = '<div class="home-game-detail-page" role="dialog" aria-modal="true" aria-label="單場逐打席"><div id="homeGameDetailBody"></div></div>';
      document.body.appendChild(overlay);
      return overlay;
    }

    function stopHomeGameDetailRefresh() {
      if (homeGameDetailRefreshTimer) clearTimeout(homeGameDetailRefreshTimer);
      homeGameDetailRefreshTimer = 0;
    }

    function closeHomeGameDetail() {
      stopHomeGameDetailRefresh();
      activeHomeGameDetail = null;
      const overlay = document.getElementById('homeGameDetailOverlay');
      if (overlay) overlay.classList.add('hidden');
      document.body.classList.remove('home-game-detail-open');
      if (currentPage === 'home') scheduleHomeDailyGamesAutoRefresh();
    }

    function renderHomeGameDetail(detail, game, { loading = false, error = '' } = {}) {
      const overlay = ensureHomeGameDetailOverlay();
      const body = overlay.querySelector('#homeGameDetailBody');
      if (!body) return;
      const status = String(detail?.status || game?.status || 'scheduled').toLowerCase();
      const currentBatter = String(detail?.current?.batter?.name || '').trim();
      const currentPitcher = String(detail?.current?.pitcher?.name || '').trim();
      const groups = homeGameDetailGroups(detail?.plays || []);
      const gameInfo = detail?.game || game || {};
      const leagueLabel = activeHomeGameDetail?.league === 'CPBL' ? '中華職棒' : '日本職棒';
      const dateLabel = String(activeHomeGameDetail?.date || '').replaceAll('-', '/');
      const matchup = status === 'live' ? `
        <div class="game-detail-current-grid">
          <div class="game-detail-current-card"><span>目前打者</span><strong>${escapeHtml(currentBatter || '等待下一位打者')}</strong></div>
          <div class="game-detail-current-card"><span>目前投手</span><strong>${escapeHtml(currentPitcher || '讀取中')}</strong></div>
        </div>` : '';
      const playsHtml = groups.length ? groups.map(group => `
        <details class="game-detail-inning" open>
          <summary>${group.inning || '—'}局${group.half === 'top' ? '上' : group.half === 'bottom' ? '下' : ''}${group.team ? `｜${escapeHtml(group.team)}` : ''}<span>${group.plays.length} 打席</span></summary>
          <div class="game-detail-pa-list">
            ${group.plays.map(play => `
              <div class="game-detail-pa-row">
                <div class="game-detail-pa-main"><strong>${escapeHtml(String(play?.batter || '未辨識打者'))}</strong><span>${escapeHtml(String(play?.result || '—'))}</span></div>
                <div class="game-detail-pa-meta">${[play?.outs, play?.bases, play?.count].map(v => String(v || '').trim()).filter(Boolean).map(escapeHtml).join('｜')}</div>
              </div>`).join('')}
          </div>
        </details>`).join('') : `<div class="game-detail-empty">${status === 'scheduled' ? '比賽尚未開始，開打後這裡會顯示逐打席。' : loading ? '正在讀取官方逐打席…' : '官方來源目前沒有可顯示的逐打席。'}</div>`;

      body.innerHTML = `
        <header class="game-detail-sticky-head">
          <button id="homeGameDetailBack" class="game-detail-back" type="button">← 返回賽事</button>
          <div class="game-detail-head-copy"><strong>${escapeHtml(leagueLabel)}</strong><span>${escapeHtml(dateLabel)}${gameInfo?.venue ? `｜${escapeHtml(String(gameInfo.venue))}` : ''}</span></div>
          ${status === 'live' ? `<span class="game-detail-live-dot ${loading ? 'is-refreshing' : ''}"><i></i>LIVE</span>` : ''}
        </header>
        <main class="game-detail-content">
          <section class="game-detail-score-card">
            <div class="game-detail-status">${escapeHtml(homeGameDetailStatusLabel(detail || {status,game:gameInfo}))}${loading ? '｜更新中…' : ''}</div>
            <div class="game-detail-score-row">
              <div><span>${escapeHtml(String(gameInfo?.away || game?.away || '客隊'))}</span><strong>${homeGameDetailScore(gameInfo?.awayScore)}</strong></div>
              <b>－</b>
              <div><span>${escapeHtml(String(gameInfo?.home || game?.home || '主隊'))}</span><strong>${homeGameDetailScore(gameInfo?.homeScore)}</strong></div>
            </div>
            ${matchup}
          </section>
          ${error ? `<div class="game-detail-error">${escapeHtml(error)}<button id="homeGameDetailRetry" type="button">重新讀取</button></div>` : ''}
          <section class="game-detail-play-section">
            <div class="game-detail-section-title"><strong>全場逐打席</strong><span>${detail?.plays?.length || 0} 筆</span></div>
            ${playsHtml}
          </section>
        </main>`;
      overlay.classList.remove('hidden');
      document.body.classList.add('home-game-detail-open');
      body.querySelector('#homeGameDetailBack')?.addEventListener('click', closeHomeGameDetail);
      body.querySelector('#homeGameDetailRetry')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));
    }

    function homeGameDetailCacheTtl(detail) {
      const status = String(detail?.status || '').toLowerCase();
      if (status === 'final' || status === 'cancelled') return 12 * 60 * 60 * 1000;
      if (status === 'scheduled') return 5 * 60 * 1000;
      return 45 * 1000;
    }

    function scheduleHomeGameDetailRefresh(detail) {
      stopHomeGameDetailRefresh();
      if (!activeHomeGameDetail || document.visibilityState !== 'visible') return;
      if (String(detail?.status || '').toLowerCase() !== 'live') return;
      if (!homeGameDetailAutoAvailable()) return;
      const delay = activeHomeGameDetail.league === 'NPB' ? 90 * 1000 : 60 * 1000;
      homeGameDetailRefreshTimer = setTimeout(() => {
        homeGameDetailRefreshTimer = 0;
        if (!activeHomeGameDetail || document.visibilityState !== 'visible' || !consumeHomeGameDetailAuto()) return;
        refreshActiveHomeGameDetail({ force:true, automatic:true });
      }, globalThis.navigator?.connection?.saveData ? delay * 2 : delay);
    }

    async function refreshActiveHomeGameDetail({ force = false, automatic = false } = {}) {
      if (!activeHomeGameDetail) return;
      const { league, date, game } = activeHomeGameDetail;
      const key = homeGameDetailKey(league, date, game);
      const cached = homeGameDetailCache.get(key);
      const age = cached ? Date.now() - Number(cached.at || 0) : Infinity;
      if (!force && cached && age < homeGameDetailCacheTtl(cached.detail)) {
        renderHomeGameDetail(cached.detail, game);
        scheduleHomeGameDetailRefresh(cached.detail);
        return;
      }
      if (activeHomeGameDetail.loading) return;
      activeHomeGameDetail.loading = true;
      if (cached?.detail) renderHomeGameDetail(cached.detail, game, { loading:true });
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      try {
        const detail = await leagueGameDetailRequest(league, date, game);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        homeGameDetailCache.set(key, { at:Date.now(), detail });
        if (detail?.game?.id && !game.id) game.id = detail.game.id;
        renderHomeGameDetail(detail, game);
        scheduleHomeGameDetailRefresh(detail);
      } catch (error) {
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        const detail = cached?.detail || { status:game?.status, game, plays:[] };
        renderHomeGameDetail(detail, game, { error:error?.message || '單場逐打席讀取失敗。' });
        if (automatic) {
          stopHomeGameDetailRefresh();
          homeGameDetailRefreshTimer = setTimeout(() => {
            homeGameDetailRefreshTimer = 0;
            if (activeHomeGameDetail && document.visibilityState === 'visible') refreshActiveHomeGameDetail({ force:true, automatic:true });
          }, 5 * 60 * 1000);
        }
      } finally {
        if (activeHomeGameDetail && activeHomeGameDetail.key === key) activeHomeGameDetail.loading = false;
      }
    }

    function openHomeGameDetail(game, league, date) {
      if (!homeGameDetailSupported(league)) return;
      stopHomeDailyGamesAutoRefresh();
      const key = homeGameDetailKey(league, date, game);
      activeHomeGameDetail = { league, date, game, key, loading:false };
      const cached = homeGameDetailCache.get(key);
      if (cached?.detail) renderHomeGameDetail(cached.detail, game);
      else renderHomeGameDetail({ status:game?.status, game, plays:[] }, game, { loading:true });
      refreshActiveHomeGameDetail();
    }

'''
s = s.replace(marker, helpers + marker, 1)

# Visibility behavior: detail gets priority; home scoreboard no longer wakes underneath it.
old = """    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Reuse a still-fresh result instead of forcing another Edge Function invocation on every focus change.
        if (currentPage === 'home') renderHomeDailyGames();
      } else {
        stopHomeDailyGamesAutoRefresh();
      }
    });
"""
new = """    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (activeHomeGameDetail) refreshActiveHomeGameDetail();
        // Reuse a still-fresh result instead of forcing another Edge Function invocation on every focus change.
        else if (currentPage === 'home') renderHomeDailyGames();
      } else {
        stopHomeDailyGamesAutoRefresh();
        stopHomeGameDetailRefresh();
      }
    });
"""
if old not in s:
    raise SystemExit('visibility anchor not found')
s = s.replace(old, new, 1)

# Card map gets index and CPBL/NPB cards become keyboard/click targets.
s = s.replace("games.map(game => {", "games.map((game, gameIndex) => {", 1)
old = """            <article class=\"home-game-card status-${escapeAttr(status)}\">\n"""
new = """            <article class=\"home-game-card status-${escapeAttr(status)} ${homeGameDetailSupported(league) ? 'is-detail-enabled' : ''}\" ${homeGameDetailSupported(league) ? `data-game-detail-index=\"${gameIndex}\" role=\"button\" tabindex=\"0\" aria-label=\"查看 ${escapeAttr(String(game?.away || ''))} 對 ${escapeAttr(String(game?.home || ''))} 全場逐打席\"` : ''}>\n"""
if old not in s:
    raise SystemExit('game card article anchor not found')
s = s.replace(old, new, 1)

# Bind click + keyboard after the existing retry binding.
anchor = """      host.querySelector('.home-games-retry')?.addEventListener('click', () => {
        homeDailyGamesCache.delete(key);
        renderHomeDailyGames({ force:true });
      });
"""
insert = """      host.querySelector('.home-games-retry')?.addEventListener('click', () => {
        homeDailyGamesCache.delete(key);
        renderHomeDailyGames({ force:true });
      });
      if (homeGameDetailSupported(league)) {
        host.querySelectorAll('[data-game-detail-index]').forEach(card => {
          const open = () => {
            const index = Number(card.dataset.gameDetailIndex);
            const game = games[index];
            if (game) openHomeGameDetail(game, league, date);
          };
          card.addEventListener('click', open);
          card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          });
        });
      }
"""
if anchor not in s:
    raise SystemExit('retry binding anchor not found')
s = s.replace(anchor, insert, 1)

p.write_text(s, encoding='utf-8')

# Styles
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.26 CPBL / NPB full-game play-by-play */
.home-game-card.is-detail-enabled{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
.home-game-card.is-detail-enabled:hover,.home-game-card.is-detail-enabled:focus-visible{transform:translateY(-1px);border-color:#b58a35;box-shadow:0 5px 14px rgba(23,44,70,.12);outline:none}
body.home-game-detail-open{overflow:hidden}
.home-game-detail-overlay{position:fixed;inset:0;z-index:12000;background:#eef2f6;overflow:auto;-webkit-overflow-scrolling:touch}
.home-game-detail-overlay.hidden{display:none}
.home-game-detail-page{min-height:100%;max-width:900px;margin:0 auto;background:#f7f9fb;box-shadow:0 0 40px rgba(22,43,68,.15)}
.game-detail-sticky-head{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;min-height:62px;padding:10px 14px;background:rgba(247,249,251,.96);backdrop-filter:blur(14px);border-bottom:1px solid #d8e0e9}
.game-detail-back{appearance:none;border:1px solid #c8d3df;border-radius:10px;background:#fff;padding:9px 11px;font-weight:800;color:#24435f;cursor:pointer}
.game-detail-head-copy{display:flex;flex-direction:column;gap:2px;min-width:0}.game-detail-head-copy strong{font-size:16px;color:#183b5c}.game-detail-head-copy span{font-size:12px;color:#6f7d8b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.game-detail-live-dot{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:900;color:#a43d2f}.game-detail-live-dot i{width:8px;height:8px;border-radius:50%;background:#cf4c39;box-shadow:0 0 0 0 rgba(207,76,57,.45);animation:gameDetailLivePulse 1.5s infinite}.game-detail-live-dot.is-refreshing i{animation-duration:.65s}
@keyframes gameDetailLivePulse{0%{box-shadow:0 0 0 0 rgba(207,76,57,.45)}70%{box-shadow:0 0 0 7px rgba(207,76,57,0)}100%{box-shadow:0 0 0 0 rgba(207,76,57,0)}}
.game-detail-content{padding:14px 14px 36px}.game-detail-score-card{border:1px solid #cdd8e3;border-radius:16px;background:#fff;padding:14px;box-shadow:0 4px 15px rgba(21,47,72,.07)}
.game-detail-status{text-align:center;font-size:12px;font-weight:900;color:#7a6840;margin-bottom:9px}.game-detail-score-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}.game-detail-score-row>div{display:flex;align-items:center;justify-content:center;gap:10px;min-width:0}.game-detail-score-row span{font-weight:900;color:#263d52;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.game-detail-score-row strong{font-size:34px;color:#183b5c}.game-detail-score-row>b{font-size:22px;color:#8d99a5}
.game-detail-current-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid #e3e8ee}.game-detail-current-card{min-width:0;border-radius:12px;background:#eef3f7;padding:10px 12px;display:flex;flex-direction:column;gap:3px}.game-detail-current-card span{font-size:11px;font-weight:800;color:#778594}.game-detail-current-card strong{font-size:17px;color:#173a5a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.game-detail-error{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;border:1px solid #efc2bb;border-radius:11px;background:#fff5f3;padding:10px 12px;color:#9a3c31;font-size:13px}.game-detail-error button{border:0;border-radius:8px;padding:7px 10px;background:#a7473a;color:#fff;font-weight:800}
.game-detail-play-section{margin-top:15px}.game-detail-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 2px}.game-detail-section-title strong{font-size:17px;color:#173a5a}.game-detail-section-title span{font-size:12px;color:#7a8793}
.game-detail-inning{border:1px solid #d3dde6;border-radius:12px;background:#fff;margin-bottom:9px;overflow:hidden}.game-detail-inning summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;font-weight:900;color:#24435f;background:#f4f7fa}.game-detail-inning summary::-webkit-details-marker{display:none}.game-detail-inning summary span{font-size:11px;color:#7b8792;font-weight:800}.game-detail-pa-list{padding:0 12px}.game-detail-pa-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 0;border-top:1px solid #edf0f3}.game-detail-pa-main{min-width:0;display:flex;align-items:center;gap:9px}.game-detail-pa-main strong{min-width:74px;color:#1f3d58}.game-detail-pa-main span{color:#394f62;overflow:hidden;text-overflow:ellipsis}.game-detail-pa-meta{font-size:11px;color:#86929d;text-align:right;white-space:nowrap}.game-detail-empty{border:1px dashed #cad4de;border-radius:12px;background:#fff;padding:28px 14px;text-align:center;color:#7a8792;font-size:13px}
@media(max-width:720px){.game-detail-sticky-head{grid-template-columns:auto 1fr auto;gap:8px;min-height:56px;padding:8px 10px}.game-detail-back{padding:8px 9px;font-size:12px}.game-detail-content{padding:10px 10px 28px}.game-detail-score-card{padding:12px}.game-detail-score-row{gap:6px}.game-detail-score-row span{font-size:13px}.game-detail-score-row strong{font-size:30px}.game-detail-current-grid{grid-template-columns:1fr 1fr;gap:7px}.game-detail-current-card{padding:9px}.game-detail-current-card strong{font-size:15px}.game-detail-pa-row{grid-template-columns:1fr}.game-detail-pa-meta{text-align:left;padding-left:83px;margin-top:-4px}.game-detail-pa-main strong{min-width:74px}}
'''
if '/* v2.26 CPBL / NPB full-game play-by-play */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# Versioned page/archive/cache
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8').replace('v2.25', 'v2.26')
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.26.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.24.html'
if old_archive.exists(): old_archive.unlink()

p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
s = s.replace('baseball-player-card-pwa-v142', 'baseball-player-card-pwa-v143')
s = s.replace('v2.25', 'v2.26')
p.write_text(s, encoding='utf-8')

subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.26 CPBL/NPB game detail patch applied')
