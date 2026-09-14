from pathlib import Path
import json, re

# Bridge every rendered game-detail payload into the enhancement layer.
p = Path('app.js')
s = p.read_text(encoding='utf-8')
anchor = """    function renderHomeGameDetail(detail, game, { loading = false, error = '' } = {}) {
      const overlay = ensureHomeGameDetailOverlay();
      const body = overlay.querySelector('#homeGameDetailBody');
      if (!body) return;
"""
replacement = anchor + """      if (detail?.game) {
        window.__latestHomeGameDetail = detail;
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent('home-game-detail-state', {
            detail:{ detail, league:activeHomeGameDetail?.league || detail?.league || '', date:activeHomeGameDetail?.date || detail?.date || '' }
          }));
        });
      }
"""
if anchor not in s:
    raise SystemExit('renderHomeGameDetail anchor missing')
s = s.replace(anchor, replacement, 1)
p.write_text(s, encoding='utf-8')

# Enhancement consumes the explicit render-state bridge, not only intercepted fetch/realtime.
p = Path('game-detail-enhancement.js')
s = p.read_text(encoding='utf-8')
s = s.replace(
    "    const detail=latestDetail; if (!detail?.game) return;",
    "    const detail=latestDetail || window.__latestHomeGameDetail || null; if (!detail?.game) return;",
    1,
)
anchor2 = """  const acceptRealtimeDetail = event => {
    const detail=event?.detail?.detail||event?.detail?.row?.published_payload||null;
    if (!detail?.game) return;
    latestDetail=detail;
    scheduleEnhance();
  };
  window.addEventListener('cpbl-live-cache-update',acceptRealtimeDetail);
  window.addEventListener('npb-live-cache-update',acceptRealtimeDetail);
"""
replacement2 = anchor2 + """  window.addEventListener('home-game-detail-state', event => {
    const detail=event?.detail?.detail||null;
    if (!detail?.game) return;
    latestDetail=detail;
    scheduleEnhance();
  });
"""
if anchor2 not in s:
    raise SystemExit('realtime listener anchor missing')
s = s.replace(anchor2, replacement2, 1)

# Preserve the exact 1..9 slots even if one source entry is temporarily missing.
old = """  function renderLineupPanel(detail,side) {
    const entries=lineupEntries(detail,side), current=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name||'');
    const rows=Array.from({length:9},(_,i)=>entries[i]||{number:'',name:'',avg:'',hits:'',homeRuns:'',rbi:''});
"""
new = """  function renderLineupPanel(detail,side) {
    const entries=lineupEntries(detail,side), current=compactName(detail?.current?.batter?.fullName||detail?.current?.batter?.name||'');
    const byOrder=new Map(entries.map((entry,index)=>[Number(entry?.order)||index+1,entry]));
    const rows=Array.from({length:9},(_,i)=>byOrder.get(i+1)||{order:i+1,number:'',name:'',avg:'',hits:'',homeRuns:'',rbi:''});
"""
if old not in s:
    raise SystemExit('renderLineupPanel anchor missing')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Formal version bump.
for name in [
    'app.js','index.html','styles.css','cpbl-realtime.js','npb-realtime.js',
    'service-worker.js','diagnostics.html','game-detail-enhancement.js',
    'game-detail-enhancement.css','report-layout.js','report-layout.css',
    'postseason-history.js','landscape-state.js','landscape-state.css',
    'cpbl-cache-router.js','live-static-update.js'
]:
    q=Path(name)
    if not q.exists():
        continue
    x=q.read_text(encoding='utf-8').replace('v2.98','v2.99').replace('v298','v299')
    if name=='service-worker.js':
        x=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v299',x)
    q.write_text(x,encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v2.99'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

# Keep only current + immediately previous release artifacts.
for old_path in [
    '.github/scripts/apply_v297.py',
    '.github/scripts/smoke_v297.mjs',
    '.github/workflows/apply-v297.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v2.99 CPBL lineup render bridge applied')
