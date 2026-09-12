from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

# ---- version + API + DOM refs ----
p = ROOT / 'js' / '00-core-config.js'
s = p.read_text(encoding='utf-8')
if "const APP_VERSION = 'v2.17';" not in s:
    raise SystemExit('expected v2.17 APP_VERSION')
s = s.replace("const APP_VERSION = 'v2.17';", "const APP_VERSION = 'v2.18';", 1)
s = s.replace("const BASEBALL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/baseball-client';",
              "const BASEBALL_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/baseball-client';\n    const LEAGUE_GAMES_API_URL = 'https://kjndnsztbcpmkhictjkr.supabase.co/functions/v1/league-daily-games';", 1)
s = s.replace('?v=v2.17', '?v=v2.18')
anchor = "      homeZoneNote: document.getElementById('homeZoneNote'),\n"
if s.count(anchor) != 1:
    raise SystemExit('homeZoneNote DOM ref anchor not found')
s = s.replace(anchor, anchor + "      homeDailyGames: document.getElementById('homeDailyGames'),\n", 1)
p.write_text(s, encoding='utf-8')

# ---- homepage scoreboard markup ----
p = ROOT / 'index.html'
s = p.read_text(encoding='utf-8')
s = s.replace('v2.17', 'v2.18')
anchor = '          <div id="homeZoneNote" class="home-zone-note hidden"></div>\n'
if s.count(anchor) != 1:
    raise SystemExit('homeZoneNote markup anchor not found')
s = s.replace(anchor, anchor + '          <div id="homeDailyGames" class="home-daily-games" aria-live="polite"></div>\n', 1)
p.write_text(s, encoding='utf-8')
(ROOT / 'index v2.18.html').write_text(s, encoding='utf-8')
old_archive = ROOT / 'index v2.16.html'
if old_archive.exists():
    old_archive.unlink()

# ---- homepage daily games behavior ----
p = ROOT / 'js' / '11-home-international.js'
s = p.read_text(encoding='utf-8')
anchor = '''    function renderRecentPlayers() {\n'''
if s.count(anchor) != 1:
    raise SystemExit('renderRecentPlayers anchor not found')
insert = r'''    const homeDailyGamesCache = new Map();
    const homeDailyGamesLoading = new Set();
    const HOME_DAILY_GAMES_TTL = 60 * 1000;

    function homeDailyGamesLeague() {
      if (homeRootSection === 'international') return '';
      if (homeProCountry === 'TW') return 'CPBL';
      if (homeProCountry === 'JP') return 'NPB';
      if (homeProCountry === 'KR') return 'KBO';
      if (homeProCountry === 'US') return 'MLB';
      return '';
    }

    function homeDailyGamesLeagueLabel(league) {
      return ({ CPBL:'中華職棒', NPB:'日本職棒', KBO:'韓國職棒', MLB:'MLB' })[league] || league;
    }

    function homeDailyGameStatusLabel(game) {
      const status = String(game?.status || '').toLowerCase();
      if (status === 'final') return '已結束';
      if (status === 'live') return '比賽中';
      if (status === 'cancelled') return '取消／延期';
      return String(game?.time || '').trim() || '未開打';
    }

    function homeDailyGameScore(value) {
      if (value === null || value === undefined || value === '') return '—';
      const number = Number(value);
      return Number.isFinite(number) ? String(number) : '—';
    }

    async function leagueDailyGamesRequest(league, date) {
      const response = await fetch(LEAGUE_GAMES_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'daily-games',
          league,
          date
        })
      });
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text || '{}'); } catch {}
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || `當日賽事讀取失敗（${response.status}）`);
      }
      return Array.isArray(data.games) ? data.games : [];
    }

    async function loadHomeDailyGames(league, date, { force = false } = {}) {
      const key = `${league}|${date}`;
      const now = Date.now();
      const cached = homeDailyGamesCache.get(key);
      if (!force && cached && now - Number(cached.at || 0) < HOME_DAILY_GAMES_TTL) return cached.games || [];
      if (homeDailyGamesLoading.has(key)) return null;

      homeDailyGamesLoading.add(key);
      try {
        const games = await leagueDailyGamesRequest(league, date);
        homeDailyGamesCache.set(key, { at:Date.now(), games, error:'' });
        return games;
      } catch (error) {
        homeDailyGamesCache.set(key, {
          at:Date.now(),
          games:Array.isArray(cached?.games) ? cached.games : [],
          error:error?.message || '當日賽事讀取失敗。'
        });
        return null;
      } finally {
        homeDailyGamesLoading.delete(key);
        if (currentPage === 'home' && homeDailyGamesLeague() === league && String(els.gameDate?.value || '') === date) {
          renderHomeDailyGames({ skipLoad:true });
        }
      }
    }

    function renderHomeDailyGames({ force = false, skipLoad = false } = {}) {
      const host = els.homeDailyGames;
      if (!host) return;

      const league = homeDailyGamesLeague();
      const date = String(els.gameDate?.value || localISODate());
      if (!league || homeRootSection === 'international') {
        host.classList.add('hidden');
        host.innerHTML = '';
        return;
      }
      host.classList.remove('hidden');

      const key = `${league}|${date}`;
      const cached = homeDailyGamesCache.get(key) || null;
      const loading = homeDailyGamesLoading.has(key);
      const fresh = cached && Date.now() - Number(cached.at || 0) < HOME_DAILY_GAMES_TTL;
      const games = Array.isArray(cached?.games) ? cached.games : [];
      const error = String(cached?.error || '');
      const leagueLabel = homeDailyGamesLeagueLabel(league);
      const dateLabel = date.replaceAll('-', '/');

      let bodyHtml = '';
      if (!cached && !loading) {
        bodyHtml = '<div class="home-games-state">正在讀取官方賽程…</div>';
      } else if (loading && !games.length) {
        bodyHtml = '<div class="home-games-state"><span class="home-games-loading-dot"></span>正在讀取官方賽程…</div>';
      } else if (error && !games.length) {
        bodyHtml = `<div class="home-games-state error"><span>${escapeHtml(error)}</span><button class="press-btn home-games-retry" type="button">重新整理</button></div>`;
      } else if (!games.length) {
        bodyHtml = `<div class="home-games-state">這個日期沒有找到 ${escapeHtml(leagueLabel)} 比賽。</div>`;
      } else {
        bodyHtml = `<div class="home-games-scroller ${league === 'MLB' ? 'is-mlb' : ''}">${games.map(game => {
          const status = String(game?.status || 'scheduled').toLowerCase();
          const statusLabel = homeDailyGameStatusLabel(game);
          const awayScore = homeDailyGameScore(game?.awayScore);
          const homeScore = homeDailyGameScore(game?.homeScore);
          const venue = String(game?.venue || '').trim();
          return `
            <article class="home-game-card status-${escapeAttr(status)}">
              <div class="home-game-card-top">
                <span class="home-game-status status-${escapeAttr(status)}">${escapeHtml(statusLabel)}</span>
                ${game?.time && ['final','live'].includes(status) ? `<span class="home-game-time">${escapeHtml(String(game.time))}</span>` : ''}
              </div>
              <div class="home-game-team">
                <span class="home-game-team-name">${escapeHtml(String(game?.away || '客隊'))}</span>
                <strong class="home-game-score">${escapeHtml(awayScore)}</strong>
              </div>
              <div class="home-game-team">
                <span class="home-game-team-name">${escapeHtml(String(game?.home || '主隊'))}</span>
                <strong class="home-game-score">${escapeHtml(homeScore)}</strong>
              </div>
              <div class="home-game-venue">${escapeHtml(venue || '場地未提供')}</div>
            </article>`;
        }).join('')}</div>`;
      }

      host.innerHTML = `
        <section class="home-daily-games-shell">
          <div class="home-daily-games-head">
            <div class="home-daily-games-title">
              <strong>當日賽事</strong>
              <span>${escapeHtml(leagueLabel)}</span>
            </div>
            <div class="home-daily-games-meta">
              <span>${escapeHtml(dateLabel)}</span>
              ${games.length ? `<span>${games.length} 場</span>` : ''}
              ${loading && games.length ? '<span>更新中…</span>' : ''}
            </div>
          </div>
          ${bodyHtml}
        </section>`;

      host.querySelector('.home-games-retry')?.addEventListener('click', () => {
        homeDailyGamesCache.delete(key);
        renderHomeDailyGames({ force:true });
      });

      if (!skipLoad && (force || !cached || !fresh) && !loading) {
        void loadHomeDailyGames(league, date, { force }).then(() => {});
      }
    }

'''
s = s.replace(anchor, insert + anchor, 1)

# Show/hide and render along with homepage player list.
anchor = "      const cpbl = !international && homeProCountry === 'TW';\n"
if s.count(anchor) != 1:
    raise SystemExit('home filter visibility anchor not found')
s = s.replace(anchor, anchor + "      els.homeDailyGames?.classList.toggle('hidden', international);\n", 1)
anchor = "      renderHomePlayerFilters();\n      els.homePage?.classList.toggle('international-home-mode', homeRootSection === 'international');\n"
if s.count(anchor) != 1:
    raise SystemExit('renderRecentPlayers body anchor not found')
s = s.replace(anchor, anchor + "      renderHomeDailyGames();\n", 1)
p.write_text(s, encoding='utf-8')

# ---- refresh scoreboard on date change ----
p = ROOT / 'js' / '19-forms-events.js'
s = p.read_text(encoding='utf-8')
anchor = "    els.gameDateButton?.addEventListener('click', openDatePicker);\n"
if s.count(anchor) != 1:
    raise SystemExit('gameDateButton listener anchor not found')
insert = "    els.gameDate?.addEventListener('change', () => {\n      if (currentPage === 'home' && homeRootSection !== 'international') renderHomeDailyGames({ force:true });\n    });\n"
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s, encoding='utf-8')

# ---- style ----
p = ROOT / 'styles.css'
s = p.read_text(encoding='utf-8')
css = r'''

/* v2.18 homepage daily league games */
.home-daily-games{margin:18px 0 20px;min-width:0}
.home-daily-games.hidden{display:none}
.home-daily-games-shell{border:1px solid #d8e3ef;background:linear-gradient(180deg,#f9fbfe 0%,#f2f6fb 100%);border-radius:20px;padding:15px 16px 13px;box-shadow:0 8px 24px rgba(31,78,121,.055)}
.home-daily-games-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
.home-daily-games-title{display:flex;align-items:baseline;gap:9px;min-width:0}
.home-daily-games-title strong{font-size:20px;line-height:1.2;color:#153a5f;letter-spacing:.01em}
.home-daily-games-title span{font-size:13px;font-weight:800;color:#7a8999;white-space:nowrap}
.home-daily-games-meta{display:flex;align-items:center;justify-content:flex-end;gap:9px;font-size:12px;font-weight:750;color:#6d7d8e;white-space:nowrap}
.home-games-scroller{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(210px,250px);gap:11px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;padding:2px 2px 8px;scrollbar-width:thin;scrollbar-color:#b7c9dc transparent}
.home-games-scroller.is-mlb{grid-auto-columns:minmax(205px,235px)}
.home-game-card{scroll-snap-align:start;box-sizing:border-box;min-height:142px;border:1px solid #d7e1eb;background:#fff;border-radius:16px;padding:12px 13px 10px;box-shadow:0 5px 16px rgba(17,50,82,.06)}
.home-game-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px;margin-bottom:6px}
.home-game-status{display:inline-flex;align-items:center;min-height:24px;padding:0 9px;border-radius:999px;background:#edf3f8;color:#56697d;font-size:11px;font-weight:850;white-space:nowrap}
.home-game-status.status-final{background:#eef1f4;color:#53606c}
.home-game-status.status-live{background:#fff1d5;color:#945f00}
.home-game-status.status-cancelled{background:#f7e9e9;color:#965454}
.home-game-time{font-size:11px;font-weight:700;color:#8a97a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.home-game-team{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:5px 0}
.home-game-team-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#173b60;font-size:14px;font-weight:850}
.home-game-score{min-width:28px;text-align:right;color:#112f4d;font:900 23px/1 Arial,sans-serif}
.home-game-card.status-scheduled .home-game-score,.home-game-card.status-cancelled .home-game-score{color:#9aa7b4}
.home-game-venue{margin-top:5px;padding-top:8px;border-top:1px solid #edf1f5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7b8997;font-size:11px;font-weight:650}
.home-games-state{min-height:84px;border:1px dashed #cbd9e7;border-radius:14px;background:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center;gap:10px;padding:18px;text-align:center;color:#718194;font-size:13px;font-weight:700}
.home-games-state.error{color:#8a5151}
.home-games-retry{padding:7px 11px!important;min-height:34px!important;font-size:12px!important}
.home-games-loading-dot{width:8px;height:8px;border-radius:999px;background:#d7ad52;box-shadow:0 0 0 0 rgba(215,173,82,.38);animation:homeGamesPulse 1.35s infinite}
@keyframes homeGamesPulse{0%{box-shadow:0 0 0 0 rgba(215,173,82,.35)}70%{box-shadow:0 0 0 7px rgba(215,173,82,0)}100%{box-shadow:0 0 0 0 rgba(215,173,82,0)}}
@media(max-width:720px){
  .home-daily-games{margin:14px 0 17px}
  .home-daily-games-shell{padding:13px 12px 11px;border-radius:17px}
  .home-daily-games-head{align-items:flex-start;margin-bottom:10px}
  .home-daily-games-title{display:grid;gap:2px}
  .home-daily-games-title strong{font-size:18px}
  .home-daily-games-meta{flex-wrap:wrap;gap:5px 8px}
  .home-games-scroller,.home-games-scroller.is-mlb{grid-auto-columns:minmax(190px,79vw);gap:9px}
  .home-game-card{min-height:138px}
}
'''
if '/* v2.18 homepage daily league games */' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# ---- service worker ----
p = ROOT / 'service-worker.js'
s = p.read_text(encoding='utf-8')
if "baseball-player-card-pwa-v134" not in s:
    raise SystemExit('expected service worker v134 cache')
s = s.replace('baseball-player-card-pwa-v134', 'baseball-player-card-pwa-v135', 1)
s = s.replace('v2.17', 'v2.18')
p.write_text(s, encoding='utf-8')

# Rebuild deterministic concatenated bundle.
subprocess.run(['python3', 'scripts/build-app.py'], cwd=ROOT, check=True)
print('v2.18 homepage daily games patch applied')
