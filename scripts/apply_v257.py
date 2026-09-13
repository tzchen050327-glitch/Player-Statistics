from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILES = [
    'app.js','index.html','styles.css','game-detail-enhancement.css',
    'game-detail-enhancement.js','live-static-update.js','cpbl-cache-router.js',
    'cpbl-realtime.js','service-worker.js','rescue.html','report-layout.css','report-layout.js'
]
for rel in VERSION_FILES:
    p = ROOT / rel
    if not p.exists():
        continue
    s = p.read_text(encoding='utf-8')
    s = s.replace('v2.56','v2.57').replace('v256','v257').replace('V256','V257')
    p.write_text(s,encoding='utf-8')

p = ROOT / 'game-detail-enhancement.js'
s = p.read_text(encoding='utf-8')

# Backend scoreboard totals are authoritative. Do not recalculate the same totals
# from plays/inning cells unless the backend did not provide a value.
a = s.index('  function inferredTotals(detail) {')
b = s.index('  function currentOffenseSide(detail) {', a)
board = '''  function normalizedBoard(detail) {
    const game = detail?.game || {}, source = detail?.scoreboard || {};
    const innings = Array.isArray(source.innings) ? source.innings.map(String) : [];
    const away = Array.isArray(source.away) ? source.away : [], home = Array.isArray(source.home) ? source.home : [];
    const sum = values => {
      let total = 0, found = false;
      for (const v of values) if (/^-?\\d+$/.test(safeCell(v))) { total += Number(v); found = true; }
      return found ? total : null;
    };
    const pick = (primary, fallback='') => safeCell(primary) === '' ? fallback : primary;
    const awayRuns = pick(source?.awayTotals?.R, pick(game.awayScore, sum(away) ?? ''));
    const homeRuns = pick(source?.homeTotals?.R, pick(game.homeScore, sum(home) ?? ''));
    return {
      innings, away, home,
      awayTotals:{R:awayRuns,H:pick(source?.awayTotals?.H,''),E:pick(source?.awayTotals?.E,'')},
      homeTotals:{R:homeRuns,H:pick(source?.homeTotals?.H,''),E:pick(source?.homeTotals?.E,'')}
    };
  }

'''
s = s[:a] + board + s[b:]

# v2.57: batting order / substitutions are normalized once in cpbl-game-detail.
# The horizontal report is now a pure renderer.
a = s.index('  function lineupOrderFromGame(detail, side) {')
b = s.index('  function positionKey(value) {', a)
lineup = '''  function lineupEntries(detail, side) {
    return rawRoster(detail, side)
      .sort((a,b)=>(Number(a.order)||99)-(Number(b.order)||99))
      .slice(0,9);
  }

'''
s = s[:a] + lineup + s[b:]

# Defense is also already normalized by the backend/official current fielders.
a = s.index('  function defenseMap(detail, side) {')
b = s.index('  function directRunnerNames(detail) {', a)
defense = '''  function defenseMap(detail, side) {
    const raw = detail?.lineups?.[side] || {}, map = {};
    const fielders = Array.isArray(raw.fielders) ? raw.fielders : rawRoster(detail,side);
    for (const entry of fielders) {
      const key = positionKey(entry?.position || entry?.pos || ''), name = compactName(entry?.name || entry?.fullName || '');
      if (key && name) map[key] = name;
    }
    const pitcher = compactName(raw?.pitcher?.fullName || raw?.pitcher?.name || detail?.current?.pitcher?.fullName || detail?.current?.pitcher?.name || '');
    if (pitcher) map.p = pitcher;
    return map;
  }

'''
s = s[:a] + defense + s[b:]

# Field artwork and labels are separate layers, matching the desktop CSS.
old = '''  function renderDefenseField(detail,side) {
    const field=defenseMap(detail,side), spots=['lf','cf','rf','ss','2b','3b','1b','p','c'];
    return `<div class="gdx-field-card"><div class="gdx-mini-title">守備</div><div class="gdx-field-shape">${spots.map(pos=>`<div class="gdx-fielder gdx-pos-${pos}"><span>${esc(field[pos]||'—')}</span></div>`).join('')}</div></div>`;
  }
'''
new = '''  function renderDefenseField(detail,side) {
    const field=defenseMap(detail,side), spots=['lf','cf','rf','ss','2b','3b','1b','p','c'];
    return `<div class="gdx-field-card"><div class="gdx-mini-title">守備</div><div class="gdx-field-shape"></div><div class="gdx-fielders-layer">${spots.map(pos=>`<div class="gdx-fielder gdx-pos-${pos}"><span>${esc(field[pos]||'—')}</span></div>`).join('')}</div></div>`;
  }
'''
if old not in s:
    raise SystemExit('renderDefenseField block not found')
s = s.replace(old,new,1)

# Avoid building the portrait scoreboard/last-play/live widgets while the CPBL
# landscape report is active. Previously they were hidden but still processed,
# so the same information was normalized/rendered twice.
start = s.index('  function enhanceGameDetail() {')
end = s.index('  function scheduleEnhance() {', start)
new_enhance = '''  function enhanceGameDetail() {
    applyVersionLabel();
    const detail=latestDetail; if (!detail?.game) return;
    const overlay=document.getElementById('homeGameDetailOverlay'), body=overlay?.querySelector('#homeGameDetailBody');
    const league=String(detail?.league||'').toUpperCase(), isCpbl=league==='CPBL', isNpb=league==='NPB';
    const landscapeMode=isCpbl && window.matchMedia('(orientation: landscape) and (min-width: 700px)').matches;
    if (!isCpbl && !isNpb) {
      document.body.classList.remove('gdx-cpbl-landscape');
      body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
      return;
    }
    document.body.classList.toggle('gdx-cpbl-landscape',isCpbl);
    if (!isCpbl) body?.querySelectorAll('[data-gdx="landscape"],[data-gdx="live"]').forEach(node=>node.remove());
    if (!overlay||overlay.classList.contains('hidden')||!body||!sameGame(body,detail)) return;
    const scoreCard=body.querySelector('.game-detail-score-card'); if (!scoreCard) return;
    const board=normalizedBoard(detail); patchMainScore(scoreCard,board);
    const stamp=`${detailStamp(detail)}|${landscapeMode?'landscape':'portrait'}`;
    if (body.dataset.gdxStamp===stamp) return;
    body.dataset.gdxStamp=stamp;

    const portrait=body.querySelector('.game-detail-content');
    if (landscapeMode) {
      const landscapeHtml=renderLandscapeBoard(detail,board);
      if (body.querySelector('[data-gdx="landscape"]')) patchOrReplace(body,'[data-gdx="landscape"]',landscapeHtml,detail);
      else if (portrait) portrait.insertAdjacentHTML('beforebegin',landscapeHtml);
      body.querySelectorAll('[data-gdx="live"],[data-gdx="scoreboard"],[data-gdx="last-play"]').forEach(node=>node.remove());
    } else {
      body.querySelector('[data-gdx="landscape"]')?.remove();

      const status=String(detail.status||'').toLowerCase();
      let live=body.querySelector('[data-gdx="live"]');
      if (isCpbl && status==='live') {
        const liveHtml=renderLiveSituation(detail);
        if (live) patchOrReplace(body,'[data-gdx="live"]',liveHtml,detail);
        else scoreCard.insertAdjacentHTML('afterend',liveHtml);
      } else if (live) live.remove();

      const scoreHtml=renderScoreboard(detail,board);
      const scoreExtra=body.querySelector('[data-gdx="scoreboard"]');
      if (scoreExtra) patchOrReplace(body,'[data-gdx="scoreboard"]',scoreHtml,detail);
      else (body.querySelector('[data-gdx="live"]')||scoreCard).insertAdjacentHTML('afterend',scoreHtml);

      const playSection=body.querySelector('.game-detail-play-section'), prevHtml=renderPreviousPlay(detail), prev=body.querySelector('[data-gdx="last-play"]');
      if (prevHtml) {
        if (prev) patchOrReplace(body,'[data-gdx="last-play"]',prevHtml,detail);
        else if (playSection) playSection.insertAdjacentHTML('beforebegin',prevHtml);
      } else prev?.remove();
    }

    body.querySelector('.game-detail-current-grid')?.remove();
  }

'''
s = s[:start] + new_enhance + s[end:]

# Re-render when orientation/viewport mode changes, without reloading the page.
needle = "  document.addEventListener('click',event=>{if(event.target.closest('[data-home-game], .home-daily-game, .home-game-row')) setTimeout(scheduleEnhance,200);},true);\n"
if needle not in s:
    raise SystemExit('enhancement click listener not found')
s = s.replace(needle, needle + "  window.addEventListener('resize',scheduleEnhance,{passive:true});\n  window.addEventListener('orientationchange',()=>setTimeout(scheduleEnhance,80),{passive:true});\n", 1)

p.write_text(s,encoding='utf-8')
print('v2.57 patch applied')
