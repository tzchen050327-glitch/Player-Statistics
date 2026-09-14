from pathlib import Path
import json
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

# --- postseason-history.js ---
path = 'postseason-history.js'
s = read(path)

# Series summary should explicitly say 未出賽 instead of disappearing.
s = s.replace(
"""  function statGrid(title, stats, type) {\n    if (!stats) return '';\n""",
"""  function statGrid(title, stats, type) {\n    if (!stats) return `<section class=\"postseason-summary-card postseason-summary-empty\"><div class=\"postseason-summary-title\">${esc(title)}</div><div class=\"postseason-summary-none\">未出賽</div></section>`;\n"""
)

# Add per-game running series score helper before renderCompetition.
needle = """  function renderCompetition(data, key) {"""
helper = r'''  function seriesProgress(games, comp, league) {
    const ordered = (Array.isArray(games) ? games : []).slice().sort((a,b) =>
      String(a?.date || '').localeCompare(String(b?.date || '')) || String(a?.id || '').localeCompare(String(b?.id || ''))
    );
    if (!ordered.length) return [];
    const first = ordered[0];
    const teamA = String(first?.away || '客隊');
    const teamB = String(first?.home || '主隊');
    const wins = new Map([[teamA,0],[teamB,0]]);
    let draws = 0;

    // NPB CS Final Stage gives the regular-season champion (the home club) a one-win advantage.
    if (String(league || '').toUpperCase() === 'NPB' && comp?.key === 'climax_final' && teamB) {
      wins.set(teamB, 1);
    }

    return ordered.map(game => {
      const away = String(game?.away || '客隊');
      const home = String(game?.home || '主隊');
      if (!wins.has(away)) wins.set(away,0);
      if (!wins.has(home)) wins.set(home,0);
      const awayScore = Number(game?.awayScore);
      const homeScore = Number(game?.homeScore);
      const hasScore = Number.isFinite(awayScore) && Number.isFinite(homeScore);
      if (hasScore) {
        if (awayScore > homeScore) wins.set(away, (wins.get(away) || 0) + 1);
        else if (homeScore > awayScore) wins.set(home, (wins.get(home) || 0) + 1);
        else draws += 1;
      }
      const aWins = wins.get(teamA) || 0;
      const bWins = wins.get(teamB) || 0;
      return {
        game,
        seriesText: hasScore ? `${teamA} ${aWins}–${bWins} ${teamB}${draws ? `（${draws}和）` : ''}` : '大比分 —'
      };
    });
  }

  function renderStageCard(comp, data, stageIndex) {
    const games = relevantGames(comp);
    const progress = seriesProgress(games, comp, data?.league);
    return `
      <section class="postseason-stage-card" data-stage-key="${esc(comp.key || '')}">
        <div class="postseason-stage-title-row">
          <div><span class="postseason-stage-kicker">SERIES</span><h3>${esc(comp.label || '')}</h3></div>
          <span class="postseason-stage-count">${games.length} 場</span>
        </div>
        <div class="postseason-stage-summary">
          ${statGrid('系列打擊成績', comp.batting, 'batting')}
          ${statGrid('系列投球成績', comp.pitching, 'pitching')}
        </div>
        <div class="postseason-game-list postseason-game-list-compact">${progress.map(({game:g,seriesText},index)=>`
          <button type="button" class="postseason-game-row postseason-game-row-compact" data-postseason-stage-index="${stageIndex}" data-postseason-game="${index}" ${g?.id?'':'disabled'}>
            <div class="postseason-game-topline">
              <span class="postseason-game-date">${esc(String(g.date||'').replaceAll('-','/'))}</span>
              <span class="postseason-game-open">查看單場 ›</span>
            </div>
            <div class="postseason-game-matchup"><span>${esc(g.away||'客隊')}</span><b>${esc(scoreCell(g.awayScore))} - ${esc(scoreCell(g.homeScore))}</b><span>${esc(g.home||'主隊')}</span></div>
            <div class="postseason-series-score">大比分 ${esc(seriesText)}</div>
            <div class="postseason-game-player ${gamePlayerLine(g)==='未出賽'?'is-dnp':''}">${esc(gamePlayerLine(g))}</div>
          </button>`).join('')}</div>
      </section>`;
  }

'''
if helper.strip() not in s:
    if needle not in s:
        raise SystemExit('renderCompetition anchor not found')
    s = s.replace(needle, helper + needle, 1)

# Replace the old one-stage-at-a-time renderer with parallel stage cards.
pattern = re.compile(r"  function renderCompetition\(data, key\) \{[\s\S]*?\n  \}\n\n  async function loadAndRender", re.M)
replacement = r'''  function renderCompetition(data, key) {
    const target = host();
    if (!target) return;
    const competitions = (Array.isArray(data?.competitions) ? data.competitions : []).filter(c => c?.playerAppeared);
    if (!competitions.length) {
      target.innerHTML = `<div class="postseason-empty"><strong>${esc(data?.year || '')} 沒有找到這位球員的季後賽出賽紀錄</strong><span>若球員當年沒有實際出賽，這個年份不會保留在季後賽年份選單。</span></div>`;
      return;
    }

    selectedCompetition = '';
    const stageGames = competitions.map(comp => relevantGames(comp));
    target.innerHTML = `
      <div class="postseason-history postseason-history-parallel">
        <div class="postseason-head">
          <div><span class="postseason-kicker">POSTSEASON HISTORY</span><h2>${esc(data.year)} 季後賽</h2></div>
          <div class="postseason-source">${esc(data.league)} 官方資料</div>
        </div>
        <div class="postseason-stage-grid" style="--postseason-stage-count:${competitions.length}">
          ${competitions.map((comp,index)=>renderStageCard(comp,data,index)).join('')}
        </div>
      </div>`;

    target.querySelectorAll('[data-postseason-game]').forEach(button => {
      button.addEventListener('click', () => {
        const stageIndex = Number(button.dataset.postseasonStageIndex);
        const gameIndex = Number(button.dataset.postseasonGame);
        const game = stageGames[stageIndex]?.[gameIndex];
        if (!game?.id) return;
        window.dispatchEvent(new CustomEvent('postseason-open-game', { detail:{ game, league:data.league, date:game.date } }));
      });
    });
  }

  async function loadAndRender'''
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f'renderCompetition replacement count={count}')

write(path, s)

# --- postseason-history.css ---
path = 'postseason-history.css'
css = read(path)
marker = '/* v2.78 parallel postseason stages */'
if marker not in css:
    css += r'''

/* v2.78 parallel postseason stages */
.postseason-stage-grid{display:grid;grid-template-columns:repeat(var(--postseason-stage-count,1),minmax(340px,1fr));gap:14px;align-items:start;overflow-x:auto;padding-bottom:4px;scrollbar-gutter:stable;}
.postseason-stage-card{min-width:340px;border:1px solid rgba(120,130,150,.22);border-radius:18px;padding:14px;background:rgba(255,255,255,.025);display:grid;gap:12px;align-content:start;}
.postseason-stage-title-row{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;}
.postseason-stage-title-row h3{margin:2px 0 0;font-size:18px;}
.postseason-stage-kicker{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;opacity:.5;}
.postseason-stage-count{font-size:11px;font-weight:700;opacity:.58;white-space:nowrap;}
.postseason-stage-summary{display:grid;grid-template-columns:1fr;gap:8px;}
.postseason-stage-card .postseason-summary-card{border-radius:13px;padding:10px;}
.postseason-stage-card .postseason-stat-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;}
.postseason-stage-card .postseason-stat{padding:6px 4px;}
.postseason-stage-card .postseason-stat strong{font-size:14px;}
.postseason-summary-empty{min-height:72px;display:grid;align-content:start;}
.postseason-summary-none{display:flex;align-items:center;justify-content:center;min-height:32px;border-radius:10px;background:rgba(127,127,127,.07);font-size:13px;font-weight:800;opacity:.72;}
.postseason-game-list-compact{gap:7px;}
.postseason-game-row-compact{display:grid;grid-template-columns:1fr!important;gap:6px!important;padding:10px!important;}
.postseason-game-topline{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.postseason-game-row-compact .postseason-game-matchup{grid-column:auto!important;grid-row:auto!important;}
.postseason-game-row-compact .postseason-game-player{grid-column:auto!important;grid-row:auto!important;margin-top:0!important;}
.postseason-game-row-compact .postseason-game-open{grid-column:auto!important;grid-row:auto!important;}
.postseason-series-score{font-size:11px;font-weight:800;opacity:.68;text-align:center;padding:5px 7px;border-radius:9px;background:rgba(127,127,127,.07);}
.postseason-game-player.is-dnp{opacity:.58;font-weight:800;}
@media(max-width:700px){
  .postseason-stage-grid{grid-template-columns:repeat(var(--postseason-stage-count,1),minmax(300px,84vw));gap:10px;}
  .postseason-stage-card{min-width:300px;padding:12px;}
  .postseason-stage-card .postseason-stat-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
}
'''
write(path, css)

# --- global version bump ---
for path in ['app.js','index.html','service-worker.js']:
    t = read(path)
    t = t.replace('v2.77', 'v2.78')
    if path == 'service-worker.js':
        t = t.replace('v277', 'v278')
    write(path, t)

write('version.json', json.dumps({'version':'v2.78'}, ensure_ascii=False, separators=(',',':')) + '\n')

# Basic verification
checks = {
    'postseason-history.js': ['seriesProgress(', 'postseason-stage-grid', '大比分 ${esc(seriesText)}', "gamePlayerLine(g)==='未出賽'"],
    'postseason-history.css': [marker, '.postseason-stage-grid', '.postseason-series-score'],
    'app.js': ["const APP_VERSION = 'v2.78'"],
    'index.html': ['?v=v2.78'],
    'service-worker.js': ['v278', '?v=v2.78'],
    'version.json': ['v2.78'],
}
for file, needles in checks.items():
    text = read(file)
    for n in needles:
        if n not in text:
            raise SystemExit(f'{file}: missing {n}')
print('v2.78 patch applied')
