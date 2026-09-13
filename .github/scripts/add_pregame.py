from pathlib import Path
import re

p = Path('js/11-home-international.js')
s = p.read_text(encoding='utf-8')

anchor = "    function homeGameDetailStatusLabel(detail) {\n"
insert = r'''    async function pregameStarterRequest(league, date, game) {
      const endpoint = new URL(LEAGUE_GAME_DETAIL_API_URL);
      endpoint.pathname = endpoint.pathname.replace(/\/[^/]+$/, '/pregame-starters');
      const response = await fetch(endpoint.toString(), {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({
          appKey:CPBL_APP_KEY,
          action:'pregame-starters',
          league,
          date,
          gameId:String(game?.id || ''),
          away:String(game?.away || ''),
          home:String(game?.home || '')
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `先發投手資料讀取失敗（${response.status}）`);
      return data;
    }

    function homeGameDetailStatusLabel(detail) {
'''
if anchor not in s:
    raise SystemExit('status label anchor not found')
s = s.replace(anchor, insert, 1)

anchor = "    function renderHomeGameDetail(detail, game, { loading = false, error = '' } = {}) {\n"
helpers = r'''    function homeStarterStatItems(starter) {
      const stats = starter?.stats || {};
      const out = [];
      const win = String(stats.wins ?? '').trim();
      const loss = String(stats.losses ?? '').trim();
      if (win || loss) out.push(['勝敗', `${win || 0}-${loss || 0}`]);
      if (String(stats.era ?? '').trim()) out.push(['ERA', String(stats.era)]);
      if (String(stats.ip ?? '').trim()) out.push(['IP', String(stats.ip)]);
      if (String(stats.so ?? '').trim()) out.push(['SO', String(stats.so)]);
      if (String(stats.whip ?? '').trim()) out.push(['WHIP', String(stats.whip)]);
      if (String(stats.starts ?? '').trim()) out.push(['GS', String(stats.starts)]);
      else if (String(stats.games ?? '').trim()) out.push(['G', String(stats.games)]);
      return out.slice(0, 6);
    }

    function homeStarterCard(starter, teamName, sideLabel) {
      if (!starter) {
        return `<article class="game-detail-starter-card is-empty"><div class="game-detail-starter-team">${escapeHtml(teamName || sideLabel)}</div><div class="game-detail-starter-empty">先發投手尚未公布</div></article>`;
      }
      const statItems = homeStarterStatItems(starter);
      const meta = [
        starter?.number ? `#${starter.number}` : '',
        starter?.throws || '',
        starter?.stats?.year ? `${starter.stats.year} 球季` : ''
      ].filter(Boolean).join('｜');
      return `<article class="game-detail-starter-card">
        <div class="game-detail-starter-team">${escapeHtml(teamName || starter?.team || sideLabel)}</div>
        <div class="game-detail-starter-name">${escapeHtml(String(starter?.fullName || starter?.name || '—'))}</div>
        <div class="game-detail-starter-meta">${escapeHtml(meta || '預告先發')}</div>
        ${statItems.length ? `<div class="game-detail-starter-stats">${statItems.map(([label,value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : '<div class="game-detail-starter-no-stats">目前沒有可用的本季投球數據</div>'}
      </article>`;
    }

    function renderHomeGameDetail(detail, game, { loading = false, error = '' } = {}) {
'''
if anchor not in s:
    raise SystemExit('render anchor not found')
s = s.replace(anchor, helpers, 1)

anchor = "      const matchup = status === 'live' ? `\n"
starter_block = r'''      const pregame = detail?.pregame || null;
      const starterSection = status === 'scheduled' ? `
        <section class="game-detail-pregame-section">
          <div class="game-detail-section-title game-detail-pregame-title">
            <div><strong>預告先發</strong><span>${escapeHtml(String(pregame?.source || (activeHomeGameDetail?.league === 'NPB' ? 'NPB 官方' : 'CPBL 官方')))}</span></div>
            <button id="homeGameDetailPregameRefresh" class="game-detail-pregame-refresh" type="button" ${loading ? 'disabled' : ''}>重新整理</button>
          </div>
          ${pregame?.error ? `<div class="game-detail-pregame-note error">${escapeHtml(String(pregame.error))}</div>` : ''}
          <div class="game-detail-starter-grid">
            ${homeStarterCard(pregame?.awayStarter || null, String(gameInfo?.away || game?.away || '客隊'), '客隊')}
            ${homeStarterCard(pregame?.homeStarter || null, String(gameInfo?.home || game?.home || '主隊'), '主隊')}
          </div>
          ${!pregame?.awayStarter && !pregame?.homeStarter ? '<div class="game-detail-pregame-note">聯盟公布預告先發後，重新整理就會自動帶入本季投球資料。</div>' : ''}
        </section>` : '';
      const matchup = status === 'live' ? `
'''
if anchor not in s:
    raise SystemExit('matchup anchor not found')
s = s.replace(anchor, starter_block, 1)

anchor = "          ${error ? `<div class=\"game-detail-error\">${escapeHtml(error)}<button id=\"homeGameDetailRetry\" type=\"button\">重新讀取</button></div>` : ''}\n          <section class=\"game-detail-play-section\">\n"
replacement = "          ${error ? `<div class=\"game-detail-error\">${escapeHtml(error)}<button id=\"homeGameDetailRetry\" type=\"button\">重新讀取</button></div>` : ''}\n          ${starterSection}\n          <section class=\"game-detail-play-section\">\n"
if anchor not in s:
    raise SystemExit('starter insertion anchor not found')
s = s.replace(anchor, replacement, 1)

anchor = "      body.querySelector('#homeGameDetailRetry')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));\n"
if anchor not in s:
    raise SystemExit('retry listener anchor not found')
s = s.replace(anchor, anchor + "      body.querySelector('#homeGameDetailPregameRefresh')?.addEventListener('click', () => refreshActiveHomeGameDetail({ force:true }));\n", 1)

s = s.replace("      if (status === 'scheduled') return 5 * 60 * 1000;\n", "      if (status === 'scheduled') return 2 * 60 * 1000;\n", 1)

anchor = "        const detail = await leagueGameDetailRequest(league, date, game);\n        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;\n"
replacement = r'''        const detail = await leagueGameDetailRequest(league, date, game);
        if (!activeHomeGameDetail || activeHomeGameDetail.key !== key) return;
        if (String(detail?.status || '').toLowerCase() === 'scheduled' && (league === 'CPBL' || league === 'NPB')) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
          }
        }
'''
if anchor not in s:
    raise SystemExit('detail fetch anchor not found')
s = s.replace(anchor, replacement, 1)
p.write_text(s, encoding='utf-8')

css = Path('game-detail-enhancement.css')
c = css.read_text(encoding='utf-8')
marker = '/* ===== PREGAME STARTER CARDS ===== */'
if marker not in c:
    c += r'''

/* ===== PREGAME STARTER CARDS ===== */
.game-detail-pregame-section{margin-top:16px;}
.game-detail-pregame-title{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.game-detail-pregame-title>div{display:flex;align-items:baseline;gap:8px;min-width:0;}
.game-detail-pregame-title span{color:#7a8898;font-size:12px;font-weight:700;white-space:nowrap;}
.game-detail-pregame-refresh{border:1px solid #d4dee8;border-radius:999px;background:#fff;color:#28547f;padding:6px 11px;font-size:12px;font-weight:800;cursor:pointer;}
.game-detail-pregame-refresh:disabled{opacity:.55;cursor:default;}
.game-detail-starter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px;}
.game-detail-starter-card{min-width:0;padding:16px;border:1px solid #dce5ee;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fbfe);box-shadow:0 8px 22px rgba(28,53,87,.05);}
.game-detail-starter-card.is-empty{display:flex;min-height:154px;flex-direction:column;justify-content:center;align-items:center;text-align:center;}
.game-detail-starter-team{color:#60758a;font-size:12px;font-weight:900;letter-spacing:.02em;}
.game-detail-starter-name{margin-top:4px;color:#133f69;font-size:22px;font-weight:900;line-height:1.25;}
.game-detail-starter-meta{margin-top:5px;color:#8190a0;font-size:12px;font-weight:700;}
.game-detail-starter-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:14px;}
.game-detail-starter-stats>div{min-width:0;padding:8px 5px;border:1px solid #e2e9f0;border-radius:10px;background:#fff;text-align:center;}
.game-detail-starter-stats span{display:block;color:#8290a0;font-size:10px;font-weight:800;}
.game-detail-starter-stats strong{display:block;margin-top:2px;color:#153e65;font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.game-detail-starter-empty{margin-top:6px;color:#8593a2;font-size:15px;font-weight:800;}
.game-detail-starter-no-stats{margin-top:14px;color:#8996a5;font-size:12px;font-weight:700;}
.game-detail-pregame-note{margin-top:9px;color:#8290a0;font-size:12px;line-height:1.5;text-align:center;}
.game-detail-pregame-note.error{color:#b44b4b;}
@media(max-width:640px){
  .game-detail-starter-grid{grid-template-columns:1fr;gap:9px;}
  .game-detail-starter-card{padding:14px;}
  .game-detail-starter-name{font-size:20px;}
  .game-detail-starter-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}
  .game-detail-pregame-title>div{display:block;}
  .game-detail-pregame-title span{display:block;margin-top:2px;}
}
/* ===== PREGAME STARTER CARDS END ===== */
'''
css.write_text(c, encoding='utf-8')

index = Path('index.html')
h = index.read_text(encoding='utf-8')
h = re.sub(r'./styles\.css\?v=[^"\']+', './styles.css?v=v2.40-ui5', h)
h = re.sub(r'./app\.js\?v=[^"\']+', './app.js?v=v2.40-ui5', h)
h = re.sub(r'./game-detail-enhancement\.css\?v=[^"\']+', './game-detail-enhancement.css?v=v2.40-ui5', h)
h = re.sub(r'./game-detail-enhancement\.js\?v=[^"\']+', './game-detail-enhancement.js?v=v2.40-ui5', h)
index.write_text(h, encoding='utf-8')

sw = Path('service-worker.js')
w = sw.read_text(encoding='utf-8')
w = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'baseball-player-card-pwa-v240-stable-9';", w, count=1)
w = re.sub(r"'./styles\.css\?v=[^']+'", "'./styles.css?v=v2.40-ui5'", w)
w = re.sub(r"'./app\.js\?v=[^']+'", "'./app.js?v=v2.40-ui5'", w)
w = re.sub(r"'./game-detail-enhancement\.css\?v=[^']+'", "'./game-detail-enhancement.css?v=v2.40-ui5'", w)
w = re.sub(r"'./game-detail-enhancement\.js\?v=[^']+'", "'./game-detail-enhancement.js?v=v2.40-ui5'", w)
sw.write_text(w, encoding='utf-8')
