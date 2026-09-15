from pathlib import Path
import json, re

app = Path('app.js')
s = app.read_text(encoding='utf-8')

old = """        if (String(detail?.status || '').toLowerCase() === 'scheduled' && league === 'NPB' && (!fromAnyCache || force)) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
          }
        }
"""
new = """        // Preserve a previously fetched pregame card when a fresh published-cache detail
        // does not contain pregame data. CPBL scheduled rows are intentionally lightweight.
        if (detail && !force && !detail?.pregame && staleDetail?.pregame) {
          detail.pregame = staleDetail.pregame;
        }
        const detailStatus = String(detail?.status || '').toLowerCase();
        const supportsPregameStarters = league === 'CPBL' || league === 'NPB';
        if (detailStatus === 'scheduled' && supportsPregameStarters && (force || !detail?.pregame)) {
          try {
            detail.pregame = await pregameStarterRequest(league, date, { ...game, ...(detail?.game || {}) });
          } catch (pregameError) {
            detail.pregame = { awayStarter:null, homeStarter:null, error:pregameError?.message || '先發投手資料讀取失敗。' };
          }
        }
"""
if old not in s:
    raise SystemExit('target pregame block not found in app.js')
s = s.replace(old, new, 1)
app.write_text(s, encoding='utf-8')

for name in [
    'app.js','index.html','styles.css','cpbl-realtime.js','npb-realtime.js',
    'service-worker.js','diagnostics.html','game-detail-enhancement.js',
    'game-detail-enhancement.css','report-layout.js','report-layout.css',
    'postseason-history.js','landscape-state.js','landscape-state.css',
    'cpbl-cache-router.js','live-static-update.js'
]:
    p=Path(name)
    if not p.exists():
        continue
    text=p.read_text(encoding='utf-8').replace('v3.08','v3.09').replace('v308','v309')
    if name=='service-worker.js':
        text=re.sub(r'baseball-player-card-pwa-v\d+','baseball-player-card-pwa-v309',text)
    p.write_text(text,encoding='utf-8')

Path('version.json').write_text(json.dumps({'version':'v3.09'},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

# Keep only current + immediately previous release artifacts.
for old_path in [
    '.github/scripts/apply_v307.py',
    '.github/scripts/smoke_v307.mjs',
    '.github/workflows/apply-v307.yml',
]:
    Path(old_path).unlink(missing_ok=True)

print('v3.09 release wiring applied: CPBL scheduled games fetch official pregame starters')
